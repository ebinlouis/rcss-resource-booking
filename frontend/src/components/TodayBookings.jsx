import { bookings } from "../data/bookings"

function TodayBookings() {
  return (
    <div className="mt-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Today's bookings
          </h2>
          <p className="text-sm text-gray-500">
            Confirmed and pending room usage for the selected date.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Confirmed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            Pending
          </span>
        </div>
      </div>

      {/* Table container */}
      <div className="border rounded-lg overflow-hidden bg-white">

        {/* Header Row */}
        <div className="grid grid-cols-12 px-4 py-3 text-sm text-gray-500 border-b bg-gray-50">
          <div className="col-span-2">TIME</div>
          <div className="col-span-10">BOOKING</div>
        </div>

        {/* Rows */}
        {bookings.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-12 px-4 py-4 border-b last:border-none items-center"
          >

            {/* TIME */}
            <div className="col-span-2 font-semibold text-gray-700">
              {b.time}
            </div>

            {/* BOOKING BOX */}
            <div className="col-span-10">

              <div
                className={`flex justify-between items-center px-4 py-3 rounded-lg border ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >

                {/* Left Content */}
                <div>
                  <p className="font-semibold text-gray-900">
                    {b.hall}
                  </p>
                  <p className="text-sm text-gray-600">
                    {b.title}, {b.duration}
                  </p>
                </div>

                {/* Status */}
                <span
                  className={`px-3 py-1 text-xs rounded-full font-medium ${
                    b.status === "confirmed"
                      ? "bg-blue-100 text-blue-600"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {b.status === "confirmed" ? "Confirmed" : "Pending"}
                </span>

              </div>

            </div>

          </div>
        ))}

      </div>

    </div>
  )
}

export default TodayBookings