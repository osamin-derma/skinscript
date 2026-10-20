-- ─────────────────────────────────────────────────────────────────────
-- Demo access codes for App Store / Play Store review
-- Project: yssrtjfgkctojkzcoapt  (run in the Supabase SQL Editor)
--
-- SkinScript is invite-only, so a reviewer cannot get in without help.
-- These are single-use invite codes with NO expiry and a clear note so you
-- don't revoke them mid-review. Three are created to cover Apple, Google and
-- a re-review.
-- ─────────────────────────────────────────────────────────────────────

insert into public.access_codes (code, note)
values
  ('SKIN-DEMO-APPLE',  'App Store reviewer demo — keep ACTIVE during review'),
  ('SKIN-DEMO-GOOGLE', 'Play Store reviewer demo — keep ACTIVE during review'),
  ('SKIN-DEMO-SPARE',  'Spare reviewer demo (re-reviews) — keep ACTIVE')
on conflict (code) do nothing;

-- Confirm they exist and are still unused:
select code, status, note
  from public.access_codes
 where code like 'SKIN-DEMO-%'
 order by code;


-- ─────────────────────────────────────────────────────────────────────
-- RECOMMENDED: give reviewers a ready-to-use LOGIN, not a code
--
-- Registering needs email confirmation, which a reviewer usually can't do.
-- The reliable path is to hand them an account that already works:
--
--   1. Run the INSERT above.
--   2. In the app, register ONE test account using code SKIN-DEMO-APPLE
--      (e.g. email  skinscript.review@gmail.com  — an inbox you control —
--      and a simple password). Confirm the email once.
--   3. Put that email + password in each store's "App Review Information" /
--      "App access" notes. Reviewers just sign in — no code, no email step.
--
-- If your Supabase project has "Confirm email" turned OFF, the reviewer can
-- instead register directly with one of the codes above; then the code, not a
-- login, goes in the review notes.
-- ─────────────────────────────────────────────────────────────────────
