import React, { useState, useCallback, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import MainLayout from "../layouts/MainLayout"
import TransportBookingModal from "../components/TransportBookingModal"
import TransportMyRequests from "../components/TransportMyRequests"
import { useMyFleetBookings, useCancelFleetBooking } from "../hooks/useFleetQueries"
import toast from "react-hot-toast"
import {
  Pencil, Trash2, X, RefreshCw, Bus, Plus,
  MapPin, Users, Clock, CalendarDays, ChevronRight, AlertCircle,
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  APPROVED:  { badge: "bg-green-100 text-green-700",  card: "bg-green-50 border-green-100 text-green-700"  },
  PENDING:   { badge: "bg-yellow-100 text-yellow-700", card: "bg-yellow-50 border-yellow-100 text-yellow-700" },
  COMPLETED: { badge: "bg-blue-100 text-blue-700",    card: "bg-blue-50 border-blue-100 text-blue-700"    },
  REJECTED:  { badge: "bg-red-100 text-red-700",      card: "bg-red-50 border-red-100 text-red-700"      },
  EXPIRED:   { badge: "bg-orange-100 text-orange-700", card: "bg-orange-50 border-orange-100 text-orange-700" },
  CANCELLED: { badge: "bg-gray-100 text-gray-600",    card: "bg-gray-50 border-gray-100 text-gray-600"    },
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${style.badge}`}>
      {status}
    </span>
  )
}

function formatDT(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

function formatDateOnly(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

const isEditable = (booking) => {
  const isPast = new Date(booking.end_datetime) <= new Date()
  return !isPast && (booking.status === "PENDING" || booking.status === "APPROVED")
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ date }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
        <Bus className="h-8 w-8 text-green-600" />
      </div>
      <p className="text-sm font-semibold text-gray-700">
        No transport bookings for {date || "this day"}
      </p>
      <p className="mt-1 text-sm text-gray-500">Your transport requests will appear here.</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

function Transport() {
  const today = new Date()
  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))

  const { data: queryData = [], isLoading: loading, isError, refetch } = useMyFleetBookings()
  const allBookings = queryData || []
  const loadError = isError ? "Failed to load bookings. Please refresh and try again." : ""

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editData,  setEditData]  = useState(null)

  // Side panel state
  const [selectedViewBooking, setSelectedViewBooking] = useState(null)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal]   = useState(false)
  const [deleteTarget,    setDeleteTarget]       = useState(null)
  const [deleting,        setDeleting]           = useState(false)
  const [deleteError,     setDeleteError]        = useState("")

  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const fetchBookings = useCallback(() => refetch(), [refetch])

  const bookingsForDate = useMemo(() => {
    return allBookings.filter((b) => {
      if (!b.start_datetime) return false
      return b.start_datetime.slice(0, 10) === selectedDate
    })
  }, [allBookings, selectedDate])

  const openCreateModal = () => {
    if (!user) { navigate("/login", { state: { from: location.pathname } }); return }
    setEditData(null)
    setShowModal(true)
  }

  const openEditModal = (booking) => {
    setSelectedViewBooking(null)
    setEditData(booking)
    setShowModal(true)
  }

  const handleSave = () => {
    setShowModal(false)
    setEditData(null)
  }

  const closeSidePanel = () => setSelectedViewBooking(null)

  const openDeleteModal = (booking) => {
    setDeleteTarget(booking)
    setDeleteError("")
    setShowDeleteModal(true)
    setSelectedViewBooking(null)
  }

  const cancelMutation = useCancelFleetBooking()

  const handleCancel = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")
    try {
      await cancelMutation.mutateAsync(deleteTarget.id)
      setShowDeleteModal(false)
      setDeleteTarget(null)
      toast.success("Booking cancelled successfully.")
    } catch (err) {
      setDeleteError(err?.response?.data?.error || "Could not cancel this booking. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Transport Bookings</h1>
            <p className="mt-2 text-sm text-gray-600">Manage your bus and vehicle booking requests for official travel.</p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            <Plus className="h-4 w-4" /> Book Transport
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Main booking overview */}
          <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

            {/* Controls */}
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Booking Overview</h2>
                  <p className="mt-1 text-sm text-gray-500">View confirmed and pending transport bookings for the selected date.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                  <button
                    onClick={fetchBookings}
                    title="Refresh bookings"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-green-600"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bookings list */}
            <div className="divide-y divide-gray-100">

              {loading && (
                <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading transport bookings...
                </div>
              )}

              {!loading && !user && (
                <div className="px-6 py-8 text-center space-y-3">
                  <p className="text-sm text-gray-500 font-medium">Sign in to view and manage transport bookings</p>
                  <button
                    onClick={() => navigate("/login", { state: { from: location.pathname } })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 text-white text-xs font-semibold hover:bg-green-800 transition"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {!loading && user && loadError && (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm font-medium text-red-600">{loadError}</p>
                </div>
              )}

              {!loading && user && !loadError && bookingsForDate.length === 0 && (
                <EmptyState date={selectedDate} />
              )}

              {!loading && user && !loadError && bookingsForDate.map((booking, idx) => (
                <div
                  key={booking.id}
                  onClick={() => setSelectedViewBooking(booking)}
                  className="px-6 py-5 cursor-pointer transition hover:bg-slate-50/70"
                >
                  <div className="flex flex-col gap-3">

                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          {booking.pickup_location} → {booking.destination}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={booking.status} />
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Schedule row */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Schedule</p>
                      <p className="mt-1 text-sm font-medium text-gray-700">{formatDT(booking.start_datetime)}</p>
                      <p className="mt-0.5 text-sm text-gray-500">Until {formatDT(booking.end_datetime)}</p>
                    </div>

                    {/* Passengers + purpose */}
                    <div className={`rounded-xl border px-4 py-3 ${STATUS_STYLES[booking.status]?.card ?? STATUS_STYLES.PENDING.card}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 opacity-70" />
                          {booking.total_passengers} passengers
                        </span>
                        {booking.reference_code && (
                          <span className="font-mono text-xs opacity-70">{booking.reference_code}</span>
                        )}
                      </div>
                      {booking.purpose && (
                        <p className="mt-1.5 text-sm opacity-80 italic">{booking.purpose}</p>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sidebar */}
          <div className="lg:col-span-1 lg:mt-0">
            <TransportMyRequests />
          </div>

        </div>
      </div>

      {/* ── Side panel ── */}
      {selectedViewBooking && (() => {
        const b = selectedViewBooking
        const canAct = isEditable(b)

        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">

              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Booking Details</h2>
                  {b.reference_code && (
                    <p className="text-sm text-slate-500 mt-0.5 font-medium tracking-wide uppercase">{b.reference_code}</p>
                  )}
                </div>
                <button onClick={closeSidePanel} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* Status + vehicle */}
                <section className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold text-slate-900 leading-snug">
                      {b.vehicle_details?.name ?? `Vehicle #${b.vehicle}`}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>

                  {/* Admin rejection remark */}
                  {b.status === "REJECTED" && b.remarks_by_admin && (
                    <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-red-500 mb-1">Admin Remark</p>
                        <p className="text-sm text-red-700 leading-relaxed">{b.remarks_by_admin}</p>
                      </div>
                    </div>
                  )}

                  {/* Route */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Route</p>
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                      <MapPin className="h-5 w-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{b.pickup_location}</p>
                        <p className="text-sm text-slate-500 mt-0.5">→ {b.destination}</p>
                      </div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Schedule</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Departs</p>
                        <p className="text-sm font-semibold text-slate-900">{formatDT(b.start_datetime)}</p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Returns</p>
                        <p className="text-sm font-semibold text-slate-900">{formatDT(b.end_datetime)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Passengers */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Passengers</p>
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                      <Users className="h-5 w-5 text-green-600 shrink-0" />
                      <p className="text-sm font-semibold text-slate-900">{b.total_passengers} passengers</p>
                    </div>
                  </div>

                  {/* Purpose */}
                  {b.purpose && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Purpose</p>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                        <p className="text-sm text-slate-700 leading-relaxed italic">{b.purpose}</p>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {b.user_notes && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2">Additional Notes</p>
                      <div className="bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-3">
                        <p className="text-sm text-gray-700 leading-relaxed">{b.user_notes}</p>
                      </div>
                    </div>
                  )}

                </section>
              </div>

              {/* Panel footer — actions */}
              {canAct && (
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                  <button
                    onClick={() => openDeleteModal(b)}
                    className="px-4 py-2 text-sm border border-slate-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors font-medium flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Cancel
                  </button>
                  <button
                    onClick={() => openEditModal(b)}
                    className="px-5 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium flex items-center gap-1.5"
                  >
                    <Pencil size={14} /> Edit Booking
                  </button>
                </div>
              )}

            </div>
          </div>
        )
      })()}

      {/* ── Booking / Edit modal ── */}
      {showModal && (
        <TransportBookingModal
          onClose={() => { setShowModal(false); setEditData(null) }}
          editData={editData}
          onSave={handleSave}
        />
      )}

      {/* ── Cancel confirmation modal ── */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Cancel booking?</h2>
            <p className="mt-2 text-sm text-gray-500">This will cancel your transport booking request.</p>
            <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-sm font-semibold text-gray-900">
                {deleteTarget.vehicle_details?.name || "Vehicle"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {deleteTarget.pickup_location} → {deleteTarget.destination}
              </p>
              {deleteTarget.reference_code && (
                <p className="mt-2 font-mono text-xs text-gray-400">{deleteTarget.reference_code}</p>
              )}
            </div>
            {deleteError && <p className="mt-4 text-sm text-red-600">{deleteError}</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {deleting && (
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {deleting ? "Cancelling..." : "Yes, Cancel Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  )
}

export default Transport