import { useState, useEffect, useCallback } from "react"
import MainLayout from "../layouts/MainLayout"
import MediaBookings from "../components/MediaBookings"
import MediaBookingModal from "../components/MediaBookingModal"
import mediaService from "../api/mediaApi"

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
]

function Media() {
  const today = new Date()
  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`

  const [open, setOpen] = useState(false)
  const [allBookings, setAllBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [search, setSearch] = useState("")

  // ── Fetch — used for manual refresh (onSuccess, onRefresh) ────────────────
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await mediaService.getMyBookings()
      setAllBookings(data)
    } catch (err) {
      console.error("Failed to fetch media bookings:", err)
      setError("Could not load bookings. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Initial load — inline async to satisfy the linter ────────────────────
  useEffect(() => {
    let isCurrent = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await mediaService.getMyBookings()
        if (!isCurrent) return
        setAllBookings(data)
      } catch (err) {
        console.error("Failed to fetch media bookings:", err)
        if (isCurrent) setError("Could not load bookings. Please try again.")
      } finally {
        if (isCurrent) setLoading(false)
      }
    }

    load()
    return () => { isCurrent = false }
  }, [])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filteredBookings = allBookings.filter((booking) => {
    const matchesDate = booking.booking_date === selectedDate
    const matchesStatus = statusFilter === "all" ? true : booking.status === statusFilter
    const searchTerm = search.trim().toLowerCase()
    const matchesSearch =
      searchTerm === "" ||
      booking.event_name?.toLowerCase().includes(searchTerm) ||
      booking.space_details?.name?.toLowerCase().includes(searchTerm)
    return matchesDate && matchesStatus && matchesSearch
  })

  const displayDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })

  return (
    <MainLayout>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Booking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all media requests in one place.
          </p>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-800"
        >
          + Book Media
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => setStatusFilter(item.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === item.value
                  ? "bg-green-700 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 shadow-sm transition text-gray-600"
          />

          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by event or hall..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 placeholder:text-gray-400 shadow-sm transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        {loading
          ? "Loading bookings..."
          : `${filteredBookings.length} booking${filteredBookings.length !== 1 ? "s" : ""} found for ${displayDate}`}
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {selectedDate === formatDate(today) ? "Today's Bookings" : `Bookings for ${displayDate}`}
        </h2>

        <MediaBookings
          bookings={filteredBookings}
          loading={loading}
          onRefresh={fetchBookings}
        />
      </section>

      {open && (
        <MediaBookingModal
          onClose={() => setOpen(false)}
          onSuccess={fetchBookings}
        />
      )}
    </MainLayout>
  )
}

export default Media