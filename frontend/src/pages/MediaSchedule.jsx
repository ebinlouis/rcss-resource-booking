import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clapperboard,
  Package,
  Pencil,
  RefreshCcw,
  Clock,
  MapPin,
  User,
  AlertCircle,
  Loader2,
  FileText,
  StickyNote,
} from "lucide-react"
import EditLoadoutModal from "../components/EditLoadoutModal"
import mediaService from "../api/mediaApi"
import { useAuth } from "../hooks/useAuth"
import MainLayout from "../layouts/MainLayout"

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dateFromKey(key) {
  return new Date(`${key}T00:00:00`)
}

function shiftDate(dateString, days) {
  const d = dateFromKey(dateString)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDate(dateString, options = {}) {
  if (!dateString) return ""
  return dateFromKey(dateString).toLocaleDateString("en-IN", options)
}

/** Formats a full ISO DateTime string → "10:00 am" */
function formatTime(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

/** Formats a full ISO DateTime string → "3 Jun, 10:00 am" (short date + time) */
function formatShortDateTime(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "--"
  const datePart = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  const timePart = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
  return `${datePart}, ${timePart}`
}

/** Formats a full ISO DateTime string → "3 Jun 2025, 10:00 am" (full date + time) */
function formatFullDateTime(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return "--"
  const datePart = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  const timePart = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
  return `${datePart}, ${timePart}`
}

function isSameDay(isoA, isoB) {
  if (!isoA || !isoB) return false
  return new Date(isoA).toDateString() === new Date(isoB).toDateString()
}

function isToday(dateString) {
  return dateString === todayKey()
}

// ── Timeline bar ──────────────────────────────────────────────────────────────

/**
 * For single-day bookings: works exactly as before (7am–10pm window).
 * For multi-day bookings: we show a full green bar with a "Multi-day" label
 * since a proportional intraday bar makes no sense across days.
 */
function TimelineBar({ booking, pageDate }) {
  const isMultiDay = !isSameDay(
    booking.event_start_datetime,
    booking.event_end_datetime
  )

  if (isMultiDay) {
    // Determine if pageDate is the start day, end day, or a middle day
    // to give a sense of where in the booking we are.
    const startKey = booking.event_start_datetime
      ? new Date(booking.event_start_datetime).toLocaleDateString("en-CA") // YYYY-MM-DD
      : null
    const endKey = booking.event_end_datetime
      ? new Date(booking.event_end_datetime).toLocaleDateString("en-CA")
      : null

    let label = "Multi-day event"
    let barColor = "bg-emerald-500"

    if (pageDate === startKey) {
      label = "Starts today"
      barColor = "bg-emerald-600"
    } else if (pageDate === endKey) {
      label = "Ends today"
      barColor = "bg-emerald-400"
    }

    return (
      <div className="mt-3 space-y-1">
        <div className={`h-2 w-full rounded-full ${barColor} opacity-70`} />
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
    )
  }

  // ── Single-day proportional bar ───────────────────────────────────────────
  const toMins = (isoString) => {
    if (!isoString) return 0
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return 0
    return d.getHours() * 60 + d.getMinutes()
  }

  const DAY_START = 7 * 60
  const DAY_END   = 22 * 60
  const SPAN      = DAY_END - DAY_START
  const clamp     = (v) => Math.max(0, Math.min(100, ((v - DAY_START) / SPAN) * 100))

  const setupPct    = clamp(toMins(booking.setup_start_datetime))
  const eventPct    = clamp(toMins(booking.event_start_datetime))
  const endPct      = clamp(toMins(booking.event_end_datetime))
  const teardownPct = clamp(toMins(booking.teardown_end_datetime))

  return (
    <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden mt-3">
      <div
        className="absolute top-0 h-full bg-emerald-200 rounded-full"
        style={{ left: `${setupPct}%`, width: `${Math.max(0, eventPct - setupPct)}%` }}
      />
      <div
        className="absolute top-0 h-full bg-emerald-600 rounded-full"
        style={{ left: `${eventPct}%`, width: `${Math.max(0, endPct - eventPct)}%` }}
      />
      <div
        className="absolute top-0 h-full bg-emerald-200 rounded-full"
        style={{ left: `${endPct}%`, width: `${Math.max(0, teardownPct - endPct)}%` }}
      />
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ booking, selected, expanded, onSelect, onToggleExpand, pageDate }) {
  const gearCount  = booking.equipment_requests?.reduce((sum, req) => sum + req.quantity, 0) ?? 0
  const multiDay   = !isSameDay(booking.event_start_datetime, booking.event_end_datetime)

  const hasBuffer =
    booking.setup_start_datetime &&
    booking.event_start_datetime &&
    new Date(booking.setup_start_datetime).getTime() !== new Date(booking.event_start_datetime).getTime()

  // Time label: multi-day gets full date+time on both ends; single-day just times
  const timeLabel = multiDay
    ? `${formatShortDateTime(booking.event_start_datetime)} – ${formatShortDateTime(booking.event_end_datetime)}`
    : `${formatTime(booking.event_start_datetime)} – ${formatTime(booking.event_end_datetime)}`

  return (
    <div
      className={`rounded-xl border transition-all ${
        selected
          ? "border-emerald-300 bg-emerald-50 shadow-sm ring-1 ring-emerald-200"
          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      {/* ── Clickable summary row ─────────────────────────────────── */}
      <button
        onClick={() => { onSelect(); onToggleExpand() }}
        className="w-full text-left px-4 py-3.5"
      >
        {/* Time row */}
        <div className="flex items-center gap-1.5 mb-1">
          <Clock className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-emerald-600" : "text-gray-400"}`} />
          <span className={`text-[12.5px] font-bold ${selected ? "text-emerald-800" : "text-gray-700"}`}>
            {timeLabel}
          </span>
          {hasBuffer && !multiDay && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Setup {formatTime(booking.setup_start_datetime)}
            </span>
          )}
          {multiDay && (
            <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ${
              selected ? "bg-emerald-200 text-emerald-800" : "bg-amber-100 text-amber-700"
            }`}>
              Multi-day
            </span>
          )}
        </div>

        {/* Event name */}
        <p className={`text-[14.5px] font-bold leading-tight truncate ${selected ? "text-emerald-900" : "text-gray-900"}`}>
          {booking.event_name}
        </p>

        {/* Meta row */}
        <div className="mt-1.5 flex items-center gap-3">
          {booking.space_details?.name && (
            <span className="flex items-center gap-1 text-[12px] text-gray-500 truncate">
              <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
              {booking.space_details.name}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {gearCount > 0 && (
              <span className={`flex items-center gap-1 text-[11px] font-bold rounded-md px-1.5 py-0.5 ${
                selected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
              }`}>
                <Package className="h-3 w-3" />
                {gearCount} item{gearCount !== 1 ? "s" : ""}
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </span>
        </div>

        <TimelineBar booking={booking} pageDate={pageDate} />
      </button>

      {/* ── Expanded detail panel ─────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3.5 space-y-3 bg-white rounded-b-xl">

          {/* Full time window */}
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            {booking.setup_start_datetime && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Setup starts</p>
                <p className="font-semibold text-gray-700">{formatFullDateTime(booking.setup_start_datetime)}</p>
              </div>
            )}
            {booking.event_start_datetime && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-0.5">Event starts</p>
                <p className="font-semibold text-emerald-800">{formatFullDateTime(booking.event_start_datetime)}</p>
              </div>
            )}
            {booking.event_end_datetime && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-0.5">Event ends</p>
                <p className="font-semibold text-emerald-800">{formatFullDateTime(booking.event_end_datetime)}</p>
              </div>
            )}
            {booking.teardown_end_datetime && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Teardown ends</p>
                <p className="font-semibold text-gray-700">{formatFullDateTime(booking.teardown_end_datetime)}</p>
              </div>
            )}
          </div>

          {/* Booked by */}
          {booking.user_details?.name && (
            <div className="flex items-center gap-2 text-[12.5px] text-gray-600">
              <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span>Booked by <span className="font-semibold text-gray-800">{booking.user_details.name}</span></span>
            </div>
          )}

          {/* Gear summary */}
          {booking.equipment_requests?.length > 0 && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1">
                <Package className="h-3 w-3" /> Gear ({gearCount} item{gearCount !== 1 ? "s" : ""})
              </p>
              <div className="space-y-1">
                {booking.equipment_requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between text-[12.5px] rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
                    <span className="text-gray-700 font-medium">{req.equipment_name}</span>
                    <span className="text-gray-500 font-bold">×{req.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {booking.requested_services && (
            <div className="flex items-start gap-2 text-[12.5px]">
              <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Services</p>
                <p className="text-gray-700">{booking.requested_services}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.user_notes && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 flex items-start gap-2">
              <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-amber-600 mb-0.5">Notes</p>
                <p className="text-[12.5px] text-amber-900">{booking.user_notes}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Loadout panel ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  AV:         "Audio / Visual",
  LIGHTING:   "Lighting",
  FURNITURE:  "Furniture",
  COMPUTING:  "Computing",
  NETWORKING: "Networking",
  OTHER:      "Other",
}

function LoadoutPanel({ booking, canEdit, onEditClick }) {
  const requests = useMemo(
    () => booking?.equipment_requests ?? [],
    [booking]
  )

  const grouped = useMemo(
    () =>
      requests.reduce((acc, req) => {
        const cat = "OTHER"
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(req)
        return acc
      }, {}),
    [requests]
  )

  const multiDay = booking
    ? !isSameDay(booking.event_start_datetime, booking.event_end_datetime)
    : false

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
        <Clapperboard className="h-10 w-10 text-gray-200 mb-4" />
        <p className="text-[15px] font-semibold text-gray-500">Select an event</p>
        <p className="mt-1 text-[13px] text-gray-400">
          Choose an event from the timeline to see its gear loadout.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700 mb-0.5">Gear Loadout</p>
          <p className="text-[15px] font-bold text-gray-900 truncate">{booking.event_name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {multiDay
                ? `${formatShortDateTime(booking.event_start_datetime)} – ${formatShortDateTime(booking.event_end_datetime)}`
                : `${formatTime(booking.event_start_datetime)} – ${formatTime(booking.event_end_datetime)}`
              }
            </span>
            {booking.space_details?.name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                {booking.space_details.name}
              </span>
            )}
            {booking.user_details?.name && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {booking.user_details.name}
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <button
            onClick={onEditClick}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Loadout
          </button>
        )}
      </div>

      {/* Gear list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <Package className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-[14px] font-semibold text-gray-500">No gear allocated</p>
            {canEdit && (
              <p className="mt-1 text-[13px] text-gray-400">
                Use <span className="font-bold text-emerald-700">Edit Loadout</span> to add equipment.
              </p>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-gray-400 mb-2">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="space-y-2">
                {items.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-[14px] font-semibold text-gray-800">
                        {req.equipment_name}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold text-gray-500">
                      ×{req.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {booking.requested_services && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-1">Services</p>
            <p className="text-[13.5px] text-gray-700">{booking.requested_services}</p>
          </div>
        )}
        {booking.user_notes && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-amber-600 mb-1">Event Notes</p>
            <p className="text-[13.5px] text-amber-900">{booking.user_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Week strip ────────────────────────────────────────────────────────────────

function WeekStrip({ selectedDate, onSelect }) {
  const weekDates = useMemo(() => {
    const base = dateFromKey(selectedDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() - 3 + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    })
  }, [selectedDate])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onSelect(shiftDate(selectedDate, -7))}
        className="flex h-[54px] w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-400 hover:bg-gray-50 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
        {weekDates.map((date) => {
          const active = date === selectedDate
          const today  = isToday(date)
          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              className={`min-w-[72px] flex-1 rounded-xl border px-2 py-2 text-left transition-all ${
                active
                  ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                  : "border-gray-100 bg-white hover:bg-gray-50"
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wide ${active ? "text-emerald-700" : "text-gray-400"}`}>
                {formatDate(date, { weekday: "short" })}
                {today && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                )}
              </p>
              <p className={`mt-0.5 text-[13px] font-bold ${active ? "text-emerald-900" : "text-gray-700"}`}>
                {formatDate(date, { day: "numeric", month: "short" })}
              </p>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onSelect(shiftDate(selectedDate, 7))}
        className="flex h-[54px] w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-400 hover:bg-gray-50 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Shared fetch logic ────────────────────────────────────────────────────────

function fetchRunsheet(date, { onStart, onSuccess, onError, onDone, signal }) {
  onStart()
  mediaService
    .getRunsheet(date)
    .then((data) => {
      if (signal?.aborted) return
      onSuccess(data)
    })
    .catch(() => {
      if (!signal?.aborted) onError()
    })
    .finally(() => {
      if (!signal?.aborted) onDone()
    })
}

// ── Page ──────────────────────────────────────────────────────────────────────

function MediaSchedule() {
  const { can_manage_media } = useAuth()

  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [bookings, setBookings]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState("")
  const [selectedId, setSelectedId]     = useState(null)
  const [expandedId, setExpandedId]     = useState(null)
  const [editTarget, setEditTarget]     = useState(null)
  const [refreshTick, setRefreshTick]   = useState(0)

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedId) ?? null,
    [bookings, selectedId]
  )

  const applyData = useCallback((data) => {
    setBookings(data)
    setError("")
    setSelectedId((prev) => {
      const stillExists = data.some((b) => b.id === prev)
      return stillExists ? prev : (data[0]?.id ?? null)
    })
    // Collapse expanded card when date changes
    setExpandedId(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchRunsheet(selectedDate, {
      signal:    controller.signal,
      onStart:   () => { setLoading(true); setError("") },
      onSuccess: applyData,
      onError:   () => setError("Could not load the run sheet. Please check your connection."),
      onDone:    () => setLoading(false),
    })
    return () => controller.abort()
  }, [selectedDate, applyData])

  useEffect(() => {
    if (refreshTick === 0) return
    const controller = new AbortController()
    fetchRunsheet(selectedDate, {
      signal:    controller.signal,
      onStart:   () => { setLoading(true); setError("") },
      onSuccess: applyData,
      onError:   () => setError("Could not load the run sheet. Please check your connection."),
      onDone:    () => setLoading(false),
    })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])

  const handleRefresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  const handleLoadoutSaved = useCallback((updatedBooking) => {
    setBookings((prev) => prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b)))
    setEditTarget(null)
  }, [])

  const handleToggleExpand = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="p-5 md:p-8">
        <div className="mx-auto w-full max-w-[1280px]">

        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-500">
              Media Team
            </p>
            <h1 className="text-[28px] font-bold leading-none tracking-tight text-gray-900">
              Team Schedule
            </h1>
            <p className="mt-2 text-[15px] text-gray-600">
              Daily agenda for all approved team-request events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDate(todayKey())}
              disabled={isToday(selectedDate)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              Today
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Date strip */}
        <div className="mb-5">
          <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        {/* Date label + event count */}
        <p className="mb-4 text-[13px] font-semibold text-gray-500">
          {isToday(selectedDate) ? "Today · " : ""}
          {formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {!loading && (
            <span className="ml-2 text-[12px] font-normal text-gray-400">
              {bookings.length === 0
                ? "No events scheduled"
                : `${bookings.length} event${bookings.length !== 1 ? "s" : ""} scheduled`}
            </span>
          )}
        </p>

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Two-pane layout */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] items-start">

          {/* Left pane: Timeline */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-emerald-700" />
                <h2 className="text-[16px] font-bold text-gray-900">Timeline</h2>
              </div>
            </div>

            <div className="p-4 space-y-2 min-h-[200px]">
              {loading ? (
                Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-[96px] animate-pulse rounded-xl bg-gray-50" />
                ))
              ) : bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                  <Clapperboard className="h-8 w-8 text-gray-200 mb-3" />
                  <p className="text-[14.5px] font-semibold text-gray-500">No team events today</p>
                  <p className="mt-1 text-[13px] text-gray-400">
                    Approved team-request bookings will appear here.
                  </p>
                </div>
              ) : (
                bookings.map((b) => (
                  <EventCard
                    key={b.id}
                    booking={b}
                    selected={b.id === selectedId}
                    expanded={b.id === expandedId}
                    pageDate={selectedDate}
                    onSelect={() => setSelectedId(b.id)}
                    onToggleExpand={() => handleToggleExpand(b.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Right pane: Loadout */}
          <aside className="rounded-2xl border border-gray-100 bg-white shadow-sm lg:sticky lg:top-6 min-h-[300px] flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : (
              <LoadoutPanel
                booking={selectedBooking}
                canEdit={!!can_manage_media}
                onEditClick={() => setEditTarget(selectedBooking)}
              />
            )}
          </aside>
        </div>
      </div>

      {editTarget && (
        <EditLoadoutModal
          booking={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleLoadoutSaved}
        />
      )}
      </div>
    </MainLayout>
  )
}

export default MediaSchedule