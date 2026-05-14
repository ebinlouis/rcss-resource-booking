import { useState, useEffect, useCallback, useMemo } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Package,
  Pencil,
  RefreshCcw,
  Clock,
  MapPin,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react"
import EditLoadoutModal from "../components/EditLoadoutModal"
import mediaService from "../api/mediaApi"
import { useAuth } from "../hooks/useAuth"

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

// UPDATED: Now parses a full ISO DateTime string
function formatTime(isoString) {
  if (!isoString) return "--"
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "--"
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

function isToday(dateString) {
  return dateString === todayKey()
}

// ── Timeline bar ──────────────────────────────────────────────────────────────

function TimelineBar({ booking }) {
  // UPDATED: Extracts minutes since midnight directly from the DateTime object
  const toMins = (isoString) => {
    if (!isoString) return 0;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 0;
    return d.getHours() * 60 + d.getMinutes();
  }

  const DAY_START = 7 * 60
  const DAY_END   = 22 * 60
  const SPAN      = DAY_END - DAY_START
  const clamp     = (v) => Math.max(0, Math.min(100, ((v - DAY_START) / SPAN) * 100))

  // Pass the new datetime fields to the calculator
  const setupPct    = clamp(toMins(booking.setup_start_datetime))
  const eventPct    = clamp(toMins(booking.event_start_datetime))
  const endPct      = clamp(toMins(booking.event_end_datetime))
  const teardownPct = clamp(toMins(booking.teardown_end_datetime))

  return (
    <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden mt-3">
      <div
        className="absolute top-0 h-full bg-emerald-200 rounded-full"
        style={{ left: `${setupPct}%`, width: `${eventPct - setupPct}%` }}
      />
      <div
        className="absolute top-0 h-full bg-emerald-600 rounded-full"
        style={{ left: `${eventPct}%`, width: `${endPct - eventPct}%` }}
      />
      <div
        className="absolute top-0 h-full bg-emerald-200 rounded-full"
        style={{ left: `${endPct}%`, width: `${teardownPct - endPct}%` }}
      />
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ booking, selected, onClick }) {
  const gearCount = booking.equipment_requests?.reduce((sum, req) => sum + req.quantity, 0) ?? 0

  // Safe equality check for Dates
  const hasBuffer = booking.setup_start_datetime && booking.event_start_datetime && 
    (new Date(booking.setup_start_datetime).getTime() !== new Date(booking.event_start_datetime).getTime());

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all ${
        selected
          ? "border-emerald-300 bg-emerald-50 shadow-sm ring-1 ring-emerald-200"
          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Clock className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-emerald-600" : "text-gray-400"}`} />
        <span className={`text-[12.5px] font-bold ${selected ? "text-emerald-800" : "text-gray-700"}`}>
          {formatTime(booking.event_start_datetime)} – {formatTime(booking.event_end_datetime)}
        </span>
        {hasBuffer && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Setup {formatTime(booking.setup_start_datetime)}
          </span>
        )}
      </div>

      <p className={`text-[14.5px] font-bold leading-tight truncate ${selected ? "text-emerald-900" : "text-gray-900"}`}>
        {booking.event_name}
      </p>

      <div className="mt-1.5 flex items-center gap-3">
        {booking.space_details?.name && (
          <span className="flex items-center gap-1 text-[12px] text-gray-500 truncate">
            <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
            {booking.space_details.name}
          </span>
        )}
        {gearCount > 0 && (
          <span className={`ml-auto flex items-center gap-1 text-[11px] font-bold rounded-md px-1.5 py-0.5 ${
            selected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
          }`}>
            <Package className="h-3 w-3" />
            {gearCount} item{gearCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <TimelineBar booking={booking} />
    </button>
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
              {formatTime(booking.event_start_datetime)} – {formatTime(booking.event_end_datetime)}
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
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
                    onClick={() => setSelectedId(b.id)}
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
  )
}

export default MediaSchedule