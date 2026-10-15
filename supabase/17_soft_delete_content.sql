-- 17_soft_delete_content.sql — protect student-authored content from client bugs.
-- Incident (Oct 2026): notes / highlights / flashcards / mistake tags were being
-- deleted in the cloud by the app's "mirror local state" sync whenever a device
-- held a stale/partial copy. From now on these tables NEVER accept a hard DELETE
-- from the app (privilege revoked for anon/authenticated). Removal is a soft
-- delete (deleted_at) and reads filter it out; re-adding revives the row.
do $$
declare t text;
begin
  foreach t in array array['user_notes','user_highlights','user_flashcards','user_mistakes'] loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('revoke delete on public.%I from anon, authenticated', t);
    execute format('create index if not exists %I on public.%I (user_id) where deleted_at is null', t || '_live_idx', t);
    -- make sure soft-deletes (updates) are allowed for the owner
    execute format('drop policy if exists %I on public.%I', t || '_own_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own_update', t);
  end loop;
end $$;
revoke truncate, references, trigger on public.user_notes, public.user_highlights, public.user_flashcards, public.user_mistakes from anon, authenticated;
-- Data restore (run once, 2026-10-15): the latest version of every note / highlight /
-- mistake / flashcard ever captured by the nightly backup.snapshot_progress() was
-- re-inserted where missing (82 notes, 1 highlight, 13 mistakes, flashcards deduped
-- per question). See supabase/scripts/restore_content_from_backups.py.
