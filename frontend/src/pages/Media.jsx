import { useState } from "react"
import Navbar from "../components/Navbar"
import MediaBookings from "../components/MediaBookings"
import MediaBookingModal from "../components/MediaBookingModal"

function Media() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("all")

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />

      <div className="px-6 py-6">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-7 h-7 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Media Booking
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Manage and track all media requests in one place
              </p>
            </div>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            + Book Media
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Bookings</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">24</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Confirmed</p>
              <p className="text-3xl font-bold text-green-600 mt-1">18</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">6</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Today</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">2</p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6 bg-white rounded-lg p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "all"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Bookings
            </button>
            <button
              onClick={() => setFilter("photography")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "photography"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Photography
            </button>
            <button
              onClick={() => setFilter("videography")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "videography"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Videography
            </button>
            <button
              onClick={() => setFilter("today")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === "today"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Today
            </button>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search bookings..."
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="date"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Bookings Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Bookings for Today
          </h2>
          <MediaBookings onOpen={() => setOpen(true)} />
        </div>
      </div>

      {/* Modal */}
      {open && <MediaBookingModal onClose={() => setOpen(false)} />}
    </div>
  )
}

export default Media