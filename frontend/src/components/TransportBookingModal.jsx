import { useState } from "react"

function TransportBookingModal({ onClose }) {

  const [form, setForm] = useState({
    department: "",
    purpose: "",
    booking_date: "",
    total_passengers: "",
    pickup_location: "",
    destination: "",
    pickup_time: "",
    return_time: "",
    requested_by: "",
    remarks: ""
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">

      {/* MAIN CONTAINER */}
      <div className="bg-white w-[95%] max-w-5xl h-[90vh] rounded-xl overflow-hidden flex relative">

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 text-xl z-50"
        >
          ✕
        </button>

        {/* ================= LEFT PANEL ================= */}
        <div className="w-1/3 bg-gradient-to-b from-green-800 to-blue-900 text-white p-6 flex flex-col justify-between">

          <div>
            <p className="text-sm opacity-80 mb-2">
              NEW BOOKING
            </p>

            <h2 className="text-2xl font-bold mb-4">
              Transport Request
            </h2>

            <p className="text-sm opacity-80">
              Submit your transport request with pickup, destination,
              timing, and passenger details.
            </p>
          </div>

          {/* Bottom info cards */}
          <div className="space-y-3">

            <div className="bg-white/10 p-3 rounded-lg">
              <p className="text-xs opacity-80">Selected Date</p>
              <p className="font-semibold">Auto from calendar</p>
            </div>

            <div className="flex gap-2">
              <div className="bg-white/10 p-3 rounded-lg flex-1">
                <p className="text-xs opacity-80">Approval</p>
                <p className="font-semibold">Admin review</p>
              </div>

              <div className="bg-white/10 p-3 rounded-lg flex-1">
                <p className="text-xs opacity-80">Policy</p>
                <p className="font-semibold">Based on request</p>
              </div>
            </div>

          </div>

        </div>

        {/* ================= RIGHT FORM ================= */}
        <div className="w-2/3 p-6 overflow-y-auto">

          <h2 className="text-xl font-semibold mb-6">
            Complete booking form
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">

            {/* PURPOSE */}
            <div className="col-span-2">
              <label className="text-sm font-medium">Purpose</label>
              <textarea
                name="purpose"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* DEPARTMENT */}
            <div>
              <label className="text-sm font-medium">Department</label>
              <select
                name="department"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              >
                <option value="">Select Department</option>
                <option>CS</option>
                <option>Commerce</option>
                <option>Management</option>
              </select>
            </div>

            {/* REQUESTED BY */}
            <div>
              <label className="text-sm font-medium">Requested By</label>
              <input
                name="requested_by"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* DATE */}
            <div>
              <label className="text-sm font-medium">Booking Date</label>
              <input
                type="date"
                name="booking_date"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* PASSENGERS */}
            <div>
              <label className="text-sm font-medium">Total Passengers</label>
              <input
                type="number"
                name="total_passengers"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* PICKUP */}
            <div>
              <label className="text-sm font-medium">Pickup Location</label>
              <input
                name="pickup_location"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* DESTINATION */}
            <div>
              <label className="text-sm font-medium">Destination</label>
              <input
                name="destination"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* PICKUP TIME */}
            <div>
              <label className="text-sm font-medium">Pickup Time</label>
              <input
                type="time"
                name="pickup_time"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
                required
              />
            </div>

            {/* RETURN TIME */}
            <div>
              <label className="text-sm font-medium">Return Time</label>
              <input
                type="time"
                name="return_time"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
              />
            </div>

            {/* REMARKS */}
            <div className="col-span-2">
              <label className="text-sm font-medium">Remarks</label>
              <textarea
                name="remarks"
                onChange={handleChange}
                className="w-full border rounded p-2 mt-1"
              />
            </div>

            {/* SUBMIT */}
            <div className="col-span-2">
              <button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg mt-2"
              >
                Submit Booking
              </button>
            </div>

          </form>

        </div>

      </div>

    </div>
  )
}

export default TransportBookingModal