-- ─────────────────────────────────────────────────────────────────────
-- Flashcards — Anki-style cards with the same Leitner schedule as the
-- question SRS. A card can be created from a question (front = stem, back =
-- correct answer + explanation) and keeps its own review schedule.
--
-- Paste into the Supabase SQL Editor for project yssrtjfgkctojkzcoapt.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.user_flashcards (
  id            uuid not null,            -- client-generated (crypto.randomUUID)
  user_id       uuid not null references auth.users(id) on delete cascade,
  pdf_id        text,                     -- source question, if made from one
  front         text not null,
  back          text not null,
  box           int  not null default 0,
  interval_days int  not null default 1,
  due_at        timestamptz not null,
  reps          int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists user_flashcards_due_idx
  on public.user_flashcards (user_id, due_at);

alter table public.user_flashcards enable row level security;

drop policy if exists "flashcards_own_select" on public.user_flashcards;
create policy "flashcards_own_select" on public.user_flashcards
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "flashcards_own_insert" on public.user_flashcards;
create policy "flashcards_own_insert" on public.user_flashcards
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "flashcards_own_update" on public.user_flashcards;
create policy "flashcards_own_update" on public.user_flashcards
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "flashcards_own_delete" on public.user_flashcards;
create policy "flashcards_own_delete" on public.user_flashcards
  for delete to authenticated using (auth.uid() = user_id);
