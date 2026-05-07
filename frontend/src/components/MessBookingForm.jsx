import { useState } from "react"
import { createPortal } from "react-dom"
import messService from "../api/messService" 

// ── Field Wrapper ──
function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600 transition-all"

// Extended class specifically to hide the up/down arrows in number inputs
const numberInputCls = 
  `${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none m-0`

// ── Section Label ──
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

// Extract default empty state so it's clean
const defaultFormState = {
  purpose_of_programme: "",
  booking_date: "",
  delivery_time: "",
  delivery_location: "",
  total_persons: "",
  veg_persons: "",
  nonveg_persons: "",
  breakfast_required: false,
  breakfast_menu: "",
  morning_tea_required: false,
  morning_snack_option: "",
  lunch_required: false,
  lunch_menu: "",
  evening_tea_required: false,
  evening_snack_option: "",
  dinner_required: false,
  dinner_menu: "",
}

function MessBookingForm({ onClose, onSave, editData }) {
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 🔥 STATE: Initialize directly using editData (if it exists) merged with the default state.
  const [form, setForm] = useState({
    ...defaultFormState,
    ...(editData || {})
  })

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // 1. Math Validation
    const total = parseInt(form.total_persons, 10) || 0
    const veg = parseInt(form.veg_persons, 10) || 0
    const nonveg = parseInt(form.nonveg_persons, 10) || 0

    if (total <= 0) {
      return setError("Total persons must be greater than zero.")
    }
    if (veg + nonveg !== total) {
      return setError(`Headcount mismatch: Veg (${veg}) + Non-Veg (${nonveg}) must equal Total (${total}).`)
    }

    // 2. Strict 24-Hour SLA Validation
    if (!form.booking_date || !form.delivery_time) {
      return setError("Please provide both a booking date and delivery time.")
    }

    const deliveryDateTime = new Date(`${form.booking_date}T${form.delivery_time}`)
    const now = new Date()
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    if (deliveryDateTime < twentyFourHoursFromNow) {
      return setError("SLA Violation: Mess bookings require strictly 24 hours of notice from the current time.")
    }

    // 3. API Submission
    setIsSubmitting(true)
    try {
      const payload = {
        ...form,
        total_persons: total,
        veg_persons: veg,
        nonveg_persons: nonveg,
      }

      let savedBooking
      if (editData && editData.id) {
        savedBooking = await messService.updateBooking(editData.id, payload)
      } else {
        savedBooking = await messService.createBooking(payload)
      }

      if (onSave) onSave(savedBooking)
      
    } catch (err) {
      console.error("Booking Error:", err)
      if (err.response && err.response.data) {
        const backendError = err.response.data
        const firstKey = Object.keys(backendError)[0]
        const errorMsg = Array.isArray(backendError[firstKey]) 
          ? backendError[firstKey][0] 
          : backendError[firstKey]
          
        setError(`${firstKey === 'non_field_errors' ? 'Error' : firstKey}: ${errorMsg}`)
      } else {
        setError("Failed to submit request. Please check your connection and try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">
        
        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {editData ? "Edit Booking" : "New Booking"}
            </p>
            <h2 className="text-2xl font-bold text-white">
              Mess Request
            </h2>
            <p className="text-sm text-green-200/75 mt-3">
              Submit your food requirements with timing, meal types, and quantity in one pass.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase font-semibold">
                Service Level Agreement
              </p>
              <p className="text-white text-sm font-semibold mt-1">
                Strict 24h notice required
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">
                  Approval
                </p>
                <p className="text-white text-xs font-semibold mt-1">
                  Admin review
                </p>
              </div>

              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">
                  Policy
                </p>
                <p className="text-white text-xs font-semibold mt-1">
                  Based on headcount
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          
          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">
                Request Details
              </p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Mess Booking Form
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>

          {/* FORM BODY */}
          <form id="mess-booking-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                <span className="text-lg">⚠️</span> {error}
              </div>
            )}

            <SectionLabel>Event Details</SectionLabel>

            <Field label="Purpose of Programme" required>
              <textarea
                required
                className={`${inputCls} min-h-[80px] resize-none`}
                placeholder="E.g., Tech Symposium Guest Catering"
                value={form.purpose_of_programme}
                onChange={(e) => set("purpose_of_programme", e.target.value)}
              />
            </Field>

            <SectionLabel>Date & Time</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Booking Date" required>
                <input
                  required
                  type="date"
                  className={inputCls}
                  value={form.booking_date}
                  onChange={(e) => set("booking_date", e.target.value)}
                />
              </Field>

              <Field label="Delivery Time" required>
                <input
                  required
                  type="time"
                  className={inputCls}
                  value={form.delivery_time}
                  onChange={(e) => set("delivery_time", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Delivery Location" required>
              <input
                required
                className={inputCls}
                placeholder="E.g., Main Auditorium, KE Block"
                value={form.delivery_location}
                onChange={(e) => set("delivery_location", e.target.value)}
              />
            </Field>

            <SectionLabel>Attendees</SectionLabel>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Total Persons" required>
                <input 
                  required
                  type="number" 
                  min="1"
                  className={numberInputCls}
                  value={form.total_persons}
                  onChange={(e) => set("total_persons", e.target.value)} 
                />
              </Field>

              <Field label="Veg Persons" required>
                <input 
                  required
                  type="number" 
                  min="0"
                  className={numberInputCls}
                  value={form.veg_persons}
                  onChange={(e) => set("veg_persons", e.target.value)} 
                />
              </Field>

              <Field label="Non-Veg Persons" required>
                <input 
                  required
                  type="number" 
                  min="0"
                  className={numberInputCls}
                  value={form.nonveg_persons}
                  onChange={(e) => set("nonveg_persons", e.target.value)} 
                />
              </Field>
            </div>

            <SectionLabel>Meals Required</SectionLabel>

            <div className="space-y-4 pb-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                    checked={form.breakfast_required}
                    onChange={(e) => set("breakfast_required", e.target.checked)} 
                  />
                  Breakfast
                </label>
                {form.breakfast_required && (
                  <textarea
                    required
                    placeholder="E.g., Appam & Stew, Coffee"
                    className={`${inputCls} mt-3 bg-white resize-none`}
                    value={form.breakfast_menu}
                    onChange={(e) => set("breakfast_menu", e.target.value)}
                  />
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                    checked={form.morning_tea_required}
                    onChange={(e) => set("morning_tea_required", e.target.checked)} 
                  />
                  Morning Tea
                </label>
                {form.morning_tea_required && (
                  <input
                    required
                    placeholder="E.g., Tea & Biscuits"
                    className={`${inputCls} mt-3 bg-white`}
                    value={form.morning_snack_option}
                    onChange={(e) => set("morning_snack_option", e.target.value)}
                  />
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                    checked={form.lunch_required}
                    onChange={(e) => set("lunch_required", e.target.checked)} 
                  />
                  Lunch
                </label>
                {form.lunch_required && (
                  <textarea
                    required
                    placeholder="E.g., Veg Meals, Chicken Biriyani"
                    className={`${inputCls} mt-3 bg-white resize-none`}
                    value={form.lunch_menu}
                    onChange={(e) => set("lunch_menu", e.target.value)}
                  />
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                    checked={form.evening_tea_required}
                    onChange={(e) => set("evening_tea_required", e.target.checked)} 
                  />
                  Evening Tea
                </label>
                {form.evening_tea_required && (
                  <input
                    required
                    placeholder="E.g., Tea & Banana Fritters"
                    className={`${inputCls} mt-3 bg-white`}
                    value={form.evening_snack_option}
                    onChange={(e) => set("evening_snack_option", e.target.value)}
                  />
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                    checked={form.dinner_required}
                    onChange={(e) => set("dinner_required", e.target.checked)} 
                  />
                  Dinner
                </label>
                {form.dinner_required && (
                  <textarea
                    required
                    placeholder="E.g., Chapathi & Chicken Curry"
                    className={`${inputCls} mt-3 bg-white resize-none`}
                    value={form.dinner_menu}
                    onChange={(e) => set("dinner_menu", e.target.value)}
                  />
                )}
              </div>
            </div>
          </form>

          {/* FOOTER */}
          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50">
            <p className="text-xs text-gray-400">
              Submitting this sends the request for admin approval.
            </p>

            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              <button 
                form="mess-booking-form" 
                type="submit" 
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition-all disabled:opacity-70 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Processing...
                  </>
                ) : (
                  "Submit Request"
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  )
}

export default MessBookingForm