-- ─────────────────────────────────────────────────────────────────────
-- Fix: SMS access-code signups failed ("Database error saving new user").
--
-- Cause: the client reserves a code against the phone WITH a leading '+'
-- (+9647…), but Supabase stores auth.users.phone WITHOUT the '+' (9647…).
-- The account-creation trigger compared the two literally, never matched,
-- and rolled back every SMS registration.
--
-- Fix: normalize identifiers by stripping a leading '+' on both the
-- reservation side and the trigger side. Email identifiers are unaffected
-- (they never start with '+'). Also releases any reservations that got
-- stuck in the broken format so affected users aren't locked out.
--
-- Paste into the Supabase SQL Editor and run. Idempotent.
-- ─────────────────────────────────────────────────────────────────────


-- 1. Reservation RPC — strip leading '+' when storing + comparing.
create or replace function public.reserve_access_code(
  p_code       text,
  p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.access_codes%rowtype;
  norm_code text := upper(btrim(p_code));
  norm_id   text := lower(regexp_replace(btrim(p_identifier), '^\+', ''));
begin
  if norm_code = '' or norm_id = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  select * into rec
    from public.access_codes
   where code = norm_code
     and status = 'active'
     and used_by is null
     and (expires_at is null or expires_at > now())
     and (
       reserved_for is null
       or lower(regexp_replace(reserved_for, '^\+', '')) = norm_id
       or reserved_at < now() - interval '2 hours'
     )
   for update
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_used');
  end if;

  update public.access_codes
     set reserved_for = norm_id,   -- always stored WITHOUT '+'
         reserved_at  = now()
   where id = rec.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.reserve_access_code(text, text) to anon, authenticated;


-- 2. Account-creation trigger — strip leading '+' on both sides of the match.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username  text;
  final_username text;
  suffix         int := 0;
  identifier     text;
  code_id        uuid;
  require_code   boolean;
begin
  select (value = 'true') into require_code
    from public.app_settings where key = 'require_invite_code';
  require_code := coalesce(require_code, false);

  if require_code then
    identifier := lower(regexp_replace(coalesce(new.email, new.phone), '^\+', ''));

    select id into code_id
      from public.access_codes
     where status = 'active'
       and used_by is null
       and lower(regexp_replace(reserved_for, '^\+', '')) = identifier
       and reserved_at > now() - interval '2 hours'
       and (expires_at is null or expires_at > now())
     order by reserved_at desc
     for update
     limit 1;

    if code_id is null then
      raise exception 'ACCESS_CODE_REQUIRED: a valid access code is required to register';
    end if;

    update public.access_codes
       set status  = 'used',
           used_by = new.id,
           used_at = now()
     where id = code_id;
  end if;

  -- Profile creation (unchanged)
  base_username := coalesce(
    new.raw_user_meta_data->>'username',
    case
      when new.email is not null then split_part(new.email, '@', 1)
      when new.phone is not null then 'wa_' || right(new.phone, 6)
      else 'user_' || substr(new.id::text, 1, 8)
    end
  );
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  if length(base_username) < 3 then
    base_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  final_username := base_username;
  while exists(select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', final_username)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Release reservations stuck in the old '+'-prefixed format so the
--    affected codes are immediately usable again. Touches only unused,
--    still-active codes — used codes are left alone.
update public.access_codes
   set reserved_for = null,
       reserved_at  = null
 where status = 'active'
   and used_by is null
   and reserved_for like '+%';
