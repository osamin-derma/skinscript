import { useEffect, useReducer, useRef, useState } from 'react'
import arabBoardRaw from './data/arab_board_master.json'
import boardVitalsRaw from './data/board_vitals_master.json'
import makkiRaw from './data/makki_master.json'
import etas2026Raw from './data/etas_2026_master.json'
import AuthScreen from './components/AuthScreen'
import InstallPrompt from './components/InstallPrompt'
import { supabase } from './lib/supabase'
import { onAuthStateChange, signOut } from './lib/auth'
import * as userdata from './lib/userdata'
import { nextSchedule, isDue } from './lib/srs'

// Tag each question with its source so they can be combined
const arabBoardTagged = arabBoardRaw.map(q => ({ ...q, source: q.source || 'Arab Board' }))
const boardVitalsTagged = boardVitalsRaw.map(q => ({ ...q, source: q.source || 'Board Vitals' }))
const makkiTagged = makkiRaw.map(q => ({ ...q, source: q.source || 'Makki' }))
const etas2026Tagged = etas2026Raw.map(q => ({ ...q, source: q.source || 'ETAS 2026' }))

// Combined "All" bank: offset IDs from each bank to avoid collisions
const combinedAll = [
  ...arabBoardTagged,
  ...boardVitalsTagged.map(q => ({ ...q, id: q.id + 100000 })),
  ...makkiTagged.map(q => ({ ...q, id: q.id + 200000 })),
  ...etas2026Tagged.map(q => ({ ...q, id: q.id + 300000 })),
]

const allBanks = {
  arabBoard: {
    label: 'Arab Board',
    questions: arabBoardTagged,
    count: arabBoardTagged.length,
  },
  boardVitals: {
    label: 'Board Vitals',
    questions: boardVitalsTagged,
    count: boardVitalsTagged.length,
  },
  makki: {
    label: 'Makki',
    questions: makkiTagged,
    count: makkiTagged.length,
  },
  etas2026: {
    label: 'ETAS 2026',
    questions: etas2026Tagged,
    count: etas2026Tagged.length,
  },
  all: {
    label: 'All Questions',
    questions: combinedAll,
    count: combinedAll.length,
  },
}

// Compute available categories across all banks
const ALL_CATEGORIES = Array.from(new Set(combinedAll.map(q => q.category).filter(Boolean))).sort()

function getBankQuestions(bankKey, categoryFilter = null) {
  const base = allBanks[bankKey]?.questions || allBanks.all.questions
  if (categoryFilter && categoryFilter !== 'all') {
    return base.filter(q => q.category === categoryFilter)
  }
  return base
}
import StartScreen from './components/StartScreen'
import QuizScreen from './components/QuizScreen'
import ResultsDashboard from './components/ResultsDashboard'
import Watermark from './components/Watermark'

// Master Edition 2026 — versioned keys so old user data is preserved
// but new banks start fresh.
const APP_VERSION = 'master2026'
const STORAGE_KEY = `skinscript-${APP_VERSION}-state`
const HISTORY_KEY = `skinscript-${APP_VERSION}-history`
const GLOBAL_FLAGS_KEY = `skinscript-${APP_VERSION}-flags`
const GLOBAL_WRONG_KEY = `skinscript-${APP_VERSION}-wrong`
const GLOBAL_USED_KEY = `skinscript-${APP_VERSION}-used`
const CATEGORY_FILTER_KEY = `skinscript-${APP_VERSION}-category-filter`

// DATA_VERSION bumps every time the question bank changes in a way that
// invalidates user history (new IDs, rewritten explanations, etc.). On
// each bump, we show a welcome notice and reset *all* prior app data
// — cleaner than trying to partially migrate references that may be
// stale.  Bump this string in lockstep with content changes.
const DATA_VERSION = '2026-05-19-master2026'
const DATA_VERSION_KEY = 'skinscript-data-version'

// All localStorage key prefixes the app has ever owned. Used to wipe
// everything cleanly on a data-version bump.
const OWNED_KEY_PREFIXES = ['skinscript-', 'last11-quiz-']

function wipeAllAppData() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && OWNED_KEY_PREFIXES.some(p => k.startsWith(p))) {
      toRemove.push(k)
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback }
  catch { return fallback }
}

function saveJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val))
}

const initialState = {
  screen: 'start',
  mode: 'tutor',
  timerSetting: 90,
  shuffle: false,
  questionCount: 40,
  questionOrder: [],
  currentIndex: 0,
  answers: {},
  flagged: [],
  darkMode: false,
  selectedTopics: [],
  quizSource: 'all', // 'all' | 'flagged' | 'wrong' | 'unused' | 'topics'
  activeBank: 'all', // 'all' | 'arabBoard' | 'boardVitals' | 'makki' | 'etas2026'
  categoryFilter: 'all', // 'all' | <category name>
  history: [],
  globalFlagged: [],
  globalWrong: [],
  globalUsed: [],
  notes: {}, // { [pdf_id]: text } — personal note per question
  highlights: {}, // { [pdf_id]: [{start,end}] } — text highlights per question
  schedule: {}, // { [pdf_id]: { box, interval, due, reps } } — spaced-repetition
  flashcards: {}, // { [id]: { id, pdf_id, front, back, box, interval, due, reps } }
  isAssessment: false, // current quiz is a timed self-assessment exam
  // Per-quiz-session strikethroughs: { [questionId]: { A: true, C: true } }
  // Lives only for the duration of the current quiz; cleared on START_QUIZ
  // and END_QUIZ.  Independent from `answers` — striking a choice and
  // selecting it as the answer are two unrelated user actions.
  strikethroughs: {},
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      // Only restore device-local UI preferences here. Per-user progress
      // (history / flags / wrong / used) is loaded from Supabase by the
      // App component and arrives via INIT_FROM_CLOUD.
      return {
        ...state,
        categoryFilter: localStorage.getItem(CATEGORY_FILTER_KEY) || 'all',
      }
    }
    case 'INIT_FROM_CLOUD': {
      return {
        ...state,
        history:       action.data?.history || [],
        globalFlagged: action.data?.flags   || [],
        globalWrong:   action.data?.wrong   || [],
        globalUsed:    action.data?.used    || [],
        notes:         action.data?.notes   || {},
        highlights:    action.data?.highlights || {},
        schedule:      action.data?.schedule || {},
        flashcards:    action.data?.flashcards || {},
      }
    }
    case 'ADD_FLASHCARD': {
      // Idempotent per source question: if a card already exists for this
      // pdf_id, keep it rather than minting a second UUID-distinct duplicate
      // (revisiting a question — reload, or Next→Prev — must not re-add).
      const card = action.card
      if (card.pdf_id && Object.values(state.flashcards).some((c) => c.pdf_id === card.pdf_id)) return state
      return { ...state, flashcards: { ...state.flashcards, [card.id]: card } }
    }
    case 'DELETE_FLASHCARD': {
      const flashcards = { ...state.flashcards }
      delete flashcards[action.id]
      return { ...state, flashcards }
    }
    case 'REVIEW_FLASHCARD': {
      const c = state.flashcards[action.id]
      if (!c) return state
      const s = nextSchedule(c, action.correct)
      return { ...state, flashcards: { ...state.flashcards, [action.id]: { ...c, box: s.box, interval: s.interval, due: s.due, reps: s.reps } } }
    }
    case 'RECORD_REVIEW': {
      // Advance the spaced-repetition schedule only on a genuine review: the
      // first-ever exposure (no entry) or a question that is actually due.
      // Answering an early/not-yet-due question (cramming) must NOT inflate the
      // ladder, so we leave its schedule untouched.
      const prev = state.schedule[action.pdfId]
      if (prev && !isDue(prev)) return state
      const entry = nextSchedule(prev, action.correct)
      return { ...state, schedule: { ...state.schedule, [action.pdfId]: entry } }
    }
    case 'SET_NOTE': {
      const notes = { ...state.notes }
      if ((action.text || '').trim()) notes[action.pdfId] = action.text
      else delete notes[action.pdfId]
      return { ...state, notes }
    }
    case 'SET_HIGHLIGHTS': {
      const highlights = { ...state.highlights }
      if (Array.isArray(action.ranges) && action.ranges.length) highlights[action.pdfId] = action.ranges
      else delete highlights[action.pdfId]
      return { ...state, highlights }
    }
    case 'SET_BANK': {
      return { ...state, activeBank: action.bank }
    }
    case 'SET_CATEGORY_FILTER': {
      localStorage.setItem(CATEGORY_FILTER_KEY, action.category)
      return { ...state, categoryFilter: action.category }
    }
    case 'START_QUIZ': {
      // Use selected bank — store in state for rendering
      const bankKey = action.bank || state.activeBank || 'all'
      const catFilter = action.categoryFilter !== undefined ? action.categoryFilter : state.categoryFilter
      const bankQuestions = getBankQuestions(bankKey, catFilter)

      // Quizzable = MCQ items only. Non-MCQ rows (short-answer /
      // "answer not clearly provided in source") are still in the data
      // so bank counts reflect the source PDFs, but the timed/tutor quiz
      // only draws from items with full A-E choices.
      const isQuizzable = (q) => q.choices && Object.keys(q.choices).length >= 2 && q.correct_answer
      let pool = bankQuestions
        .map((_, i) => i)
        .filter(i => isQuizzable(bankQuestions[i]))

      // Filter by source
      if (action.source === 'flagged') {
        pool = pool.filter(i => state.globalFlagged.includes(bankQuestions[i].id))
      } else if (action.source === 'wrong') {
        pool = pool.filter(i => state.globalWrong.includes(bankQuestions[i].id))
      } else if (action.source === 'unused') {
        pool = pool.filter(i => !state.globalUsed.includes(bankQuestions[i].id))
      } else if (action.source === 'due') {
        pool = pool.filter(i => isDue(state.schedule[bankQuestions[i].pdf_id]))
      } else if (action.source === 'topics' && action.topics?.length > 0) {
        // The question field is `category` (not `topic`). Without this
        // fix the pool was always empty and the quiz never started.
        pool = pool.filter(i => action.topics.includes(bankQuestions[i].category))
      }

      // If selected source has no questions, don't start the quiz
      if (pool.length === 0) return state

      if (action.shuffle) pool = shuffleArray(pool)

      const count = Math.min(action.count || pool.length, pool.length)
      const order = pool.slice(0, count)

      return {
        ...state,
        screen: 'quiz',
        mode: action.mode,
        timerSetting: action.timer,
        shuffle: action.shuffle,
        questionCount: count,
        questionOrder: order,
        currentIndex: 0,
        answers: {},
        flagged: [],
        strikethroughs: {},
        quizSource: action.source || 'all',
        activeBank: bankKey,
        isAssessment: !!action.assessment,
        // Persist the category filter the pool was actually built with, so the
        // render array (getBankQuestions(activeBank, categoryFilter)) matches
        // the questionOrder indices — otherwise a programmatic categoryFilter
        // (e.g. Due/Practice using 'all') renders the wrong questions.
        categoryFilter: catFilter,
      }
    }
    case 'ANSWER': {
      // Cloud sync for globalUsed / globalWrong is handled by the
      // watch-and-diff effects in App() — no localStorage write here.
      const newAnswers = { ...state.answers, [action.questionId]: { selected: action.selected, correct: action.correct, submitted: true, confidence: action.confidence ?? null } }
      const newUsed = [...new Set([...state.globalUsed, action.questionId])]
      const newWrong = action.correct
        ? state.globalWrong.filter(id => id !== action.questionId)
        : [...new Set([...state.globalWrong, action.questionId])]
      return { ...state, answers: newAnswers, globalUsed: newUsed, globalWrong: newWrong }
    }
    case 'TOGGLE_STRIKE': {
      // Per-question, per-letter strikethrough.  Lives in memory for the
      // current quiz session; cleared on START_QUIZ and END_QUIZ.
      const qid = action.questionId
      const letter = action.letter
      const current = state.strikethroughs[qid] || {}
      const next = { ...current }
      if (next[letter]) delete next[letter]
      else next[letter] = true
      return {
        ...state,
        strikethroughs: {
          ...state.strikethroughs,
          [qid]: next,
        },
      }
    }
    case 'NAVIGATE':
      return { ...state, currentIndex: action.index }
    case 'NEXT':
      return { ...state, currentIndex: Math.min(state.currentIndex + 1, state.questionOrder.length - 1) }
    case 'PREV':
      return { ...state, currentIndex: Math.max(state.currentIndex - 1, 0) }
    case 'FLAG': {
      const f = [...state.flagged]
      const gf = [...state.globalFlagged]
      const idx = f.indexOf(action.questionId)
      const gIdx = gf.indexOf(action.questionId)

      if (idx >= 0) f.splice(idx, 1)
      else f.push(action.questionId)

      if (gIdx >= 0) gf.splice(gIdx, 1)
      else gf.push(action.questionId)
      return { ...state, flagged: f, globalFlagged: gf }
    }
    case 'END_QUIZ': {
      const total = state.questionOrder.length
      const answered = Object.values(state.answers).filter(a => a.submitted).length
      const correct = Object.values(state.answers).filter(a => a.correct).length
      const score = total > 0 ? Math.round((correct / total) * 100) : 0

      // Compact per-question detail so this exam can be reopened/reviewed later.
      // Only the question id + the user's pick is stored; everything else
      // (text, choices, correct answer, explanation) is re-resolved from the
      // bank at review time. `action.questions` is the bank array passed by the
      // QuizScreen so we can map order-indices → stable question ids.
      // Key on pdf_id (globally unique + stable across banks) rather than the
      // numeric id, which is offset-remapped in the combined "All" bank.
      const reviewQs = action.questions || []
      const detail = state.questionOrder
        .map((qi) => {
          const q = reviewQs[qi]
          if (!q) return null
          const a = state.answers[q.id]
          return { pdf_id: q.pdf_id, selected: a?.selected ?? null, conf: a?.confidence ?? null }
        })
        .filter((d) => d && d.pdf_id)

      const historyEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        mode: state.mode,
        source: state.quizSource,
        totalQuestions: total,
        answered,
        correct,
        incorrect: answered - correct,
        score,
        timePerQ: state.timerSetting,
        isAssessment: state.isAssessment,
        detail,
      }

      const newHistory = [historyEntry, ...state.history].slice(0, 50)
      return { ...state, screen: 'results', history: newHistory, strikethroughs: {} }
    }
    case 'RESTART':
      localStorage.removeItem(STORAGE_KEY)
      return {
        ...initialState,
        darkMode: state.darkMode,
        history: state.history,
        globalFlagged: state.globalFlagged,
        globalWrong: state.globalWrong,
        globalUsed: state.globalUsed,
      }
    case 'TOGGLE_DARK':
      return { ...state, darkMode: !state.darkMode }
    case 'RESUME':
      return { ...action.saved, history: state.history, globalFlagged: state.globalFlagged, globalWrong: state.globalWrong, globalUsed: state.globalUsed }
    case 'REVIEW_FLAGGED': {
      const bankQs = getBankQuestions(state.activeBank)
      const flaggedOrder = bankQs.map((_, i) => i).filter(i => state.globalFlagged.includes(bankQs[i]?.id))
      if (flaggedOrder.length === 0) return state
      return { ...state, screen: 'quiz', mode: 'tutor', questionOrder: flaggedOrder, currentIndex: 0, answers: {}, flagged: [], quizSource: 'flagged' }
    }
    case 'OPEN_SINGLE_QUESTION': {
      // Jump directly to a single question (from search results or the Atlas).
      const bankKey = action.bank || state.activeBank
      const bankQs = getBankQuestions(bankKey)          // unfiltered — idx is into THIS array
      const idx = bankQs.findIndex(q => q.id === action.questionId)
      if (idx < 0) return state
      return {
        ...state,
        screen: 'quiz',
        mode: 'review',           // review mode = show answer/explanation immediately
        questionOrder: [idx],
        currentIndex: 0,
        answers: {},
        flagged: [],
        quizSource: 'search',
        activeBank: bankKey,
        // idx is computed against the UNFILTERED bank, so the render array must
        // be unfiltered too — otherwise a sticky category filter makes
        // QuizScreen index the wrong (or no) question. Mirrors START_QUIZ.
        categoryFilter: 'all',
      }
    }
    case 'REVIEW_WRONG': {
      const bankQs = getBankQuestions(state.activeBank)
      const wrongOrder = bankQs.map((_, i) => i).filter(i => state.globalWrong.includes(bankQs[i]?.id))
      if (wrongOrder.length === 0) return state
      return { ...state, screen: 'quiz', mode: 'tutor', questionOrder: shuffleArray(wrongOrder), currentIndex: 0, answers: {}, flagged: [], quizSource: 'wrong' }
    }
    case 'CLEAR_HISTORY':
      // Cloud sync handled by the history-watch effect in App().
      return { ...state, history: [] }
    case 'RESET_PERFORMANCE':
      // Cloud sync handled by the wrong/used/flags watch effects in App().
      return { ...state, globalWrong: [], globalUsed: [], globalFlagged: [] }
    case 'RESET_ALL': {
      // Nuclear option: clear ALL progress on this device. Cloud sync
      // for each list is handled by its watch effect in App().
      localStorage.removeItem(STORAGE_KEY)
      return {
        ...initialState,
        darkMode: state.darkMode, // keep dark mode preference
        activeBank: 'all',
      }
    }
    default:
      return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [showWelcome, setShowWelcome] = useState(false)

  // ── Auth gate ──────────────────────────────────────────────────────────
  // null = still resolving the initial session; false = no session;
  // {user,…} = signed in. We show a brief splash while resolving so we
  // never flash the AuthScreen at a returning logged-in user.
  const [session, setSession] = useState(null)
  const [sessionResolved, setSessionResolved] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionResolved(true)
    })
    const unsubscribe = onAuthStateChange((s) => setSession(s))
    return unsubscribe
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch {/* ignore */}
    // Clean up per-user device caches but keep DATA_VERSION_KEY (so the
    // welcome modal doesn't re-fire on the next sign-in) and the dark-mode
    // preference. Cloud data is preserved — sign-out is not deletion.
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(CATEGORY_FILTER_KEY)
    window.location.reload()
  }

  // ── Cloud sync (Phase 2b) ───────────────────────────────────────────────
  // On session change, hydrate per-user state from Supabase. The four refs
  // below mirror the state at the moment of the last successful sync so the
  // watch effects can compute a diff and push only the change to the cloud.
  // Pre-setting the refs to the incoming data BEFORE dispatch keeps the
  // initial load from looping back to the cloud.
  const prevFlagsRef   = useRef([])
  const prevWrongRef   = useRef([])
  const prevUsedRef    = useRef([])
  const prevHistoryRef = useRef([])
  const prevNotesRef   = useRef({})
  const prevHlRef      = useRef({})
  const prevSchedRef   = useRef({})
  const prevFcRef      = useRef({})
  const cloudReadyRef  = useRef(false)

  useEffect(() => {
    if (!session?.user?.id) {
      cloudReadyRef.current = false
      return
    }
    cloudReadyRef.current = false
    userdata.fetchAllUserData().then(data => {
      prevFlagsRef.current   = data.flags
      prevWrongRef.current   = data.wrong
      prevUsedRef.current    = data.used
      prevHistoryRef.current = data.history
      prevNotesRef.current   = data.notes || {}
      prevHlRef.current      = data.highlights || {}
      prevSchedRef.current   = data.schedule || {}
      prevFcRef.current      = data.flashcards || {}
      dispatch({ type: 'INIT_FROM_CLOUD', data })
      cloudReadyRef.current = true
    })
  }, [session?.user?.id])

  // ── Watch notes → cloud (debounced; persist only changed pdf_ids) ──
  const latestNotesRef = useRef({})
  useEffect(() => { latestNotesRef.current = state.notes || {} }, [state.notes])
  const flushNotes = () => {
    if (!cloudReadyRef.current) return
    const prev = prevNotesRef.current || {}
    const curr = latestNotesRef.current || {}
    const ids = new Set([...Object.keys(prev), ...Object.keys(curr)])
    for (const pid of ids) {
      if ((prev[pid] || '') !== (curr[pid] || '')) userdata.saveNote(pid, curr[pid] || '')
    }
    prevNotesRef.current = { ...curr }
  }
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const t = setTimeout(flushNotes, 700)
    return () => clearTimeout(t)
  }, [state.notes])
  // ── Watch highlights → cloud (debounced; persist only changed pdf_ids) ──
  const latestHlRef = useRef({})
  useEffect(() => { latestHlRef.current = state.highlights || {} }, [state.highlights])
  const flushHighlights = () => {
    if (!cloudReadyRef.current) return
    const prev = prevHlRef.current || {}
    const curr = latestHlRef.current || {}
    const ids = new Set([...Object.keys(prev), ...Object.keys(curr)])
    for (const pid of ids) {
      if (JSON.stringify(prev[pid] || []) !== JSON.stringify(curr[pid] || [])) userdata.saveHighlights(pid, curr[pid] || [])
    }
    prevHlRef.current = { ...curr }
  }
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const t = setTimeout(flushHighlights, 700)
    return () => clearTimeout(t)
  }, [state.highlights])

  // ── Watch spaced-repetition schedule → cloud (changed entries only) ──
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const prev = prevSchedRef.current || {}
    const curr = state.schedule || {}
    for (const pid of Object.keys(curr)) {
      if (JSON.stringify(prev[pid] || null) !== JSON.stringify(curr[pid])) userdata.saveScheduleEntry(pid, curr[pid])
    }
    prevSchedRef.current = curr
  }, [state.schedule])

  // ── Watch flashcards → cloud (add/update + delete) ──
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const prev = prevFcRef.current || {}
    const curr = state.flashcards || {}
    for (const id of Object.keys(curr)) {
      if (JSON.stringify(prev[id] || null) !== JSON.stringify(curr[id])) userdata.saveFlashcard(curr[id])
    }
    for (const id of Object.keys(prev)) {
      if (!curr[id]) userdata.deleteFlashcard(id)
    }
    prevFcRef.current = curr
  }, [state.flashcards])

  // Don't lose a trailing edit if the page is hidden/closed within the debounce.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') { flushNotes(); flushHighlights() } }
    document.addEventListener('visibilitychange', onHide)
    const onPageHide = () => { flushNotes(); flushHighlights() }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [])

  // ── Watch flags → cloud (additions + removals) ──
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const prev = new Set(prevFlagsRef.current)
    const curr = new Set(state.globalFlagged)
    for (const id of curr) if (!prev.has(id)) userdata.addFlag(id)
    for (const id of prev) if (!curr.has(id)) userdata.removeFlag(id)
    prevFlagsRef.current = state.globalFlagged
  }, [state.globalFlagged])

  // ── Watch wrong → cloud ──
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const prev = new Set(prevWrongRef.current)
    const curr = new Set(state.globalWrong)
    for (const id of curr) if (!prev.has(id)) userdata.addWrong(id)
    for (const id of prev) if (!curr.has(id)) userdata.removeWrong(id)
    prevWrongRef.current = state.globalWrong
  }, [state.globalWrong])

  // ── Watch used → cloud (insert-only) ──
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const prev = new Set(prevUsedRef.current)
    for (const id of state.globalUsed) if (!prev.has(id)) userdata.addUsed(id)
    prevUsedRef.current = state.globalUsed
  }, [state.globalUsed])

  // ── Watch history → cloud (new entries + clear-all) ──
  useEffect(() => {
    if (!cloudReadyRef.current) return
    const prev = prevHistoryRef.current
    const curr = state.history
    // New entry inserted at the front by END_QUIZ?
    if (curr.length > 0 && (prev.length === 0 || curr[0]?.id !== prev[0]?.id)) {
      const justAdded = curr[0]
      // The reducer used Date.now() for the id; replace with the cloud id
      // after insert so future diffs match.
      userdata.insertHistory(justAdded).then((cloudRow) => {
        if (cloudRow) {
          prevHistoryRef.current = [cloudRow, ...prevHistoryRef.current.filter(h => h.id !== justAdded.id)]
        }
      })
    } else if (prev.length > 0 && curr.length === 0) {
      // CLEAR_HISTORY / RESET_ALL emptied the list
      userdata.clearHistory()
    }
    prevHistoryRef.current = curr
  }, [state.history])

  // Show the welcome/reset notice once per data version. If the user's
  // recorded data version doesn't match the current one, we surface the
  // modal BEFORE rehydrating any reducer state — so stale history/flags
  // don't briefly flash on screen.
  const [hadPriorData, setHadPriorData] = useState(false)
  useEffect(() => {
    const seenVersion = localStorage.getItem(DATA_VERSION_KEY)
    if (seenVersion !== DATA_VERSION) {
      // First visit to this data version. Check whether they had any
      // prior app data so the modal copy can adapt.
      let hadAny = false
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && OWNED_KEY_PREFIXES.some(p => k.startsWith(p))) {
          hadAny = true
          break
        }
      }
      setHadPriorData(hadAny)
      setShowWelcome(true)
    } else {
      // Already on the current data version — just rehydrate.
      dispatch({ type: 'INIT' })
    }
  }, [])

  const dismissWelcome = async () => {
    // 1) Clear cloud progress FIRST. localStorage-only wipes don't survive
    //    the next page load because the cloud-sync layer re-fetches the
    //    user's history / flags / wrong / used from Supabase and
    //    re-populates state. Await this so the reload truly starts clean.
    try {
      await userdata.clearEverything()
    } catch (e) {
      console.warn('[reset] cloud clear failed', e)
    }
    // 2) Wipe local caches.
    wipeAllAppData()
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION)
    setShowWelcome(false)
    // 3) Reload — guaranteed clean memory + freshly empty cloud fetch.
    window.location.reload()
  }

  // Same pattern for the in-app "Reset ALL progress" button on
  // StartScreen. The reducer change alone would be propagated to the
  // cloud by the watch-and-diff effects, but only as fire-and-forget
  // network calls — closing the tab mid-flush leaves stale rows in
  // Supabase.  Awaiting the cloud delete first removes the race.
  const handleResetAll = async () => {
    try {
      await userdata.clearEverything()
    } catch (e) {
      console.warn('[reset-all] cloud clear failed', e)
    }
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(CATEGORY_FILTER_KEY)
    window.location.reload()
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  useEffect(() => {
    if (state.screen === 'quiz') {
      const toSave = { ...state }
      delete toSave.history
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    }
  }, [state.screen, state.currentIndex, state.answers, state.flagged])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.screen === 'quiz' && parsed.questionOrder?.length > 0) {
          if (confirm('Resume where you left off?')) {
            dispatch({ type: 'RESUME', saved: parsed })
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch { /* ignore */ }
    }
  }, [])

  // Derive active questions from state.activeBank + categoryFilter
  const activeQuestions = getBankQuestions(state.activeBank, state.categoryFilter)
  const topics = [...new Set(activeQuestions.map(q => q.category).filter(Boolean))].sort()

  // ── AUTH GATE ──
  // While we resolve the initial session, show a minimal splash so a
  // returning user doesn't see the login form flash.
  if (!sessionResolved) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${state.darkMode ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-700'}`}>
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center mb-4">
            <span className="absolute inline-block w-16 h-16 rounded-full border-2 border-current opacity-20 animate-ping" style={{ color: '#2c3e3f' }} />
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="SkinScript"
              className="w-14 h-14 rounded-full shadow-md object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          </div>
          <p className="text-sm font-semibold tracking-wide" style={{ color: state.darkMode ? '#7fb5b5' : '#2c3e3f' }}>SkinScript</p>
          <p className="text-xs text-gray-400 mt-0.5">Loading your study session…</p>
        </div>
      </div>
    )
  }
  // No session = require login.
  if (!session) {
    return (
      <AuthScreen
        darkMode={state.darkMode}
        onToggleDark={() => dispatch({ type: 'TOGGLE_DARK' })}
      />
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${state.darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Identity watermark — traceable overlay for every signed-in screen */}
      <Watermark email={session?.user?.email} />

      {/* WELCOME / RESET NOTICE — shown once per DATA_VERSION */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`max-w-md w-full rounded-2xl shadow-2xl p-6 ${state.darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="text-center mb-5">
              <div className="inline-block px-3 py-1 rounded-full mb-3" style={{ backgroundColor: '#fdf6e3', color: '#c9a84c' }}>
                <span className="text-[10px] font-bold tracking-wider uppercase">Master Edition · 2026</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: '#2c3e3f' }}>
                {hadPriorData ? 'SkinScript has been updated' : 'Welcome to SkinScript'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Your dermatology board prep is powered by{' '}
                <strong>11,896 verified questions</strong> across 4 source banks:
                Arab Board, Board Vitals, Makki, and ETAS 2026.
              </p>
            </div>

            <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: state.darkMode ? '#374151' : '#f3f4f6' }}>
              {hadPriorData ? (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#2c3e3f' }}>
                    🔄 Fresh start
                  </p>
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                    The question bank was rebuilt, so question IDs and explanations have changed.
                    Your previous <strong>quiz history</strong>, <strong>flags</strong>, and{' '}
                    <strong>wrong/used tracking</strong> would point at stale entries — we'd rather
                    reset cleanly than partially migrate. Tapping <em>Start Fresh</em> clears
                    everything stored on this device and starts you with a clean slate.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#2c3e3f' }}>
                    👋 First-time setup
                  </p>
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                    Your progress (history, flagged questions, wrong-answer tracking) is saved
                    only on this device. Each time we update the question bank, we'll show this
                    notice again and reset to a clean slate so nothing references stale data.
                  </p>
                </>
              )}
            </div>

            <button
              onClick={dismissWelcome}
              className="w-full py-3 rounded-xl text-white font-bold text-base transition hover:opacity-90 shadow"
              style={{ backgroundColor: '#2c3e3f' }}
            >
              {hadPriorData ? 'Start Fresh' : 'Get Started'}
            </button>

            <p className="text-[10px] text-center text-gray-400 mt-3">
              Data version {DATA_VERSION}
            </p>
          </div>
        </div>
      )}

      {/* Soft install banner — only renders on mobile, when not already installed */}
      {state.screen === 'start' && <InstallPrompt darkMode={state.darkMode} />}

      {state.screen === 'start' && (
        <StartScreen
          totalQuestions={activeQuestions.length}
          topics={topics}
          darkMode={state.darkMode}
          state={state}
          onToggleDark={() => dispatch({ type: 'TOGGLE_DARK' })}
          onStart={(opts) => dispatch({ type: 'START_QUIZ', ...opts })}
          dispatch={dispatch}
          banks={{
            all: { label: 'All Questions', count: allBanks.all.count, questions: allBanks.all.questions },
            arabBoard: { label: 'Arab Board', count: allBanks.arabBoard.count, questions: allBanks.arabBoard.questions },
            boardVitals: { label: 'Board Vitals', count: allBanks.boardVitals.count, questions: allBanks.boardVitals.questions },
            makki: { label: 'Makki', count: allBanks.makki.count, questions: allBanks.makki.questions },
            etas2026: { label: 'ETAS 2026', count: allBanks.etas2026.count, questions: allBanks.etas2026.questions },
          }}
          activeBank={state.activeBank}
          setActiveBank={(bank) => dispatch({ type: 'SET_BANK', bank })}
          categoryFilter={state.categoryFilter}
          setCategoryFilter={(category) => dispatch({ type: 'SET_CATEGORY_FILTER', category })}
          allCategories={ALL_CATEGORIES}
          currentUser={{
            email: session?.user?.email,
            username: session?.user?.user_metadata?.username,
            phone: session?.user?.phone,
            createdAt: session?.user?.created_at,
          }}
          onSignOut={handleSignOut}
          onResetAll={handleResetAll}
        />
      )}
      {state.screen === 'quiz' && (
        <QuizScreen state={state} questions={activeQuestions} dispatch={dispatch} />
      )}
      {state.screen === 'results' && (
        <ResultsDashboard state={state} questions={activeQuestions} dispatch={dispatch} />
      )}
    </div>
  )
}
