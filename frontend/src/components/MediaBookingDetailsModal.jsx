import { createPortal } from "react-dom"
import { useState, useEffect } from "react"
import mediaService from "../api/mediaApi"

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

const buildFormData = (b) => ({
  event_name:               b.event_name ?? "",
  space:                    b.space ?? "",
  booking_date:             b.booking_date ?? "",
  start_time:               b.start_time?.slice(0, 5) ?? "",
  end_time:                 b.end_time?.slice(0, 5) ?? "",
  technical_contact_person: b.technical_contact_person ?? "",
  organization:             b.organization ?? "",
  requested_services:       b.requested_services ?? "",
  requested_equipment:      b.requested_equipment ?? "",
  user_notes:               b.user_notes ?? "",
})

function MediaBookingDetailsModal({ booking, onClose, onRefresh }) {
  if (!booking) return null

  const [formData, setFormData]             = useState(() => buildFormData(booking))
  const [errors, setErrors]                 = useState({})
  const [showSaveConfirm, setShowSaveConfirm]   = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [deleting, setDeleting]             = useState(false)
  const [spaces, setSpaces]                 = useState([])

  useEffect(() => {
    setFormData(buildFormData(booking))
    setErrors({})
  }, [booking])

  // Uses shared api instance via mediaService — no raw axios
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
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) { setShowSaveConfirm(false); return }
    try {
      setSubmitting(true)
      await mediaService.updateBooking(booking.id, {
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
      })
      setShowSaveConfirm(false)
      onRefresh?.()
    } catch (err) {
      setShowSaveConfirm(false)
      const data = err.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        if (data.event_name)       mapped.event_name = Array.isArray(data.event_name) ? data.event_name[0] : data.event_name
        if (data.space)            mapped.space = Array.isArray(data.space) ? data.space[0] : data.space
        if (data.booking_date)     mapped.booking_date = Array.isArray(data.booking_date) ? data.booking_date[0] : data.booking_date
        if (data.start_time)       mapped.start_time = Array.isArray(data.start_time) ? data.start_time[0] : data.start_time
        if (data.end_time)         mapped.end_time = Array.isArray(data.end_time) ? data.end_time[0] : data.end_time
        if (data.non_field_errors) mapped.timeError = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors
        if (data.detail)           mapped.timeError = data.detail
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Update failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await mediaService.deleteBooking(booking.id)
      setShowDeleteConfirm(false)
      onRefresh?.()
    } catch (err) {
      console.error("Delete failed:", err)
      setErrors({ timeError: "Could not delete booking. Please try again." })
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const selectedSpaceName =
    spaces.find((s) => String(s.id) === String(formData.space))?.name ??
    booking.space_details?.name ?? "Not selected"

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">Booking Preview</p>
            <h2 className="text-2xl font-bold text-white">{formData.event_name || "Media Booking"}</h2>
            <p className="text-sm text-green-200/75 mt-3">Edit and save the booking details directly from the form.</p>
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
                <p className="text-[9px] text-green-300 uppercase font-semibold">Location</p>
                <p className="text-white text-xs font-semibold mt-1 break-words">{selectedSpaceName}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Department</p>
                <p className="text-white text-xs font-semibold mt-1 break-words">
                  {booking.department?.department_name ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">Media & Equipment</p>
              <h2 className="text-xl font-bold">Edit Media Booking</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
            {errors.timeError && (
              <div className="px-4 py-2 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                {errors.timeError}
              </div>
            )}

            <SectionLabel>Event Details</SectionLabel>

            <Field label="Event Name / Purpose" required error={errors.event_name}>
              <input type="text" name="event_name" className={inputCls(errors.event_name)}
                placeholder="e.g., College Annual Fest" value={formData.event_name} onChange={handleChange} />
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
                <input type="text" name="technical_contact_person" className={inputCls(errors.technical_contact_person)}
                  placeholder="On-site contact name" value={formData.technical_contact_person} onChange={handleChange} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Organization" error={errors.organization}>
                <input type="text" name="organization" className={inputCls(errors.organization)}
                  placeholder="Leave empty if N/A" value={formData.organization} onChange={handleChange} />
              </Field>
              <Field label="Requested Services" error={errors.requested_services}>
                <input type="text" name="requested_services" className={inputCls(errors.requested_services)}
                  placeholder="e.g., 1 photographer" value={formData.requested_services} onChange={handleChange} />
              </Field>
            </div>

            <Field label="Requested Equipment" error={errors.requested_equipment}>
              <input type="text" name="requested_equipment" className={inputCls(errors.requested_equipment)}
                placeholder="e.g., 2 cameras, 1 projector" value={formData.requested_equipment} onChange={handleChange} />
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

            <SectionLabel>Notes for approving office</SectionLabel>

            <Field label="Remarks" error={errors.user_notes}>
              <textarea name="user_notes" rows={3}
                className={`${inputCls(errors.user_notes)} resize-none`}
                placeholder="Additional remarks (optional)..."
                value={formData.user_notes} onChange={handleChange} />
            </Field>

            {booking.remarks_by_admin && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Admin Remarks</p>
                <p className="text-sm text-amber-800">{booking.remarks_by_admin}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50">
            <button
              type="button" onClick={() => setShowDeleteConfirm(true)}
              disabled={submitting || deleting}
              className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Booking
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={submitting || deleting}
                className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={() => { if (validate()) setShowSaveConfirm(true) }}
                disabled={submitting || deleting}
                className="px-5 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition disabled:opacity-60">
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SAVE CONFIRM */}
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
              <button onClick={() => setShowSaveConfirm(false)} disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={handleSave} disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold disabled:opacity-60">
                {submitting ? "Saving..." : "Yes, Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
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
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Keep booking
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60">
                {deleting ? "Deleting..." : "Yes, delete it"}
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
