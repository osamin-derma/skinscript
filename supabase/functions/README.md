# SkinScript edge functions

Both functions are **deployed** (via the Supabase Management API, no CLI
needed) and their non-billable secrets are set. Status:

| function | purpose | auth | state |
|---|---|---|---|
| `tutor` | AI tutor chat + AI study brief (Anthropic key server-side) | JWT (`verify_jwt = true`) + per-user `rate_guard` | deployed — **needs `ANTHROPIC_API_KEY`** |
| `push-reminders` | daily Web Push study reminders | `x-cron-secret` header (called hourly by pg_cron) | deployed + running |

## The one remaining step: the Anthropic key

The tutor and the study brief stay hidden in the app until the key exists.
Set it once (billed to **your** Anthropic account, never shipped to browsers):

- Dashboard: Project Settings → Edge Functions → Secrets → add
  `ANTHROPIC_API_KEY` = `sk-ant-…`, **or**
- CLI: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-… --project-ref yssrtjfgkctojkzcoapt`

Optional: `TUTOR_MODEL` (default `claude-haiku-4-5-20251001`), `TUTOR_RATE_MAX`
(default 60 messages/hour/user; the study brief is capped at 6/hour/user).
The UI re-probes within ~90 s of the key being set.

To redeploy after editing `index.ts` (Management API, multipart):

```sh
curl -X POST -H "Authorization: Bearer $SUPABASE_PAT" \
  "https://api.supabase.com/v1/projects/yssrtjfgkctojkzcoapt/functions/deploy?slug=tutor" \
  -F 'metadata={"entrypoint_path":"index.ts","name":"tutor","verify_jwt":true};type=application/json' \
  -F "file=@supabase/functions/tutor/index.ts;filename=index.ts"
```

(`push-reminders` is deployed the same way with `"verify_jwt":false` — it is
secret-gated instead, see `supabase/config.toml`.)

## push-reminders

- Client: `src/lib/push.js` subscribes the browser (VAPID public key) and
  stores it in `public.push_subscriptions`; toggle in the account drawer
  (`RemindersToggle.jsx`) and the bell on the Create-tab reminders banner.
- Service worker: `public/sw-push.js` (imported by the generated Workbox SW).
- Server: `supabase/15_push_reminders.sql` schedules `push-reminders-hourly`
  (`5 * * * *`) → `net.http_post` to the function with the secret stored in
  `private.push_cron`. The function sends at ~18:00 **local** time per
  subscription (`PUSH_LOCAL_HOUR` to change), once per day, when reviews are
  due or a streak is at risk; dead subscriptions (404/410) are pruned.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  `PUSH_CRON_SECRET` (set). Rotate by generating a new VAPID pair, updating
  the secret + `VAPID_PUBLIC_KEY` in `src/lib/push.js`; users re-subscribe.
- Test: `POST /functions/v1/push-reminders` with header `x-cron-secret` and
  body `{"dry_run":true,"test_user_id":"<uuid>","tz_offset_min":180}` returns
  the message that user would get, without sending.
- iOS: Web Push only works for the app installed to the Home Screen (16.4+);
  the toggle explains this in-app.

## Cost & safety notes

- Only signed-in users can invoke the tutor; history capped at 12 turns,
  `max_tokens` 1024 (brief: 1400); upstream errors are never reflected back.
- To turn the tutor off: delete the `ANTHROPIC_API_KEY` secret — the UI hides
  itself on the next probe.
