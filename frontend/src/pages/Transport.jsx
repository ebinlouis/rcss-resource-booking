import React from "react"

function Transport() {

  const bookings = [
    {
      time: "09:00",
      title: "College Bus - Route A",
      desc: "Pickup: Kakkanad → Campus",
      status: "confirmed"
    },
    {
      time: "11:00",
      title: "Van Booking",
      desc: "Dept visit, 11:00 - 02:00",
      status: "pending"
    }
  ]

  return (
    <div className="p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Transport Bookings
          </h1>
          <p className="text-gray-500">
            Your bus and vehicle bookings for today
          </p>
        </div>
      </div>

      {/* Today's bookings */}
      <div>
        <h2 className="text-lg font-semibold mb-2">
          Today's bookings
        </h2>

        <p className="text-gray-500 text-sm mb-4">
          Confirmed and pending transport usage for today.
        </p>

        <div className="border rounded-xl overflow-hidden">

          {/* Header row */}
          <div className="grid grid-cols-4 bg-gray-100 text-gray-500 text-sm px-4 py-2">
            <span>TIME</span>
            <span className="col-span-3">BOOKING</span>
          </div>

          {/* Data */}
          {bookings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-4 items-center px-4 py-4 border-t"
            >

              <span className="font-semibold text-gray-600">
                {b.time}
              </span>

              <div
                className={`col-span-3 p-4 rounded-xl border ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-yellow-50 border-yellow-300"
                }`}
              >
                <div className="flex justify-between items-center">

                  <div>
                    <h3 className="font-semibold">
                      {b.title}
                    </h3>

                    <p className="text-sm text-gray-500">
                      {b.desc}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      b.status === "confirmed"
                        ? "bg-blue-200 text-blue-700"
                        : "bg-yellow-200 text-yellow-700"
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

    </div>
  )
}

export default Transport