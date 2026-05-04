import { useState } from "react"
import BookingModal from "./BookingModal"

function RoomCard({ room, onOpenAvailability }) {

  const [openBooking, setOpenBooking] = useState(false)

  return (
    
    <div className="bg-white rounded-xl shadow-sm border hover:shadow-md hover:scale-[1.01] transition">

      {/* Top Section (Image-ready) */}
      <div className="relative h-40 bg-gradient-to-r from-green-700 to-green-500 overflow-hidden">

        {/* FUTURE IMAGE */}
        {/* Uncomment later when image is available */}
        {/* 
        <img
          src={room.image}
          alt={room.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        */}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Content */}
        <div className="relative z-10 flex justify-between items-center p-4 text-white text-sm">

          {/* Capacity */}
          <span className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m0-4a4 4 0 110-8 4 4 0 010 8zm6 0a4 4 0 100-8 4 4 0 000 8z"
              />
            </svg>

            {room.capacity}
          </span>

          {/* Status */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              room.status === "Available"
                ? "bg-white text-green-700"
                : "bg-white text-yellow-600"
            }`}
          >
            {room.status}
          </span>

        </div>

      </div>
      
      {/* Bottom Section */}
      <div className="p-4">

        {/* Type */}
        <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">
          {room.type}
        </p>

        {/* Name */}
        <h2 className="text-base font-semibold mt-1 text-gray-900">
          {room.name}
        </h2>

        {/* Description */}
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          {room.description}
        </p>

        {/* Features */}
        <div className="flex flex-wrap gap-2 mt-3">
          {room.features.map((f, i) => (
            <span
              key={i}
              className="bg-gray-100 px-2 py-1 text-xs rounded-md text-gray-600"
            >
              {f}
            </span>
          ))}
        </div>
        
        {/* Availability text */}
        <p className="text-sm text-gray-500 mt-2">
          8 slots available today
        </p>

        {/* Buttons */}
        <div className="flex gap-2 mt-4">

          {/* Availability */}
          <button
  onClick={onOpenAvailability}
  className="flex-1 border rounded-md py-2 text-sm flex items-center justify-center gap-2 hover:bg-gray-100 transition"
>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-600"
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

            Availability
          </button>

          {/* Book */}
          <button
            onClick={() => setOpenBooking(true)}
            className="flex-1 bg-green-600 text-white rounded-md py-2 text-sm hover:bg-green-700 transition"
          >
            + Book
          </button>

        </div>

      </div>

      {/* Booking Modal (still fine here) */}
      {openBooking && (
        <BookingModal
          spaceName={room.name}
          onClose={() => setOpenBooking(false)}
        />
      )}

    </div>
  )
}

export default RoomCard