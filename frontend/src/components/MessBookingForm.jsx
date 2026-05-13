import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import messService from "../api/messService"
import { MEALS } from "../api/messConfig"

// ── Helpers ──────────────────────────────────────────────────────────────────

const normalizeTime = (t) => {
  if (!t) return t
  return t.length === 5 ? `${t}:00` : t
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600 transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"

const numberInputCls =
  `${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none m-0`

// ── Default state ─────────────────────────────────────────────────────────────

const defaultFormState = {
  purpose_of_programme: "",
  booking_date: "",
  delivery_location: "",
  total_persons: "",
  veg_persons: "",
  nonveg_persons: "",

  breakfast_required: false,
  breakfast_time: "",
  breakfast_menu: "",

  morning_tea_required: false,
  morning_tea_time: "",
  morning_snack_option: "",

  lunch_required: false,
  lunch_time: "",
  lunch_menu: "",

  evening_tea_required: false,
  evening_tea_time: "",
  evening_snack_option: "",

  dinner_required: false,
  dinner_time: "",
  dinner_menu: "",
}

// ── Main Component ────────────────────────────────────────────────────────────

function MessBookingForm({ onClose, onSave, editData }) {

  const sanitizeData = (data) =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? "" : v])
    )

  const [form, setForm] = useState({
    ...defaultFormState,
    ...(editData ? sanitizeData(editData) : {}),
  })

  const [error, setError] = useState(null)
  const [dateError, setDateError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  

 const today = new Date().toISOString().split("T")[0]

const isPastDate =
  form.booking_date &&
  form.booking_date < today

// ── SMART BOOKING DEADLINE ─────────────────────────

const getBookingCountdown = () => {

  const requestedTimes = []

  for (const meal of MEALS) {

    const required =
      form[`${meal.id}_required`]

    if (!required) continue

    const time = form[meal.timeKey]

    if (time)
      requestedTimes.push(time)
  }

  if (
    !form.booking_date ||
    requestedTimes.length === 0
  ) return null

  const earliest =
    requestedTimes.sort()[0]

  const bookingDateTime = new Date(
    `${form.booking_date}T${earliest}`
  )

  // 24 hours before selected meal
  const deadline = new Date(
    bookingDateTime.getTime() -
    24 * 60 * 60 * 1000
  )

  const now = new Date()

  const diff = deadline - now

  // Booking closed
  if (diff <= 0) {

    return {
      expired: true,
      message:
        "Booking closed for selected meal timing. 24h notice required.",
    }
  }

  const hours = Math.floor(
    diff / (1000 * 60 * 60)
  )

  const minutes = Math.floor(
    (diff % (1000 * 60 * 60)) /
    (1000 * 60)
  )

  return {
    expired: false,
    message:
      `Booking closes in ${hours}h ${minutes}m for selected meal.`,
  }
}

const bookingCountdown =
  getBookingCountdown()

const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))

    if (error) setError(null)
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const total = parseInt(form.total_persons, 10) || 0
    const veg = parseInt(form.veg_persons, 10) || 0
    const nonveg = parseInt(form.nonveg_persons, 10) || 0

    if (total <= 0)
      return "Total persons must be greater than zero."

    if (veg + nonveg !== total)
      return `Headcount mismatch: Veg (${veg}) + Non-Veg (${nonveg}) must equal Total (${total}).`

    if (!form.booking_date)
      return "Please provide a booking date."

    const requestedTimes = []

    for (const meal of MEALS) {
      const required = form[`${meal.id}_required`]

      if (!required) continue

      const time = form[meal.timeKey]
      const menu = form[meal.menuKey]

      if (!time)
        return `Please specify a delivery time for ${meal.label}.`

      if (!menu?.trim())
        return `Please specify the ${meal.menuLabel} for ${meal.label}.`

      requestedTimes.push(time)
    }

    if (requestedTimes.length === 0)
      return "You must select and provide details for at least one meal."

    const earliest = requestedTimes.sort()[0]

    const earliestDateTime = new Date(
      `${form.booking_date}T${earliest}`
    )

    const deadline = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    )

    if (earliestDateTime < deadline)
      return "SLA Violation: Mess bookings require strictly 24 hours notice."

    return null
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError(null)

    const validationError = validate()

    if (validationError)
      return setError(validationError)

    const mealOverrides = {}

    for (const meal of MEALS) {
      const required = form[`${meal.id}_required`]

      mealOverrides[meal.timeKey] = required
        ? normalizeTime(form[meal.timeKey])
        : null

      mealOverrides[meal.menuKey] = required
        ? form[meal.menuKey]
        : ""
    }

    setIsSubmitting(true)

    try {
      const payload = {
        ...form,
        ...mealOverrides,
        total_persons: parseInt(form.total_persons, 10),
        veg_persons: parseInt(form.veg_persons, 10),
        nonveg_persons: parseInt(form.nonveg_persons, 10),
      }

      if (editData?.id) {
        await messService.updateBooking(editData.id, payload)
      } else {
        await messService.createBooking(payload)
      }

      if (isMounted.current) {
        setIsSubmitting(false)
        onSave?.()
      }

    } catch (err) {

      if (!isMounted.current) return

      const backendData = err?.response?.data

      if (backendData) {
        const firstKey = Object.keys(backendData)[0]

        const msg = Array.isArray(backendData[firstKey])
          ? backendData[firstKey][0]
          : backendData[firstKey]

        setError(
          `${firstKey === "non_field_errors" ? "Error" : firstKey}: ${msg}`
        )

      } else {
        setError("Failed to submit request.")
      }

    } finally {
      if (isMounted.current)
        setIsSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return createPortal(

    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">

      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* LEFT PANEL */}

        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{
            background:
              "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
          }}
        >

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {editData ? "Edit Booking" : "New Booking"}
            </p>

            <h2 className="text-2xl font-bold text-white">
              Mess Request
            </h2>

            <p className="text-sm text-green-200/75 mt-3">
              Submit your food requirements with precise timing,
              meal types, and quantity in one pass.
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

        {/* RIGHT PANEL */}

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
              disabled={isSubmitting}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            >
              ✕
            </button>

          </div>

          {/* FORM */}

          <form
            id="mess-booking-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-7 py-5 space-y-5"
          >

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                ⚠️ {error}
              </div>
            )}

            <SectionLabel>Event Details</SectionLabel>

          

            {/* DATE + LOCATION */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <Field label="Booking Date" required>

                <div>

                  <input
                    required
                    type="date"
                    className={inputCls}
                    value={form.booking_date}
                    onChange={(e) => {

                      const value = e.target.value

                      set("booking_date", value)

                      if (value < today) {
                        setDateError(
                          "Please choose a present or future date."
                        )
                      } else {
                        setDateError("")
                      }

                    }}
                  />

                  {dateError && (
                    <p className="text-xs text-red-500 mt-1">
                      {dateError}
                    </p>
                  )}

                </div>

              </Field>

              <Field label="Delivery Location" required>

                <input
                  required
                  disabled={isPastDate}
                  className={inputCls}
                  placeholder="E.g., Main Auditorium, KE Block"
                  value={form.delivery_location}
                  onChange={(e) =>
                    set("delivery_location", e.target.value)
                  }
                />

              </Field>

            </div>

              {/* PURPOSE */}

            <Field label="Purpose of Programme" required>

              <div>

                <textarea
                  required
                  maxLength={200}
                  disabled={isPastDate}
                  className={`${inputCls} min-h-[80px] resize-none`}
                  placeholder="E.g., Tech Symposium Guest Catering"
                  value={form.purpose_of_programme}
                  onChange={(e) =>
                    set("purpose_of_programme", e.target.value)
                  }
                />

              {/* CHARACTER COUNTER */}

              <div className="flex justify-between items-center mt-1">

                <p className="text-[11px] text-gray-400">
                  Keep the purpose short and clear.
                </p>

                <p
                  className={`text-[11px] font-medium ${
                    form.purpose_of_programme.length >= 180
                      ? "text-red-500"
                      : "text-gray-400"
                   }`}
                >
                  {form.purpose_of_programme.length} / 200
                </p>

              </div>

            </div>

          </Field>

            {/* ATTENDEES */}

<SectionLabel>Attendees</SectionLabel>

{(() => {

  const total = parseInt(form.total_persons || 0)
  const veg = parseInt(form.veg_persons || 0)
  const nonveg = parseInt(form.nonveg_persons || 0)

  const remaining = total - veg - nonveg

  const exceeds =
    veg + nonveg > total

  return (

    <div className="space-y-3">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* TOTAL */}

        <Field label="Total Persons" required>

          <input
            required
            type="number"
            min={1}
            disabled={isPastDate}
            className={numberInputCls}
            value={form.total_persons}
            onChange={(e) => {

              const value = e.target.value

              set("total_persons", value)

              const totalValue = parseInt(value || 0)
              const vegValue = parseInt(form.veg_persons || 0)

              if (totalValue >= vegValue) {

                set(
                  "nonveg_persons",
                  String(totalValue - vegValue)
                )

              }

            }}
          />

        </Field>

        {/* VEG */}

        <Field label="Veg Persons" required>

          <input
            required
            type="number"
            min={0}
            disabled={isPastDate}
            className={numberInputCls}
            value={form.veg_persons}
            onChange={(e) => {

              const value = parseInt(e.target.value || 0)
              const totalValue = parseInt(form.total_persons || 0)

              if (value > totalValue) return

              set("veg_persons", String(value))

              set(
                "nonveg_persons",
                String(totalValue - value)
              )

            }}
          />

        </Field>

        {/* NON VEG */}

        <Field label="Non-Veg Persons" required>

          <input
            required
            type="number"
            min={0}
            disabled={isPastDate}
            className={numberInputCls}
            value={form.nonveg_persons}
            onChange={(e) => {

              const value = parseInt(e.target.value || 0)

              const totalValue =
                parseInt(form.total_persons || 0)

              const vegValue =
                parseInt(form.veg_persons || 0)

              if (vegValue + value > totalValue)
                return

              set("nonveg_persons", String(value))

            }}
          />

        </Field>

      </div>

      {/* LIVE SUMMARY */}

      {total > 0 && (

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">

          <div className="flex flex-wrap items-center gap-4 text-sm">

            <p className="text-gray-700">
              <span className="font-semibold">
                Total:
              </span>{" "}
              {total}
            </p>

            <p className="text-green-700">
              <span className="font-semibold">
                Veg:
              </span>{" "}
              {veg}
            </p>

            <p className="text-red-700">
              <span className="font-semibold">
                Non-Veg:
              </span>{" "}
              {nonveg}
            </p>

            <p
              className={`font-semibold ${
                remaining === 0
                  ? "text-green-600"
                  : "text-orange-500"
              }`}
            >
              Remaining: {remaining}
            </p>

          </div>

          {/* WARNINGS */}

          {remaining > 0 && (
            <p className="text-xs text-orange-500 mt-2">
              Please allocate all remaining attendees.
            </p>
          )}

          {exceeds && (
            <p className="text-xs text-red-500 mt-2">
              Veg + Non-Veg exceeds total persons.
            </p>
          )}

          {remaining === 0 && !exceeds && (
            <p className="text-xs text-green-600 mt-2">
              
            </p>
          )}

        </div>

      )}

    </div>

  )

})()}

            {/* MEALS */}

            <SectionLabel>Meals Required</SectionLabel>

           <p className="text-xs text-gray-500 mb-2">
              Check the meals you need and specify timing and menu.
          </p>

          {bookingCountdown && (

            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium border mb-3 ${
                bookingCountdown.expired
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >

              {bookingCountdown.expired
                ? "⚠️"
                : "⏳"}{" "}

              {bookingCountdown.message}

            </div>

          )}

        <div className="space-y-4 pb-4">

              {MEALS.map((meal) => {

                const isRequired =
                  form[`${meal.id}_required`]

                return (

                  <div
                    key={meal.id}
                    className="bg-gray-50 border border-gray-100 rounded-xl p-4 transition-all"
                  >

                    <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit">

                      <input
                        type="checkbox"
                        disabled={isPastDate}
                        className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                        checked={isRequired}
                        onChange={(e) =>
                          set(
                            `${meal.id}_required`,
                            e.target.checked
                          )
                        }
                      />

                      {meal.label}

                    </label>

                    {isRequired && (

                      <div className="flex flex-col sm:flex-row gap-3 mt-3">

                        <input
                          required
                          disabled={
                            isPastDate ||
                            bookingCountdown?.expired
                          }
                          type="time"
                          className={`${inputCls} sm:w-1/3 bg-white`}
                          value={form[meal.timeKey]}
                          onChange={(e) =>
                            set(meal.timeKey, e.target.value)
                          }
                        />

                       <input
                          required
                          disabled={
                            isPastDate ||
                            bookingCountdown?.expired
                          }
                          type="text"
                          placeholder={
                            bookingCountdown?.expired
                              ? "Booking closed for this timing"
                              : meal.menuPlaceholder
                            }
                            className={`${inputCls} sm:w-2/3 bg-white`}
                            value={form[meal.menuKey]}
                            onChange={(e) =>
                              set(meal.menuKey, e.target.value)
                            }
                          />

                      </div>

                    )}

                  </div>

                )
              })}

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
                className="px-4 py-2 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                form="mess-booking-form"
                type="submit"
                disabled={
                  isSubmitting ||
                  isPastDate ||
                  bookingCountdown?.expired
                }
                className={`px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all flex items-center gap-2 ${
                  isSubmitting ||
                  isPastDate ||
                  bookingCountdown?.expired
                    ? "bg-gray-400 cursor-not-allowed opacity-70"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >

                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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