import { useState, useEffect } from "react"

import RoomCard from "../components/RoomCard"
import TodayBookings from "../components/TodayBookings"
import AvailabilityModal from "../components/AvailabilityModal"

import MainLayout from "../layouts/MainLayout"

import api from "../api/axios"

const FILTERS = ["All", "Available", "In use"]

function Home() {
  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")

  const [selectedRoom, setSelectedRoom] = useState(null)
  const [openAvailability, setOpenAvailability] = useState(false)

  const [dbRooms, setDbRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch spaces from backend
  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const response = await api.get("/spaces/catalog/")

        // Handles paginated or flat response
        const spaceData = response.data.results
          ? response.data.results
          : response.data

        setDbRooms(spaceData || [])
      } catch (error) {
        console.error("Failed to fetch spaces:", error)
        setDbRooms([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchSpaces()
  }, [])

  // Edit booking handler
  const handleEditBooking = (booking) => {
    const room = dbRooms.find(
      (r) => r.name.toLowerCase() === booking.hall.toLowerCase()
    )

    setSelectedRoom(room || { name: booking.hall })
    setOpenAvailability(true)
  }

  // Filter + Search
  const filteredRooms = dbRooms.filter((r) => {
    const matchesSearch =
      (r.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.space_type || "").toLowerCase().includes(search.toLowerCase())

    // Placeholder for future backend filtering
    const matchesFilter = activeFilter === "All" ? true : true

    return matchesSearch && matchesFilter
  })

  // Greeting
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
            Bookable spaces
          </h2>

          <p className="text-sm text-gray-400 mt-0.5">
            Main, lab, and conference spaces — click a card to view availability
          </p>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
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
          <div className="relative w-full sm:w-72">

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

        {/* Results Count */}
        {(search || activeFilter !== "All") && (
          <p className="text-xs text-gray-400 mb-4">
            {filteredRooms.length} space
            {filteredRooms.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex justify-center items-center py-14">
            <p className="text-sm text-gray-500 font-medium animate-pulse">
              Loading spaces from database...
            </p>
          </div>
        ) : filteredRooms.length > 0 ? (

          /* Cards */
          <div className="px-2 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
          </div>

        ) : (

          /* Empty State */
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

      {/* Availability Modal */}
      {openAvailability && selectedRoom && (
        <AvailabilityModal
          spaceId={selectedRoom.id}
          spaceName={selectedRoom.name}
          onClose={() => setOpenAvailability(false)}
        />
      )}

    </MainLayout>
  )
}

export default Home