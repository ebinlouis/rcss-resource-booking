import { useState } from "react"
import { createPortal } from "react-dom"
import { mediaBookings } from "../data/mediaBookings"
import MediaBookingDetailsModal from "./MediaBookingDetailsModal"

function CancelConfirmModal({ booking, onConfirm, onClose }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Cancel Booking?</h2>
        <p className="text-sm text-gray-500 mb-1">You're about to cancel your booking for</p>
        <p className="text-sm font-semibold text-gray-800 mb-1">{booking.service}</p>
        <p className="text-xs text-gray-400 mb-6">{booking.event} • {booking.time}</p>
        <p className="text-xs text-red-400 mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
            Keep booking
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">
            Yes, cancel it
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function MediaBookings({ bookings = mediaBookings }) {
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  return (
    <>
      <div className="mt-4">
        {/* Empty State */}
        {bookings.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            No bookings found for this date
          </div>
        ) : (
          /* TABLE WRAPPER */
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            
            {/* TABLE HEADER (Desktop Only) */}
            <div className="hidden md:grid grid-cols-12 px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
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
                          ? "bg-blue-50 border-blue-100 text-blue-700"
                          : "bg-yellow-50 border-yellow-100 text-yellow-700"
                      }`}
                    >
                      <p className="font-semibold text-sm">{b.service}</p>
                      <p className="text-xs opacity-70">
                        {b.event} • {b.location}
                      </p>
                    </div>
                  </div>

                  {/* STATUS & ACTIONS */}
                  <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center gap-4 mt-2 md:mt-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${
                        b.status === "confirmed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {b.status}
                    </span>

                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Edit Booking"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => setConfirmDelete(b)}
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

      {selectedBooking && (
        <MediaBookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {confirmDelete && (
        <CancelConfirmModal
          booking={confirmDelete}
          onConfirm={() => {
            console.log("Deleted media booking:", confirmDelete)
            setConfirmDelete(null)
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  )
}

export default MediaBookings