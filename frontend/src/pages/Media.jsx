import { useState } from "react"
import MainLayout from "../layouts/MainLayout"
import MediaBookings from "../components/MediaBookings"
import MediaBookingModal from "../components/MediaBookingModal"
import { mediaBookings } from "../data/mediaBookings"

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Photography", value: "Photography" },
  { label: "Videography", value: "Videography" }
]

function Media() {
  const today = new Date()
  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

  const [open, setOpen] = useState(false)
  const [serviceFilter, setServiceFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [search, setSearch] = useState("")

  const filteredBookings = mediaBookings.filter((booking) => {
    const matchesDate = booking.date === selectedDate
    const matchesService =
      serviceFilter === "all" ? true : booking.service === serviceFilter
    const matchesSearch =
      search.trim() === "" ||
      booking.event.toLowerCase().includes(search.toLowerCase()) ||
      booking.location.toLowerCase().includes(search.toLowerCase())

    return matchesDate && matchesService && matchesSearch
  })

  const displayDate = new Date(selectedDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short"
  })

  return (
    <MainLayout>
      {/* Header Section */}
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

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => setServiceFilter(item.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                serviceFilter === item.value
                  ? "bg-green-700 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Date & Search */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 shadow-sm transition text-gray-600"
          />

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search bookings..."
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

      {/* Results Count */}
      <p className="text-xs text-gray-400 mb-4">
        {filteredBookings.length} booking{filteredBookings.length !== 1 ? "s" : ""} found for {displayDate}
      </p>

      {/* Bookings Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Today's Bookings</h2>
        <MediaBookings bookings={filteredBookings} />
      </section>

      {/* Modal */}
      {open && <MediaBookingModal onClose={() => setOpen(false)} />}
    </MainLayout>
  )
}

export default Media