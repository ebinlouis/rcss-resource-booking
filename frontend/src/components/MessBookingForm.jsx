import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import messService from "../api/messService"
import AutoSuggestInput from "./AutoSuggestInput"
import { MEALS, getDateRange } from "../api/messConfig"
import { Copy, ChevronLeft, ChevronRight } from "lucide-react"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeTime = (t) => {
  if (!t) return null
  return t.length === 5 ? `${t}:00` : t
}

const formatTabLabel = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

const formatTabDay = (dateStr, index) => `Day ${index + 1}`

// ── Default state builders ────────────────────────────────────────────────────

const emptyDayMenu = (date) => ({
  date,
  total_persons:        "",
  veg_persons:          "",
  nonveg_persons:       "",
  breakfast_time:       "",
  breakfast_menu:       "",
  morning_tea_time:     "",
  morning_snack_option: "",
  lunch_time:           "",
  lunch_menu:           "",
  evening_tea_time:     "",
  evening_snack_option: "",
  dinner_time:          "",
  dinner_menu:          "",
})

const sanitize = (v) => (v === null || v === undefined ? "" : v)

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
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
  `${inputCls} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`

// ── DayMenuPanel ─────────────────────────────────────────────────────────────

function DayMenuPanel({ dayMenu, onChange, isFirstDay, onApplyToAll, totalDays }) {
  const set = (key, value) => onChange({ ...dayMenu, [key]: value })

  const total  = parseInt(dayMenu.total_persons  || 0)
  const veg    = parseInt(dayMenu.veg_persons    || 0)
  const nonveg = parseInt(dayMenu.nonveg_persons || 0)
  const remaining = total - veg - nonveg
  const exceeds   = veg + nonveg > total

  return (
    <div className="space-y-5 py-2">

      {/* Apply to All banner — only on Day 1 for multi-day */}
      {isFirstDay && totalDays > 1 && (
        <button
          type="button"
          onClick={onApplyToAll}
          className="w-full flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 text-sm font-semibold rounded-xl px-4 py-3 transition-all"
        >
          <Copy size={15} />
          Apply Day 1 menu &amp; headcount to all {totalDays} days
        </button>
      )}

      {/* Attendees */}
      <SectionLabel>Attendees</SectionLabel>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">

          <Field label="Total" required>
            <input
              type="number"
              min={1}
              className={numberInputCls}
              value={dayMenu.total_persons}
              onChange={(e) => {
                const val    = e.target.value
                const total_ = parseInt(val || 0)
                const veg_   = parseInt(dayMenu.veg_persons || 0)
                const upd    = { ...dayMenu, total_persons: val }
                if (total_ >= veg_) upd.nonveg_persons = String(total_ - veg_)
                onChange(upd)
              }}
            />
          </Field>

          <Field label="Veg" required>
            <input
              type="number"
              min={0}
              className={numberInputCls}
              value={dayMenu.veg_persons}
              onChange={(e) => {
                const v   = parseInt(e.target.value || 0)
                const tot = parseInt(dayMenu.total_persons || 0)
                if (v > tot) return
                onChange({ ...dayMenu, veg_persons: String(v), nonveg_persons: String(tot - v) })
              }}
            />
          </Field>

          <Field label="Non-Veg" required>
            <input
              type="number"
              min={0}
              className={numberInputCls}
              value={dayMenu.nonveg_persons}
              onChange={(e) => {
                const v   = parseInt(e.target.value || 0)
                const tot = parseInt(dayMenu.total_persons || 0)
                const v_  = parseInt(dayMenu.veg_persons || 0)
                if (v_ + v > tot) return
                onChange({ ...dayMenu, nonveg_persons: String(v) })
              }}
            />
          </Field>

        </div>

        {total > 0 && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <p className="text-gray-700"><span className="font-semibold">Total:</span> {total}</p>
              <p className="text-green-700"><span className="font-semibold">Veg:</span> {veg}</p>
              <p className="text-red-700"><span className="font-semibold">Non-Veg:</span> {nonveg}</p>
              <p className={`font-semibold ${remaining === 0 ? "text-green-600" : "text-orange-500"}`}>
                Remaining: {remaining}
              </p>
            </div>
            {remaining > 0 && !exceeds && (
              <p className="text-xs text-orange-500 mt-1.5">Allocate all remaining attendees.</p>
            )}
            {exceeds && (
              <p className="text-xs text-red-500 mt-1.5">Veg + Non-Veg exceeds total.</p>
            )}
          </div>
        )}
      </div>

      {/* Meals */}
      <SectionLabel>Meals Required</SectionLabel>
      <p className="text-xs text-gray-500 -mt-2">
        Toggle the meals needed for this day and fill in time and menu.
      </p>

      <div className="space-y-3">
        {MEALS.map((meal) => {
          // A meal is on if explicitly toggled (_enabledMeals) OR already has a saved time (edit mode)
          const enabledSet = new Set(dayMenu._enabledMeals ?? [])
          const isOn = enabledSet.has(meal.id) || !!dayMenu[meal.timeKey]

          return (
            <div
              key={meal.id}
              className={`border rounded-xl p-4 transition-all ${
                isOn ? "bg-green-50/40 border-green-200" : "bg-gray-50 border-gray-100"
              }`}
            >
              <label className="flex items-center gap-3 font-medium text-gray-700 cursor-pointer w-fit select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-600"
                  checked={isOn}
                  onChange={(e) => {
                    const next = new Set(enabledSet)
                    if (e.target.checked) {
                      next.add(meal.id)
                      onChange({ ...dayMenu, _enabledMeals: [...next] })
                    } else {
                      next.delete(meal.id)
                      onChange({ ...dayMenu, _enabledMeals: [...next], [meal.timeKey]: "", [meal.menuKey]: "" })
                    }
                  }}
                />
                {meal.label}
              </label>

              {isOn && (
                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                  <input
                    type="time"
                    className={`${inputCls} sm:w-1/3 bg-white`}
                    value={dayMenu[meal.timeKey]}
                    onChange={(e) => set(meal.timeKey, e.target.value)}
                  />
                  <AutoSuggestInput
                    value={dayMenu[meal.menuKey] || ""}
                    placeholder={meal.menuPlaceholder}
                    suggestionsFetcher={() =>
                      messService.getSuggestions(meal.menuKey)
                    }
                    onChange={(value) => set(meal.menuKey, value)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

function MessBookingForm({ onClose, onSave, editData }) {
  const navigate = useNavigate()
  const bookingSession = useBookingSession()
  const linkedSpace = bookingSession.spaceFormData
  const linkedEventGroupId = editData?.event_group_id || linkedSpace?.event_group_id || bookingSession.eventGroupId
  const isLinkedBooking = Boolean(!editData && linkedSpace?.event_group_id)

  // ── Event-level state ─────────────────────────────────────────────────────
  const [eventForm, setEventForm] = useState({
    purpose_of_programme: sanitize(editData?.purpose_of_programme ?? linkedSpace?.purpose),
    start_date:           sanitize(editData?.start_date ?? linkedSpace?.start_date),
    end_date:             sanitize(editData?.end_date ?? linkedSpace?.end_date ?? linkedSpace?.start_date),
    delivery_location:    sanitize(editData?.delivery_location ?? linkedSpace?.spaceName),
    user_notes:           sanitize(editData?.user_notes),
  })

  // ── Per-day overrides state ───────────────────────────────────────────────
  // Stored as { [date]: DayMenu } so dailyMenus can be fully derived via useMemo.
  // Inline lazy initializer — called exactly once on mount, captures editData
  // from the closure. No useCallback needed; editData is a prop that never
  // changes identity after mount (the form is always remounted for edit vs new).
  const [menuOverrides, setMenuOverrides] = useState(() => {
    const map = {}
    if (editData?.daily_menus?.length > 0) {
      for (const m of editData.daily_menus) {
        map[m.date] = {
          date:                 m.date,
          total_persons:        sanitize(m.total_persons),
          veg_persons:          sanitize(m.veg_persons),
          nonveg_persons:       sanitize(m.nonveg_persons),
          breakfast_time:       sanitize(m.breakfast_time)?.slice(0, 5) ?? "",
          breakfast_menu:       sanitize(m.breakfast_menu),
          morning_tea_time:     sanitize(m.morning_tea_time)?.slice(0, 5) ?? "",
          morning_snack_option: sanitize(m.morning_snack_option),
          lunch_time:           sanitize(m.lunch_time)?.slice(0, 5) ?? "",
          lunch_menu:           sanitize(m.lunch_menu),
          evening_tea_time:     sanitize(m.evening_tea_time)?.slice(0, 5) ?? "",
          evening_snack_option: sanitize(m.evening_snack_option),
          dinner_time:          sanitize(m.dinner_time)?.slice(0, 5) ?? "",
          dinner_menu:          sanitize(m.dinner_menu),
        }
      }
    }
    return map
  })

  const [activeDay,    setActiveDay]    = useState(0)
  const [error,        setError]        = useState(null)
  const [dateError,    setDateError]    = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // FIX 1 & 3: Use a ticking `now` ref updated via useEffect so countdown
  // computation is pure during render (reads state, not Date.now() directly).
  // We store `now` in state so updates trigger a re-render for the countdown.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000) // refresh every 30s
    return () => clearInterval(id)
  }, [])

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  const today = new Date().toISOString().split("T")[0]

  // ── Derived dailyMenus — no effect needed ─────────────────────────────────
  // FIX 2 & 3: Derive dailyMenus purely from eventForm + menuOverrides.
  // No useEffect + setState cascade. When dates change the memo recomputes
  // automatically, merging saved overrides for dates that still exist.
  const dailyMenus = useMemo(() => {
    const { start_date, end_date } = eventForm
    if (!start_date || !end_date || end_date < start_date) return []
    const dates = getDateRange(start_date, end_date)
    return dates.map((d) => menuOverrides[d] ?? emptyDayMenu(d))
  }, [eventForm, menuOverrides])

  // ── Countdown for 24h SLA ─────────────────────────────────────────────────
  // FIX 1: `now` comes from state (set by a timer effect), not a bare Date.now()
  // call inside the render path, so this is a pure computation.
  const countdown = useMemo(() => {
    if (!eventForm.start_date || dailyMenus.length === 0) return null

    const firstMenu = dailyMenus[0]
    const allTimes  = MEALS.map((m) => firstMenu[m.timeKey]).filter(Boolean)
    if (allTimes.length === 0) return null

    const earliest = allTimes.sort()[0]
    const dt       = new Date(`${eventForm.start_date}T${earliest}`)
    const deadline = new Date(dt.getTime() - 24 * 60 * 60 * 1000)
    const diff     = deadline.getTime() - now   // `now` from state, not Date.now()

    if (diff <= 0) return { expired: true, message: "Booking closed. 24h notice required." }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return { expired: false, message: `Booking closes in ${h}h ${m}m for selected meal.` }
  }, [eventForm.start_date, dailyMenus, now])

  // ── Apply Day 1 to all ────────────────────────────────────────────────────
  const handleApplyToAll = useCallback(() => {
    if (dailyMenus.length <= 1) return
    const template = dailyMenus[0]
    setMenuOverrides((prev) => {
      const next = { ...prev }
      for (const m of dailyMenus) {
        next[m.date] = { ...template, date: m.date }
      }
      return next
    })
  }, [dailyMenus])

  // ── Day menu change ───────────────────────────────────────────────────────
  const handleDayChange = useCallback((index, updated) => {
    setMenuOverrides((prev) => ({ ...prev, [updated.date]: updated }))
    if (error) setError(null)
  }, [error])

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!eventForm.purpose_of_programme?.trim()) return "Please provide the purpose of programme."
    if (!eventForm.start_date)                   return "Please select a start date."
    if (!eventForm.end_date)                     return "Please select an end date."
    if (eventForm.end_date < eventForm.start_date) return "End date must be on or after start date."
    if (!eventForm.delivery_location?.trim())    return "Please provide a delivery location."

    if (dailyMenus.length === 0) return "Date range produced no days."

    for (let i = 0; i < dailyMenus.length; i++) {
      const m     = dailyMenus[i]
      const label = `Day ${i + 1} (${m.date})`

      const total  = parseInt(m.total_persons  || 0)
      const veg    = parseInt(m.veg_persons    || 0)
      const nonveg = parseInt(m.nonveg_persons || 0)

      if (total <= 0)             return `${label}: Total persons must be greater than zero.`
      if (veg + nonveg !== total) return `${label}: Veg (${veg}) + Non-Veg (${nonveg}) must equal Total (${total}).`

      const mealTimes = MEALS.map((meal) => m[meal.timeKey]).filter(Boolean)
      if (mealTimes.length === 0) return `${label}: At least one meal must be selected.`

      for (const meal of MEALS) {
        const time = m[meal.timeKey]
        const menu = m[meal.menuKey]
        if (time && !String(menu || "").trim())
          return `${label}: Please fill in the ${meal.menuLabel} for ${meal.label}.`
      }
    }

    // 24h SLA check on earliest meal across all days
    const allDateTimes = []
    for (const m of dailyMenus) {
      for (const meal of MEALS) {
        if (m[meal.timeKey]) allDateTimes.push(new Date(`${m.date}T${m[meal.timeKey]}`))
      }
    }
    if (allDateTimes.length > 0) {
      const earliest = new Date(Math.min(...allDateTimes))
      const deadline = new Date(now + 24 * 60 * 60 * 1000)
      if (earliest < deadline)
        return "SLA Violation: Mess bookings require strictly 24 hours notice before the first meal."
    }

    return null
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    // Build the payload
    // eslint-disable-next-line no-unused-vars
    const daily_menus = dailyMenus.map(({ _enabledMeals: _ignored, ...m }) => ({
      date:           m.date,
      total_persons:  parseInt(m.total_persons,  10),
      veg_persons:    parseInt(m.veg_persons,    10),
      nonveg_persons: parseInt(m.nonveg_persons, 10),
      ...Object.fromEntries(
        MEALS.flatMap((meal) => [
          [meal.timeKey, normalizeTime(m[meal.timeKey]) || null],
          [meal.menuKey, m[meal.timeKey] ? m[meal.menuKey] : null],
        ])
      ),
    }))

    const payload = {
      purpose_of_programme: eventForm.purpose_of_programme,
      start_date:           eventForm.start_date,
      end_date:             eventForm.end_date,
      delivery_location:    eventForm.delivery_location,
      user_notes:           eventForm.user_notes || "",
      daily_menus,
    }

    if (isLinkedBooking || editData?.event_group_id) {
      payload.event_group_id = linkedEventGroupId
    }

    setIsSubmitting(true)
    try {
      if (editData?.id) {
        await messService.updateBooking(editData.id, payload)
      } else {
        await messService.createBooking(payload)
        if (isLinkedBooking) bookingSessionActions.markComplete("mess")
      }
      if (isMounted.current) { setIsSubmitting(false); onSave?.() }
    } catch (err) {
      if (!isMounted.current) return
      const data = err?.response?.data
      if (data) {
        // Handle nested daily_menus errors from DRF
        if (Array.isArray(data.daily_menus)) {
          const firstDayErr = data.daily_menus.find((d) => d && Object.keys(d).length > 0)
          if (firstDayErr) {
            const key = Object.keys(firstDayErr)[0]
            const msg = Array.isArray(firstDayErr[key]) ? firstDayErr[key][0] : firstDayErr[key]
            setError(`daily_menus: ${key}: ${msg}`)
            return
          }
        }
        const firstKey = Object.keys(data)[0]
        const msg = Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey]
        setError(`${firstKey === "non_field_errors" ? "Error" : firstKey}: ${msg}`)
      } else {
        setError("Failed to submit request.")
      }
    } finally {
      if (isMounted.current) setIsSubmitting(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const datesReady   = eventForm.start_date && eventForm.end_date && eventForm.end_date >= eventForm.start_date
  const isExpired    = countdown?.expired
  const totalDays    = dailyMenus.length

  // Guard activeDay against stale index during render (before the reset effect fires)
  const safeDayIndex = Math.min(activeDay, Math.max(0, totalDays - 1))

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl flex overflow-hidden shadow-2xl max-h-[92vh]">

        {/* LEFT PANEL */}
        <div
          className="hidden md:flex md:w-[30%] flex-col min-h-0 p-7 shrink-0"
          style={{ background: "linear-gradient(160deg, #14532d 0%, #166534 45%, #1e3a5f 100%)" }}
        >
          <div className="shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-300 mb-2">
              {editData ? "Edit Booking" : "New Booking"}
            </p>
            <h2 className="text-2xl font-bold text-white">Mess Request</h2>
            <p className="text-sm text-green-200/75 mt-3">
              Submit your catering requirements for single or multi-day events.
            </p>
          </div>

          {/* Day navigator summary */}
          {totalDays > 0 && (
            <div className="space-y-2 mt-6 flex-1 overflow-y-auto min-h-0 pb-4 pr-1 dark-scrollbar">
              <p className="text-[10px] text-green-300 uppercase font-semibold mb-2">
                {totalDays} Day{totalDays > 1 ? "s" : ""} Selected
              </p>
              {dailyMenus.map((m, i) => {
                const hasMeal = MEALS.some((meal) => m[meal.timeKey])
                return (
                  <button
                    key={m.date}
                    type="button"
                    onClick={() => setActiveDay(i)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 text-xs font-medium transition-all flex items-center justify-between ${
                      safeDayIndex === i
                        ? "bg-white/20 text-white"
                        : "bg-white/8 text-green-200/70 hover:bg-white/12"
                    }`}
                  >
                    <span>Day {i + 1} · {formatTabLabel(m.date)}</span>
                    <span className={`w-2 h-2 rounded-full ${hasMeal ? "bg-green-400" : "bg-white/20"}`} />
                  </button>
                )
              })}
            </div>
          )}

          <div className="space-y-2 mt-auto pt-6 shrink-0">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[10px] text-green-300 uppercase font-semibold">SLA</p>
              <p className="text-white text-sm font-semibold mt-1">Strict 24h notice required</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Approval</p>
                <p className="text-white text-xs font-semibold mt-1">Admin review</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[9px] text-green-300 uppercase font-semibold">Policy</p>
                <p className="text-white text-xs font-semibold mt-1">Per headcount</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white">

          {/* HEADER */}
          <div className="flex justify-between items-start px-7 pt-6 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase">Request Details</p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">Mess Booking Form</h2>
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
            className="flex-1 overflow-y-auto overflow-x-hidden px-7 py-5 space-y-5"
          >

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                ⚠️ {error}
              </div>
            )}

            {/* ── Event Details ── */}
            {isLinkedBooking && !bookingSession.completedBookings.includes("media") && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="font-semibold">This Mess request is linked to your Space booking.</p>
                    <p className="text-xs text-green-700 mt-0.5">You can add Media for the same date, time, and room.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate("/media?linked=1")
                    }}
                    className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800"
                  >
                    Add Media
                  </button>
                </div>
              </div>
            )}

            <SectionLabel>Event Details</SectionLabel>

            {/* DATE RANGE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Start Date" required>
                <input
                  required
                  type="date"
                  min={today}
                  className={inputCls}
                  value={eventForm.start_date}
                  onChange={(e) => {
                    const val = e.target.value
                    setEventForm((prev) => ({
                      ...prev,
                      start_date: val,
                      end_date: prev.end_date < val ? val : prev.end_date,
                    }))
                    setDateError(val < today ? "Choose a present or future date." : "")
                  }}
                />
                {dateError && <p className="text-xs text-red-500 mt-1">{dateError}</p>}
              </Field>

              <Field label="End Date" required hint="Same as start date for single-day events.">
                <input
                  required
                  type="date"
                  min={eventForm.start_date || today}
                  className={inputCls}
                  value={eventForm.end_date}
                  onChange={(e) =>
                    setEventForm((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                />
              </Field>
            </div>

            {/* LOCATION + PURPOSE */}
            <Field label="Delivery Location" required>
              <input
                required
                className={inputCls}
                placeholder="E.g., Main Auditorium, KE Block"
                value={eventForm.delivery_location}
                onChange={(e) =>
                  setEventForm((prev) => ({ ...prev, delivery_location: e.target.value }))
                }
              />
            </Field>

            <Field label="Purpose of Programme" required>
              <AutoSuggestInput
                value={eventForm.purpose_of_programme}
                placeholder="E.g., Tech Symposium Guest Catering"
                suggestionsFetcher={() =>
                  messService.getSuggestions("purpose_of_programme")
                }
                onChange={(value) =>
                  setEventForm((prev) => ({
                    ...prev,
                    purpose_of_programme: value,
                  }))
                }
              />
            </Field>

            {/* ── Per-day panels ── */}
            {datesReady && dailyMenus.length > 0 && (
              <>
                <SectionLabel>
                  Daily Menus
                  {totalDays > 1 && <span className="ml-2 text-green-600 normal-case font-normal">({totalDays} days)</span>}
                </SectionLabel>

                {countdown && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${
                    countdown.expired
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}>
                    {countdown.expired ? "⚠️" : "⏳"} {countdown.message}
                  </div>
                )}

                {/* Day tabs — scrollable for many days */}
                {totalDays > 1 && (
                  <div className="relative w-full min-w-0">
                    <div className="flex gap-1 overflow-x-auto pb-2 horizontal-scrollbar">
                      {dailyMenus.map((m, i) => {
                        const hasMeal   = MEALS.some((meal) => m[meal.timeKey])
                        const isActive  = safeDayIndex === i
                        return (
                          <button
                            key={m.date}
                            type="button"
                            onClick={() => setActiveDay(i)}
                            className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                              isActive
                                ? "bg-green-600 text-white border-green-600 shadow-sm"
                                : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700"
                            }`}
                          >
                            <span>{formatTabDay(m.date, i)}</span>
                            <span className={`text-[10px] font-normal mt-0.5 ${isActive ? "text-green-200" : "text-gray-400"}`}>
                              {formatTabLabel(m.date)}
                            </span>
                            {hasMeal && !isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1" />
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Prev/Next arrows */}
                    <div className="flex justify-between mt-2">
                      <button
                        type="button"
                        disabled={safeDayIndex === 0}
                        onClick={() => setActiveDay((p) => p - 1)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-700 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={14} /> Prev Day
                      </button>
                      <button
                        type="button"
                        disabled={safeDayIndex === totalDays - 1}
                        onClick={() => setActiveDay((p) => p + 1)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-700 disabled:opacity-30 transition-all"
                      >
                        Next Day <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Active day panel */}
                <div className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
                  {totalDays > 1 && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm font-bold text-gray-900">
                        Day {safeDayIndex + 1}
                      </span>
                      <span className="text-sm text-gray-400">·</span>
                      <span className="text-sm text-gray-500">{formatTabLabel(dailyMenus[safeDayIndex]?.date)}</span>
                    </div>
                  )}

                  <DayMenuPanel
                    dayMenu={dailyMenus[safeDayIndex]}
                    onChange={(updated) => handleDayChange(safeDayIndex, updated)}
                    isFirstDay={safeDayIndex === 0}
                    onApplyToAll={handleApplyToAll}
                    totalDays={totalDays}
                  />
                </div>
              </>
            )}

            {/* Prompt when dates not yet filled */}
            {!datesReady && (
              <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
                Select a start and end date above to configure daily menus.
              </div>
            )}

          </form>

          {/* FOOTER */}
          <div className="flex justify-between items-center px-7 py-4 border-t bg-gray-50 shrink-0">
            <p className="text-xs text-gray-400">
              Submitting sends the request for admin approval.
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
                disabled={isSubmitting || isExpired || !datesReady}
                className={`px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all flex items-center gap-2 ${
                  isSubmitting || isExpired || !datesReady
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
                  editData ? "Save Changes" : "Submit Request"
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
