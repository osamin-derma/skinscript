-- ─────────────────────────────────────────────────────────────────────
-- Spaced repetition — a per-question review schedule (Leitner-style boxes).
-- Each answer advances the question to a longer interval when correct and
-- resets it when wrong; the "Due for review" queue pulls questions whose
-- due_at has passed. Keyed on the stable pdf_id.
--
-- `last_confidence` is included now (nullable) so the upcoming confidence
-- feature folds into the same row instead of a second table.
--
-- Paste into the Supabase SQL Editor for project yssrtjfgkctojkzcoapt.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.user_review_schedule (
  user_id         uuid not null references auth.users(id) on delete cascade,
  pdf_id          text not null,
  box             int  not null default 0,        -- ladder index
  interval_days   int  not null default 1,
  due_at          timestamptz not null,
  reps            int  not null default 0,
  last_grade      int,                             -- 1 correct, 0 wrong
  last_confidence text,                            -- 'guessed' | 'unsure' | 'sure' (future)
  updated_at      timestamptz not null default now(),
  primary key (user_id, pdf_id)
);
create index if not exists user_review_schedule_due_idx
  on public.user_review_schedule (user_id, due_at);

alter table public.user_review_schedule enable row level security;

drop policy if exists "review_own_select" on public.user_review_schedule;
create policy "review_own_select" on public.user_review_schedule
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "review_own_insert" on public.user_review_schedule;
create policy "review_own_insert" on public.user_review_schedule
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "review_own_update" on public.user_review_schedule;
create policy "review_own_update" on public.user_review_schedule
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "review_own_delete" on public.user_review_schedule;
create policy "review_own_delete" on public.user_review_schedule
  for delete to authenticated using (auth.uid() = user_id);
