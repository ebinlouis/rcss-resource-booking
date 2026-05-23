import Tooltip from "./Tooltip"
import { useState } from "react"
import BookingModal from "./BookingModal"

const MEDIA_BASE = "http://localhost:8000"

const mediaUrl = (path) =>
  !path ? null : path.startsWith("http") ? path : `${MEDIA_BASE}/media/${path}`

function RoomCard({ room, onOpenAvailability }) {
  const [openBooking, setOpenBooking] = useState(false)

  const formattedType = room.space_type
    ? room.space_type
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())
    : "Space"

  const capacity = room.capacity_hard || 0
  const isActive = room.is_active !== false
  const location = room.location || "Location not specified"
  const image = mediaUrl(room.image_1)

  const equipment = Array.isArray(room.built_in_equipment)
    ? room.built_in_equipment
    : []

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">

      {/* Top Section */}
      <div className="relative h-48 bg-gradient-to-br from-gray-50 to-emerald-50/40 flex items-center justify-center overflow-hidden">

        {/* Image */}
        {image ? (
          <>
            <img
              src={image}
              alt={room.name}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
            <div className="text-gray-200 group-hover:scale-110 transition-transform duration-500">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13H5v-2h14v2z" />
              </svg>
            </div>
          </>
        )}

        {/* Floating Badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">

          {/* Status */}
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
              isActive
                ? "bg-green-50 text-green-700 border border-green-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
            }`}
          >
            {isActive ? "Available" : "Maintenance"}
          </span>

          {/* Capacity */}
          <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-100 text-gray-500 text-xs font-medium shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {capacity}
          </span>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="p-6">

        {/* Type */}
        <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">
          {formattedType}
        </span>

        {/* Name */}
        <h2 className="text-lg font-semibold mt-1 text-gray-900 group-hover:text-green-700 transition-colors">
          {room.name}
        </h2>

        {/* Location */}
        <p className="text-gray-500 text-sm mt-2 line-clamp-2 font-light leading-relaxed flex items-center gap-1">
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          {location}
        </p>
        {/* Description */}
        {room.description && (
          <p className="text-gray-500 text-sm mt-1.5 line-clamp-2 font-light leading-relaxed">
            {room.description}
          </p>
        )}

        {/* Equipment */}
        {equipment.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              What's inside
            </p>
            <div className="flex flex-wrap gap-1.5">
              {equipment.map((eq) => (
                <span
                  key={eq.id}
                  className="bg-gray-50 border border-gray-100 px-2 py-0.5 text-[10px] rounded-full text-gray-500 font-medium"
                >
                  {eq.equipment_name}
                  {eq.quantity > 1 ? ` ×${eq.quantity}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-gray-50 flex items-center justify-between">

          <div className="flex flex-col">
            <span className="text-[10px] text-gray-300 uppercase font-bold">
              Check Status
            </span>
          </div>

          <div className="flex gap-2">

            {/* Schedule Button */}
            <Tooltip text="See which time slots are already booked so you can pick the right time." position="top">
              <button
                onClick={onOpenAvailability}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-emerald-500 hover:text-emerald-600 transition-all text-xs font-medium"
              >
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
                    d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Check Availability
              </button>
            </Tooltip>

            {/* Book Button */}
            <Tooltip text="Fill in the details and send a booking request for this venue." position="top">
              <button
                onClick={() => setOpenBooking(true)}
                className="bg-green-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-green-700 shadow-lg shadow-emerald-100 transition-all"
              >
                + Book Venue
              </button>
            </Tooltip>

          </div>
        </div>
      </div>

      {openBooking && (
        <BookingModal
          spaceId={room.id}
          spaceName={room.name}
          spaceCap={room.capacity_hard ?? null}
          onClose={() => setOpenBooking(false)}
        />
      )}
    </div>
  )
}

export default RoomCard