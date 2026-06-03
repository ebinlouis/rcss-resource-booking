import { createPortal } from "react-dom"
import { useState, useEffect, useMemo } from "react"
import {
  Clapperboard,
  Package,
  X,
  AlertTriangle,
} from "lucide-react"
import mediaService from "../api/mediaApi"
import ErrorBoundary from "./ErrorBoundary"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"
import { useCreateMediaBooking, useUpdateMediaBooking } from "../hooks/useMediaQueries"

// ── Helpers ────────────────────────────────────────────────────────────────

const splitDatetime = (isoString) => {
  if (!isoString) return { date: "", time: "" }
  const dt = formatForDatetimeLocal(isoString)
  if (!dt) return { date: "", time: "" }
  const [date, time] = dt.split("T")
  return { date: date || "", time: time || "" }
}

const formatForDatetimeLocal = (isoString) => {
  if (!isoString) return ""
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ""
  const year    = date.getFullYear()
  const month   = String(date.getMonth() + 1).padStart(2, "0")
  const day     = String(date.getDate()).padStart(2, "0")
  const hours   = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const joinDatetime = (date, time) => {
  if (!date || !time) return ""
  return `${date}T${time}`
}

const toDatetimeLocal = (date, time) => {
  if (!date || !time) return ""
  return `${date}T${time}`
}

const getISTMinDate = () => {
  const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  const d = new Date(nowStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const getISTMinDatetime = () => {
  const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  const d = new Date(nowStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const formatDisplayDateTime = (date, time) => {
  if (!date || !time) return "--:-- -"
  const dt = new Date(`${date}T${time}`)
  if (isNaN(dt.getTime())) return "--:-- -"
  return dt.toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  })
}

// ── Styling ────────────────────────────────────────────────────────────────

const inputCls = (error) =>
  `w-full border ${
    error
      ? "border-red-400 focus:ring-red-400 bg-red-50"
      : "border-gray-200 focus:ring-green-600 bg-white"
  } rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 transition-all`

// Single field wrapper — label + input + error
function Field({ label, required, children, error, helpText }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error    && <span className="text-red-500 text-xs">{error}</span>}
      {helpText && !error && <span className="text-gray-400 text-[11px]">{helpText}</span>}
    </div>
  )
}

// Section divider — matches transport caps-label style
function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// ── Initial state ──────────────────────────────────────────────────────────

const INITIAL_SPLIT = {
  event_start_date:  "", event_start_time:  "",
  event_end_date:    "", event_end_time:    "",
  setup_start_date:  "", setup_start_time:  "",
  teardown_end_date: "", teardown_end_time: "",
}

const INITIAL_FORM = {
  event_name:         "",
  space:              "",
  requested_services: "",
  user_notes:         "",
  is_external_event:  false,
  is_team_request:    false,
}

// ── Component ──────────────────────────────────────────────────────────────

function MediaBookingModal({ onClose, onSuccess, initialData }) {
  const bookingSession  = useBookingSession()
  const linkedSpace     = bookingSession.spaceFormData
  const isLinkedBooking = Boolean(!initialData && linkedSpace?.event_group_id)

  const [requestMode, setRequestMode] = useState(() =>
    initialData
      ? (initialData.is_team_request ? "team" : "equipment")
      : (bookingSession.mediaRequestMode || (isLinkedBooking ? "team" : null))
  )

  const [needsBuffer, setNeedsBuffer] = useState(() => {
    if (initialData) {
      return (
        initialData.setup_start_datetime !== initialData.event_start_datetime ||
        initialData.teardown_end_datetime !== initialData.event_end_datetime
      )
    }
    return false
  })

  const [split, setSplit] = useState(() => {
    if (initialData) {
      const es = splitDatetime(initialData.event_start_datetime)
      const ee = splitDatetime(initialData.event_end_datetime)
      const ss = splitDatetime(initialData.setup_start_datetime)
      const te = splitDatetime(initialData.teardown_end_datetime)
      return {
        event_start_date:  es.date, event_start_time:  es.time,
        event_end_date:    ee.date, event_end_time:    ee.time,
        setup_start_date:  ss.date, setup_start_time:  ss.time,
        teardown_end_date: te.date, teardown_end_time: te.time,
      }
    }
    if (isLinkedBooking) {
      const es = splitDatetime(toDatetimeLocal(linkedSpace?.start_date, linkedSpace?.start_time))
      const ee = splitDatetime(toDatetimeLocal(linkedSpace?.end_date || linkedSpace?.start_date, linkedSpace?.end_time))
      return {
        event_start_date: es.date, event_start_time: es.time,
        event_end_date:   ee.date, event_end_time:   ee.time,
        setup_start_date: es.date, setup_start_time: es.time,
        teardown_end_date: ee.date, teardown_end_time: ee.time,
      }
    }
    return INITIAL_SPLIT
  })

  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...INITIAL_FORM,
        event_name:         initialData.event_name || "",
        space:              initialData.space?.id || initialData.space_details?.id || initialData.space || "",
        requested_services: initialData.requested_services || "",
        user_notes:         initialData.user_notes || "",
        is_external_event:  initialData.is_external_event || false,
        is_team_request:    initialData.is_team_request || false,
      }
    }
    if (isLinkedBooking) {
      return {
        ...INITIAL_FORM,
        event_name:         linkedSpace?.purpose || "",
        space:              linkedSpace?.space || "",
        is_team_request:    true,
        requested_services: "Event media support",
      }
    }
    return INITIAL_FORM
  })

  const [equipmentRequests,    setEquipmentRequests]    = useState(() => {
    if (initialData && !initialData.is_team_request && initialData.equipment_requests) {
      return initialData.equipment_requests.map((req) => ({ equipment: req.equipment, quantity: req.quantity }))
    }
    return []
  })

  const [availableEquipment, setAvailableEquipment] = useState([])
  const [checkingInventory,  setCheckingInventory]  = useState(false)
  const [errors,             setErrors]             = useState({})
  const [submitting,         setSubmitting]         = useState(false)
  const [spaces,             setSpaces]             = useState([])

  useEffect(() => {
    mediaService.getSpaces()
      .then((data) => setSpaces(data))
      .catch((err) => console.error("Could not load spaces:", err))
  }, [])

  // ── Derived ISO strings ────────────────────────────────────────────────────

  const eventStartISO  = joinDatetime(split.event_start_date,  split.event_start_time)
  const eventEndISO    = joinDatetime(split.event_end_date,    split.event_end_time)
  const setupStartISO  = joinDatetime(split.setup_start_date,  split.setup_start_time)
  const teardownEndISO = joinDatetime(split.teardown_end_date, split.teardown_end_time)

  const actualSetup    = needsBuffer && setupStartISO  ? setupStartISO  : eventStartISO
  const actualTeardown = needsBuffer && teardownEndISO ? teardownEndISO : eventEndISO
  const isTeamRequest  = requestMode === "team"

  // ── Inventory check ────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true
    const timeoutId = setTimeout(() => {
      if (!isMounted) return
      if (!isTeamRequest && eventStartISO && eventEndISO) {
        const setupDate    = new Date(actualSetup)
        const startDate    = new Date(eventStartISO)
        const endDate      = new Date(eventEndISO)
        const teardownDate = new Date(actualTeardown)
        if (setupDate <= startDate && startDate < endDate && endDate <= teardownDate) {
          setCheckingInventory(true)
          mediaService
            .checkAvailability(new Date(actualSetup).toISOString(), new Date(actualTeardown).toISOString(), initialData?.id)
            .then((data) => {
              if (!isMounted) return
              setAvailableEquipment(data)
              setEquipmentRequests((prev) =>
                prev.map((req) => {
                  if (!req.equipment) return req
                  const item = data.find((eq) => eq.id.toString() === req.equipment.toString())
                  if (!item || (item.currently_available < req.quantity && !initialData)) return { equipment: "", quantity: 1 }
                  return req
                })
              )
            })
            .catch((err) => console.error("Inventory check failed", err))
            .finally(() => { if (isMounted) setCheckingInventory(false) })
          return
        }
      }
      setAvailableEquipment([])
    }, 400)
    return () => { isMounted = false; clearTimeout(timeoutId) }
  }, [eventStartISO, eventEndISO, actualSetup, actualTeardown, isTeamRequest, initialData])

  const groupedEquipment = useMemo(() => {
    return availableEquipment.reduce((acc, eq) => {
      if (!acc[eq.category]) acc[eq.category] = []
      acc[eq.category].push(eq)
      return acc
    }, {})
  }, [availableEquipment])

  const hasEquipmentHardBlock = useMemo(() => {
    if (isTeamRequest) return false
    return equipmentRequests.some((req) => {
      if (!req.equipment) return false
      const item = availableEquipment.find((eq) => eq.id.toString() === req.equipment.toString())
      return item && Number(req.quantity) > item.currently_available
    })
  }, [availableEquipment, equipmentRequests, isTeamRequest])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSplitChange = (field, value) => {
    setSplit((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const addEquipmentRow    = () => setEquipmentRequests([...equipmentRequests, { equipment: "", quantity: 1 }])
  const removeEquipmentRow = (index) => setEquipmentRequests(equipmentRequests.filter((_, i) => i !== index))

  const handleEquipmentChange = (index, field, value) => {
    const newReqs = [...equipmentRequests]
    if (field === "quantity") { newReqs[index][field] = Math.max(1, parseInt(value, 10) || 1) }
    else {
      newReqs[index][field] = value
      if (field === "equipment") newReqs[index].quantity = 1
    }
    setEquipmentRequests(newReqs)
    if (errors[`eq_${index}`] || errors[`qty_${index}`]) {
      setErrors((prev) => { const n = { ...prev }; delete n[`eq_${index}`]; delete n[`qty_${index}`]; return n })
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {}
    if (!formData.event_name.trim()) e.event_name = "Required"
    if (!formData.space)             e.space       = "Required"
    if (!split.event_start_date)     e.event_start_date = "Required"
    if (!split.event_start_time)     e.event_start_time = "Required"
    if (!split.event_end_date)       e.event_end_date   = "Required"
    if (!split.event_end_time)       e.event_end_time   = "Required"

    const startDt = eventStartISO ? new Date(eventStartISO) : null
    const endDt   = eventEndISO   ? new Date(eventEndISO)   : null
    const setupDt = needsBuffer && setupStartISO  ? new Date(setupStartISO)  : startDt
    const tearDt  = needsBuffer && teardownEndISO ? new Date(teardownEndISO) : endDt

    if (startDt && endDt && startDt >= endDt) {
      e.event_end_time = "Must be after start time"
      e.timeError = "Event End must be after Event Start."
    }

    if (needsBuffer) {
      if (!split.setup_start_date || !split.setup_start_time)   e.setup_start_time   = "Required"
      if (!split.teardown_end_date || !split.teardown_end_time) e.teardown_end_time  = "Required"
      if (setupDt && startDt && setupDt > startDt) {
        e.setup_start_time = "Must be before event starts"
        e.timeError = "Setup time cannot start after the event begins."
      }
      if (tearDt && endDt && tearDt < endDt) {
        e.teardown_end_time = "Must be after event ends"
        e.timeError = "Pack-up time cannot end before the event ends."
      }
    }

    const now        = new Date()
    const oldSetupDt = initialData ? new Date(initialData.setup_start_datetime || initialData.event_start_datetime) : null
    const timeChanged = !initialData || oldSetupDt?.getTime() !== setupDt?.getTime()

    if (timeChanged && setupDt && setupDt < now) {
      e.timeError = "You cannot select a time block that has already passed."
      if (needsBuffer) e.setup_start_time = "Time has passed"
      else             e.event_start_time = "Time has passed"
    }

    if (!isTeamRequest) {
      equipmentRequests.forEach((req, idx) => {
        if (!req.equipment) { e[`eq_${idx}`] = "Select item"; return }
        if (!req.quantity || req.quantity < 1) { e[`qty_${idx}`] = "Min 1"; return }
        const inventoryItem = availableEquipment.find((eq) => eq.id.toString() === req.equipment.toString())
        if (inventoryItem && req.quantity > inventoryItem.currently_available) {
          e[`qty_${idx}`] = `Only ${inventoryItem.currently_available} available`
          e.timeError = e.timeError || `Not enough stock: only ${inventoryItem.currently_available} "${inventoryItem.name}" available.`
        }
      })
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const createMutation = useCreateMediaBooking()
  const updateMutation = useUpdateMediaBooking()

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validate()) return

    const payload = {
      event_name:            formData.event_name,
      space:                 formData.space,
      event_start_datetime:  new Date(eventStartISO).toISOString(),
      event_end_datetime:    new Date(eventEndISO).toISOString(),
      setup_start_datetime:  new Date(actualSetup).toISOString(),
      teardown_end_datetime: new Date(actualTeardown).toISOString(),
      is_team_request:       isTeamRequest,
      is_external_event:     formData.is_external_event,
      requested_services:    isTeamRequest ? "Event media support" : formData.requested_services,
      user_notes:            formData.user_notes,
    }

    if (isLinkedBooking || initialData?.event_group_id) {
      payload.event_group_id = initialData?.event_group_id || linkedSpace?.event_group_id || bookingSession.eventGroupId
    }

    if (!isTeamRequest) {
      payload.equipment_requests = equipmentRequests
        .filter((req) => req.equipment)
        .map((req) => ({ equipment: parseInt(req.equipment, 10), quantity: parseInt(req.quantity, 10) }))
    }

    try {
      setSubmitting(true)
      if (initialData?.id) {
        await updateMutation.mutateAsync({ id: initialData.id, data: payload })
      } else {
        await createMutation.mutateAsync(payload)
        if (isLinkedBooking) bookingSessionActions.markComplete("media")
      }
      bookingSessionActions.clearSession()
      bookingSessionActions.setMediaRequestMode(null)
      setRequestMode(null)
      onSuccess?.()
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        Object.keys(data).forEach((key) => {
          mapped[key] = Array.isArray(data[key]) ? data[key][0] : data[key]
        })
        if (data.non_field_errors)
          mapped.timeError = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors
        else if (data.equipment_requests)
          mapped.timeError = mapped.equipment_requests
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Submission failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Request type picker ────────────────────────────────────────────────────

  if (!requestMode) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-green-700 mb-1.5">Media Booking</p>
            <h2 className="text-2xl font-bold text-gray-900">What would you like to book?</h2>
            <p className="text-sm text-gray-500 mt-2">Choose an option to continue.</p>
          </div>
          <div className="grid gap-4 p-8 md:grid-cols-2">
            <button
              onClick={() => {
                setRequestMode("team")
                bookingSessionActions.setMediaRequestMode("team")
                setNeedsBuffer(false)
                setEquipmentRequests([])
                setAvailableEquipment([])
                setFormData((prev) => ({ ...prev, is_team_request: true, requested_services: "Event media support" }))
              }}
              className="text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-green-200 hover:bg-green-50 transition group"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700 group-hover:bg-green-200 transition">
                <Clapperboard className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Media Team Support</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">Request media support for your event. Equipment and staff will be arranged after review.</p>
            </button>
            <button
              onClick={() => {
                setRequestMode("equipment")
                bookingSessionActions.setMediaRequestMode("equipment")
                setFormData((prev) => ({ ...prev, is_team_request: false }))
              }}
              className="text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-green-200 hover:bg-green-50 transition group"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700 group-hover:bg-green-200 transition">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Book Equipment</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">Choose cameras, microphones, tripods, and other equipment for your event.</p>
            </button>
          </div>
          <div className="flex justify-end px-8 py-5 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => { bookingSessionActions.clearSession(); onClose() }}
              className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">
        <ErrorBoundary>

          {/* ── LEFT PANEL ── */}
          <div
            className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
            style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">Media Services</p>
              <h2 className="text-2xl font-bold text-white">
                {initialData ? "Edit Details" : isTeamRequest ? "Media Support" : "New Booking"}
              </h2>
              {formData.is_external_event && (
                <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  External Event
                </span>
              )}
              <p className="text-sm text-green-200/80 mt-4 leading-relaxed">
                {isTeamRequest
                  ? <>1. Choose event timing<br />2. Select location<br />3. Tell us what support you need</>
                  : <>1. Choose booking time<br />2. Select equipment<br />3. Add event details</>}
              </p>
            </div>

            <div className="space-y-3">
              {/* Event timing card */}
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-[10px] text-green-300 uppercase font-semibold tracking-wider mb-2.5">Event Timing</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-green-300/70 uppercase font-semibold mb-0.5">Starts</p>
                      <p className="text-white text-sm font-semibold tabular-nums">
                        {split.event_start_date && split.event_start_time
                          ? formatDisplayDateTime(split.event_start_date, split.event_start_time)
                          : "--:-- -"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-green-300/70 uppercase font-semibold mb-0.5">Ends</p>
                      <p className="text-white text-sm font-semibold tabular-nums">
                        {split.event_end_date && split.event_end_time
                          ? formatDisplayDateTime(split.event_end_date, split.event_end_time)
                          : "--:-- -"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buffer card */}
              {needsBuffer && (
                <div className="bg-white/10 rounded-xl p-4 border border-amber-400/20">
                  <p className="text-[10px] text-amber-300 uppercase font-semibold tracking-wider mb-2.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Total Duration
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-white text-sm font-semibold tabular-nums">
                        {split.setup_start_date && split.setup_start_time
                          ? formatDisplayDateTime(split.setup_start_date, split.setup_start_time)
                          : "--:-- -"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-white text-sm font-semibold tabular-nums">
                        {split.teardown_end_date && split.teardown_end_time
                          ? formatDisplayDateTime(split.teardown_end_date, split.teardown_end_time)
                          : "--:-- -"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Approval card */}
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-[10px] text-green-300 uppercase font-semibold tracking-wider mb-1">Approval</p>
                <p className="text-white text-sm font-semibold">Admin verification required</p>
              </div>
            </div>
          </div>

          {/* ── RIGHT FORM ── */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">

            {/* Header */}
            <div className="flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-green-700 mb-0.5">
                  {initialData ? "Edit Booking" : "New Booking"}
                </p>
                <h2 className="text-xl font-bold text-gray-900">
                  {isTeamRequest ? "Media Team Booking" : "Equipment Booking"}
                </h2>
              </div>
              <button
                onClick={() => { bookingSessionActions.clearSession(); onClose() }}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode switcher (edit only) */}
            {initialData && (
              <div className="px-8 pt-4 pb-2 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    const newMode = isTeamRequest ? "equipment" : "team"
                    setRequestMode(newMode)
                    setFormData((prev) => ({
                      ...prev,
                      is_team_request:    newMode === "team",
                      requested_services: newMode === "team" ? "Event media support" : "",
                    }))
                    if (newMode === "team") setEquipmentRequests([])
                  }}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5"
                >
                  {isTeamRequest ? <Package className="w-3.5 h-3.5" /> : <Clapperboard className="w-3.5 h-3.5" />}
                  Switch to {isTeamRequest ? "Equipment Borrowing" : "Media Team Booking"}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4">

              {/* Error banner */}
              {errors.timeError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errors.timeError}
                </div>
              )}

              {isLinkedBooking && isTeamRequest && bookingSession.mediaCapacity?.limited_capacity && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  Media team availability is limited during this time. Your request will still be reviewed.
                </div>
              )}

              {/* ── PICKUP SCHEDULE (transport style caps label) ── */}
              <SectionDivider>Pickup Schedule</SectionDivider>

              {/* Event Starts row */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Event start date" required error={errors.event_start_date}>
                  <input
                    type="date"
                    min={getISTMinDate()}
                    className={inputCls(errors.event_start_date)}
                    value={split.event_start_date}
                    onChange={(e) => handleSplitChange("event_start_date", e.target.value)}
                  />
                </Field>
                <Field label="Event start time" required error={errors.event_start_time}>
                  <input
                    type="time"
                    className={inputCls(errors.event_start_time)}
                    value={split.event_start_time}
                    onChange={(e) => handleSplitChange("event_start_time", e.target.value)}
                  />
                </Field>
              </div>

              {/* Event Ends row */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Event end date" required error={errors.event_end_date}>
                  <input
                    type="date"
                    min={split.event_start_date || getISTMinDate()}
                    className={inputCls(errors.event_end_date)}
                    value={split.event_end_date}
                    onChange={(e) => handleSplitChange("event_end_date", e.target.value)}
                  />
                </Field>
                <Field label="Event end time" required error={errors.event_end_time}>
                  <input
                    type="time"
                    className={inputCls(errors.event_end_time)}
                    value={split.event_end_time}
                    onChange={(e) => handleSplitChange("event_end_time", e.target.value)}
                  />
                </Field>
              </div>

              {/* Buffer checkbox */}
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer w-max">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600 cursor-pointer"
                    checked={needsBuffer}
                    onChange={(e) => setNeedsBuffer(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700 select-none">
                    Add setup and wrap-up time for the media team
                  </span>
                </label>
              </div>

              {/* Buffer fields */}
              {needsBuffer && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Prep / arrival date" required={needsBuffer} error={errors.setup_start_date}>
                      <input
                        type="date"
                        min={getISTMinDate()}
                        className={inputCls(errors.setup_start_date)}
                        value={split.setup_start_date}
                        onChange={(e) => handleSplitChange("setup_start_date", e.target.value)}
                      />
                    </Field>
                    <Field label="Prep / arrival time" required={needsBuffer} error={errors.setup_start_time}>
                      <input
                        type="time"
                        className={inputCls(errors.setup_start_time)}
                        value={split.setup_start_time}
                        onChange={(e) => handleSplitChange("setup_start_time", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Pack-up finish date" required={needsBuffer} error={errors.teardown_end_date}>
                      <input
                        type="date"
                        min={split.event_end_date || getISTMinDate()}
                        className={inputCls(errors.teardown_end_date)}
                        value={split.teardown_end_date}
                        onChange={(e) => handleSplitChange("teardown_end_date", e.target.value)}
                      />
                    </Field>
                    <Field label="Pack-up finish time" required={needsBuffer} error={errors.teardown_end_time}>
                      <input
                        type="time"
                        className={inputCls(errors.teardown_end_time)}
                        value={split.teardown_end_time}
                        onChange={(e) => handleSplitChange("teardown_end_time", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {/* ── EQUIPMENT (equipment mode only) ── */}
              {!isTeamRequest && (
                <>
                  <SectionDivider>Equipment</SectionDivider>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-sm font-semibold text-gray-800">Available Equipment</label>
                      {checkingInventory && (
                        <span className="text-xs text-blue-600 animate-pulse font-medium bg-blue-50 px-2 py-1 rounded">
                          Checking availability…
                        </span>
                      )}
                    </div>

                    {availableEquipment.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-500 font-medium">
                          Please select event timing to view available equipment.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {equipmentRequests.map((req, index) => {
                          const selectedEq  = availableEquipment.find((eq) => eq.id.toString() === req.equipment.toString())
                          const maxQty      = selectedEq ? selectedEq.currently_available : 1
                          const isOverLimit = selectedEq && req.quantity > selectedEq.currently_available

                          return (
                            <div key={index} className="flex gap-3 items-start">
                              <div className="flex-1">
                                <select
                                  className={inputCls(errors[`eq_${index}`])}
                                  value={req.equipment}
                                  onChange={(e) => handleEquipmentChange(index, "equipment", e.target.value)}
                                >
                                  <option value="">-- Select Equipment --</option>
                                  {Object.entries(groupedEquipment).map(([category, items]) => (
                                    <optgroup key={category} label={category}>
                                      {items.map((eq) => {
                                        const isSelectedElsewhere = equipmentRequests.some(
                                          (otherReq, otherIdx) => otherIdx !== index && otherReq.equipment.toString() === eq.id.toString()
                                        )
                                        const isDisabled = eq.currently_available === 0 || isSelectedElsewhere
                                        let optionText = `${eq.name} (${eq.currently_available} available)`
                                        if (eq.currently_available === 0) optionText = `${eq.name} (Unavailable)`
                                        else if (isSelectedElsewhere) optionText = `${eq.name} (Already selected)`
                                        return <option key={eq.id} value={eq.id} disabled={isDisabled}>{optionText}</option>
                                      })}
                                    </optgroup>
                                  ))}
                                </select>
                                {errors[`eq_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`eq_${index}`]}</p>}
                              </div>
                              <div className="w-24">
                                <input
                                  type="number" min="1" max={maxQty}
                                  className={inputCls(errors[`qty_${index}`] || isOverLimit)}
                                  value={req.quantity}
                                  onChange={(e) => handleEquipmentChange(index, "quantity", e.target.value)}
                                  disabled={!req.equipment}
                                />
                                {isOverLimit
                                  ? <p className="text-red-500 text-xs mt-1">Only {selectedEq.currently_available} available.</p>
                                  : errors[`qty_${index}`]
                                  ? <p className="text-red-500 text-xs mt-1">{errors[`qty_${index}`]}</p>
                                  : selectedEq
                                  ? <p className="text-gray-400 text-[10px] mt-1">max {maxQty}</p>
                                  : null}
                              </div>
                              <button type="button" onClick={() => removeEquipmentRow(index)}
                                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                        <button type="button" onClick={addEquipmentRow}
                          className="text-sm font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 mt-2 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors w-max"
                        >
                          + Add Equipment
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── EVENT DETAILS ── */}
              <SectionDivider>Event Details</SectionDivider>

              {/* External event toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/60">
                <div className="flex flex-col pr-4">
                  <span className="text-sm font-semibold text-gray-700">External Event</span>
                  <span className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Turn this on if the event involves external guests or organisations. These bookings may be reviewed with priority.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.is_external_event}
                  onClick={() => setFormData((prev) => ({ ...prev, is_external_event: !prev.is_external_event }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${formData.is_external_event ? "bg-amber-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${formData.is_external_event ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <Field label="Event name" required error={errors.event_name}>
                <input
                  type="text" name="event_name"
                  className={inputCls(errors.event_name)}
                  placeholder="e.g., Annual Tech Fest or Project Shoot"
                  value={formData.event_name}
                  onChange={handleChange}
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Venue" required error={errors.space}>
                  <select name="space" className={inputCls(errors.space)} value={formData.space} onChange={handleChange}>
                    <option value="">Select location…</option>
                    {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>

                {!isTeamRequest ? (
                  <Field label="Additional staff needed" error={errors.requested_services} helpText="Optional — do you need media staff?">
                    <input
                      type="text" name="requested_services"
                      className={inputCls(errors.requested_services)}
                      placeholder="e.g., 2 Photographers"
                      value={formData.requested_services}
                      onChange={handleChange}
                    />
                  </Field>
                ) : (
                  <Field label="Support type" helpText="The media team will assign the appropriate staff and kit.">
                    <input type="text" className={inputCls()} value="Media team support" disabled />
                  </Field>
                )}
              </div>

              <Field label="Additional notes" error={errors.user_notes}>
                <textarea
                  name="user_notes" rows={2}
                  className={`${inputCls(errors.user_notes)} resize-none`}
                  placeholder={isTeamRequest
                    ? "Describe what should be covered, key moments, deliverables, or special instructions…"
                    : "Any extra details for the media team…"}
                  value={formData.user_notes}
                  onChange={handleChange}
                />
              </Field>

            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-8 py-5 border-t border-gray-100 bg-white mt-auto">
              <p className="text-xs text-gray-400 font-medium">
                {initialData ? "Changes will be reviewed again." : "Your booking will be reviewed after submission."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { bookingSessionActions.clearSession(); onClose() }}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || hasEquipmentHardBlock}
                  className="px-6 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : initialData ? "Save Changes" : "Submit Booking"}
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
