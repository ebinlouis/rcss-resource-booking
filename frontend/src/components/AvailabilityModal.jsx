import { useState } from "react"
import BookingModal from "./BookingModal"

// ✅ Separate bookings per hall
const mockBookingsByRoom = {
  "Golden Aureole": {
    "2026-05-01": [
      { time: "10:00 - 12:00", status: "approved", title: "Department session" },
      { time: "02:00 - 04:00", status: "pending", title: "Meeting" }
    ],
    "2026-05-02": [
      { time: "09:00 - 10:00", status: "open", title: "Free slot" }
    ]
  },

  "CC Lab": {
    "2026-05-01": [
      { time: "09:00 - 11:00", status: "approved", title: "Lab exam" }
    ]
  }
}

function AvailabilityModal({ spaceName, onClose }) {

  // ✅ current month state
  const [currentDate, setCurrentDate] = useState(new Date())

  // ✅ selected date
  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))

  // ✅ booking modal state
  const [openBooking, setOpenBooking] = useState(false)

  // ✅ derived values
  const monthIndex = currentDate.getMonth()
  const year = currentDate.getFullYear()

  const monthName = currentDate.toLocaleString("default", { month: "long" })

  // ✅ change month
  const changeMonth = (dir) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(monthIndex + dir)
    setCurrentDate(newDate)
  }

  // ✅ days in month
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  // ✅ bookings
  const roomBookings = mockBookingsByRoom[spaceName] || {}
  const bookings = roomBookings[selectedDate] || []

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">

      <div className="bg-white w-[95%] max-w-6xl rounded-xl flex shadow-lg">

        {/* LEFT → CALENDAR */}
        <div className="w-2/3 p-6 border-r border-gray-100">

          {/* Header */}
          <div className="flex justify-between items-center mb-4">

            <h2 className="text-xl font-semibold">
              {monthName} {year}
            </h2>

            <div className="flex gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="px-3 py-1 rounded hover:bg-gray-100"
              >
                ←
              </button>

              <button
                onClick={() => changeMonth(1)}
                className="px-3 py-1 rounded hover:bg-gray-100"
              >
                →
              </button>
            </div>

          </div>

          <div className="grid grid-cols-7 text-xs text-gray-400 mb-2">
  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
    <div key={d} className="text-center">{d}</div>
  ))}
</div>

          {/* Calendar */}
          <div className="grid grid-cols-7 gap-3 text-sm">

            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1

              const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  className={`bg-gray-50 rounded-lg p-3 cursor-pointer h-28 flex flex-col justify-between hover:bg-gray-100 transition
  ${selectedDate === dateKey ? "bg-green-50 ring-1 ring-green-400" : ""}
`}
                >
                  <span className="text-xs text-gray-500">
                    {day}
                  </span>

                  {/* booking preview */}
                  <div className="space-y-1">
                    {(roomBookings[dateKey] || []).slice(0, 2).map((b, idx) => (
                      <div
                        key={idx}
                        className={`text-[10px] px-1 rounded ${
                          b.status === "approved"
  ? "bg-blue-50 text-blue-600"
  : b.status === "pending"
  ? "bg-yellow-50 text-yellow-600"
  : "bg-green-50 text-green-600"
                        }`}
                      >
                        {b.time}
                      </div>
                    ))}
                  </div>

                </div>
              )
            })}

          </div>

        </div>

        {/* RIGHT → DETAILS */}
        <div className="w-1/3 p-6 overflow-y-auto">

          <div className="flex justify-between items-center">
            <div>
              <p className="text-green-600 text-sm font-semibold">
                Availability Details
              </p>

              <h2 className="text-xl font-bold">
                {spaceName}
              </h2>
            </div>

            <button onClick={onClose}>✕</button>
          </div>

          <div className="my-4 border-t border-gray-100" />

          {/* Slots */}
          <div className="space-y-4">

            {bookings.length === 0 && (
              <p className="text-gray-500 text-sm">
                No bookings for this day
              </p>
            )}

            {bookings.map((b, i) => (
              <div
                key={i}
                className="border rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{b.time}</p>
                  <p className="text-gray-500 text-sm">{b.title}</p>
                </div>

                <span
                  className={`px-3 py-1 rounded text-sm ${
                    b.status === "approved"
                      ? "bg-blue-50 text-blue-600"
                      : b.status === "pending"
                      ? "bg-yellow-50 text-yellow-600"
                      : "bg-green-50 text-green-600"
                  }`}
                >
                  {b.status}
                </span>
              </div>
            ))}

          </div>

          {/* Button */}
          <button
            onClick={() => setOpenBooking(true)}
            className="mt-6 w-full bg-green-700 text-white py-3 rounded-lg"
          >
            Open full booking form
          </button>

        </div>

      </div>

      {/* Booking Modal */}
      {openBooking && (
        <BookingModal
          spaceName={spaceName}
          onClose={() => setOpenBooking(false)}
        />
      )}

    </div>
  )
}

export default AvailabilityModal