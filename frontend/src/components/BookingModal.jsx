import { useState } from "react"
import { createPortal } from "react-dom"

const DEPARTMENTS = [
  "Dept. of Social Work",
  "Dept. of Computer Science",
  "Dept. of Library and Information Science",
  "Dept. of Business Administration",
  "Dept. of Commerce",
  "Dept. of Psychology",
  "Dept. of Languages",
  "Dept. of Physical Education",
  "Dept. of Biosciences",
  "Dept. of Statistics",
  "Dept. of Management & Professional Studies",
]

const REQUIREMENTS = [
  { id: "projector",  label: "Projector"  },
  { id: "microphone", label: "Microphone" },
  { id: "ac",         label: "AC"         },
  { id: "av_support", label: "AV Support" },
  { id: "whiteboard", label: "Whiteboard" },
  { id: "livestream", label: "Livestream" },
]

// ── Reusable field wrapper ──
function Field({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {error          && <p className="text-xs text-red-500  mt-0.5">{error}</p>}
    </div>
  )
}

const formatAMPM = (timeStr) => {
  if (!timeStr) return null;
  let [hours, minutes] = timeStr.split(':');
  let ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
};

const inputCls = (err) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white outline-none transition
   focus:ring-2 focus:ring-green-700 focus:border-transparent placeholder:text-gray-400
   ${err ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"}`

// ── Divider with label ──
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

function BookingModal({
  spaceName,
  onClose,
  prefillDate  = "",
  prefillStart = "",
  prefillEnd   = "",
}) {
  const [form, setForm] = useState({
    purpose:      "",
    department:   "",
    date:         prefillDate,
    start:        prefillStart,
    end:          prefillEnd,
    attendees:    "",
    requirements: [],
    notes:        "",
  })
  const [errors,    setErrors]    = useState({})
  const [submitted, setSubmitted] = useState(false)

  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: null }))
  }

  const toggleReq = (id) =>
    setForm((p) => ({
      ...p,
      requirements: p.requirements.includes(id)
        ? p.requirements.filter((r) => r !== id)
        : [...p.requirements, id],
    }))

  const validate = () => {
    const e = {}
    if (!form.purpose.trim())                           e.purpose    = "Please describe the purpose"
    if (!form.department)                               e.department = "Select your department"
    if (!form.date)                                     e.date       = "Pick a date"
    if (!form.start)                                    e.start      = "Required"
    if (!form.end)                                      e.end        = "Required"
    if (!form.attendees || Number(form.attendees) < 1)  e.attendees  = "Enter a valid number"
    if (form.start && form.end && form.start >= form.end)
                                                        e.end        = "Must be after start time"
    const today = new Date().toISOString().split("T")[0]
    if (form.date && form.date < today)                 e.date       = "Cannot be a past date"
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    // TODO: POST /api/spaces/requests/
    console.log("Submitting:", form)
    setSubmitted(true)
  }

  // ── Success state ──
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Request Submitted</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your booking request for{" "}
            <span className="font-semibold text-gray-700">{spaceName}</span> has been
            sent for admin approval. You will be notified once it is reviewed.
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

  // Slot label for left panel
  const slotTime =
    form.start && form.end ? `${form.start} – ${form.end}`
    : form.start           ? form.start
    : null

  // Availability bar — 20 half-hour segments from 08:00 to 18:00
  const startH = form.start
    ? +form.start.split(":")[0] + +form.start.split(":")[1] / 60 : null
  const endH   = form.end
    ? +form.end.split(":")[0]   + +form.end.split(":")[1]   / 60 : null

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* ══ LEFT: gradient panel ══ */}
        <div
          className="hidden md:flex md:w-[32%] shrink-0 flex-col justify-between p-7"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              New Booking
            </p>
            <h2 className="text-2xl font-bold text-white leading-tight">{spaceName}</h2>
            <p className="text-sm text-green-200/75 mt-3 leading-relaxed">
Request a space, choose your time, and add any details needed for approval.            </p>
          </div>

          <div className="space-y-2.5">
            {/* Selected slot card */}
<div className="bg-white/10 rounded-xl p-4">
  <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">
    Selected slot
  </p>

  {form.start || form.end ? (
    <>
      <p className="text-white font-bold text-base">
        {formatAMPM(form.start)} 
        {form.end && ` – ${formatAMPM(form.end)}`}
      </p>
      {form.date && (
        <p className="text-green-200/70 text-xs mt-0.5">
          {new Date(form.date + "T00:00:00").toLocaleDateString("en-IN", {
            weekday: "short", day: "numeric", month: "short",
          })}
        </p>
      )}
    </>
  ) : (
    <p className="text-white/50 text-sm">Pick a time below</p>
  )}

  {/* Availability bar — Updated to 11 hour-based segments */}
  <div className="mt-4 flex gap-1.5">
    {Array.from({ length: 11 }).map((_, i) => {
      const currentHour = 8 + i;
      // Logic to check if this hour block is within the selected range
      const isFilled = startH !== null && endH !== null && 
                       currentHour >= Math.floor(startH) && 
                       currentHour < Math.ceil(endH);
      
      return (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-500
            ${isFilled ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-white/20"}`}
        />
      )
    })}
  </div>
  <div className="flex justify-between text-[9px] text-green-300/50 mt-2 font-medium">
    <span>08:00 AM</span>
    <span>06:00 PM</span>
  </div>
</div>

            {/* Approval + Policy */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase tracking-wide font-semibold">Approval</p>
                <p className="text-white text-xs font-semibold mt-0.5">Admin review</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase tracking-wide font-semibold">Policy</p>
                <p className="text-white text-xs font-semibold mt-0.5">48h notice</p>
              </div>
            </div>

            {/* Equipment summary (shows when selected) */}
            {form.requirements.length > 0 && (
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase tracking-wide font-semibold mb-2">
                  Equipment
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {form.requirements.map((id) => (
                    <span
                      key={id}
                      className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full"
                    >
                      {REQUIREMENTS.find((r) => r.id === id)?.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: form ══ */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Header */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">
                Booking Details
              </p>
              <h2 className="text-xl font-bold text-gray-900">Fill in your booking</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition"
            >
              ✕
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

            {/* ── Event details ── */}
            <SectionLabel>Event details</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Purpose" required error={errors.purpose}>
                <input
                  className={inputCls(errors.purpose)}
                  placeholder="e.g. Department seminar, Cultural event…"
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                />
              </Field>
              <Field label="Department" required error={errors.department}>
                <select
                  className={inputCls(errors.department)}
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* ── Date & time ── */}
<SectionLabel>Date &amp; Time</SectionLabel>

<div className="grid grid-cols-3 gap-3">
  <Field label="Date" required error={errors.date}>
    <input
      type="date"
      className={inputCls(errors.date)}
      value={form.date}
      onChange={(e) => set("date", e.target.value)}
    />
  </Field>

  <Field label="Start time" required error={errors.start}>
    <div className="relative">
      <input
        type="time"
        className={`${inputCls(errors.start)} tabular-nums`}
        min="08:00" max="18:00"
        value={form.start}
        onChange={(e) => set("start", e.target.value)}
      />
      {form.start && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded pointer-events-none">
          {formatAMPM(form.start)}
        </span>
      )}
    </div>
  </Field>

  <Field label="End time" required error={errors.end}>
    <div className="relative">
      <input
        type="time"
        className={`${inputCls(errors.end)} tabular-nums`}
        min="08:00" max="18:00"
        value={form.end}
        onChange={(e) => set("end", e.target.value)}
      />
      {form.end && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded pointer-events-none">
          {formatAMPM(form.end)}
        </span>
      )}
    </div>
  </Field>
</div>
            <p className="text-xs text-gray-400 -mt-3">
              Bookings must be within college hours: 08:00 – 18:00
            </p>

            {/* ── Attendees ── */}
            <SectionLabel>Attendees</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Expected attendees" required error={errors.attendees}>
                <input
                  type="number" min="1"
                  className={inputCls(errors.attendees)}
                  placeholder="e.g. 45"
                  value={form.attendees}
                  onChange={(e) => set("attendees", e.target.value)}
                />
              </Field>
              <Field label="Requester">
                <div className={`${inputCls(false)} bg-gray-50 text-gray-400 cursor-not-allowed`}>
                  {/* Replaced by request.user on API integration */}
                  Admin
                </div>
              </Field>
            </div>

            {/* ── Requirements ── */}
            <SectionLabel>Requirements</SectionLabel>

            <div className="grid grid-cols-3 gap-2">
              {REQUIREMENTS.map((req) => {
                const active = form.requirements.includes(req.id)
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => toggleReq(req.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition text-left
                      ${active
                        ? "border-green-700 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}
                  >
                    {/* Checkbox */}
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition
                        ${active ? "bg-green-700 border-green-700" : "border-gray-300"}`}
                    >
                      {active && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs font-medium">{req.label}</span>
                  </button>
                )
              })}
            </div>

            {/* ── Notes ── */}
            <SectionLabel>Notes for approving office</SectionLabel>

            <textarea
              rows={3}
              className={`${inputCls(false)} resize-none`}
              placeholder="Mention setup, access, technical support, or seating changes…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />

          </div>

          {/* Footer */}
          <div className="shrink-0 flex justify-between items-center px-7 py-4 border-t border-gray-100 bg-gray-50/60">
            <p className="text-xs text-gray-400">
              Submitting this sends the request to admin approval.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
              className="bg-green-700 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-green-700 shadow-lg shadow-green-100 hover:shadow-green-200 transition-all"
              >
                Send request
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