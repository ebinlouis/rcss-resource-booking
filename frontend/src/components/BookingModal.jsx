import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import api from "../api/axios"

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

const toLocalISO = (date, time) => {
  const [year, month, day] = date.split('-');
  const [hours, minutes] = time.split(':');
  const d = new Date(year, month - 1, day, hours, minutes);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, -1); // Optional: .slice(0, -1) removes the 'Z' if backend expects naive local datetime, but full ISO is standard. Keeping full ISO below per your snippet.
};

const formatAMPM = (timeStr) => {
  if (!timeStr) return null

  let [hours, minutes] = timeStr.split(":")
  let ampm = hours >= 12 ? "PM" : "AM"

  hours = hours % 12
  hours = hours ? hours : 12

  return `${hours}:${minutes} ${ampm}`
}

const inputCls = (err) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white outline-none transition
   focus:ring-2 focus:ring-green-700 focus:border-transparent placeholder:text-gray-400
   ${
     err
       ? "border-red-300 bg-red-50"
       : "border-gray-200 hover:border-gray-300"
   }`

// ─────────────────────────────────────────────────────────────
// Reusable Components
// ─────────────────────────────────────────────────────────────

function Field({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {children}

      {hint && !error && (
        <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-0.5">{error}</p>
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>

      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

function BookingModal({
  spaceId,
  spaceName,
  onClose,
  initialData = null,
  prefillDate = "",
  prefillStart = "",
  prefillEnd = "",
}) {

  const isEdit = !!initialData

  // ── Initial form state ──
  const [form, setForm] = useState(() => {

    if (initialData) {
      const startD = new Date(initialData.start_datetime)
      const endD = new Date(initialData.end_datetime)

      return {
        purpose: initialData.purpose_of_booking || "",
        department: initialData.department || "",
        date: startD.toISOString().split("T")[0],
        start: startD.toTimeString().slice(0, 5),
        end: endD.toTimeString().slice(0, 5),
        attendees: initialData.attendee_count || "",
        requirements:
          initialData.equipment_requests?.map((er) => er.equipment) || [],
        notes:
          initialData.user_notes?.split(" | Notes: ")[1] || "",
      }
    }

    return {
      purpose: "",
      department: "",
      date: prefillDate,
      start: prefillStart,
      end: prefillEnd,
      attendees: "",
      requirements: [],
      notes: "",
    }
  })

  const [dynamicDepartments, setDynamicDepartments] = useState([])
  const [dynamicEquipment, setDynamicEquipment] = useState([])

  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ─────────────────────────────────────────────────────────────
  // Fetch dynamic data
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchDynamicData = async () => {
      try {
        const [deptRes, eqRes] = await Promise.all([
          api.get("/auth/departments/"),
          api.get("/spaces/inventory/"),
        ])

        const depts = deptRes.data.results || deptRes.data || []
        const equips = eqRes.data.results || eqRes.data || []

        setDynamicDepartments(depts)
        setDynamicEquipment(
          equips.filter((eq) => eq.is_active !== false)
        )
      } catch (err) {
        console.error("Failed loading dynamic data:", err)
      }
    }

    fetchDynamicData()
  }, [])

  // ─────────────────────────────────────────────────────────────

  const set = (key, val) => {
    setForm((p) => ({
      ...p,
      [key]: val,
    }))

    if (errors[key]) {
      setErrors((p) => ({
        ...p,
        [key]: null,
      }))
    }
  }

  const toggleReq = (id) => {
    setForm((p) => ({
      ...p,
      requirements: p.requirements.includes(id)
        ? p.requirements.filter((r) => r !== id)
        : [...p.requirements, id],
    }))
  }

  // ─────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {}

    if (!form.purpose.trim()) {
      e.purpose = "Please describe the purpose"
    }

    if (!form.department) {
      e.department = "Select your department"
    }

    if (!form.date) {
      e.date = "Pick a date"
    }

    if (!form.start) {
      e.start = "Required"
    }

    if (!form.end) {
      e.end = "Required"
    }

    if (!form.attendees || Number(form.attendees) < 1) {
      e.attendees = "Enter a valid number"
    }

    if (
      form.start &&
      form.end &&
      form.start >= form.end
    ) {
      e.end = "Must be after start time"
    }

    const today = new Date().toISOString().split("T")[0]

    if (
      form.date &&
      form.date < today &&
      !isEdit
    ) {
      e.date = "Cannot be a past date"
    }

    return e
  }

  // ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const e = validate()

    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // 1. Properly construct local datetime and preserve timezone
      const start_datetime = toLocalISO(form.date, form.start);
      const end_datetime   = toLocalISO(form.date, form.end);

      // Availability Check
      const availRes = await api.post(
        `/spaces/catalog/${spaceId}/check_availability/`,
        {
          start_datetime,
          end_datetime,
        }
      )

      if (!availRes.data.available && !isEdit) {
        setErrors({
          end: availRes.data.message,
        })
        setIsSubmitting(false)
        return
      }

      // Equipment summary string
      const equipmentString = form.requirements
        .map((reqId) =>
          dynamicEquipment.find((r) => r.id === reqId)?.name
        )
        .filter(Boolean)
        .join(", ")

      // 2. Updated Payload Keys
      const payload = {
        space: spaceId,
        start_datetime,
        end_datetime,
        attendee_count: Number(form.attendees),
        purpose_of_booking_input: form.purpose,  // ← Updated key
        department: Number(form.department),
        user_notes: form.notes
          ? `${equipmentString} | Notes: ${form.notes}`
          : equipmentString,
      }

      // CREATE / UPDATE
      if (isEdit) {
        await api.patch(
          `/spaces/requests/${initialData.id}/`,
          payload
        )
      } else {
        await api.post(
          "/spaces/requests/",
          payload
        )
      }

      setSubmitted(true)

    } catch (error) {
      console.error(error.response?.data)

      const errData = error.response?.data || {}
      const mappedErrors = {}

      if (errData.attendee_count) {
        mappedErrors.attendees =
          Array.isArray(errData.attendee_count)
            ? errData.attendee_count[0]
            : errData.attendee_count
      }

      if (errData.department) {
        mappedErrors.department =
          Array.isArray(errData.department)
            ? errData.department[0]
            : errData.department
      }

      // 3. Updated Error Mapping
      if (errData.purpose_of_booking_input) {
        mappedErrors.purpose = Array.isArray(errData.purpose_of_booking_input)
          ? errData.purpose_of_booking_input[0]
          : errData.purpose_of_booking_input
      }

      if (errData.non_field_errors) {
        mappedErrors.server =
          Array.isArray(errData.non_field_errors)
            ? errData.non_field_errors[0]
            : errData.non_field_errors
      }

      if (Object.keys(mappedErrors).length === 0) {
        mappedErrors.server = "Submission failed."
      }

      setErrors(mappedErrors)

    } finally {
      setIsSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Success State
  // ─────────────────────────────────────────────────────────────

  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-green-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? "Update Successful" : "Request Submitted"}
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed">
            Your booking for{" "}
            <span className="font-semibold text-gray-700">
              {spaceName}
            </span>{" "}
            has been{" "}
            {isEdit
              ? "updated successfully."
              : "sent for admin approval."}
          </p>

          <button
            onClick={onClose}
            className="mt-2 w-full bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-xl text-sm font-medium transition"
          >
            Done
          </button>
        </div>
      </div>,
      document.body
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────────────────────────────

  const startH = form.start
    ? +form.start.split(":")[0] +
      +form.start.split(":")[1] / 60
    : null

  const endH = form.end
    ? +form.end.split(":")[0] +
      +form.end.split(":")[1] / 60
    : null

  // ─────────────────────────────────────────────────────────────
  // Main Modal
  // ─────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* ═══════════════════════════════════════════════════ */}
        {/* LEFT PANEL */}
        {/* ═══════════════════════════════════════════════════ */}
        <div
          className="hidden md:flex md:w-[32%] shrink-0 flex-col justify-between p-7"
          style={{
            background:
              "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
          }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {isEdit ? "Editing Request" : "New Booking"}
            </p>

            <h2 className="text-2xl font-bold text-white leading-tight">
              {spaceName}
            </h2>

            <p className="text-sm text-green-200/75 mt-3 leading-relaxed">
              Request a space, choose your time,
              and add any details needed for approval.
            </p>
          </div>

          {/* SLOT CARD */}
          <div className="space-y-2.5">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">
                Selected Slot
              </p>

              {form.start ? (
                <>
                  <p className="text-white font-bold text-base">
                    {formatAMPM(form.start)}
                    {form.end &&
                      ` – ${formatAMPM(form.end)}`}
                  </p>

                  {form.date && (
                    <p className="text-green-200/70 text-xs mt-1">
                      {new Date(
                        form.date + "T00:00:00"
                      ).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/50 text-sm">
                  Pick a time below
                </p>
              )}

              {/* TIMELINE */}
              <div className="mt-4 flex gap-[2px]">
                {Array.from({ length: 20 }).map((_, i) => {
                  const seg = 8 + i * 0.5
                  const fill =
                    startH !== null &&
                    endH !== null &&
                    seg >= startH &&
                    seg < endH

                  return (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        fill
                          ? "bg-green-400"
                          : "bg-white/20"
                      }`}
                    />
                  )
                })}
              </div>

              <div className="flex justify-between text-[9px] text-green-300/50 mt-1">
                <span>08:00</span>
                <span>18:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* RIGHT PANEL */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">
                Booking Details
              </p>

              <h2 className="text-xl font-bold text-gray-900">
                {isEdit
                  ? "Edit your booking"
                  : "Fill in your booking"}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition"
            >
              ✕
            </button>
          </div>

          {/* FORM BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

            {/* EVENT DETAILS */}
            <SectionLabel>Event details</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Purpose"
                required
                error={errors.purpose}
              >
                <input
                  className={inputCls(errors.purpose)}
                  value={form.purpose}
                  onChange={(e) =>
                    set("purpose", e.target.value)
                  }
                  placeholder="e.g. MCA Cloud Security Seminar"
                />
              </Field>

              <Field
                label="Department"
                required
                error={errors.department}
              >
                <select
                  className={inputCls(errors.department)}
                  value={form.department}
                  onChange={(e) =>
                    set("department", e.target.value)
                  }
                >
                  <option value="">Select department</option>
                  {dynamicDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* DATE TIME */}
            <SectionLabel>Date & Time</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Date"
                required
                error={errors.date}
              >
                <input
                  type="date"
                  className={inputCls(errors.date)}
                  value={form.date}
                  onChange={(e) =>
                    set("date", e.target.value)
                  }
                />
              </Field>

              <Field
                label="Start"
                required
                error={errors.start}
              >
                <input
                  type="time"
                  className={inputCls(errors.start)}
                  value={form.start}
                  onChange={(e) =>
                    set("start", e.target.value)
                  }
                />
              </Field>

              <Field
                label="End"
                required
                error={errors.end}
              >
                <input
                  type="time"
                  className={inputCls(errors.end)}
                  value={form.end}
                  onChange={(e) =>
                    set("end", e.target.value)
                  }
                />
              </Field>
            </div>

            {/* ATTENDEES */}
            <SectionLabel>Attendees</SectionLabel>
            <Field
              label="Expected attendees"
              required
              error={errors.attendees}
            >
              <input
                type="number"
                min="1"
                className={inputCls(errors.attendees)}
                placeholder="e.g. 45"
                value={form.attendees}
                onChange={(e) =>
                  set("attendees", e.target.value)
                }
              />
            </Field>

            {/* REQUIREMENTS */}
            <SectionLabel>Requirements</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {dynamicEquipment.map((req) => {
                const active = form.requirements.includes(req.id)

                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => toggleReq(req.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition text-left
                      ${
                        active
                          ? "border-green-600 bg-green-50 text-green-800"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition
                        ${
                          active
                            ? "bg-green-700 border-green-700"
                            : "border-gray-300"
                        }`}
                    >
                      {active && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>

                    <span className="text-xs font-medium">
                      {req.name}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* NOTES */}
            <SectionLabel>Notes</SectionLabel>
            <textarea
              rows={3}
              className={`${inputCls(false)} resize-none`}
              placeholder="Mention setup, technical support, seating changes..."
              value={form.notes}
              onChange={(e) =>
                set("notes", e.target.value)
              }
            />
          </div>

          {/* FOOTER */}
          <div className="shrink-0 flex justify-between items-center px-7 py-4 border-t border-gray-100 bg-gray-50/60">
            <div>
              {errors.server && (
                <p className="text-xs text-red-500 font-medium">
                  {errors.server}
                </p>
              )}

              {!errors.server && (
                <p className="text-xs text-gray-400">
                  Submitting this sends the request
                  for admin approval.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting
                  ? "Saving..."
                  : isEdit
                  ? "Update Request"
                  : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BookingModal