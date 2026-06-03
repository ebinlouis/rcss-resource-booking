import { useState, useEffect } from "react"
import { useAuth } from "../hooks/useAuth"
import { useNavigate, useLocation } from "react-router-dom"
import { createPortal } from "react-dom"
import api from "../api/axios"

const todayKey = () => new Date().toISOString().split("T")[0]

/* ================= CANCEL MODALS ================= */

function CancelConfirmModal({ booking, onConfirm, onClose, isCancelling }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107
                 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244
                 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1">Cancel Booking?</h2>
        <p className="text-sm text-gray-500 mb-1">You're about to cancel your booking for</p>
        <p className="text-sm font-semibold text-gray-800 mb-0.5">{booking.hall}</p>
        <p className="text-xs text-gray-400 mb-4">{booking.title} • {booking.duration}</p>
        <p className="text-xs text-red-400 mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Keep booking
          </button>
          <button
            onClick={onConfirm}
            disabled={isCancelling}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-70 flex justify-center items-center transition"
          >
            {isCancelling ? "Cancelling..." : "Yes, cancel it"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CancelSuccessModal({ booking, onClose }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-bold text-gray-900 text-sm">Booking Cancelled</h2>
        <p className="text-xs text-gray-500 mt-1">{booking.hall}</p>
        <button
          onClick={onClose}
          className="mt-4 bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition hover:bg-green-800"
        >
          Done
        </button>
      </div>
    </div>,
    document.body
  )
}

/* ================= DETAIL SIDE PANEL ================= */

function BookingDetailPanel({ booking, onClose, user, onLoginRedirect }) {
  if (!booking) return null

  const raw = booking.raw

  const statusStyles = {
    confirmed: "bg-green-100 text-green-700",
    pending:   "bg-yellow-100 text-yellow-700",
    rejected:  "bg-red-100 text-red-700",
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">{booking.hall}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Status + Purpose */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Booking Info</h3>
              <span className={`text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-md ${statusStyles[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                {booking.status}
              </span>
            </div>

            <p className="text-base font-semibold text-gray-900 mb-4 leading-snug">
              {booking.title}
            </p>

            {(() => {
              const startDt = new Date(booking.raw.start_datetime)
              const endDt   = new Date(booking.raw.end_datetime)
              const fmtDate = (d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              const fmtTime = (d) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
              return (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">From</p>
                      <p className="font-semibold text-gray-800 text-sm">{fmtDate(startDt)}</p>
                      <p className="text-green-700 font-medium text-xs mt-0.5">{fmtTime(startDt)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">To</p>
                      <p className="font-semibold text-gray-800 text-sm">{fmtDate(endDt)}</p>
                      <p className="text-green-700 font-medium text-xs mt-0.5">{fmtTime(endDt)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1 text-xs">Venue</p>
                    <p className="font-medium text-gray-800">{booking.hall}</p>
                  </div>
                </div>
              )
            })()}
          </section>

          <hr className="border-gray-100" />

          {/* Booked by */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Booked By</h3>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {raw.booked_by_photo ? (
                  <img
                    src={raw.booked_by_photo}
                    alt={raw.booked_by_name || "User"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-green-700 font-bold text-sm">
                    {(raw.booked_by_name || "?")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {raw.booked_by_name || "Unavailable"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {raw.booked_by_designation || "—"}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-400 text-xs">Department</span>
                <span className="font-medium text-gray-800 text-right">
                  {raw.booked_by_department || "Unavailable"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-400 text-xs">Phone</span>
                {user ? (
                  <span className="font-medium text-gray-800">
                    {raw.booked_by_phone || "Unavailable"}
                  </span>
                ) : (
                  <button
                    onClick={onLoginRedirect}
                    className="text-xs text-green-700 font-semibold hover:underline"
                  >
                    Sign in to view
                  </button>
                )}
              </div>
            </div>
          </section>

        </div>

        {/* Footer CTA */}
        {raw.booked_by_phone && user && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <a
              href={`tel:${raw.booked_by_phone}`}
              className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
              </svg>
              Call Contact
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ================= STATUS CONFIG ================= */

const STATUS_STYLES = {
  confirmed: {
    row:   "bg-green-50/100",
    badge: "bg-green-100 text-green-700",
    dot:   "bg-green-500",
  },
  pending: {
    row:   "bg-yellow-50/100",
    badge: "bg-yellow-100 text-yellow-700",
    dot:   "bg-yellow-500",
  },
  rejected: {
    row:   "bg-red-50/100",
    badge: "bg-red-100 text-red-700",
    dot:   "bg-red-500",
  },
}

/* ================= MAIN ================= */

function TodayBookings() {
  const [selectedDate, setSelectedDate]     = useState(todayKey())
  const [dbBookings, setDbBookings]         = useState([])
  const [isLoading, setIsLoading]           = useState(true)
  const [requestBooking, setRequestBooking] = useState(null)
  const [requestSent, setRequestSent]       = useState(null)
  const [detailBooking, setDetailBooking]   = useState(null)
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const isToday    = selectedDate === todayKey()

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      try {
        const res  = await api.get("/spaces/requests/?view=general")
        const data = res.data.results ?? res.data ?? []
        if (!cancelled) setDbBookings(data)
      } catch (error) {
        console.error("Failed to fetch bookings:", error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const formatTime = (dateObj) =>
    dateObj.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })

  const statusMap = { APPROVED: "confirmed", PENDING: "pending", REJECTED: "rejected" }

  // Group recurring-daily bookings by group_id so they appear as one row
  // spanning their full date range. Single bookings pass through as-is.
  const consolidatedBookings = (() => {
    const groups = {}
    const singles = []

    dbBookings.forEach((b) => {
      if (b.booking_type === "RECURRING" && b.group_id) {
        if (!groups[b.group_id]) groups[b.group_id] = []
        groups[b.group_id].push(b)
      } else {
        singles.push(b)
      }
    })

    const groupRows = Object.values(groups).map((rows) => {
      const sorted    = [...rows].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
      const first     = sorted[0]
      const last      = sorted[sorted.length - 1]
      // Represent the group as the first row but with a virtual end_datetime
      // spanning to the last day's end
      return { ...first, _groupEnd: last.end_datetime, _groupSize: rows.length }
    })

    return [...singles, ...groupRows]
  })()

  const allActiveBookings = consolidatedBookings
    .filter((b) => {
      const startKey = b.start_datetime.split("T")[0]
      const endKey   = (b._groupEnd ?? b.end_datetime).split("T")[0]
      return startKey <= selectedDate && selectedDate <= endKey
    })
    .map((b) => {
      const startD     = new Date(b.start_datetime)
      const endD       = new Date(b._groupEnd ?? b.end_datetime)
      const startKey   = b.start_datetime.split("T")[0]
      const endKey     = (b._groupEnd ?? b.end_datetime).split("T")[0]
      const isMultiDay = startKey !== endKey
      const isContinue = isMultiDay && startKey !== selectedDate
      const fmtDate    = (k) => new Date(k + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      return {
        id:          b.id,
        time:        formatTime(startD),
        hall:        b.space_details?.name ?? "Unknown Venue",
        title:       b.purpose_of_booking,
        duration:    isMultiDay
          ? `${fmtDate(startKey)} – ${fmtDate(endKey)}`
          : `${formatTime(startD)} – ${formatTime(endD)}`,
        isMultiDay,
        isContinue,
        status:      statusMap[b.status] ?? "pending",
        canModify:   b.can_modify,
        raw:         { ...b, end_datetime: b._groupEnd ?? b.end_datetime },
      }
    })

  const [showAll, setShowAll] = useState(false)

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value)
    setShowAll(false)
  }

  const activeBookings = showAll ? allActiveBookings : allActiveBookings.slice(0, 3)
  const hasMore        = allActiveBookings.length > 3

  const handleRequestConfirm = async () => {
    setRequestSent(requestBooking)
    setRequestBooking(null)
  }

  return (
    <>
      <div className="mt-4">
        <div className="relative flex flex-col w-full overflow-hidden rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_12px_50px_rgba(0,0,0,0.08)]">

          {/* HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 pt-6 pb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isToday ? "Today's bookings" : `Bookings for ${formattedDate}`}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Campus-wide confirmed and pending reservations
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white/80 backdrop-blur-md shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {!isToday && (
                <button
                  onClick={() => { setSelectedDate(todayKey()); setShowAll(false) }}
                  className="text-xs text-emerald-700 font-medium hover:underline whitespace-nowrap"
                >
                  Back to today
                </button>
              )}
            </div>
          </div>

          {/* TABLE HEADER */}
          <div className="hidden md:grid grid-cols-12 px-8 py-3 bg-gradient-to-r from-gray-50 to-white border-y border-gray-100/80 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <div className="col-span-2 pl-6">Time</div>
            <div className="col-span-5 pl-2">Venue & Purpose</div>
            <div className="col-span-3 text-center">Duration</div>
            <div className="col-span-2 text-center">Status</div>
          </div>

          {/* ROWS */}
          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="px-8 py-10 text-center text-sm text-gray-400 animate-pulse">
                Loading bookings...
              </div>
            ) : allActiveBookings.length === 0 ? (
              <div className="px-8 py-10 text-center text-sm text-gray-400">
                No bookings for this date.
              </div>
            ) : (
              activeBookings.map((b) => {
                const styles = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                return (
                  <div
                    key={b.id}
                    onClick={() => setDetailBooking(b)}
                    className={`grid grid-cols-12 px-8 py-5 items-center group hover:bg-gray-50/80 transition-colors cursor-pointer ${styles.row}`}
                  >
                    {/* TIME */}
                    <div className="col-span-4 md:col-span-2 pl-6">
                      <span className="text-sm font-bold text-gray-800 tabular-nums">{b.time}</span>
                    </div>

                    {/* SPACE + PURPOSE */}
                    <div className="col-span-8 md:col-span-5 pl-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{b.hall}</p>
                        {b.isMultiDay && (
                          <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {b.isContinue ? "Multi-day" : "Multi-day"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{b.title}</p>
                    </div>

                    {/* DURATION */}
                    <div className="hidden md:flex col-span-3 justify-center">
                      <span className="text-xs text-gray-500 tabular-nums">{b.duration}</span>
                    </div>

                    {/* STATUS */}
                    <div className="col-span-12 md:col-span-2 flex items-center justify-between md:justify-center gap-2 mt-2 md:mt-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shadow-sm ${styles.badge}`}>
                        {b.status}
                      </span>

                      {/* Chevron hint */}
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {hasMore && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1 transition"
              >
                {showAll ? (
                  <>Show less <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg></>
                ) : (
                  <>View {allActiveBookings.length - 3} more booking{allActiveBookings.length - 3 !== 1 ? "s" : ""} <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></>
                )}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* DETAIL SIDE PANEL */}
      {detailBooking && (
        <BookingDetailPanel
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          user={user}
          onLoginRedirect={() => { setDetailBooking(null); navigate("/login", { state: { from: location.pathname } }) }}
        />
      )}

      {/* REQUEST CONFIRM MODAL */}
      {requestBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m0 0l-3-3m3 3l-3 3M16 17H8m0 0l3 3m-3-3l3-3" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Request This Venue?</h2>
            <p className="text-sm text-gray-500 mb-2">Send a swap request for</p>
            <p className="text-sm font-semibold text-gray-800">{requestBooking.hall}</p>
            <p className="text-xs text-gray-400 mt-1 mb-6">{requestBooking.duration}</p>
            <div className="flex gap-3">
              <button onClick={() => setRequestBooking(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleRequestConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition">
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST SUCCESS MODAL */}
      {requestSent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-bold text-gray-900 text-sm">Request Sent</h2>
            <p className="text-xs text-gray-500 mt-1">Your request for {requestSent.hall} has been submitted.</p>
            <button onClick={() => setRequestSent(null)} className="mt-4 bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition hover:bg-green-700">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default TodayBookings