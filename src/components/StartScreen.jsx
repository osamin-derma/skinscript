import React, { useState, useEffect, useMemo } from 'react'
import { Sun, Moon, BookOpen, Clock, Eye, Flag, XCircle, Sparkles, History, Trash2, ChevronDown, ChevronUp, Trophy, BarChart3, Search, X as XIcon } from 'lucide-react'

export default function StartScreen({ totalQuestions, topics, darkMode, state, onToggleDark, onStart, dispatch, banks, categoryFilter, setCategoryFilter, allCategories }) {
  const [mode, setMode] = useState('tutor')
  const [timer, setTimer] = useState(90)
  const [shuffle, setShuffle] = useState(true)
  const [questionCount, setQuestionCount] = useState(40)
  const [source, setSource] = useState('all')
  const [selectedTopics, setSelectedTopics] = useState([])
  const [showTopics, setShowTopics] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [tab, setTab] = useState('create') // 'create' | 'history' | 'performance'
  const [activeBank, setActiveBankLocal] = useState(state.activeBank || 'all')
  const setActiveBank = (bank) => {
    setActiveBankLocal(bank)
    dispatch({ type: 'SET_BANK', bank })
  }

  // ───────── Global Search ─────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState('all')   // 'all' | 'last11' | 'makki' | 'etasHairNails' | 'bvHairNail'
  const [searchScopeFilter, setSearchScopeFilter] = useState('any') // 'any' | 'question' | 'choices' | 'explanation'

  // Compute search results (debounced via useMemo on inputs)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q.length < 2 || !banks) return []
    const pool = banks[searchScope]?.questions || banks.all?.questions || []
    const matches = []
    for (const item of pool) {
      const qText = (item.question || '').toLowerCase()
      const choicesText = item.choices ? Object.values(item.choices).join(' ').toLowerCase() : ''
      const explText = (item.explanation || '').toLowerCase()

      let hit = false
      if (searchScopeFilter === 'question') hit = qText.includes(q)
      else if (searchScopeFilter === 'choices') hit = choicesText.includes(q)
      else if (searchScopeFilter === 'explanation') hit = explText.includes(q)
      else hit = qText.includes(q) || choicesText.includes(q) || explText.includes(q)

      if (hit) {
        matches.push(item)
        if (matches.length >= 100) break  // cap for performance
      }
    }
    return matches
  }, [searchQuery, searchScope, searchScopeFilter, banks])

  // Helper to highlight matched substring in a piece of text
  const highlightMatch = (text, query) => {
    if (!text || !query) return text
    const i = text.toLowerCase().indexOf(query.toLowerCase())
    if (i < 0) return text
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-yellow-200 dark:bg-yellow-700/60 rounded px-0.5">
          {text.slice(i, i + query.length)}
        </mark>
        {text.slice(i + query.length)}
      </>
    )
  }

  // Determine which bank a question belongs to (for search results)
  const findQuestionBank = (qid) => {
    if (!banks) return 'all'
    for (const key of ['last11', 'makki', 'etasHairNails', 'bvHairNail']) {
      if (banks[key]?.questions?.some(q => q.id === qid)) return key
    }
    return 'all'
  }

  const openSearchResult = (result) => {
    const realQuestionId = result.id > 100000 ? null : result.id
    // Search results from "all" bank have offset IDs (+100k, +200k, +300k)
    // We need the ORIGINAL bank's id. Use a more reliable method:
    // try to find by matching on the question text in each individual bank
    let bankKey = 'all'
    let originalId = result.id
    for (const key of ['last11', 'makki', 'etasHairNails', 'bvHairNail']) {
      const found = banks[key]?.questions?.find(q =>
        q.question === result.question && q.correct_answer === result.correct_answer
      )
      if (found) {
        bankKey = key
        originalId = found.id
        break
      }
    }
    dispatch({ type: 'OPEN_SINGLE_QUESTION', bank: bankKey, questionId: originalId })
  }

  const { history = [], globalFlagged = [], globalWrong = [], globalUsed = [] } = state
  const unusedCount = totalQuestions - globalUsed.length

  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const cardBg = darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
  const brand = '#2c3e3f' // SkinScript dark teal
  const brandLight = '#3d5556'
  const brandBg = '#e8f0f0'
  const gold = '#c9a84c' // SkinScript gold accent

  const getPoolSize = () => {
    if (source === 'flagged') return globalFlagged.length
    if (source === 'wrong') return globalWrong.length
    if (source === 'unused') return unusedCount
    if (source === 'topics') return selectedTopics.length > 0 ? totalQuestions : 0
    return totalQuestions
  }

  const poolSize = getPoolSize()

  // When source changes, clamp questionCount to new pool size
  useEffect(() => {
    if (poolSize > 0 && questionCount > poolSize) {
      setQuestionCount(poolSize)
    } else if (poolSize === 0) {
      setQuestionCount(0)
    } else if (questionCount === 0 && poolSize > 0) {
      setQuestionCount(Math.min(40, poolSize))
    }
  }, [source, poolSize])

  const handleStart = () => {
    if (poolSize === 0) return
    onStart({
      mode,
      timer: mode === 'timed' ? timer : 0,
      shuffle,
      count: Math.min(questionCount, poolSize),
      source,
      topics: source === 'topics' ? selectedTopics : [],
      bank: activeBank,
    })
  }

  const currentBankCount = banks?.[activeBank]?.count || totalQuestions

  const toggleTopic = (t) => {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const presets = [10, 20, 40, 80, 120]
  const avgScore = history.length > 0 ? Math.round(history.reduce((a, h) => a + h.score, 0) / history.length) : 0

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div />
          <button onClick={onToggleDark} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Logo & Title */}
        <div className="text-center mb-6">
          <img src={`${import.meta.env.BASE_URL}icon.png`} alt="SkinScript" className="w-24 h-24 mx-auto mb-3 rounded-full shadow-lg" style={{ objectFit: 'cover' }} />
          <h1 className="text-3xl font-extrabold tracking-tight mb-0.5">
            <span style={{ color: brand }}>SKIN</span><span style={{ color: brandLight }}>SCRIP</span><span style={{ color: gold, fontStyle: 'italic' }}>t</span>
          </h1>
          <p className="text-xs font-medium tracking-widest uppercase text-gray-400">Dermatology & Education</p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: '#e8f0f0' }}>
            <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: brand }}>Dermatology Quiz</span>
            <span className="text-[10px] text-gray-500">•</span>
            <span className="text-[10px] text-gray-500">4 Question Banks</span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div className={`${bg} rounded-xl p-3 text-center shadow-sm border dark:border-gray-700`}>
            <div className="text-xl font-bold" style={{ color: brand }}>{totalQuestions}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Total</div>
          </div>
          <div className={`${bg} rounded-xl p-3 text-center shadow-sm border dark:border-gray-700`}>
            <div className="text-xl font-bold text-green-600">{globalUsed.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Used</div>
          </div>
          <div className={`${bg} rounded-xl p-3 text-center shadow-sm border dark:border-gray-700`}>
            <div className="text-xl font-bold text-red-600">{globalWrong.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Incorrect</div>
          </div>
          <div className={`${bg} rounded-xl p-3 text-center shadow-sm border dark:border-gray-700`}>
            <div className="text-xl font-bold text-orange-500">{globalFlagged.length}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Flagged</div>
          </div>
        </div>

        {/* Start Fresh link — only shown when there's progress to reset */}
        {(globalUsed.length > 0 || globalWrong.length > 0 || globalFlagged.length > 0 || history.length > 0) && (
          <div className="flex justify-end mb-6">
            <button
              onClick={() => {
                if (confirm('Start Fresh as a New User?\n\nThis will reset ALL progress:\n• ' + globalUsed.length + ' used questions\n• ' + globalWrong.length + ' incorrect answers\n• ' + globalFlagged.length + ' flagged questions\n• ' + history.length + ' quiz history entries\n\nThis cannot be undone.')) {
                  dispatch({ type: 'RESET_ALL' })
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-red-600 hover:border-red-300 transition"
            >
              <Trash2 size={12} />
              Start Fresh (Reset All)
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* GLOBAL SEARCH BOX                               */}
        {/* ═══════════════════════════════════════════════ */}
        {banks && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: brand }} />
              <label className="text-sm font-bold uppercase tracking-wide" style={{ color: brand }}>
                Search Questions
              </label>
            </div>

            {/* Search input */}
            <div className={`relative rounded-xl border-2 transition-all ${
              searchQuery
                ? 'border-teal-700 shadow-md'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}>
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search any word in questions, choices, or explanations…"
                className={`w-full py-3 pl-10 pr-9 rounded-xl bg-transparent text-sm focus:outline-none ${darkMode ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Clear search"
                >
                  <XIcon size={16} className="text-gray-400" />
                </button>
              )}
            </div>

            {/* Scope filters: in-bank + field */}
            {searchQuery.trim().length >= 2 && (
              <div className="mt-3 space-y-2">
                {/* Bank scope */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mr-1">In:</span>
                  {[
                    { key: 'all',           label: `All (${banks.all.count})` },
                    { key: 'last11',        label: `Last 11 (${banks.last11.count})` },
                    { key: 'makki',         label: `Makki (${banks.makki.count})` },
                    { key: 'etasHairNails', label: `ETAS H&N (${banks.etasHairNails.count})` },
                    { key: 'bvHairNail',    label: `BV H&N (${banks.bvHairNail.count})` },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setSearchScope(s.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                        searchScope === s.key
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {/* Field scope */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mr-1">Where:</span>
                  {[
                    { key: 'any',         label: 'Anywhere' },
                    { key: 'question',    label: 'Question stem' },
                    { key: 'choices',     label: 'Answer choices' },
                    { key: 'explanation', label: 'Explanation' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setSearchScopeFilter(s.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                        searchScopeFilter === s.key
                          ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30'
                          : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results panel */}
            {searchQuery.trim().length >= 2 && (
              <div className={`mt-3 rounded-xl border ${darkMode ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50/60'}`}>
                <div className="px-3 py-2 border-b dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {searchResults.length === 0
                      ? 'No matches'
                      : `${searchResults.length}${searchResults.length >= 100 ? '+' : ''} match${searchResults.length === 1 ? '' : 'es'}`}
                  </span>
                  {searchResults.length >= 100 && (
                    <span className="text-[10px] text-gray-400">Showing first 100 — refine your search</span>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-72 overflow-y-auto divide-y dark:divide-gray-700">
                    {searchResults.map((r, idx) => {
                      const bankOfQ = findQuestionBank(r.id) // fallback
                      const bankLabel = banks[bankOfQ]?.label || 'All'
                      const correctChoiceText = r.choices?.[r.correct_answer] || r.correct_text || ''
                      return (
                        <button
                          key={`${r.id}-${idx}`}
                          onClick={() => openSearchResult(r)}
                          className={`w-full text-left p-3 transition ${darkMode ? 'hover:bg-gray-700/40' : 'hover:bg-white'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: '#e8f0f0', color: brand }}>
                              {r.source || bankLabel}
                            </span>
                            {r.exam && (
                              <span className="text-[10px] text-gray-400">📅 {r.exam}</span>
                            )}
                            <span className="text-[10px] text-gray-400 ml-auto">Q{r.original_num || r.id}</span>
                          </div>
                          <p className="text-sm leading-snug line-clamp-2">
                            {highlightMatch(r.question, searchQuery.trim())}
                          </p>
                          <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">
                            ✓ {r.correct_answer}. {highlightMatch(correctChoiceText.slice(0, 120), searchQuery.trim())}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
                {searchResults.length === 0 && (
                  <div className="p-6 text-center text-xs text-gray-400">
                    Try different keywords or change the scope above.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* QUESTION BANK SELECTOR — Master Edition 2026     */}
        {/* All / Arab Board / Board Vitals / Makki / ETAS   */}
        {/* ═══════════════════════════════════════════════ */}
        {banks && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: brand }} />
              <label className="text-sm font-bold uppercase tracking-wide" style={{ color: brand }}>Select Question Bank</label>
              <span className="ml-auto text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded" style={{ color: gold, backgroundColor: '#fdf6e3' }}>Master Edition · 2026</span>
            </div>

            {/* All Questions — full-width card */}
            <button
              onClick={() => setActiveBank('all')}
              className={`w-full mb-2 p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                activeBank === 'all'
                  ? 'shadow-md'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:shadow-sm'
              }`}
              style={activeBank === 'all'
                ? { backgroundColor: '#e8f0f0', borderColor: brand }
                : {}}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                   style={{ backgroundColor: activeBank === 'all' ? brand : '#e5e7eb',
                            color: activeBank === 'all' ? 'white' : '#6b7280' }}>
                📚
              </div>
              <div className="flex-1">
                <div className="font-bold text-base" style={{ color: activeBank === 'all' ? brand : undefined }}>All Questions</div>
                <div className="text-xs text-gray-500">Combined: all 4 sources</div>
              </div>
              <div className="text-2xl font-extrabold"
                   style={{ color: activeBank === 'all' ? brand : '#9ca3af' }}>
                {banks.all.count.toLocaleString()}
              </div>
            </button>

            {/* Individual banks — 2x2 grid */}
            <div className="grid grid-cols-2 gap-2">
              {/* Arab Board */}
              <button
                onClick={() => setActiveBank('arabBoard')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  activeBank === 'arabBoard'
                    ? 'shadow-md'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:shadow-sm'
                }`}
                style={activeBank === 'arabBoard'
                  ? { backgroundColor: '#e8f0f0', borderColor: brand }
                  : {}}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                       style={{ backgroundColor: activeBank === 'arabBoard' ? brand : '#e5e7eb',
                                color: activeBank === 'arabBoard' ? 'white' : '#6b7280' }}>
                    🌍
                  </div>
                  <div className="text-2xl font-extrabold"
                       style={{ color: activeBank === 'arabBoard' ? brand : '#9ca3af' }}>
                    {banks.arabBoard.count.toLocaleString()}
                  </div>
                </div>
                <div className="font-semibold text-sm"
                     style={{ color: activeBank === 'arabBoard' ? brand : undefined }}>
                  Arab Board
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Regional board exams</div>
              </button>

              {/* Board Vitals */}
              <button
                onClick={() => setActiveBank('boardVitals')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  activeBank === 'boardVitals'
                    ? 'shadow-md'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:shadow-sm'
                }`}
                style={activeBank === 'boardVitals'
                  ? { backgroundColor: '#fef2f2', borderColor: '#ef4444' }
                  : {}}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                       style={{ backgroundColor: activeBank === 'boardVitals' ? '#ef4444' : '#e5e7eb',
                                color: activeBank === 'boardVitals' ? 'white' : '#6b7280' }}>
                    💉
                  </div>
                  <div className="text-2xl font-extrabold"
                       style={{ color: activeBank === 'boardVitals' ? '#ef4444' : '#9ca3af' }}>
                    {banks.boardVitals.count.toLocaleString()}
                  </div>
                </div>
                <div className="font-semibold text-sm"
                     style={{ color: activeBank === 'boardVitals' ? '#ef4444' : undefined }}>
                  Board Vitals
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">With explanations</div>
              </button>

              {/* Makki */}
              <button
                onClick={() => setActiveBank('makki')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  activeBank === 'makki'
                    ? 'shadow-md'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:shadow-sm'
                }`}
                style={activeBank === 'makki'
                  ? { backgroundColor: '#fdf6e3', borderColor: gold }
                  : {}}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                       style={{ backgroundColor: activeBank === 'makki' ? gold : '#e5e7eb',
                                color: activeBank === 'makki' ? 'white' : '#6b7280' }}>
                    🩺
                  </div>
                  <div className="text-2xl font-extrabold"
                       style={{ color: activeBank === 'makki' ? gold : '#9ca3af' }}>
                    {banks.makki.count.toLocaleString()}
                  </div>
                </div>
                <div className="font-semibold text-sm"
                     style={{ color: activeBank === 'makki' ? gold : undefined }}>
                  Makki
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Dermatology MCQs</div>
              </button>

              {/* ETAS 2026 */}
              <button
                onClick={() => setActiveBank('etas2026')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  activeBank === 'etas2026'
                    ? 'shadow-md'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:shadow-sm'
                }`}
                style={activeBank === 'etas2026'
                  ? { backgroundColor: '#eef4ff', borderColor: '#3b82f6' }
                  : {}}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                       style={{ backgroundColor: activeBank === 'etas2026' ? '#3b82f6' : '#e5e7eb',
                                color: activeBank === 'etas2026' ? 'white' : '#6b7280' }}>
                    📋
                  </div>
                  <div className="text-2xl font-extrabold"
                       style={{ color: activeBank === 'etas2026' ? '#3b82f6' : '#9ca3af' }}>
                    {banks.etas2026.count.toLocaleString()}
                  </div>
                </div>
                <div className="font-semibold text-sm"
                     style={{ color: activeBank === 'etas2026' ? '#3b82f6' : undefined }}>
                  ETAS 2026
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">Largest collection</div>
              </button>
            </div>

            {/* CATEGORY FILTER — Filter by main category */}
            {allCategories && allCategories.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: gold }} />
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Filter by Topic</label>
                  {categoryFilter && categoryFilter !== 'all' && (
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className="ml-auto text-[10px] text-gray-500 hover:text-red-500 underline"
                    >
                      clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      !categoryFilter || categoryFilter === 'all'
                        ? 'font-semibold'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                    }`}
                    style={(!categoryFilter || categoryFilter === 'all')
                      ? { backgroundColor: brand, borderColor: brand, color: 'white' }
                      : {}}
                  >
                    All topics
                  </button>
                  {allCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        categoryFilter === cat
                          ? 'font-semibold'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400'
                      }`}
                      style={categoryFilter === cat
                        ? { backgroundColor: brand, borderColor: brand, color: 'white' }
                        : {}}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-gray-100 dark:bg-gray-700">
          {[
            { key: 'create', icon: <Sparkles size={14} />, label: 'Create Quiz' },
            { key: 'history', icon: <History size={14} />, label: 'History' },
            { key: 'performance', icon: <BarChart3 size={14} />, label: 'Performance' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition ${
                tab === t.key ? 'bg-white dark:bg-gray-600 shadow-sm font-semibold' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* CREATE TAB */}
        {tab === 'create' && (
          <div className={`${bg} rounded-2xl shadow-xl p-6`}>
            {/* Quick action buttons */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {globalFlagged.length > 0 && (
                <button
                  onClick={() => dispatch({ type: 'REVIEW_FLAGGED' })}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 hover:border-orange-400 transition"
                >
                  <Flag size={18} className="text-orange-500" />
                  <span className="text-[10px] font-semibold text-orange-600">Flagged ({globalFlagged.length})</span>
                </button>
              )}
              {globalWrong.length > 0 && (
                <button
                  onClick={() => dispatch({ type: 'REVIEW_WRONG' })}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 hover:border-red-400 transition"
                >
                  <XCircle size={18} className="text-red-500" />
                  <span className="text-[10px] font-semibold text-red-600">Wrong ({globalWrong.length})</span>
                </button>
              )}
              {unusedCount > 0 && (
                <button
                  onClick={() => { setSource('unused'); }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition ${
                    source === 'unused' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-400 dark:border-gray-600'
                  }`}
                >
                  <Sparkles size={18} className="text-blue-500" />
                  <span className="text-[10px] font-semibold text-blue-600">Unused ({unusedCount})</span>
                </button>
              )}
            </div>

            {/* Question Source */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">Question Source</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'all', label: 'All Questions', count: totalQuestions },
                  { key: 'unused', label: 'Unused Only', count: unusedCount },
                  { key: 'wrong', label: 'Incorrect Only', count: globalWrong.length },
                  { key: 'flagged', label: 'Flagged Only', count: globalFlagged.length },
                  { key: 'topics', label: 'By Topic', count: null },
                ].map(s => {
                  const disabled = (s.key === 'wrong' && globalWrong.length === 0)
                    || (s.key === 'unused' && unusedCount === 0)
                    || (s.key === 'flagged' && globalFlagged.length === 0)
                  return (
                    <button
                      key={s.key}
                      onClick={() => !disabled && setSource(s.key)}
                      disabled={disabled}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition text-left ${
                        disabled
                          ? 'border-gray-200 text-gray-300 cursor-not-allowed dark:border-gray-700'
                          : source === s.key
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {s.label}
                      {s.count !== null && <span className="ml-1 text-gray-400">({s.count})</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Topic filter */}
            {source === 'topics' && (
              <div className="mb-5">
                <button
                  onClick={() => setShowTopics(!showTopics)}
                  className="w-full flex items-center justify-between py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-sm"
                >
                  <span>{selectedTopics.length > 0 ? `${selectedTopics.length} topics selected` : 'Select topics...'}</span>
                  {showTopics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showTopics && (
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 p-2 space-y-1">
                    <button onClick={() => setSelectedTopics(selectedTopics.length === topics.length ? [] : [...topics])} className="text-xs text-blue-600 mb-1">
                      {selectedTopics.length === topics.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {topics.map(t => (
                      <label key={t} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTopics.includes(t)}
                          onChange={() => toggleTopic(t)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-xs">{t}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Number of questions */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">
                Number of Questions
                <span className="ml-2 text-gray-400 normal-case font-normal">(pool: {poolSize})</span>
              </label>
              <div className="flex gap-2 mb-2">
                {presets.map(n => {
                  const disabled = n > poolSize
                  return (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      disabled={disabled}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        disabled
                          ? 'border-gray-200 text-gray-300 cursor-not-allowed dark:border-gray-700'
                          : questionCount === n
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  )
                })}
                <button
                  onClick={() => setQuestionCount(poolSize)}
                  disabled={poolSize === 0}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                    poolSize === 0
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : questionCount === poolSize && !presets.includes(questionCount)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                  }`}
                >
                  All
                </button>
              </div>
              <input
                type="range"
                min={poolSize > 0 ? 1 : 0}
                max={Math.max(poolSize, 1)}
                value={questionCount}
                disabled={poolSize === 0}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-gray-200 disabled:cursor-not-allowed"
              />
              <div className="text-center text-xs text-gray-500 mt-1">
                {poolSize === 0
                  ? <span className="text-red-500">No questions available in this pool</span>
                  : `${questionCount} of ${poolSize} questions selected`}
              </div>
            </div>

            {/* Mode */}
            <div className="mb-5">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">Quiz Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'tutor', icon: <BookOpen size={14} />, label: 'Tutor', desc: 'See answers immediately' },
                  { key: 'timed', icon: <Clock size={14} />, label: 'Timed', desc: 'Countdown per question' },
                  { key: 'review', icon: <Eye size={14} />, label: 'Review', desc: 'Browse Q&A freely' },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium border-2 transition ${
                      mode === m.key
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {m.icon}
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-[9px] text-gray-400">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Timer (timed only) */}
            {mode === 'timed' && (
              <div className="mb-5">
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider text-gray-500">Seconds per Question</label>
                <div className="flex gap-2">
                  {[60, 90, 120, 180].map(t => (
                    <button
                      key={t}
                      onClick={() => setTimer(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                        timer === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shuffle */}
            <div className="mb-6 flex items-center gap-3">
              <input type="checkbox" id="shuffle" checked={shuffle} onChange={e => setShuffle(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <label htmlFor="shuffle" className="text-sm">Shuffle Questions</label>
            </div>

            {/* Start */}
            <button
              onClick={handleStart}
              disabled={poolSize === 0 || questionCount === 0}
              className={`w-full py-3.5 rounded-xl text-white font-bold text-lg transition shadow-lg ${
                poolSize === 0 || questionCount === 0
                  ? 'cursor-not-allowed opacity-40'
                  : 'hover:opacity-90'
              }`}
              style={{ backgroundColor: brand }}
            >
              {poolSize === 0
                ? 'No Questions Available'
                : `Start Quiz — ${Math.min(questionCount, poolSize)} Questions`}
            </button>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className={`${bg} rounded-2xl shadow-xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Quiz History</h2>
              {history.length > 0 && (
                <button onClick={() => dispatch({ type: 'CLEAR_HISTORY' })} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <History size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No quiz history yet</p>
                <p className="text-xs">Complete a quiz to see results here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className={`${cardBg} rounded-xl p-4 border`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Trophy size={14} className={h.score >= 70 ? 'text-green-500' : h.score >= 50 ? 'text-yellow-500' : 'text-red-500'} />
                        <span className={`text-lg font-bold ${h.score >= 70 ? 'text-green-600' : h.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{h.score}%</span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-500">
                      <span>{h.correct}/{h.totalQuestions} correct</span>
                      <span>•</span>
                      <span className="capitalize">{h.mode} mode</span>
                      <span>•</span>
                      <span className="capitalize">{h.source}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${h.score}%`, backgroundColor: h.score >= 70 ? '#22c55e' : h.score >= 50 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {tab === 'performance' && (
          <div className={`${bg} rounded-2xl shadow-xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Overall Performance</h2>
              <button
                onClick={() => {
                  if (confirm('Reset ALL progress?\n\nThis will clear:\n• Quiz history\n• Used/Incorrect/Flagged questions\n• All saved data\n\nYou will start fresh as a new user.\n\nThis cannot be undone.')) {
                    dispatch({ type: 'RESET_ALL' })
                  }
                }}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
              >
                <Trash2 size={12} /> Reset Everything
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-center">
                <div className="text-3xl font-bold" style={{ color: brand }}>{history.length}</div>
                <div className="text-xs text-gray-500">Quizzes Taken</div>
              </div>
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-center">
                <div className="text-3xl font-bold text-green-600">{avgScore}%</div>
                <div className="text-xs text-gray-500">Average Score</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-center">
                <div className="text-3xl font-bold text-purple-600">{globalUsed.length}</div>
                <div className="text-xs text-gray-500">Questions Seen</div>
              </div>
              <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700 text-center">
                <div className="text-3xl font-bold text-gray-600">{totalQuestions > 0 ? Math.round((globalUsed.length / totalQuestions) * 100) : 0}%</div>
                <div className="text-xs text-gray-500">Completion</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Question Bank Completion</span>
                <span>{globalUsed.length}/{totalQuestions}</span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${totalQuestions > 0 ? (globalUsed.length / totalQuestions) * 100 : 0}%`, backgroundColor: brand }} />
              </div>
            </div>

            {/* Score trend */}
            {history.length > 1 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Recent Scores</h3>
                <div className="flex items-end gap-1 h-20">
                  {history.slice(0, 20).reverse().map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(h.score * 0.8, 4)}px`,
                          backgroundColor: h.score >= 70 ? '#22c55e' : h.score >= 50 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4 pb-4">Created by Dr. Osama Al Rawi</p>
      </div>
    </div>
  )
}
