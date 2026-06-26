-- ─────────────────────────────────────────────────────────────────────
-- Phase 1 — Move the question bank out of the JS bundle into Postgres.
--
-- Paste this whole file into the Supabase SQL Editor for project
-- yssrtjfgkctojkzcoapt, then run the companion script
--     /Users/osama/Desktop/New/migrate_questions_to_supabase.py
-- to seed the table from the local JSON files.
--
-- Safe to re-run: every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. The questions table ──────────────────────────────────────────
create table if not exists public.questions (
  id                    serial primary key,
  bank                  text   not null,    -- 'arabBoard' | 'boardVitals' | 'makki' | 'etas2026'
  bank_internal_id      int    not null,    -- the per-bank "id" field from the JSON
  pdf_id                text   not null,
  pdf_num               int,
  question              text   not null,
  choices               jsonb  not null default '{}',
  correct_answer        text,
  correct_text          text,
  explanation           text,
  incorrect_rationales  jsonb  default '{}',
  source                text,
  category              text,
  format                text   not null default 'mcq',  -- 'mcq' | 'short_answer' | 'mcq_no_key' | 'no_answer'
  images                text[] default '{}',           -- relative paths into the question-images bucket
  unique (bank, pdf_id)
);

create index if not exists questions_bank_idx        on public.questions (bank);
create index if not exists questions_bank_format_idx on public.questions (bank, format);
create index if not exists questions_category_idx    on public.questions (bank, category) where format = 'mcq';
create index if not exists questions_pdfid_idx       on public.questions (pdf_id);


-- ── 2. RLS — only authenticated users can read; nobody can write via API ──
alter table public.questions enable row level security;

drop policy if exists "questions_authenticated_read" on public.questions;
create policy "questions_authenticated_read" on public.questions
  for select
  to authenticated
  using (true);

-- No insert / update / delete policy at all → writes are denied for every
-- role except service_role (which bypasses RLS).  The migration script
-- uses the service_role key, so it can seed; the frontend cannot tamper.


-- ── 3. Lightweight summary RPCs used by the StartScreen ─────────────
-- Avoids shipping all 11,896 rows just to show bank counts.

create or replace function public.banks_summary()
returns table (
  bank        text,
  total_count int,
  mcq_count   int
)
language sql
security invoker          -- runs with the caller's privileges; RLS still applies
set search_path = public
as $$
  select bank,
         count(*)::int,
         count(*) filter (where format = 'mcq')::int
  from public.questions
  group by bank;
$$;

grant execute on function public.banks_summary() to authenticated;


create or replace function public.bank_categories(p_bank text)
returns table (
  category text,
  count    int
)
language sql
security invoker
set search_path = public
as $$
  select category, count(*)::int
  from public.questions
  where bank = p_bank
    and format = 'mcq'
    and category is not null
  group by category
  order by category;
$$;

grant execute on function public.bank_categories(text) to authenticated;


-- ── 4. Quiz-fetcher RPC — returns a randomized subset for a quiz ────
-- Replaces the client-side shuffle so the full bank never has to ship
-- to the user just to start a quiz.

create or replace function public.fetch_quiz(
  p_bank          text,
  p_category      text default null,
  p_count         int  default 40,
  p_exclude_ids   int[] default '{}'
)
returns setof public.questions
language sql
security invoker
set search_path = public
as $$
  select *
    from public.questions
   where bank = p_bank
     and format = 'mcq'
     and (p_category is null or category = p_category)
     and (p_exclude_ids is null or id <> all(p_exclude_ids))
   order by random()
   limit greatest(p_count, 1);
$$;

grant execute on function public.fetch_quiz(text, text, int, int[]) to authenticated;
