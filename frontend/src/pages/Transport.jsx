import React, { useState } from "react"
import Navbar from "../components/Navbar"
import TransportBookingModal from "../components/TransportBookingModal" // ✅ IMPORT

function Transport() {

  const bookingsByDate = {
    "2026-05-05": [
      {
        time: "09:00",
        title: "College Bus - Route A",
        desc: "Pickup: Kakkanad → Campus",
        status: "confirmed"
      },
      {
        time: "11:00",
        title: "Van Booking",
        desc: "Dept visit, 11:00 - 02:00",
        status: "pending"
      }
    ],
    "2026-05-06": [
      {
        time: "10:00",
        title: "Bus - Route B",
        desc: "City → Campus",
        status: "confirmed"
      }
    ]
  }

  const today = new Date()

  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [showCalendar, setShowCalendar] = useState(false)

  // ✅ MODAL STATE
  const [showModal, setShowModal] = useState(false)

  const bookings = bookingsByDate[selectedDate] || []

  const displayDate = new Date(selectedDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short"
  })

  return (
    <div className="min-h-screen bg-gray-50">

      {/* NAVBAR */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <div className="p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">

          <div>
            <h1 className="text-2xl font-bold">
              Transport Bookings
            </h1>
            <p className="text-gray-500">
              Your bus and vehicle bookings
            </p>
          </div>

          {/* DATE */}
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-4 py-2 bg-white border rounded-lg shadow-sm text-sm"
            >
              📅 {displayDate}
            </button>

            {showCalendar && (
              <div className="absolute right-0 mt-2 bg-white border rounded-lg shadow p-3 z-50">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setShowCalendar(false)
                  }}
                  className="border px-2 py-1 rounded"
                />
              </div>
            )}
          </div>

        </div>

        {/* TODAY BOOKINGS HEADER + BUTTON */}
        <div className="flex justify-between items-center mb-2">

          <h2 className="text-lg font-semibold">
            Today's bookings
          </h2>

          {/* ✅ OPEN MODAL */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition"
          >
            <span className="text-lg">+</span>
            Book Transport
          </button>

        </div>

        <p className="text-gray-500 text-sm mb-4">
          Confirmed and pending transport usage for selected date.
        </p>

        {/* BOOKINGS */}
        <div className="border rounded-xl overflow-hidden bg-white">

          {/* HEADER */}
          <div className="grid grid-cols-4 bg-gray-100 text-gray-500 text-sm px-4 py-2">
            <span>TIME</span>
            <span className="col-span-3">BOOKING</span>
          </div>

          {/* EMPTY */}
          {bookings.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">
              No bookings for this day
            </p>
          )}

          {/* DATA */}
          {bookings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-4 items-center px-4 py-4 border-t"
            >

              <span className="font-semibold text-gray-600">
                {b.time}
              </span>

              <div
                className={`col-span-3 p-4 rounded-xl border ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-yellow-50 border-yellow-300"
                }`}
              >
                <div className="flex justify-between items-center">

                  <div>
                    <h3 className="font-semibold">
                      {b.title}
                    </h3>

                    <p className="text-sm text-gray-500">
                      {b.desc}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      b.status === "confirmed"
                        ? "bg-blue-200 text-blue-700"
                        : "bg-yellow-200 text-yellow-700"
                    }`}
                  >
                    {b.status}
                  </span>

                </div>
              </div>

            </div>
          ))}

        </div>

      </div>

      {/* ✅ MODAL RENDER */}
      {showModal && (
        <TransportBookingModal onClose={() => setShowModal(false)} />
      )}

    </div>
  )
}

export default Transport