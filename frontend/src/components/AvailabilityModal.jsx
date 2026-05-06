import { useState } from "react"
import BookingModal from "./BookingModal"

// ─────────────────────────────────────────────
// MOCK DATA  (replace with API call later)
// Only APPROVED bookings are stored here.
// Format: { "YYYY-MM-DD": [ { start: "HH:MM", end: "HH:MM", title: string } ] }
// ─────────────────────────────────────────────
const mockApprovedByRoom = {
  "Golden Aureole": {
    "2026-05-01": [
      { start: "09:00", end: "11:00", title: "Orientation session" },
      { start: "14:00", end: "16:30", title: "Dept. seminar" },
    ],
    "2026-05-05": [
      { start: "10:00", end: "12:00", title: "Cultural event" },
    ],
    "2026-05-12": [
      { start: "08:00", end: "18:00", title: "Annual day" },
    ],
  },
  "CC Lab": {
    "2026-05-01": [
      { start: "09:00", end: "11:00", title: "Lab exam" },
      { start: "13:00", end: "14:00", title: "Practical session" },
    ],
  },
}


// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const DAY_START = "08:00"
const DAY_END   = "18:00"

const toMins = (t) => {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

const toTime = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Given a list of approved bookings for a day, returns a sorted timeline
 * of { type: "booked"|"free", start, end, title? } blocks within 8AM–6PM.
 */
function buildTimeline(bookings) {
  const dayStart = toMins(DAY_START)
  const dayEnd   = toMins(DAY_END)

  // Sort by start time
  const sorted = [...bookings].sort((a, b) => toMins(a.start) - toMins(b.start))

  const blocks = []
  let cursor = dayStart

  for (const bk of sorted) {
    const bStart = toMins(bk.start)
    const bEnd   = toMins(bk.end)

    // Clamp to day bounds
    const s = Math.max(bStart, dayStart)
    const e = Math.min(bEnd,   dayEnd)

    if (s > cursor) {
      // Free gap before this booking
      blocks.push({ type: "free", start: toTime(cursor), end: toTime(s) })
    }

    if (e > s) {
      blocks.push({ type: "booked", start: toTime(s), end: toTime(e), title: bk.title })
    }

    cursor = Math.max(cursor, e)
  }

  // Free gap after last booking
  if (cursor < dayEnd) {
    blocks.push({ type: "free", start: toTime(cursor), end: toTime(dayEnd) })
  }

  return blocks
}

const formatDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

const todayKey = () => {
  const t = new Date()
  return formatDateKey(t.getFullYear(), t.getMonth(), t.getDate())
}

/**
 * Returns "free" | "partial" | "full" for a given day's bookings.
 * "free"    — no bookings at all
 * "partial" — some slots booked, some free
 * "full"    — entire 08:00–18:00 is booked
 */
function getDayStatus(bookings) {
  if (!bookings || bookings.length === 0) return "free"
  const timeline = buildTimeline(bookings)
  const allBooked = timeline.every((b) => b.type === "booked")
  return allBooked ? "full" : "partial"
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
function AvailabilityModal({ spaceName, onClose }) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [openBooking, setOpenBooking] = useState(false)

  const monthIndex  = currentDate.getMonth()
  const year        = currentDate.getFullYear()
  const monthName   = currentDate.toLocaleString("default", { month: "long" })
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay()

  const changeMonth = (dir) => {
    const d = new Date(currentDate)
    d.setMonth(monthIndex + dir)
    setCurrentDate(d)
  }

  const roomBookings = mockApprovedByRoom[spaceName] || {}
  const dayBookings  = roomBookings[selectedDate]    || []
  const timeline     = buildTimeline(dayBookings)

  // "free" | "partial" | "full" for each date cell
  const dayStatus = (dateKey) => getDayStatus(roomBookings[dateKey])

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-2">
      <div className="bg-white w-full max-w-5xl rounded-2xl flex shadow-xl overflow-hidden">

        {/* ── LEFT: CALENDAR ── */}
        <div className="w-[62%] p-6 border-r border-gray-100">

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Space Availability</p>
              <h2 className="text-lg font-semibold text-gray-900">{monthName} {year}</h2>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => changeMonth(-1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
              >←</button>
              <button
                onClick={() => changeMonth(1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
              >→</button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
              Free
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
              Partial
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
              Full
            </span>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Offset empty cells */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1
              const dateKey = formatDateKey(year, monthIndex, day)
              const isSel   = selectedDate === dateKey
              const isToday = dateKey === todayKey()
              const status  = dayStatus(dateKey) // "free" | "partial" | "full"

              // Cell background based on status (when not selected)
              const cellBg = isSel
                ? "bg-green-700 text-white ring-2 ring-green-700 ring-offset-1"
                : status === "full"
                ? "bg-blue-50 hover:bg-blue-100 text-blue-800"
                : status === "partial"
                ? "bg-yellow-50 hover:bg-yellow-100 text-yellow-800"
                : "bg-green-50 hover:bg-green-100 text-green-700"

              // Small dot at bottom to reinforce status
              const dotColor = isSel
                ? "bg-white/70"
                : status === "full"    ? "bg-blue-400"
                : status === "partial" ? "bg-yellow-400"
                : "bg-green-400"

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  className={`
                    relative rounded-lg cursor-pointer flex flex-col items-center justify-start
                    pt-1.5 pb-1 gap-1 min-h-[44px] transition-all
                    ${cellBg}
                  `}
                >
                  <span className={`text-[12px] font-medium leading-none
                    ${isToday && !isSel ? "underline underline-offset-2" : ""}
                  `}>
                    {day}
                  </span>
                  {/* Status dot */}
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: TIMELINE ── */}
        <div className="w-full md:w-[38%] flex flex-col px-4 md:px-6 py-5 max-h-[85vh]">

          {/* Header */}
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                {spaceName}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", day: "numeric", month: "long"
                })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition text-lg leading-none mt-0.5"
            >
              ✕
            </button>
          </div>

          <div className="text-xs text-gray-400 mb-3">
            College hours: {DAY_START} – {DAY_END}
          </div>

          <div className="border-t border-gray-100 mb-3" />

          {/* Timeline blocks */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {timeline.length === 0 && (
              /* No bookings at all — entire day is free */
              <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Fully Available</p>
                  <p className="text-xs text-green-600">{DAY_START} – {DAY_END}</p>
                </div>
              </div>
            )}

            {timeline.map((block, idx) => (
              block.type === "booked" ? (
                <div
  key={idx}
  className="border border-blue-200 bg-blue-50 rounded-xl p-4 flex items-start gap-3"
>
  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1" />

  <div className="flex flex-col gap-1.5">
    <p className="text-sm font-semibold text-blue-900">
      {block.start} – {block.end}
    </p>

    <p className="text-xs text-blue-600 leading-relaxed">
      {block.title}
    </p>

    <span className="w-fit text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
      Booked
    </span>
  </div>
</div>
              ) : (
                <div
  key={idx}
  className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:bg-green-100 transition overflow-hidden"
  onClick={() => {
    setSelectedSlot(block)
    setOpenBooking(true)
  }}
>
  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-1" />

  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
    <p className="text-sm font-semibold text-green-700">
      {block.start} – {block.end}
    </p>

    <span className="w-fit text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
      Available
    </span>

    <p className="text-[11px] text-gray-400 break-words leading-tight">
      Tap to book
    </p>
  </div>
</div>
              )
            ))}
          </div>

          {/* Book button */}
          <button
  onClick={() => {
    setSelectedSlot(null)
    setOpenBooking(true)
  }}
  className="mt-4 mb-2 w-full bg-green-700 hover:bg-green-800 text-white py-3 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center"
>
  Open booking form
</button>
        </div>
      </div>

      {openBooking && (
  <BookingModal
    spaceName={spaceName}
    prefillDate={selectedDate}
    prefillStart={selectedSlot?.start || ""}
    prefillEnd={selectedSlot?.end || ""}
    onClose={() => setOpenBooking(false)}
  />
)}
    </div>
  )
}

export default AvailabilityModal