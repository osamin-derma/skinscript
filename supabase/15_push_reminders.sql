-- 15_push_reminders.sql — Web Push subscriptions + hourly reminder job.
-- Idempotent. The shared secret + function URL live in private.push_cron and
-- are inserted by the apply step (never in this file).

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  endpoint      text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  tz_offset_min int  not null default 0,       -- minutes east of UTC, from the browser
  created_at    timestamptz not null default now(),
  last_sent_on  date,                          -- one reminder per local day
  fail_count    int  not null default 0        -- 410/404 from the push service → pruned
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own_all" on public.push_subscriptions;
create policy "push_own_all" on public.push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Private schema: NOT exposed through PostgREST; only postgres/cron read it.
create schema if not exists private;
revoke all on schema private from public;
create table if not exists private.push_cron (
  id     int  primary key default 1 check (id = 1),
  secret text not null,
  url    text not null
);

-- Every hour at :05, POST to the push-reminders edge function. The function
-- decides who gets a reminder (local time ≈ 18:00, reviews due or streak at
-- risk) and sends via Web Push.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-reminders-hourly') then
    perform cron.unschedule('push-reminders-hourly');
  end if;
end $$;
select cron.schedule('push-reminders-hourly', '5 * * * *', $job$
  select net.http_post(
    url     := (select url from private.push_cron where id = 1),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select secret from private.push_cron where id = 1)),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
$job$);
