import React, { useState, useEffect, useCallback } from "react"
import MainLayout from "../layouts/MainLayout"
import TransportBookingModal from "../components/TransportBookingModal"
import { getMyBookings, cancelBooking } from "../api/fleetApi"
import {
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Bus,
  Plus,
} from "lucide-react"


const STATUS_STYLES = {
  APPROVED: {
    badge: "bg-green-100 text-green-700",
    card: "bg-green-50 border-green-100 text-green-700",
  },
  PENDING: {
    badge: "bg-yellow-100 text-yellow-700",
    card: "bg-yellow-50 border-yellow-100 text-yellow-700",
  },
  REJECTED: {
    badge: "bg-blue-100 text-blue-700",
    card: "bg-blue-50 border-blue-100 text-blue-700",
  },
  CANCELLED: {
    badge: "bg-gray-100 text-gray-500",
    card: "bg-gray-50 border-gray-100 text-gray-500",
  },
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING

  return (
    <span
      className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
    >
      {status}
    </span>
  )
}

function formatDT(iso) {
  if (!iso) return "—"

  const date = new Date(iso)

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

function EmptyState({ date, onBook }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
        <Bus className="h-8 w-8 text-green-600" />
      </div>

      <p className="text-sm font-semibold text-gray-700">
        No transport bookings for {date || "this day"}
      </p>

      <p className="mt-1 text-sm text-gray-500">
        Your transport requests will appear here.
      </p>
    </div>
  )
}
function Transport() {
  const today = new Date()

  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))

  // API state
  const [allBookings, setAllBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState(null)

  // Cancel modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    setLoadError("")

    try {
      const data = await getMyBookings()

      setAllBookings(
        Array.isArray(data)
          ? data
          : data.results ?? []
      )
    } catch {
      setLoadError(
        "Failed to load bookings. Please refresh and try again."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const bookingsForDate = allBookings.filter((booking) => {
    if (!booking.start_datetime) return false
    return booking.start_datetime.slice(0, 10) === selectedDate
  })

  const openCreateModal = () => {
    setEditData(null)
    setShowModal(true)
  }

  const openEditModal = (booking) => {
    setEditData(booking)
    setShowModal(true)
  }

  const handleSave = (savedBooking) => {
    setAllBookings((prev) => {
      const exists = prev.find(
        (booking) => booking.id === savedBooking.id
      )

      if (exists) {
        return prev.map((booking) =>
          booking.id === savedBooking.id
            ? savedBooking
            : booking
        )
      }

      return [savedBooking, ...prev]
    })

    setShowModal(false)
    setEditData(null)
  }

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

      setAllBookings((prev) =>
        prev.map((booking) =>
          booking.id === deleteTarget.id
            ? { ...booking, status: "CANCELLED" }
            : booking
        )
      )

      setShowDeleteModal(false)
      setDeleteTarget(null)
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        "Could not cancel this booking. Please try again."

      setDeleteError(message)
    } finally {
      setDeleting(false)
    }
  }   // <-- THIS MUST BE HERE

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              Transport Bookings
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Manage your bus and vehicle booking requests for official travel.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Book Transport
          </button>
        </div>

        {/* Main content */}
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

          {/* Controls */}
          <div className="border-b border-gray-100 px-6 py-5">

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Booking Overview
                  </h2>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  View confirmed and pending transport bookings for the selected date.
                </p>
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

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Loading transport bookings...
            </div>
          )}

          {/* Error */}
          {!loading && loadError && (
            <div className="px-6 py-8 text-center">
              <p className="text-sm font-medium text-red-600">
                {loadError}
              </p>
            </div>
          )}

          {/* Empty */}
          {!loading && !loadError && bookingsForDate.length === 0 && (
            <EmptyState
              date={selectedDate}
              onBook={openCreateModal}
            />
          )}

          {/* Booking cards */}
          {!loading &&
            !loadError &&
            bookingsForDate.map((booking) => {
              const cardStyle =
                STATUS_STYLES[booking.status]?.card ??
                STATUS_STYLES.PENDING.card

              const canEdit =
                booking.status === "PENDING" ||
                booking.can_modify

              const canCancel =
                booking.status === "PENDING"

              return (
                <div
                  key={booking.id}
                  className="px-6 py-5 transition hover:bg-gray-50"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    {/* Left section */}
                    <div className="flex-1 space-y-3">

                      {/* Top row */}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {booking.vehicle_details?.name ??
                              `Vehicle #${booking.vehicle}`}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {booking.pickup_location} →{" "}
                            {booking.destination}
                          </p>
                        </div>

                        <StatusBadge status={booking.status} />
                      </div>

                      {/* Time card */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Schedule
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-700">
                          {formatDT(booking.start_datetime)}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Until {formatDT(booking.end_datetime)}
                        </p>
                      </div>

                      {/* Details */}
                      <div
                        className={`rounded-xl border px-4 py-3 ${cardStyle}`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold">
                            {booking.total_passengers} passengers
                          </span>

                          {booking.reference_code && (
                            <span className="font-mono text-xs opacity-70">
                              {booking.reference_code}
                            </span>
                          )}
                        </div>

                        {booking.purpose && (
                          <p className="mt-2 text-sm opacity-80 italic">
                            {booking.purpose}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 lg:ml-6">

                      {canEdit && (
                        <button
                          onClick={() => openEditModal(booking)}
                          title="Edit booking"
                          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      )}

                      {canCancel && (
                        <button
                          onClick={() => openDeleteModal(booking)}
                          title="Cancel booking"
                          className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
                {/* Rejection remarks */}
        {bookingsForDate.some(
          (booking) =>
            booking.status === "REJECTED" &&
            booking.remarks_by_admin
        ) && (
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
            <div className="space-y-3">
              {bookingsForDate
                .filter(
                  (booking) =>
                    booking.status === "REJECTED" &&
                    booking.remarks_by_admin
                )
                .map((booking) => (
                  <div
                    key={booking.id}
                    className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-blue-800">
                      Admin Remark
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      <span className="font-mono text-xs">
                        {booking.reference_code}
                      </span>{" "}
                      — {booking.remarks_by_admin}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>
        </div>
      {/* Booking modal */}
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

      {/* Cancel confirmation modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
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

            <h2 className="text-xl font-bold text-gray-900">
              Cancel booking?
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              This will cancel your transport booking request.
            </p>

            <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-sm font-semibold text-gray-900">
                {deleteTarget.vehicle_details?.name || "Vehicle"}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {deleteTarget.pickup_location} →{" "}
                {deleteTarget.destination}
              </p>

              {deleteTarget.reference_code && (
                <p className="mt-2 font-mono text-xs text-gray-400">
                  {deleteTarget.reference_code}
                </p>
              )}
            </div>

            {deleteError && (
              <p className="mt-4 text-sm text-red-600">
                {deleteError}
              </p>
            )}

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
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
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