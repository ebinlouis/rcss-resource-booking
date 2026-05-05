import React, { useState } from "react"
import Navbar from "../components/Navbar"
import MessBookingForm from "../components/MessBookingForm"

function Mess() {

  const bookingsByDate = {
    "2026-05-05": [
      {
        meal: "Breakfast",
        items: "Appam & Curry",
        time: "08:30 AM",
        type: "Veg",
        people: 120,
        status: "confirmed"
      },
      {
        meal: "Lunch",
        items: "Biriyani",
        time: "01:00 PM",
        type: "Non-Veg",
        people: 80,
        status: "pending"
      },
      {
        meal: "Dinner",
        items: "Chapathi & Curry",
        time: "08:00 PM",
        type: "Veg",
        people: 60,
        status: "confirmed"
      },
      {
        meal: "Snacks",
        items: "Banana Fritters & Tea",
        time: "05:00 PM",
        type: "Veg",
        people: 50,
        status: "confirmed"
      }
    ]
  }

  const today = new Date()

  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [showCalendar, setShowCalendar] = useState(false)
  const [mealFilter, setMealFilter] = useState("All")
  const [showForm, setShowForm] = useState(false)

  const bookings = bookingsByDate[selectedDate] || []

  const filteredBookings =
    mealFilter === "All"
      ? bookings
      : bookings.filter(b => b.meal === mealFilter)

  const displayDate = new Date(selectedDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short"
  })

  return (
    <div className="min-h-screen bg-white">

      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <div className="p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">

          <div>
            <h1 className="text-2xl font-bold">Mess Bookings</h1>
            <p className="text-gray-600">
              Manage your food and catering requests
            </p>
          </div>

          {/* DATE */}
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-4 py-2 bg-white border rounded-lg shadow-sm text-sm"
            >
              {displayDate}
            </button>

            {showCalendar && (
              <div className="absolute right-0 mt-2 bg-white border rounded-lg shadow p-3">
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

        {/* FILTER + BUTTON */}
        <div className="flex justify-between items-center mb-4">

          <div className="flex gap-3">
            {["All", "Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
              <button
                key={meal}
                onClick={() => setMealFilter(meal)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
                  mealFilter === meal
                    ? "bg-gray-100 text-gray-800 border-gray-300"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {meal}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition"
          >
            + Book Meal
          </button>
        </div>

        {/* TABLE */}
        <div className="border rounded-xl overflow-hidden bg-white">

          <div className="grid grid-cols-4 bg-gray-100 text-gray-500 text-sm px-4 py-2">
            <span>MEAL</span>
            <span className="col-span-3">BOOKING</span>
          </div>

          {filteredBookings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-4 items-center px-4 py-4 border-t"
            >

              {/* LEFT */}
              <span className="font-semibold text-gray-700">
                {b.meal}
              </span>

              {/* CARD */}
              <div
                className={`col-span-3 p-4 rounded-xl border ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-orange-50 border-orange-300"
                }`}
              >
                <div className="flex justify-between items-center">

                  <div>
                    <h3 className="font-semibold text-lg">
                      {b.items}
                    </h3>

                    <p className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">

                      {/* PEOPLE ICON */}
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M17 20h5v-1a4 4 0 0 0-5-3.87"/>
                          <path d="M9 20H4v-1a4 4 0 0 1 5-3.87"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        {b.people}
                      </span>

                      {/* TIME ICON */}
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        {b.time}
                      </span>

                      {/* TYPE TAG */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          b.type === "Veg"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {b.type}
                      </span>

                    </p>
                  </div>

                  {/* STATUS */}
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      b.status === "confirmed"
                        ? "bg-blue-200 text-blue-700"
                        : "bg-orange-200 text-orange-700"
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

      {showForm && (
        <MessBookingForm onClose={() => setShowForm(false)} />
      )}

    </div>
  )
}

export default Mess