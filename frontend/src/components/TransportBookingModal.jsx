import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { getVehicles } from "../api/fleetApi"
import { useCreateFleetBooking, useUpdateFleetBooking } from "../hooks/useFleetQueries"

// ── FIELD ─────────────────────────────────────
function Field({ label, required, children, error }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && (
          <span className="text-red-400 ml-0.5">*</span>
        )}
      </label>

      {children}

      {error && (
        <p className="text-xs text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}

// ── INPUT STYLE ───────────────────────────────
const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-600 transition disabled:bg-gray-100 disabled:text-gray-400"

// ── SECTION LABEL ─────────────────────────────
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

// ── ALERT ─────────────────────────────────────
function Alert({ message }) {
  if (!message) return null

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
      {message}
    </div>
  )
}

// ====================================================
// TRANSPORT MODAL
// ====================================================

function TransportBookingModal({
  onClose,
  onSave,
  editData = null
}) {

  const isEditMode = Boolean(editData)
  console.log("EDIT DATA", editData)

  const [form, setForm] = useState({

    purpose:
      editData?.purpose ?? "",

    pickup_date:
      editData?.start_datetime?.split("T")[0] ?? "",

    pickup_time_24:
      editData?.start_datetime
        ?.split("T")[1]
        ?.slice(0, 5) ?? "",

    pickup_time:
      editData?.start_datetime
        ?.split("T")[1]
        ?.slice(0, 5) ?? "",

    pickup_period:
      editData?.start_datetime
        ?.split("T")[1]
        ?.slice(0, 2) >= 12
          ? "PM"
          : "AM",

    return_required:
      false,

    return_date:
      "",

    return_time:
      "",

    return_period:
      "PM",

    return_time_24:
      "",

    pickup_location:
      editData?.pickup_location ?? "",

    destination:
      editData?.destination ?? "",

    return_pickup_location:
      "",

    return_destination:
      "",

    total_passengers:
      editData?.total_passengers ?? "",

    vehicle:
      editData?.vehicle ?? "",

    user_notes:
      editData?.user_notes ?? ""
  })

  const [vehicles, setVehicles] = useState([])

  const [loadingVehicles, setLoadingVehicles] =
    useState(true)

  const [apiError, setApiError] =
    useState("")

  const [submitting, setSubmitting] =
    useState(false)

  const [fieldErrors, setFieldErrors] =
    useState({})

  const createMutation = useCreateFleetBooking()
  const updateMutation = useUpdateFleetBooking()

  // ── FETCH VEHICLES ─────────────────────────

  useEffect(() => {

    let cancelled = false

    getVehicles()
      .then((data) => {

        if (!cancelled) {

          setVehicles(
            Array.isArray(data)
              ? data
              : data.results ?? []
          )
        }
      })

      .catch(() => {

        if (!cancelled) {

          setApiError(
            "Could not load vehicles."
          )
        }
      })

      .finally(() => {

        if (!cancelled) {

          setLoadingVehicles(false)
        }
      })

    return () => {
      cancelled = true
    }

  }, [])

  // ── SETTER ─────────────────────────────────

  const set = (key, value) => {

    setForm((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  // ── DATE CHECK ─────────────────────────────

  const today =
    new Date().toISOString().split("T")[0]

  const isPastPickupDate =
    form.pickup_date &&
    form.pickup_date < today

  const isPastReturnDate =
    form.return_date &&
    form.return_date < today

  // ── VEHICLE FILTER ─────────────────────────

  const passengerCount =
    Number(form.total_passengers)

  const suggestedVehicles =
    vehicles.filter(
      (v) =>
        passengerCount > 0 &&
        v.capacity >= passengerCount
    )

  // ── SUBMIT ─────────────────────────────────

  const handleSubmit = async () => {

    setApiError("")
    setFieldErrors({})

    // ── Client-side required-field guard ──────────────
    if (!form.pickup_date) {
      setApiError("Please select a pickup date.")
      return
    }
    if (!form.pickup_time_24) {
      setApiError("Please select a pickup time.")
      return
    }
    if (!form.vehicle) {
      setApiError("Please select a vehicle.")
      return
    }
    if (!form.purpose.trim()) {
      setApiError("Please enter a purpose for the trip.")
      return
    }
    if (!form.pickup_location.trim()) {
      setApiError("Please enter a pickup location.")
      return
    }
    if (!form.destination.trim()) {
      setApiError("Please enter a destination.")
      return
    }
    if (!form.total_passengers || Number(form.total_passengers) < 1) {
      setApiError("Please enter the number of passengers.")
      return
    }
    // ─────────────────────────────────────────────────

    if (isPastPickupDate) {

      setApiError(
        "Pickup date cannot be in the past."
      )

      return
    }

    if (
      form.return_required &&
      isPastReturnDate
    ) {

      setApiError(
        "Return date cannot be in the past."
      )

      return
    }

    setSubmitting(true)

    try {

      const pickupDateTime =
        `${form.pickup_date}T${form.pickup_time_24}:00`

      let returnDateTime = null

      if (
        form.return_required &&
        form.return_date &&
        form.return_time_24
      ) {
        returnDateTime =
          `${form.return_date}T${form.return_time_24}:00`
      } else {

        // Default end time = pickup + 2 hours.
        // MUST stay in local time (no .toISOString() — that converts to UTC
        // and produces a Z-suffix string that mismatches start_datetime's
        // naive local format, causing a backend validation error).
        const pickup = new Date(pickupDateTime)

        pickup.setHours(
          pickup.getHours() + 2
        )

        // Format as "YYYY-MM-DDTHH:MM:SS" in local time, matching start_datetime
        const pad = (n) => String(n).padStart(2, "0")
        returnDateTime =
          `${pickup.getFullYear()}-${pad(pickup.getMonth() + 1)}-${pad(pickup.getDate())}` +
          `T${pad(pickup.getHours())}:${pad(pickup.getMinutes())}:${pad(pickup.getSeconds())}`
      }

      const payload = {
        vehicle: Number(form.vehicle),

        purpose: form.purpose,

        start_datetime: pickupDateTime,

        end_datetime: returnDateTime,

        pickup_location: form.pickup_location,

        destination: form.destination,

        total_passengers: Number(form.total_passengers),

        user_notes: form.user_notes
      }

      let result

      if (isEditMode) {

        result =
          await updateMutation.mutateAsync({
            id: editData.id,
            bookingData: payload
          })

      } else {

        result =
          await createMutation.mutateAsync(payload)
      }

      onSave(result)

    } catch (err) {

      // Extract the most useful error message from the server response.
      // DRF returns field errors as { field: ["message"] } or { detail: "..." }
      // or { error: "..." } — unwrap whichever shape arrives.
      const data = err?.response?.data
      if (data) {
        if (typeof data === "string") {
          setApiError(data)
        } else if (data.detail) {
          setApiError(data.detail)
        } else if (data.error) {
          setApiError(data.error)
        } else {
          // Field-level errors — flatten to first message
          const firstKey = Object.keys(data)[0]
          const firstVal = data[firstKey]
          const msg = Array.isArray(firstVal) ? firstVal[0] : String(firstVal)
          setApiError(`${firstKey}: ${msg}`)
        }
      } else {
        setApiError("Failed to submit booking. Please try again.")
      }

    } finally {

      setSubmitting(false)
    }
  }

  // ====================================================
  // UI
  // ====================================================

  return createPortal(

    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">

      <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex max-h-[94vh]">

        {/* LEFT PANEL */}

        <div
          className="hidden md:flex md:w-[32%] flex-col justify-between p-7"
          style={{
            background:
              "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)"
          }}
        >

          <div>

            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">

              {isEditMode
                ? "Edit Booking"
                : "New Booking"}

            </p>

            <h2 className="text-3xl font-bold text-white leading-tight">

              Transport Request

            </h2>

            <p className="text-sm text-green-200/80 mt-4 leading-relaxed">

              Submit transport requirements with pickup schedule, passenger count and trip details.

            </p>

          </div>

          <div className="space-y-3">

            <div className="bg-white/10 rounded-2xl p-4">

              <p className="text-[10px] uppercase text-green-300 font-semibold">

                Smart Suggestion

              </p>

              <p className="text-sm text-white font-semibold mt-1">

                Vehicles auto-filter by capacity

              </p>

            </div>

            <div className="bg-white/10 rounded-2xl p-4">

              <p className="text-[10px] uppercase text-green-300 font-semibold">

                Approval

              </p>

              <p className="text-sm text-white font-semibold mt-1">

                Admin verification required

              </p>

            </div>

          </div>

        </div>

        {/* RIGHT PANEL */}

        <div className="flex-1 flex flex-col min-h-0">

          {/* HEADER */}

          <div className="flex justify-between items-start px-7 pt-6 pb-5 border-b border-gray-100">

            <div>

              <p className="text-xs font-semibold text-green-700 uppercase">

                Request Details

              </p>

              <h2 className="text-3xl font-bold text-gray-900 mt-1">

                Transport Booking Form

              </h2>

            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            >
              ✕
            </button>

          </div>

          {/* BODY */}

          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

            <Alert message={apiError} />

            {/* PICKUP */}

            <SectionLabel>
              Pickup Schedule
            </SectionLabel>

            <div className="grid grid-cols-2 gap-4">

              {/* DATE */}

              <Field
                label="Pickup date"
                required
              >

                <input
                  type="date"
                  className={inputCls}
                  value={form.pickup_date}
                  onChange={(e) =>
                    set(
                      "pickup_date",
                      e.target.value
                    )
                  }
                />

              </Field>

              {/* TIME */}

              <Field
                label="Pickup time"
                required
              >

                <div className="grid grid-cols-[1fr_110px] gap-3">

                  <input
                    type="time"
                    step="900"
                    disabled={isPastPickupDate}
                    className={inputCls}
                    value={
                      form.pickup_time_24 || ""
                    }

                    onChange={(e) => {

                      const value =
                        e.target.value

                      if (!value) return

                      let [hour, minute] =
                        value.split(":")

                      hour = parseInt(hour)

                      let period = "AM"

                      if (hour >= 12) {
                        period = "PM"
                      }

                      if (hour > 12) {
                        hour -= 12
                      }

                      if (hour === 0) {
                        hour = 12
                      }

                      const formattedHour =
                        String(hour).padStart(2, "0")

                      set(
                        "pickup_time",
                        `${formattedHour}:${minute}`
                      )

                      set(
                        "pickup_period",
                        period
                      )

                      set(
                        "pickup_time_24",
                        value
                      )
                    }}
                  />

                  <select
                    className={inputCls}
                    disabled={isPastPickupDate}
                    value={form.pickup_period}
                    onChange={(e) =>
                      set(
                        "pickup_period",
                        e.target.value
                      )
                    }
                  >

                    <option value="AM">
                      AM
                    </option>

                    <option value="PM">
                      PM
                    </option>

                  </select>

                </div>

              </Field>

            </div>

            {isPastPickupDate && (

              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">

                Please choose a present or future pickup date.

              </div>

            )}

            {/* DETAILS */}

            <SectionLabel>
              Transport Details
            </SectionLabel>

            <div className="grid grid-cols-2 gap-4">

              <Field
                label="Total passengers"
                required
              >

                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={form.total_passengers}
                  onChange={(e) =>
                    set(
                      "total_passengers",
                      e.target.value
                    )
                  }
                />

              </Field>

              <Field
                label="Suggested vehicle"
                required
              >

                <select
                  className={inputCls}
                  value={form.vehicle}
                  onChange={(e) =>
                    set(
                      "vehicle",
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Select vehicle
                  </option>

                  {suggestedVehicles.map((v) => (

                    <option
                      key={v.id}
                      value={v.id}
                    >

                      {v.name} ({v.capacity} seats)

                    </option>

                  ))}

                </select>

              </Field>

            </div>

            {/* PURPOSE */}

            <Field
              label="Purpose"
              required
            >

              <input
                className={inputCls}
                placeholder="e.g. Industrial visit"
                value={form.purpose}
                onChange={(e) =>
                  set(
                    "purpose",
                    e.target.value
                  )
                }
              />

            </Field>

            {/* TRIP DETAILS */}

            <SectionLabel>
              Trip Details
            </SectionLabel>

            <div className="grid grid-cols-2 gap-4">

              <Field
                label="Pickup location"
                required
              >

                <input
                  className={inputCls}
                  placeholder="e.g. College gate"
                  value={form.pickup_location}
                  onChange={(e) =>
                    set(
                      "pickup_location",
                      e.target.value
                    )
                  }
                />

              </Field>

              <Field
                label="Destination"
                required
              >

                <input
                  className={inputCls}
                  placeholder="e.g. Kochi"
                  value={form.destination}
                  onChange={(e) =>
                    set(
                      "destination",
                      e.target.value
                    )
                  }
                />

              </Field>

            </div>

            {/* RETURN */}

            <div className="border border-gray-200 rounded-2xl p-5 space-y-5">

              <label className="flex items-center gap-3 text-lg font-semibold text-gray-700">

                <input
                  type="checkbox"
                  checked={form.return_required}
                  onChange={(e) =>
                    set(
                      "return_required",
                      e.target.checked
                    )
                  }
                />

                Require Return Pickup

              </label>

              {form.return_required && (

                <>

                  {/* RETURN DATE TIME */}

                  <div className="grid grid-cols-2 gap-4">

                    <Field label="Return date">

                      <input
                        type="date"
                        className={inputCls}
                        value={form.return_date}
                        onChange={(e) =>
                          set(
                            "return_date",
                            e.target.value
                          )
                        }
                      />

                    </Field>

                    <Field label="Return time">

                      <div className="grid grid-cols-[1fr_110px] gap-3">

                        <input
                          type="time"
                          step="900"
                          disabled={isPastReturnDate}
                          className={inputCls}
                          value={
                            form.return_time_24 || ""
                          }

                          onChange={(e) => {

                            const value =
                              e.target.value

                            if (!value) return

                            let [hour, minute] =
                              value.split(":")

                            hour = parseInt(hour)

                            let period = "AM"

                            if (hour >= 12) {
                              period = "PM"
                            }

                            if (hour > 12) {
                              hour -= 12
                            }

                            if (hour === 0) {
                              hour = 12
                            }

                            const formattedHour =
                              String(hour).padStart(2, "0")

                            set(
                              "return_time",
                              `${formattedHour}:${minute}`
                            )

                            set(
                              "return_period",
                              period
                            )

                            set(
                              "return_time_24",
                              value
                            )
                          }}
                        />

                        <select
                          className={inputCls}
                          disabled={isPastReturnDate}
                          value={form.return_period}
                          onChange={(e) =>
                            set(
                              "return_period",
                              e.target.value
                            )
                          }
                        >

                          <option value="AM">
                            AM
                          </option>

                          <option value="PM">
                            PM
                          </option>

                        </select>

                      </div>

                    </Field>

                  </div>

                  {/* RETURN LOCATIONS */}

                  <div className="grid grid-cols-2 gap-4">

                    <Field label="Return pickup location">

                      <input
                        className={inputCls}
                        placeholder="e.g. Kochi"
                        value={form.return_pickup_location}
                        onChange={(e) =>
                          set(
                            "return_pickup_location",
                            e.target.value
                          )
                        }
                      />

                    </Field>

                    <Field label="Return destination">

                      <input
                        className={inputCls}
                        placeholder="e.g. College gate"
                        value={form.return_destination}
                        onChange={(e) =>
                          set(
                            "return_destination",
                            e.target.value
                          )
                        }
                      />

                    </Field>

                  </div>

                  {isPastReturnDate && (

                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">

                      Please choose a future return date.

                    </div>

                  )}

                </>

              )}

            </div>

            {/* NOTES */}

            <SectionLabel>
              Notes for approving office
            </SectionLabel>

            <textarea
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="Mention route details, special instructions..."
              value={form.user_notes}
              onChange={(e) =>
                set(
                  "user_notes",
                  e.target.value
                )
              }
            />

          </div>

          {/* FOOTER */}

          <div className="flex justify-between items-center px-7 py-5 border-t bg-gray-50">

            <p className="text-xs text-gray-400">

              Submitting sends the request for admin approval.

            </p>

            <div className="flex gap-3">

              <button
                onClick={onClose}
                className="px-5 py-3 border rounded-2xl text-sm font-medium hover:bg-gray-100 transition"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 rounded-2xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition disabled:opacity-60"
              >

                {submitting
                  ? "Sending..."
                  : "Send request"}

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
