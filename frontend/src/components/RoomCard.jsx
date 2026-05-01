import { useState } from "react"
import BookingModal from "./BookingModal"
import AvailabilityModal from "./AvailabilityModal"

function RoomCard({ room }) {

  // Modal states
  const [openBooking, setOpenBooking] = useState(false)
  const [openAvailability, setOpenAvailability] = useState(false)

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">

      {/* Top Section */}
      <div className="h-40 bg-gradient-to-r from-green-700 to-green-500 text-white p-4">
        <div className="flex justify-between">
          <span className="bg-white/20 px-3 py-1 rounded text-sm">
            👥 {room.capacity}
          </span>

          <span className="bg-white/20 px-3 py-1 rounded text-sm">
            {room.status}
          </span>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-4">

        <p className="text-xs text-green-600 font-semibold">
          {room.type}
        </p>

        <h2 className="text-lg font-bold mt-1">
          {room.name}
        </h2>

        <p className="text-gray-500 text-sm mt-2">
          {room.description}
        </p>

        {/* Features */}
        <div className="flex flex-wrap gap-2 mt-3">
          {room.features.map((f, i) => (
            <span
              key={i}
              className="bg-gray-100 px-2 py-1 text-xs rounded"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-4">

          {/* Availability */}
          <button
            onClick={() => setOpenAvailability(true)}
            className="flex-1 border rounded-md py-2 text-sm hover:bg-gray-100"
          >
            Availability
          </button>

          {/* Book */}
          <button
            onClick={() => setOpenBooking(true)}
            className="flex-1 bg-green-700 text-white rounded-md py-2 text-sm hover:bg-green-800"
          >
            + Book
          </button>

        </div>

      </div>

      {/* Booking Modal */}
      {openBooking && (
        <BookingModal
          spaceName={room.name}
          onClose={() => setOpenBooking(false)}
        />
      )}

      {/* Availability Modal */}
      {openAvailability && (
        <AvailabilityModal
          spaceName={room.name}
          onClose={() => setOpenAvailability(false)}
        />
      )}

    </div>
  )
}

export default RoomCard