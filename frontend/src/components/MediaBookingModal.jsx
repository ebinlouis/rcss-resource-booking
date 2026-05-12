import { createPortal } from "react-dom"
import { useState, useEffect, useMemo } from "react"
import mediaService from "../api/mediaApi"
import ErrorBoundary from "./ErrorBoundary"

// ── Field Wrapper ──────────────────────────────────────────────────────────
function Field({ label, required, children, error, helpText }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <span className="text-red-500 text-xs mt-0.5">{error}</span>}
      {helpText && !error && <span className="text-gray-400 text-[11px] mt-0.5">{helpText}</span>}
    </div>
  )
}

const inputCls = (error) =>
  `w-full border ${
    error ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-gray-200 focus:ring-green-600 bg-white"
  } rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 transition-all`

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-4">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold">
        {children.split('.')[0]}
      </div>
      <span className="text-sm font-bold text-gray-800 tracking-wide">{children.split('.')[1]}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

const INITIAL_FORM = {
  event_name: "",
  space: "",
  booking_date: "",
  event_start_time: "",
  event_end_time: "",
  setup_start_time: "",
  teardown_end_time: "",
  requested_services: "",
  user_notes: "",
  is_external_event: false,
}

function MediaBookingModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [needsBuffer, setNeedsBuffer] = useState(false)

  const [equipmentRequests, setEquipmentRequests] = useState([])
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [checkingInventory, setCheckingInventory] = useState(false)

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [spaces, setSpaces] = useState([])

  useEffect(() => {
    mediaService.getSpaces()
      .then((data) => setSpaces(data))
      .catch((err) => console.error("Could not load spaces:", err))
  }, [])

  // ── LIVE INVENTORY CHECK ──────────────────────────────────────────────────
  const { booking_date, event_start_time, event_end_time, setup_start_time, teardown_end_time } = formData

  const actualSetup = needsBuffer && setup_start_time ? setup_start_time : event_start_time
  const actualTeardown = needsBuffer && teardown_end_time ? teardown_end_time : event_end_time

  useEffect(() => {
    let isMounted = true

    const timeoutId = setTimeout(() => {
      if (!isMounted) return

      if (booking_date && event_start_time && event_end_time) {
        if (actualSetup <= event_start_time && event_start_time < event_end_time && event_end_time <= actualTeardown) {
          setCheckingInventory(true)

          mediaService.checkAvailability(booking_date, actualSetup, actualTeardown)
            .then((data) => {
              if (!isMounted) return
              setAvailableEquipment(data)

              setEquipmentRequests(prev => prev.map(req => {
                if (!req.equipment) return req
                const item = data.find(eq => eq.id.toString() === req.equipment.toString())
                if (!item || item.currently_available < req.quantity) {
                  return { equipment: "", quantity: 1 }
                }
                return req
              }))
            })
            .catch(err => console.error("Inventory check failed", err))
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
  }, [booking_date, event_start_time, event_end_time, actualSetup, actualTeardown])

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
    newReqs[index][field] = value
    setEquipmentRequests(newReqs)
  }

  // ── STRICT VALIDATION ─────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!formData.event_name.trim()) e.event_name = "Required"
    if (!formData.space) e.space = "Required"
    if (!formData.booking_date) e.booking_date = "Required"
    if (!formData.event_start_time) e.event_start_time = "Required"
    if (!formData.event_end_time) e.event_end_time = "Required"

    if (needsBuffer) {
      if (!formData.setup_start_time) e.setup_start_time = "Required"
      if (!formData.teardown_end_time) e.teardown_end_time = "Required"
      if (formData.setup_start_time > formData.event_start_time) e.setup_start_time = "Must be before event starts"
      if (formData.teardown_end_time < formData.event_end_time) e.teardown_end_time = "Must be after event ends"
    }

    if (formData.event_start_time >= formData.event_end_time) {
      e.timeError = "End time must be after Start time"
    }

    if (formData.booking_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(formData.booking_date) < today) {
        e.booking_date = "Cannot book in the past"
      }
    }

    equipmentRequests.forEach((req, idx) => {
      if (!req.equipment) e[`eq_${idx}`] = "Select item"
      if (req.quantity < 1) e[`qty_${idx}`] = "Min 1"
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validate()) return

    const payload = {
      ...formData,
      setup_start_time: actualSetup,
      teardown_end_time: actualTeardown,
      is_external_event: formData.is_external_event,
      equipment_requests: equipmentRequests.filter(req => req.equipment).map(req => ({
        equipment: parseInt(req.equipment),
        quantity: parseInt(req.quantity)
      }))
    }

    try {
      setSubmitting(true)
      await mediaService.createBooking(payload)
      onSuccess?.()
      setSubmitted(true)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        Object.keys(data).forEach(key => {
          mapped[key] = Array.isArray(data[key]) ? data[key][0] : data[key]
        })
        if (data.non_field_errors) mapped.timeError = data.non_field_errors[0]
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Submission failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

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
            Your media booking request has been sent for admin approval.
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

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">
        <ErrorBoundary>

          {/* LEFT PANEL */}
          <div
            className="hidden md:flex md:w-[30%] flex-col justify-between p-7"
            style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">Media & Gear</p>
              <h2 className="text-2xl font-bold text-white">New Request</h2>

              {formData.is_external_event && (
                <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  External Event
                </span>
              )}

              <p className="text-sm text-green-200/80 mt-3 leading-relaxed">
                Step 1: Pick a time.<br />Step 2: Secure your gear.<br />Step 3: Add event details.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-green-300 uppercase font-semibold">Total Blocked Time</p>
                <p className="text-white text-sm font-semibold mt-1">
                  {actualSetup || "--:--"} to {actualTeardown || "--:--"}
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
            <div className="flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Media Booking Form</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-2 space-y-2">

              {errors.timeError && (
                <div className="p-3 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium">
                  {errors.timeError}
                </div>
              )}

              {/* STEP 1: DATE & TIME */}
              <SectionLabel>1. Schedule Context</SectionLabel>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <Field label="Date" required error={errors.booking_date}>
                  <input type="date" name="booking_date" className={inputCls(errors.booking_date)} value={formData.booking_date} onChange={handleChange} />
                </Field>
                <Field label="Event Starts" required error={errors.event_start_time}>
                  <input type="time" name="event_start_time" className={inputCls(errors.event_start_time)} value={formData.event_start_time} onChange={handleChange} />
                </Field>
                <Field label="Event Ends" required error={errors.event_end_time}>
                  <input type="time" name="event_end_time" className={inputCls(errors.event_end_time)} value={formData.event_end_time} onChange={handleChange} />
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
                    Add extra prep & pack-up time (For Media Team support)
                  </span>
                </label>
              </div>

              {needsBuffer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-100/50 rounded-xl border border-gray-200">
                  <Field label="Prep / Arrival Time" required={needsBuffer} error={errors.setup_start_time} helpText="When does the team need to arrive?">
                    <input type="time" name="setup_start_time" className={inputCls(errors.setup_start_time)} value={formData.setup_start_time} onChange={handleChange} />
                  </Field>
                  <Field label="Pack-up Finish Time" required={needsBuffer} error={errors.teardown_end_time} helpText="When will the room be totally clear?">
                    <input type="time" name="teardown_end_time" className={inputCls(errors.teardown_end_time)} value={formData.teardown_end_time} onChange={handleChange} />
                  </Field>
                </div>
              )}

              {/* STEP 2: HARDWARE & EQUIPMENT */}
              <SectionLabel>2. Hardware & Gear</SectionLabel>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-4">
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-bold text-gray-800">Available Inventory</label>
                  {checkingInventory && <span className="text-xs text-blue-600 animate-pulse font-medium bg-blue-50 px-2 py-1 rounded">Syncing inventory...</span>}
                </div>

                {availableEquipment.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500 font-medium">
                      Please select a Date and Time above to unlock the gear catalog.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {equipmentRequests.map((req, index) => {
                      const selectedEq = availableEquipment.find(eq => eq.id.toString() === req.equipment.toString())
                      const maxQty = selectedEq ? selectedEq.currently_available : 1

                      return (
                        <div key={index} className="flex gap-3 items-start">
                          <div className="flex-1">
                            <select
                              className={inputCls(errors[`eq_${index}`])}
                              value={req.equipment}
                              onChange={(e) => handleEquipmentChange(index, "equipment", e.target.value)}
                            >
                              <option value="">-- Select Item --</option>
                              {Object.entries(groupedEquipment).map(([category, items]) => (
                                <optgroup key={category} label={category}>
                                  {items.map(eq => {
                                    const isSelectedElsewhere = equipmentRequests.some(
                                      (otherReq, otherIdx) => otherIdx !== index && otherReq.equipment.toString() === eq.id.toString()
                                    )
                                    const isDisabled = eq.currently_available === 0 || isSelectedElsewhere
                                    let optionText = `${eq.name} (${eq.currently_available} available)`
                                    if (eq.currently_available === 0) optionText = `${eq.name} (Out of stock)`
                                    else if (isSelectedElsewhere) optionText = `${eq.name} (Already added)`
                                    return (
                                      <option key={eq.id} value={eq.id} disabled={isDisabled}>
                                        {optionText}
                                      </option>
                                    )
                                  })}
                                </optgroup>
                              ))}
                            </select>
                            {errors[`eq_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`eq_${index}`]}</p>}
                          </div>

                          <div className="w-24">
                            <input
                              type="number" min="1" max={maxQty}
                              className={inputCls(errors[`qty_${index}`])}
                              value={req.quantity}
                              onChange={(e) => handleEquipmentChange(index, "quantity", e.target.value)}
                              disabled={!req.equipment}
                            />
                            {errors[`qty_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`qty_${index}`]}</p>}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeEquipmentRow(index)}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}

                    <button
                      type="button"
                      onClick={addEquipmentRow}
                      className="text-sm font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 mt-2 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors w-max"
                    >
                      <span>+ Add Equipment</span>
                    </button>
                  </div>
                )}
              </div>

              {/* STEP 3: EVENT DETAILS */}
              <SectionLabel>3. Event Details</SectionLabel>

              {/* External Event Toggle — mirrors BookingModal.jsx pattern */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/60 mb-4">
                <div className="flex flex-col pr-4">
                  <span className="text-sm font-semibold text-gray-700">External Event</span>
                  <span className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Enable if organised by a guest body or outside institution. External events get priority review.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.is_external_event}
                  onClick={() => setFormData(prev => ({ ...prev, is_external_event: !prev.is_external_event }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${formData.is_external_event ? "bg-amber-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${formData.is_external_event ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="mb-4">
                <Field label="Event Name / Purpose" required error={errors.event_name}>
                  <input type="text" name="event_name" className={inputCls(errors.event_name)}
                    placeholder="e.g., Annual Tech Fest or Project Shoot" value={formData.event_name} onChange={handleChange} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Field label="Location (Hall/Room)" required error={errors.space}>
                  <select name="space" className={inputCls(errors.space)} value={formData.space} onChange={handleChange}>
                    <option value="">Select Location...</option>
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Human Resources (Optional)" error={errors.requested_services} helpText="Do you need media staff?">
                  <input type="text" name="requested_services" className={inputCls(errors.requested_services)}
                    placeholder="e.g., 2 Photographers" value={formData.requested_services} onChange={handleChange} />
                </Field>
              </div>

              <div className="mb-6">
                <Field label="Remarks / Notes (Optional)" error={errors.user_notes}>
                  <textarea
                    name="user_notes" rows={2}
                    className={`${inputCls(errors.user_notes)} resize-none`}
                    placeholder="Any extra details for the media team..."
                    value={formData.user_notes} onChange={handleChange}
                  />
                </Field>
              </div>

            </div>

            <div className="flex justify-between items-center px-8 py-5 border-t bg-white mt-auto">
              <p className="text-xs text-gray-400 font-medium">Request will be sent for admin approval.</p>
              <div className="flex gap-3">
                <button onClick={onClose} disabled={submitting} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50 font-semibold transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit} disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
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