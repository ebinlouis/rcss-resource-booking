import { useNavigate } from "react-router-dom"
import { useMyFleetBookings } from "../hooks/useFleetQueries"
import { Bus, CalendarClock } from "lucide-react"

const STATUS_STYLES = {
  APPROVED:  "bg-green-100 text-green-700",
  PENDING:   "bg-amber-100 text-amber-700",
  REJECTED:  "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  EXPIRED:   "bg-orange-100 text-orange-700",
  CANCELLED: "bg-gray-100 text-gray-600",
}

function TransportMyRequests() {
  const navigate = useNavigate()
  const { data: queryData = [], isLoading } = useMyFleetBookings()
  const myBookings = queryData || []

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
          <Bus className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">No requests yet</p>
          <p className="text-xs text-gray-400 mt-0.5">Your bookings will appear here</p>
        </div>

      /* Booking list — show latest 3 */
      ) : (
        <div className="space-y-2">
          {myBookings.slice(0, 3).map((booking) => (
            <div
              key={booking.id}
              className="p-3 bg-gray-50 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm text-gray-800 leading-tight truncate flex-1">
                  {booking.vehicle_details?.name || `Vehicle #${booking.vehicle}`}
                </h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {booking.status}
                </span>
              </div>

              <p className="text-xs text-gray-500 truncate mb-1.5">
                {booking.pickup_location} → {booking.destination}
              </p>

              <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {new Date(booking.start_datetime).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* View all button */}
      <button
        onClick={() => navigate("/transport/my-bookings")}
        className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
      >
        View all bookings
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

    </div>
  )
}

export default TransportMyRequests