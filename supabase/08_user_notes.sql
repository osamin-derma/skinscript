-- ─────────────────────────────────────────────────────────────────────
-- Per-question personal notes (UWorld-style). Free text the user attaches
-- to a question; shown every time that question appears and collected in a
-- Notebook view. Keyed on the stable pdf_id (numeric ids are not globally
-- unique across banks).
--
-- Paste into the Supabase SQL Editor for project yssrtjfgkctojkzcoapt.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.user_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pdf_id     text not null,
  note       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, pdf_id)
);

alter table public.user_notes enable row level security;

-- Each user can read/write only their own notes.
drop policy if exists "user_notes_own_select" on public.user_notes;
create policy "user_notes_own_select" on public.user_notes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_notes_own_upsert" on public.user_notes;
create policy "user_notes_own_upsert" on public.user_notes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_notes_own_update" on public.user_notes;
create policy "user_notes_own_update" on public.user_notes
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_notes_own_delete" on public.user_notes;
create policy "user_notes_own_delete" on public.user_notes
  for delete to authenticated using (auth.uid() = user_id);
