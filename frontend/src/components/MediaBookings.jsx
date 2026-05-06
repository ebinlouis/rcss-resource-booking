import { useState } from "react"
import { mediaBookings } from "../data/mediaBookings"
import MediaBookingDetailsModal from "./MediaBookingDetailsModal"

function MediaBookings({ onOpen }) {
  const [selectedBooking, setSelectedBooking] = useState(null)
  return (
    <div className="space-y-3">
      {/* Empty State */}
      {mediaBookings.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <p className="text-gray-500 text-lg font-medium">
            No more bookings today!
          </p>
          <p className="text-gray-400 text-sm mt-1">
            You're all caught up. Enjoy your day!
          </p>
        </div>
      )}

      {/* Booking Cards */}
      {mediaBookings.map((b) => (
        <div
          key={b.id}
          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white hover:shadow-md transition cursor-pointer"
          onClick={() => setSelectedBooking(b)}
        >
          {/* Left: Icon + Time */}
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                b.service === "Photography"
                  ? "bg-green-100 text-green-600"
                  : "bg-yellow-100 text-yellow-600"
              }`}
            >
              {b.service === "Photography" ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
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
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{b.time}</p>
              <p className="text-xs text-gray-500">{b.event}</p>
            </div>
          </div>

          {/* Middle: Event Details */}
          <div className="flex-1 px-4">
            <p className="font-semibold text-gray-900">{b.event}</p>
            <p className="text-sm text-gray-500">
              {b.location} • {b.service}
            </p>
          </div>

          {/* Right: Status Badge */}
          <span
            className={`px-4 py-2 text-xs font-semibold rounded-full ${
              b.status === "confirmed"
                ? "bg-blue-100 text-blue-600"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
          </span>
        </div>
      ))}
      {selectedBooking && (
        <MediaBookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  )
}

export default MediaBookings