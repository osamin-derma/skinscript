import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { COUNTRIES, DEFAULT_COUNTRY_CODE, findCountry } from '../lib/countries'

const LAST_COUNTRY_KEY = 'skinscript-last-country'

/**
 * PhoneInput — country picker (flag + dial code) on the left,
 * digits-only national number on the right. Emits the combined
 * E.164 string ("+9665XXXXXXXX") via onChange.
 *
 * props:
 *   - value          string in E.164 format (e.g. "+9665XXXXXXXX") or ""
 *   - onChange(e164) called with the new combined value
 *   - darkMode
 *   - autoFocus
 */
export default function PhoneInput({ value, onChange, darkMode, autoFocus }) {
  const initialCountry = useMemo(() => {
    // 1. If value already has a country (best-effort match by longest dial code), use that.
    if (value && value.startsWith('+')) {
      const digits = value.slice(1)
      // Try longest-prefix match (3-digit then 2-digit then 1-digit dial codes).
      for (const len of [3, 2, 1]) {
        const dial = digits.slice(0, len)
        const match = COUNTRIES.find(c => c.dial === dial)
        if (match) return match
      }
    }
    // 2. Fall back to last-used (persisted across visits).
    const last = localStorage.getItem(LAST_COUNTRY_KEY)
    if (last) {
      const match = COUNTRIES.find(c => c.code === last)
      if (match) return match
    }
    // 3. Default.
    return findCountry(DEFAULT_COUNTRY_CODE)
  }, [])

  const [country, setCountry] = useState(initialCountry)
  const [nationalDigits, setNationalDigits] = useState(() => {
    if (value && value.startsWith('+' + initialCountry.dial)) {
      return value.slice(1 + initialCountry.dial.length)
    }
    return ''
  })

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Push combined value up whenever pieces change
  useEffect(() => {
    const e164 = nationalDigits ? `+${country.dial}${nationalDigits}` : ''
    onChange(e164)
  }, [country, nationalDigits])

  const pickCountry = (c) => {
    setCountry(c)
    localStorage.setItem(LAST_COUNTRY_KEY, c.code)
    setOpen(false); setSearch('')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES
    const q = search.trim().toLowerCase().replace(/^\+/, '')
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.dial.startsWith(q) ||
      c.code.toLowerCase() === q,
    )
  }, [search])

  const wrapCls = darkMode
    ? 'bg-gray-900 border-gray-700 focus-within:ring-gray-600'
    : 'bg-gray-50 border-gray-200 focus-within:ring-gray-300'

  return (
    <div className="relative" ref={wrapperRef}>
      <div className={`flex items-stretch rounded-xl border focus-within:ring-2 transition ${wrapCls}`}>
        {/* Country selector button */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1 pl-3 pr-2 py-2.5 border-r ${
            darkMode ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'
          } rounded-l-xl text-sm`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-lg leading-none">{country.flag}</span>
          <span className="font-medium tabular-nums">+{country.dial}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {/* Digits-only national number */}
        <input
          className="flex-1 bg-transparent outline-none text-sm px-3"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={nationalDigits}
          onChange={(e) => setNationalDigits(e.target.value.replace(/\D/g, '').slice(0, 14))}
          placeholder="5XXXXXXXX"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl shadow-xl border ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className={`sticky top-0 p-2 border-b ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
              <Search size={14} className="text-gray-400" />
              <input
                autoFocus
                className="flex-1 bg-transparent outline-none text-xs"
                placeholder="Search country or dial code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-500 text-center">No match.</p>
          ) : (
            <ul role="listbox">
              {filtered.map(c => {
                const selected = c.code === country.code
                return (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => pickCountry(c)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition ${
                        selected
                          ? (darkMode ? 'bg-gray-700' : 'bg-gray-100 font-semibold')
                          : (darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')
                      }`}
                    >
                      <span className="text-lg leading-none">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="tabular-nums text-gray-400">+{c.dial}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
