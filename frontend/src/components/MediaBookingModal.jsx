import { createPortal } from "react-dom"
import { useState, useEffect, useMemo } from "react"
import {
  Camera,
  Clapperboard,
  Package,
  X,
  AlertTriangle,
} from "lucide-react"
import mediaService from "../api/mediaApi"
import ErrorBoundary from "./ErrorBoundary"

// ── Helpers ────────────────────────────────────────────────────────────────
const formatForDatetimeLocal = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const year    = date.getFullYear();
  const month   = String(date.getMonth() + 1).padStart(2, '0');
  const day     = String(date.getDate()).padStart(2, '0');
  const hours   = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatVisualTime = (isoString) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric',
  });
};

// ── Field Wrapper ──────────────────────────────────────────────────────────
function Field({ label, required, children, error, helpText }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error    && <span className="text-red-500 text-xs mt-0.5">{error}</span>}
      {helpText && !error && <span className="text-gray-400 text-[11px] mt-0.5">{helpText}</span>}
    </div>
  )
}

const inputCls = (error) =>
  `w-full border ${
    error
      ? "border-red-500 focus:ring-red-500 bg-red-50"
      : "border-gray-200 focus:ring-green-600 bg-white"
  } rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 transition-all`

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-4">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">
        {children.split('.')[0]}
      </div>
      <span className="text-sm font-bold text-gray-800 tracking-wide">
        {children.split('.')[1]}
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

const INITIAL_FORM = {
  event_name:            "",
  space:                 "",
  event_start_datetime:  "",
  event_end_datetime:    "",
  setup_start_datetime:  "",
  teardown_end_datetime: "",
  requested_services:    "",
  user_notes:            "",
  is_external_event:     false,
  is_team_request:       false,
}

function MediaBookingModal({ onClose, onSuccess, initialData }) {
  const [requestMode, setRequestMode] = useState(() =>
    initialData ? (initialData.is_team_request ? "team" : "equipment") : null
  )

  const [needsBuffer, setNeedsBuffer] = useState(() => {
    if (initialData) {
      return (
        initialData.setup_start_datetime !== initialData.event_start_datetime ||
        initialData.teardown_end_datetime !== initialData.event_end_datetime
      );
    }
    return false;
  })

  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...INITIAL_FORM,
        ...initialData,
        event_start_datetime:  formatForDatetimeLocal(initialData.event_start_datetime),
        event_end_datetime:    formatForDatetimeLocal(initialData.event_end_datetime),
        setup_start_datetime:  formatForDatetimeLocal(initialData.setup_start_datetime),
        teardown_end_datetime: formatForDatetimeLocal(initialData.teardown_end_datetime),
        space:
          initialData.space?.id ||
          initialData.space_details?.id ||
          initialData.space ||
          "",
      };
    }
    return INITIAL_FORM;
  })

  const [equipmentRequests, setEquipmentRequests] = useState(() => {
    if (initialData && !initialData.is_team_request && initialData.equipment_requests) {
      return initialData.equipment_requests.map((req) => ({
        equipment: req.equipment,
        quantity:  req.quantity,
      }));
    }
    return [];
  })

  const [availableEquipment, setAvailableEquipment]   = useState([])
  const [checkingInventory,   setCheckingInventory]   = useState(false)
  const [errors,              setErrors]              = useState({})
  const [submitting,          setSubmitting]          = useState(false)
  const [submitted,           setSubmitted]           = useState(false)
  const [spaces,              setSpaces]              = useState([])

  useEffect(() => {
    mediaService
      .getSpaces()
      .then((data) => setSpaces(data))
      .catch((err) => console.error("Could not load spaces:", err))
  }, [])

  // ── LIVE INVENTORY CHECK ──────────────────────────────────────────────────
  const {
    event_start_datetime,
    event_end_datetime,
    setup_start_datetime,
    teardown_end_datetime,
  } = formData

  const actualSetup    = needsBuffer && setup_start_datetime    ? setup_start_datetime    : event_start_datetime
  const actualTeardown = needsBuffer && teardown_end_datetime   ? teardown_end_datetime   : event_end_datetime
  const isTeamRequest  = requestMode === "team"

  useEffect(() => {
    let isMounted = true

    const timeoutId = setTimeout(() => {
      if (!isMounted) return

      if (!isTeamRequest && event_start_datetime && event_end_datetime) {
        const setupDate    = new Date(actualSetup)
        const startDate    = new Date(event_start_datetime)
        const endDate      = new Date(event_end_datetime)
        const teardownDate = new Date(actualTeardown)

        if (
          setupDate <= startDate &&
          startDate < endDate &&
          endDate <= teardownDate
        ) {
          setCheckingInventory(true)

          const isoStart = new Date(actualSetup).toISOString()
          const isoEnd   = new Date(actualTeardown).toISOString()

          mediaService
            .checkAvailability(isoStart, isoEnd, initialData?.id)
            .then((data) => {
              if (!isMounted) return
              setAvailableEquipment(data)

              // Reset rows whose chosen equipment is now over-limit.
              // For edit mode, preserve rows that were already booked.
              setEquipmentRequests((prev) =>
                prev.map((req) => {
                  if (!req.equipment) return req
                  const item = data.find(
                    (eq) => eq.id.toString() === req.equipment.toString()
                  )
                  if (!item || (item.currently_available < req.quantity && !initialData)) {
                    return { equipment: "", quantity: 1 }
                  }
                  return req
                })
              )
            })
            .catch((err) => console.error("Inventory check failed", err))
            .finally(() => {
              if (isMounted) setCheckingInventory(false)
            })

          return
        }
      }

      setAvailableEquipment([])
    }, 400)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [
    event_start_datetime,
    event_end_datetime,
    actualSetup,
    actualTeardown,
    isTeamRequest,
    initialData,
  ])

  const groupedEquipment = useMemo(() => {
    return availableEquipment.reduce((acc, eq) => {
      if (!acc[eq.category]) acc[eq.category] = []
      acc[eq.category].push(eq)
      return acc
    }, {})
  }, [availableEquipment])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const addEquipmentRow = () => {
    setEquipmentRequests([...equipmentRequests, { equipment: "", quantity: 1 }])
  }

  const removeEquipmentRow = (index) => {
    setEquipmentRequests(equipmentRequests.filter((_, i) => i !== index))
  }

  const handleEquipmentChange = (index, field, value) => {
    const newReqs = [...equipmentRequests]

    if (field === "quantity") {
      // Enforce the available cap client-side immediately
      const parsedVal = parseInt(value, 10)
      const selectedEq = availableEquipment.find(
        (eq) => eq.id.toString() === newReqs[index].equipment.toString()
      )
      const maxQty = selectedEq ? selectedEq.currently_available : 1
      newReqs[index][field] = Math.min(Math.max(1, parsedVal || 1), maxQty)
    } else {
      newReqs[index][field] = value
      // When equipment changes, reset quantity to 1 (safe default)
      if (field === "equipment") {
        newReqs[index].quantity = 1
      }
    }

    setEquipmentRequests(newReqs)
    // Clear related row errors
    if (errors[`eq_${index}`] || errors[`qty_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[`eq_${index}`]
        delete next[`qty_${index}`]
        return next
      })
    }
  }

  // ── VALIDATION ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!formData.event_name.trim()) e.event_name = "Required"
    if (!formData.space)             e.space       = "Required"
    if (!formData.event_start_datetime) e.event_start_datetime = "Required"
    if (!formData.event_end_datetime)   e.event_end_datetime   = "Required"

    const startDt  = formData.event_start_datetime ? new Date(formData.event_start_datetime) : null
    const endDt    = formData.event_end_datetime   ? new Date(formData.event_end_datetime)   : null
    const setupDt  = needsBuffer && formData.setup_start_datetime    ? new Date(formData.setup_start_datetime)    : startDt
    const tearDt   = needsBuffer && formData.teardown_end_datetime   ? new Date(formData.teardown_end_datetime)   : endDt

    if (startDt && endDt && startDt >= endDt) {
      e.event_end_datetime = "Must be after start time"
      e.timeError = "Chronology error: Event End must be after Event Start."
    }

    if (needsBuffer) {
      if (!formData.setup_start_datetime)    e.setup_start_datetime    = "Required"
      if (!formData.teardown_end_datetime)   e.teardown_end_datetime   = "Required"
      if (setupDt && startDt && setupDt > startDt) {
        e.setup_start_datetime = "Must be before event starts"
        e.timeError = "Setup time cannot start after the event begins."
      }
      if (tearDt && endDt && tearDt < endDt) {
        e.teardown_end_datetime = "Must be after event ends"
        e.timeError = "Teardown time cannot end before the event ends."
      }
    }

    const now        = new Date()
    const oldSetupDt = initialData
      ? new Date(initialData.setup_start_datetime || initialData.event_start_datetime)
      : null
    const timeChanged = !initialData || oldSetupDt?.getTime() !== setupDt?.getTime()

    if (timeChanged && setupDt && setupDt < now) {
      e.timeError = "You cannot select a time block that has already passed."
      if (needsBuffer) e.setup_start_datetime    = "Time has passed"
      else             e.event_start_datetime    = "Time has passed"
    }

    if (!isTeamRequest) {
      equipmentRequests.forEach((req, idx) => {
        if (!req.equipment) {
          e[`eq_${idx}`] = "Select item"
          return
        }
        if (!req.quantity || req.quantity < 1) {
          e[`qty_${idx}`] = "Min 1"
          return
        }

        // ── BUG #1 FIX: enforce available quantity ────────────────────────
        const inventoryItem = availableEquipment.find(
          (eq) => eq.id.toString() === req.equipment.toString()
        )
        if (inventoryItem && req.quantity > inventoryItem.currently_available) {
          e[`qty_${idx}`] = `Only ${inventoryItem.currently_available} available`
          e.timeError =
            e.timeError ||
            `Not enough stock: only ${inventoryItem.currently_available} "${inventoryItem.name}" available for this time slot.`
        }
      })
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validate()) return

    const payload = {
      event_name:            formData.event_name,
      space:                 formData.space,
      event_start_datetime:  new Date(formData.event_start_datetime).toISOString(),
      event_end_datetime:    new Date(formData.event_end_datetime).toISOString(),
      setup_start_datetime:  new Date(actualSetup).toISOString(),
      teardown_end_datetime: new Date(actualTeardown).toISOString(),
      is_team_request:       isTeamRequest,
      is_external_event:     formData.is_external_event,
      requested_services:    isTeamRequest
        ? "Media team coverage"
        : formData.requested_services,
      user_notes: formData.user_notes,
    }

    if (!isTeamRequest) {
      payload.equipment_requests = equipmentRequests
        .filter((req) => req.equipment)
        .map((req) => ({
          equipment: parseInt(req.equipment, 10),
          quantity:  parseInt(req.quantity,  10),
        }))
    }

    try {
      setSubmitting(true)
      if (initialData?.id) {
        await mediaService.updateBooking(initialData.id, payload)
      } else {
        await mediaService.createBooking(payload)
      }
      onSuccess?.()
      setSubmitted(true)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        Object.keys(data).forEach((key) => {
          mapped[key] = Array.isArray(data[key]) ? data[key][0] : data[key]
        })
        if (data.non_field_errors)
          mapped.timeError = Array.isArray(data.non_field_errors)
            ? data.non_field_errors[0]
            : data.non_field_errors
        else if (data.equipment_requests && isTeamRequest)
          mapped.timeError = mapped.equipment_requests
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Submission failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (submitted) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-green-700"
              fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? "Updates Saved" : "Request Submitted"}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your media booking {initialData ? "modifications have" : "request has"} been
            sent for admin approval.
            {formData.is_external_event && (
              <span className="block mt-1 text-xs text-amber-600 font-medium">
                Flagged as an external event — will be prioritised for review.
              </span>
            )}
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

  // ── REQUEST TYPE PICKER ───────────────────────────────────────────────────
  if (!requestMode) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-green-700 mb-1.5">
              New media request
            </p>
            <h2 className="text-2xl font-bold text-gray-900">What do you need?</h2>
            <p className="text-sm text-gray-500 mt-2">
              Choose the request type so we only ask for the details that matter.
            </p>
          </div>

          {/* 
            BUG #3 FIX: Media Team request is now FIRST, Equipment Borrowing SECOND.
            Emojis replaced with lucide-react icons.
          */}
          <div className="grid gap-4 p-8 md:grid-cols-2">
            {/* ── CARD 1: Request media team (first) ── */}
            <button
              onClick={() => {
                setRequestMode("team")
                setNeedsBuffer(false)
                setEquipmentRequests([])
                setAvailableEquipment([])
                setFormData((prev) => ({
                  ...prev,
                  is_team_request:    true,
                  requested_services: "Media team coverage",
                }))
              }}
              className="text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-green-200 hover:bg-green-50 transition group"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700 group-hover:bg-green-200 transition">
                <Clapperboard className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Request media team</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Ask the professional media team to cover your event. Gear is reserved
                automatically after approval.
              </p>
            </button>

            {/* ── CARD 2: Borrow equipment (second) ── */}
            <button
              onClick={() => {
                setRequestMode("equipment")
                setFormData((prev) => ({ ...prev, is_team_request: false }))
              }}
              className="text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-green-200 hover:bg-green-50 transition group"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700 group-hover:bg-green-200 transition">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Borrow equipment</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Select cameras, tripods, microphones, and other portable gear yourself.
              </p>
            </button>
          </div>

          <div className="flex justify-end px-8 py-5 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
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

  // ── MAIN FORM ─────────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">
        <ErrorBoundary>

          {/* LEFT PANEL */}
          <div
            className="hidden md:flex md:w-[30%] flex-col justify-between p-7"
            style={{
              background:
                "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
            }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
                Media & Gear
              </p>
              <h2 className="text-2xl font-bold text-white">
                {initialData
                  ? "Edit Details"
                  : isTeamRequest
                  ? "Team Coverage"
                  : "New Request"}
              </h2>

              {formData.is_external_event && (
                <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  External Event
                </span>
              )}

              <p className="text-sm text-green-200/80 mt-3 leading-relaxed">
                {isTeamRequest ? (
                  <>
                    Step 1: Pick event timing.
                    <br />
                    Step 2: Add location.
                    <br />
                    Step 3: Describe the coverage needed.
                  </>
                ) : (
                  <>
                    Step 1: Pick a time.
                    <br />
                    Step 2: Secure your gear.
                    <br />
                    Step 3: Add event details.
                  </>
                )}
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-green-300 uppercase font-semibold">
                  Total Blocked Time
                </p>
                <p className="text-white text-sm font-semibold mt-1">
                  {formatVisualTime(actualSetup)}
                  <br />
                  <span className="text-green-300/80 text-xs font-normal">until</span>
                  <br />
                  {formatVisualTime(actualTeardown)}
                </p>
              </div>
              {needsBuffer && (
                <p className="text-xs text-green-200/70 italic px-1">
                  * Includes setup and pack-up buffer times.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT FORM */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-50/30">
            {/* Header */}
            <div className="flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                {isTeamRequest ? "Media Team Request" : "Media Booking Form"}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode switcher (edit only) */}
            {initialData && (
              <div className="px-8 pt-4 pb-2 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    const newMode = isTeamRequest ? "equipment" : "team"
                    setRequestMode(newMode)
                    setFormData((prev) => ({
                      ...prev,
                      is_team_request:    newMode === "team",
                      requested_services: newMode === "team" ? "Media team coverage" : "",
                    }))
                    if (newMode === "team") setEquipmentRequests([])
                  }}
                  className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1.5"
                >
                  {isTeamRequest ? (
                    <Package className="w-3.5 h-3.5" />
                  ) : (
                    <Clapperboard className="w-3.5 h-3.5" />
                  )}
                  Switch to{" "}
                  {isTeamRequest ? "Equipment Borrowing" : "Media Team Request"}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-8 py-2 space-y-2">

              {errors.timeError && (
                <div className="p-3 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errors.timeError}
                </div>
              )}

              {/* STEP 1: SCHEDULE */}
              <SectionLabel>1. Schedule Context</SectionLabel>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <Field
                  label="Event Starts"
                  required
                  error={errors.event_start_datetime}
                >
                  <input
                    type="datetime-local"
                    name="event_start_datetime"
                    className={inputCls(errors.event_start_datetime)}
                    value={formData.event_start_datetime}
                    onChange={handleChange}
                  />
                </Field>
                <Field
                  label="Event Ends"
                  required
                  error={errors.event_end_datetime}
                >
                  <input
                    type="datetime-local"
                    name="event_end_datetime"
                    className={inputCls(errors.event_end_datetime)}
                    value={formData.event_end_datetime}
                    onChange={handleChange}
                  />
                </Field>
              </div>

              <div className="mb-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer w-max">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600 cursor-pointer"
                    checked={needsBuffer}
                    onChange={(e) => setNeedsBuffer(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700 select-none">
                    Add extra prep &amp; pack-up time (for media team support)
                  </span>
                </label>
              </div>

              {needsBuffer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-100/50 rounded-xl border border-gray-200">
                  <Field
                    label="Prep / Arrival Time"
                    required={needsBuffer}
                    error={errors.setup_start_datetime}
                    helpText="When does the team need to arrive?"
                  >
                    <input
                      type="datetime-local"
                      name="setup_start_datetime"
                      className={inputCls(errors.setup_start_datetime)}
                      value={formData.setup_start_datetime}
                      onChange={handleChange}
                    />
                  </Field>
                  <Field
                    label="Pack-up Finish Time"
                    required={needsBuffer}
                    error={errors.teardown_end_datetime}
                    helpText="When will the room be totally clear?"
                  >
                    <input
                      type="datetime-local"
                      name="teardown_end_datetime"
                      className={inputCls(errors.teardown_end_datetime)}
                      value={formData.teardown_end_datetime}
                      onChange={handleChange}
                    />
                  </Field>
                </div>
              )}

              {/* STEP 2: HARDWARE (equipment mode only) */}
              {!isTeamRequest && (
                <>
                  <SectionLabel>2. Hardware &amp; Gear</SectionLabel>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-4">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-sm font-bold text-gray-800">
                        Available Inventory
                      </label>
                      {checkingInventory && (
                        <span className="text-xs text-blue-600 animate-pulse font-medium bg-blue-50 px-2 py-1 rounded">
                          Syncing inventory…
                        </span>
                      )}
                    </div>

                    {availableEquipment.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-500 font-medium">
                          Please set the event start and end times above to unlock
                          the gear catalog.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {equipmentRequests.map((req, index) => {
                          const selectedEq = availableEquipment.find(
                            (eq) =>
                              eq.id.toString() === req.equipment.toString()
                          )
                          // BUG #1 FIX: max is the live currently_available value
                          const maxQty = selectedEq
                            ? selectedEq.currently_available
                            : 1
                          const isOverLimit =
                            selectedEq &&
                            req.quantity > selectedEq.currently_available

                          return (
                            <div key={index} className="flex gap-3 items-start">
                              <div className="flex-1">
                                <select
                                  className={inputCls(errors[`eq_${index}`])}
                                  value={req.equipment}
                                  onChange={(e) =>
                                    handleEquipmentChange(
                                      index,
                                      "equipment",
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">-- Select Item --</option>
                                  {Object.entries(groupedEquipment).map(
                                    ([category, items]) => (
                                      <optgroup key={category} label={category}>
                                        {items.map((eq) => {
                                          const isSelectedElsewhere =
                                            equipmentRequests.some(
                                              (otherReq, otherIdx) =>
                                                otherIdx !== index &&
                                                otherReq.equipment.toString() ===
                                                  eq.id.toString()
                                            )
                                          const isDisabled =
                                            eq.currently_available === 0 ||
                                            isSelectedElsewhere
                                          let optionText = `${eq.name} (${eq.currently_available} available)`
                                          if (eq.currently_available === 0)
                                            optionText = `${eq.name} (Out of stock)`
                                          else if (isSelectedElsewhere)
                                            optionText = `${eq.name} (Already added)`
                                          return (
                                            <option
                                              key={eq.id}
                                              value={eq.id}
                                              disabled={isDisabled}
                                            >
                                              {optionText}
                                            </option>
                                          )
                                        })}
                                      </optgroup>
                                    )
                                  )}
                                </select>
                                {errors[`eq_${index}`] && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {errors[`eq_${index}`]}
                                  </p>
                                )}
                              </div>

                              <div className="w-24">
                                <input
                                  type="number"
                                  min="1"
                                  max={maxQty}
                                  className={inputCls(
                                    errors[`qty_${index}`] || isOverLimit
                                  )}
                                  value={req.quantity}
                                  onChange={(e) =>
                                    handleEquipmentChange(
                                      index,
                                      "quantity",
                                      e.target.value
                                    )
                                  }
                                  disabled={!req.equipment}
                                />
                                {errors[`qty_${index}`] && (
                                  <p className="text-red-500 text-xs mt-1">
                                    {errors[`qty_${index}`]}
                                  </p>
                                )}
                                {/* Inline max hint */}
                                {selectedEq && !errors[`qty_${index}`] && (
                                  <p className="text-gray-400 text-[10px] mt-1">
                                    max {maxQty}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeEquipmentRow(index)}
                                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}

                        <button
                          type="button"
                          onClick={addEquipmentRow}
                          className="text-sm font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 mt-2 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors w-max"
                        >
                          + Add Equipment
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* STEP 3 (or 2 for team): EVENT DETAILS */}
              <SectionLabel>
                {isTeamRequest ? "2. Event Details" : "3. Event Details"}
              </SectionLabel>

              {/* External Event toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/60 mb-4">
                <div className="flex flex-col pr-4">
                  <span className="text-sm font-semibold text-gray-700">
                    External Event
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Enable if organised by a guest body or outside institution.
                    External events get priority review.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.is_external_event}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      is_external_event: !prev.is_external_event,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${
                    formData.is_external_event ? "bg-amber-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      formData.is_external_event
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mb-4">
                <Field
                  label="Event Name / Purpose"
                  required
                  error={errors.event_name}
                >
                  <input
                    type="text"
                    name="event_name"
                    className={inputCls(errors.event_name)}
                    placeholder="e.g., Annual Tech Fest or Project Shoot"
                    value={formData.event_name}
                    onChange={handleChange}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Field
                  label="Location (Hall/Room)"
                  required
                  error={errors.space}
                >
                  <select
                    name="space"
                    className={inputCls(errors.space)}
                    value={formData.space}
                    onChange={handleChange}
                  >
                    <option value="">Select Location…</option>
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {!isTeamRequest ? (
                  <Field
                    label="Human Resources (Optional)"
                    error={errors.requested_services}
                    helpText="Do you need media staff?"
                  >
                    <input
                      type="text"
                      name="requested_services"
                      className={inputCls(errors.requested_services)}
                      placeholder="e.g., 2 Photographers"
                      value={formData.requested_services}
                      onChange={handleChange}
                    />
                  </Field>
                ) : (
                  <Field
                    label="Coverage Type"
                    helpText="The media team will assign the appropriate staff and kit."
                  >
                    <input
                      type="text"
                      className={inputCls()}
                      value="Media team coverage"
                      disabled
                    />
                  </Field>
                )}
              </div>

              <div className="mb-6">
                <Field
                  label="Remarks / Notes (Optional)"
                  error={errors.user_notes}
                >
                  <textarea
                    name="user_notes"
                    rows={2}
                    className={`${inputCls(errors.user_notes)} resize-none`}
                    placeholder={
                      isTeamRequest
                        ? "Describe what should be covered, key moments, deliverables, or special instructions…"
                        : "Any extra details for the media team…"
                    }
                    value={formData.user_notes}
                    onChange={handleChange}
                  />
                </Field>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-8 py-5 border-t bg-white mt-auto">
              <p className="text-xs text-gray-400 font-medium">
                {initialData
                  ? "Revisions will re-trigger admin review."
                  : "Request will be sent for admin approval."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting
                    ? "Submitting…"
                    : initialData
                    ? "Save Changes"
                    : "Submit Request"}
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