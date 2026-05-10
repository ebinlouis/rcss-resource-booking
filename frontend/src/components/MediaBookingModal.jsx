import { createPortal } from "react-dom"
import { useState, useEffect } from "react"
import mediaService from "../api/mediaApi"
import ErrorBoundary from "./ErrorBoundary"

// ── Field Wrapper ──────────────────────────────────────────────────────────
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
  `w-full border ${
    error ? "border-red-500 focus:ring-red-500" : "border-gray-200 focus:ring-green-600"
  } rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2`

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

const INITIAL_FORM = {
  event_name: "",
  space: "",
  booking_date: "",
  start_time: "",
  end_time: "",
  technical_contact_person: "",
  organization: "",
  requested_services: "",
  requested_equipment: "",
  user_notes: "",
}

function MediaBookingModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [errors, setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [spaces, setSpaces]     = useState([])

  // Load spaces using the shared api instance via mediaService
  useEffect(() => {
    mediaService.getSpaces()
      .then((data) => setSpaces(data))
      .catch((err) => console.error("Could not load spaces:", err))
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const validate = () => {
    const e = {}
    if (!formData.event_name.trim())               e.event_name = "Event name is required"
    if (!formData.space)                            e.space = "Hall is required"
    if (!formData.booking_date)                     e.booking_date = "Booking date is required"
    if (!formData.start_time)                       e.start_time = "Start time is required"
    if (!formData.end_time)                         e.end_time = "End time is required"
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      e.timeError = "End time must be after start time"
    }
    if (!formData.technical_contact_person.trim())  e.technical_contact_person = "Technical contact is required"

    if (formData.booking_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(formData.booking_date) < today) {
        e.booking_date = "Booking date cannot be in the past"
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validate()) return

    const payload = {
      event_name:               formData.event_name,
      space:                    formData.space,
      booking_date:             formData.booking_date,
      start_time:               formData.start_time,
      end_time:                 formData.end_time,
      technical_contact_person: formData.technical_contact_person,
      organization:             formData.organization,
      requested_services:       formData.requested_services,
      requested_equipment:      formData.requested_equipment,
      user_notes:               formData.user_notes,
    }

    try {
      setSubmitting(true)
      await mediaService.createBooking(payload)
      onSuccess?.()
      onClose()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        if (data.event_name)               mapped.event_name = Array.isArray(data.event_name) ? data.event_name[0] : data.event_name
        if (data.space)                    mapped.space = Array.isArray(data.space) ? data.space[0] : data.space
        if (data.booking_date)             mapped.booking_date = Array.isArray(data.booking_date) ? data.booking_date[0] : data.booking_date
        if (data.start_time)               mapped.start_time = Array.isArray(data.start_time) ? data.start_time[0] : data.start_time
        if (data.end_time)                 mapped.end_time = Array.isArray(data.end_time) ? data.end_time[0] : data.end_time
        if (data.technical_contact_person) mapped.technical_contact_person = Array.isArray(data.technical_contact_person) ? data.technical_contact_person[0] : data.technical_contact_person
        if (data.non_field_errors)         mapped.timeError = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors
        if (data.detail)                   mapped.timeError = data.detail
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Submission failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">
        <ErrorBoundary>

        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">Equipment Request</p>
            <h2 className="text-2xl font-bold text-white">Media Request</h2>
            <p className="text-sm text-green-200/75 mt-3">
              Request media team and equipment support for your scheduled event.
            </p>
          </div>
          <div className="space-y-2.5">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase font-semibold">Selected slot</p>
              <p className="text-white text-sm font-semibold mt-1">
                {formData.start_time || "--:--"} - {formData.end_time || "--:--"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Admin review</p>
                <p className="text-white text-xs font-semibold mt-1">Pending approval</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Notice</p>
                <p className="text-white text-xs font-semibold mt-1">48h advance</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">Media & Equipment</p>
              <h2 className="text-xl font-bold">Media Booking Form</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
            <SectionLabel>Event Details</SectionLabel>

            <Field label="Event Name / Purpose" required error={errors.event_name}>
              <input
                type="text" name="event_name"
                className={inputCls(errors.event_name)}
                placeholder="e.g., College Annual Fest"
                value={formData.event_name} onChange={handleChange}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Location (Hall)" required error={errors.space}>
                <select name="space" className={inputCls(errors.space)} value={formData.space} onChange={handleChange}>
                  <option value="">Select Hall</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Technical Contact Person" required error={errors.technical_contact_person}>
                <input
                  type="text" name="technical_contact_person"
                  className={inputCls(errors.technical_contact_person)}
                  placeholder="On-site contact name"
                  value={formData.technical_contact_person} onChange={handleChange}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Organization" error={errors.organization}>
                <input
                  type="text" name="organization"
                  className={inputCls(errors.organization)}
                  placeholder="Leave empty if N/A"
                  value={formData.organization} onChange={handleChange}
                />
              </Field>
              <Field label="Requested Services" error={errors.requested_services}>
                <input
                  type="text" name="requested_services"
                  className={inputCls(errors.requested_services)}
                  placeholder="e.g., 1 photographer, 1 videographer"
                  value={formData.requested_services} onChange={handleChange}
                />
              </Field>
            </div>

            <Field label="Requested Equipment" error={errors.requested_equipment}>
              <input
                type="text" name="requested_equipment"
                className={inputCls(errors.requested_equipment)}
                placeholder="e.g., 2 cameras, 1 projector, PA system"
                value={formData.requested_equipment} onChange={handleChange}
              />
            </Field>

            <SectionLabel>Date & Time</SectionLabel>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Booking Date" required error={errors.booking_date}>
                <input type="date" name="booking_date" className={inputCls(errors.booking_date)} value={formData.booking_date} onChange={handleChange} />
              </Field>
              <Field label="Start Time" required error={errors.start_time}>
                <input type="time" name="start_time" className={inputCls(errors.start_time)} value={formData.start_time} onChange={handleChange} />
              </Field>
              <Field label="End Time" required error={errors.end_time}>
                <input type="time" name="end_time" className={inputCls(errors.end_time)} value={formData.end_time} onChange={handleChange} />
              </Field>
            </div>

            {errors.timeError && <p className="text-red-500 text-sm">{errors.timeError}</p>}

            <SectionLabel>Notes for approving office</SectionLabel>

            <Field label="Remarks" error={errors.user_notes}>
              <textarea
                name="user_notes" rows={3}
                className={`${inputCls(errors.user_notes)} resize-none`}
                placeholder="Additional remarks (optional)..."
                value={formData.user_notes} onChange={handleChange}
              />
            </Field>
          </div>

          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50">
            <p className="text-xs text-gray-400">Submitting this sends the request for admin approval.</p>
            <div className="flex gap-2">
              <button onClick={onClose} disabled={submitting} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit} disabled={submitting}
                className="px-5 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send request"}
              </button>
            </div>
          </div>
        </div>
        </ErrorBoundary>
      </div>
    </div>,
    document.body
  )
}

export default MediaBookingModal
