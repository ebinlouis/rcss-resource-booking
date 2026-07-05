import { useState, useEffect, useRef, useCallback } from "react"
import api from "../api/axios"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"
import { useAuth } from "./useAuth"
import toast from 'react-hot-toast'
import { useCreateSpaceBooking, useUpdateSpaceBooking } from "./useSpaceQueries"

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

export function useBookingForm({
  initialSpaceId,
  initialSpaceName,
  initialSpaceCap = null,
  initialData = null,
  prefillDate = "",
  prefillStart = "",
  prefillEnd = "",
  isStandalone = false,
  onClose,
  onLinkedIntent,
}) {
  const { user } = useAuth();
  const isStudent = user?.capabilities?.is_student || user?.roles?.includes('STUDENT');

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
        aiBookingSize: "SINGLE",
        faculty_sponsor: initialData.faculty_sponsor || "",
      }
    }

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
        aiBookingSize: "SINGLE",
        faculty_sponsor: "",
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
      aiBookingSize: sessionDraft?.aiBookingSize || "SINGLE",
      faculty_sponsor: sessionDraft?.faculty_sponsor || "",
    }
  })

  const [dynamicDepartments, setDynamicDepartments] = useState([])
  const [dynamicEquipment, setDynamicEquipment] = useState([])
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const set = useCallback((key, val) => {
    setForm((p) => {
      const next = { ...p, [key]: val }
      if (key === "start_date" && next.end_date && next.end_date < val) {
        next.end_date = val
      }
      return next
    })
    setErrors((p) => {
      if (p[key]) return { ...p, [key]: null }
      return p
    })
  }, [])

  const toggleReq = (id) => {
    setForm((p) => ({
      ...p,
      requirements: p.requirements.includes(id)
        ? p.requirements.filter((r) => r !== id)
        : [...p.requirements, id],
    }))
  }

  const justSwitchedRef = useRef(false)

  const switchHall = (space) => {
    setActiveSpaceId(space.id)
    setActiveSpaceName(space.name)
    setActiveSpaceCap(space.capacity_hard)
    setSuggestedHalls([])
    seenSuggestionIdsRef.current = []
    justSwitchedRef.current = true
  }

  const [isAvailable, setIsAvailable] = useState(null)
  const [availabilityMsg, setAvailabilityMsg] = useState("")
  const [availabilityConflicts, setAvailabilityConflicts] = useState([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)

  const [suggestedHalls, setSuggestedHalls] = useState([])
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(false)
  const [seenSpaceIds, setSeenSpaceIds] = useState([])
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)
  const debounceTimer = useRef(null)
  const availabilityTimer = useRef(null)
  const seenSuggestionIdsRef = useRef([])

  const attendeeCount = parseInt(form.attendees, 10)
  const exceedsCapacity =
    Number.isFinite(attendeeCount) &&
    activeSpaceCap !== null &&
    attendeeCount > activeSpaceCap
  const isAiLab = activeSpaceName?.toLowerCase().includes("ai lab")
  const isLowOccupancy =
    !isAiLab &&
    Number.isFinite(attendeeCount) &&
    attendeeCount > 0 &&
    activeSpaceCap !== null &&
    !exceedsCapacity &&
    attendeeCount / activeSpaceCap < LOW_OCCUPANCY_THRESHOLD

  const isMultiDay =
    form.start_date && form.end_date && form.start_date !== form.end_date

  const triggerReason = isAvailable === false
    ? 'unavailable'
    : isLowOccupancy
    ? 'low_occupancy'
    : 'exceeds_capacity'

  // Auto-set attendees to 1 for AI Lab single bookings
  useEffect(() => {
    if (isAiLab && form.aiBookingSize === 'SINGLE' && !form.attendees) {
      setTimeout(() => set('attendees', 1), 0)
    }
  }, [isAiLab, form.aiBookingSize, form.attendees, set])

  useEffect(() => {
    const fetchDynamicData = async () => {
      try {
        const deptRes = await api.get("/auth/departments/")
        const depts = deptRes.data.results || deptRes.data || []
        setDynamicDepartments(depts)
      } catch (err) {
        console.error("Failed loading dynamic data:", err)
      }
    }
    fetchDynamicData()
  }, [])

  useEffect(() => {
    if (!activeSpaceId) return
    const fetchSpaceData = async () => {
      try {
        const res = await api.get(`/spaces/catalog/${activeSpaceId}/`)
        setActiveSpaceCap(res.data.capacity_hard ?? null)
        if (res.data.built_in_equipment) {
            const equips = res.data.built_in_equipment.map(eq => ({
                id: eq.equipment,
                name: eq.equipment_name,
                is_active: true
            }))
            setDynamicEquipment(equips)
        } else {
            setDynamicEquipment([])
        }
      } catch {
        // Non-fatal — capacity will remain null
      }
    }
    fetchSpaceData()
  }, [activeSpaceId])

  useEffect(() => {
    if (initialSpaceId !== activeSpaceId) {
      setTimeout(() => setSeenSpaceIds([]), 0)
      seenSuggestionIdsRef.current = []
    }
  }, [initialSpaceId, activeSpaceId])

  // Bug 6 fix: reset suggestion state when the booking time context changes so
  // previously excluded spaces are eligible again for the new time slot.
  useEffect(() => {
    setSeenSpaceIds([])
    seenSuggestionIdsRef.current = []
    setSuggestedHalls([])
    setHasMoreSuggestions(false)
  }, [form.start_date, form.start_time, form.end_time])

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

    setTimeout(() => {
      setIsAvailable(null)
    }, 0)

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
        setAvailabilityMsg("Could not verify availability. Please try again.")
        setAvailabilityConflicts([])
      } finally {
        setIsCheckingAvailability(false)
      }
    }, 600)

    return () => clearTimeout(availabilityTimer.current)
  }, [form.start_date, form.end_date, form.start_time, form.end_time, form.bookingType, isMultiDay, activeSpaceId, isEdit, initialData])

  // Stable fetch function shared by the suggestion effect and showMoreSuggestions.
  // append=false replaces the list; append=true adds to the end ("show more").
  const fetchSuggestions = useCallback(async (append = false) => {
    if (!Number.isFinite(attendeeCount) || attendeeCount <= 0) {
      if (!append) {
        setSuggestedHalls([])
        setHasMoreSuggestions(false)
      }
      return
    }

    // For a fresh fetch, reset suggestion tracking so re-fired effects
    // don't exclude the results that were just displayed.
    if (!append) {
      seenSuggestionIdsRef.current = []
    }

    const queryParams = new URLSearchParams({
      space_id: activeSpaceId,
      attendee_count: attendeeCount,
      date: form.start_date,
      start_time: form.start_time,
      end_time: form.end_time,
      exclude_ids: [...new Set([...seenSpaceIds, ...seenSuggestionIdsRef.current])].join(','),
      trigger_reason: triggerReason,
      booking_type: form.bookingType,
    })
    if (form.end_date && (form.bookingType === 'RECURRING' || form.bookingType === 'SINGLE')) {
      queryParams.set('end_date', form.end_date)
    }

    setIsFetchingSuggestions(true)
    try {
      const res = await api.get(`/spaces/catalog/suggestions/?${queryParams.toString()}`)
      const suggestions = res.data.results ?? res.data ?? []
      const batch = suggestions.slice(0, 3)
      if (append) {
        setSuggestedHalls((prev) => [...prev, ...batch])
      } else {
        setSuggestedHalls(batch)
      }
      setHasMoreSuggestions(suggestions.length === 3)
      // Track returned IDs via ref so subsequent fetches exclude them
      // (using a ref avoids re-triggering the effect / recreating this callback)
      if (batch.length > 0) {
        const newIds = batch.map((s) => s.id)
        seenSuggestionIdsRef.current = [...new Set([...seenSuggestionIdsRef.current, ...newIds])]
      }
    } catch {
      if (!append) {
        setSuggestedHalls([])
        setHasMoreSuggestions(false)
      }
    } finally {
      setIsFetchingSuggestions(false)
    }
  }, [activeSpaceId, attendeeCount, form.start_date, form.start_time, form.end_time, form.end_date, form.bookingType, isAvailable, exceedsCapacity, seenSpaceIds, triggerReason])

  const showMoreSuggestions = useCallback(() => {
    fetchSuggestions(true)
  }, [fetchSuggestions])

  useEffect(() => {
    // Bug 7 fix: skip exactly one effect run immediately after the user switches
    // halls so we don't fire a new suggestion fetch for the newly selected hall.
    if (justSwitchedRef.current === true) {
      justSwitchedRef.current = false
      return
    }

    clearTimeout(debounceTimer.current)

    const isUnavailable = isAvailable === false

    // Bug 2 fix: clear suggestions synchronously — no setTimeout, no debounce.
    if (!isLowOccupancy && !isUnavailable && !exceedsCapacity) {
      setSuggestedHalls([])
      setHasMoreSuggestions(false)
      return
    }

    if (!Number.isFinite(attendeeCount) || attendeeCount <= 0) {
      setSuggestedHalls([])
      setHasMoreSuggestions(false)
      return
    }

    // Build the exclude list locally so the fetch can proceed in the same
    // effect run without waiting for a setState + re-render cycle (fixes Bug 1).
    if (isUnavailable || exceedsCapacity) {
      if (!seenSpaceIds.includes(activeSpaceId)) {
        const updatedSeen = [...seenSpaceIds, activeSpaceId]
        setSeenSpaceIds(updatedSeen)
      }
    }

    debounceTimer.current = setTimeout(() => fetchSuggestions(false), 500)

    return () => clearTimeout(debounceTimer.current)
  }, [isLowOccupancy, isAvailable, exceedsCapacity, activeSpaceId, attendeeCount, form.start_date, form.end_date, form.start_time, form.end_time, form.bookingType, activeSpaceCap, seenSpaceIds, fetchSuggestions])

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
    !isStudent &&
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
      (!notesRequired || form.notes.trim()) &&
      (!isStudent || form.faculty_sponsor)
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
      aiBookingSize: form.aiBookingSize,
      faculty_sponsor: form.faculty_sponsor,
      location: activeSpaceName,
    })
  }, [activeSpaceId, activeSpaceName, bookingSession.eventGroupId, form, isEdit, isStandalone])

  const continueLinkedBooking = (target) => {
    const selectedEquipment = dynamicEquipment
      .filter((item) => form.requirements.includes(item.id))
      .map((item) => item.name)

    const payload = {
      space: activeSpaceId,
      start_datetime: linkedStartIso,
      end_datetime: linkedEndIso,
      booking_type: isMultiDay ? form.bookingType : 'SINGLE',
      attendee_count: Number(form.attendees),
      purpose_of_booking_input: form.purpose,
      department: Number(form.department),
      user_notes: form.notes.trim() || "",
      equipment_requests: form.requirements.map((id) => ({ equipment: Number(id), quantity: 1 })),
      is_external: form.isExternal,
      faculty_sponsor: isAiLab ? null : (form.faculty_sponsor || null),
    }

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
      aiBookingSize: form.aiBookingSize,
      faculty_sponsor: form.faculty_sponsor,
      equipmentSummary: selectedEquipment.length ? selectedEquipment.join(", ") : "None selected",
      payload,
    })

    if (onLinkedIntent) {
      onLinkedIntent(target)
      return
    }

    const finalSequence = target === "mess"
      ? ["space", "mess", "review"]
      : ["space", "media", "review"]

    bookingSessionActions.startWizard({
      origin: window.location.pathname,
      sequence: finalSequence,
      initialStep: target,
    })

    if (onClose) onClose()
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
      
    if (isStudent && !isAiLab && !form.faculty_sponsor) {
        e.faculty_sponsor = "Faculty sponsor is required for students";
    }
    return e
  }

  const createMutation = useCreateSpaceBooking()
  const updateMutation = useUpdateSpaceBooking()

  const handleSubmit = async () => {
    if (isAvailable !== true || exceedsCapacity) {
      return
    }

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
        faculty_sponsor: isAiLab ? null : (form.faculty_sponsor || null),
      }

      if (isEdit) {
        await updateMutation.mutateAsync({ id: initialData.id, data: payload })
      } else {
        if (hasLinkedBookings) payload.event_group_id = bookingSession.eventGroupId
        const response = await createMutation.mutateAsync(payload)
        bookingSessionActions.setSpaceFormData({
          id: response?.id,
          reference_code: response?.reference_code,
          event_group_id: response?.event_group_id || bookingSession.eventGroupId,
          space: activeSpaceId,
          spaceName: activeSpaceName,
          start_date: form.start_date,
          end_date: endDate,
          start_time: form.start_time,
          end_time: form.end_time,
          start_datetime,
          end_datetime,
          purpose: form.purpose,
          faculty_sponsor: isAiLab ? null : (form.faculty_sponsor || null),
        })
        bookingSessionActions.markComplete("space")
      }
      toast.success("Booking submitted successfully!")
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
      if (errData.non_field_errors) {
        const msg = Array.isArray(errData.non_field_errors)
          ? errData.non_field_errors[0]
          : errData.non_field_errors

        if (msg.toLowerCase().includes("overlap")) {
          toast.error("This venue is already booked for the selected time slot.")
          return
        }

        mappedErrors.server = msg
      }

      if (Object.keys(mappedErrors).length === 0) {
        const rawError = errData.error || errData.detail || ""

        if (
          rawError.includes("exclude_overlapping_approved_space_bookings") ||
          rawError.includes("conflicting key value violates exclusion constraint")
        ) {
          toast.error("This venue is already booked for the selected time slot.")
        } else {
          toast.error(rawError || "Submission failed.")
        }

        return
      }
      setErrors(mappedErrors)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    activeSpaceId, activeSpaceName, activeSpaceCap, form, setForm, set, toggleReq, switchHall,
    dynamicDepartments, dynamicEquipment, errors, submitted, isSubmitting,
    isAvailable, availabilityMsg, availabilityConflicts, isCheckingAvailability,
    suggestedHalls, hasMoreSuggestions, showMoreSuggestions, isFetchingSuggestions, attendeeCount, exceedsCapacity,
    isLowOccupancy, isMultiDay, notesRequired, linkedEndDate, linkedStartIso,
    linkedEndIso, hasLinkedBookings, linkedOptionsReady, continueLinkedBooking,
    handleSubmit, isEdit, sessionDraft, isStudent, isAiLab, triggerReason,
  }
}
