-- ─────────────────────────────────────────────────────────────────────
-- Phase: Invite-only registration (server-enforced access codes)
--
-- New users must redeem a unique single-use access code before an account
-- can be created. Enforcement lives in the auth.users INSERT trigger, so
-- it is impossible to bypass from the client — a signup with no reserved
-- code is rolled back at the database level.
--
-- Existing users are unaffected: login does not insert into auth.users,
-- so the trigger never fires for them.
--
-- Paste this whole file into the Supabase SQL Editor for project
-- yssrtjfgkctojkzcoapt and run it. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────


-- ── 1. Kill-switch / settings ───────────────────────────────────────
-- Lets the owner instantly disable the invite requirement in an
-- emergency (e.g. if it ever blocks a legitimate user) without a code
-- deploy:  update public.app_settings set value='false'
--          where key='require_invite_code';
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

insert into public.app_settings (key, value)
values ('require_invite_code', 'true')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
-- No policies → only service_role (SQL editor) can read/write. The trigger
-- reads it via SECURITY DEFINER, so RLS doesn't block the check.


-- ── 2. Access codes table ───────────────────────────────────────────
create table if not exists public.access_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,          -- e.g. 'SKIN-7F3K-92QX'
  status       text not null default 'active', -- 'active' | 'used' | 'revoked'
  note         text,                           -- who you gave it to (free text)
  reserved_for text,                           -- email or phone mid-signup
  reserved_at  timestamptz,
  used_by      uuid references auth.users(id) on delete set null,
  used_at      timestamptz,
  expires_at   timestamptz,                    -- optional hard expiry
  created_at   timestamptz default now()
);

create index if not exists access_codes_status_idx       on public.access_codes (status);
create index if not exists access_codes_reserved_for_idx on public.access_codes (reserved_for) where used_by is null;

alter table public.access_codes enable row level security;
-- No policies → the table is invisible to anon / authenticated clients.
-- Only the SECURITY DEFINER functions below and the SQL editor touch it.


-- ── 3. Code generator (owner runs this in the SQL editor) ───────────
-- Uses an unambiguous alphabet (no 0/O/1/I/L) so codes are easy to read
-- aloud / type. Format: <PREFIX>-XXXX-XXXX.
create or replace function public.generate_access_codes(
  p_count  int,
  p_note   text default null,
  p_prefix text default 'SKIN'
)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  new_code text;
  i int;
  attempts int;
begin
  for i in 1..greatest(p_count, 1) loop
    attempts := 0;
    loop
      new_code := p_prefix || '-' ||
        (select string_agg(substr(alphabet, floor(random()*length(alphabet))::int + 1, 1), '')
           from generate_series(1, 4)) || '-' ||
        (select string_agg(substr(alphabet, floor(random()*length(alphabet))::int + 1, 1), '')
           from generate_series(1, 4));
      begin
        insert into public.access_codes (code, note) values (new_code, p_note);
        exit;  -- success
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts > 10 then
          raise exception 'could not generate a unique code after 10 tries';
        end if;
      end;
    end loop;
    return next new_code;
  end loop;
end;
$$;

-- NOT granted to anon/authenticated — only the SQL editor (service_role)
-- can mint codes.
revoke all on function public.generate_access_codes(int, text, text) from anon, authenticated;


-- ── 4. Reservation RPC (called by the un-authenticated signup screen) ─
-- Validates a code and reserves it for the email/phone about to sign up.
-- Returns { ok: bool, reason: text }. Never reveals any code data.
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
  norm_id   text := lower(btrim(p_identifier));
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
       or reserved_for = norm_id
       or reserved_at < now() - interval '2 hours'   -- stale reservation by someone else
     )
   for update
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_used');
  end if;

  update public.access_codes
     set reserved_for = norm_id,
         reserved_at  = now()
   where id = rec.id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.reserve_access_code(text, text) to anon, authenticated;


-- ── 5. Enforce at account creation ──────────────────────────────────
-- Extends the existing handle_new_user() trigger. Before creating the
-- profile, it requires a reserved, unused, non-expired code matching the
-- new account's email or phone. On failure it RAISEs, which rolls back
-- the auth.users INSERT → no account is created.
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
  -- ── Access-code gate ──
  select (value = 'true') into require_code
    from public.app_settings where key = 'require_invite_code';
  require_code := coalesce(require_code, false);

  if require_code then
    identifier := lower(coalesce(new.email, new.phone));

    select id into code_id
      from public.access_codes
     where status = 'active'
       and used_by is null
       and reserved_for = identifier
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

  -- ── Profile creation (unchanged logic) ──
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

-- Trigger already exists from the base schema; re-create to be safe.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
