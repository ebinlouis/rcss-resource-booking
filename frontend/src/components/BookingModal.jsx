import Tooltip from "./Tooltip"
import { createPortal } from "react-dom"
import LinkedBookingOptions from "./LinkedBookingOptions"
import { useBookingForm } from "../hooks/useBookingForm"
import FacultyDropdown from "./FacultyDropdown"
import SpaceSuggestions from "./booking/SpaceSuggestions"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"

const LOW_OCCUPANCY_THRESHOLD = 0.3
const COLLEGE_START = "08:00"
const COLLEGE_END = "18:00"

const todayISO = () => new Date().toISOString().split("T")[0]

const currentTimeISO = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`
}

const formatAMPM = (timeStr) => {
  if (!timeStr) return null
  let [hours, minutes] = timeStr.split(":").map(Number)
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12
  return `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`
}

const formatConflictDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

const durationMins = (startTime, endTime) => {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

const formatHoursPerDay = (startTime, endTime) => {
  const total = durationMins(startTime, endTime)
  if (total <= 0) return null
  const hrs = Math.floor(total / 60)
  const mins = total % 60
  if (mins === 0) return `${hrs} hrs/day`
  return `${hrs} hrs ${mins} min/day`
}

const daySpan = (startDate, endDate) => {
  const s = new Date(startDate + "T00:00:00")
  const e = new Date(endDate + "T00:00:00")
  return Math.round((e - s) / 86400000) + 1
}

const inputCls = (err) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white outline-none transition focus:ring-2 focus:ring-green-700 focus:border-transparent placeholder:text-gray-400 ${
    err ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"
  }`

function Field({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

function BookingModal({
  spaceId: initialSpaceId,
  spaceName: initialSpaceName,
  spaceCap: initialSpaceCap = null,
  onClose,
  initialData = null,
  prefillDate = "",
  prefillStart = "",
  prefillEnd = "",
  wizardMode = false,
  isStandalone = false, // ← NEW PROP: when true, ignores session draft for date/time fields
  onLinkedIntent,
}) {
  const {
    activeSpaceName, activeSpaceCap, form, set, toggleReq, switchHall,
    dynamicDepartments, dynamicEquipment, errors, submitted, isSubmitting,
    isAvailable, availabilityMsg, availabilityConflicts, isCheckingAvailability,
    suggestedHalls, isFetchingSuggestions, attendeeCount, exceedsCapacity,
    isLowOccupancy, isMultiDay, notesRequired, linkedStartIso,
    linkedEndIso, linkedOptionsReady, continueLinkedBooking,
    handleSubmit, isEdit, isStudent, isAiLab
  } = useBookingForm({
    initialSpaceId, initialSpaceName, initialSpaceCap, initialData,
    prefillDate, prefillStart, prefillEnd, isStandalone, onClose, onLinkedIntent
  });

  const bookingSession = useBookingSession();

  const handleClose = () => {
    if (isStandalone) {
      bookingSessionActions.clearSession()
    }
    onClose()
  }

  // ─────────────────────────────────────────────────────────────
  // Success State
  // ─────────────────────────────────────────────────────────────

  if (submitted) {
    const finishBooking = () => {
      bookingSessionActions.clearSession()
      onClose()
    }

    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-green-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? "Update Successful" : "Booking Submitted"}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your booking for{" "}
            <span className="font-semibold text-gray-700">{activeSpaceName}</span> has been{" "}
            {isEdit
              ? "updated and sent for review."
              : "submitted for review."}
            {form.isExternal && (
              <span className="block mt-1 text-xs text-amber-600 font-medium">
                Marked as an external event.
              </span>
            )}
          </p>
          <button
            onClick={finishBooking}
            className="mt-2 w-full bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-xl text-sm font-medium transition"
          >
            {isEdit ? "Done" : "Finish Booking"}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  // Left panel derived values (normal modal only)
  const startH = form.start_time
    ? +form.start_time.split(":")[0] + +form.start_time.split(":")[1] / 60
    : null
  const endH = form.end_time
    ? +form.end_time.split(":")[0] + +form.end_time.split(":")[1] / 60
    : null

  const numDays =
    isMultiDay && form.start_date && form.end_date
      ? daySpan(form.start_date, form.end_date)
      : null

  const hrsPerDay =
    isMultiDay && form.start_time && form.end_time
      ? formatHoursPerDay(form.start_time, form.end_time)
      : null

  // ─────────────────────────────────────────────────────────────
  // Shared form body (used in both wizard and normal modal)
  // ─────────────────────────────────────────────────────────────

  const formBody = (
    <div className="space-y-6">
      {/* ── STEP 1: DATE & TIME ── */}
      <div className="space-y-4">
        <SectionLabel>Step 1: Pick a Time</SectionLabel>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" required error={errors.start_date}>
            <input
              type="date"
              min={todayISO()}
              className={inputCls(errors.start_date)}
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </Field>
          <Field label="End Date" required error={errors.end_date}>
            <input
              type="date"
              min={form.start_date || todayISO()}
              className={inputCls(errors.end_date)}
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
            />
          </Field>
        </div>

        {isMultiDay && (
          <div className="col-span-2 mt-1 mb-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Event Type</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    name="bookingType"
                    value="SINGLE"
                    checked={form.bookingType === 'SINGLE'}
                    onChange={(e) => set('bookingType', e.target.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-600"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">Continuous Event (e.g. Hackathon)</span>
                  <span className="text-xs text-gray-500 mt-0.5">Blocks the venue completely from the start day to the end day, including overnight.</span>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="radio"
                    name="bookingType"
                    value="RECURRING"
                    checked={form.bookingType === 'RECURRING'}
                    onChange={(e) => set('bookingType', e.target.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-600"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">Full-Time Booking (e.g. Hackathon)</span>
                  <span className="text-xs text-gray-500 mt-0.5">Reserves the venue only during the selected hours each day.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Time" required error={errors.start_time}>
            <input
              type="time"
              min={
                form.start_date === todayISO()
                  ? currentTimeISO() > COLLEGE_START
                    ? currentTimeISO()
                    : COLLEGE_START
                  : COLLEGE_START
              }
              max={COLLEGE_END}
              className={inputCls(errors.start_time)}
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
            />
          </Field>
          <Field label="End Time" required error={errors.end_time}>
            <input
              type="time"
              min={
                isMultiDay && form.bookingType === "SINGLE"
                  ? COLLEGE_START
                  : form.start_date === todayISO()
                  ? form.start_time && form.start_time > currentTimeISO()
                    ? form.start_time
                    : currentTimeISO()
                  : form.start_time || COLLEGE_START
              }
              max={COLLEGE_END}
              className={inputCls(errors.end_time)}
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
            />
          </Field>
        </div>

        {/* Availability Banner */}
        {isCheckingAvailability ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 animate-pulse">
            <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-blue-800">Checking availability…</p>
          </div>
        ) : isAvailable === false ? (
          availabilityConflicts.length > 0 ? (
            <div className="border border-red-200 bg-red-50 rounded-xl overflow-hidden">
              {availabilityMsg && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-200 bg-red-100/60">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs font-semibold text-red-800">{availabilityMsg}</p>
                </div>
              )}
              <div className="divide-y divide-red-100 max-h-48 overflow-y-auto">
                {availabilityConflicts.map((conflict, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                    <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-xs font-semibold text-red-800 w-28 shrink-0">{formatConflictDate(conflict.date)}</span>
                    <span className="text-xs text-red-700">{formatAMPM(conflict.start)} – {formatAMPM(conflict.end)}</span>
                    <span className="ml-auto text-[11px] text-red-500 font-medium shrink-0 truncate max-w-[120px]">{conflict.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-red-800">{availabilityMsg || "This time slot is unavailable."}</p>
            </div>
          )
        ) : isAvailable === true ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-bold text-green-800">Time slot is available!</p>
          </div>
        ) : null}

        {isFetchingSuggestions && (
          <p className="text-xs text-indigo-600 animate-pulse mt-2 mb-4">Looking for better venue options...</p>
        )}
        {!isFetchingSuggestions && suggestedHalls.length > 0 && (
          <div className="mt-2 mb-4">
            <SpaceSuggestions suggestedHalls={suggestedHalls} onSwitch={switchHall} />
          </div>
        )}
      </div>

      {/* ── STEP 2: EVENT DETAILS ── */}
      <div
        className={`space-y-6 transition-all duration-300 ${
          isAvailable === true
            ? "opacity-100"
            : "opacity-40 pointer-events-none select-none filter grayscale-[20%]"
        }`}
      >
        <SectionLabel>Step 2: Event Details</SectionLabel>

        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/60">
          <div className="flex flex-col pr-4">
            <span className="text-sm font-semibold text-gray-700">External Event</span>
            <span className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Turn this on if the event involves external guests or organisations.
These bookings may need additional review.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.isExternal}
            onClick={() => set("isExternal", !form.isExternal)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 ${
              form.isExternal ? "bg-amber-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                form.isExternal ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Event Purpose" required error={errors.purpose}>
            <input
              className={inputCls(errors.purpose)}
              value={form.purpose}
              onChange={(e) => set("purpose", e.target.value)}
              placeholder="e.g. MCA Cloud Security Seminar"
            />
          </Field>
          <Field label="Department" required error={errors.department}>
            <select
              className={inputCls(errors.department)}
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            >
              <option value="">Select department</option>
              {dynamicDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.department_name}</option>
              ))}
            </select>
          </Field>
        </div>

        {isStudent && !isAiLab && (
          <FacultyDropdown
            value={form.faculty_sponsor}
            onChange={(val) => set("faculty_sponsor", val)}
            error={errors.faculty_sponsor}
            departmentId={form.department}
          />
        )}

        <SectionLabel>Step 3: Setup & Capacity</SectionLabel>

        {exceedsCapacity && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">Capacity exceeded</p>
                <p className="text-xs text-red-700 mt-0.5">
                  This venue supports only {activeSpaceCap} attendees. Please reduce attendees or choose a larger venue.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSpaceName?.toLowerCase().includes("ai lab") ? (
          <div className="space-y-4">
            <div className="flex gap-6 mt-1 mb-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aiBookingSize"
                  value="SINGLE"
                  checked={form.aiBookingSize === 'SINGLE'}
                  onChange={() => {
                    set('aiBookingSize', 'SINGLE');
                    set('attendees', 1);
                  }}
                  className="w-4 h-4 text-green-600 focus:ring-green-600"
                />
                <span className="text-sm font-semibold text-gray-900">Single Booking</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aiBookingSize"
                  value="GROUP"
                  checked={form.aiBookingSize === 'GROUP'}
                  onChange={() => {
                    set('aiBookingSize', 'GROUP');
                    if (String(form.attendees) === "1") {
                      set('attendees', "");
                    }
                  }}
                  className="w-4 h-4 text-green-600 focus:ring-green-600"
                />
                <span className="text-sm font-semibold text-gray-900">Group Booking</span>
              </label>
            </div>
            
            {form.aiBookingSize === 'GROUP' && (
              <div className="grid grid-cols-1 gap-4">
                <Field label="Expected attendees" required error={errors.attendees}>
                  <input
                    type="number"
                    min="1"
                    max={activeSpaceCap || undefined}
                    className={inputCls(errors.attendees)}
                    placeholder="e.g. 10"
                    value={form.attendees}
                    onChange={(e) => set("attendees", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <Field label="Expected attendees" required error={errors.attendees}>
              <input
                type="number"
                min="1"
                max={activeSpaceCap || undefined}
                className={inputCls(errors.attendees)}
                placeholder="e.g. 45"
                value={form.attendees}
                onChange={(e) => set("attendees", e.target.value)}
              />
            </Field>
          </div>
        )}

        {isLowOccupancy && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 mb-2">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Low occupancy for {activeSpaceName}</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {attendeeCount} attendees fills only {Math.round((attendeeCount / activeSpaceCap) * 100)}% of this venue.
                  Consider a smaller venue, or explain below why this venue is needed.
                </p>
                {!isFetchingSuggestions && suggestedHalls.length === 0 && Number.isFinite(attendeeCount) && (
                  <p className="text-xs text-amber-600 mt-2">No smaller venues available — please explain in Notes below.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <SectionLabel>Requirements</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {dynamicEquipment.map((req) => {
            const active = form.requirements.includes(req.id)
            return (
              <button
                key={req.id}
                type="button"
                onClick={() => toggleReq(req.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition text-left ${
                  active
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                    active ? "bg-green-700 border-green-700" : "border-gray-300"
                  }`}
                >
                  {active && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <span className="text-xs font-medium">{req.name}</span>
              </button>
            )
          })}
        </div>

        <SectionLabel>
          Notes
          {notesRequired && (
            <span className="text-red-400 ml-1 normal-case font-normal">
              — required for low-occupancy bookings
            </span>
          )}
        </SectionLabel>
        <Field
          error={errors.notes}
          hint={notesRequired ? undefined : "Mention setup, technical support, seating changes…"}
        >
          <textarea
            rows={3}
            className={`${inputCls(errors.notes)} resize-none`}
            placeholder={
              notesRequired
                ? "Please explain why this venue is needed for a smaller group."
                : "Mention setup, technical support, seating changes…"
            }
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>

        <LinkedBookingOptions
          visible={linkedOptionsReady}
          startIso={linkedStartIso}
          endIso={linkedEndIso}
          completedBookings={bookingSession.completedBookings}
          onAddMess={() => continueLinkedBooking("mess")}
          onAddMedia={() => continueLinkedBooking("media")}
        />
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────
  // Wizard mode — matches Mess/Media layout exactly
  // ─────────────────────────────────────────────────────────────

  if (wizardMode) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Heading — matches SpaceDraftStep / MessDraftStep / MediaDraftStep */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-700">Space</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">Book a venue</h2>
          <p className="mt-2 text-sm text-gray-500">
            Choose your venue, schedule, and event details. You can add related services using the same booking time.
          </p>
        </div>

        {errors.server && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errors.server}
          </div>
        )}

        {isEdit && initialData?.status === "APPROVED" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-800 leading-relaxed">
              This booking is currently approved. Saving changes will move it back to{" "}
              <span className="font-semibold">Pending Review</span> and notify the team.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {formBody}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // Normal modal mode
  // ─────────────────────────────────────────────────────────────

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[32%] shrink-0 flex-col justify-between p-7"
          style={{
            background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)",
          }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {isEdit ? "Editing Booking" : "New Booking"}
            </p>
            <h2 className="text-2xl font-bold text-white leading-tight">{activeSpaceName}</h2>

            {form.isExternal && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                External Event
              </span>
            )}

            <p className="text-sm text-green-200/75 mt-3 leading-relaxed">
              {isEdit
                ? "Editing this booking will send it back to the admin for re-approval."
                : "Book a venue, choose your time, and add any details needed for approval."}
            </p>

            {activeSpaceCap !== null && (
              <div className="mt-4 bg-white/10 rounded-xl px-4 py-3">
                <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">Venue Capacity</p>
                <p className="text-white font-bold text-lg">{activeSpaceCap} seats</p>
                {Number.isFinite(attendeeCount) && attendeeCount > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isLowOccupancy ? "bg-amber-400" : "bg-green-400"}`}
                        style={{ width: `${Math.min(100, (attendeeCount / activeSpaceCap) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-green-300/70 mt-1">
                      {Math.round((attendeeCount / activeSpaceCap) * 100)}% fill
                      {isLowOccupancy && " — low occupancy"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SLOT CARD */}
          <div className="space-y-2.5">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase tracking-wide font-semibold mb-1">Selected Slot</p>

              {isMultiDay ? (
                form.start_date && form.end_date ? (
                  <div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-left">
                        <p className="text-white font-bold text-sm leading-tight">
                          {new Date(form.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
                        </p>
                        {form.start_time && <p className="text-green-200/70 text-xs mt-0.5">{formatAMPM(form.start_time)}</p>}
                      </div>
                      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="text-left">
                        <p className="text-white font-bold text-sm leading-tight">
                          {new Date(form.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}
                        </p>
                        {form.end_time && <p className="text-green-200/70 text-xs mt-0.5">{formatAMPM(form.end_time)}</p>}
                      </div>
                    </div>
                    {numDays !== null && (
                      <p className="text-green-300/80 text-xs mt-3 font-medium">
                        {numDays} {numDays === 1 ? "day" : "days"}
                        {form.bookingType === "RECURRING" && hrsPerDay ? ` · ${hrsPerDay}` : ""}
                        {form.bookingType === "SINGLE" ? ` · Continuous Event` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">Choose a date and time</p>
                )
              ) : (
                <>
                  {form.start_time ? (
                    <>
                      <p className="text-white font-bold text-base">
                        {formatAMPM(form.start_time)}
                        {form.end_time && ` – ${formatAMPM(form.end_time)}`}
                      </p>
                      {form.start_date && (
                        <p className="text-green-200/70 text-xs mt-1">
                          {new Date(form.start_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-white/50 text-sm">Choose a date and time</p>
                  )}
                  <div className="mt-4 flex gap-[2px]">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const seg = 8 + i * 0.5
                      const fill = startH !== null && endH !== null && seg >= startH && seg < endH
                      return (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${fill ? "bg-green-400" : "bg-white/20"}`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] text-green-300/50 mt-1">
                    <span>08:00</span>
                    <span>18:00</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-0.5">Venue Booking</p>
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit ? "Edit your booking" : "Book this venue"}
              </h2>
            </div>
<button
  onClick={handleClose}
  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition"
>
  ✕
</button></div>

          {/* RE-APPROVAL NOTICE */}
          {isEdit && initialData?.status === "APPROVED" && (
            <div className="mx-7 mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shrink-0">
              <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                This booking is currently approved. Saving changes will move it back to{" "}
                <span className="font-semibold">Pending Review</span> and notify the admin.
              </p>
            </div>
          )}

          {/* FORM BODY */}
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
            {formBody}
          </div>

          {/* FOOTER */}
          <div className="shrink-0 flex justify-between items-center px-7 py-4 border-t border-gray-100 bg-gray-50/60">
            <div>
              {errors.server && (
                <p className="text-xs text-red-500 font-medium">{errors.server}</p>
              )}
              {!errors.server && (
                <p className="text-xs text-gray-400">
                  {isAvailable !== true
                    ? "Please select an available time slot to continue."
                    : isEdit && initialData?.status === "APPROVED"
                    ? "Saving changes will send this booking for review again."
                    : "Your booking will be reviewed after submission."}
                </p>
              )}
            </div>
            <div className="flex gap-2">
<button
  onClick={handleClose}
  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
>
  Cancel
</button>

<Tooltip
  text={
    isEdit
      ? "Save your changes. The booking will be re-reviewed if it was already approved."
      : "Submit your booking request. Your booking will be reviewed before confirmation."
  }
  position="top"
>
  <button
    onClick={handleSubmit}
    disabled={isSubmitting || isAvailable !== true || exceedsCapacity}
    className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isSubmitting ? "Saving..." : isEdit ? "Update Booking" : "Send Booking Request"}
  </button>
</Tooltip></div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default BookingModal