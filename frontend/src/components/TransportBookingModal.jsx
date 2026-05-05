import { useState } from "react"
import { createPortal } from "react-dom"

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

function TransportBookingModal({ onClose }) {

  const [form, setForm] = useState({
    vehicle: "",
    purpose: "",
    start_datetime: "",
    end_datetime: "",
    pickup_location: "",
    destination: "",
    total_passengers: "",
    remarks: ""
  })

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  const handleSubmit = () => {
    console.log(form)
    onClose()
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
              New Booking
            </p>
            <h2 className="text-2xl font-bold text-white">
              Transport Request
            </h2>
            <p className="text-sm text-green-200/75 mt-3">
              Submit a structured transport request with vehicle,
              timing, and trip details in one pass.
            </p>
          </div>

          <div className="space-y-2.5">

            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase font-semibold">
                Vehicle Allocation
              </p>
              <p className="text-white text-sm font-semibold mt-1">
                Based on availability
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
                  Depends on trip
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT FORM */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">
                Request Details
              </p>
              <h2 className="text-xl font-bold">
                Transport Booking Form
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

            {/* TRANSPORT DETAILS */}
            <SectionLabel>Transport Details</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Vehicle" required>
                <select
                  className={inputCls}
                  value={form.vehicle}
                  onChange={(e) => set("vehicle", e.target.value)}
                >
                  <option value="">Select vehicle</option>
                  <option>Bus</option>
                  <option>Mini Bus</option>
                  <option>Van</option>
                  <option>Car</option>
                </select>
              </Field>

              <Field label="Total passengers" required>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="e.g. 40"
                  value={form.total_passengers}
                  onChange={(e) => set("total_passengers", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Purpose" required>
              <input
                className={inputCls}
                placeholder="e.g. Industrial visit, Event transport..."
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
              />
            </Field>

            {/* DATE & TIME */}
            <SectionLabel>Date & Time</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date & time" required>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.start_datetime}
                  onChange={(e) => set("start_datetime", e.target.value)}
                />
              </Field>

              <Field label="End date & time" required>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.end_datetime}
                  onChange={(e) => set("end_datetime", e.target.value)}
                />
              </Field>
            </div>

            {/* TRIP DETAILS */}
            <SectionLabel>Trip Details</SectionLabel>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Pickup location" required>
                <input
                  className={inputCls}
                  placeholder="e.g. College main gate"
                  value={form.pickup_location}
                  onChange={(e) => set("pickup_location", e.target.value)}
                />
              </Field>

              <Field label="Destination" required>
                <input
                  className={inputCls}
                  placeholder="e.g. Kochi"
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                />
              </Field>
            </div>

            {/* NOTES */}
            <SectionLabel>Notes for approving office</SectionLabel>

            <textarea
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Mention route details, stops, special instructions..."
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
            />

          </div>

          {/* FOOTER */}
          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50">
            <p className="text-xs text-gray-400">
              Submitting this sends the request for admin approval.
            </p>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border text-sm"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                className="px-5 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold"
              >
                Send request
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>,
    document.body
  )
}

export default TransportBookingModal