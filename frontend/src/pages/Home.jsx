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
    <h1 className="text-2xl font-semibold text-gray-900">
      Good morning, User!
    </h1>

    <p className="text-gray-500 mt-1">
      Here are your bookings for today.
    </p>
  </div>

  {/* RIGHT: Date Box */}
<div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm hover:bg-gray-50 hover:shadow-md cursor-pointer transition">

  {/* Calendar Icon */}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 text-gray-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>

  {/* Date */}
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

        {/* Bookable Spaces Header (Improved) */}
<div className="mt-8 mb-6 border-b pb-4">

  {/* Title */}
  <div className="mb-4">
    <h2 className="text-xl font-semibold text-gray-900">
      Bookable spaces
    </h2>
    <p className="text-sm text-gray-500">
      Main, lab, and conference spaces for today.
    </p>
  </div>

  {/* Controls */}
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
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
    />
  </svg>
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
        <RoomCard key={room.id} room={room} />
        ))}
        </div>

      </div>
    </div>
  )
}

export default Home