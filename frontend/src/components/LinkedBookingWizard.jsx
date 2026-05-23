import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  DoorOpen,
  Loader2,
  Utensils,
  X,
} from "lucide-react"
import api from "../api/axios"
import mediaApi from "../api/mediaApi"
import { MEALS, getDateRange } from "../api/messConfig"
import useWizardSubmit from "../hooks/useWizardSubmit"
import { bookingSessionActions, useBookingSession } from "../store/bookingSessionStore"
import BookingModal from "./BookingModal"
import WizardReviewScreen from "./WizardReviewScreen"
import { useAuth } from "../hooks/useAuth"

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? "-100%" : "100%",
    opacity: 0,
  }),
}

const transition = { duration: 0.28, ease: "easeInOut" }
const MotionDiv = motion.div

const labels = {
  space: "Space",
  mess: "Mess",
  media: "Media",
  review: "Review",
}

const icons = {
  space: DoorOpen,
  mess: Utensils,
  media: Clapperboard,
  review: CheckCircle2,
}

const inputCls = (error) =>
  `w-full rounded-lg border px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 ${
    error ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
  }`

function Field({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  )
}

const todayISO = () => new Date().toISOString().split("T")[0]

const currentTimeISO = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

const toLocalISO = (date, time) => {
  const [year, month, day] = date.split("-")
  const [hours, minutes] = time.split(":")
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

const sanitize = (value) => (value === null || value === undefined ? "" : value)

const normalizeTime = (time) => {
  if (!time) return null
  return time.length === 5 ? `${time}:00` : time
}

const emptyDayMenu = (date) => ({
  date,
  total_persons: "",
  veg_persons: "",
  nonveg_persons: "",
  breakfast_time: "",
  breakfast_menu: "",
  morning_tea_time: "",
  morning_snack_option: "",
  lunch_time: "",
  lunch_menu: "",
  evening_tea_time: "",
  evening_snack_option: "",
  dinner_time: "",
  dinner_menu: "",
})

const toDatetimeLocal = (date, time) => {
  if (!date || !time) return ""
  return `${date}T${time}`
}

const formatTabLabel = (dateStr) => {
  if (!dateStr) return ""
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}

const buildMealSummary = (dailyMenus) => {
  const first = dailyMenus?.[0]
  if (!first) return "No meals configured"
  const mealNames = MEALS.filter((meal) => first[meal.timeKey]).map((meal) => meal.label)
  const veg = parseInt(first.veg_persons || 0, 10)
  const nonveg = parseInt(first.nonveg_persons || 0, 10)
  return `${mealNames.join(" + ") || "No meals"} - ${veg} veg, ${nonveg} non-veg`
}

const SpaceDraftStep = forwardRef(function SpaceDraftStep(_, ref) {
  const session = useBookingSession()
  const draft = session.spaceFormData || {}
  const [departments, setDepartments] = useState([])
  const [equipment, setEquipment] = useState([])
  const [spaceCap, setSpaceCap] = useState(null)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(() => ({
    purpose: draft.purpose || "",
    department: draft.department || "",
    start_date: draft.start_date || todayISO(),
    end_date: draft.end_date || draft.start_date || todayISO(),
    start_time: draft.start_time || "",
    end_time: draft.end_time || "",
    attendees: draft.attendees || "",
    requirements: draft.requirements || [],
    notes: draft.notes || "",
    isExternal: Boolean(draft.isExternal),
    bookingType: draft.bookingType || "SINGLE",
  }))

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [deptRes, equipmentRes, spaceRes] = await Promise.all([
          api.get("/auth/departments/"),
          api.get("/spaces/inventory/?for_space=true"),
          draft.space ? api.get(`/spaces/catalog/${draft.space}/`) : Promise.resolve({ data: null }),
        ])
        if (!active) return
        setDepartments(deptRes.data.results || deptRes.data || [])
        setEquipment((equipmentRes.data.results || equipmentRes.data || []).filter((item) => item.is_active !== false))
        setSpaceCap(spaceRes.data?.capacity_hard ?? null)
      } catch (error) {
        console.error("Failed to load wizard space data:", error)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [draft.space])

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }))
  }

  const toggleRequirement = (id) => {
    setForm((current) => ({
      ...current,
      requirements: current.requirements.some((item) => String(item) === String(id))
        ? current.requirements.filter((item) => String(item) !== String(id))
        : [...current.requirements, id],
    }))
  }

  const attendeeCount = parseInt(form.attendees || 0, 10)
  const exceedsCapacity = Boolean(spaceCap && attendeeCount > spaceCap)
  const isLowOccupancy = Boolean(
    spaceCap &&
      attendeeCount > 0 &&
      attendeeCount <= spaceCap &&
      attendeeCount / spaceCap < 0.3,
  )

  const validate = () => {
    const nextErrors = {}
    const endDate = form.end_date || form.start_date

    if (!draft.space) nextErrors.space = "Choose a venue before continuing."
    if (!form.start_date) nextErrors.start_date = "Select a date."
    if (!form.start_time) nextErrors.start_time = "Select a start time."
    if (!form.end_time) nextErrors.end_time = "Select an end time."
    if (form.start_date === todayISO() && form.start_time && form.start_time < currentTimeISO()) {
      nextErrors.start_time = "Cannot select a past time."
    }
    if (endDate < form.start_date) nextErrors.end_date = "End date cannot be before start date."
    if (form.end_time && form.start_time && endDate === form.start_date && form.end_time <= form.start_time) {
      nextErrors.end_time = "End time must be after start time."
    }
    if (!form.purpose.trim()) nextErrors.purpose = "Please describe the purpose."
    if (!form.department) nextErrors.department = "Select your department."
    if (!form.attendees || Number(form.attendees) < 1) nextErrors.attendees = "Enter a valid number."
    if (exceedsCapacity) nextErrors.attendees = `Capacity exceeded. Maximum allowed is ${spaceCap}.`
    if (isLowOccupancy && !form.notes.trim()) {
      nextErrors.notes = "Please explain why this venue is needed for a small group."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  useImperativeHandle(ref, () => ({
    submit() {
      if (!validate()) return false

      const endDate = form.end_date || form.start_date
      const start_datetime = toLocalISO(form.start_date, form.start_time)
      const end_datetime = toLocalISO(endDate, form.end_time)
      const selectedEquipment = equipment
        .filter((item) => form.requirements.some((id) => String(id) === String(item.id)))
        .map((item) => item.name)

      const payload = {
        space: draft.space,
        start_datetime,
        end_datetime,
        booking_type: form.start_date !== endDate ? form.bookingType : "SINGLE",
        attendee_count: Number(form.attendees),
        purpose_of_booking_input: form.purpose,
        department: Number(form.department),
        user_notes: form.notes.trim() || "",
        equipment_requests: form.requirements.map((id) => ({
          equipment: Number(id),
          quantity: 1,
        })),
        is_external: form.isExternal,
      }

      bookingSessionActions.setSpaceFormData({
        ...draft,
        ...form,
        end_date: endDate,
        start_datetime,
        end_datetime,
        event_group_id: session.eventGroupId,
        equipmentSummary: selectedEquipment.length ? selectedEquipment.join(", ") : "None selected",
        payload,
      })
      return true
    },
  }))

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-green-700">Space</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-950">Confirm venue details</h2>
        <p className="mt-2 text-sm text-gray-500">
          The linked services use this venue, schedule, and event group.
        </p>
      </div>

      {errors.space && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errors.space}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <Field label="Venue">
          <input className={inputCls()} value={draft.spaceName || "Selected venue"} disabled />
        </Field>
        <Field label="Expected attendees" required error={errors.attendees}>
          <input
            type="number"
            min="1"
            max={spaceCap || undefined}
            className={inputCls(errors.attendees)}
            value={form.attendees}
            onChange={(event) => set("attendees", event.target.value)}
          />
        </Field>
        <Field label="Start date" required error={errors.start_date}>
          <input
            type="date"
            min={todayISO()}
            className={inputCls(errors.start_date)}
            value={form.start_date}
            onChange={(event) => set("start_date", event.target.value)}
          />
        </Field>
        <Field label="End date" error={errors.end_date}>
          <input
            type="date"
            min={form.start_date || todayISO()}
            className={inputCls(errors.end_date)}
            value={form.end_date}
            onChange={(event) => set("end_date", event.target.value)}
          />
        </Field>
        <Field label="Start time" required error={errors.start_time}>
          <input
            type="time"
            className={inputCls(errors.start_time)}
            value={form.start_time}
            onChange={(event) => set("start_time", event.target.value)}
          />
        </Field>
        <Field label="End time" required error={errors.end_time}>
          <input
            type="time"
            className={inputCls(errors.end_time)}
            value={form.end_time}
            onChange={(event) => set("end_time", event.target.value)}
          />
        </Field>
        <Field label="Purpose" required error={errors.purpose}>
          <input
            className={inputCls(errors.purpose)}
            value={form.purpose}
            onChange={(event) => set("purpose", event.target.value)}
            placeholder="Event purpose"
          />
        </Field>
        <Field label="Department" required error={errors.department}>
          <select
            className={inputCls(errors.department)}
            value={form.department}
            onChange={(event) => set("department", event.target.value)}
          >
            <option value="">Select department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.department_name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isLowOccupancy && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This is a low-occupancy booking for the selected venue. Add a short note for reviewers.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <SectionLabel>Equipment</SectionLabel>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((item) => {
            const active = form.requirements.some((id) => String(id) === String(item.id))
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleRequirement(item.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "border-green-600 bg-green-50 text-green-800"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    active ? "border-green-700 bg-green-700" : "border-gray-300"
                  }`}
                >
                  {active && <Check className="h-3 w-3 text-white" />}
                </span>
                {item.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <Field label="Notes" error={errors.notes} hint="Mention setup, seating, or low-occupancy context.">
          <textarea
            rows={3}
            className={`${inputCls(errors.notes)} resize-none`}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </Field>
        <label className="mt-4 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-gray-800">External event</span>
            <span className="text-xs text-gray-500">Flag for priority admin review.</span>
          </span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
            checked={form.isExternal}
            onChange={(event) => set("isExternal", event.target.checked)}
          />
        </label>
      </div>
    </div>
  )
})

function DayMenuPanel({ dayMenu, onChange }) {
  const enabledSet = new Set(dayMenu._enabledMeals || [])
  const total = parseInt(dayMenu.total_persons || 0, 10)
  const veg = parseInt(dayMenu.veg_persons || 0, 10)
  const nonveg = parseInt(dayMenu.nonveg_persons || 0, 10)
  const remaining = total - veg - nonveg

  return (
    <div className="space-y-5">
      <SectionLabel>Headcount</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Total" required>
          <input
            type="number"
            min="1"
            className={inputCls()}
            value={dayMenu.total_persons}
            onChange={(event) => {
              const nextTotal = parseInt(event.target.value || 0, 10)
              const nextVeg = parseInt(dayMenu.veg_persons || 0, 10)
              onChange({
                ...dayMenu,
                total_persons: event.target.value,
                nonveg_persons: nextTotal >= nextVeg ? String(nextTotal - nextVeg) : dayMenu.nonveg_persons,
              })
            }}
          />
        </Field>
        <Field label="Veg" required>
          <input
            type="number"
            min="0"
            className={inputCls()}
            value={dayMenu.veg_persons}
            onChange={(event) => {
              const nextVeg = parseInt(event.target.value || 0, 10)
              if (nextVeg > total) return
              onChange({
                ...dayMenu,
                veg_persons: String(nextVeg),
                nonveg_persons: String(Math.max(0, total - nextVeg)),
              })
            }}
          />
        </Field>
        <Field label="Non-veg" required>
          <input
            type="number"
            min="0"
            className={inputCls()}
            value={dayMenu.nonveg_persons}
            onChange={(event) => {
              const nextNonVeg = parseInt(event.target.value || 0, 10)
              if (veg + nextNonVeg > total) return
              onChange({ ...dayMenu, nonveg_persons: String(nextNonVeg) })
            }}
          />
        </Field>
      </div>
      {total > 0 && (
        <p className={`text-sm font-semibold ${remaining === 0 ? "text-green-700" : "text-amber-600"}`}>
          Remaining allocation: {remaining}
        </p>
      )}

      <SectionLabel>Meals</SectionLabel>
      <div className="space-y-3">
        {MEALS.map((meal) => {
          const isOn = enabledSet.has(meal.id) || Boolean(dayMenu[meal.timeKey])
          return (
            <div
              key={meal.id}
              className={`rounded-lg border p-4 transition ${
                isOn ? "border-green-200 bg-green-50/50" : "border-gray-100 bg-gray-50"
              }`}
            >
              <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
                  checked={isOn}
                  onChange={(event) => {
                    const next = new Set(enabledSet)
                    if (event.target.checked) {
                      next.add(meal.id)
                      onChange({ ...dayMenu, _enabledMeals: [...next] })
                    } else {
                      next.delete(meal.id)
                      onChange({
                        ...dayMenu,
                        _enabledMeals: [...next],
                        [meal.timeKey]: "",
                        [meal.menuKey]: "",
                      })
                    }
                  }}
                />
                {meal.label}
              </label>
              {isOn && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <input
                    type="time"
                    className={inputCls()}
                    value={dayMenu[meal.timeKey]}
                    onChange={(event) => onChange({ ...dayMenu, [meal.timeKey]: event.target.value })}
                  />
                  <input
                    className={inputCls()}
                    placeholder={meal.menuPlaceholder}
                    value={dayMenu[meal.menuKey]}
                    onChange={(event) => onChange({ ...dayMenu, [meal.menuKey]: event.target.value })}
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

const MessDraftStep = forwardRef(function MessDraftStep({ mediaInSequence, onAddMedia }, ref) {
  const session = useBookingSession()
  const linkedSpace = session.spaceFormData || {}
  const draft = session.messFormData || {}
  const [eventForm, setEventForm] = useState(() => ({
    purpose_of_programme: sanitize(draft.eventForm?.purpose_of_programme ?? linkedSpace.purpose),
    start_date: sanitize(draft.eventForm?.start_date ?? linkedSpace.start_date),
    end_date: sanitize(draft.eventForm?.end_date ?? linkedSpace.end_date ?? linkedSpace.start_date),
    delivery_location: sanitize(draft.eventForm?.delivery_location ?? linkedSpace.spaceName),
    user_notes: sanitize(draft.eventForm?.user_notes),
  }))
  const [menuOverrides, setMenuOverrides] = useState(() => draft.menuOverrides || {})
  const [activeDay, setActiveDay] = useState(0)
  const [error, setError] = useState("")

  const dailyMenus = useMemo(() => {
    if (!eventForm.start_date || !eventForm.end_date || eventForm.end_date < eventForm.start_date) return []
    return getDateRange(eventForm.start_date, eventForm.end_date).map(
      (date) => menuOverrides[date] || emptyDayMenu(date),
    )
  }, [eventForm.start_date, eventForm.end_date, menuOverrides])

  const safeDayIndex = Math.min(activeDay, Math.max(0, dailyMenus.length - 1))

  const validate = () => {
    if (!eventForm.purpose_of_programme.trim()) return "Please provide the purpose of programme."
    if (!eventForm.start_date) return "Please select a start date."
    if (!eventForm.end_date) return "Please select an end date."
    if (eventForm.end_date < eventForm.start_date) return "End date must be on or after start date."
    if (!eventForm.delivery_location.trim()) return "Please provide a delivery location."
    if (dailyMenus.length === 0) return "Date range produced no days."

    for (let index = 0; index < dailyMenus.length; index += 1) {
      const menu = dailyMenus[index]
      const label = `Day ${index + 1} (${menu.date})`
      const total = parseInt(menu.total_persons || 0, 10)
      const veg = parseInt(menu.veg_persons || 0, 10)
      const nonveg = parseInt(menu.nonveg_persons || 0, 10)

      if (total <= 0) return `${label}: Total persons must be greater than zero.`
      if (veg + nonveg !== total) return `${label}: Veg + non-veg must equal total.`

      const selectedMeals = MEALS.filter((meal) => menu[meal.timeKey])
      if (selectedMeals.length === 0) return `${label}: At least one meal must be selected.`

      for (const meal of selectedMeals) {
        if (!String(menu[meal.menuKey] || "").trim()) {
          return `${label}: Please fill in the ${meal.menuLabel} for ${meal.label}.`
        }
      }
    }

    const allDateTimes = []
    for (const menu of dailyMenus) {
      for (const meal of MEALS) {
        if (menu[meal.timeKey]) allDateTimes.push(new Date(`${menu.date}T${menu[meal.timeKey]}`))
      }
    }
    if (allDateTimes.length > 0) {
      const earliest = new Date(Math.min(...allDateTimes))
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000)
      if (earliest < deadline) {
        return "Mess bookings require strictly 24 hours notice before the first meal."
      }
    }

    return ""
  }

  useImperativeHandle(ref, () => ({
    submit() {
      const validationError = validate()
      if (validationError) {
        setError(validationError)
        return false
      }
      setError("")

      const daily_menus = dailyMenus.map((dayMenu) => {
        const menu = { ...dayMenu }
        delete menu._enabledMeals

        return {
          date: menu.date,
          total_persons: parseInt(menu.total_persons, 10),
          veg_persons: parseInt(menu.veg_persons, 10),
          nonveg_persons: parseInt(menu.nonveg_persons, 10),
          ...Object.fromEntries(
            MEALS.flatMap((meal) => [
              [meal.timeKey, normalizeTime(menu[meal.timeKey]) || null],
              [meal.menuKey, menu[meal.timeKey] ? menu[meal.menuKey] : null],
            ]),
          ),
        }
      })

      const payload = {
        purpose_of_programme: eventForm.purpose_of_programme,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date,
        delivery_location: eventForm.delivery_location,
        user_notes: eventForm.user_notes || "",
        daily_menus,
      }

      bookingSessionActions.setMessFormData({
        eventForm,
        menuOverrides,
        dailyMenus,
        mealSummary: buildMealSummary(dailyMenus),
        payload,
      })
      return true
    },
  }))

  const handleDayChange = (updated) => {
    setMenuOverrides((current) => ({ ...current, [updated.date]: updated }))
    setError("")
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-green-700">Mess</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-950">Add catering details</h2>
        <p className="mt-2 text-sm text-gray-500">
          Configure headcount and meals for each day in the linked event.
        </p>
      </div>

      {!mediaInSequence && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-900">Need Media for the same event?</p>
            <p className="mt-1 text-xs font-medium text-amber-800">
              Add a Media step after Mess and review everything together.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddMedia}
            className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
          >
            Add Media
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <Field label="Start date" required>
          <input
            type="date"
            min={todayISO()}
            className={inputCls()}
            value={eventForm.start_date}
            onChange={(event) =>
              setEventForm((current) => ({
                ...current,
                start_date: event.target.value,
                end_date: current.end_date < event.target.value ? event.target.value : current.end_date,
              }))
            }
          />
        </Field>
        <Field label="End date" required>
          <input
            type="date"
            min={eventForm.start_date || todayISO()}
            className={inputCls()}
            value={eventForm.end_date}
            onChange={(event) => setEventForm((current) => ({ ...current, end_date: event.target.value }))}
          />
        </Field>
        <Field label="Delivery location" required>
          <input
            className={inputCls()}
            value={eventForm.delivery_location}
            onChange={(event) => setEventForm((current) => ({ ...current, delivery_location: event.target.value }))}
          />
        </Field>
        <Field label="Purpose of programme" required>
          <input
            className={inputCls()}
            value={eventForm.purpose_of_programme}
            onChange={(event) => setEventForm((current) => ({ ...current, purpose_of_programme: event.target.value }))}
          />
        </Field>
      </div>

      {dailyMenus.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dailyMenus.map((menu, index) => (
            <button
              key={menu.date}
              type="button"
              onClick={() => setActiveDay(index)}
              className={`shrink-0 rounded-lg border px-4 py-2 text-left text-xs font-bold transition ${
                safeDayIndex === index
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Day {index + 1}
              <span className="ml-2 font-medium opacity-80">{formatTabLabel(menu.date)}</span>
            </button>
          ))}
        </div>
      )}

      {dailyMenus.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <DayMenuPanel dayMenu={dailyMenus[safeDayIndex]} onChange={handleDayChange} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm font-medium text-gray-500">
          Select a valid date range to configure menus.
        </div>
      )}
    </div>
  )
})

const MediaDraftStep = forwardRef(function MediaDraftStep(_, ref) {
  const session = useBookingSession()
  const linkedSpace = session.spaceFormData || {}
  const draft = session.mediaFormData || {}
  const [spaces, setSpaces] = useState([])
  const [requestMode, setRequestMode] = useState(draft.requestMode || session.mediaRequestMode || "team")
  const [needsBuffer, setNeedsBuffer] = useState(Boolean(draft.needsBuffer))
  const [formData, setFormData] = useState(() => ({
    event_name: draft.formData?.event_name || linkedSpace.purpose || "",
    space: draft.formData?.space || linkedSpace.space || "",
    event_start_datetime:
      draft.formData?.event_start_datetime ||
      toDatetimeLocal(linkedSpace.start_date, linkedSpace.start_time),
    event_end_datetime:
      draft.formData?.event_end_datetime ||
      toDatetimeLocal(linkedSpace.end_date || linkedSpace.start_date, linkedSpace.end_time),
    setup_start_datetime:
      draft.formData?.setup_start_datetime ||
      toDatetimeLocal(linkedSpace.start_date, linkedSpace.start_time),
    teardown_end_datetime:
      draft.formData?.teardown_end_datetime ||
      toDatetimeLocal(linkedSpace.end_date || linkedSpace.start_date, linkedSpace.end_time),
    requested_services: draft.formData?.requested_services || "Media team coverage",
    user_notes: draft.formData?.user_notes || "",
    is_external_event: Boolean(draft.formData?.is_external_event || linkedSpace.isExternal),
  }))
  const [equipmentRequests, setEquipmentRequests] = useState(draft.equipmentRequests || [])
  const [availableEquipment, setAvailableEquipment] = useState([])
  const [checkingInventory, setCheckingInventory] = useState(false)
  const [errors, setErrors] = useState({})

  const isTeamRequest = requestMode === "team"
  const actualSetup = needsBuffer && formData.setup_start_datetime ? formData.setup_start_datetime : formData.event_start_datetime
  const actualTeardown = needsBuffer && formData.teardown_end_datetime ? formData.teardown_end_datetime : formData.event_end_datetime

  useEffect(() => {
    let active = true
    mediaApi
      .getSpaces()
      .then((data) => {
        if (active) setSpaces(data)
      })
      .catch((error) => console.error("Could not load spaces:", error))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (isTeamRequest || !formData.event_start_datetime || !formData.event_end_datetime) {
      const resetTimer = window.setTimeout(() => setAvailableEquipment([]), 0)
      return () => window.clearTimeout(resetTimer)
    }

    const setupDate = new Date(actualSetup)
    const startDate = new Date(formData.event_start_datetime)
    const endDate = new Date(formData.event_end_datetime)
    const teardownDate = new Date(actualTeardown)

    if (!(setupDate <= startDate && startDate < endDate && endDate <= teardownDate)) {
      const resetTimer = window.setTimeout(() => setAvailableEquipment([]), 0)
      return () => window.clearTimeout(resetTimer)
    }

    let active = true
    const timer = window.setTimeout(async () => {
      setCheckingInventory(true)
      try {
        const data = await mediaApi.checkAvailability(
          new Date(actualSetup).toISOString(),
          new Date(actualTeardown).toISOString(),
        )
        if (active) setAvailableEquipment(data)
      } catch (error) {
        console.error("Inventory check failed:", error)
      } finally {
        if (active) setCheckingInventory(false)
      }
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [
    actualSetup,
    actualTeardown,
    formData.event_end_datetime,
    formData.event_start_datetime,
    isTeamRequest,
  ])

  const groupedEquipment = useMemo(
    () =>
      availableEquipment.reduce((groups, item) => {
        const category = item.category_display || item.category || "Equipment"
        return {
          ...groups,
          [category]: [...(groups[category] || []), item],
        }
      }, {}),
    [availableEquipment],
  )

  const setField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: "" }))
  }

  const addEquipmentRow = () => {
    setEquipmentRequests((current) => [...current, { equipment: "", quantity: 1 }])
  }

  const updateEquipmentRow = (index, field, value) => {
    setEquipmentRequests((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        if (field === "quantity") return { ...row, quantity: Math.max(1, parseInt(value || 1, 10)) }
        return { ...row, [field]: value, ...(field === "equipment" ? { quantity: 1 } : {}) }
      }),
    )
  }

  const removeEquipmentRow = (index) => {
    setEquipmentRequests((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formData.event_name.trim()) nextErrors.event_name = "Required"
    if (!formData.space) nextErrors.space = "Required"
    if (!formData.event_start_datetime) nextErrors.event_start_datetime = "Required"
    if (!formData.event_end_datetime) nextErrors.event_end_datetime = "Required"

    const startDate = formData.event_start_datetime ? new Date(formData.event_start_datetime) : null
    const endDate = formData.event_end_datetime ? new Date(formData.event_end_datetime) : null
    const setupDate = actualSetup ? new Date(actualSetup) : null
    const teardownDate = actualTeardown ? new Date(actualTeardown) : null

    if (startDate && endDate && startDate >= endDate) {
      nextErrors.event_end_datetime = "Must be after start time"
      nextErrors.timeError = "Event end must be after event start."
    }
    if (needsBuffer && !formData.setup_start_datetime) nextErrors.setup_start_datetime = "Required"
    if (needsBuffer && !formData.teardown_end_datetime) nextErrors.teardown_end_datetime = "Required"
    if (setupDate && startDate && setupDate > startDate) {
      nextErrors.setup_start_datetime = "Must be before event starts"
      nextErrors.timeError = "Setup time cannot start after the event begins."
    }
    if (teardownDate && endDate && teardownDate < endDate) {
      nextErrors.teardown_end_datetime = "Must be after event ends"
      nextErrors.timeError = "Teardown time cannot end before the event ends."
    }
    if (setupDate && setupDate < new Date()) {
      nextErrors.timeError = "You cannot select a time block that has already passed."
    }

    if (!isTeamRequest) {
      equipmentRequests.forEach((row, index) => {
        if (!row.equipment) {
          nextErrors[`eq_${index}`] = "Select item"
          return
        }
        const inventoryItem = availableEquipment.find((item) => String(item.id) === String(row.equipment))
        if (inventoryItem && Number(row.quantity) > inventoryItem.currently_available) {
          nextErrors[`qty_${index}`] = `Only ${inventoryItem.currently_available} available`
          nextErrors.timeError = nextErrors.timeError || `Not enough stock for ${inventoryItem.name}.`
        }
      })
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  useImperativeHandle(ref, () => ({
    submit() {
      if (!validate()) return false

      const payload = {
        event_name: formData.event_name,
        space: formData.space,
        event_start_datetime: new Date(formData.event_start_datetime).toISOString(),
        event_end_datetime: new Date(formData.event_end_datetime).toISOString(),
        setup_start_datetime: new Date(actualSetup).toISOString(),
        teardown_end_datetime: new Date(actualTeardown).toISOString(),
        is_team_request: isTeamRequest,
        is_external_event: formData.is_external_event,
        requested_services: isTeamRequest ? "Media team coverage" : formData.requested_services,
        user_notes: formData.user_notes,
      }

      if (!isTeamRequest) {
        payload.equipment_requests = equipmentRequests
          .filter((row) => row.equipment)
          .map((row) => ({
            equipment: parseInt(row.equipment, 10),
            quantity: parseInt(row.quantity, 10),
          }))
      }

      const selectedSpace = spaces.find((space) => String(space.id) === String(formData.space))
      const selectedEquipment = equipmentRequests
        .map((row) => {
          const item = availableEquipment.find((equipment) => String(equipment.id) === String(row.equipment))
          return item ? `${row.quantity}x ${item.name}` : null
        })
        .filter(Boolean)

      bookingSessionActions.setMediaFormData({
        formData,
        equipmentRequests,
        requestMode,
        needsBuffer,
        payload,
        spaceName: selectedSpace?.name || linkedSpace.spaceName || "Selected venue",
        requestSummary: isTeamRequest ? "Media team coverage" : selectedEquipment.join(", ") || "Equipment request",
      })
      bookingSessionActions.setMediaRequestMode(requestMode)
      return true
    },
  }))

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-green-700">Media</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-950">Add media support</h2>
        <p className="mt-2 text-sm text-gray-500">
          Request team coverage or borrow media equipment for the linked event.
        </p>
      </div>

      {errors.timeError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {errors.timeError}
        </div>
      )}

      {session.mediaCapacity?.limited_capacity && isTeamRequest && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Media team has limited capacity for this slot.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1">
          {[
            { id: "team", label: "Media Team", icon: Clapperboard },
            { id: "equipment", label: "Equipment", icon: DoorOpen },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRequestMode(item.id)
                  if (item.id === "team") setEquipmentRequests([])
                }}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${
                  requestMode === item.id ? "bg-green-700 text-white" : "text-gray-600 hover:bg-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event starts" required error={errors.event_start_datetime}>
            <input
              type="datetime-local"
              className={inputCls(errors.event_start_datetime)}
              value={formData.event_start_datetime}
              onChange={(event) => setField("event_start_datetime", event.target.value)}
            />
          </Field>
          <Field label="Event ends" required error={errors.event_end_datetime}>
            <input
              type="datetime-local"
              className={inputCls(errors.event_end_datetime)}
              value={formData.event_end_datetime}
              onChange={(event) => setField("event_end_datetime", event.target.value)}
            />
          </Field>
        </div>

        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
            checked={needsBuffer}
            onChange={(event) => setNeedsBuffer(event.target.checked)}
          />
          Add extra prep and pack-up time
        </label>

        {needsBuffer && (
          <div className="mt-4 grid gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 md:grid-cols-2">
            <Field label="Setup starts" required error={errors.setup_start_datetime}>
              <input
                type="datetime-local"
                className={inputCls(errors.setup_start_datetime)}
                value={formData.setup_start_datetime}
                onChange={(event) => setField("setup_start_datetime", event.target.value)}
              />
            </Field>
            <Field label="Teardown ends" required error={errors.teardown_end_datetime}>
              <input
                type="datetime-local"
                className={inputCls(errors.teardown_end_datetime)}
                value={formData.teardown_end_datetime}
                onChange={(event) => setField("teardown_end_datetime", event.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      {!isTeamRequest && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <SectionLabel>Equipment</SectionLabel>
            {checkingInventory && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking
              </span>
            )}
          </div>

          {availableEquipment.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm font-medium text-gray-500">
              Set a valid time window to load the gear catalog.
            </div>
          ) : (
            <div className="space-y-3">
              {equipmentRequests.map((row, index) => {
                const selected = availableEquipment.find((item) => String(item.id) === String(row.equipment))
                return (
                  <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                    <div>
                      <select
                        className={inputCls(errors[`eq_${index}`])}
                        value={row.equipment}
                        onChange={(event) => updateEquipmentRow(index, "equipment", event.target.value)}
                      >
                        <option value="">Select item</option>
                        {Object.entries(groupedEquipment).map(([category, items]) => (
                          <optgroup key={category} label={category}>
                            {items.map((item) => (
                              <option key={item.id} value={item.id} disabled={item.currently_available === 0}>
                                {item.name} ({item.currently_available} available)
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {errors[`eq_${index}`] && (
                        <p className="mt-1 text-xs font-medium text-red-600">{errors[`eq_${index}`]}</p>
                      )}
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        max={selected?.currently_available || undefined}
                        className={inputCls(errors[`qty_${index}`])}
                        value={row.quantity}
                        onChange={(event) => updateEquipmentRow(index, "quantity", event.target.value)}
                      />
                      {errors[`qty_${index}`] && (
                        <p className="mt-1 text-xs font-medium text-red-600">{errors[`qty_${index}`]}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEquipmentRow(index)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={addEquipmentRow}
                className="rounded-lg border border-green-200 px-3 py-2 text-sm font-bold text-green-700 transition hover:bg-green-50"
              >
                Add Equipment
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <Field label="Event name" required error={errors.event_name}>
          <input
            className={inputCls(errors.event_name)}
            value={formData.event_name}
            onChange={(event) => setField("event_name", event.target.value)}
          />
        </Field>
        <Field label="Location" required error={errors.space}>
          <select
            className={inputCls(errors.space)}
            value={formData.space}
            onChange={(event) => setField("space", event.target.value)}
          >
            <option value="">Select location</option>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </Field>
        {!isTeamRequest && (
          <Field label="Human resources" hint="Optional support request for media staff.">
            <input
              className={inputCls()}
              value={formData.requested_services}
              onChange={(event) => setField("requested_services", event.target.value)}
              placeholder="E.g. 2 photographers"
            />
          </Field>
        )}
        <Field label="Notes">
          <textarea
            rows={3}
            className={`${inputCls()} resize-none`}
            value={formData.user_notes}
            onChange={(event) => setField("user_notes", event.target.value)}
          />
        </Field>
      </div>
    </div>
  )
})

function StepIndicator({ sequence, activeStep, statuses }) {
  const currentIndex = sequence.indexOf(activeStep)

  return (
    <div className="flex min-w-0 items-center justify-center gap-1 overflow-x-auto px-2">
      {sequence.map((step, index) => {
        const Icon = icons[step]
        const complete = index < currentIndex || statuses[step] === "success"
        const current = step === activeStep

        return (
          <div key={step} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                complete
                  ? "bg-green-50 text-green-700"
                  : current
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {labels[step]}
            </span>
            {index < sequence.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        )
      })}
    </div>
  )
}

function SuccessScreen({ onDone }) {
  return (
    <div className="flex h-full items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-950">Linked booking submitted</h1>
        <button
          type="button"
          onClick={onDone}
          className="mt-7 w-full rounded-lg bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800"
        >
          Done
        </button>
      </div>
    </div>
  )
}

const buildSpaceError = (draft) => {
  const endDate = draft.end_date || draft.start_date

  if (!draft.space) return "Choose a venue before continuing."
  if (!draft.start_date) return "Select a start date."
  if (!draft.start_time) return "Select a start time."
  if (!draft.end_time) return "Select an end time."
  if (endDate < draft.start_date) return "End date cannot be before start date."
  if (endDate === draft.start_date && draft.end_time <= draft.start_time) {
    return "End time must be after start time."
  }
  if (!String(draft.purpose || "").trim()) return "Please describe the purpose."
  if (!draft.department) return "Select your department."
  if (!draft.attendees || Number(draft.attendees) < 1) return "Enter a valid attendee count."
  return ""
}

function LinkedBookingWizard() {
  const session = useBookingSession()
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const stepRef = useRef(null)
  const [activeStep, setActiveStep] = useState(null)
  const [direction, setDirection] = useState(1)
  const [returnToReview, setReturnToReview] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [spaceError, setSpaceError] = useState("")
  const { submit, submitting, errors, retry, statuses } = useWizardSubmit()

  useEffect(() => {
    if (!isLoading && !user && session.wizardActive) {
      bookingSessionActions.clearSession()
    }
  }, [isLoading, user, session.wizardActive])

  const sequence = useMemo(
    () => (session.wizardSequence?.length ? session.wizardSequence : ["space", "review"]),
    [session.wizardSequence],
  )

  const spaceDraft = session.spaceFormData || {}
  const spaceDraftReady = useMemo(() => !buildSpaceError(spaceDraft), [spaceDraft])

  useEffect(() => {
    if (!session.wizardActive) return
    const start = session.wizardInitialStep || sequence[0]
    const timer = window.setTimeout(() => {
      setActiveStep((current) => (current && sequence.includes(current) ? current : start))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [sequence, session.wizardActive, session.wizardInitialStep])

  useEffect(() => {
    if (session.wizardActive) return
    setActiveStep(null)
    setReturnToReview(false)
    setSpaceError("")
  }, [session.wizardActive])

  const goToStep = useCallback((step, nextDirection = 1) => {
    setDirection(nextDirection)
    setActiveStep(step)
  }, [])

  const addServiceToFlow = useCallback((service) => {
    if (sequence.includes(service)) return
    const withoutReview = sequence.filter((step) => step !== "review")
    const nextSequence = [...withoutReview, service, "review"]
    bookingSessionActions.setWizardSequence(nextSequence)
  }, [sequence])

  const closeToOrigin = useCallback((clear = false) => {
    const origin = session.wizardOrigin || "/dashboard"
    if (clear) bookingSessionActions.clearSession()
    else bookingSessionActions.closeWizard()
    navigate(origin)
  }, [navigate, session.wizardOrigin])

  const saveSpaceDraft = useCallback(() => {
    const draft = session.spaceFormData || {}
    const validationError = buildSpaceError(draft)
    if (validationError) {
      setSpaceError(validationError)
      return false
    }

    const endDate = draft.end_date || draft.start_date
    const start_datetime = draft.start_datetime || toLocalISO(draft.start_date, draft.start_time)
    const end_datetime = draft.end_datetime || toLocalISO(endDate, draft.end_time)
    const requirements = draft.requirements || []

    const payload = {
      space: draft.space,
      start_datetime,
      end_datetime,
      booking_type: draft.start_date !== endDate ? draft.bookingType : "SINGLE",
      attendee_count: Number(draft.attendees),
      purpose_of_booking_input: draft.purpose,
      department: Number(draft.department),
      user_notes: String(draft.notes || "").trim(),
      equipment_requests: requirements.map((id) => ({
        equipment: Number(id),
        quantity: 1,
      })),
      is_external: Boolean(draft.isExternal),
    }

    bookingSessionActions.setSpaceFormData({
      ...draft,
      end_date: endDate,
      start_datetime,
      end_datetime,
      event_group_id: session.eventGroupId,
      equipmentSummary: draft.equipmentSummary || (requirements.length ? `${requirements.length} selected` : "None selected"),
      payload,
    })
    setSpaceError("")
    return true
  }, [session.eventGroupId, session.spaceFormData])

  const handleBack = () => {
    if (!activeStep) return
    if (activeStep === "space") {
      closeToOrigin(false)
      return
    }

    const currentIndex = sequence.indexOf(activeStep)
    const previousStep = sequence[Math.max(0, currentIndex - 1)]
    goToStep(previousStep, -1)
  }

  const handleNext = async () => {
    if (!activeStep) return

    if (activeStep === "review") {
      await submit()
      return
    }

    const ok = activeStep === "space" ? saveSpaceDraft() : await stepRef.current?.submit?.()
    if (!ok) return

    if (returnToReview) {
      setReturnToReview(false)
      goToStep("review", 1)
      return
    }

    const currentIndex = sequence.indexOf(activeStep)
    goToStep(sequence[currentIndex + 1] || "review", 1)
  }

  const handleEdit = (step) => {
    setReturnToReview(true)
    goToStep(step, -1)
  }

  const handleDone = () => {
    const origin = session.wizardOrigin || "/dashboard"
    bookingSessionActions.clearSession()
    navigate(origin)
  }

  const isReview = activeStep === "review"
  const nextLabel = isReview ? "Confirm and Submit" : returnToReview ? "Save and Review" : "Next"
  const hasSubmittedSpace = Boolean(session.submittedBookings?.space)
  const nextDisabled = submitting || (activeStep === "space" && !spaceDraftReady)

  return (
    <AnimatePresence>
      {session.wizardActive && user && (
        <MotionDiv
          key={session.wizardSuccess ? "wizard-success" : "linked-booking-wizard"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex flex-col bg-white"
        >
          {session.wizardSuccess ? (
            <SuccessScreen onDone={handleDone} />
          ) : activeStep ? (
            <>
              <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 disabled:opacity-40"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <StepIndicator sequence={sequence} activeStep={activeStep} statuses={statuses} />
                <button
                  type="button"
                  onClick={() => setShowCancel(true)}
                  disabled={submitting}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-40"
                >
                  Cancel
                </button>
              </header>

              <main className="relative flex-1 overflow-hidden bg-gray-50">
                <AnimatePresence mode="wait" custom={direction}>
                  <MotionDiv
                    key={activeStep}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={transition}
                    className="absolute inset-0 overflow-y-auto px-4 py-6 sm:px-6"
                  >
                    {activeStep === "space" && (
                      <div className="h-full min-h-0">
                        {spaceError && (
                          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {spaceError}
                          </div>
                        )}
                        <BookingModal
                          wizardMode={true}
                          onWizardNext={handleNext}
                          spaceId={spaceDraft.space}
                          spaceName={spaceDraft.spaceName || spaceDraft.location}
                          spaceCap={spaceDraft.spaceCap || spaceDraft.capacity || null}
                          onClose={() => {}}
                        />
                      </div>
                    )}
                    {activeStep === "mess" && (
                      <MessDraftStep
                        ref={stepRef}
                        mediaInSequence={sequence.includes("media")}
                        onAddMedia={() => addServiceToFlow("media")}
                      />
                    )}
                    {activeStep === "media" && <MediaDraftStep ref={stepRef} />}
                    {activeStep === "review" && (
                      <WizardReviewScreen
                        session={session}
                        statuses={statuses}
                        errors={errors}
                        onEdit={handleEdit}
                        onRetry={retry}
                      />
                    )}
                  </MotionDiv>
                </AnimatePresence>
              </main>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={nextDisabled}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {nextLabel}
                </button>
              </footer>

              {showCancel && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
                  <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
                    <h2 className="text-lg font-bold text-gray-950">Cancel booking?</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      {hasSubmittedSpace
                        ? "Your Space booking was already submitted. Cancelling here will not remove it. You can cancel it from My Bookings."
                        : "All progress will be lost."}
                    </p>
                    <div className="mt-6 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCancel(false)}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                      >
                        Keep Going
                      </button>
                      <button
                        type="button"
                        onClick={() => closeToOrigin(!hasSubmittedSpace)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
                      >
                        Yes, Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}

export default LinkedBookingWizard
