import { rooms } from "../data/rooms"
import Navbar from "../components/Navbar"
import RoomCard from "../components/RoomCard"
import { useState } from "react"
import TodayBookings from "../components/TodayBookings"

function Home() {
    const [search, setSearch] = useState("")
  return (
    <div className="w-full min-h-screen bg-gray-50">

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="px-6 py-6">

        {/* Welcome Section */}
        {/* Top Greeting + Date */}
<div className="flex justify-between items-start mb-6">

  {/* LEFT: Greeting */}
  <div>
    <h1 className="text-3xl font-semibold text-gray-900">
      Hello, Diya 👋
    </h1>

    <p className="text-gray-500 mt-1">
      Welcome back! Here are your available spaces.
    </p>
  </div>

  {/* RIGHT: Date Box */}
  <div className="bg-white border rounded-xl px-5 py-3 shadow-sm text-gray-800 font-medium text-lg">
    {new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    })}
  </div>

</div>
        <TodayBookings />

        {/* Bookable Spaces Header */}
        <div className="flex justify-between items-center mb-4">

          <div>
            <h2 className="text-xl font-semibold">
              Bookable spaces
            </h2>
            <p className="text-gray-500 text-sm">
              Main, lab, and conference spaces for today.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">

  {/* Filter Buttons */}
  <div className="flex gap-2">
    <button className="px-4 py-2 bg-gray-200 rounded-md text-sm">
      All
    </button>
    <button className="px-4 py-2 bg-gray-100 rounded-md text-sm">
      Available
    </button>
    <button className="px-4 py-2 bg-gray-100 rounded-md text-sm">
      In use
    </button>
  </div>

  {/* Search Bar */}
  <div className="relative">

  {/* Icon */}
  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
    🔍
  </span>

  {/* Input */}
  <input
    type="text"
    placeholder="Search spaces"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-10 pr-4 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
  />

</div>

</div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-6">
        {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
        ))}
        </div>

      </div>
    </div>
  )
}

export default Home