import React, { useState, useEffect, useMemo } from "react"
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import MainLayout from "../layouts/MainLayout"
import MessBookingForm from "../components/MessBookingForm"
import MessMyRequests from "../components/MessMyRequests"
import { getSubmissionTimestamp } from "../utils/submissionTime"
import toast from 'react-hot-toast'
import { useMyMessBookings, useCancelMessBooking } from "../hooks/useMessQueries"

import {
  MEALS,
  getEarliestTime,
  getRequestedMeals,
  getTotalPersons,
  getTotalVeg,
  getTotalNonVeg,
  formatDateRange,
  isMultiDay,
} from "../api/messConfig"

import {
  Pencil, Trash2, Users, Clock3, X,
  ChevronRight, AlertCircle, CalendarDays, Layers, Plus,
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const todayStr = formatDate(new Date())
const normaliseReference = (value) => String(value || "").trim().toUpperCase()

const timeAgo = (isoString) => {
  if (!isoString) return ""
  const mins = Math.max(0, Math.round((Date.now() - new Date(isoString)) / 60000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`
}

const formatShortDate = (dateStr) => {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`
}

// ── Status System ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  APPROVED: {
    badge: "bg-green-100 text-green-700",
    card:  "bg-green-50 border-green-100 text-green-700",
  },
  PENDING: {
    badge: "bg-yellow-100 text-yellow-700",
    card:  "bg-yellow-50 border-yellow-100 text-yellow-700",
  },
  COMPLETED: {
    badge: "bg-blue-100 text-blue-700",
    card:  "bg-blue-50 border-blue-100 text-blue-700",
  },
  EXPIRED: {
    badge: "bg-orange-100 text-orange-700",
    card:  "bg-orange-50 border-orange-100 text-orange-700",
  },
  REJECTED: {
    badge: "bg-red-100 text-red-700",
    card:  "bg-red-50 border-red-100 text-red-700",
  },
  CANCELLED: {
    badge: "bg-slate-100 text-slate-600",
    card:  "bg-slate-50 border-slate-100 text-slate-600",
  },
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status?.toUpperCase()] ?? STATUS_STYLES.PENDING
  return (
    <span className={`caps-label px-2.5 py-1 rounded-md font-semibold ${style.badge}`}>
      {status}
    </span>
  )
}

const isPastBooking = (booking) => {
  if (!booking?.end_date) return false
  return booking.end_date < todayStr
}

const canEdit = (booking) =>
  !isPastBooking(booking) &&
  (booking.status === "PENDING" || booking.status === "APPROVED")

const canCancel = (booking) =>
  !isPastBooking(booking) &&
  (booking.status === "PENDING" || booking.status === "APPROVED")

// ── MealTimePills ─────────────────────────────────────────────────────────────

const MealTimePills = ({ booking }) => {
  const meals = getRequestedMeals(booking)
  if (meals.length === 0)
    return <span className="text-slate-500 text-sm italic">No meals requested</span>

  const firstMenu = booking.daily_menus?.[0] ?? {}

  return (
    <div className="flex flex-wrap gap-1.5">
      {MEALS.filter((m) => firstMenu[m.timeKey]).map(({ id, label }) => (
        <span
          key={id}
          className="inline-flex items-center text-sm font-medium bg-white text-slate-700 rounded-full px-3 py-1 border border-slate-200 shadow-sm"
        >
          {label}
        </span>
      ))}
    </div>
  )
}

// ── DurationBadge ─────────────────────────────────────────────────────────────

const DurationBadge = ({ booking }) => {
  const multi = isMultiDay(booking)
  const days  = booking.daily_menus?.length ?? 1
  return multi ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-md px-2.5 py-1.5">
      <Layers size={12} />
      {days} days
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-2.5 py-1.5">
      Single day
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

function Mess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightedReference = searchParams.get("booking") || ""
  const isLinkedFlow = searchParams.get("linked") === "1"

  const { data: bookingsData, isLoading } = useMyMessBookings()
  const bookings = bookingsData || []

  // ✅ Default to today's date so the date picker shows current date on load
  const [selectedDate,            setSelectedDate]            = useState(todayStr)
  const [mealFilter,              setMealFilter]              = useState("All")
  const [showAllUpcoming,         setShowAllUpcoming]         = useState(false)
  const [selectedViewBooking,     setSelectedViewBooking]     = useState(null)
  const [showForm,                setShowForm]                = useState(false)
  const [editMode,                setEditMode]                = useState(false)
  const [selectedEditBooking,     setSelectedEditBooking]     = useState(null)
  const [showDeleteModal,         setShowDeleteModal]         = useState(false)
  const [selectedBookingToDelete, setSelectedBookingToDelete] = useState(null)
  const [isDeleting,              setIsDeleting]              = useState(false)
  const [detailDay,               setDetailDay]               = useState(0)

  const { user } = useAuth()
  const location  = useLocation()

  const handleNewBooking = () => {
    if (!user) { navigate("/login", { state: { from: location.pathname } }); return }
    setEditMode(false); setSelectedEditBooking(null); setShowForm(true)
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filteredBookings = useMemo(() => {
    let result = [...bookings]

    if (highlightedReference) {
      result = result.filter(
        (b) => normaliseReference(b.reference_code) === normaliseReference(highlightedReference)
      )
    } else if (selectedDate) {
      result = result.filter(
        (b) => b.start_date <= selectedDate && b.end_date >= selectedDate
      )
    } else {
      result = result
        .filter((b) => b.end_date >= todayStr)
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      if (!showAllUpcoming) result = result.slice(0, 3)
    }

    if (mealFilter !== "All") {
      result = result.filter((b) => {
        const meals = getRequestedMeals(b)
        if (mealFilter === "Breakfast" && !meals.includes("Breakfast"))   return false
        if (mealFilter === "Lunch"     && !meals.includes("Lunch"))       return false
        if (mealFilter === "Dinner"    && !meals.includes("Dinner"))      return false
        if (mealFilter === "Snacks"    && !meals.includes("Morning Tea")
                                       && !meals.includes("Evening Tea")) return false
        return true
      })
    }

    return result
  }, [bookings, highlightedReference, selectedDate, showAllUpcoming, mealFilter])

  // ── Panel helpers ────────────────────────────────────────────────────────────

  const closeSidePanel = () => { setSelectedViewBooking(null); setDetailDay(0) }

  const openDeleteModal = (booking) => {
    setSelectedBookingToDelete(booking)
    setShowDeleteModal(true)
    closeSidePanel()
  }

  const openEditModal = (booking) => {
    setSelectedEditBooking(booking)
    setEditMode(true)
    setShowForm(true)
    closeSidePanel()
  }

  const closeForm = () => {
    setShowForm(false)
    setEditMode(false)
    setSelectedEditBooking(null)
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  const cancelMutation = useCancelMessBooking()

  const handleDelete = async () => {
    if (!selectedBookingToDelete) return
    setIsDeleting(true)
    try {
      await cancelMutation.mutateAsync(selectedBookingToDelete.id)
      setShowDeleteModal(false)
      toast.success("Booking cancelled successfully.")
    } catch (err) {
      console.error("Failed to delete:", err)
      toast.error("Booking could not be cancelled. Please try again.")
    } finally {
      setIsDeleting(false)
      setSelectedBookingToDelete(null)
    }
  }

  const handleSave = () => {
    closeForm()
    toast.success(editMode ? "Booking updated successfully!" : "Booking submitted! Waiting for approval.")
    // ✅ Reset to today after save, not empty string
    setSelectedDate(todayStr)
    if (isLinkedFlow) navigate("/dashboard?resumeSpace=1")
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const upcomingCount = bookings.filter((b) => b.end_date >= todayStr).length

  useEffect(() => {
    if (!highlightedReference || isLoading || bookings.length === 0) return undefined

    const targetBooking = bookings.find(
      (booking) => normaliseReference(booking.reference_code) === normaliseReference(highlightedReference)
    )
    if (!targetBooking) return undefined

    const timer = window.setTimeout(() => {
      setSelectedViewBooking(targetBooking)
      setDetailDay(0)
      const target = Array.from(document.querySelectorAll("[data-booking-reference]"))
        .find((el) => normaliseReference(el.getAttribute("data-booking-reference")) === normaliseReference(highlightedReference))
      target?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)

    return () => window.clearTimeout(timer)
  }, [bookings, highlightedReference, isLoading])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Food Bookings</h1>
            <p className="mt-2 text-sm text-gray-600">Manage your food requests</p>
          </div>
          <button
            onClick={handleNewBooking}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Book Meal
          </button>
        </div>

        {/* Meal type filters */}
        <div className="flex gap-2 flex-wrap">
          {["All", "Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
            <button
              key={meal}
              onClick={() => setMealFilter(meal)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                mealFilter === meal
                  ? "bg-green-700 text-white border-green-700 shadow-sm"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {meal}
            </button>
          ))}
        </div>

        {/* Two-column layout: main + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Main content — takes 2/3 */}
          <div className="lg:col-span-2 space-y-4">

            {/* List header with date picker */}
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800">
                {selectedDate ? `Bookings on ${formatShortDate(selectedDate)}` : "Upcoming Bookings"}
              </h2>
              <div className="flex items-center gap-2">
                {!selectedDate && upcomingCount > 3 && (
                  <button
                    onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                    className="text-sm text-green-700 font-medium hover:text-green-800 hover:underline underline-offset-2"
                  >
                    {showAllUpcoming ? "Show less" : "View all"}
                  </button>
                )}
                {/* ✅ Show "Today" button only when date is not today */}
                {selectedDate && selectedDate !== todayStr && (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className="text-sm text-green-700 hover:text-green-800 font-medium"
                  >
                    Today
                  </button>
                )}
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate("")}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Clear
                  </button>
                )}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-slate-300 rounded-xl px-4 py-2 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-slate-800"
                />
              </div>
            </div>

            {/* Booking table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              {/* Table header */}
              <div className="hidden md:grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-5 py-3">
                <span className="col-span-2 caps-label">From Date</span>
                <span className="col-span-2 caps-label">To Date</span>
                <span className="col-span-4 caps-label">Event</span>
                <span className="col-span-2 caps-label">Meals</span>
                <span className="col-span-1 caps-label">Status</span>
                <span className="col-span-1 caps-label text-right">·</span>
              </div>

              {!user && (
                <div className="py-16 text-center space-y-3">
                  <p className="text-base text-slate-500">Sign in to view your food bookings</p>
                  <button
                    onClick={() => navigate("/login", { state: { from: location.pathname } })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {user && isLoading && (
                <div className="flex flex-col">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="hidden md:grid grid-cols-12 items-center px-5 py-5 border-b border-slate-100 animate-pulse bg-white">
                      <div className="col-span-2 pr-4"><div className="h-5 bg-slate-100 rounded w-24"></div></div>
                      <div className="col-span-2 pr-4"><div className="h-5 bg-slate-100 rounded w-24"></div></div>
                      <div className="col-span-4 pr-4 space-y-2"><div className="h-5 bg-slate-100 rounded w-48"></div><div className="h-4 bg-slate-100 rounded w-32"></div></div>
                      <div className="col-span-2 pr-4 flex gap-2"><div className="h-6 bg-slate-100 rounded-full w-16"></div><div className="h-6 bg-slate-100 rounded-full w-16"></div></div>
                      <div className="col-span-1 pr-4"><div className="h-6 bg-slate-100 rounded w-20"></div></div>
                      <div className="col-span-1 flex justify-end"><div className="h-4 w-4 bg-slate-100 rounded"></div></div>
                    </div>
                  ))}
                </div>
              )}

              {user && !isLoading && filteredBookings.length === 0 && (
                <div className="py-16 text-center text-base text-slate-500">
                  No bookings match the selected filters.
                </div>
              )}

              {user && !isLoading && filteredBookings.map((b, idx) => (
                <React.Fragment key={b.id}>

                  {/* MOBILE CARD */}
                  <div
                    data-booking-reference={b.reference_code || ""}
                    onClick={() => { setSelectedViewBooking(b); setDetailDay(0) }}
                    className={`md:hidden mx-3 my-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4 cursor-pointer transition ${
                      normaliseReference(b.reference_code) === normaliseReference(highlightedReference)
                        ? "ring-2 ring-emerald-300" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate">{b.purpose_of_programme}</h3>
                        <p className="text-sm text-slate-500 mt-1">{formatDateRange(b.start_date, b.end_date)}</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Meals</p>
                        <MealTimePills booking={b} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">Starts</p>
                          <p className="text-sm font-semibold text-emerald-600">{getEarliestTime(b)}</p>
                        </div>
                        <DurationBadge booking={b} />
                      </div>
                      {getSubmissionTimestamp(b) && (
                        <p className="text-xs text-slate-400">Submitted {timeAgo(getSubmissionTimestamp(b))}</p>
                      )}
                    </div>
                  </div>

                  {/* DESKTOP TABLE ROW */}
                  <div
                    data-booking-reference={b.reference_code || ""}
                    onClick={() => { setSelectedViewBooking(b); setDetailDay(0) }}
                    className={[
                      "hidden md:grid grid-cols-12 items-center px-5 py-5 cursor-pointer transition-colors",
                      idx !== filteredBookings.length - 1 ? "border-b border-slate-100" : "",
                      "hover:bg-slate-50/70",
                      normaliseReference(b.reference_code) === normaliseReference(highlightedReference)
                        ? "bg-emerald-50 ring-2 ring-emerald-300 ring-inset" : "",
                    ].join(" ")}
                  >
                    {/* From Date */}
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-slate-800 tabular-nums leading-tight">
                        {formatShortDate(b.start_date).replace(/(\d{4})$/, '')}<br />
                        <span className="text-slate-500 font-medium">{b.start_date?.slice(0, 4)}</span>
                      </p>
                    </div>

                    {/* To Date */}
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-slate-800 tabular-nums leading-tight">
                        {formatShortDate(b.end_date).replace(/(\d{4})$/, '')}<br />
                        <span className="text-slate-500 font-medium">{b.end_date?.slice(0, 4)}</span>
                      </p>
                    </div>

                    {/* Event */}
                    <div className="col-span-4 pr-4">
                      <p className="text-base font-semibold text-slate-900 truncate">{b.purpose_of_programme}</p>
                      <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock3 size={12} className="text-emerald-500 shrink-0" />
                        Starts {getEarliestTime(b)}
                      </p>
                      {getSubmissionTimestamp(b) && (
                        <p className="text-xs text-slate-400 mt-0.5">Submitted {timeAgo(getSubmissionTimestamp(b))}</p>
                      )}
                    </div>

                    {/* Meals */}
                    <div className="col-span-2 pr-3">
                      <MealTimePills booking={b} />
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Chevron */}
                    <div className="col-span-1 flex justify-end">
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </div>

                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Sidebar — My Requests */}
          <div className="lg:col-span-1">
            <MessMyRequests />
          </div>

        </div>
      </div>

      {/* ── Side panel ── */}
      {selectedViewBooking && (() => {
        const b       = selectedViewBooking
        const menus   = b.daily_menus ?? []
        const dayMenu = menus[detailDay] ?? {}
        const showActions = canEdit(b) || canCancel(b)

        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">

              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Booking Details</h2>
                  <p className="text-sm text-slate-500 mt-0.5 font-medium tracking-wide uppercase">{b.reference_code}</p>
                </div>
                <button onClick={closeSidePanel} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                <section className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold text-slate-900 leading-snug">{b.purpose_of_programme}</p>
                    <StatusBadge status={b.status} />
                  </div>

                  {b.status?.toUpperCase() === "REJECTED" && b.rejection_remark && (
                    <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="caps-label text-red-500 mb-1">Rejection Reason</p>
                        <p className="text-base text-red-700 leading-relaxed">{b.rejection_remark}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="caps-label mb-1">Event Dates</p>
                      <p className="text-base font-medium text-slate-800 flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-emerald-600 shrink-0" />
                        {formatDateRange(b.start_date, b.end_date)}
                        {isMultiDay(b) && (
                          <span className="text-xs text-green-700 font-semibold bg-green-50 border border-green-200 px-2 py-0.5 rounded ml-1">
                            {menus.length} days
                          </span>
                        )}
                      </p>
                      <div className="mt-2">
                        <DurationBadge booking={b} />
                      </div>
                    </div>
                    <div>
                      <p className="caps-label mb-1">Meal Time</p>
                      <p className="text-base font-semibold text-emerald-600 flex items-center gap-1.5">
                        <Clock3 size={14} className="shrink-0" />{getEarliestTime(b)}
                      </p>
                    </div>
                    <div>
                      <p className="caps-label mb-1">Location</p>
                      <p className="text-base font-medium text-slate-800">{b.delivery_location}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="caps-label mb-1">Total Attendees</p>
                      <p className="text-base font-medium text-slate-800 flex items-center gap-2">
                        <Users size={15} className="text-slate-500 shrink-0" />
                        {getTotalPersons(b)} total
                        <span className="text-slate-600 text-sm">({getTotalVeg(b)} veg · {getTotalNonVeg(b)} non-veg)</span>
                      </p>
                    </div>
                  </div>
                </section>

                <hr className="border-slate-100" />

                {menus.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {menus.map((m, i) => (
                      <button
                        key={m.date}
                        onClick={() => setDetailDay(i)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          detailDay === i
                            ? "bg-green-700 text-white border-green-700"
                            : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        Day {i + 1}
                      </button>
                    ))}
                  </div>
                )}

                <section>
                  <p className="caps-label mb-3">{menus.length > 1 ? `Day ${detailDay + 1} Headcount` : "Headcount"}</p>
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {[
                      { value: dayMenu.veg_persons,   label: "Veg",     color: "text-emerald-600" },
                      { value: dayMenu.nonveg_persons, label: "Non-Veg", color: "text-red-500"     },
                      { value: dayMenu.total_persons,  label: "Total",   color: "text-slate-900"   },
                    ].map(({ value, label, color }, i, arr) => (
                      <React.Fragment key={label}>
                        <div className="flex-1 text-center py-4">
                          <p className={`text-2xl font-bold ${color}`}>{value ?? "–"}</p>
                          <p className="caps-label mt-1">{label}</p>
                        </div>
                        {i < arr.length - 1 && <div className="w-px h-10 bg-slate-100" />}
                      </React.Fragment>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="caps-label mb-3">{menus.length > 1 ? `Day ${detailDay + 1} Menu` : "Food Menu"}</p>
                  <div className="space-y-2.5">
                    {MEALS.filter((m) => dayMenu[m.timeKey]).map(({ id, label, menuKey, timeKey }) => {
                      const time = dayMenu[timeKey]?.slice(0, 5) ?? null
                      return (
                        <div key={id} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                            <span className="caps-label">{label}</span>
                            {time ? (
                              <div className="flex items-center gap-1.5 text-emerald-600">
                                <Clock3 size={12} />
                                <span className="text-sm font-semibold tabular-nums">{time}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500 italic">Time not set</span>
                            )}
                          </div>
                          <p className="text-base text-slate-800 px-4 py-3 leading-relaxed">{dayMenu[menuKey]}</p>
                        </div>
                      )
                    })}
                    {!MEALS.some((m) => dayMenu[m.timeKey]) && (
                      <p className="text-base text-slate-500 italic text-center py-6">No meals selected for this day.</p>
                    )}
                  </div>
                </section>
              </div>

              {showActions && (
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                  {canCancel(b) && (
                    <button
                      onClick={() => openDeleteModal(b)}
                      className="px-4 py-2 text-sm border border-slate-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors font-medium flex items-center gap-1.5"
                    >
                      <Trash2 size={14} /> Cancel
                    </button>
                  )}
                  {canEdit(b) && (
                    <button
                      onClick={() => openEditModal(b)}
                      className="px-5 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium flex items-center gap-1.5"
                    >
                      <Pencil size={14} /> Edit Booking
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        )
      })()}

      {/* ── Form modal ── */}
      {showForm && (
        <MessBookingForm
          onClose={closeForm}
          editData={editMode ? selectedEditBooking : null}
          onSave={handleSave}
        />
      )}

      {/* ── Delete modal ── */}
      {showDeleteModal && selectedBookingToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[60] px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-center">
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 disabled:opacity-50 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Cancel Booking?</h2>
            <p className="text-base text-slate-600 leading-relaxed mb-4">You're about to cancel this food request for:</p>
            <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 mb-4">
              <p className="text-base font-semibold text-slate-800">{selectedBookingToDelete.purpose_of_programme}</p>
              <p className="text-sm text-slate-500 mt-1 tabular-nums">
                {formatDateRange(selectedBookingToDelete.start_date, selectedBookingToDelete.end_date)}
                {" · "}
                {getEarliestTime(selectedBookingToDelete)}
              </p>
            </div>
            <p className="text-sm text-red-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-base font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-base font-semibold transition disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isDeleting ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cancelling…</>
                ) : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

export default Mess