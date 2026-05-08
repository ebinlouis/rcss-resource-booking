import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import api from "../api/axios"

const todayKey = () => new Date().toISOString().split("T")[0]

/* ================= MODALS ================= */

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

/* ================= STATUS CONFIG ================= */

const STATUS_STYLES = {
  confirmed: {
    row: "bg-green-50/100",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
  },
  pending: {
    row: "bg-amber-50/100",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  rejected: {
    row: "bg-red-50/100",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
}

/* ================= MAIN ================= */

function TodayBookings({ onEditBooking }) {
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [dbBookings, setDbBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelling, setIsCancelling] = useState(false)
  const [confirmBooking, setConfirmBooking] = useState(null)
  const [cancelledRecord, setCancelledRecord] = useState(null)

  const isToday = selectedDate === todayKey()

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      try {
        const res = await api.get("/spaces/requests/?view=general")
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
  dateObj.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const statusMap = { APPROVED: "confirmed", PENDING: "pending", REJECTED: "rejected" }

  const allActiveBookings = dbBookings
    .filter((b) => b.start_datetime.split("T")[0] === selectedDate)
    .map((b) => {
      const startD = new Date(b.start_datetime)
      const endD   = new Date(b.end_datetime)
      return {
        id:        b.id,
        time:      formatTime(startD),
        hall:      b.space_details?.name ?? "Unknown Space",
        title:     b.purpose_of_booking,
        duration:  `${formatTime(startD)} – ${formatTime(endD)}`,
        status:    statusMap[b.status] ?? "pending",
        canModify: b.can_modify,
        raw:       b,
      }
    })

  const [showAll, setShowAll] = useState(false)

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value)
    setShowAll(false)
  }

  const activeBookings = showAll ? allActiveBookings : allActiveBookings.slice(0, 3)
  const hasMore = allActiveBookings.length > 3

  const handleCancelConfirm = async () => {
    setIsCancelling(true)
    try {
      await api.delete(`/spaces/requests/${confirmBooking.id}/`)
      setDbBookings((prev) => prev.filter((b) => b.id !== confirmBooking.id))
      setCancelledRecord(confirmBooking)
      setConfirmBooking(null)
    } catch (err) {
      console.error("Failed to cancel booking:", err)
      alert("Failed to cancel booking. It may have already been processed by an admin.")
    } finally {
      setIsCancelling(false)
    }
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
          onClick={() => {
            setSelectedDate(todayKey())
            setShowAll(false)
          }}
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
<div className="col-span-5 pl-2">Space & Purpose</div>
<div className="col-span-3 text-center">Duration</div>
  <div className="col-span-2 text-center">Status</div>
</div>

            {/* ROWS */}
            <div className="divide-y divide-gray-200">
              {activeBookings.map((b) => {
                const styles = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending
                return (
                  <div
                    key={b.id}
className={`grid grid-cols-12 px-8 py-5 items-center group hover:bg-gray-50/80 transition-colors ${styles.row}`}                  >
                    {/* TIME */}
<div className="col-span-4 md:col-span-2 pl-6">  <span className="text-sm font-bold text-gray-800 tabular-nums">
    {b.time}
  </span>
</div>

                    {/* SPACE + PURPOSE */}
<div className="col-span-8 md:col-span-5 pl-2">
                        <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{b.hall}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{b.title}</p>
                    </div>

                    <div className="hidden md:flex col-span-3 justify-center">
  <span className="text-xs text-gray-500 tabular-nums">
    {b.duration}
  </span>
</div>

                    {/* STATUS + ACTIONS */}
<div className="col-span-12 md:col-span-2 flex items-center justify-between md:justify-center gap-2 mt-2 md:mt-0">                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shadow-sm ${styles.badge}`}>
                        {b.status}
                      </span>

                      {b.canModify && (
<div className="absolute right-6 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">                          <button
                            onClick={() => onEditBooking?.(b)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Edit Booking"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setConfirmBooking(b)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Cancel Booking"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
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

      {confirmBooking && (
        <CancelConfirmModal
          booking={confirmBooking}
          onConfirm={handleCancelConfirm}
          onClose={() => setConfirmBooking(null)}
          isCancelling={isCancelling}
        />
      )}
      {cancelledRecord && (
        <CancelSuccessModal
          booking={cancelledRecord}
          onClose={() => setCancelledRecord(null)}
        />
      )}
    </>
  )
}

export default TodayBookings