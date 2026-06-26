-- ─────────────────────────────────────────────────────────────────────
-- Reviewable past exams — store each quiz's per-question detail so a user
-- can reopen a previous exam and see every question with their answer, the
-- correct answer, and the explanation.
--
-- `detail` is a compact JSON array of {id, selected} in exam order; the
-- question text/choices/explanation are re-resolved from the bank at review
-- time, so this stays small. Older rows simply have detail = null and show
-- summary-only (no saved per-question data to reopen).
--
-- Paste into the Supabase SQL Editor for project yssrtjfgkctojkzcoapt.
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────

alter table public.quiz_history
  add column if not exists detail jsonb;

-- RLS on quiz_history already restricts rows to their owner; no new policy
-- is needed — `detail` is covered by the existing per-user policies.
