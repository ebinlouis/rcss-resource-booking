import { useState } from "react"
import BookingModal from "./BookingModal"

function RoomCard({ room, onOpenAvailability }) {
  const [openBooking, setOpenBooking] = useState(false)

  // --- SAFE FALLBACKS FOR DJANGO DATABASE FIELDS ---
  const features = room.features || []
  
  // Format "GENERAL_HALL" to "General Hall" safely
  const formattedType = room.space_type 
    ? room.space_type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
    : "Space"
    
  const capacity = room.capacity_hard || 0
  const isActive = room.is_active !== false // Defaults to true
  const location = room.location || "Location not specified"

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 overflow-hidden">
      
      {/* Top Section - Minimalist */}
      <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

        {/* Floating Badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          {/* Status Badge - Mapped to Database is_active */}
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
            isActive
              ? "bg-green-50 text-green-600 border border-green-100"
              : "bg-amber-50 text-amber-600 border border-amber-100"
          }`}>
            {isActive ? "Available" : "Maintenance"}
          </span>

          {/* Capacity - Minimalist with Icon */}
          <span className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-gray-100 text-gray-500 text-xs font-medium shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {capacity}
          </span>
        </div>

        {/* Room Type Icon/Illustration Placeholder */}
        <div className="text-gray-200 group-hover:scale-110 transition-transform duration-500">
           <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
             <path d="M19 13H5v-2h14v2z" /> 
           </svg>
        </div>
      </div>
      
      {/* Bottom Section */}
      <div className="p-6">
        {/* Type Label */}
        <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">
          {formattedType}
        </span>

        {/* Name */}
        <h2 className="text-lg font-semibold mt-1 text-gray-900 group-hover:text-green-600 transition-colors">
          {room.name}
        </h2>

        {/* Description mapped to Location (since DB doesn't have description yet) */}
        <p className="text-gray-500 text-sm mt-2 line-clamp-2 font-light leading-relaxed flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {location}
        </p>

        {/* Features - Pill Style (Safe Map) */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {features.map((f, i) => (
              <span key={i} className="bg-gray-50 border border-gray-100 px-2 py-0.5 text-[10px] rounded-full text-gray-400">
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Footer info & Buttons */}
        <div className="mt-6 pt-5 border-t border-gray-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-300 uppercase font-bold">Check Status</span>
            <span className="text-xs text-gray-600 font-medium">View Calendar</span>
          </div>

          <div className="flex gap-2">
            {/* Availability Button */}
            <button 
              onClick={onOpenAvailability}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-emerald-500 hover:text-emerald-600 transition-all text-xs font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Schedule
            </button>

            {/* Book Now Button */}
            <button
              onClick={() => setOpenBooking(true)}
              className="bg-green-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-green-700 shadow-lg shadow-emerald-100 transition-all"
            >
              + Book Now
            </button>
          </div>
        </div>
      </div>

      {openBooking && (
        <BookingModal
          spaceId={room.id}
          spaceName={room.name}
          onClose={() => setOpenBooking(false)}
        />
      )}
    </div>
  )
}

export default RoomCard