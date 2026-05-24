/**
 * TransportDateNavigator.jsx
 *
 * A reusable weekly date navigator for the Transport admin page.
 * Behaviour mirrors the Media Booking "Check Availability" week navigator:
 *   - Shows a 7-day strip (Sun → Sat) for the current week
 *   - Left / right arrows advance the week by 7 days
 *   - Clicking a day cell updates the selected date
 *   - A native date-picker input also syncs with the strip
 *   - Passing selectedDate=null shows all bookings (no date filter)
 *
 * Props:
 *   selectedDate  {string|null}   ISO date string "YYYY-MM-DD" or null
 *   onDateChange  {fn(string|null)} called with new date or null on "show all"
 */

import { useState, useMemo } from 'react'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns the Sunday that starts the week containing `date` */
function getWeekStart(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())   // getDay() is 0=Sun
    return d
}

/** Offset d by `days` days, returns new Date */
function addDays(date, days) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

/** Format Date → 'YYYY-MM-DD' (local) */
function toISO(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** Format Date → short label, e.g. "SUN" */
function dayLabel(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

/** Format Date → day-of-month, e.g. "24" */
function dayNum(date) {
    return date.getDate()
}

/** Format Date → "May 2026" */
function monthHeader(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// ── component ─────────────────────────────────────────────────────────────────

export default function TransportDateNavigator({ selectedDate, onDateChange }) {
    // Anchor the week on selectedDate if present, else today
    const initialAnchor = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()
    const [weekStart, setWeekStart] = useState(() => getWeekStart(initialAnchor))

    // The 7 days for the current strip
    const days = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    }, [weekStart])

    const today = toISO(new Date())

    const prevWeek = () => setWeekStart(d => addDays(d, -7))
    const nextWeek = () => setWeekStart(d => addDays(d, 7))

    const handleDayClick = (day) => {
        const iso = toISO(day)
        if (iso === selectedDate) {
            // Clicking the same date deselects (show all)
            onDateChange(null)
        } else {
            onDateChange(iso)
        }
    }

    const handlePickerChange = (e) => {
        const iso = e.target.value
        if (!iso) { onDateChange(null); return }
        const parsed = new Date(iso + 'T00:00:00')
        setWeekStart(getWeekStart(parsed))
        onDateChange(iso)
    }

    const headerMonth = monthHeader(days[3]) // mid-week gives stable header

    return (
        <div className="bg-white rounded-2xl border border-[#e8f5ee] shadow-sm overflow-hidden">
            {/* ── Top bar: month label + picker + clear ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[#e8f5ee] bg-[#f6fbf8]">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#dcfce7] text-[#15803d]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </span>
                    <span className="text-[14px] font-bold text-[#0f172a] tracking-tight">
                        Transport Schedule
                    </span>
                    {selectedDate && (
                        <span className="ml-1 px-2.5 py-0.5 rounded-full bg-[#15803d] text-white text-[11px] font-bold tracking-wide">
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric'
                            })}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Date picker */}
                    <div className="relative">
                        <input
                            type="date"
                            value={selectedDate ?? ''}
                            onChange={handlePickerChange}
                            className="
                                w-[155px] border border-[#dbe7df] rounded-xl px-3 py-2
                                text-[13px] font-medium text-[#374151]
                                outline-none transition
                                focus:border-[#15803d] focus:ring-2 focus:ring-[#dcfce7]
                                bg-white
                            "
                        />
                    </div>
                    {/* Clear filter */}
                    {selectedDate && (
                        <button
                            onClick={() => onDateChange(null)}
                            className="
                                inline-flex items-center gap-1.5 px-3 py-2
                                rounded-xl border border-[#e2e8f0]
                                text-[12px] font-semibold text-[#6b7280]
                                hover:bg-[#f1f5f9] hover:text-[#374151]
                                transition
                            "
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── Week strip ── */}
            <div className="flex items-center px-2 py-3 gap-1">
                {/* Prev week */}
                <button
                    onClick={prevWeek}
                    className="
                        w-9 h-9 shrink-0 flex items-center justify-center
                        rounded-xl text-[#6b7280]
                        hover:bg-[#f0fdf4] hover:text-[#15803d]
                        transition
                    "
                    aria-label="Previous week"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                {/* Day cells */}
                <div className="flex-1 grid grid-cols-7 gap-1">
                    {days.map((day, idx) => {
                        const iso = toISO(day)
                        const isSelected = iso === selectedDate
                        const isToday    = iso === today
                        return (
                            <button
                                key={idx}
                                onClick={() => handleDayClick(day)}
                                className={`
                                    flex flex-col items-center justify-center
                                    py-2.5 rounded-xl
                                    transition duration-150 cursor-pointer select-none
                                    ${isSelected
                                        ? 'bg-[#15803d] text-white shadow-sm'
                                        : isToday
                                            ? 'bg-[#dcfce7] text-[#15803d] ring-1 ring-[#15803d]/20'
                                            : 'text-[#374151] hover:bg-[#f0fdf4] hover:text-[#15803d]'
                                    }
                                `}
                            >
                                <span className={`
                                    text-[9.5px] font-bold uppercase tracking-[0.12em] leading-none
                                    ${isSelected ? 'text-white/80' : isToday ? 'text-[#15803d]/70' : 'text-[#94a3b8]'}
                                `}>
                                    {DAY_NAMES[day.getDay()]}
                                </span>
                                <span className={`
                                    mt-1 text-[18px] font-bold leading-none
                                    ${isSelected ? 'text-white' : isToday ? 'text-[#15803d]' : 'text-[#0f172a]'}
                                `}>
                                    {dayNum(day)}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Next week */}
                <button
                    onClick={nextWeek}
                    className="
                        w-9 h-9 shrink-0 flex items-center justify-center
                        rounded-xl text-[#6b7280]
                        hover:bg-[#f0fdf4] hover:text-[#15803d]
                        transition
                    "
                    aria-label="Next week"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* ── Month label row ── */}
            <div className="px-5 pb-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.12em]">
                {headerMonth}
            </div>
        </div>
    )
}
