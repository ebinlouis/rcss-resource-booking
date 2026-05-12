import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { getVehicles, createBooking, updateBooking } from "../api/fleetApi"

// ── Field Wrapper ──
function Field({ label, required, children, error }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400"

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

// ── Inline Alert ──
function Alert({ message }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
      {message}
    </div>
  )
}

// ==========================================
// TRANSPORT BOOKING MODAL
// ==========================================
function TransportBookingModal({ onClose, onSave, editData = null }) {
  const isEditMode = Boolean(editData)

  const [form, setForm] = useState({
    vehicle: editData?.vehicle ?? "",
    purpose: editData?.purpose ?? "",
    start_datetime: editData?.start_datetime
      ? editData.start_datetime.slice(0, 16)   // "YYYY-MM-DDTHH:MM"
      : "",
    end_datetime: editData?.end_datetime
      ? editData.end_datetime.slice(0, 16)
      : "",
    pickup_location: editData?.pickup_location ?? "",
    destination: editData?.destination ?? "",
    total_passengers: editData?.total_passengers ?? "",
    user_notes: editData?.user_notes ?? "",
  })

  const [vehicles, setVehicles] = useState([])
  const [loadingVehicles, setLoadingVehicles] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  // Fetch vehicle list on mount
  useEffect(() => {
    let cancelled = false
    getVehicles()
      .then((data) => {
        if (!cancelled) {
          // data may be an array directly or paginated { results: [] }
          setVehicles(Array.isArray(data) ? data : data.results ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) setApiError("Could not load vehicles. Please try again.")
      })
      .finally(() => {
        if (!cancelled) setLoadingVehicles(false)
      })
    return () => { cancelled = true }
  }, [])

  const set = (key, val) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  // Flatten DRF field-level errors into fieldErrors state
  const extractErrors = (errData) => {
    if (typeof errData === "string") {
      setApiError(errData)
      return
    }
    const fields = {}
    let generic = ""
    Object.entries(errData).forEach(([key, val]) => {
      const msg = Array.isArray(val) ? val.join(" ") : String(val)
      if (key === "non_field_errors" || key === "detail") {
        generic += msg + " "
      } else {
        fields[key] = msg
      }
    })
    setFieldErrors(fields)
    if (generic) setApiError(generic.trim())
  }

  const handleSubmit = async () => {
    setApiError("")
    setFieldErrors({})

    // Basic required-field guard (UX only — server validates too)
    const required = [
      "vehicle", "purpose", "start_datetime", "end_datetime",
      "pickup_location", "destination", "total_passengers",
    ]
    const missing = {}
    required.forEach((key) => {
      if (!form[key] && form[key] !== 0) {
        missing[key] = "This field is required."
      }
    })
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        vehicle: Number(form.vehicle),
        purpose: form.purpose,
        start_datetime: form.start_datetime,
        end_datetime: form.end_datetime,
        pickup_location: form.pickup_location,
        destination: form.destination,
        total_passengers: Number(form.total_passengers),
        user_notes: form.user_notes || "",
      }

      let result
      if (isEditMode) {
        result = await updateBooking(editData.id, payload)
      } else {
        result = await createBooking(payload)
      }

      onSave(result)
    } catch (err) {
      const errData = err?.response?.data
      if (errData) {
        extractErrors(errData)
      } else {
        setApiError("Something went wrong. Please check your connection and try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* ── LEFT PANEL ── */}
        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{
            background:
              "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
          }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {isEditMode ? "Edit Booking" : "New Booking"}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {isEditMode ? "Update Request" : "Transport Request"}
            </h2>
            <p className="text-sm text-green-200/75 mt-3">
              {isEditMode
                ? "Update the trip details below. Only PENDING bookings can be modified."
                : "Submit a structured transport request with vehicle, timing, and trip details."}
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase font-semibold">
                Vehicle Allocation
              </p>
              <p className="text-white text-sm font-semibold mt-1">
                Based on availability
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">
                  Approval
                </p>
                <p className="text-white text-xs font-semibold mt-1">
                  Admin review
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">
                  Status
                </p>
                <p className="text-white text-xs font-semibold mt-1">
                  Tracked live
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT FORM ── */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">
                Request Details
              </p>
              <h2 className="text-xl font-bold">
                {isEditMode ? "Edit Transport Booking" : "Transport Booking Form"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

            {/* Global API error */}
            <Alert message={apiError} />

            {/* TRANSPORT DETAILS */}
            <SectionLabel>Transport Details</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Vehicle"
                required
                error={fieldErrors.vehicle}
              >
                <select
                  className={inputCls}
                  value={form.vehicle}
                  onChange={(e) => set("vehicle", e.target.value)}
                  disabled={loadingVehicles}
                >
                  <option value="">
                    {loadingVehicles ? "Loading vehicles…" : "Select vehicle"}
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.registration_number} (cap: {v.capacity})
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Total passengers"
                required
                error={fieldErrors.total_passengers}
              >
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  placeholder="e.g. 40"
                  value={form.total_passengers}
                  onChange={(e) => set("total_passengers", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Purpose" required error={fieldErrors.purpose}>
              <input
                className={inputCls}
                placeholder="e.g. Industrial visit, Event transport…"
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
              />
            </Field>

            {/* DATE & TIME */}
            <SectionLabel>Date & Time</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Start date & time"
                required
                error={fieldErrors.start_datetime}
              >
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.start_datetime}
                  onChange={(e) => set("start_datetime", e.target.value)}
                />
              </Field>

              <Field
                label="End date & time"
                required
                error={fieldErrors.end_datetime}
              >
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.end_datetime}
                  onChange={(e) => set("end_datetime", e.target.value)}
                />
              </Field>
            </div>

            {/* TRIP DETAILS */}
            <SectionLabel>Trip Details</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Pickup location"
                required
                error={fieldErrors.pickup_location}
              >
                <input
                  className={inputCls}
                  placeholder="e.g. College main gate"
                  value={form.pickup_location}
                  onChange={(e) => set("pickup_location", e.target.value)}
                />
              </Field>

              <Field
                label="Destination"
                required
                error={fieldErrors.destination}
              >
                <input
                  className={inputCls}
                  placeholder="e.g. Kochi"
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                />
              </Field>
            </div>

            {/* NOTES */}
            <SectionLabel>Notes for approving office</SectionLabel>

            <textarea
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Mention route details, stops, special instructions…"
              value={form.user_notes}
              onChange={(e) => set("user_notes", e.target.value)}
            />

          </div>

          {/* FOOTER */}
          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50">
            <p className="text-xs text-gray-400">
              {isEditMode
                ? "Saving will update the existing request."
                : "Submitting sends the request for admin approval."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || loadingVehicles}
                className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition disabled:opacity-60 flex items-center gap-2"
              >
                {submitting && (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                )}
                {submitting
                  ? isEditMode ? "Saving…" : "Sending…"
                  : isEditMode ? "Save changes" : "Send request"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}

export default TransportBookingModal
