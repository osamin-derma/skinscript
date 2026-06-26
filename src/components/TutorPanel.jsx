import { useState, useEffect, useRef } from 'react'
import { Sparkles, Send, Loader2, AlertCircle } from 'lucide-react'
import { tutorAvailable, askTutor } from '../lib/tutor'

/**
 * TutorPanel — a contextual "Ask AI Tutor" chat shown under a question's
 * explanation. It calls the `tutor` Supabase Edge Function (which holds the
 * Anthropic key server-side). The whole panel renders nothing until the
 * function reports it's configured, so on a deployment without the tutor set
 * up the feature is simply invisible — never a broken button.
 */
const SUGGESTIONS = [
  'Explain the key concept simply',
  'Why are the other options wrong?',
  'Give me a mnemonic',
  'How do I tell it apart from look-alikes?',
]

export default function TutorPanel({ question, darkMode }) {
  const brand = '#2c3e3f'
  const [avail, setAvail] = useState(null) // null = checking, false = hide, true = show
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant', content}
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  // Probe availability once; cached across mounts within the session.
  useEffect(() => {
    let alive = true
    tutorAvailable().then((ok) => { if (alive) setAvail(ok) }).catch(() => { if (alive) setAvail(false) })
    return () => { alive = false }
  }, [])

  // Reset the conversation when the question changes.
  useEffect(() => { setMessages([]); setError(null); setOpen(false); setInput('') }, [question?.pdf_id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  if (!avail) return null

  const context = {
    question: question.question,
    choices: question.choices,
    correct_answer: question.correct_answer,
    correct_text: question.correct_text || question.choices?.[question.correct_answer],
    explanation: question.explanation,
  }

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setError(null)
    setInput('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)
    try {
      const reply = await askTutor(context, next)
      setMessages((m) => [...m, { role: 'assistant', content: reply || '(no response)' }])
    } catch (e) {
      setError('The tutor is unavailable right now. Please try again.')
      // Roll the failed user turn back out of history and restore the text.
      setMessages((m) => (m[m.length - 1]?.role === 'user' ? m.slice(0, -1) : m))
      setInput(content)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-left ${darkMode ? 'bg-gray-900/60 hover:bg-gray-900' : 'bg-gradient-to-r from-teal-50 to-transparent hover:from-teal-100'}`}
      >
        <Sparkles size={16} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <span className="text-sm font-semibold" style={{ color: darkMode ? '#7fb5b5' : brand }}>Ask AI Tutor</span>
        <span className="ml-auto text-[10px] text-gray-400">{open ? 'Hide' : 'about this question'}</span>
      </button>

      {open && (
        <div className={`p-3 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          {/* Conversation */}
          {messages.length > 0 && (
            <div ref={scrollRef} className="max-h-72 overflow-auto space-y-2.5 mb-3 pr-1">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : darkMode ? 'bg-gray-700 text-gray-100 rounded-bl-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`} style={m.role === 'user' ? { backgroundColor: brand } : undefined}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className={`px-3 py-2 rounded-2xl rounded-bl-sm ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Loader2 size={15} className="animate-spin text-gray-400" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggestions (only before the first message) */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full border transition ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 mb-2 text-xs text-red-500">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Composer */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask a follow-up…"
              rows={1}
              className={`flex-1 px-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 resize-none ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl text-white disabled:opacity-40"
              style={{ backgroundColor: brand }}
              aria-label="Send"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">AI can make mistakes — verify against the explanation and your references.</p>
        </div>
      )}
    </div>
  )
}
