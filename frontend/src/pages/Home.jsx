import { rooms } from "../data/rooms"
import Navbar from "../components/Navbar"
import RoomCard from "../components/RoomCard"
import { useState } from "react"
import TodayBookings from "../components/TodayBookings"
import AvailabilityModal from "../components/AvailabilityModal"

function Home() {
  const [search, setSearch] = useState("")
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [openAvailability, setOpenAvailability] = useState(false)

  return (
    <div className="w-full min-h-screen bg-gray-50">

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="px-6 py-6">

        {/* Welcome Section */}
        <div className="flex justify-between items-start mb-6">

          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Good morning, User!
            </h1>

            <p className="text-gray-500 mt-1">
              Here are your bookings for today.
            </p>
          </div>

          {/* Date Box */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm">
            <span className="text-sm font-medium text-gray-700">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </span>
          </div>

        </div>

        <TodayBookings />

        {/* Header */}
        <div className="mt-8 mb-6 border-b pb-4">

          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Bookable spaces
            </h2>
            <p className="text-sm text-gray-500">
              Main, lab, and conference spaces for today.
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <button className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm">
                All
              </button>
              <button className="px-4 py-2 bg-gray-100 rounded-md text-sm hover:bg-gray-200">
                Available
              </button>
              <button className="px-4 py-2 bg-gray-100 rounded-md text-sm hover:bg-gray-200">
                In use
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search spaces"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>

          </div>

        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rooms.map((room) => (
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

      {/* ✅ THIS WAS MISSING */}
      {openAvailability && selectedRoom && (
        <AvailabilityModal
          spaceName={selectedRoom.name}
          onClose={() => setOpenAvailability(false)}
        />
      )}

    </div>
  )
}

export default Home