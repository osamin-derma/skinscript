-- ─────────────────────────────────────────────────────────────────────
-- Phase 2 — Private storage for clinical images and study PDFs.
--
-- Today the `question-images` bucket is PUBLIC: anyone who guesses the URL
-- pattern can download every image without logging in. This makes both
-- buckets PRIVATE and lets only authenticated users mint short-lived
-- signed URLs, so files are no longer freely scrapable.
--
-- STEP A (dashboard, can't be done in pure SQL):
--   Storage → question-images → Settings → toggle "Public bucket" OFF.
--   Create a bucket `study-resources` (for the Library PDFs) → Private.
--
-- STEP B (this file, SQL Editor): policies that grant authenticated users
--   read access to the objects (which is what createSignedUrl needs) while
--   denying anonymous access entirely.
--
-- After this, update the frontend to resolve image/PDF paths to signed URLs
-- (see SECURITY_RUNBOOK.md, Phase 2 cutover). Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

-- Only authenticated users may read objects in these private buckets.
-- A logged-in client can then call
--   supabase.storage.from('question-images').createSignedUrl(path, 60)
-- to get a 60-second link. Anonymous users match no SELECT policy → blocked.

drop policy if exists "auth_read_question_images" on storage.objects;
create policy "auth_read_question_images" on storage.objects
  for select to authenticated
  using (bucket_id = 'question-images');

drop policy if exists "auth_read_study_resources" on storage.objects;
create policy "auth_read_study_resources" on storage.objects
  for select to authenticated
  using (bucket_id = 'study-resources');

-- Writes (upload/replace/delete) are intentionally left with NO policy, so
-- they are denied for anon + authenticated and only possible with the
-- service-role key (the upload scripts). The frontend can never mutate files.
