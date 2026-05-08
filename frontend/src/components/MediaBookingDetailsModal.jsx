import { createPortal } from "react-dom"
import { useState, useEffect } from "react"
import { rooms } from "../data/rooms"

const departments = [
  { id: 1, name: "Computer Science" },
  { id: 2, name: "Commerce" },
  { id: 3, name: "Management" },
  { id: 4, name: "Media Studies" }
]

// ── Field Wrapper ──
function Field({ label, required, children, error }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <span className="text-red-500 text-xs mt-0.5">{error}</span>}
    </div>
  )
}

const inputCls = (error) =>
  `w-full border ${error ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-green-600"
  } rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2`

// ── Section Label ──
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

const parseBookingTime = (time = "") => {
  const [start_time = "", end_time = ""] = time.split("-").map((segment) => segment.trim())
  return { start_time, end_time }
}

const buildFormData = (booking) => {
  const { start_time, end_time } = parseBookingTime(booking.time || `${booking.start_time || ""} - ${booking.end_time || ""}`)
  const selectedRoom = rooms.find((room) => room.name === booking.location || room.hall_name)
  const selectedDepartment = departments.find((dept) => dept.name === booking.department_name)

  return {
    event_name: booking.event || booking.event_name || "",
    hall_id: selectedRoom?.id || "",
    hall_name: selectedRoom?.name || booking.location || booking.hall_name || "",
    booking_date: booking.date || booking.booking_date || "",
    start_time,
    end_time,
    requested_by: booking.requested_by || "",
    organization: booking.organization || "",
    department_id: selectedDepartment?.id || "",
    department_name: selectedDepartment?.name || booking.department_name || "",
    remarks: booking.remarks || ""
  }
}

function MediaBookingDetailsModal({ booking, onClose }) {
  if (!booking) return null

  const [formData, setFormData] = useState(() => buildFormData(booking))
  const [errors, setErrors] = useState({})
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setFormData(buildFormData(booking))
    setErrors({})
  }, [booking])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ""
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.event_name.trim()) newErrors.event_name = "Event name is required"
    if (!formData.hall_id) newErrors.hall_id = "Hall is required"
    if (!formData.booking_date) newErrors.booking_date = "Booking date is required"
    if (!formData.start_time) newErrors.start_time = "Start time is required"
    if (!formData.end_time) newErrors.end_time = "End time is required"
    if (formData.start_time && formData.end_time) {
      if (formData.start_time >= formData.end_time) {
        newErrors.timeError = "End time must be after start time"
      }
    }
    if (!formData.requested_by.trim()) newErrors.requested_by = "Requested by is required"
    if (!formData.department_id) newErrors.department_id = "Department is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e?.preventDefault()

    if (validateForm()) {
      console.log("Updated media booking:", formData)
      onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">
        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              Booking Preview
            </p>
            <h2 className="text-2xl font-bold text-white">
              {formData.event_name || "Media Booking"}
            </h2>
            <p className="text-sm text-green-200/75 mt-3">
              Edit and save the booking details directly from the form.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase font-semibold">
                Selected slot
              </p>
              <p className="text-white text-sm font-semibold mt-1">
                {formData.start_time || "--:--"} - {formData.end_time || "--:--"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">
                  Location
                </p>
                <p className="text-white text-xs font-semibold mt-1 break-words">
                  {formData.hall_name || "Not selected"}
                </p>
              </div>

              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">
                  Department
                </p>
                <p className="text-white text-xs font-semibold mt-1 break-words">
                  {formData.department_name || "Not specified"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">
                Media & Equipment
              </p>
              <h2 className="text-xl font-bold">Edit Media Booking</h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
            {/* EVENT DETAILS */}
            <SectionLabel>Event Details</SectionLabel>

            <Field label="Event Name / Purpose" required error={errors.event_name}>
              <input
                type="text"
                name="event_name"
                className={inputCls(errors.event_name)}
                placeholder="e.g., College Annual Fest"
                value={formData.event_name}
                onChange={handleChange}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Location (Hall)" required error={errors.hall_id}>
                <select
                  name="hall_id"
                  className={inputCls(errors.hall_id)}
                  value={formData.hall_id}
                  onChange={(e) => {
                    const selected = rooms.find((r) => String(r.id) === e.target.value)
                    setFormData({
                      ...formData,
                      hall_id: selected?.id || "",
                      hall_name: selected?.name || ""
                    })
                    if (errors.hall_id) setErrors((prev) => ({ ...prev, hall_id: "" }))
                  }}
                >
                  <option value="">Select Hall</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Department" required error={errors.department_id}>
                <select
                  name="department_id"
                  className={inputCls(errors.department_id)}
                  value={formData.department_id}
                  onChange={(e) => {
                    const selected = departments.find(
                      (d) => String(d.id) === e.target.value
                    )
                    setFormData({
                      ...formData,
                      department_id: selected?.id || "",
                      department_name: selected?.name || ""
                    })
                    if (errors.department_id) setErrors((prev) => ({ ...prev, department_id: "" }))
                  }}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Requested By" required error={errors.requested_by}>
                <input
                  type="text"
                  name="requested_by"
                  className={inputCls(errors.requested_by)}
                  placeholder="Requested By"
                  value={formData.requested_by}
                  onChange={handleChange}
                />
              </Field>

              <Field label="Organization" error={errors.organization}>
                <input
                  type="text"
                  name="organization"
                  className={inputCls(errors.organization)}
                  placeholder="e.g. Leave empty if N/A"
                  value={formData.organization}
                  onChange={handleChange}
                />
              </Field>
            </div>

            {/* DATE & TIME */}
            <SectionLabel>Date & Time</SectionLabel>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Booking Date" required error={errors.booking_date}>
                <input
                  type="date"
                  name="booking_date"
                  className={inputCls(errors.booking_date)}
                  value={formData.booking_date}
                  onChange={handleChange}
                />
              </Field>

              <Field label="Start Time" required error={errors.start_time}>
                <input
                  type="time"
                  name="start_time"
                  className={inputCls(errors.start_time)}
                  value={formData.start_time}
                  onChange={handleChange}
                />
              </Field>

              <Field label="End Time" required error={errors.end_time}>
                <input
                  type="time"
                  name="end_time"
                  className={inputCls(errors.end_time)}
                  value={formData.end_time}
                  onChange={handleChange}
                />
              </Field>
            </div>

            {errors.timeError && (
              <p className="text-red-500 text-sm">{errors.timeError}</p>
            )}

            {/* NOTES */}
            <SectionLabel>Notes for approving office</SectionLabel>

            <Field label="Remarks" error={errors.remarks}>
              <textarea
                name="remarks"
                rows={3}
                className={`${inputCls(errors.remarks)} resize-none`}
                placeholder="Additional remarks (optional)..."
                value={formData.remarks}
                onChange={handleChange}
              />
            </Field>

          </div>

          {/* FOOTER */}
          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Booking
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (validateForm()) setShowSaveConfirm(true)
                }}
                className="px-5 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition"
              >
                Save Changes
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* SAVE CONFIRM MODAL */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Save Changes?</h2>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to update this media booking?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={handleSubmit} className="flex-1 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold">
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Delete Booking?</h2>
            <p className="text-sm text-gray-500 mb-1">You're about to delete your booking for</p>
            <p className="text-sm font-semibold text-gray-800 mb-1">{formData.event_name}</p>
            <p className="text-xs text-red-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Keep booking
              </button>
              <button onClick={() => { console.log("Deleted", formData); onClose(); }} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold">
                Yes, delete it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

export default MediaBookingDetailsModal