import { createPortal } from "react-dom"
import { useState, useEffect, useMemo } from "react"
import { X, AlertTriangle } from "lucide-react"
import toast from "react-hot-toast"
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
      {helpText && !error && (
        <span className="text-gray-400 text-[11px] mt-0.5">{helpText}</span>
      )}
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

const buildFormData = (b) => {
  if (!b) return {}
  return {
    event_name:            b.event_name            ?? "",
    space:                 b.space                 ?? "",
    event_start_datetime:  formatForDatetimeLocal(b.event_start_datetime),
    event_end_datetime:    formatForDatetimeLocal(b.event_end_datetime),
    setup_start_datetime:  formatForDatetimeLocal(b.setup_start_datetime),
    teardown_end_datetime: formatForDatetimeLocal(b.teardown_end_datetime),
    organization:          b.organization          ?? "",
    requested_services:    b.requested_services    ?? "",
    user_notes:            b.user_notes            ?? "",
  }
}

function MediaBookingDetailsModal({ booking, onClose, onRefresh }) {
  const [formData, setFormData] = useState(() => buildFormData(booking))

  const [needsBuffer, setNeedsBuffer] = useState(() => {
    if (!booking) return false
    return (
      booking.setup_start_datetime !== booking.event_start_datetime ||
      booking.teardown_end_datetime !== booking.event_end_datetime
    )
  })

  const [equipmentRequests, setEquipmentRequests] = useState(() => {
    if (!booking?.equipment_requests) return []
    return booking.equipment_requests.map((req) => ({
      equipment:
        req.equipment_id?.toString() ?? req.equipment?.toString() ?? "",
      quantity: req.quantity ?? 1,
    }))
  })

  const [availableEquipment, setAvailableEquipment] = useState([])
  const [checkingInventory,   setCheckingInventory] = useState(false)
  const [errors,              setErrors]            = useState({})
  const [showSaveConfirm,     setShowSaveConfirm]   = useState(false)
  const [showDeleteConfirm,   setShowDeleteConfirm] = useState(false)
  const [submitting,          setSubmitting]        = useState(false)
  const [deleting,            setDeleting]          = useState(false)
  const [spaces,              setSpaces]            = useState([])

  useEffect(() => {
    mediaService
      .getSpaces()
      .then((data) => setSpaces(data))
      .catch((err) => console.error("Could not load venue:", err))
  }, [])

  const {
    event_start_datetime,
    event_end_datetime,
    setup_start_datetime,
    teardown_end_datetime,
  } = formData

  const actualSetup    = needsBuffer && setup_start_datetime  ? setup_start_datetime  : event_start_datetime
  const actualTeardown = needsBuffer && teardown_end_datetime ? teardown_end_datetime : event_end_datetime

  // ── LIVE INVENTORY CHECK ──────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    const timeoutId = setTimeout(() => {
      if (!isMounted) return

      if (event_start_datetime && event_end_datetime) {
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
            .checkAvailability(isoStart, isoEnd, booking?.id)
            .then((data) => {
              if (!isMounted) return
              setAvailableEquipment(data)

              setEquipmentRequests((prev) =>
                prev.map((req) => {
                  if (!req.equipment) return req

                  const item = data.find(
                    (eq) => eq.id.toString() === req.equipment.toString()
                  )

                  // For equipment this booking already holds, the API returns
                  // currently_available EXCLUDING this booking's own reservation
                  // (because exclude=booking.id is passed). So we don't need to
                  // add back the original quantity here.
                  const wasAlreadyBooked = booking?.equipment_requests?.some(
                    (br) =>
                      br.equipment_id?.toString() === req.equipment.toString()
                  )

                  if (
                    !item ||
                    (!wasAlreadyBooked && item.currently_available < req.quantity)
                  ) {
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
    booking,
  ])

  const groupedEquipment = useMemo(() => {
    return availableEquipment.reduce((acc, eq) => {
      if (!acc[eq.category]) acc[eq.category] = []
      acc[eq.category].push(eq)
      return acc
    }, {})
  }, [availableEquipment])

  if (!booking) return null

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
      const parsedVal = parseInt(value, 10)

      // Compute the effective max for this row.
      // Because the availability check is called with exclude=booking.id,
      // currently_available already excludes our own booking's usage.
      // So max = currently_available (no need to add back original qty).
      const selectedEq = availableEquipment.find(
        (eq) => eq.id.toString() === newReqs[index].equipment.toString()
      )
      const maxQty = selectedEq ? selectedEq.currently_available : 1
      newReqs[index][field] = Math.min(Math.max(1, parsedVal || 1), maxQty)
    } else {
      newReqs[index][field] = value
      if (field === "equipment") {
        newReqs[index].quantity = 1
      }
    }

    setEquipmentRequests(newReqs)
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

    const startDt = formData.event_start_datetime
      ? new Date(formData.event_start_datetime)
      : null
    const endDt   = formData.event_end_datetime
      ? new Date(formData.event_end_datetime)
      : null
    const setupDt = needsBuffer && formData.setup_start_datetime
      ? new Date(formData.setup_start_datetime)
      : startDt
    const tearDt  = needsBuffer && formData.teardown_end_datetime
      ? new Date(formData.teardown_end_datetime)
      : endDt

    if (startDt && endDt && startDt >= endDt) {
      e.event_end_datetime = "End time must be after start time"
      e.timeError = "End time must be after start time"
    }

    if (needsBuffer) {
      if (!formData.setup_start_datetime)  e.setup_start_datetime  = "Required"
      if (!formData.teardown_end_datetime) e.teardown_end_datetime = "Required"
      if (setupDt && startDt && setupDt > startDt)
        e.setup_start_datetime = "Must be before event starts"
      if (tearDt && endDt && tearDt < endDt)
        e.teardown_end_datetime = "Must be after event ends"
    }

    if (!booking.is_team_request) {
      equipmentRequests.forEach((req, idx) => {
        if (!req.equipment) {
          e[`eq_${idx}`] = "Select item"
          return
        }
        if (!req.quantity || req.quantity < 1) {
          e[`qty_${idx}`] = "Minimum 1"
          return
        }

        // ── BUG #1 FIX: enforce available quantity on edit ────────────────
        const inventoryItem = availableEquipment.find(
          (eq) => eq.id.toString() === req.equipment.toString()
        )
        if (inventoryItem && req.quantity > inventoryItem.currently_available) {
          e[`qty_${idx}`] = `Only ${inventoryItem.currently_available} available`
          e.timeError =
            e.timeError ||
            `Not enough items available: only ${inventoryItem.currently_available} "${inventoryItem.name}" available for this time slot.`
        }
      })
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) { setShowSaveConfirm(false); return }
    try {
      setSubmitting(true)

      const payload = {
        event_name:            formData.event_name,
        space:                 formData.space,
        event_start_datetime:  new Date(formData.event_start_datetime).toISOString(),
        event_end_datetime:    new Date(formData.event_end_datetime).toISOString(),
        setup_start_datetime:  new Date(actualSetup).toISOString(),
        teardown_end_datetime: new Date(actualTeardown).toISOString(),
        requested_services:    formData.requested_services,
        user_notes:            formData.user_notes,
        equipment_requests:    equipmentRequests
          .filter((req) => req.equipment)
          .map((req) => ({
            equipment: parseInt(req.equipment, 10),
            quantity:  parseInt(req.quantity,  10),
          })),
      }

      await mediaService.updateBooking(booking.id, payload)
      const eventLabel = formData.event_name?.trim() || ""
      toast.success(eventLabel ? `"${eventLabel}" updated.` : "Media booking updated.")
      setShowSaveConfirm(false)
      onRefresh?.()
    } catch (err) {
      setShowSaveConfirm(false)
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
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Update failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    const eventLabel = formData.event_name?.trim() || ""
    try {
      setDeleting(true)
      await mediaService.deleteBooking(booking.id)
      toast.success(eventLabel ? `"${eventLabel}" deleted.` : "Media booking deleted.")
      setShowDeleteConfirm(false)
      onRefresh?.()
    } catch (err) {
      console.error("Delete failed:", err)
      setErrors({ timeError: "Could not delete booking. Please try again." })
      toast.error("Delete failed. Please try again.")
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const selectedSpaceName =
    spaces.find((s) => String(s.id) === String(formData.space))?.name ??
    booking.space_details?.name ??
    "Not selected"

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
                Booking Summary
              </p>
              <h2 className="text-2xl font-bold text-white">
                {formData.event_name || "Media Booking"}
              </h2>
              <p className="text-sm text-green-200/80 mt-3 leading-relaxed">
                Update your request details here.
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-green-300 uppercase font-semibold">
                  Total Reserved Time
                </p>
                <p className="text-white text-sm font-semibold mt-1">
                  {formatVisualTime(actualSetup)}
                  <br />
                  <span className="text-green-300/80 text-xs font-normal">
                    until
                  </span>
                  <br />
                  {formatVisualTime(actualTeardown)}
                </p>
              </div>
              {needsBuffer && (
                <p className="text-xs text-green-200/70 italic px-1">
                  * Includes setup and wrap-up time.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-[9px] text-green-300 uppercase font-semibold">
                    Location
                  </p>
                  <p className="text-white text-xs font-semibold mt-1 break-words">
                    {selectedSpaceName}
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-[9px] text-green-300 uppercase font-semibold">
                    Department
                  </p>
                  <p className="text-white text-xs font-semibold mt-1 break-words">
                    {booking.department?.department_name ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT FORM */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-50/30">
            {/* Header */}
            <div className="flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100 bg-white">
              <h2 className="text-xl font-bold text-gray-900">
                Edit Media Booking
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-2 space-y-2">

              {errors.timeError && (
                <div className="p-3 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errors.timeError}
                </div>
              )}

              {/* STEP 1: SCHEDULE */}
              <SectionLabel>1. Date & Time Details</SectionLabel>

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
                    Add setup &amp; and wrap-up time (for media team support)
                  </span>
                </label>
              </div>

              {needsBuffer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-100/50 rounded-xl border border-gray-200">
                  <Field
                    label="Team Arrival Time"
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
                    label="Wrap-up End Time"
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

              {/* STEP 2: HARDWARE (equipment bookings only) */}
              {!booking.is_team_request && (
                <>
                  <SectionLabel>2. Equipment Needed</SectionLabel>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-4">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-sm font-bold text-gray-800">
                        Available Items
                      </label>
                      {checkingInventory && (
                        <span className="text-xs text-blue-600 animate-pulse font-medium bg-blue-50 px-2 py-1 rounded">
                          Checking availability…
                        </span>
                      )}
                    </div>

                    {availableEquipment.length === 0 ? (
                      <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-500 font-medium">
                          Select the event times above to see available equipment
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {equipmentRequests.map((req, index) => {
                          const selectedEq = availableEquipment.find(
                            (eq) =>
                              eq.id.toString() === req.equipment.toString()
                          )

                          // currently_available is already adjusted for this
                          // booking's own reservation (exclude=booking.id passed
                          // in checkAvailability), so no add-back needed.
                          const maxQty = selectedEq
                            ? selectedEq.currently_available
                            : 1

                          const isOverLimit =
                            selectedEq &&
                            req.quantity > selectedEq.currently_available

                          return (
                            <div
                              key={index}
                              className="flex gap-3 items-start"
                            >
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
                                  <option value="">-- Choose Item --</option>
                                  {Object.entries(groupedEquipment).map(
                                    ([category, items]) => (
                                      <optgroup key={category} label={category}>
                                        {items.map((eq) => {
                                          const isHeldByMe =
                                            booking?.equipment_requests?.some(
                                              (br) =>
                                                br.equipment_id === eq.id
                                            )
                                          const isSelectedElsewhere =
                                            equipmentRequests.some(
                                              (otherReq, otherIdx) =>
                                                otherIdx !== index &&
                                                otherReq.equipment.toString() ===
                                                  eq.id.toString()
                                            )
                                          const isDisabled =
                                            (eq.currently_available === 0 &&
                                              !isHeldByMe) ||
                                            isSelectedElsewhere

                                          let optionText = `${eq.name} (${eq.currently_available} available)`
                                          if (
                                            eq.currently_available === 0 &&
                                            !isHeldByMe
                                          )
                                            optionText = `${eq.name} (Not available)`
                                          else if (isSelectedElsewhere)
                                            optionText = `${eq.name} (Already selected)`

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
                                {selectedEq && !errors[`qty_${index}`] && (
                                  <p className="text-gray-400 text-[10px] mt-1">
                                    Maximum {maxQty}
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
                {booking.is_team_request ? "2. Event Details" : "3. Event Details"}
              </SectionLabel>

              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Event Name or Purpose"
                  helpText="This field is required"
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
                <Field
                  label="Venue"
                  helpText="This field is required"
                  error={errors.space}
                >
                  <select
                    name="space"
                    className={inputCls(errors.space)}
                    value={formData.space}
                    onChange={handleChange}
                  >
                    <option value="">Select Venue…</option>
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {booking.is_team_request ? (
                  <Field
                    label="Support Type"
                    helpText="The media team will arrange the required staff and equipment"
                  >
                    <input
                      type="text"
                      className={inputCls()}
                      value="Media team support"
                      disabled
                    />
                  </Field>
                ) : (
                  <Field
                    label="Media Staff Needed (Optional)"
                    error={errors.requested_services}
                    helpText="Need media team support?"
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
                )}
              </div>

              <div className="mb-6">
                <Field
                  label="Remarks (Optional)"
                  error={errors.user_notes}
                >
                  <textarea
                    name="user_notes"
                    rows={2}
                    className={`${inputCls(errors.user_notes)} resize-none`}
                    placeholder="Any extra details for the media team…"
                    value={formData.user_notes}
                    onChange={handleChange}
                  />
                </Field>
              </div>

              {booking.remarks_by_admin && (
                <div className="px-5 py-4 rounded-xl bg-yellow-50 border border-yellow-100 mb-2">
                  <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">
                    Admin Remarks
                  </p>
                  <p className="text-sm text-yellow-900 leading-relaxed">
                    {booking.remarks_by_admin}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-8 py-5 border-t bg-white mt-auto">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting || deleting}
                className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Booking
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting || deleting}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (validate()) setShowSaveConfirm(true)
                  }}
                  disabled={submitting || deleting}
                  className="px-6 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {/* SAVE CONFIRM */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Save Changes?
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to update this media request?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveConfirm(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Yes, Save"}
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
              <svg
                className="w-7 h-7 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Delete Request?
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              You're about to delete your request for
            </p>
            <p className="text-sm font-semibold text-gray-800 mb-1">
              {formData.event_name}
            </p>
            <p className="text-xs text-red-400 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                Keep booking
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete it"}
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
