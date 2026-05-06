import { createPortal } from "react-dom"
import { useState } from "react"
import { rooms } from "../data/rooms"

const departments = [
  { id: 1, name: "Computer Science" },
  { id: 2, name: "Commerce" },
  { id: 3, name: "Management" },
  { id: 4, name: "Media Studies" }
]

function MediaBookingModal({ onClose }) {
  const [formData, setFormData] = useState({
    event_name: "",
    hall_id: "",
    hall_name: "",
    booking_date: "",
    start_time: "",
    end_time: "",
    requested_by: "",
    organization: "",
    department_id: "",
    department_name: "",
    remarks: ""
  })

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ""
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.event_name.trim()) {
      newErrors.event_name = "Event name is required"
    }
    if (!formData.hall_id) {
      newErrors.hall_id = "Hall is required"
    }
    if (!formData.booking_date) {
      newErrors.booking_date = "Booking date is required"
    }
    if (!formData.start_time) {
      newErrors.start_time = "Start time is required"
    }
    if (!formData.end_time) {
      newErrors.end_time = "End time is required"
    }
    if (formData.start_time && formData.end_time) {
      if (formData.start_time >= formData.end_time) {
        newErrors.timeError = "End time must be after start time"
      }
    }
    if (!formData.requested_by.trim()) {
      newErrors.requested_by = "Requested by is required"
    }
    if (!formData.department_id) {
      newErrors.department_id = "Department ID is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (validateForm()) {
      console.log("Media booking submitted:", formData)
      onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex overflow-hidden">
        <div className="md:flex w-full">
          {/* Left Preview Panel */}
          <div className="w-full md:w-1/3 bg-gradient-to-b from-green-900 to-blue-900 text-white p-5 space-y-6">
            <div className="space-y-2">
              <p className="text-xs tracking-[0.24em] uppercase text-white/70">Equipment Request</p>
              <h3 className="text-2xl font-semibold">
                Media Request
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Request media team and equipment support for your scheduled event.
              </p>
            </div>

            <div className="space-y-3 rounded-3xl bg-white/10 p-4">
              <div className="text-sm text-white/80">Selected slot</div>
              <div className="text-xl font-semibold">
                {formData.start_time || "--:--"} - {formData.end_time || "--:--"}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-white/80">Admin review</p>
                <p className="mt-2 text-base font-medium">Pending approval</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-white/80">48h notice</p>
                <p className="mt-2 text-base font-medium">Plan ahead for media support</p>
              </div>
            </div>

            <div className="space-y-2 rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-white/80">Booking preview</p>
              <div className="text-sm">
                <span className="font-medium">Event:</span> {formData.event_name || "Not specified"}
              </div>
              <div className="text-sm">
                <span className="font-medium">Requested by:</span> {formData.requested_by || "Not specified"}
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="w-full md:w-2/3 p-5">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">Media & Equipment Request</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Fill in the details to request media team and equipment support for your event.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-2xl font-light"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name / Purpose *
                </label>
                <input
                  type="text"
                  name="event_name"
                  value={formData.event_name}
                  onChange={handleChange}
                  placeholder="e.g., College Annual Fest"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.event_name
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                />
                {errors.event_name && (
                  <p className="text-red-500 text-sm mt-1">{errors.event_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Location (Hall) *
                </label>
                <select
                  name="hall_id"
                  value={formData.hall_id}
                  onChange={(e) => {
                    const selected = rooms.find((r) => r.id === parseInt(e.target.value))
                    setFormData({
                      ...formData,
                      hall_id: selected?.id || "",
                      hall_name: selected?.name || ""
                    })
                  }}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.hall_id
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                >
                  <option value="">Select Hall</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                {errors.hall_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.hall_id}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department *
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => {
                    const selected = departments.find(
                      (d) => d.id === parseInt(e.target.value)
                    )

                    setFormData({
                      ...formData,
                      department_id: selected?.id || "",
                      department_name: selected?.name || ""
                    })
                  }}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.department_id
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.department_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.department_id}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking Date *
                </label>
                <input
                  type="date"
                  name="booking_date"
                  value={formData.booking_date}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.booking_date
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                />
                {errors.booking_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.booking_date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.start_time
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                />
                {errors.start_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.start_time}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.end_time
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                />
                {errors.end_time && (
                  <p className="text-red-500 text-sm mt-1">{errors.end_time}</p>
                )}
              </div>

              {errors.timeError && (
                <div className="col-span-2">
                  <p className="text-red-500 text-sm px-4 py-2 bg-red-50 rounded-md">
                    {errors.timeError}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requested By *
                </label>
                <input
                  type="text"
                  name="requested_by"
                  value={formData.requested_by}
                  onChange={handleChange}
                  placeholder="Requested By"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.requested_by
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                />
                {errors.requested_by && (
                  <p className="text-red-500 text-sm mt-1">{errors.requested_by}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization (Optional)
                </label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  placeholder="Enter organization or leave empty"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 ${
                    errors.organization
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:ring-green-500"
                  }`}
                />
                {errors.organization && (
                  <p className="text-red-500 text-sm mt-1">{errors.organization}</p>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Additional remarks (optional)"
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="col-span-2 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MediaBookingModal