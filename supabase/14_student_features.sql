-- ─────────────────────────────────────────────────────────────────────
-- Student features (2026-09-19): settings/study planner, mistakes notebook,
-- question reports, admin cohort dashboard, peer stats, opt-in leaderboard.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- Per-user settings (exam date for the planner, daily goal, leaderboard opt-in)
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  exam_date          date,
  daily_goal         int  not null default 30,
  leaderboard_opt_in boolean not null default false,
  display_name       text,
  updated_at         timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists "settings_own_select" on public.user_settings;
create policy "settings_own_select" on public.user_settings for select to authenticated using (auth.uid() = user_id);
drop policy if exists "settings_own_insert" on public.user_settings;
create policy "settings_own_insert" on public.user_settings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "settings_own_update" on public.user_settings;
create policy "settings_own_update" on public.user_settings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Mistakes notebook: WHY a question was missed (error typing)
create table if not exists public.user_mistakes (
  user_id uuid not null references auth.users(id) on delete cascade,
  pdf_id  text not null,
  reason  text not null check (reason in ('knowledge','misread','changed','guessed','other')),
  note    text,
  at      timestamptz not null default now(),
  primary key (user_id, pdf_id)
);
alter table public.user_mistakes enable row level security;
drop policy if exists "mistakes_own_all" on public.user_mistakes;
create policy "mistakes_own_all" on public.user_mistakes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admins (the owner). is_admin() lets the client show the cohort dashboard.
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
insert into public.admins (user_id) values ('dba96aa4-88a4-45ff-ab1d-d9334b6e7a3d') on conflict do nothing;
alter table public.admins enable row level security;
drop policy if exists "admins_self_select" on public.admins;
create policy "admins_self_select" on public.admins for select to authenticated using (auth.uid() = user_id);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- Question reports (students flag a wrong key / typo); admins see all
create table if not exists public.question_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  pdf_id     text not null,
  reason     text not null,
  comment    text,
  status     text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists question_reports_pdf_idx on public.question_reports (pdf_id);
alter table public.question_reports enable row level security;
drop policy if exists "reports_own_insert" on public.question_reports;
create policy "reports_own_insert" on public.question_reports for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "reports_select" on public.question_reports;
create policy "reports_select" on public.question_reports for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "reports_admin_update" on public.question_reports;
create policy "reports_admin_update" on public.question_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Peer stats: anonymous per-question answer distribution across ALL students,
-- computed from quiz_history.detail. Returns only aggregates (min 3 attempts).
create or replace function public.peer_stats()
returns table (pdf_id text, n bigint, counts jsonb)
language sql stable security definer set search_path = public as $$
  with a as (
    select d->>'pdf_id' as pid, d->>'selected' as sel
    from public.quiz_history h
    cross join lateral jsonb_array_elements(coalesce(h.detail, '[]'::jsonb)) d
    where coalesce(d->>'selected','') <> ''
  ), b as (
    select pid, sel, count(*) as c from a group by pid, sel
  )
  select pid, sum(c)::bigint, jsonb_object_agg(sel, c)
  from b group by pid having sum(c) >= 3;
$$;
grant execute on function public.peer_stats() to authenticated;

-- Cohort dashboard (admin only)
create or replace function public.cohort_stats()
returns table (user_id uuid, username text, email text, phone text, last_active timestamptz,
               quizzes bigint, avg_score numeric, used_count bigint, wrong_count bigint,
               flags_count bigint, answered_7d bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select u.id, (u.raw_user_meta_data->>'username')::text, u.email::text, u.phone::text,
    (select max(h.taken_at) from public.quiz_history h where h.user_id = u.id),
    (select count(*) from public.quiz_history h where h.user_id = u.id),
    (select round(avg(h.score)::numeric, 1) from public.quiz_history h where h.user_id = u.id),
    (select count(*) from public.user_used x where x.user_id = u.id),
    (select count(*) from public.user_wrong x where x.user_id = u.id),
    (select count(*) from public.user_flags x where x.user_id = u.id),
    (select coalesce(sum(h.answered),0)::bigint from public.quiz_history h where h.user_id = u.id and h.taken_at > now() - interval '7 days')
  from auth.users u
  order by 5 desc nulls last;
end $$;
grant execute on function public.cohort_stats() to authenticated;

-- Opt-in weekly leaderboard (only opted-in students, display names only)
create or replace function public.leaderboard()
returns table (username text, answered_7d bigint, quizzes_7d bigint, is_me boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(s.display_name, u.raw_user_meta_data->>'username', 'Student')::text,
         coalesce(sum(h.answered), 0)::bigint, count(h.id)::bigint, (u.id = auth.uid())
  from public.user_settings s
  join auth.users u on u.id = s.user_id
  left join public.quiz_history h on h.user_id = u.id and h.taken_at > now() - interval '7 days'
  where s.leaderboard_opt_in
  group by u.id, s.display_name, u.raw_user_meta_data
  order by 2 desc limit 20;
$$;
grant execute on function public.leaderboard() to authenticated;

-- Nightly snapshot now covers the new per-user tables too
create or replace function backup.snapshot_progress() returns void
language plpgsql security definer set search_path = public, backup as $$
declare t text;
begin
  foreach t in array array['user_used','user_wrong','user_flags','quiz_history','user_review_schedule',
                           'user_notes','user_highlights','user_flashcards','user_settings','user_mistakes','question_reports'] loop
    execute format('create table if not exists backup.%I as select now() as snapshot_at, s.* from public.%I s where false', t, t);
    execute format('insert into backup.%I select now(), s.* from public.%I s', t, t);
    execute format('delete from backup.%I where snapshot_at < now() - interval ''14 days''', t);
  end loop;
end $$;
