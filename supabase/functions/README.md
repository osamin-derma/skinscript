# SkinScript AI Tutor — activation (one-time)

The "Ask AI Tutor" chat under each question's explanation calls the `tutor`
edge function, which holds the Anthropic API key **server-side** (never in the
browser bundle, so it can't be extracted). Until the function is deployed *and*
the key is set, the tutor stays completely hidden — the rest of the app is
unaffected.

## Steps

1. Install the Supabase CLI (once): `brew install supabase/tap/supabase`
2. Log in: `supabase login`
3. From the repo root (`last11-quiz-app/`), deploy the function:

   ```sh
   supabase functions deploy tutor --project-ref yssrtjfgkctojkzcoapt
   ```

4. Set the Anthropic key as a secret (get one at console.anthropic.com — this is
   billed to **your** Anthropic account, so keep it server-side only):

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx --project-ref yssrtjfgkctojkzcoapt
   # optional — defaults to claude-haiku-4-5-20251001 (cheap + fast):
   # supabase secrets set TUTOR_MODEL=claude-haiku-4-5-20251001 --project-ref yssrtjfgkctojkzcoapt
   ```

That's it. Within ~30 minutes (the client caches the capability probe) the
"Ask AI Tutor" panel appears for signed-in users; clear site data to see it
immediately.

## Cost & safety notes

- Supabase verifies the caller's JWT by default, so **only signed-in users**
  can invoke the function (it's not an open proxy).
- The function caps history to the last 12 turns and `max_tokens` to 1024 to
  bound per-message cost.
- Haiku is the default model for low cost; switch `TUTOR_MODEL` to a larger
  model if you want stronger answers at higher cost.
- To turn the tutor **off** again: `supabase functions delete tutor` (or unset
  the key) — the UI hides itself automatically on the next probe.
