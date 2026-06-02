import { useNavigate } from "react-router-dom"
import { useMyMessBookings } from "../hooks/useMessQueries"
import { Utensils } from "lucide-react"

const getStatusStyle = (status) => {
  switch (status?.toLowerCase()) {
    case "approved":
    case "confirmed": return "bg-blue-100 text-blue-700"
    case "completed": return "bg-slate-100 text-slate-600"
    case "expired":   return "bg-orange-100 text-orange-700"
    case "rejected":  return "bg-red-100 text-red-700"
    default:          return "bg-amber-100 text-amber-700"
  }
}

const formatShortDate = (dateStr) => {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`
}

const todayStr = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
})()

function MessMyRequests() {
  const navigate = useNavigate()
  const { data: bookingsData = [], isLoading } = useMyMessBookings()
  const myBookings = bookingsData || []

  // Show upcoming first, then past — latest 3
  const sorted = [...myBookings].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
  const preview = sorted.slice(0, 3)

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 sticky top-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">My Requests</h2>
        {myBookings.length > 0 && (
          <span className="text-xs text-gray-400 font-medium">
            {myBookings.length} total
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[68px] bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>

      /* Empty state */
      ) : myBookings.length === 0 ? (
        <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <Utensils className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No requests yet</p>
          <p className="text-xs text-gray-400 mt-0.5">Your food bookings will appear here</p>
        </div>

      /* Booking list */
      ) : (
        <div className="space-y-2">
          {preview.map((booking) => (
            <div
              key={booking.id}
              className="p-3 bg-gray-50 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm text-gray-800 leading-tight truncate flex-1">
                  {booking.purpose_of_programme || "Food Booking"}
                </h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${getStatusStyle(booking.status)}`}>
                  {booking.status}
                </span>
              </div>

              <p className="text-xs text-gray-500 truncate mb-1.5">
                {booking.delivery_location || "—"}
              </p>

              <p className="text-[11px] text-gray-400 font-medium">
                {formatShortDate(booking.start_date)}
                {booking.end_date && booking.end_date !== booking.start_date &&
                  ` → ${formatShortDate(booking.end_date)}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* View all button */}
      <button
        onClick={() => navigate("/mess/my-bookings")}
        className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-green-700 hover:bg-green-800 rounded-lg transition"
      >
        View all bookings
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

    </div>
  )
}

export default MessMyRequests