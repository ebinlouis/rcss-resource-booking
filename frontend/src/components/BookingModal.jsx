import Tooltip from "./Tooltip"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import api from "../api/axios"
import LinkedBookingOptions from "./LinkedBookingOptions"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"

const LOW_OCCUPANCY_THRESHOLD = 0.3
const COLLEGE_START = "08:00"
const COLLEGE_END = "18:00"

const toLocalISO = (date, time) => {
  const [year, month, day] = date.split("-")
  const [hours, minutes] = time.split(":")
  const d = new Date(year, month - 1, day, hours, minutes)
  return d.toISOString()
}

const todayISO = () => new Date().toISOString().split("T")[0]

const currentTimeISO = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`
}

const formatAMPM = (timeStr) => {
  if (!timeStr) return null
  let [hours, minutes] = timeStr.split(":").map(Number)
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`
}

const formatConflictDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

const durationMins = (startTime, endTime) => {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

const formatHoursPerDay = (startTime, endTime) => {
  const total = durationMins(startTime, endTime)
  if (total <= 0) return null
  const hrs = Math.floor(total / 60)
  const mins = total % 60
  if (mins === 0) return `${hrs} hrs/day`
  return `${hrs} hrs ${mins} min/day`
}

const daySpan = (startDate, endDate) => {
  const s = new Date(startDate + "T00:00:00")
  const e = new Date(endDate + "T00:00:00")
  return Math.round((e - s) / 86400000) + 1
}

const inputCls = (err) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white outline-none transition focus:ring-2 focus:ring-green-700 focus:border-transparent placeholder:text-gray-400 ${
    err ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
  }`

function Field({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
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

function BookingModal({
  spaceId: initialSpaceId,
  spaceName: initialSpaceName,
  spaceCap: initialSpaceCap = null,
  onClose,
  initialData = null,
  prefillDate = "",
  prefillStart = "",
  prefillEnd = "",
  wizardMode = false,
  isStandalone = false, // ← NEW PROP: when true, ignores session draft for date/time fields
}) {
  const isEdit = !!initialData
  const bookingSession = useBookingSession()
  const sessionDraft =
    !initialData && bookingSession.spaceFormData?.space === initialSpaceId
      ? bookingSession.spaceFormData
      : null

  const [activeSpaceId, setActiveSpaceId] = useState(initialSpaceId)
  const [activeSpaceName, setActiveSpaceName] = useState(initialSpaceName)
  const [activeSpaceCap, setActiveSpaceCap] = useState(initialSpaceCap)

  const [form, setForm] = useState(() => {
    if (initialData) {
      const startD = new Date(initialData.start_datetime)
      const endD = new Date(initialData.end_datetime)
      const startDate = startD.toISOString().split("T")[0]
      const endDate = endD.toISOString().split("T")[0]
      return {
        purpose: initialData.purpose_of_booking || "",
        department: initialData.department || "",
        start_date: startDate,
        end_date: endDate,
        start_time: startD.toTimeString().slice(0, 5),
        end_time: endD.toTimeString().slice(0, 5),
        attendees: initialData.attendee_count || "",
        requirements: initialData.equipment_requests?.map((er) => er.equipment) || [],
        notes: initialData.user_notes || "",
        isExternal: initialData.is_external || false,
        bookingType: initialData.booking_type || "SINGLE",
      }
    }

    // ─── FIX: when isStandalone, never pull date/time from the session draft.
    // This prevents "ghost data" from a previous calendar-click bleeding into
    // a fresh standalone booking form.
    if (isStandalone) {
      return {
        purpose: "",
        department: "",
        start_date: "",
        end_date: "",
        start_time: "",
        end_time: "",
        attendees: "",
        requirements: [],
        notes: "",
        isExternal: false,
        bookingType: "SINGLE",
      }
    }

    const isNewDate = prefillDate && sessionDraft?.start_date && sessionDraft.start_date !== prefillDate;

    return {
      purpose: sessionDraft?.purpose || "",
      department: sessionDraft?.department || "",
      start_date: isNewDate ? prefillDate : (sessionDraft?.start_date || prefillDate),
      end_date: isNewDate ? prefillDate : (sessionDraft?.end_date || prefillDate),
      start_time: prefillStart || sessionDraft?.start_time || "",
      end_time: prefillEnd || sessionDraft?.end_time || "",
      attendees: sessionDraft?.attendees || "",
      requirements: sessionDraft?.requirements || [],
      notes: sessionDraft?.notes || "",
      isExternal: sessionDraft?.isExternal || false,
      bookingType: sessionDraft?.bookingType || "SINGLE",
    }
  })

  const [dynamicDepartments, setDynamicDepartments] = useState([])
  const [dynamicEquipment, setDynamicEquipment] = useState([])
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isAvailable, setIsAvailable] = useState(null)
  const [availabilityMsg, setAvailabilityMsg] = useState("")
  const [availabilityConflicts, setAvailabilityConflicts] = useState([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)

  const [suggestedHalls, setSuggestedHalls] = useState([])
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)
  const debounceTimer = useRef(null)
  const availabilityTimer = useRef(null)

  const attendeeCount = parseInt(form.attendees, 10)
  const exceedsCapacity =
    Number.isFinite(attendeeCount) &&
    activeSpaceCap !== null &&
    attendeeCount > activeSpaceCap
  const isLowOccupancy =
    Number.isFinite(attendeeCount) &&
    attendeeCount > 0 &&
    activeSpaceCap !== null &&
    !exceedsCapacity &&
    attendeeCount / activeSpaceCap < LOW_OCCUPANCY_THRESHOLD

  const isMultiDay =
    form.start_date && form.end_date && form.start_date !== form.end_date

  useEffect(() => {
    const fetchDynamicData = async () => {
      try {
        const [deptRes, eqRes] = await Promise.all([
          api.get("/auth/departments/"),
          api.get("/spaces/inventory/?for_space=true"),
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

  useEffect(() => {
    clearTimeout(availabilityTimer.current)

    const today = todayISO()
    const nowTime = currentTimeISO()

    if (form.start_date && form.start_time && !isEdit) {
      if (form.start_date < today) {
        setTimeout(() => {
          setIsAvailable(false)
          setAvailabilityMsg("Cannot book a date in the past.")
          setAvailabilityConflicts([])
        }, 0)
        return
      }
      if (form.start_date === today && form.start_time < nowTime) {
        setTimeout(() => {
          setIsAvailable(false)
          setAvailabilityMsg("Cannot book a time in the past.")
          setAvailabilityConflicts([])
        }, 0)
        return
      }
    }

    if (!form.start_date || !form.start_time) {
      setTimeout(() => {
        setIsAvailable(null)
        setAvailabilityMsg("")
        setAvailabilityConflicts([])
      }, 0)
      return
    }

    if (!form.end_time) {
      setTimeout(() => {
        setIsAvailable(null)
        setAvailabilityMsg("Select an end time to check availability.")
        setAvailabilityConflicts([])
      }, 0)
      return
    }

    if (
      form.start_time < COLLEGE_START ||
      form.start_time > COLLEGE_END ||
      form.end_time < COLLEGE_START ||
      form.end_time > COLLEGE_END
    ) {
      setTimeout(() => {
        setIsAvailable(false)
        setAvailabilityMsg("Bookings are allowed only between 8:00 AM and 6:00 PM.")
        setAvailabilityConflicts([])
      }, 0)
      return
    }

    const endDate = form.end_date || form.start_date
    if (endDate < form.start_date) {
      setTimeout(() => {
        setIsAvailable(false)
        setAvailabilityMsg("End date cannot be before start date.")
        setAvailabilityConflicts([])
        return
      }, 0)
      return
    }

    if ((!isMultiDay || form.bookingType === 'RECURRING') && form.end_time <= form.start_time) {
      setTimeout(() => {
        setIsAvailable(false)
        setAvailabilityMsg("End time must be after start time.")
        setAvailabilityConflicts([])
      }, 0)
      return
    }

    const isSameAsInitial =
      isEdit &&
      activeSpaceId === initialData.space &&
      form.start_date === initialData.start_datetime.split("T")[0] &&
      form.end_date === initialData.end_datetime.split("T")[0] &&
      form.start_time === new Date(initialData.start_datetime).toTimeString().slice(0, 5) &&
      form.end_time === new Date(initialData.end_datetime).toTimeString().slice(0, 5) &&
      form.bookingType === (initialData.booking_type || 'SINGLE')

    if (isSameAsInitial) {
      setTimeout(() => {
        setIsAvailable(true)
        setAvailabilityMsg("")
        setAvailabilityConflicts([])
      }, 0)
      return
    }

    availabilityTimer.current = setTimeout(async () => {
      setIsCheckingAvailability(true)
      try {
        const start_datetime = toLocalISO(form.start_date, form.start_time)
        const end_datetime = toLocalISO(endDate, form.end_time)

        const res = await api.post(
          `/spaces/catalog/${activeSpaceId}/check_availability/`,
          {
            start_datetime,
            end_datetime,
            exclude_booking_id: isEdit ? initialData.id : null,
            booking_type: isMultiDay ? form.bookingType : 'SINGLE'
          }
        )

        const conflicts = res.data.conflicts || []
        setIsAvailable(res.data.available)
        setAvailabilityMsg(res.data.message || "")
        setAvailabilityConflicts(conflicts)
      } catch (err) {
        console.error("Availability check failed:", err)
        setIsAvailable(false)
        setAvailabilityMsg(err.response?.data?.error || "Could not verify availability. Please try again.")
        setAvailabilityConflicts([])
      } finally {
        setIsCheckingAvailability(false)
      }
    }, 600)

    return () => clearTimeout(availabilityTimer.current)
  }, [form.start_date, form.end_date, form.start_time, form.end_time, form.bookingType, isMultiDay, activeSpaceId, isEdit, initialData])

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
        const res = await api.get(
          `/spaces/catalog/?min_capacity=${attendeeCount}&for_suggestion=true`
        )
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

  const set = (key, val) => {
    setForm((p) => {
      const next = { ...p, [key]: val }
      if (key === "start_date" && next.end_date && next.end_date < val) {
        next.end_date = val
      }
      return next
    })
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
  const linkedEndDate = form.end_date || form.start_date
  const linkedStartIso =
    form.start_date && form.start_time ? toLocalISO(form.start_date, form.start_time) : ""
  const linkedEndIso =
    linkedEndDate && form.end_time ? toLocalISO(linkedEndDate, form.end_time) : ""
  const hasLinkedBookings =
    bookingSession.completedBookings.includes("mess") ||
    bookingSession.completedBookings.includes("media")
  const linkedOptionsReady =
    !isEdit &&
    isAvailable === true &&
    !exceedsCapacity &&
    Boolean(
      form.purpose.trim() &&
      form.department &&
      form.start_date &&
      form.start_time &&
      linkedEndDate &&
      form.end_time &&
      Number(form.attendees) > 0 &&
      (!notesRequired || form.notes.trim())
    )

  useEffect(() => {
    if (isEdit || isStandalone) return
    bookingSessionActions.setSpaceFormData({
      event_group_id: bookingSession.eventGroupId,
      space: activeSpaceId,
      spaceName: activeSpaceName,
      start_date: form.start_date,
      end_date: form.end_date,
      start_time: form.start_time,
      end_time: form.end_time,
      purpose: form.purpose,
      department: form.department,
      attendees: form.attendees,
      requirements: form.requirements,
      notes: form.notes,
      isExternal: form.isExternal,
      bookingType: form.bookingType,
      location: activeSpaceName,
    })
  }, [activeSpaceId, activeSpaceName, bookingSession.eventGroupId, form, isEdit, isStandalone])

  const continueLinkedBooking = (target) => {
    bookingSessionActions.setSpaceFormData({
      event_group_id: bookingSession.eventGroupId,
      space: activeSpaceId,
      spaceName: activeSpaceName,
      start_date: form.start_date,
      end_date: linkedEndDate,
      start_time: form.start_time,
      end_time: form.end_time,
      start_datetime: linkedStartIso,
      end_datetime: linkedEndIso,
      purpose: form.purpose,
      department: form.department,
      attendees: form.attendees,
      requirements: form.requirements,
      notes: form.notes,
      isExternal: form.isExternal,
      bookingType: form.bookingType,
    })

    const finalSequence = target === "mess"
      ? ["space", "mess", "review"]
      : ["space", "media", "review"]

    bookingSessionActions.startWizard({
      origin: window.location.pathname,
      sequence: finalSequence,
      initialStep: target,
    })

    onClose()
  }

  const validate = () => {
    const e = {}
    if (!form.purpose.trim()) e.purpose = "Please describe the purpose"
    if (!form.department) e.department = "Select your department"
    if (
      form.start_date === todayISO() &&
      form.start_time &&
      form.start_time < currentTimeISO() &&
      !isEdit
    ) {
      e.start_time = "Cannot select a past time."
    }
    if (!form.attendees || Number(form.attendees) < 1) {
      e.attendees = "Enter a valid number"
    } else if (exceedsCapacity) {
      e.attendees = `Capacity exceeded. Maximum allowed is ${activeSpaceCap}.`
    }
    if (notesRequired && !form.notes.trim())
      e.notes = "Please explain why this venue is needed for a small group."
    return e
  }

  const handleSubmit = async () => {
    if (isAvailable !== true || exceedsCapacity) return

    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const endDate = form.end_date || form.start_date
      const start_datetime = toLocalISO(form.start_date, form.start_time)
      const end_datetime = toLocalISO(endDate, form.end_time)

      const payload = {
        space: activeSpaceId,
        start_datetime,
        end_datetime,
        booking_type: isMultiDay ? form.bookingType : 'SINGLE',
        attendee_count: Number(form.attendees),
        purpose_of_booking_input: form.purpose,
        department: Number(form.department),
        user_notes: form.notes.trim() || "",
        equipment_requests: form.requirements.map((id) => ({ equipment: id, quantity: 1 })),
        is_external: form.isExternal,
      }

      if (isEdit) {
        await api.patch(`/spaces/requests/${initialData.id}/`, payload)
      } else {
        if (hasLinkedBookings) payload.event_group_id = bookingSession.eventGroupId
        const response = await api.post("/spaces/requests/", payload)
        bookingSessionActions.setSpaceFormData({
          id: response.data?.id,
          reference_code: response.data?.reference_code,
          event_group_id: response.data?.event_group_id || bookingSession.eventGroupId,
          space: activeSpaceId,
          spaceName: activeSpaceName,
          start_date: form.start_date,
          end_date: endDate,
          start_time: form.start_time,
          end_time: form.end_time,
          start_datetime,
          end_datetime,
          purpose: form.purpose,
        })
        bookingSessionActions.markComplete("space")
      }

      setSubmitted(true)
    } catch (error) {
      const errData = error.response?.data || {}
      const mappedErrors = {}

      if (errData.attendee_count)
        mappedErrors.attendees = Array.isArray(errData.attendee_count)
          ? errData.attendee_count[0]
          : errData.attendee_count
      if (errData.department)
        mappedErrors.department = Array.isArray(errData.department)
          ? errData.department[0]
          : errData.department
      if (errData.purpose_of_booking_input)
        mappedErrors.purpose = Array.isArray(errData.purpose_of_booking_input)
          ? errData.purpose_of_booking_input[0]
          : errData.purpose_of_booking_input
      if (errData.non_field_errors)
        mappedErrors.server = Array.isArray(errData.non_field_errors)
          ? errData.non_field_errors[0]
          : errData.non_field_errors

      if (Object.keys(mappedErrors).length === 0) {
        mappedErrors.server = errData.error || "Submission failed."
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
    const finishBooking = () => {
      bookingSessionActions.clearSession()
      onClose()
    }

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
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? "Update Successful" : "Request Submitted"}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your booking for{" "}
            <span className="font-semibold text-gray-700">{activeSpaceName}</span> has been{" "}
            {isEdit
              ? "updated and sent back for admin approval."
              : "sent for admin approval."}
            {form.isExternal && (
              <span className="block mt-1 text-xs text-amber-600 font-medium">
                Flagged as an external event.
              </span>
            )}
          </p>
          <button
            onClick={finishBooking}
            className="mt-2 w-full bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-xl text-sm font-medium transition"
          >
            {isEdit ? "Done" : "Finish Booking"}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  // Left panel derived values (normal modal only)
  const startH = form.start_time
    ? +form.start_time.split(":")[0] + +form.start_time.split(":")[1] / 60
    : null
  const endH = form.end_time
    ? +form.end_time.split(":")[0] + +form.end_time.split(":")[1] / 60
    : null

  const numDays =
    isMultiDay && form.start_date && form.end_date
      ? daySpan(form.start_date, form.end_date)
      : null

  const hrsPerDay =
    isMultiDay && form.start_time && form.end_time
      ? formatHoursPerDay(form.start_time, form.end_time)
      : null

  // ─────────────────────────────────────────────────────────────
  // Shared form body (used in both wizard and normal modal)
  // ─────────────────────────────────────────────────────────────

  const formBody = (
    <div className="space-y-6">
      {/* ── STEP 1: DATE & TIME ── */}
      <div className="space-y-4">
        <SectionLabel>Step 1: Pick a Time</SectionLabel>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" required error={errors.start_date}>
            <input
              type="date"
              min={todayISO()}
              className={inputCls(errors.start_date)}
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
          <Field label="End Date" required error={errors.end_date}>
            <input
              type="date"
              min={form.start_date || todayISO()}
              className={inputCls(errors.end_date)}
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </Field>
        </div>

        {isMultiDay && (
          <div className="col-span-2 mt-1 mb-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Event Type</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    name="bookingType"
                    value="SINGLE"
                    checked={form.bookingType === 'SINGLE'}
                    onChange={(e) => set('bookingType', e.target.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-600"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">Continuous Event (e.g. Hackathon)</span>
                  <span className="text-xs text-gray-500 mt-0.5">Blocks the venue completely from the start day to the end day, including overnight.</span>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    name="bookingType"
                    value="RECURRING"
                    checked={form.bookingType === 'RECURRING'}
                    onChange={(e) => set('bookingType', e.target.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-600"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">Daily Recurring (e.g. 5-day Seminar)</span>
                  <span className="text-xs text-gray-500 mt-0.5">Blocks the venue *only* between the selected times each day.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Time" required error={errors.start_time}>
            <input
              type="time"
              min={
                form.start_date === todayISO()
                  ? currentTimeISO() > COLLEGE_START
                    ? currentTimeISO()
                    : COLLEGE_START
                  : COLLEGE_START
              }
              max={COLLEGE_END}
              className={inputCls(errors.start_time)}
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
            />
          </Field>
          <Field label="End Time" required error={errors.end_time}>
            <input
              type="time"
              min={
                isMultiDay && form.bookingType === "SINGLE"
                  ? COLLEGE_START
                  : form.start_date === todayISO()
                  ? form.start_time && form.start_time > currentTimeISO()
                    ? form.start_time
                    : currentTimeISO()
                  : form.start_time || COLLEGE_START
              }
              max={COLLEGE_END}
              className={inputCls(errors.end_time)}
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
            />
          </Field>
        </div>

        {/* Availability Banner */}
        {isCheckingAvailability ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 animate-pulse">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-blue-800">Checking availability…</p>
          </div>
        ) : isAvailable === false ? (
          availabilityConflicts.length > 0 ? (
            <div className="border border-red-200 bg-red-50 rounded-xl overflow-hidden">
              {availabilityMsg && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200 bg-red-100/60">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs font-semibold text-red-800">{availabilityMsg}</p>
                </div>
              )}
              <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
                {availabilityConflicts.map((conflict, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                    <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-xs font-semibold text-red-800 w-28 shrink-0">{formatConflictDate(conflict.date)}</span>
                    <span className="text-xs text-red-700">{formatAMPM(conflict.start)} – {formatAMPM(conflict.end)}</span>
                    <span className="ml-auto text-[11px] text-red-500 font-medium shrink-0 truncate max-w-[120px]">{conflict.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-red-800">{availabilityMsg || "This time slot is unavailable."}</p>
            </div>
          )
        ) : isAvailable === true ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-bold text-green-800">Time slot is available!</p>
          </div>
        ) : null}
      </div>

      {/* ── STEP 2: EVENT DETAILS ── */}
      <div
        className={`space-y-6 transition-all duration-300 ${
          isAvailable === true
            ? "opacity-100"
            : "opacity-40 pointer-events-none select-none filter grayscale-[20%]"
        }`}
      >
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
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${
              form.isExternal ? "bg-amber-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                form.isExternal ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Purpose" required error={errors.purpose}>
            <input
              className={inputCls(errors.purpose)}
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="e.g. MCA Cloud Security Seminar"
            />
          </Field>
          <Field label="Department" required error={errors.department}>
            <select
              className={inputCls(errors.department)}
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            >
              <option value="">Select department</option>
              {dynamicDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.department_name}</option>
              ))}
            </select>
          </Field>
        </div>

        <SectionLabel>Step 3: Setup & Capacity</SectionLabel>

        {exceedsCapacity && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">Capacity exceeded</p>
                <p className="text-xs text-red-700 mt-0.5">
                  This venue supports only {activeSpaceCap} attendees. Please reduce attendees or choose a larger venue.
                </p>
              </div>
            </div>
          </div>
        )}

        <Field label="Expected attendees" required error={errors.attendees}>
          <input
            type="number"
            min="1"
            max={activeSpaceCap || undefined}
            className={inputCls(errors.attendees)}
            placeholder="e.g. 45"
            value={form.attendees}
            onChange={(e) => set("attendees", e.target.value)}
          />
        </Field>

        {isLowOccupancy && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Low occupancy for {activeSpaceName}</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {attendeeCount} attendees fills only {Math.round((attendeeCount / activeSpaceCap) * 100)}% of this venue.
                  Consider a smaller venue, or explain below why this venue is needed.
                </p>
                {isFetchingSuggestions && (
                  <p className="text-xs text-amber-600 mt-2 animate-pulse">Finding better-fit venues…</p>
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
                        <button
                          type="button"
                          onClick={() => switchHall(hall)}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-semibold transition"
                        >
                          Switch
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!isFetchingSuggestions && suggestedHalls.length === 0 && Number.isFinite(attendeeCount) && (
                  <p className="text-xs text-amber-600 mt-2">No smaller venues available — please explain in Notes below.</p>
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
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition text-left ${
                  active
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                    active ? "bg-green-700 border-green-700" : "border-gray-300"
                  }`}
                >
                  {active && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-xs font-medium">{req.name}</span>
              </button>
            )
          })}
        </div>

        <SectionLabel>
          Notes
          {notesRequired && (
            <span className="text-red-400 ml-1 normal-case font-normal">
              — required for low-occupancy bookings
            </span>
          )}
        </SectionLabel>
        <Field
          error={errors.notes}
          hint={notesRequired ? undefined : "Mention setup, technical support, seating changes…"}
        >
          <textarea
            rows={3}
            className={`${inputCls(errors.notes)} resize-none`}
            placeholder={
              notesRequired
                ? "Required: explain why this venue is needed for a small group…"
                : "Mention setup, technical support, seating changes…"
            }
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <LinkedBookingOptions
          visible={linkedOptionsReady}
          startIso={linkedStartIso}
          endIso={linkedEndIso}
          completedBookings={bookingSession.completedBookings}
          onAddMess={() => continueLinkedBooking("mess")}
          onAddMedia={() => continueLinkedBooking("media")}
        />
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // Wizard mode — matches Mess/Media layout exactly
  // ─────────────────────────────────────────────────────────────

  if (wizardMode) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Heading — matches SpaceDraftStep / MessDraftStep / MediaDraftStep */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-700">Space</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">Book a venue</h2>
          <p className="mt-2 text-sm text-gray-500">
            Choose your venue, schedule, and event details. Linked services will use this slot.
          </p>
        </div>

        {errors.server && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errors.server}
          </div>
        )}

        {isEdit && initialData?.status === "APPROVED" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              This booking is currently approved. Saving changes will move it back to{" "}
              <span className="font-semibold">Pending Review</span> and notify the admin.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {formBody}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Normal modal mode
  // ─────────────────────────────────────────────────────────────

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[32%] shrink-0 flex-col justify-between p-7"
          style={{
            background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
          }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {isEdit ? "Editing Request" : "New Booking"}
            </p>
            <h2 className="text-2xl font-bold text-white leading-tight">{activeSpaceName}</h2>

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
                : "Request a venue, choose your time, and add any details needed for approval."}
            </p>

            {activeSpaceCap !== null && (
              <div className="mt-4 bg-white/10 rounded-xl px-4 py-3">
                <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">Venue Capacity</p>
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
              <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">Selected Slot</p>

              {isMultiDay ? (
                form.start_date && form.end_date ? (
                  <div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-left">
                        <p className="text-white font-bold text-sm leading-tight">
                          {new Date(form.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
                        </p>
                        {form.start_time && <p className="text-green-200/70 text-xs mt-0.5">{formatAMPM(form.start_time)}</p>}
                      </div>
                      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="text-left">
                        <p className="text-white font-bold text-sm leading-tight">
                          {new Date(form.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
                        </p>
                        {form.end_time && <p className="text-green-200/70 text-xs mt-0.5">{formatAMPM(form.end_time)}</p>}
                      </div>
                    </div>
                    {numDays !== null && (
                      <p className="text-green-300/80 text-xs mt-3 font-medium">
                        {numDays} {numDays === 1 ? "day" : "days"}
                        {form.bookingType === "RECURRING" && hrsPerDay ? ` · ${hrsPerDay}` : ""}
                        {form.bookingType === "SINGLE" ? ` · Continuous Event` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">Pick a time to begin</p>
                )
              ) : (
                <>
                  {form.start_time ? (
                    <>
                      <p className="text-white font-bold text-base">
                        {formatAMPM(form.start_time)}
                        {form.end_time && ` – ${formatAMPM(form.end_time)}`}
                      </p>
                      {form.start_date && (
                        <p className="text-green-200/70 text-xs mt-1">
                          {new Date(form.start_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-white/50 text-sm">Pick a time to begin</p>
                  )}
                  <div className="mt-4 flex gap-[2px]">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const seg = 8 + i * 0.5
                      const fill = startH !== null && endH !== null && seg >= startH && seg < endH
                      return (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${fill ? "bg-green-400" : "bg-white/20"}`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] text-green-300/50 mt-1">
                    <span>08:00</span>
                    <span>18:00</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">Booking Form</p>
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit ? "Edit your booking" : "Secure this venue"}
              </h2>
            </div>
<button
  onClick={onClose}
  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition"
>
  ✕
</button></div>

          {/* RE-APPROVAL NOTICE */}
          {isEdit && initialData?.status === "APPROVED" && (
            <div className="mx-7 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shrink-0">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                This booking is currently approved. Saving changes will move it back to{" "}
                <span className="font-semibold">Pending Review</span> and notify the admin.
              </p>
            </div>
          )}

          {/* FORM BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
            {formBody}
          </div>

          {/* FOOTER */}
          <div className="shrink-0 flex justify-between items-center px-7 py-4 border-t border-gray-100 bg-gray-50/60">
            <div>
              {errors.server && (
                <p className="text-xs text-red-500 font-medium">{errors.server}</p>
              )}
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
<button
  onClick={onClose}
  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
>
  Cancel
</button>

<Tooltip
  text={
    isEdit
      ? "Save your changes. The booking will be re-reviewed if it was already approved."
      : "Submit your booking request. An admin will review and approve it."
  }
  position="top"
>
  <button
    onClick={handleSubmit}
    disabled={isSubmitting || isAvailable !== true || exceedsCapacity}
    className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isSubmitting ? "Saving..." : isEdit ? "Update Request" : "Send Request"}
  </button>
</Tooltip></div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default BookingModal