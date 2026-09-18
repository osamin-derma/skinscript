-- ─────────────────────────────────────────────────────────────────────
-- Daily in-database snapshot of every per-user progress table.
--
-- WHY: the project is on Supabase Free — no daily backups, no PITR. On
-- 2026-09-18 an app-level bug deleted a student's entire progress and
-- nothing could restore it. This keeps 14 days of nightly copies in a
-- separate `backup` schema (NOT exposed via the API, untouched by the
-- app's clear/reset paths), so a wiped account can be restored in minutes.
--
-- Restore one user (example, run in SQL):
--   insert into public.user_used (user_id, pdf_id, last_used_at)
--     select user_id, pdf_id, last_used_at from backup.user_used
--     where user_id = '<uuid>' and snapshot_at = (select max(snapshot_at) from backup.user_used where user_id='<uuid>')
--     on conflict (user_id, pdf_id) do nothing;
-- Idempotent. Requires the pg_cron extension.
-- ─────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create schema if not exists backup;

create or replace function backup.snapshot_progress() returns void
language plpgsql security definer set search_path = public, backup as $$
declare t text;
begin
  foreach t in array array['user_used','user_wrong','user_flags','quiz_history',
                           'user_review_schedule','user_notes','user_highlights','user_flashcards'] loop
    execute format('create table if not exists backup.%I as select now() as snapshot_at, s.* from public.%I s where false', t, t);
    execute format('insert into backup.%I select now(), s.* from public.%I s', t, t);
    execute format('delete from backup.%I where snapshot_at < now() - interval ''14 days''', t);
  end loop;
end $$;

-- nightly at 03:15 UTC (re-schedulable by name)
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'daily-progress-backup';
  perform cron.schedule('daily-progress-backup', '15 3 * * *', 'select backup.snapshot_progress()');
end $$;
