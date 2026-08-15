import Tooltip from "./Tooltip"
import { useState, useEffect, useRef, useCallback, memo } from "react"
import BookingModal from "./BookingModal"
import { bookingSessionActions } from "../store/bookingSessionStore"
import api from "../api/axios"
import { useNavigate } from "react-router-dom"
import { useContext } from "react"
import { AuthContext } from "../context/AuthContext"

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
    let bStart, bEnd
    if (!bk.isMultiDay) {
      bStart = toMins(bk.start)
      bEnd   = toMins(bk.end)
    } else if (!bk.isContinue) {
      bStart = toMins(bk.start)
      bEnd   = dayEnd
    } else if (bk.isLastDay) {
      bStart = dayStart
      bEnd   = toMins(bk.end)
    } else {
      bStart = dayStart
      bEnd   = dayEnd
    }

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
        bookedByPhoto: bk.bookedByPhoto,
        purpose: bk.purpose,
        subject: bk.subject,
        instructor: bk.instructor,
        isTimetable: bk.isTimetable,
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

  const dayStart = toMins(DAY_START)
  const dayEnd   = toMins(DAY_END)

  const sorted = [...bookings].sort((a, b) => toMins(a.start) - toMins(b.start))
  let cursor = dayStart
  let hasGap = false

  for (const bk of sorted) {
    let bStart, bEnd
    if (!bk.isMultiDay) {
      bStart = toMins(bk.start)
      bEnd   = toMins(bk.end)
    } else if (!bk.isContinue) {
      bStart = toMins(bk.start)
      bEnd   = dayEnd
    } else if (bk.isLastDay) {
      bStart = dayStart
      bEnd   = toMins(bk.end)
    } else {
      bStart = dayStart
      bEnd   = dayEnd
    }

    const s = Math.max(bStart, dayStart)
    const e = Math.min(bEnd,   dayEnd)
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
  const res  = await api.get(`/spaces/requests/?view=general&space=${spaceId}`)
  const data = res.data.results || res.data || []

  const grouped = {}

  data.forEach((b) => {
    if (b.status === "REJECTED") return

    if (b.is_timetable) {
      const ttStartD = new Date(b.start_datetime)
      const ttEndD   = new Date(b.end_datetime)
      const ttStartKey = formatDateKey(ttStartD.getFullYear(), ttStartD.getMonth(), ttStartD.getDate())
      const ttEndKey   = formatDateKey(ttEndD.getFullYear(), ttEndD.getMonth(), ttEndD.getDate())
      const ttStartStr = `${String(ttStartD.getHours()).padStart(2, "0")}:${String(ttStartD.getMinutes()).padStart(2, "0")}`
      const ttEndStr   = `${String(ttEndD.getHours()).padStart(2, "0")}:${String(ttEndD.getMinutes()).padStart(2, "0")}`

      const MAX_SPAN = 366
      let ttCursor = ttStartKey
      let ttIterations = 0
      while (ttCursor <= ttEndKey && ttIterations < MAX_SPAN) {
        if (!grouped[ttCursor]) grouped[ttCursor] = []
        grouped[ttCursor].push({
          start: ttStartStr,
          end:   ttEndStr,
          title: b.subject || b.purpose_of_booking || "Class Timetable",
          status: "APPROVED",
          isMultiDay: ttStartKey !== ttEndKey,
          isContinue: ttCursor !== ttStartKey,
          isLastDay: ttCursor === ttEndKey && ttCursor !== ttStartKey,
          bookedByName: b.booked_by_name,
          bookedByDesignation: b.booked_by_designation,
          bookedByDepartment: b.booked_by_department,
          bookedByPhone: b.booked_by_phone || "",
          bookedByPhoto: b.booked_by_photo || "",
          purpose: b.subject || b.purpose_of_booking,
          subject: b.subject,
          instructor: b.instructor,
          isTimetable: true,
        })
        if (ttCursor === ttEndKey) break
        ttCursor = nextDateKey(ttCursor)
        ttIterations++
      }
      return
    }

    const startD   = new Date(b.start_datetime)
    const endD     = new Date(b.end_datetime)
    const startKey = formatDateKey(startD.getFullYear(), startD.getMonth(), startD.getDate())
    const endKey   = formatDateKey(endD.getFullYear(), endD.getMonth(), endD.getDate())
    const isMultiDay = startKey !== endKey

    const startStr = `${String(startD.getHours()).padStart(2, "0")}:${String(startD.getMinutes()).padStart(2, "0")}`
    const endStr   = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`

    const MAX_SPAN = 366
    let cursor = startKey
    let iterations = 0
    while (cursor <= endKey && iterations < MAX_SPAN) {
      if (!grouped[cursor]) grouped[cursor] = []

      grouped[cursor].push({
        start: startStr,
        end: endStr,
        title: b.subject || b.purpose_of_booking || "Booked Event",
        status: b.status,
        isMultiDay,
        isContinue: cursor !== startKey,
        isLastDay: cursor === endKey && cursor !== startKey,
        bookingType: b.booking_type || "SINGLE",
        bookedByName: b.booked_by_name,
        bookedByDesignation: b.booked_by_designation,
        bookedByDepartment: b.booked_by_department,
        bookedByPhone: b.booked_by_phone,
        bookedByPhoto: b.booked_by_photo,
        purpose: b.subject || b.purpose_of_booking,
        subject: b.subject,
        instructor: b.instructor,
        isTimetable: false,
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
const AvailabilityModal = memo(function AvailabilityModal({
  spaceId,
  spaceName,
  onClose,
  openBookingOnMount = false,
  onLinkedIntent,
  initialDate = null,
}) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [currentDate,  setCurrentDate]  = useState(initialDate ? new Date(initialDate + "T00:00:00") : new Date())
  const [selectedDate, setSelectedDate] = useState(initialDate || todayKey())
  const [openBooking,  setOpenBooking]  = useState(false)
  
  // Tracks whether BookingModal was opened as a blank standalone form.
  // When true, BookingModal ignores session draft dates and prefill props entirely.
  const [isStandalone, setIsStandalone] = useState(false)
  
  const [roomBookings, setRoomBookings] = useState({})
  const [isLoading,    setIsLoading]    = useState(true)
  const [activeTooltip, setActiveTooltip] = useState(null)
  const didOpenBookingOnMount = useRef(false)

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
        console.error("Failed to load venue bookings:", err)
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
      console.error("Failed to reload venue bookings:", err)
    } finally {
      setIsLoading(false)
    }
  }, [spaceId])


  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const refreshRef = useRef(refresh)
  const tooltipRef = useRef(null)
  useEffect(() => { refreshRef.current = refresh }, [refresh])
  
  useEffect(() => {
    const handler = () => refreshRef.current?.()
    window.addEventListener('timetable-updated', handler)
    return () => window.removeEventListener('timetable-updated', handler)
  }, [])
  
  // Resume from wizard: prefill is allowed, not standalone
  useEffect(() => {
    if (!openBookingOnMount || didOpenBookingOnMount.current) return
    didOpenBookingOnMount.current = true
    setIsStandalone(false)
    setOpenBooking(true)
  }, [openBookingOnMount])

  useEffect(() => {
  function handleClickOutside(e) {
    if (!activeTooltip) return

    if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
      setActiveTooltip(null)
    }
  }

  document.addEventListener("click", handleClickOutside)

  return () => {
    document.removeEventListener("click", handleClickOutside)
  }
}, [activeTooltip])

  const handleCloseBooking = useCallback(() => {
    setOpenBooking(false)
    setIsStandalone(false)
    bookingSessionActions.clearSession()
    refreshRef.current()
  }, [])

  const handleLinkedIntent = useCallback((target) => {
    setOpenBooking(false)
    setIsStandalone(false)
    onLinkedIntent?.(target)
  }, [onLinkedIntent])

  const dayBookings = roomBookings[selectedDate] || []
  const timeline    = buildTimeline(dayBookings)
  const dayStatus = (dateKey) => {
    const today = todayKey()
    if (dateKey < today) return "past"
    return getDayStatus(roomBookings[dateKey])
  }
  
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-2 md:px-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl flex flex-col md:flex-row shadow-xl overflow-hidden max-h-[92vh]">
        {/* ── LEFT: CALENDAR ── */}
        <div className="w-full md:w-[68%] p-4 md:p-6 border-b md:border-b-0 md:border-r border-gray-100 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
<div>
  <div className="flex items-center gap-2">
    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
      Availability Calendar
    </p>

    <Tooltip
      text="Green = fully available, Yellow = partially booked, Blue = fully booked, Grey = past dates. Click a date to view time slots."
      position="right"
    >
      <button
        type="button"
        className="w-5 h-5 rounded-full border border-gray-300 text-gray-500 text-xs flex items-center justify-center hover:bg-gray-100 transition"
      >
        i
      </button>
    </Tooltip>
  </div>

  <h2 className="text-lg font-semibold text-gray-900">
    {monthName} {year}
  </h2>
</div>
            <div className="flex gap-1">
              <Tooltip text="View the previous month." position="top">
                <button
                  onClick={() => changeMonth(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
                >←</button>
              </Tooltip>
              <Tooltip text="View the next month." position="top">
                <button
                  onClick={() => changeMonth(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
                >→</button>
              </Tooltip>
            </div>
          </div>

          <div className="flex gap-2 md:gap-4 mb-3 text-[10px] md:text-xs flex-wrap">
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
                  className={`relative rounded-lg cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[42px] md:min-h-[64px] transition-all ${cellBg}`}
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
        <div className="w-full md:w-[32%] flex flex-col px-4 py-4 md:py-5 max-h-[45vh] md:max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-1">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">{spaceName}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </p>
            </div>
            <Tooltip text="Close this calendar and go back." position="left">
              <button onClick={() => { bookingSessionActions.clearSession(); onClose(); }} className="text-gray-400 hover:text-gray-600 transition text-lg leading-none mt-0.5">
                ✕
              </button>
            </Tooltip>
          </div>

          <div className="text-xs text-gray-400 mb-3">
            Booking hours: {DAY_START} – {DAY_END}
          </div>

          <div className="border-t border-gray-100 mb-3" />

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <p className="text-sm text-center text-gray-400 mt-10 animate-pulse">Checking availability...</p>
            ) : timeline.length === 0 ? (
              <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Available All Day</p>
                  <p className="text-xs text-green-600">{DAY_START} – {DAY_END}</p>
                </div>
              </div>
            ) : (
              timeline.map((block, idx) => {
                if (block.type === "booked") {
                  const isPending = ["PENDING", "AWAITING_FACULTY", "FACULTY_ESCALATED"].includes(block.status)
                  const timeLabel = block.isMultiDay ? null : `${block.start} – ${block.end}`
const titleLabel = block.isMultiDay
  ? block.bookingType === "RECURRING"
    ? block.isContinue
      ? "Multiple College Hours (Continues)"
      : "Multiple College Hours"
    : block.isContinue
      ? "24-Hour Reservation (Continues)"
      : "24-Hour Reservation"
  : block.title

return (
  <div
    key={idx}
onClick={(e) => {
  e.stopPropagation()

  const rect = e.currentTarget.getBoundingClientRect()
  const isMobile = window.innerWidth < 768

  let left
  let top

  if (isMobile) {
    left = 16
    top = 80
  } else {
    const tooltipWidth = 300
    const spacing = 16

    left = rect.left - tooltipWidth - spacing
    top = rect.top

    if (left < 20) {
      left = rect.right + spacing
    }

    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 20
    }

    if (top + 340 > window.innerHeight) {
      top = window.innerHeight - 360
    }
  }

  setActiveTooltip({
    booking: block,
    isPending,
    left,
    top,
  })
}}
    className={`border rounded-xl p-2.5 md:p-3 flex flex-col gap-2 cursor-pointer transition-all ${
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
        {isPending ? "Awaiting Approval" : "Booked"}
      </span>
    </div>
  </div>
)
                }

                // Free slot — clicking prefills the booking form with the slot's time
                return (
                  <div
                    key={idx}
                    className="border border-green-200 bg-green-50 rounded-xl p-3 flex items-start gap-3 cursor-pointer hover:bg-green-100 transition overflow-hidden"
                    onClick={() => {
                      if (!user) {
  navigate("/login", {
  state: { from: window.location.pathname }
})
  return
}
                      setSelectedSlot(block)
                      setIsStandalone(false) // Prefill allowed: date + slot times flow through
                      setOpenBooking(true)
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-1" />
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-700">{block.start} – {block.end}</p>
                      <span className="w-fit text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                      <p className="text-[11px] text-gray-400 break-words leading-tight">Select to book</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

<Tooltip
  text="Start a new booking for this venue."
  position="top"
>
  <button
onClick={() => {
  if (!user) {
    navigate("/login", {
  state: { from: window.location.pathname }
})
    return
  }

  setSelectedSlot(null)
  bookingSessionActions.clearSession()
  setIsStandalone(true)
  setOpenBooking(true)
}}
    className="mt-4 mb-2 w-full bg-green-700 hover:bg-green-800 text-white py-3 px-4 rounded-xl text-sm font-medium transition flex items-center justify-center"
  >
    Book This Venue
  </button>
</Tooltip></div>
      </div>
      
{activeTooltip && (
  <div
    ref={tooltipRef}
    onClick={(e) => e.stopPropagation()}
    className="fixed z-[9999] w-[300px] max-w-[90vw] bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden"
    style={{
  left: activeTooltip.left,
  top: activeTooltip.top,
}}
  >
    {/* Header */}
    <div className="px-4 py-3 bg-green-50 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-green-100 overflow-hidden shrink-0">
          {activeTooltip.booking.bookedByPhoto ? (
            <img
              src={activeTooltip.booking.bookedByPhoto}
              alt={activeTooltip.booking.bookedByName || "User"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-green-700 font-bold">
              {(activeTooltip.booking.bookedByName || "?")[0].toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold text-gray-900 truncate">
            {activeTooltip.booking.bookedByName || "Unavailable"}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {activeTooltip.booking.bookedByDesignation || "Faculty"}
          </p>
        </div>

        <button
          onClick={() => setActiveTooltip(null)}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-white/70 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    {/* Body */}
    <div className="px-4 py-4 space-y-4">
<div className="grid grid-cols-1 gap-y-3 text-sm">
<div>
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
    Department
  </p>
  <p className="text-sm text-gray-800 font-medium leading-snug">
    {activeTooltip.booking.bookedByDepartment || "Unavailable"}
  </p>
</div>

<div>
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
    Phone
  </p>
</div>{user ? (
          <span className="text-gray-800 font-medium">
            {activeTooltip.booking.bookedByPhone || "Unavailable"}
          </span>
        ) : (
          <button
            onClick={() =>
              navigate("/login", {
                state: { from: window.location.pathname },
              })
            }
            className="text-green-700 font-semibold hover:underline text-left"
          >
            Sign in to view contact details
          </button>
        )}
      </div>

      {/* Subject / Purpose */}
      <div className="rounded-xl bg-gray-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
          {activeTooltip.booking.isTimetable ? "Subject" : "Purpose"}
        </p>
        <p className="text-sm text-gray-800 break-words">
          {activeTooltip.booking.subject || activeTooltip.booking.purpose || "Unavailable"}
        </p>
      </div>

      {/* Instructor */}
      {activeTooltip.booking.isTimetable && activeTooltip.booking.instructor && (
        <div className="rounded-xl bg-gray-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Instructor
          </p>
          <p className="text-sm text-gray-800 break-words">
            {activeTooltip.booking.instructor}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold ${
            activeTooltip.isPending
              ? "bg-yellow-100 text-yellow-800"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
          {activeTooltip.isPending ? "Pending" : "Booked"}
        </span>

        {activeTooltip.booking.bookedByPhone && user && (
          <a
            href={`tel:${activeTooltip.booking.bookedByPhone}`}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            Call
          </a>
        )}
      </div>
    </div>
  </div>
)}

      {openBooking && (
        <BookingModal
          key={`${isStandalone}-${selectedSlot?.start ?? "none"}-${selectedDate}`}
          spaceId={spaceId}
          spaceName={spaceName}
          isStandalone={isStandalone}
          prefillDate={isStandalone ? "" : selectedDate}
          prefillStart={isStandalone ? "" : (selectedSlot?.start || "")}
          prefillEnd={isStandalone ? "" : (selectedSlot?.end   || "")}
          onClose={handleCloseBooking}
          onLinkedIntent={handleLinkedIntent}
        />
      )}
    </div>
  )
})

export default AvailabilityModal