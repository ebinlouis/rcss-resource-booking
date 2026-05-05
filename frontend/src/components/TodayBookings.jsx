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
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg"
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
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm"
            />

            {!isToday && (
              <button
                onClick={() => {
                  setSelectedDate(todayKey())
                  setDeletedIds([])
                }}
                className="text-xs text-green-700 font-medium hover:underline"
              >
                Back to today
              </button>
            )}
          </div>

        </div>

        {/* EMPTY */}
        {bookings.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            No bookings
          </div>
        ) : (

          <div className="bg-white border rounded-xl divide-y max-h-[320px] overflow-y-auto">

            {bookings.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-12 px-4 py-4 gap-2 md:items-center group"
              >

                {/* TIME */}
                <div className="col-span-12 md:col-span-2 text-sm font-semibold">
                  {b.time}
                </div>

                {/* BOOKING */}
                <div className="col-span-12 md:col-span-7">
                  <div
                    className={`p-3 rounded-lg border ${
                      b.status === "confirmed"
                        ? "bg-green-50 border-green-100"
                        : "bg-yellow-50 border-yellow-100"
                    }`}
                  >
                    <p className="font-semibold text-sm">{b.hall}</p>
                    <p className="text-xs text-gray-500">
                      {b.title} • {b.duration}
                    </p>
                  </div>
                </div>

                {/* STATUS + ACTIONS */}
                <div className="col-span-12 md:col-span-3 flex justify-between items-center mt-2 md:mt-0">

                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      b.status === "confirmed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {b.status}
                  </span>

                  <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100">

                    <button
                      onClick={() => onEditBooking?.(b)}
                      className="text-gray-400 hover:text-black"
                    >
                      ✎
                    </button>

                    <button
                      onClick={() => handleCancelClick(b)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      🗑
                    </button>

                  </div>
                </div>

              </div>
            ))}

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