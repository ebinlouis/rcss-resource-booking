import React, { useState, useEffect, useCallback } from "react"
import MainLayout from "../layouts/MainLayout"
import TransportBookingModal from "../components/TransportBookingModal"
import { getMyBookings, cancelBooking } from "../api/fleetApi"
import { Pencil, Trash2, X, RefreshCw, Bus } from "lucide-react"


// ==========================================
// STATUS BADGE  — matches system-wide convention
// APPROVED  → green
// PENDING   → yellow
// REJECTED  → blue   (system convention, NOT red)
// CANCELLED → gray
// ==========================================
const STATUS_STYLES = {
  APPROVED:  { badge: "bg-green-100 text-green-700",  card: "bg-green-50 border-green-100 text-green-700" },
  PENDING:   { badge: "bg-yellow-100 text-yellow-700", card: "bg-yellow-50 border-yellow-100 text-yellow-700" },
  REJECTED:  { badge: "bg-blue-100 text-blue-700",    card: "bg-blue-50 border-blue-100 text-blue-700"   },
  CANCELLED: { badge: "bg-gray-100 text-gray-500",    card: "bg-gray-50 border-gray-100 text-gray-500"   },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
  return (
    <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${s.badge}`}>
      {status}
    </span>
  )
}

// ==========================================
// FORMAT DATETIME for display
// ==========================================
function formatDT(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

// ==========================================
// EMPTY STATE
// ==========================================
function EmptyState({ date, onBook }) {
  return (
<div className="flex flex-col items-center justify-center py-14 text-center">
  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
    <Bus className="w-8 h-8 text-green-600" />
  </div>

  <p className="text-gray-500 font-medium">No bookings for {date || "this day"}</p>
  <p className="text-gray-400 text-sm mt-1">
    Your transport requests will appear here.
  </p>

  <button
    onClick={onBook}
    className="mt-5 text-sm text-green-700 font-semibold hover:underline"
  >
    + Make a booking
  </button>
</div>
  )
}


// ==========================================
// TRANSPORT PAGE
// ==========================================
function Transport() {
  const today = new Date()
  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))

  // API state
  const [allBookings, setAllBookings] = useState([])   // flat list from API
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState("")

  // Modal state
  const [showModal, setShowModal]             = useState(false)
  const [editData, setEditData]               = useState(null)

  // Delete / cancel modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget]       = useState(null)   // booking object
  const [deleting, setDeleting]               = useState(false)
  const [deleteError, setDeleteError]         = useState("")


  // ------------------------------------------------------------------
  // FETCH bookings from API
  // ------------------------------------------------------------------
  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const data = await getMyBookings()
      // data may be a plain array or paginated { results: [] }
      setAllBookings(Array.isArray(data) ? data : data.results ?? [])
    } catch {
      setLoadError("Failed to load bookings. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])


  // ------------------------------------------------------------------
  // Filter to selected date  (uses start_datetime from API)
  // ------------------------------------------------------------------
  const bookingsForDate = allBookings.filter((b) => {
    if (!b.start_datetime) return false
    return b.start_datetime.slice(0, 10) === selectedDate
  })


  // ------------------------------------------------------------------
  // MODAL HANDLERS
  // ------------------------------------------------------------------
  const openCreateModal = () => {
    setEditData(null)
    setShowModal(true)
  }

  const openEditModal = (booking) => {
    setEditData(booking)
    setShowModal(true)
  }

  const handleSave = (savedBooking) => {
    // Optimistic update: replace or prepend
    setAllBookings((prev) => {
      const exists = prev.find((b) => b.id === savedBooking.id)
      if (exists) {
        return prev.map((b) => (b.id === savedBooking.id ? savedBooking : b))
      }
      return [savedBooking, ...prev]
    })
    setShowModal(false)
    setEditData(null)
  }


  // ------------------------------------------------------------------
  // CANCEL HANDLER
  // ------------------------------------------------------------------
  const openDeleteModal = (booking) => {
    setDeleteTarget(booking)
    setDeleteError("")
    setShowDeleteModal(true)
  }

  const handleCancel = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await cancelBooking(deleteTarget.id)
      // Reflect CANCELLED status in local state
      setAllBookings((prev) =>
        prev.map((b) =>
          b.id === deleteTarget.id ? { ...b, status: "CANCELLED" } : b
        )
      )
      setShowDeleteModal(false)
      setDeleteTarget(null)
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        "Could not cancel this booking. Please try again."
      setDeleteError(msg)
    } finally {
      setDeleting(false)
    }
  }


  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  return (
    <MainLayout>
      <div className="space-y-6">

        {/* ── TOP HEADER ── */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transport Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">Your bus and vehicle bookings</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl shadow-sm text-sm font-semibold transition-all"
          >
            <span className="text-lg leading-none">+</span>
            Book Transport
          </button>
        </div>

        {/* ── DATE SELECTOR ROW ── */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Today's bookings</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Confirmed and pending transport usage for selected date.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              onClick={fetchBookings}
              title="Refresh"
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── BOOKINGS TABLE ── */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">

          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400">
            <div className="col-span-3">Time</div>
            <div className="col-span-6">Transport Details</div>
            <div className="col-span-3 text-right pr-12">Status & Actions</div>
          </div>

          {/* Body */}
          <div className="divide-y divide-gray-100">

            {/* Loading state */}
            {loading && (
              <div className="p-8 flex justify-center items-center gap-2 text-sm text-gray-400">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading bookings…
              </div>
            )}

            {/* Error state */}
            {!loading && loadError && (
              <div className="p-6 text-center text-sm text-red-500">{loadError}</div>
            )}

            {/* Empty state */}
            {!loading && !loadError && bookingsForDate.length === 0 && (
              <EmptyState date={selectedDate} onBook={openCreateModal} />
            )}

            {/* Booking rows */}
            {!loading && !loadError && bookingsForDate.map((b) => {
              const cardStyle = STATUS_STYLES[b.status]?.card ?? STATUS_STYLES.PENDING.card
              const canEdit   = b.status === "PENDING" || b.can_modify
              const canCancel = b.status === "PENDING"

              return (
                <div
                  key={b.id}
                  className="grid grid-cols-12 px-4 py-4 gap-2 md:items-center group hover:bg-gray-50/50 transition-colors"
                >
                  {/* TIME */}
                  <div className="col-span-12 md:col-span-3">
                    <p className="text-sm font-semibold text-gray-700">
                      {formatDT(b.start_datetime)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      → {formatDT(b.end_datetime)}
                    </p>
                  </div>

                  {/* DETAILS CARD */}
                  <div className="col-span-12 md:col-span-6">
                    <div className={`p-3 rounded-lg border ${cardStyle}`}>
                      <p className="font-semibold text-sm">
                        {b.vehicle_details?.name ?? `Vehicle #${b.vehicle}`}
                        <span className="font-normal text-xs ml-2 opacity-70">
                          ({b.total_passengers} pax)
                        </span>
                      </p>
                      <p className="text-xs opacity-70 mt-0.5">
                        {b.pickup_location} → {b.destination}
                      </p>
                      {b.purpose && (
                        <p className="text-xs opacity-60 mt-0.5 italic">{b.purpose}</p>
                      )}
                      {b.reference_code && (
                        <p className="text-[10px] font-mono opacity-50 mt-1">
                          {b.reference_code}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* STATUS + ACTIONS */}
                  <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center gap-4 mt-2 md:mt-0">
                    <StatusBadge status={b.status} />

                    <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">

                      {/* EDIT — only for PENDING */}
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(b)}
                          title="Edit booking"
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      {/* CANCEL — only for PENDING */}
                      {canCancel && (
                        <button
                          onClick={() => openDeleteModal(b)}
                          title="Cancel booking"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                    </div>
                  </div>

                </div>
              )
            })}

          </div>
        </div>

        {/* ── REMARKS / REJECTION NOTICE ── */}
        {bookingsForDate.some((b) => b.status === "REJECTED" && b.remarks_by_admin) && (
          <div className="space-y-2">
            {bookingsForDate
              .filter((b) => b.status === "REJECTED" && b.remarks_by_admin)
              .map((b) => (
                <div
                  key={b.id}
                  className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700"
                >
                  <span className="font-semibold">{b.reference_code}:</span>{" "}
                  {b.remarks_by_admin}
                </div>
              ))}
          </div>
        )}

      </div>

      {/* ── BOOKING MODAL ── */}
      {showModal && (
        <TransportBookingModal
          onClose={() => {
            setShowModal(false)
            setEditData(null)
          }}
          editData={editData}
          onSave={handleSave}
        />
      )}

      {/* ── CANCEL CONFIRM MODAL ── */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 relative shadow-2xl text-center">

            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-3">Cancel Booking?</h2>

            <p className="text-gray-500 text-sm leading-relaxed">
              You're about to cancel your booking for
            </p>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-gray-800 break-words">
                {deleteTarget.vehicle_details?.name ?? "this vehicle"}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {deleteTarget.pickup_location} → {deleteTarget.destination}
              </p>
              <p className="font-mono text-xs text-gray-400 mt-1">
                {deleteTarget.reference_code}
              </p>
            </div>

            {deleteError && (
              <p className="text-red-500 text-sm mt-4">{deleteError}</p>
            )}

            <p className="text-red-400 text-sm mt-4">
              This action cannot be undone.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                onClick={handleCancel}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {deleting ? "Cancelling…" : "Yes, cancel it"}
              </button>
            </div>

          </div>
        </div>
      )}

    </MainLayout>
  )
}

export default Transport
