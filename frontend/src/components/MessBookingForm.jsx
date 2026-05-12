import { useState } from "react"
import { createPortal } from "react-dom"

// ── Field Wrapper ──
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-600"

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

function MessBookingForm({ onClose }) {

  // 🔥 STATE
  const [form, setForm] = useState({
    purpose: "",
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
  })

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">

      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl h-[90vh]">

        {/* 🔥 LEFT PANEL (FIXED GRADIENT) */}
        <div
          className="w-[35%] flex flex-col justify-between p-7 text-white"
          style={{
            background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)"
          }}
        >
          <div>
            <p className="text-xs uppercase tracking-widest text-green-300">
              New Booking
            </p>

            <h2 className="text-2xl font-bold mt-2 text-white">
              Mess Request
            </h2>

            <p className="text-sm text-green-200 mt-3">
              Submit your food requirements with timing, meal types, and quantity.
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-white/10 p-3 rounded-lg">
              <p className="text-xs">Approval</p>
              <p className="font-semibold">Admin review</p>
            </div>

            <div className="bg-white/10 p-3 rounded-lg">
              <p className="text-xs">Policy</p>
              <p className="font-semibold">24h notice</p>
            </div>
          </div>
        </div>

        {/* 🔥 RIGHT SIDE */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b">
            <div>
              <p className="text-xs text-green-700 font-semibold uppercase">
                Request Details
              </p>
              <h2 className="text-xl font-bold">
                Mess Booking Form
              </h2>
            </div>

            <button onClick={onClose} className="text-gray-400 text-xl">
              ✕
            </button>
          </div>

          {/* FORM BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">

            {/* PURPOSE */}
            <SectionLabel>Event Details</SectionLabel>

            <Field label="Purpose">
              <textarea
                className={inputCls}
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
              />
            </Field>

            {/* DATE + TIME */}
            <SectionLabel>Date & Time</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Booking Date">
                <input
                  type="date"
                  className={inputCls}
                  value={form.booking_date}
                  onChange={(e) => set("booking_date", e.target.value)}
                />
              </Field>

              <Field label="Delivery Time">
                <input
                  type="time"
                  className={inputCls}
                  value={form.delivery_time}
                  onChange={(e) => set("delivery_time", e.target.value)}
                />
              </Field>
            </div>

            {/* LOCATION */}
            <Field label="Delivery Location">
              <input
                className={inputCls}
                value={form.delivery_location}
                onChange={(e) => set("delivery_location", e.target.value)}
              />
            </Field>

            {/* PEOPLE */}
            <SectionLabel>Attendees</SectionLabel>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Total Persons">
                <input type="number" className={inputCls}
                  onChange={(e) => set("total_persons", e.target.value)} />
              </Field>

              <Field label="Veg Persons">
                <input type="number" className={inputCls}
                  onChange={(e) => set("veg_persons", e.target.value)} />
              </Field>

              <Field label="Non-Veg Persons">
                <input type="number" className={inputCls}
                  onChange={(e) => set("nonveg_persons", e.target.value)} />
              </Field>
            </div>

            {/* 🔥 MEALS */}
            <SectionLabel>Meals Required</SectionLabel>

            <div className="space-y-4">

              {/* BREAKFAST */}
              <div>
                <label className="flex gap-2">
                  <input type="checkbox"
                    onChange={(e) => set("breakfast_required", e.target.checked)} />
                  Breakfast
                </label>

                {form.breakfast_required && (
                  <textarea
                    placeholder="Breakfast menu"
                    className={inputCls + " mt-2"}
                    onChange={(e) => set("breakfast_menu", e.target.value)}
                  />
                )}
              </div>

              {/* MORNING TEA */}
              <div>
                <label className="flex gap-2">
                  <input type="checkbox"
                    onChange={(e) => set("morning_tea_required", e.target.checked)} />
                  Morning Tea
                </label>

                {form.morning_tea_required && (
                  <input
                    placeholder="Snack option"
                    className={inputCls + " mt-2"}
                    onChange={(e) => set("morning_snack_option", e.target.value)}
                  />
                )}
              </div>

              {/* LUNCH */}
              <div>
                <label className="flex gap-2">
                  <input type="checkbox"
                    onChange={(e) => set("lunch_required", e.target.checked)} />
                  Lunch
                </label>

                {form.lunch_required && (
                  <textarea
                    placeholder="Lunch menu"
                    className={inputCls + " mt-2"}
                    onChange={(e) => set("lunch_menu", e.target.value)}
                  />
                )}
              </div>

              {/* EVENING TEA */}
              <div>
                <label className="flex gap-2">
                  <input type="checkbox"
                    onChange={(e) => set("evening_tea_required", e.target.checked)} />
                  Evening Tea
                </label>

                {form.evening_tea_required && (
                  <input
                    placeholder="Snack option"
                    className={inputCls + " mt-2"}
                    onChange={(e) => set("evening_snack_option", e.target.value)}
                  />
                )}
              </div>

              {/* DINNER */}
              <div>
                <label className="flex gap-2">
                  <input type="checkbox"
                    onChange={(e) => set("dinner_required", e.target.checked)} />
                  Dinner
                </label>

                {form.dinner_required && (
                  <textarea
                    placeholder="Dinner menu"
                    className={inputCls + " mt-2"}
                    onChange={(e) => set("dinner_menu", e.target.value)}
                  />
                )}
              </div>

            </div>

          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-3 px-7 py-4 border-t bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg">
              Cancel
            </button>

            <button className="px-4 py-2 bg-green-700 text-white rounded-lg">
              Submit Request
            </button>
          </div>

        </div>

      </div>
    </div>,
    document.body
  )
}

export default MessBookingForm