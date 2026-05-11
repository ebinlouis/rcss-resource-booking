import { useState } from "react"
import { createPortal } from "react-dom"
import MediaBookingDetailsModal from "./MediaBookingDetailsModal"
import mediaService from "../api/mediaApi"

// ── Status badge helper — consistent with Spaces/Transport/Mess ────────────
function StatusBadge({ status }) {
  const map = {
    APPROVED: "bg-green-100 text-green-700",
    PENDING:  "bg-yellow-100 text-yellow-700",
    REJECTED: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  }
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${
        map[status] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {status}
    </span>
  )
}

// ── Delete confirmation modal ─────────────────────────────────────────────
function CancelConfirmModal({ booking, onConfirm, onClose, deleting }) {
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
        <p className="text-sm font-semibold text-gray-800 mb-1">{booking.event_name}</p>
        <p className="text-xs text-gray-400 mb-6">
          {booking.booking_date} • {booking.setup_start_time?.slice(0, 5)} – {booking.teardown_end_time?.slice(0, 5)}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50"
          >
            Keep booking
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Yes, cancel it"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main component ─────────────────────────────────────────────────────────
function MediaBookings({ bookings = [], loading = false, onRefresh }) {
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      setDeleting(true)
      setDeleteError(null)
      await mediaService.deleteBooking(confirmDelete.id)
      setConfirmDelete(null)
      onRefresh?.()
    } catch (err) {
      console.error("Delete failed:", err)
      setDeleteError("Could not delete booking. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      {deleteError && (
        <div className="mb-3 px-4 py-2 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          {deleteError}
        </div>
      )}

      <div className="mt-4">
        {/* Empty State */}
        {bookings.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            No bookings found for this date
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            {/* TABLE HEADER (Desktop) */}
            <div className="hidden md:grid grid-cols-12 px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <div className="col-span-3">Time Schedule</div>
              <div className="col-span-6">Booking Details</div>
              <div className="col-span-3 text-right pr-12">Status & Actions</div>
            </div>

            {/* TABLE BODY */}
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {bookings.map((b) => {
                const isApproved = b.status === "APPROVED"
                const isPending  = b.status === "PENDING"
                const eqCount    = b.equipment_requests?.length || 0
                
                // Smart check to see if we need to display the nested event time
                const hasBuffer = b.setup_start_time !== b.event_start_time || b.teardown_end_time !== b.event_end_time

                return (
                  <div
                    key={b.id}
                    className="grid grid-cols-12 px-4 py-4 gap-2 md:items-center group hover:bg-gray-50/50 transition-colors"
                  >
                    {/* TIME: Smart display based on buffer toggle */}
                    <div className="col-span-12 md:col-span-3">
                      <div className="text-sm font-bold text-gray-700">
                        {b.setup_start_time?.slice(0, 5)} – {b.teardown_end_time?.slice(0, 5)}
                      </div>
                      {hasBuffer && (
                        <div className="text-[10px] font-medium text-gray-400 uppercase mt-0.5" title="Core Event Time">
                          Event: {b.event_start_time?.slice(0, 5)} – {b.event_end_time?.slice(0, 5)}
                        </div>
                      )}
                    </div>

                    {/* BOOKING DETAILS */}
                    <div className="col-span-12 md:col-span-6">
                      <div
                        className={`p-3 rounded-lg border ${
                          isApproved
                            ? "bg-green-50 border-green-100 text-green-800"
                            : isPending
                            ? "bg-yellow-50 border-yellow-100 text-yellow-800"
                            : "bg-gray-50 border-gray-100 text-gray-700"
                        }`}
                      >
                        <p className="font-bold text-sm">{b.event_name}</p>
                        <div className="text-xs opacity-75 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">{b.space_details?.name ?? "—"}</span>
                          
                          {/* Hardware Badge */}
                          {eqCount > 0 && (
                            <span className="bg-black/10 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide">
                              {eqCount} HARDWARE ITEM{eqCount !== 1 ? 'S' : ''}
                            </span>
                          )}
                          
                          {/* Services Text */}
                          {b.requested_services && (
                            <span className="truncate max-w-[200px]" title={b.requested_services}>
                              • {b.requested_services}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STATUS & ACTIONS */}
                    <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center gap-4 mt-2 md:mt-0">
                      <StatusBadge status={b.status} />

                      {/* Only show action buttons if can_modify is true */}
                      {b.can_modify && (
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
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit / Details Modal */}
      {selectedBooking && (
        <MediaBookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onRefresh={() => {
            setSelectedBooking(null)
            onRefresh?.()
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <CancelConfirmModal
          booking={confirmDelete}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
          deleting={deleting}
        />
      )}
    </>
  )
}

export default MediaBookings