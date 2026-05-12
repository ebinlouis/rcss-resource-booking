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

const buildFormData = (b) => {
  if (!b) return {}
  return {
    event_name:         b.event_name ?? "",
    space:              b.space ?? "",
    booking_date:       b.booking_date ?? "",
    setup_start_time:   b.setup_start_time?.slice(0, 5) ?? "",
    event_start_time:   b.event_start_time?.slice(0, 5) ?? "",
    event_end_time:     b.event_end_time?.slice(0, 5) ?? "",
    teardown_end_time:  b.teardown_end_time?.slice(0, 5) ?? "",
    organization:       b.organization ?? "",
    requested_services: b.requested_services ?? "",
    user_notes:         b.user_notes ?? "",
  }
}

function MediaBookingDetailsModal({ booking, onClose, onRefresh }) {
  const [formData, setFormData] = useState(() => buildFormData(booking))
  
  const [needsBuffer, setNeedsBuffer] = useState(() => {
    if (!booking) return false
    const setup = booking.setup_start_time?.slice(0, 5)
    const estart = booking.event_start_time?.slice(0, 5)
    const eend = booking.event_end_time?.slice(0, 5)
    const teardown = booking.teardown_end_time?.slice(0, 5)
    return (setup && estart && setup !== estart) || (eend && teardown && eend !== teardown)
  })

  const [equipmentRequests, setEquipmentRequests] = useState(() => {
    if (!booking || !booking.equipment_requests) return []
    return booking.equipment_requests.map(req => ({
      equipment: req.equipment_id?.toString() ?? req.equipment?.toString() ?? "",
      quantity: req.quantity ?? 1
    }))
  })

  const [availableEquipment, setAvailableEquipment] = useState([])
  const [checkingInventory, setCheckingInventory] = useState(false)

  const [errors, setErrors] = useState({})
  const [showSaveConfirm, setShowSaveConfirm]   = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [spaces, setSpaces]         = useState([])

  useEffect(() => {
    mediaService.getSpaces()
      .then((data) => setSpaces(data))
      .catch((err) => console.error("Could not load spaces:", err))
  }, [])

  const { booking_date, event_start_time, event_end_time, setup_start_time, teardown_end_time } = formData

  const actualSetup = needsBuffer && setup_start_time ? setup_start_time : event_start_time;
  const actualTeardown = needsBuffer && teardown_end_time ? teardown_end_time : event_end_time;

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
                
                const wasAlreadyBooked = booking?.equipment_requests?.some(
                  br => br.equipment_id?.toString() === req.equipment.toString()
                )

                if (!item || (!wasAlreadyBooked && item.currently_available < req.quantity)) {
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
  }, [booking_date, event_start_time, event_end_time, actualSetup, actualTeardown, booking])

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
    newReqs[index][field] = value
    setEquipmentRequests(newReqs)
  }

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

    equipmentRequests.forEach((req, idx) => {
      if (!req.equipment) e[`eq_${idx}`] = "Select item"
      if (req.quantity < 1) e[`qty_${idx}`] = "Min 1"
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) { setShowSaveConfirm(false); return }
    try {
      setSubmitting(true)
      
      const payload = {
        ...formData,
        setup_start_time: actualSetup,
        teardown_end_time: actualTeardown,
        equipment_requests: equipmentRequests.filter(req => req.equipment).map(req => ({
          equipment: parseInt(req.equipment),
          quantity: parseInt(req.quantity)
        }))
      }

      await mediaService.updateBooking(booking.id, payload)
      setShowSaveConfirm(false)
      onRefresh?.()
    } catch (err) {
      setShowSaveConfirm(false)
      const data = err.response?.data
      if (data && typeof data === "object") {
        const mapped = {}
        Object.keys(data).forEach(key => {
          mapped[key] = Array.isArray(data[key]) ? data[key][0] : data[key]
        })
        if (data.non_field_errors) mapped.timeError = data.non_field_errors[0]
        setErrors(mapped)
      } else {
        setErrors({ timeError: "Update failed. Please try again." })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await mediaService.deleteBooking(booking.id)
      setShowDeleteConfirm(false)
      onRefresh?.()
    } catch (err) {
      console.error("Delete failed:", err)
      setErrors({ timeError: "Could not delete booking. Please try again." })
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const selectedSpaceName = spaces.find((s) => String(s.id) === String(formData.space))?.name ?? booking.space_details?.name ?? "Not selected"

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
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">Booking Preview</p>
            <h2 className="text-2xl font-bold text-white">{formData.event_name || "Media Booking"}</h2>
            <p className="text-sm text-green-200/80 mt-3 leading-relaxed">Edit and save the booking details directly from the form.</p>
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
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Location</p>
                <p className="text-white text-xs font-semibold mt-1 break-words">{selectedSpaceName}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Department</p>
                <p className="text-white text-xs font-semibold mt-1 break-words">
                  {booking.department?.department_name ?? "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="flex-1 flex flex-col min-h-0 bg-gray-50/30">
          <div className="flex justify-between items-center px-8 pt-6 pb-4 border-b border-gray-100 bg-white">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Media Booking</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-2 space-y-2">
            
            {errors.timeError && (
              <div className="p-3 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium">
                {errors.timeError}
              </div>
            )}

            {/* STEP 1: DATE & TIME FIRST */}
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
                    
                    const wasAlreadyBooked = booking?.equipment_requests?.find(
                      br => br.equipment_id?.toString() === req.equipment.toString()
                    )
                    
                    const maxQty = selectedEq 
                      ? (selectedEq.currently_available + (wasAlreadyBooked ? wasAlreadyBooked.quantity : 0))
                      : 1

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
                                  const isHeldByMe = booking?.equipment_requests?.some(br => br.equipment_id === eq.id)
                                  
                                  // Check if selected in another row in the current form state
                                  const isSelectedElsewhere = equipmentRequests.some(
                                    (otherReq, otherIdx) => otherIdx !== index && otherReq.equipment.toString() === eq.id.toString()
                                  )

                                  const isDisabled = (eq.currently_available === 0 && !isHeldByMe) || isSelectedElsewhere;

                                  let optionText = `${eq.name} (${eq.currently_available} available)`;
                                  if (eq.currently_available === 0 && !isHeldByMe) optionText = `${eq.name} (Out of stock)`;
                                  else if (isSelectedElsewhere) optionText = `${eq.name} (Already added)`;

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
            
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Event Name / Purpose" required error={errors.event_name}>
                <input type="text" name="event_name" className={inputCls(errors.event_name)}
                  placeholder="e.g., Annual Tech Fest or Project Shoot" value={formData.event_name} onChange={handleChange} />
              </Field>
              <Field label="Location (Hall/Room)" required error={errors.space}>
                <select name="space" className={inputCls(errors.space)} value={formData.space} onChange={handleChange}>
                  <option value="">Select Location...</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {booking.remarks_by_admin && (
              <div className="px-5 py-4 rounded-xl bg-amber-50 border border-amber-100 mb-2">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Admin Remarks</p>
                <p className="text-sm text-amber-900 leading-relaxed">{booking.remarks_by_admin}</p>
              </div>
            )}

          </div>

          <div className="flex justify-between items-center px-8 py-5 border-t bg-white mt-auto">
            <button
              type="button" onClick={() => setShowDeleteConfirm(true)}
              disabled={submitting || deleting}
              className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Booking
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={submitting || deleting}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm disabled:opacity-50 font-semibold transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => { if (validate()) setShowSaveConfirm(true) }}
                disabled={submitting || deleting}
                className="px-6 py-2.5 rounded-xl bg-green-700 text-white text-sm font-bold hover:bg-green-800 transition-colors shadow-sm disabled:opacity-60">
                {submitting ? "Saving..." : "Save Changes"}
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
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Save Changes?</h2>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to update this media booking?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSaveConfirm(false)} disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={handleSave} disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold disabled:opacity-60">
                {submitting ? "Saving..." : "Yes, Save"}
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
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Delete Booking?</h2>
            <p className="text-sm text-gray-500 mb-1">You're about to delete your booking for</p>
            <p className="text-sm font-semibold text-gray-800 mb-1">{formData.event_name}</p>
            <p className="text-xs text-red-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 font-medium">
                Keep booking
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60">
                {deleting ? "Deleting..." : "Yes, delete it"}
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