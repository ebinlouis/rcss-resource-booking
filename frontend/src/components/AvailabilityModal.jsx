import { useState, useEffect, useRef, useCallback, memo } from "react"
import BookingModal from "./BookingModal"
import api from "../api/axios"

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

function buildTimeline(bookings) {
  const dayStart = toMins(DAY_START)
  const dayEnd   = toMins(DAY_END)

  const sorted = [...bookings].sort((a, b) => toMins(a.start) - toMins(b.start))

  const blocks = []
  let cursor = dayStart

  for (const bk of sorted) {
    // Multi-day blocks occupy the whole day
    const bStart = bk.isMultiDay ? dayStart : toMins(bk.start)
    const bEnd   = bk.isMultiDay ? dayEnd   : toMins(bk.end)

    const s = Math.max(bStart, dayStart)
    const e = Math.min(bEnd,   dayEnd)

    if (s > cursor) {
      blocks.push({ type: "free", start: toTime(cursor), end: toTime(s) })
    }

    if (e > s) {
blocks.push({
  type: "booked",
  start: toTime(s),
  end: toTime(e),
  title: bk.title,
  status: bk.status,
  isMultiDay: bk.isMultiDay || false,
  isContinue: bk.isContinue || false,

  bookedByName: bk.bookedByName,
  bookedByDesignation: bk.bookedByDesignation,
  bookedByDepartment: bk.bookedByDepartment,
  bookedByPhone: bk.bookedByPhone,
  purpose: bk.purpose,
})
    }

    cursor = Math.max(cursor, e)
  }

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

// Advance a YYYY-MM-DD string by one calendar day
const nextDateKey = (dateKey) => {
  const d = new Date(dateKey + "T00:00:00")
  d.setDate(d.getDate() + 1)
  return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate())
}

function getDayStatus(bookings) {
  if (!bookings || bookings.length === 0) return "free"

  // Use actual booking hours (not the forced full-day expansion used by
  // buildTimeline for conflict purposes) so a multi-day booking that only
  // covers e.g. 10:00–13:00 shows yellow (partial) on every spanned day,
  // not blue (full).
  const dayStart = toMins(DAY_START)
  const dayEnd   = toMins(DAY_END)

  const sorted = [...bookings].sort((a, b) => toMins(a.start) - toMins(b.start))
  let cursor = dayStart
  let hasGap = false

  for (const bk of sorted) {
    const s = Math.max(toMins(bk.start), dayStart)
    const e = Math.min(toMins(bk.end),   dayEnd)
    if (s > cursor) { hasGap = true; break }
    if (e > cursor)  cursor = e
  }

  if (cursor < dayEnd) hasGap = true
  return hasGap ? "partial" : "full"
}

// ─────────────────────────────────────────────
// HELPERS — shared fetch logic
// ─────────────────────────────────────────────
async function loadBookings(spaceId) {
  const res  = await api.get("/spaces/requests/?view=general")
  const data = res.data.results || res.data || []

  const grouped = {}

  data.forEach((b) => {
    if ((b.space !== spaceId && b.space?.id !== spaceId) || b.status === "REJECTED") return

    const startD    = new Date(b.start_datetime)
    const endD      = new Date(b.end_datetime)
    const startKey  = formatDateKey(startD.getFullYear(), startD.getMonth(), startD.getDate())
    const endKey    = formatDateKey(endD.getFullYear(), endD.getMonth(), endD.getDate())
    const isMultiDay = startKey !== endKey

    const startStr = `${String(startD.getHours()).padStart(2, "0")}:${String(startD.getMinutes()).padStart(2, "0")}`
    const endStr   = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`

    // Walk every calendar day the booking spans and register it.
    // Cap at 366 days to guard against corrupt end_datetime values.
    const MAX_SPAN = 366
    let cursor = startKey
    let iterations = 0
    while (cursor <= endKey && iterations < MAX_SPAN) {
      if (!grouped[cursor]) grouped[cursor] = []

      const isContinue = cursor !== startKey // not the first day

grouped[cursor].push({
  start: startStr,
  end: endStr,
  title: b.purpose_of_booking || "Booked Event",
  status: b.status,
  isMultiDay: isMultiDay,
  isContinue: isContinue,

  bookedByName: b.booked_by_name,
  bookedByDesignation: b.booked_by_designation,
  bookedByDepartment: b.booked_by_department,
  bookedByPhone: b.booked_by_phone,
  purpose: b.purpose_of_booking,
})

      if (cursor === endKey) break
      cursor = nextDateKey(cursor)
      iterations++
    }
  })

  return grouped
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
const AvailabilityModal = memo(function AvailabilityModal({ spaceId, spaceName, onClose }) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [currentDate,  setCurrentDate]  = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [openBooking,  setOpenBooking]  = useState(false)
  const [roomBookings, setRoomBookings] = useState({})
  const [isLoading,    setIsLoading]    = useState(true)
  const [activeTooltip, setActiveTooltip] = useState(null)

  const monthIndex     = currentDate.getMonth()
  const year           = currentDate.getFullYear()
  const monthName      = currentDate.toLocaleString("default", { month: "long" })
  const daysInMonth    = new Date(year, monthIndex + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay()

  const changeMonth = (dir) => {
    const d = new Date(currentDate)
    d.setMonth(monthIndex + dir)
    setCurrentDate(d)
  }

  useEffect(() => {
    if (!spaceId) return
    let cancelled = false

    async function load() {
      try {
        const grouped = await loadBookings(spaceId)
        if (!cancelled) setRoomBookings(grouped)
      } catch (err) {
        console.error("Failed to load space bookings:", err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [spaceId])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const grouped = await loadBookings(spaceId)
      setRoomBookings(grouped)
    } catch (err) {
      console.error("Failed to reload space bookings:", err)
    } finally {
      setIsLoading(false)
    }
  }, [spaceId])

  const refreshRef = useRef(refresh)
  const tooltipRef = useRef(null)
  useEffect(() => { refreshRef.current = refresh }, [refresh])
  useEffect(() => {
  function handleClickOutside(e) {
    if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
      setActiveTooltip(null)
    }
  }

  document.addEventListener("mousedown", handleClickOutside)

  return () => {
    document.removeEventListener("mousedown", handleClickOutside)
  }
}, [])

  const handleCloseBooking = useCallback(() => {
    setOpenBooking(false)
    refreshRef.current()
  }, [])

  const dayBookings = roomBookings[selectedDate] || []
  const timeline    = buildTimeline(dayBookings)
const dayStatus = (dateKey) => {
  const today = todayKey()

  if (dateKey < today) return "past"

  return getDayStatus(roomBookings[dateKey])
}
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-2">
      <div className="bg-white w-full max-w-5xl rounded-2xl flex shadow-xl overflow-hidden">
        {/* ── LEFT: CALENDAR ── */}
        <div className="w-[68%] p-6 border-r border-gray-100">
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

          <div className="flex gap-4 mb-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Free
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Partial
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Full
            </span>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 flex-1 content-start">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day     = i + 1
              const dateKey = formatDateKey(year, monthIndex, day)
              const isSel   = selectedDate === dateKey
              const isToday = dateKey === todayKey()
              const status  = dayStatus(dateKey)

const cellBg = isSel
  ? "bg-green-700 text-white ring-2 ring-green-700 ring-offset-1"
  : status === "past"
  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
  : status === "full"
  ? "bg-blue-50 hover:bg-blue-100 text-blue-800"
  : status === "partial"
  ? "bg-yellow-50 hover:bg-yellow-100 text-yellow-800"
  : "bg-green-50 hover:bg-green-100 text-green-700"

const dotColor = isSel
  ? "bg-white/70"
  : status === "past"
  ? "bg-gray-300"
  : status === "full"
  ? "bg-blue-400"
  : status === "partial"
  ? "bg-yellow-400"
  : "bg-green-400"

              return (
                <div
                  key={day}
                  onClick={() => {
  if (status === "past") return
  setSelectedDate(dateKey)
}}
                  className={`relative rounded-lg cursor-pointer flex flex-col items-center justify-start pt-1.5 pb-1 gap-1 min-h-[64px] transition-all ${cellBg}`}
                >
                  <span className={`text-[12px] font-medium leading-none ${isToday && !isSel ? "underline underline-offset-2" : ""}`}>
                    {day}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                </div>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: TIMELINE ── */}
        <div className="w-full md:w-[32%] flex flex-col px-4 py-5 max-h-[85vh]">
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">{spaceName}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition text-lg leading-none mt-0.5">
              ✕
            </button>
          </div>

          <div className="text-xs text-gray-400 mb-3">
            College hours: {DAY_START} – {DAY_END}
          </div>

          <div className="border-t border-gray-100 mb-3" />

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <p className="text-sm text-center text-gray-400 mt-10 animate-pulse">Syncing calendar...</p>
            ) : timeline.length === 0 ? (
              <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Fully Available</p>
                  <p className="text-xs text-green-600">{DAY_START} – {DAY_END}</p>
                </div>
              </div>
            ) : (
              timeline.map((block, idx) => {
                if (block.type === "booked") {
                  const isPending = block.status === "PENDING"

                  // Multi-day block gets a special label; single-day shows times normally
                  const timeLabel = block.isMultiDay
                    ? null
                    : `${block.start} – ${block.end}`

                  const titleLabel = block.isMultiDay
                    ? block.isContinue
                      ? "Multi-day booking (continues)"
                      : "Multi-day booking"
                    : block.title

return (
<div
  key={idx}
onClick={(e) => {
  e.stopPropagation()

  const rect = e.currentTarget.getBoundingClientRect()

  const tooltipWidth = 320
  const spacing = 16

  let left = rect.left - tooltipWidth - spacing
  let top = rect.top

  if (left < 20) {
    left = rect.right + spacing
  }

  if (top + 320 > window.innerHeight) {
    top = window.innerHeight - 340
  }

  setActiveTooltip({
    booking: block,
    isPending,
    left,
    top,
  })
}}
  className={`border rounded-xl p-3 flex flex-col gap-3 cursor-pointer transition-all ${
                        isPending
                          ? "border-yellow-200 bg-yellow-50"
                          : "border-blue-200 bg-blue-50"
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                          isPending ? "bg-yellow-500" : "bg-blue-500"
                        }`}
                      />
                      <div className="relative flex flex-col gap-1.5">
                        {timeLabel && (
                          <p
                            className={`text-sm font-semibold ${
                              isPending ? "text-yellow-900" : "text-blue-900"
                            }`}
                          >
                            {timeLabel}
                          </p>
                        )}
                        <p
                          className={`text-xs leading-relaxed ${
                            isPending ? "text-yellow-600" : "text-blue-600"
                          }`}
                        >
                          {titleLabel}
                        </p>
                        <span
                          className={`w-fit text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            isPending
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isPending ? "Pending Approval" : "Booked"}
                        </span>

                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={idx}
                    className="border border-green-200 bg-green-50 rounded-xl p-3 flex items-start gap-3 cursor-pointer hover:bg-green-100 transition overflow-hidden"
                    onClick={() => { setSelectedSlot(block); setOpenBooking(true) }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-1" />
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-700">{block.start} – {block.end}</p>
                      <span className="w-fit text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Available
                      </span>
                      <p className="text-[11px] text-gray-400 break-words leading-tight">Tap to book</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            onClick={() => { setSelectedSlot(null); setOpenBooking(true) }}
            className="mt-4 mb-2 w-full bg-green-700 hover:bg-green-800 text-white py-3 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center"
          >
            Open booking form
          </button>
        </div>
      </div>
      {activeTooltip && (
  <div
    ref={tooltipRef}
    className="fixed z-[9999] w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4"
    style={{
      left: activeTooltip.left,
      top: activeTooltip.top,
    }}
  >
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold text-gray-900">
          {activeTooltip.booking.bookedByName || "Unavailable"}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {activeTooltip.booking.bookedByDesignation || "Faculty"}
        </p>
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Department</span>
          <span className="font-medium text-gray-800">
            {activeTooltip.booking.bookedByDepartment || "Unavailable"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Phone</span>
          <span className="font-medium text-gray-800">
            {activeTooltip.booking.bookedByPhone || "Unavailable"}
          </span>
        </div>

        <div>
          <span className="text-gray-500">Purpose</span>
          <p className="font-medium text-gray-800 mt-1">
            {activeTooltip.booking.purpose || "Unavailable"}
          </p>
        </div>

        <div>
          <span
            className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
              activeTooltip.isPending
                ? "bg-yellow-100 text-yellow-800"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {activeTooltip.isPending ? "Pending Approval" : "Booked"}
          </span>
        </div>
      </div>

      {activeTooltip.booking.bookedByPhone && (
        <a
          href={`tel:${activeTooltip.booking.bookedByPhone}`}
          className="w-full inline-flex justify-center rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 transition"
        >
          Call Contact
        </a>
      )}
    </div>
  </div>
)}

      {openBooking && (
        <BookingModal
          spaceId={spaceId}
          spaceName={spaceName}
          prefillDate={selectedDate}
          prefillStart={selectedSlot?.start || ""}
          prefillEnd={selectedSlot?.end   || ""}
          onClose={handleCloseBooking}
        />
      )}
    </div>
  )
})

export default AvailabilityModal