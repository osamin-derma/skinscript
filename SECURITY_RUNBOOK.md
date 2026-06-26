# SkinScript — security hardening runbook

Defense-in-depth to stop bulk/anonymous exfiltration of the question bank,
images, and PDFs, and to make any leak slow, attributable, and revocable.

**Honest scope:** no layer stops a logged-in human from screenshotting what
they're shown. The goal is to (1) stop anonymous + bulk extraction, (2) cap
how fast any one account can pull data, (3) tie every access to a revocable
identity, and (4) make leaks traceable. Items marked **[you]** need an action
only the account owner can take (Supabase SQL editor, Cloudflare, key
rotation). Everything else is code already in the repo.

---

## Status

| Layer | What | State |
|---|---|---|
| Watermark | Email tiled over every screen + lightbox | ✅ Shipped (live) |
| Image protection | Block right-click / drag / save on images | ✅ Shipped (live) |
| 0. Key rotation | Rotate the leaked service key | ⏳ **[you]** |
| 0. Cloudflare | WAF + bot + rate-limit + hide origin | ⏳ **[you]** |
| 1. Questions server-side | `questions` table + RLS + RPCs + IndexedDB cache | 🟡 Built — needs migration run + cutover |
| 2. Private storage | Private buckets + signed URLs | 🟡 SQL ready — needs dashboard toggle + frontend cutover |
| 3. Rate limiting | `rate_guard` RPC | 🟡 SQL ready — needs client wiring |
| 4. Session control | `touch_device` RPC | 🟡 SQL ready — needs client wiring |

---

## Phase 0 — front door + secrets (do first, fast)

1. **Rotate the service key [you].** The old `sb_secret_…` was shared in chat,
   so treat it as compromised. Supabase dashboard → Project settings → API
   keys → roll the `service_role` / secret key. Use the new one only in local
   upload scripts (`export SUPABASE_SERVICE_KEY=…`), never in the frontend.

2. **Put Cloudflare in front of osamah.co [you].** Adds a WAF, bot-fight mode,
   rate limiting, and hides the GitHub Pages origin.
   - Add the domain in Cloudflare → it gives you two nameservers → set them at
     your Google domain registrar (replaces Google's nameservers).
   - DNS: `CNAME @  osamin-derma.github.io` (proxied / orange cloud), plus the
     `CNAME www osamin-derma.github.io`. Keep the GitHub Pages custom-domain
     `CNAME` file (`osamah.co`) in the repo as-is.
   - SSL/TLS mode: **Full**. Turn on **Bot Fight Mode** and **Always Use HTTPS**.
   - Add a Rate Limiting rule: e.g. > 200 requests/min from one IP to
     `/assets/*` → managed challenge.

---

## Phase 1 — move questions out of the JS bundle (the big one)

Files already in the repo:
- `supabase/02_questions_schema.sql` — `questions` table, RLS (authenticated
  read only, no write policy → only the service key can seed), plus
  `banks_summary()`, `bank_categories()`, `fetch_quiz()` RPCs.
- `migrate_questions_to_supabase.py` — seeds the table from the 4 JSON files.
- `src/lib/questions.js` — `fetchAllBanks()` + `loadBanks(dataVersion)`
  (IndexedDB cache: fetch once per version, then instant + offline).

Apply:
1. **[you]** Paste `supabase/02_questions_schema.sql` into the SQL Editor, run.
2. **[you]** Seed the table:
   ```
   export SUPABASE_SERVICE_KEY="<rotated secret key>"
   python3 migrate_questions_to_supabase.py
   ```
   Verify: `select bank, count(*) from public.questions group by bank;`
   → 1281 / 1050 / 1590 / 7975 (= 11,896).
3. **Cutover (code):** in `src/App.jsx`, replace the four
   `import …Raw from './data/*_master.json'` imports + the synchronous
   `allBanks` constant with an async load via `loadBanks(DATA_VERSION)` into
   state, gated behind the existing "Loading SkinScript…" splash. Delete the
   `src/data/*_master.json` files so the bank is no longer in the bundle.
   - Confirm the built JS drops from ~11 MB to a few hundred KB.
   - Confirm a logged-out `curl https://osamah.co/assets/index-*.js` no longer
     contains question text.

> Trade-off you chose: questions now require one authenticated fetch on first
> load, then the IndexedDB cache keeps it instant and offline. Anonymous users
> and the static bundle no longer carry a free copy of the bank.

---

## Phase 2 — private images + PDFs

1. **[you]** Dashboard → Storage → set `question-images` bucket **Private**;
   create a **Private** `study-resources` bucket for the Library PDFs.
2. **[you]** Run `supabase/06_storage_private.sql` (authenticated-only read
   policies).
3. **Cutover (code):** store image paths as **relative** (`<pdf_id>/<file>`)
   instead of full public URLs (re-run the migration after stripping the
   `…/public/question-images/` prefix), and in `src/lib/questions.js` resolve
   them to signed URLs on demand:
   ```js
   const { data } = await supabase.storage
     .from('question-images').createSignedUrls(paths, 60)
   ```
   `QuestionImages.jsx` requests the signed URL when a question/lightbox opens.
   Same pattern for the Library PDFs.

---

## Phase 3 — rate limiting

1. **[you]** Run `supabase/05_rate_limit_sessions.sql`.
2. **Wire (code):** before a full-bank fetch in `loadBanks`, call
   ```js
   const { data: ok } = await supabase.rpc('rate_guard',
     { p_kind: 'full_bank', p_max: 5, p_window: '01:00:00' })
   if (!ok) throw new Error('rate-limited')
   ```
   Tune `p_max` / `p_window`. Caps repeated full dumps per account; a scraper
   rotating accounts is throttled per-account and recorded in `fetch_audit`.

---

## Phase 4 — session / device control

1. Already in `supabase/05_rate_limit_sessions.sql` (`touch_device`).
2. **Wire (code):** store a random `device_id` in localStorage; on app load and
   every few minutes call
   ```js
   const { data: status } = await supabase.rpc('touch_device',
     { p_device_id: deviceId, p_max: 2, p_label: navigator.userAgent.slice(0,80) })
   if (status !== 'ok') await signOut()   // 'revoked' | 'evicted'
   ```
   Limits an account to 2 active devices and lets you revoke any device
   instantly: `update public.user_devices set revoked=true where user_id=…`.

---

## What can't be defended (set expectations)

- A logged-in user can screenshot or photograph the screen — the watermark
  makes that **traceable**, not impossible.
- Anything rendered can be scraped slowly by a determined, logged-in account —
  rate limiting + session limits + watermark make it slow, capped, and
  attributable, which is the realistic bar for a web app.

## Rollback

- Layers are independent. Each code cutover is a normal git revert + redeploy.
- Phase 1 rollback: restore the `data/*_master.json` imports. Keep a tagged
  commit of the pre-cutover state before deleting the JSON files.
