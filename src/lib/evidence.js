// ─────────────────────────────────────────────────────────────────────────
// Evidence lookup — PubMed E-utilities (free, keyless, CORS-enabled).
// Builds a query from the question's correct answer + subtopic, prefers
// reviews/guidelines from 2008+, and falls back to broader queries. Results
// are cached in memory per pdf_id; the service worker also caches the HTTP
// responses (vite.config.js) so previously seen evidence works offline.
// ─────────────────────────────────────────────────────────────────────────
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const TOOL = 'tool=skinscript&email=usamaayman%40gmail.com' // NCBI etiquette
const REVIEW = '(review[pt] OR "systematic review"[pt] OR "practice guideline"[pt] OR guideline[pt])'
const DATE = '("2008/01/01"[dp] : "3000"[dp])'
const STOP = new Set(('the a an of and or in on with for to is are be by at from as that this it its into than which all any none ' +
  'above following most likely common cause patient patients treatment management diagnosis associated due both not no other only ' +
  'more less used use can may should would also after before during first second line best next step appropriate initial except ' +
  'true false regarding statement statements about these those their his her she he they them one two three year years old man ' +
  'woman boy girl male female presents presented history examination shows showing seen found findings finding feature features ' +
  'characteristic type types drug choice therapy given give')
  .split(' '))
const clean = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()

export function buildEvidenceQueries(question, answerText) {
  const answer = clean(answerText)
  const words = answer.split(' ').filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
  const sub = clean(question?.subtopic).replace(/\b(General|dermatology)\b/gi, '').trim()
  const subWords = sub.split(' ').filter((w) => w.length > 3 && !STOP.has(w.toLowerCase()))
  const anchor = [...subWords, 'dermatology', 'skin', 'cutaneous'].map((w) => `${w}[tiab]`).join(' OR ')
  let core, label
  let coreTiab
  if (words.length >= 1 && words.length <= 5) { core = `"${answer}"`; coreTiab = `"${answer}"[tiab]`; label = answer }
  else if (words.length > 5) { const w = words.slice(0, 4); core = w.join(' AND '); coreTiab = w.map((x) => `${x}[tiab]`).join(' AND '); label = w.join(' ') }
  else { core = null; label = sub || 'dermatology' }
  const attempts = []
  if (core) {
    attempts.push({ term: `(${coreTiab}) AND (${anchor}) AND ${REVIEW} AND ${DATE}`, min: 2 })
    attempts.push({ term: `${core.replace(/"/g, '')} AND ${REVIEW} AND ${DATE}`, min: 2 })       // PubMed term mapping (MeSH)
    attempts.push({ term: `${core.replace(/"/g, '')} AND (${anchor}) AND ${DATE}`, min: 1 })     // any article type
  }
  if (sub) attempts.push({ term: `${sub} AND ${REVIEW} AND ${DATE}`, min: 1 })
  return { attempts, label }
}

async function getJson(url, signal) {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error('http_' + r.status)
  return r.json()
}
async function esearch(term, signal) {
  const j = await getJson(`${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=6&sort=relevance&${TOOL}&term=${encodeURIComponent(term)}`, signal)
  return j?.esearchresult?.idlist || []
}
async function esummary(ids, signal) {
  const j = await getJson(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&${TOOL}&id=${ids.join(',')}`, signal)
  const res = j?.result || {}
  return ids.map((id) => res[id]).filter(Boolean).map((r) => ({
    pmid: r.uid,
    title: String(r.title || '').replace(/\.$/, ''),
    journal: r.source || r.fulljournalname || '',
    year: String(r.pubdate || '').slice(0, 4),
    authors: (r.authors || []).slice(0, 3).map((a) => a.name).join(', ') + ((r.authors || []).length > 3 ? ' et al.' : ''),
    doi: (r.articleids || []).find((a) => a.idtype === 'doi')?.value || null,
    review: (r.pubtype || []).some((t) => /review|guideline/i.test(t)),
  }))
}

const memo = new Map() // pdf_id → result
export async function fetchEvidence(question, answerText, signal) {
  const key = question?.pdf_id || `${question?.id}`
  if (memo.has(key)) return memo.get(key)
  const { attempts, label } = buildEvidenceQueries(question, answerText)
  let ids = [], used = ''
  for (const a of attempts) {
    const got = await esearch(a.term, signal)
    if (got.length >= a.min) { ids = got; used = a.term; break }
    if (got.length && !ids.length) { ids = got; used = a.term } // keep the best partial hit
  }
  const results = ids.length ? await esummary(ids.slice(0, 5), signal) : []
  const out = { results, label, term: used }
  if (results.length) memo.set(key, out)
  return out
}

export const pubmedSearchUrl = (label) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(label)}&sort=relevance`
export const dermnetUrl = (label) => `https://dermnetnz.org/search?q=${encodeURIComponent(label)}`
export const OPENEVIDENCE_URL = 'https://www.openevidence.com/'
