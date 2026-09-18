// ─────────────────────────────────────────────────────────────────────────
// SkinScript push-reminders — Supabase Edge Function.
//
// Called HOURLY by pg_cron (supabase/15_push_reminders.sql → net.http_post)
// with a shared secret header. For every stored Web Push subscription whose
// LOCAL time is ~18:00 and that hasn't been reminded today, it computes
//   • reviews due (user_review_schedule.due_at <= now)
//   • streak at risk (consecutive local days with a quiz, none today)
// and sends one notification. Subscriptions the push service reports gone
// (404/410) are pruned. Body { dry_run, test_user_id } exists for testing.
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import webpush from 'npm:web-push@3.6.7'

const SECRET = Deno.env.get('PUSH_CRON_SECRET')
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:usamaayman@gmail.com'
const SEND_HOUR = Number(Deno.env.get('PUSH_LOCAL_HOUR') || '18')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } })
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const toLocal = (d: Date, offMin: number) => new Date(d.getTime() + (offMin || 0) * 60000)

// Consecutive local days with >=1 quiz ending YESTERDAY (today excluded).
function streakInfo(takenAt: string[], offMin: number, now: Date) {
  const days = new Set(takenAt.map((t) => dayKey(toLocal(new Date(t), offMin))))
  const today = toLocal(now, offMin)
  if (days.has(dayKey(today))) return { answeredToday: true, streak: 0 }
  let streak = 0
  const cur = new Date(today); cur.setUTCDate(cur.getUTCDate() - 1)
  while (days.has(dayKey(cur))) { streak++; cur.setUTCDate(cur.getUTCDate() - 1) }
  return { answeredToday: false, streak }
}

async function messageFor(db: any, userId: string, offMin: number, now: Date): Promise<string | null> {
  const [dueRes, histRes] = await Promise.all([
    db.from('user_review_schedule').select('pdf_id', { count: 'exact', head: true }).eq('user_id', userId).lte('due_at', now.toISOString()),
    db.from('quiz_history').select('taken_at').eq('user_id', userId).order('taken_at', { ascending: false }).limit(60),
  ])
  const due = dueRes.count || 0
  const { answeredToday, streak } = streakInfo((histRes.data || []).map((h: any) => h.taken_at).filter(Boolean), offMin, now)
  const atRisk = !answeredToday && streak > 0
  if (due === 0 && !atRisk) return null
  const r = `${due} review${due === 1 ? '' : 's'}`
  if (due > 0 && atRisk) return `${r} due · answer 1 question to keep your ${streak}-day streak`
  if (due > 0) return `${r} due today — 10 minutes keeps them fresh`
  return `Keep your ${streak}-day streak — answer 1 question tonight`
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  // Fail closed: no secret configured → nobody can trigger sends.
  if (!SECRET || req.headers.get('x-cron-secret') !== SECRET) return json({ error: 'unauthorized' }, 401)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'not_configured' }, 503)

  let body: any = {}
  try { body = await req.json() } catch { body = {} }
  const dryRun = !!body?.dry_run
  const testUser = typeof body?.test_user_id === 'string' ? body.test_user_id : null
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const now = new Date()

  // Dry run for one user: compute the message only, never touch push.
  if (testUser && dryRun) {
    const message = await messageFor(db, testUser, Number(body?.tz_offset_min ?? 180), now)
    return json({ dry_run: true, user_id: testUser, message })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'vapid_not_configured' }, 503)
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  let q = db.from('push_subscriptions').select('endpoint,user_id,p256dh,auth,tz_offset_min,last_sent_on,fail_count')
  if (testUser) q = q.eq('user_id', testUser)
  const { data: subs, error } = await q
  if (error) { console.error('db_error', error.message); return json({ error: 'db_error' }, 500) }

  const targets = (subs || []).filter((s: any) => {
    if (testUser) return true
    const local = toLocal(now, s.tz_offset_min)
    return local.getUTCHours() === SEND_HOUR && s.last_sent_on !== dayKey(local)
  })
  const byUser = new Map<string, any[]>()
  for (const s of targets) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id)!.push(s) }

  let sent = 0, skipped = 0, pruned = 0, failed = 0
  for (const [uid, list] of byUser) {
    let msg = await messageFor(db, uid, list[0].tz_offset_min, now)
    if (!msg && testUser) msg = 'Test reminder from SkinScript — notifications are working.'
    if (!msg) { skipped += list.length; continue }
    const payload = JSON.stringify({ title: 'SkinScript', body: msg, url: '/', tag: 'skinscript-reminder' })
    for (const s of list) {
      if (dryRun) { sent++; continue }
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 })
        sent++
        if (!testUser) await db.from('push_subscriptions').update({ last_sent_on: dayKey(toLocal(now, s.tz_offset_min)), fail_count: 0 }).eq('endpoint', s.endpoint)
      } catch (e: any) {
        const code = e?.statusCode
        if (code === 404 || code === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); pruned++
        } else {
          failed++
          const fc = (s.fail_count || 0) + 1
          if (fc >= 5) { await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); pruned++ }
          else await db.from('push_subscriptions').update({ fail_count: fc }).eq('endpoint', s.endpoint)
          console.error('push_error', code, String(e?.message || e).slice(0, 200))
        }
      }
    }
  }
  return json({ ok: true, checked: (subs || []).length, targeted: targets.length, sent, skipped, pruned, failed, dry_run: dryRun })
})
