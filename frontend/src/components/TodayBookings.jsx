import { useState } from "react"
import { createPortal } from "react-dom"
import { bookings as allBookings } from "../data/bookings"

const mockBookingsByDate = {
  "2026-05-05": allBookings,
  "2026-05-06": [
    {
      id: 4,
      time: "11:00",
      hall: "Darshanam",
      title: "Staff meeting",
      duration: "11:00 – 12:00",
      status: "pending",
    },
  ],
  "2026-05-07": [],
}

const todayKey = () => new Date().toISOString().split("T")[0]

/* ================= MODALS ================= */

function CancelConfirmModal({ booking, onConfirm, onClose }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">

        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107
                 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244
                 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-1">Cancel Booking?</h2>

        <p className="text-sm text-gray-500 mb-1">
          You're about to cancel your booking for
        </p>

        <p className="text-sm font-semibold text-gray-800 mb-1">
          {booking.hall}
        </p>

        <p className="text-xs text-gray-400 mb-6">
          {booking.title} • {booking.duration}
        </p>

        <p className="text-xs text-red-400 mb-6">
          This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50"
          >
            Keep booking
          </button>

          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold"
          >
            Yes, cancel it
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
        <h2 className="font-bold text-gray-900">Cancelled</h2>
        <p className="text-sm text-gray-500 mt-2">{booking.hall}</p>

        <button
          onClick={onClose}
          className="mt-4 bg-green-700 text-white px-4 py-2 rounded-lg"
        >
          Done
        </button>
      </div>
    </div>,
    document.body
  )
}

/* ================= MAIN ================= */

function TodayBookings({ onEditBooking }) {
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [deletedIds, setDeletedIds] = useState([])
  const [confirmBooking, setConfirmBooking] = useState(null)
  const [cancelledRecord, setCancelledRecord] = useState(null)

  // ✅ FIXED: moved inside component
  const isToday = selectedDate === todayKey()

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const bookings = (mockBookingsByDate[selectedDate] || []).filter(
    (b) => !deletedIds.includes(b.id)
  )

  const handleCancelClick = (b) => setConfirmBooking(b)

  const handleCancelConfirm = () => {
    setDeletedIds((prev) => [...prev, confirmBooking.id])
    setCancelledRecord(confirmBooking)
    setConfirmBooking(null)
  }

return (
  <>
    <div className="mt-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isToday
              ? "Today's bookings"
              : `Bookings for ${formattedDate}`}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Your confirmed and pending space reservations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setDeletedIds([])
            }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
          />

          {!isToday && (
            <button
              onClick={() => {
                setSelectedDate(todayKey())
                setDeletedIds([])
              }}
              className="text-xs text-emerald-700 font-medium hover:underline"
            >
              Back to today
            </button>
          )}
        </div>
      </div>

      {/* RENDER LOGIC */}
      {bookings.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          No bookings found for this date
        </div>
      ) : (
        /* TABLE WRAPPER */
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          
          {/* TABLE HEADER (Desktop Only) */}
          <div className="hidden md:grid grid-cols-12 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400">
            <div className="col-span-2">Time</div>
            <div className="col-span-7">Booking Details</div>
            <div className="col-span-3 text-right pr-12">Status & Actions</div>
          </div>

          {/* TABLE BODY */}
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-12 px-4 py-4 gap-2 md:items-center group hover:bg-gray-50/50 transition-colors"
              >
                {/* TIME */}
                <div className="col-span-12 md:col-span-2 text-sm font-semibold text-gray-700">
                  {b.time}
                </div>

                {/* BOOKING DETAILS */}
                <div className="col-span-12 md:col-span-7">
                  <div
                    className={`p-3 rounded-lg border ${
                      b.status === "confirmed"
                        ? "bg-green-50 border-green-100 text-green-700"
                        : "bg-yellow-50 border-yellow-100 text-yellow-700"
                    }`}
                  >
                    <p className="font-semibold text-sm">{b.hall}</p>
                    <p className="text-xs opacity-70">
                      {b.title} • {b.duration}
                    </p>
                  </div>
                </div>

                {/* STATUS + ACTIONS */}
                <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center gap-4 mt-2 md:mt-0">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${
                      b.status === "confirmed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {b.status}
                  </span>

                  <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditBooking?.(b)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                      title="Edit Booking"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleCancelClick(b)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Booking"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* MODALS */}
    {confirmBooking && (
      <CancelConfirmModal
        booking={confirmBooking}
        onConfirm={handleCancelConfirm}
        onClose={() => setConfirmBooking(null)}
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