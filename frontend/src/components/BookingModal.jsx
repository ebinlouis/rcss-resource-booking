import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import api from "../api/axios"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// A booking is "low occupancy" when attendees fill less than 30% of capacity.
const LOW_OCCUPANCY_THRESHOLD = 0.30

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

const toLocalISO = (date, time) => {
  const [year, month, day] = date.split("-")
  const [hours, minutes] = time.split(":")
  const d = new Date(year, month - 1, day, hours, minutes)
  return d.toISOString()
}

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
   ${err ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"}`

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
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
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
  spaceId: initialSpaceId,
  spaceName: initialSpaceName,
  spaceCap: initialSpaceCap = null,
  onClose,
  initialData = null,
  prefillDate = "",
  prefillStart = "",
  prefillEnd = "",
}) {
  const isEdit = !!initialData

  // Active space can change if the user switches hall via suggestion.
  const [activeSpaceId, setActiveSpaceId] = useState(initialSpaceId)
  const [activeSpaceName, setActiveSpaceName] = useState(initialSpaceName)
  const [activeSpaceCap, setActiveSpaceCap] = useState(initialSpaceCap)

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
        notes: initialData.user_notes || "",
        isExternal: initialData.is_external || false,
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
      isExternal: false,
    }
  })

  const [dynamicDepartments, setDynamicDepartments] = useState([])
  const [dynamicEquipment, setDynamicEquipment] = useState([])
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Availability Checking State ──
  const [isAvailable, setIsAvailable] = useState(null) // null = untested, true = available, false = taken
  const [availabilityMsg, setAvailabilityMsg] = useState("")
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)

  // ── Suggestion state ──
  const [suggestedHalls, setSuggestedHalls] = useState([])
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)
  const debounceTimer = useRef(null)
  const availabilityTimer = useRef(null)

  // Derived during render
  const attendeeCount = parseInt(form.attendees, 10)
  const isLowOccupancy =
    Number.isFinite(attendeeCount) &&
    attendeeCount > 0 &&
    activeSpaceCap !== null &&
    attendeeCount / activeSpaceCap < LOW_OCCUPANCY_THRESHOLD

  // ─────────────────────────────────────────────────────────────
  // Fetch departments + equipment on mount
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
        setDynamicEquipment(equips.filter((eq) => eq.is_active !== false))
      } catch (err) {
        console.error("Failed loading dynamic data:", err)
      }
    }
    fetchDynamicData()
  }, [])

  // ─────────────────────────────────────────────────────────────
  // Fetch active space capacity
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeSpaceCap !== null) return
    const fetchCap = async () => {
      try {
        const res = await api.get(`/spaces/catalog/${activeSpaceId}/`)
        setActiveSpaceCap(res.data.capacity_hard ?? null)
      } catch {
        // Non-fatal
      }
    }
    fetchCap()
  }, [activeSpaceId, activeSpaceCap]) 

  // ─────────────────────────────────────────────────────────────
  // Auto-Check Availability (Time-First Validation)
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    clearTimeout(availabilityTimer.current)

    // Reset if inputs are incomplete
    if (!form.date || !form.start || !form.end) {
      setTimeout(() => {
        setIsAvailable(null)
        setAvailabilityMsg("")
      }, 0)
      return
    }

    // Client-side quick check
    if (form.start >= form.end) {
      setTimeout(() => {
        setIsAvailable(false)
        setAvailabilityMsg("End time must be after start time.")
      }, 0)
      return
    }

    const today = new Date().toISOString().split("T")[0]
    if (form.date < today && !isEdit) {
      setTimeout(() => {
        setIsAvailable(false)
        setAvailabilityMsg("Cannot book a date in the past.")
      }, 0)
      return
    }

    // If editing and time hasn't changed from original, assume available
    const isSameAsInitial = isEdit &&
      activeSpaceId === initialData.space &&
      form.date === initialData.start_datetime.split('T')[0] &&
      form.start === new Date(initialData.start_datetime).toTimeString().slice(0, 5) &&
      form.end === new Date(initialData.end_datetime).toTimeString().slice(0, 5)

    if (isSameAsInitial) {
      setTimeout(() => {
        setIsAvailable(true)
        setAvailabilityMsg("")
      }, 0)
      return
    }

    // Ping the backend to check availability
    availabilityTimer.current = setTimeout(async () => {
      setIsCheckingAvailability(true)
      try {
        const start_datetime = toLocalISO(form.date, form.start)
        const end_datetime = toLocalISO(form.date, form.end)

        const res = await api.post(
          `/spaces/catalog/${activeSpaceId}/check_availability/`,
          { 
            start_datetime, 
            end_datetime,
            exclude_booking_id: isEdit ? initialData.id : null // Forward compatibility 
          }
        )
        
        setIsAvailable(res.data.available)
        setAvailabilityMsg(res.data.message || "")
      } catch (err) {
        console.error("Availability check failed:", err)
        setIsAvailable(false)
        setAvailabilityMsg("Could not verify availability. Please try again.")
      } finally {
        setIsCheckingAvailability(false)
      }
    }, 600) // 600ms debounce to prevent spamming while they type time

    return () => clearTimeout(availabilityTimer.current)
  }, [form.date, form.start, form.end, activeSpaceId, isEdit, initialData])


  // ─────────────────────────────────────────────────────────────
  // Debounced suggestion fetch (Capacity)
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    clearTimeout(debounceTimer.current)

    if (!isLowOccupancy) {
      debounceTimer.current = setTimeout(() => {
        setSuggestedHalls((prev) => (prev.length > 0 ? [] : prev))
      }, 0)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      setIsFetchingSuggestions(true)
      try {
        const res = await api.get(`/spaces/catalog/?min_capacity=${attendeeCount}&for_suggestion=true`)
        const all = res.data.results ?? res.data ?? []
        
        const better = all.filter(
          (s) =>
            s.id !== activeSpaceId &&
            attendeeCount / s.capacity_hard >= LOW_OCCUPANCY_THRESHOLD
        )
        setSuggestedHalls(better.slice(0, 3))
      } catch {
        setSuggestedHalls([])
      } finally {
        setIsFetchingSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(debounceTimer.current)
  }, [isLowOccupancy, attendeeCount, activeSpaceId])

  // ─────────────────────────────────────────────────────────────
  // Form helpers
  // ─────────────────────────────────────────────────────────────

  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }))
    if (errors[key]) {
      setErrors((p) => ({ ...p, [key]: null }))
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

  const switchHall = (space) => {
    setActiveSpaceId(space.id)
    setActiveSpaceName(space.name)
    setActiveSpaceCap(space.capacity_hard)
    setSuggestedHalls([])
  }

  const notesRequired = isLowOccupancy

  // ─────────────────────────────────────────────────────────────
  // Validation & Submit
  // ─────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {}
    if (!form.purpose.trim()) e.purpose = "Please describe the purpose"
    if (!form.department) e.department = "Select your department"
    if (!form.attendees || Number(form.attendees) < 1) e.attendees = "Enter a valid number"
    if (notesRequired && !form.notes.trim()) e.notes = "Please explain why this hall is needed for a small group."
    return e
  }

  const handleSubmit = async () => {
    // Extra safety block
    if (isAvailable !== true) return 

    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const start_datetime = toLocalISO(form.date, form.start)
      const end_datetime = toLocalISO(form.date, form.end)

      const equipment_requests = form.requirements.map((id) => ({
        equipment: id,
        quantity: 1,
      }))

      const payload = {
        space: activeSpaceId,
        start_datetime,
        end_datetime,
        attendee_count: Number(form.attendees),
        purpose_of_booking_input: form.purpose,
        department: Number(form.department),
        user_notes: form.notes.trim() || "",
        equipment_requests,
        is_external: form.isExternal,
      }

      if (isEdit) {
        await api.patch(`/spaces/requests/${initialData.id}/`, payload)
      } else {
        await api.post("/spaces/requests/", payload)
      }

      setSubmitted(true)
    } catch (error) {
      const errData = error.response?.data || {}
      const mappedErrors = {}

      if (errData.attendee_count) mappedErrors.attendees = Array.isArray(errData.attendee_count) ? errData.attendee_count[0] : errData.attendee_count
      if (errData.department) mappedErrors.department = Array.isArray(errData.department) ? errData.department[0] : errData.department
      if (errData.purpose_of_booking_input) mappedErrors.purpose = Array.isArray(errData.purpose_of_booking_input) ? errData.purpose_of_booking_input[0] : errData.purpose_of_booking_input
      if (errData.non_field_errors) mappedErrors.server = Array.isArray(errData.non_field_errors) ? errData.non_field_errors[0] : errData.non_field_errors
      
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
            <svg className="w-7 h-7 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? "Update Successful" : "Request Submitted"}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your booking for <span className="font-semibold text-gray-700">{activeSpaceName}</span> has been {isEdit ? "updated and sent back for admin approval." : "sent for admin approval."}
            {form.isExternal && (
              <span className="block mt-1 text-xs text-amber-600 font-medium">
                Flagged as an external event.
              </span>
            )}
          </p>
          <button onClick={onClose} className="mt-2 w-full bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-xl text-sm font-medium transition">
            Done
          </button>
        </div>
      </div>,
      document.body
    )
  }

  // Timeline variables
  const startH = form.start ? +form.start.split(":")[0] + +form.start.split(":")[1] / 60 : null
  const endH = form.end ? +form.end.split(":")[0] + +form.end.split(":")[1] / 60 : null

  // ─────────────────────────────────────────────────────────────
  // Main Modal
  // ─────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* ═══════════════════════════════════════════════════ */}
        {/* LEFT PANEL                                         */}
        {/* ═══════════════════════════════════════════════════ */}
        <div
          className="hidden md:flex md:w-[32%] shrink-0 flex-col justify-between p-7"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {isEdit ? "Editing Request" : "New Booking"}
            </p>
            <h2 className="text-2xl font-bold text-white leading-tight">
              {activeSpaceName}
            </h2>

            {form.isExternal && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                External Event
              </span>
            )}

            <p className="text-sm text-green-200/75 mt-3 leading-relaxed">
              {isEdit
                ? "Editing this booking will send it back to the admin for re-approval."
                : "Request a space, choose your time, and add any details needed for approval."}
            </p>

            {/* Capacity indicator */}
            {activeSpaceCap !== null && (
              <div className="mt-4 bg-white/10 rounded-xl px-4 py-3">
                <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">
                  Hall Capacity
                </p>
                <p className="text-white font-bold text-lg">{activeSpaceCap} seats</p>
                {Number.isFinite(attendeeCount) && attendeeCount > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isLowOccupancy ? "bg-amber-400" : "bg-green-400"}`}
                        style={{ width: `${Math.min(100, (attendeeCount / activeSpaceCap) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-green-300/70 mt-1">
                      {Math.round((attendeeCount / activeSpaceCap) * 100)}% fill
                      {isLowOccupancy && " — low occupancy"}
                    </p>
                  </div>
                )}
              </div>
            )}
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
                    {form.end && ` – ${formatAMPM(form.end)}`}
                  </p>
                  {form.date && (
                    <p className="text-green-200/70 text-xs mt-1">
                      {new Date(form.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/50 text-sm">Pick a time to begin</p>
              )}

              {/* TIMELINE */}
              <div className="mt-4 flex gap-[2px]">
                {Array.from({ length: 20 }).map((_, i) => {
                  const seg = 8 + i * 0.5
                  const fill = startH !== null && endH !== null && seg >= startH && seg < endH
                  return <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${fill ? "bg-green-400" : "bg-white/20"}`} />
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
        {/* RIGHT PANEL                                        */}
        {/* ═══════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">
                Booking Form
              </p>
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit ? "Edit your booking" : "Secure this space"}
              </h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition">✕</button>
          </div>

          {/* RE-APPROVAL NOTICE */}
          {isEdit && initialData?.status === "APPROVED" && (
            <div className="mx-7 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shrink-0">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                This booking is currently approved. Saving changes will move it back to <span className="font-semibold">Pending Review</span> and notify the admin.
              </p>
            </div>
          )}

          {/* FORM BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">

            {/* ── STEP 1: DATE & TIME (Always active) ──────────────── */}
            <div className="space-y-4">
              <SectionLabel>Step 1: Pick a Time</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Date" required error={errors.date}>
                  <input type="date" className={inputCls(errors.date)} value={form.date} onChange={(e) => set("date", e.target.value)} />
                </Field>
                <Field label="Start" required error={errors.start}>
                  <input type="time" className={inputCls(errors.start)} value={form.start} onChange={(e) => set("start", e.target.value)} />
                </Field>
                <Field label="End" required error={errors.end}>
                  <input type="time" className={inputCls(errors.end)} value={form.end} onChange={(e) => set("end", e.target.value)} />
                </Field>
              </div>
              
              {/* Availability Banner */}
              {isCheckingAvailability ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 animate-pulse">
                  <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                  <p className="text-sm font-medium text-blue-800">Checking availability...</p>
                </div>
              ) : isAvailable === false ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-medium text-red-800">{availabilityMsg || "This time slot is unavailable."}</p>
                </div>
              ) : isAvailable === true ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-bold text-green-800">Time slot is available!</p>
                </div>
              ) : null}
            </div>

            {/* ── STEP 2: REST OF FORM (Dimmed until available) ────── */}
            <div className={`space-y-6 transition-all duration-300 ${isAvailable === true ? 'opacity-100' : 'opacity-40 pointer-events-none select-none filter grayscale-[20%]'}`}>
              
              <SectionLabel>Step 2: Event Details</SectionLabel>

              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/60">
                <div className="flex flex-col pr-4">
                  <span className="text-sm font-semibold text-gray-700">External Event</span>
                  <span className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Enable if organised by an external party. External events are grouped for priority admin review.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isExternal}
                  onClick={() => set("isExternal", !form.isExternal)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${form.isExternal ? "bg-amber-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${form.isExternal ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Purpose" required error={errors.purpose}>
                  <input className={inputCls(errors.purpose)} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. MCA Cloud Security Seminar" />
                </Field>
                <Field label="Department" required error={errors.department}>
                  <select className={inputCls(errors.department)} value={form.department} onChange={(e) => set("department", e.target.value)}>
                    <option value="">Select department</option>
                    {dynamicDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <SectionLabel>Step 3: Setup & Capacity</SectionLabel>
              
              <Field label="Expected attendees" required error={errors.attendees}>
                <input type="number" min="1" className={inputCls(errors.attendees)} placeholder="e.g. 45" value={form.attendees} onChange={(e) => set("attendees", e.target.value)} />
              </Field>

              {/* ── LOW OCCUPANCY BANNER ──────────────────────────────── */}
              {isLowOccupancy && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-800">
                        Low occupancy for {activeSpaceName}
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                        {attendeeCount} attendees fills only {Math.round((attendeeCount / activeSpaceCap) * 100)}% of this hall.
                        Consider a smaller venue, or explain below why this space is needed.
                      </p>

                      {isFetchingSuggestions && (
                        <p className="text-xs text-amber-600 mt-2 animate-pulse">Finding better-fit halls…</p>
                      )}

                      {!isFetchingSuggestions && suggestedHalls.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Better fits</p>
                          {suggestedHalls.map((hall) => (
                            <div key={hall.id} className="flex items-center justify-between gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{hall.name}</p>
                                <p className="text-xs text-gray-500">
                                  {hall.capacity_hard} seats · {Math.round((attendeeCount / hall.capacity_hard) * 100)}% fill · {hall.location}
                                </p>
                              </div>
                              <button type="button" onClick={() => switchHall(hall)} className="shrink-0 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-semibold transition">
                                Switch
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isFetchingSuggestions && suggestedHalls.length === 0 && Number.isFinite(attendeeCount) && (
                        <p className="text-xs text-amber-600 mt-2">No smaller halls available — please explain in Notes below.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <SectionLabel>Requirements</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {dynamicEquipment.map((req) => {
                  const active = form.requirements.includes(req.id)
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => toggleReq(req.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition text-left ${active ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${active ? "bg-green-700 border-green-700" : "border-gray-300"}`}>
                        {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="text-xs font-medium">{req.name}</span>
                    </button>
                  )
                })}
              </div>

              <SectionLabel>
                Notes
                {notesRequired && <span className="text-red-400 ml-1 normal-case font-normal">— required for low-occupancy bookings</span>}
              </SectionLabel>
              <Field error={errors.notes} hint={notesRequired ? undefined : "Mention setup, technical support, seating changes…"}>
                <textarea
                  rows={3}
                  className={`${inputCls(errors.notes)} resize-none`}
                  placeholder={notesRequired ? "Required: explain why this hall is needed for a small group…" : "Mention setup, technical support, seating changes…"}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>

            </div>
          </div>

          {/* FOOTER */}
          <div className="shrink-0 flex justify-between items-center px-7 py-4 border-t border-gray-100 bg-gray-50/60">
            <div>
              {errors.server && <p className="text-xs text-red-500 font-medium">{errors.server}</p>}
              {!errors.server && (
                <p className="text-xs text-gray-400">
                  {isAvailable !== true 
                    ? "Please select an available time slot to continue." 
                    : isEdit && initialData?.status === "APPROVED" 
                      ? "Saving will reset this booking to pending." 
                      : "Submitting this sends the request for admin approval."}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isAvailable !== true}
                className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : isEdit ? "Update Request" : "Send Request"}
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