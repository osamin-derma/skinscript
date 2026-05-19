-- ─────────────────────────────────────────────────────────────────────
-- SkinScript — Supabase schema
--
-- Paste this whole file into the Supabase SQL Editor (Database → SQL
-- Editor → New query → Run) for project yssrtjfgkctojkzcoapt.
--
-- Safe to re-run: every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- 1. profiles ─────────────────────────────────────────────────────────
-- One row per auth user; the username we expose to the rest of the app.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      citext unique not null,
  display_name  text,
  created_at    timestamptz default now()
);

create extension if not exists citext;   -- case-insensitive usernames

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "profiles_self_insert" on public.profiles;

create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_self_insert" on public.profiles
  for insert with check (auth.uid() = id);


-- 2. Auto-create a profile row when a new auth user signs up.
-- The trigger reads the `username` we put in raw_user_meta_data during signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Username lookup RPCs (used by the frontend for login + signup checks)
--    SECURITY DEFINER so they bypass RLS — but they only ever return
--    minimal public-facing info.

create or replace function public.username_taken(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where username = p_username);
$$;

grant execute on function public.username_taken(text) to anon, authenticated;

create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
    from auth.users u
    join public.profiles p on p.id = u.id
   where p.username = p_username;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;


-- 4. Per-user quiz progress tables ────────────────────────────────────

create table if not exists public.quiz_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  taken_at        timestamptz default now(),
  mode            text not null,    -- 'tutor' | 'timed' | 'review'
  source          text,             -- 'all' | 'flagged' | 'wrong' | 'unused' | …
  bank            text,             -- 'all' | 'arabBoard' | 'boardVitals' | 'makki' | 'etas2026'
  total_questions int  not null,
  answered        int  not null,
  correct         int  not null,
  incorrect       int  not null,
  score           int  not null,
  time_per_q      int
);
create index if not exists quiz_history_user_taken on public.quiz_history (user_id, taken_at desc);

create table if not exists public.user_flags (
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  int  not null,
  flagged_at   timestamptz default now(),
  primary key (user_id, question_id)
);

create table if not exists public.user_wrong (
  user_id        uuid not null references auth.users(id) on delete cascade,
  question_id    int  not null,
  last_wrong_at  timestamptz default now(),
  primary key (user_id, question_id)
);

create table if not exists public.user_used (
  user_id       uuid not null references auth.users(id) on delete cascade,
  question_id   int  not null,
  last_used_at  timestamptz default now(),
  primary key (user_id, question_id)
);

-- RLS: each user only sees / writes their own rows.
alter table public.quiz_history enable row level security;
alter table public.user_flags   enable row level security;
alter table public.user_wrong   enable row level security;
alter table public.user_used    enable row level security;

drop policy if exists "history_self_all" on public.quiz_history;
drop policy if exists "flags_self_all"   on public.user_flags;
drop policy if exists "wrong_self_all"   on public.user_wrong;
drop policy if exists "used_self_all"    on public.user_used;

create policy "history_self_all" on public.quiz_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flags_self_all" on public.user_flags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wrong_self_all" on public.user_wrong
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "used_self_all" on public.user_used
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
