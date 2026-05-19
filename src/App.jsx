import { useEffect, useReducer, useState } from 'react'
import arabBoardRaw from './data/arab_board_master.json'
import boardVitalsRaw from './data/board_vitals_master.json'
import makkiRaw from './data/makki_master.json'
import etas2026Raw from './data/etas_2026_master.json'
import AuthScreen from './components/AuthScreen'
import { supabase } from './lib/supabase'
import { onAuthStateChange, signOut } from './lib/auth'

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
}

function reducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      return {
        ...state,
        history: loadJSON(HISTORY_KEY, []),
        globalFlagged: loadJSON(GLOBAL_FLAGS_KEY, []),
        globalWrong: loadJSON(GLOBAL_WRONG_KEY, []),
        globalUsed: loadJSON(GLOBAL_USED_KEY, []),
        categoryFilter: localStorage.getItem(CATEGORY_FILTER_KEY) || 'all',
      }
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
      } else if (action.source === 'topics' && action.topics?.length > 0) {
        pool = pool.filter(i => action.topics.includes(bankQuestions[i].topic))
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
        quizSource: action.source || 'all',
        activeBank: bankKey,
      }
    }
    case 'ANSWER': {
      const newAnswers = { ...state.answers, [action.questionId]: { selected: action.selected, correct: action.correct, submitted: true } }

      // Track globally
      const newUsed = [...new Set([...state.globalUsed, action.questionId])]
      const newWrong = action.correct
        ? state.globalWrong.filter(id => id !== action.questionId)
        : [...new Set([...state.globalWrong, action.questionId])]

      saveJSON(GLOBAL_USED_KEY, newUsed)
      saveJSON(GLOBAL_WRONG_KEY, newWrong)

      return { ...state, answers: newAnswers, globalUsed: newUsed, globalWrong: newWrong }
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

      saveJSON(GLOBAL_FLAGS_KEY, gf)
      return { ...state, flagged: f, globalFlagged: gf }
    }
    case 'END_QUIZ': {
      const total = state.questionOrder.length
      const answered = Object.values(state.answers).filter(a => a.submitted).length
      const correct = Object.values(state.answers).filter(a => a.correct).length
      const score = total > 0 ? Math.round((correct / total) * 100) : 0

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
      }

      const newHistory = [historyEntry, ...state.history].slice(0, 50)
      saveJSON(HISTORY_KEY, newHistory)

      return { ...state, screen: 'results', history: newHistory }
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
      // Jump directly to a single question (from search results)
      const bankKey = action.bank || state.activeBank
      const bankQs = getBankQuestions(bankKey)
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
      }
    }
    case 'REVIEW_WRONG': {
      const bankQs = getBankQuestions(state.activeBank)
      const wrongOrder = bankQs.map((_, i) => i).filter(i => state.globalWrong.includes(bankQs[i]?.id))
      if (wrongOrder.length === 0) return state
      return { ...state, screen: 'quiz', mode: 'tutor', questionOrder: shuffleArray(wrongOrder), currentIndex: 0, answers: {}, flagged: [], quizSource: 'wrong' }
    }
    case 'CLEAR_HISTORY':
      saveJSON(HISTORY_KEY, [])
      return { ...state, history: [] }
    case 'RESET_PERFORMANCE':
      saveJSON(GLOBAL_WRONG_KEY, [])
      saveJSON(GLOBAL_USED_KEY, [])
      saveJSON(GLOBAL_FLAGS_KEY, [])
      return { ...state, globalWrong: [], globalUsed: [], globalFlagged: [] }
    case 'RESET_ALL': {
      // Nuclear option: clear ALL progress, history, flags, used, wrong,
      // and any in-progress quiz — start completely fresh
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(HISTORY_KEY)
      localStorage.removeItem(GLOBAL_FLAGS_KEY)
      localStorage.removeItem(GLOBAL_WRONG_KEY)
      localStorage.removeItem(GLOBAL_USED_KEY)
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
    // Wipe all local progress/state too — keeps the device clean.
    wipeAllAppData()
    window.location.reload()
  }

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

  const dismissWelcome = () => {
    // Wipe every key we've ever owned, then mark this data version as
    // seen. Reload to guarantee a clean slate (no in-memory leftovers
    // from earlier reducer hooks).
    wipeAllAppData()
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION)
    setShowWelcome(false)
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
          <div className="inline-block w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin mb-3" style={{ color: '#2c3e3f' }} />
          <p className="text-sm">Loading SkinScript…</p>
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
          }}
          onSignOut={handleSignOut}
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
