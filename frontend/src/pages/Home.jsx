import { rooms } from "../data/rooms"
import RoomCard from "../components/RoomCard"
import { useState } from "react"
import TodayBookings from "../components/TodayBookings"
import AvailabilityModal from "../components/AvailabilityModal"
import MainLayout from "../layouts/MainLayout"

const FILTERS = ["All", "Available", "In use"]

function Home() {
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [openAvailability, setOpenAvailability] = useState(false)

  const handleEditBooking = (booking) => {
    const room = rooms.find(
      (r) => r.name.toLowerCase() === booking.hall.toLowerCase()
    )

    setSelectedRoom(room || { name: booking.hall })
    setOpenAvailability(true)
  }

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())

    const matchesFilter =
      activeFilter === "All"
        ? true
        : activeFilter === "Available"
        ? r.status === "Available"
        : activeFilter === "In use"
        ? r.status !== "Available"
        : true

    return matchesSearch && matchesFilter
  })

  const hour = new Date().getHours()

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : "Good evening"

  return (
    <MainLayout>

      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, User!
        </h1>

        <p className="text-gray-400 mt-1 text-sm">
          Manage your space reservations and submit new booking requests.
        </p>
      </div>

      {/* Today Bookings */}
      <TodayBookings onEditBooking={handleEditBooking} />

      {/* Spaces Section */}
      <div className="mt-10">

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Available spaces
          </h2>

          <p className="text-sm text-gray-400 mt-0.5">
            Labs, conferencing, and collaborative zones
          </p>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    activeFilter === f
                      ? "bg-green-700 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Search */}
<div className="relative w-full sm:w-64">

  {/* Search Icon */}
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

  {/* Input */}
  <input
    type="text"
    placeholder="Search spaces…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg text-sm
    bg-white outline-none focus:ring-2 focus:ring-green-700/20
    focus:border-green-700 placeholder:text-gray-400 shadow-sm transition"
  />

  {/* Clear Button */}
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

        {/* Results count */}
        {(search || activeFilter !== "All") && (
          <p className="text-xs text-gray-400 mb-4">
            {filteredRooms.length} space
            {filteredRooms.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Cards */}
        {filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onOpenAvailability={() => {
                  setSelectedRoom(room)
                  setOpenAvailability(true)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-gray-200 rounded-xl bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-600">
              No spaces match your search
            </p>

            <p className="text-xs text-gray-400 mt-1">
              Try a different name or filter
            </p>
          </div>
        )}

      </div>

      {/* Modal */}
      {openAvailability && selectedRoom && (
        <AvailabilityModal
          spaceName={selectedRoom.name}
          onClose={() => setOpenAvailability(false)}
        />
      )}

    </MainLayout>
  )
}

export default Home