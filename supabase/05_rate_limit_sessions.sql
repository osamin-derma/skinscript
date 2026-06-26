-- ─────────────────────────────────────────────────────────────────────
-- Phase 3 + 4 — Rate limiting + session control.
--
-- These don't make extraction impossible (a logged-in human can always
-- read what they're shown), but they cap how fast/often any one account
-- can pull data, tie every pull to a revocable identity, and limit how
-- many devices an account can run at once. Combined with the identity
-- watermark, a bulk leak becomes slow, attributable, and stoppable.
--
-- Paste into the Supabase SQL Editor for project yssrtjfgkctojkzcoapt.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

-- ══ Phase 3 — per-account rate limiting ═══════════════════════════════

create table if not exists public.fetch_audit (
  id       bigserial primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  kind     text not null,                 -- 'full_bank' | 'quiz' | 'image_batch'
  at       timestamptz not null default now()
);
create index if not exists fetch_audit_user_kind_at_idx
  on public.fetch_audit (user_id, kind, at desc);

alter table public.fetch_audit enable row level security;
-- Users may only write their own audit rows; nobody reads them via the API
-- (the owner inspects them with the service key / SQL).
drop policy if exists "fetch_audit_own_insert" on public.fetch_audit;
create policy "fetch_audit_own_insert" on public.fetch_audit
  for insert to authenticated with check (auth.uid() = user_id);

-- rate_guard(kind, max, window): records this access and returns FALSE when
-- the account has already exceeded `max` accesses of `kind` within `window`.
-- SECURITY DEFINER so the count can't be tampered with from the client.
create or replace function public.rate_guard(p_kind text, p_max int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n   int;
begin
  if uid is null then
    return false;                         -- anonymous: never allowed
  end if;
  select count(*) into n
    from public.fetch_audit
   where user_id = uid and kind = p_kind and at > now() - p_window;
  if n >= p_max then
    return false;                         -- over quota
  end if;
  insert into public.fetch_audit(user_id, kind) values (uid, p_kind);
  return true;
end;
$$;
grant execute on function public.rate_guard(text, int, interval) to authenticated;


-- ══ Phase 4 — device / session control ════════════════════════════════
-- The app stores a random device_id in localStorage and calls touch_device
-- on load + periodically. An account is limited to the N most-recently-seen
-- devices; older ones are evicted and the owner can revoke any device
-- instantly (set revoked = true). A client that gets 'revoked'/'evicted'
-- signs itself out.

create table if not exists public.user_devices (
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,
  label      text,                        -- optional UA hint for the owner
  last_seen  timestamptz not null default now(),
  revoked    boolean not null default false,
  primary key (user_id, device_id)
);
create index if not exists user_devices_user_active_idx
  on public.user_devices (user_id, last_seen desc) where not revoked;

alter table public.user_devices enable row level security;
drop policy if exists "user_devices_own_read" on public.user_devices;
create policy "user_devices_own_read" on public.user_devices
  for select to authenticated using (auth.uid() = user_id);

-- touch_device(device_id, max, label): registers/refreshes this device,
-- evicts anything beyond the N most-recent, and reports this device's status.
-- Returns 'ok' | 'revoked' | 'evicted'.
create or replace function public.touch_device(p_device_id text, p_max int, p_label text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return 'revoked';
  end if;

  -- Already explicitly revoked by the owner?
  if exists (select 1 from public.user_devices
              where user_id = uid and device_id = p_device_id and revoked) then
    return 'revoked';
  end if;

  insert into public.user_devices(user_id, device_id, label, last_seen)
  values (uid, p_device_id, p_label, now())
  on conflict (user_id, device_id)
    do update set last_seen = now(), label = coalesce(excluded.label, public.user_devices.label);

  -- Evict everything beyond the N most-recently-seen active devices.
  update public.user_devices
     set revoked = true
   where user_id = uid
     and not revoked
     and device_id not in (
       select device_id from public.user_devices
        where user_id = uid and not revoked
        order by last_seen desc
        limit greatest(p_max, 1)
     );

  if exists (select 1 from public.user_devices
              where user_id = uid and device_id = p_device_id and revoked) then
    return 'evicted';
  end if;
  return 'ok';
end;
$$;
grant execute on function public.touch_device(text, int, text) to authenticated;
