import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { getAvailableVehicles, createBooking, updateBooking } from "../api/fleetApi"

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

  const [form, setForm] = useState({

    purpose:
      editData?.purpose ?? "",

    pickup_date:
      "",

    pickup_time:
      "",

    pickup_period:
      "AM",

    pickup_time_24:
      "",

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

  const [availableVehicles, setAvailableVehicles] = useState([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availabilityChecked, setAvailabilityChecked] = useState(false)

  const [apiError, setApiError] =
    useState("")

  const [submitting, setSubmitting] =
    useState(false)

  const [fieldErrors, setFieldErrors] =
    useState({})

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

  // ── VEHICLE FILTER (API DRIVEN) ────────────

  const passengerCount = Number(form.total_passengers)

  useEffect(() => {
    if (!passengerCount || !form.pickup_date || !form.pickup_time_24) {
      setAvailableVehicles([])
      setAvailabilityChecked(false)
      return
    }

    if (form.return_required && (!form.return_date || !form.return_time_24)) {
      setAvailableVehicles([])
      setAvailabilityChecked(false)
      return
    }

    const startDateTimeStr = `${form.pickup_date}T${form.pickup_time_24}`;
    let endDateTimeStr = "";

    if (form.return_required) {
      endDateTimeStr = `${form.return_date}T${form.return_time_24}`;
      if (endDateTimeStr <= startDateTimeStr) {
        setAvailableVehicles([])
        setAvailabilityChecked(false)
        return
      }
    } else {
      const startDateObj = new Date(startDateTimeStr);
      if (isNaN(startDateObj.getTime())) return;
      const endDateObj = new Date(startDateObj.getTime() + 2 * 60 * 60 * 1000);
      const yyyy = endDateObj.getFullYear();
      const mm = String(endDateObj.getMonth() + 1).padStart(2, "0");
      const dd = String(endDateObj.getDate()).padStart(2, "0");
      const hh = String(endDateObj.getHours()).padStart(2, "0");
      const min = String(endDateObj.getMinutes()).padStart(2, "0");
      endDateTimeStr = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    let cancelled = false;
    setCheckingAvailability(true);

    const params = {
      passengers: passengerCount,
      start_datetime: startDateTimeStr,
      end_datetime: endDateTimeStr
    }

    if (isEditMode && editData?.id) {
      params.exclude_booking_id = editData.id;
    }

    getAvailableVehicles(params)
      .then((data) => {
        if (!cancelled) {
          const fetchedVehicles = Array.isArray(data) ? data : (data.results ?? []);
          setAvailableVehicles(fetchedVehicles);
          setAvailabilityChecked(true);

          if (form.vehicle && !fetchedVehicles.find(v => String(v.id) === String(form.vehicle))) {
            set("vehicle", "");
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableVehicles([]);
          setAvailabilityChecked(false);
          setApiError("Could not check vehicle availability.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingAvailability(false);
        }
      });

    return () => {
      cancelled = true;
    }
  }, [
    passengerCount,
    form.pickup_date,
    form.pickup_time_24,
    form.return_required,
    form.return_date,
    form.return_time_24,
    isEditMode,
    editData?.id,
    form.vehicle
  ])

  // ── SUBMIT ─────────────────────────────────

  const handleSubmit = async () => {

    setApiError("")
    setFieldErrors({})

    if (isPastPickupDate) {
      setApiError("Pickup date cannot be in the past.")
      return
    }

    if (form.return_required && isPastReturnDate) {
      setApiError("Return date cannot be in the past.")
      return
    }

    if (!form.pickup_date || !form.pickup_time_24) {
      setApiError("Pickup date and time are required.");
      return;
    }

    if (form.return_required && (!form.return_date || !form.return_time_24)) {
      setApiError("Return date and time are required.");
      return;
    }

    const startDateTimeStr = `${form.pickup_date}T${form.pickup_time_24}`;
    let endDateTimeStr = "";

    if (form.return_required) {
      endDateTimeStr = `${form.return_date}T${form.return_time_24}`;
      if (endDateTimeStr <= startDateTimeStr) {
        setApiError("Return time must be after pickup time.");
        return;
      }
    } else {
      const startDateObj = new Date(startDateTimeStr);
      const endDateObj = new Date(startDateObj.getTime() + 2 * 60 * 60 * 1000);
      const yyyy = endDateObj.getFullYear();
      const mm = String(endDateObj.getMonth() + 1).padStart(2, "0");
      const dd = String(endDateObj.getDate()).padStart(2, "0");
      const hh = String(endDateObj.getHours()).padStart(2, "0");
      const min = String(endDateObj.getMinutes()).padStart(2, "0");
      endDateTimeStr = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    setSubmitting(true)

    try {

      const payload = {
        vehicle: Number(form.vehicle),
        purpose: form.purpose,
        start_datetime: startDateTimeStr,
        end_datetime: endDateTimeStr,
        pickup_location: form.pickup_location,
        destination: form.destination,
        total_passengers: Number(form.total_passengers),
        user_notes: form.user_notes
      }

      let result

      if (isEditMode) {
        result = await updateBooking(editData.id, payload)
      } else {
        result = await createBooking(payload)
      }

      onSave(result)

    } catch (err) {
      if (err.response?.data) {
        const errorData = err.response.data;
        const messages = Object.entries(errorData)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : val}`)
          .join(" | ");
        setApiError(messages || "Failed to submit booking.");
      } else {
        setApiError("Failed to submit booking.")
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
                label={
                  <span className="flex items-center gap-2">
                    Suggested vehicle
                    {checkingAvailability && (
                      <span className="inline-block w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></span>
                    )}
                  </span>
                }
                required
              >

                <select
                  className={inputCls}
                  disabled={!availabilityChecked || checkingAvailability || availableVehicles.length === 0}
                  value={form.vehicle}
                  onChange={(e) =>
                    set(
                      "vehicle",
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    {!availabilityChecked
                      ? "Enter passengers & date first"
                      : checkingAvailability
                        ? "Checking availability..."
                        : availableVehicles.length === 0
                          ? "No vehicles available"
                          : "Select vehicle"}
                  </option>

                  {availableVehicles.map((v, idx) => (

                    <option
                      key={v.id}
                      value={v.id}
                    >

                      {v.name} — {v.capacity} seats {idx === 0 ? "(Recommended)" : ""}

                    </option>

                  ))}

                </select>

                {availabilityChecked && !checkingAvailability && availableVehicles.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No vehicles available for this passenger count and schedule.
                  </p>
                )}
                {availabilityChecked && !checkingAvailability && availableVehicles.length > 0 && form.vehicle === "" && (
                  <p className="text-xs text-green-600 mt-1">
                    Smallest suitable vehicle recommended first.
                  </p>
                )}

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