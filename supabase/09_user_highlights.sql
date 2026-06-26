-- ─────────────────────────────────────────────────────────────────────
-- Persistent text highlights. The question highlighter previously lived in
-- localStorage keyed on the (bank-relative, unstable) numeric id; this moves
-- it to Supabase keyed on the stable pdf_id so highlights survive across
-- devices and bank rebuilds. `ranges` is a jsonb array of {start,end} char
-- offsets into the question text.
--
-- Paste into the Supabase SQL Editor for project yssrtjfgkctojkzcoapt.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.user_highlights (
  user_id    uuid not null references auth.users(id) on delete cascade,
  pdf_id     text not null,
  ranges     jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, pdf_id)
);

alter table public.user_highlights enable row level security;

drop policy if exists "user_highlights_own_select" on public.user_highlights;
create policy "user_highlights_own_select" on public.user_highlights
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_highlights_own_insert" on public.user_highlights;
create policy "user_highlights_own_insert" on public.user_highlights
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_highlights_own_update" on public.user_highlights;
create policy "user_highlights_own_update" on public.user_highlights
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_highlights_own_delete" on public.user_highlights;
create policy "user_highlights_own_delete" on public.user_highlights
  for delete to authenticated using (auth.uid() = user_id);
