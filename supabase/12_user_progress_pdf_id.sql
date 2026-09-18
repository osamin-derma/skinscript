-- ─────────────────────────────────────────────────────────────────────
-- Re-key used / wrong / flagged on the stable, globally-unique pdf_id.
--
-- WHY: these three tables were keyed on the app's numeric question id.
-- Every bank's ids start at 1 (Arab Board 1..1281, Board Vitals 1..1050,
-- Makki 1..1590, ETAS 1..7975), and the combined "All" bank offsets them
-- (+100k/+200k/+300k). So one question had two different ids depending on
-- where it was answered, and one id matched four different questions.
-- Result: double-counted "used", false "used"/"flagged" on other banks'
-- questions, and an "unused" count that went negative.
--
-- Run order (see supabase/scripts/backfill_pdf_id.py, which does all 3):
--   A. add the column                       (this file, phase A)
--   B. backfill pdf_id from question_id     (the script — mapping lives in the JSON banks)
--   C. dedupe + swap the primary key        (this file, phase B)
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────

-- ═══ Phase A: add the new key column ═══
alter table public.user_used  add column if not exists pdf_id text;
alter table public.user_wrong add column if not exists pdf_id text;
alter table public.user_flags add column if not exists pdf_id text;

-- ═══ Phase B (after backfill): merge duplicates, make pdf_id the key ═══
-- Two legacy rows can map to the SAME question (e.g. answered once in "All"
-- as 301300 and once in the ETAS bank as 1300). Keep one — this is the
-- de-duplication that fixes the inflated counts.
delete from public.user_used  a using public.user_used  b where a.user_id=b.user_id and a.pdf_id=b.pdf_id and a.ctid<b.ctid;
delete from public.user_wrong a using public.user_wrong b where a.user_id=b.user_id and a.pdf_id=b.pdf_id and a.ctid<b.ctid;
delete from public.user_flags a using public.user_flags b where a.user_id=b.user_id and a.pdf_id=b.pdf_id and a.ctid<b.ctid;
-- Anything the backfill could not map (should be none) cannot be keyed.
delete from public.user_used  where pdf_id is null;
delete from public.user_wrong where pdf_id is null;
delete from public.user_flags where pdf_id is null;

alter table public.user_used  alter column pdf_id set not null;
alter table public.user_wrong alter column pdf_id set not null;
alter table public.user_flags alter column pdf_id set not null;

-- question_id is now informational only (kept for audit), so it may be null.
alter table public.user_used  alter column question_id drop not null;
alter table public.user_wrong alter column question_id drop not null;
alter table public.user_flags alter column question_id drop not null;

alter table public.user_used  drop constraint if exists user_used_pkey;
alter table public.user_wrong drop constraint if exists user_wrong_pkey;
alter table public.user_flags drop constraint if exists user_flags_pkey;
alter table public.user_used  add primary key (user_id, pdf_id);
alter table public.user_wrong add primary key (user_id, pdf_id);
alter table public.user_flags add primary key (user_id, pdf_id);
