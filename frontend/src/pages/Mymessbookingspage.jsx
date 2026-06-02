import React, { useState, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import toast from "react-hot-toast"
import MainLayout from "../layouts/MainLayout"
import MessBookingForm from "../components/MessBookingForm"
import { useMyMessBookings, useCancelMessBooking } from "../hooks/useMessQueries"
import { getSubmissionTimestamp } from "../utils/submissionTime"
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
  ArrowLeft,
  Utensils,
  RefreshCw,
  Search,
  X as XIcon,
  Trash2,
  Pencil,
  Clock3,
  Users,
  CalendarDays,
  Layers,
  ChevronDown,
  AlertCircle,
} from "lucide-react"

// ─── Utilities ────────────────────────────────────────────────────────────────

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

const todayStr = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
})()

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_BADGE = {
  approved:  "bg-blue-100 text-blue-700 border-blue-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  expired:   "bg-orange-100 text-orange-700 border-orange-200",
  rejected:  "bg-red-100 text-red-700 border-red-200",
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
}

const STATUS_LABEL = {
  approved:  "Approved",
  confirmed: "Confirmed",
  completed: "Completed",
  expired:   "Expired",
  rejected:  "Rejected",
  pending:   "Pending Review",
  cancelled: "Cancelled",
}

const STATUS_DESCRIPTION = {
  approved:  "Your food request is confirmed.",
  confirmed: "Your food request is confirmed.",
  completed: "This booking has already taken place.",
  expired:   "This request was not approved in time.",
  rejected:  "Please check the admin remarks below.",
  pending:   "You'll be notified once your request is reviewed.",
  cancelled: "This request has been cancelled.",
}

function getStatusBadge(status) {
  const key = status?.toLowerCase() ?? "pending"
  const style = STATUS_BADGE[key] ?? STATUS_BADGE.pending
  const label = STATUS_LABEL[key] ?? status
  return (
    <span className={`px-3 py-1 border text-[11px] font-bold rounded-lg uppercase tracking-wide ${style}`}>
      {label}
    </span>
  )
}

const isEditable = (status) => {
  const s = status?.toLowerCase()
  return s === "pending" || s === "confirmed" || s === "approved"
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const MealTimePills = ({ booking }) => {
  const meals = getRequestedMeals(booking)
  if (meals.length === 0)
    return <span className="text-slate-500 text-sm italic">No meals</span>
  const firstMenu = booking.daily_menus?.[0] ?? {}
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEALS.filter((m) => firstMenu[m.timeKey]).map(({ id, label, timeKey }) => {
        const time = firstMenu[timeKey]?.slice(0, 5) ?? null
        return (
          <span key={id} className="inline-flex items-center gap-1.5 text-xs font-medium bg-white text-slate-700 rounded-full px-2.5 py-1 border border-slate-200 shadow-sm">
            {label}
            {time && <span className="text-emerald-600 font-semibold tabular-nums">{time}</span>}
          </span>
        )
      })}
    </div>
  )
}

const DurationBadge = ({ booking }) => {
  const multi = isMultiDay(booking)
  const days  = booking.daily_menus?.length ?? 1
  return multi ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded-md px-2.5 py-1">
      <Layers size={12} /> {days} days
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-2.5 py-1">
      Single day
    </span>
  )
}

// ─── Booking Card ──────────────────────────────────────────────────────────────

function BookingCard({ booking, onEdit, onCancel, isHighlighted }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [detailDay, setDetailDay]   = useState(0)

  useEffect(() => {
    if (!isHighlighted) return
    const timer = window.setTimeout(() => setIsExpanded(true), 0)
    return () => window.clearTimeout(timer)
  }, [isHighlighted])

  const menus   = booking.daily_menus ?? []
  const dayMenu = menus[detailDay] ?? {}
  const canAct  = isEditable(booking.status)

  return (
    <div
      data-booking-reference={booking.reference_code || ""}
      className={`px-7 border-b border-gray-100 last:border-0 transition-colors duration-150
        ${isExpanded ? "bg-[#f8fafc]" : "bg-white hover:bg-[#f8fafc]"}
        ${isHighlighted ? "ring-2 ring-emerald-300 ring-inset bg-emerald-50/70" : ""}
      `}
    >
      {/* Clickable header */}
      <div className="py-6 cursor-pointer select-none" onClick={() => setIsExpanded((v) => !v)}>

        {/* Top strip */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-2.5 flex-wrap">
            {getStatusBadge(booking.status)}
            {booking.reference_code && (
              <span className="font-mono text-[13.5px] font-semibold text-green-900 bg-green-50 px-3 py-1 rounded-lg border border-green-100 tracking-wide ml-2">
                {booking.reference_code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {getSubmissionTimestamp(booking) && (
              <span className="text-[13px] text-gray-500 font-medium">
                Submitted {timeAgo(getSubmissionTimestamp(booking))}
              </span>
            )}
            <div className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
              <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
            </div>
          </div>
        </div>

        {/* 3-col info grid */}
        <div className="grid gap-7" style={{ gridTemplateColumns: "1.8fr 1.6fr 2.6fr" }}>

          {/* Event */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Event</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 text-green-700">
                <Utensils className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-gray-900 leading-tight">
                  {booking.purpose_of_programme || "Food Booking"}
                </p>
                <p className="truncate text-[13px] text-gray-500 mt-0.5">
                  {booking.delivery_location || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">When</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">From</span>
                  <span className="text-[15px] font-semibold text-gray-900">{formatShortDate(booking.start_date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">To</span>
                  <span className="text-[15px] font-semibold text-gray-900">{formatShortDate(booking.end_date)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status context */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Current Status</p>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 leading-tight">
                {STATUS_LABEL[booking.status?.toLowerCase()] ?? booking.status}
              </p>
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                {STATUS_DESCRIPTION[booking.status?.toLowerCase()] ?? ""}
              </p>
              <div className="mt-2">
                <DurationBadge booking={booking} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pt-6 border-t border-gray-200">

            {/* Meals overview */}
            <div className="mb-6">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2">Meals</p>
              <MealTimePills booking={booking} />
            </div>

            {/* Headcount */}
            <div className="mb-6">
              <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-green-600 inline-block">
                {menus.length > 1 ? `Day ${detailDay + 1} Headcount` : "Headcount"}
              </p>
              <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {[
                  { value: dayMenu.veg_persons,   label: "Veg",     color: "text-emerald-600" },
                  { value: dayMenu.nonveg_persons, label: "Non-Veg", color: "text-red-500"     },
                  { value: dayMenu.total_persons,  label: "Total",   color: "text-slate-900"   },
                ].map(({ value, label, color }, i, arr) => (
                  <React.Fragment key={label}>
                    <div className="flex-1 text-center py-4">
                      <p className={`text-2xl font-bold ${color}`}>{value ?? "–"}</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</p>
                    </div>
                    {i < arr.length - 1 && <div className="w-px h-10 bg-slate-100" />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Day tabs for multi-day */}
            {menus.length > 1 && (
              <div className="mb-4">
                <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-amber-500 inline-block">
                  Daily Menu
                </p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2">
                  {menus.map((m, i) => (
                    <button
                      key={m.date}
                      onClick={(e) => { e.stopPropagation(); setDetailDay(i) }}
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
              </div>
            )}

            {/* Menu items */}
            <div className="space-y-2.5 mb-6">
              {MEALS.filter((m) => dayMenu[m.timeKey]).map(({ id, label, menuKey, timeKey }) => {
                const time = dayMenu[timeKey]?.slice(0, 5) ?? null
                return (
                  <div key={id} className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
                      {time ? (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Clock3 size={12} />
                          <span className="text-sm font-semibold tabular-nums">{time}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500 italic">Time not set</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 px-4 py-3 leading-relaxed">{dayMenu[menuKey]}</p>
                  </div>
                )
              })}
              {!MEALS.some((m) => dayMenu[m.timeKey]) && (
                <p className="text-sm text-slate-500 italic text-center py-4">No meals selected for this day.</p>
              )}
            </div>

            {/* Admin rejection remark */}
            {booking.status?.toLowerCase() === "rejected" && booking.rejection_remark && (
              <div className="mb-6">
                <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-red-500 inline-block">
                  Admin Feedback
                </p>
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3.5 flex gap-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[14.5px] text-red-900 leading-relaxed italic">
                    "{booking.rejection_remark}"
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-5 border-t border-gray-200">
              {!canAct && (
                <p className="text-[11.5px] font-bold text-gray-400 uppercase tracking-widest mt-2 mr-auto">
                  No Actions Available
                </p>
              )}
              {canAct && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(booking) }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-[14.5px] font-medium text-gray-700 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-150"
                >
                  <Trash2 className="w-4 h-4" /> Cancel Booking
                </button>
              )}
              {canAct && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(booking) }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-[14.5px] font-semibold hover:bg-slate-800 transition-all duration-150"
                >
                  <Pencil className="w-4 h-4" /> Edit Booking
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cancel Modal ─────────────────────────────────────────────────────────────

function CancelModal({ booking, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[60] px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl text-center">
        <button onClick={onClose} disabled={loading} className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <XIcon size={16} />
        </button>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Cancel Booking?</h2>
        <p className="text-sm text-slate-600 mb-4">You're about to cancel this food request for:</p>
        <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 mb-4 text-left">
          <p className="text-sm font-semibold text-slate-800">{booking.purpose_of_programme}</p>
          <p className="text-xs text-slate-500 mt-1">
            {formatDateRange(booking.start_date, booking.end_date)} · {getEarliestTime(booking)}
          </p>
        </div>
        <p className="text-xs text-red-500 mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={loading} className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
            Keep it
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-70 flex justify-center items-center gap-2">
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cancelling…</>
            ) : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: "ALL",       label: "All" },
  { id: "PENDING",   label: "Pending" },
  { id: "APPROVED",  label: "Approved" },
  { id: "COMPLETED", label: "Completed" },
  { id: "EXPIRED",   label: "Expired" },
  { id: "REJECTED",  label: "Rejected" },
]

// ─── Main page ────────────────────────────────────────────────────────────────

function MyMessBookingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightedReference = searchParams.get("booking") || ""

  const { data: bookingsData = [], isLoading, isError } = useMyMessBookings()
  const allBookings = bookingsData || []
  const error = isError ? "Failed to load your food booking history." : null

  const cancelMutation = useCancelMessBooking()

  const [showForm,        setShowForm]        = useState(false)
  const [editData,        setEditData]        = useState(null)
  const [cancelTarget,    setCancelTarget]    = useState(null)
  const [cancelLoading,   setCancelLoading]   = useState(false)
  const [searchTerm,      setSearchTerm]      = useState("")
  const [filter,          setFilter]          = useState("ALL")

  useEffect(() => {
    if (!highlightedReference) return
    const timer = window.setTimeout(() => { setSearchTerm(highlightedReference); setFilter("ALL") }, 0)
    return () => window.clearTimeout(timer)
  }, [highlightedReference])

  const filteredBookings = useMemo(() => {
    let result = [...allBookings].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))

    if (filter !== "ALL") {
      result = result.filter((b) => {
        const s = b.status?.toLowerCase()
        if (filter === "APPROVED")  return s === "approved" || s === "confirmed"
        if (filter === "COMPLETED") return s === "completed"
        if (filter === "EXPIRED")   return s === "expired"
        if (filter === "REJECTED")  return s === "rejected"
        if (filter === "PENDING")   return s === "pending"
        return true
      })
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter((b) =>
        b.purpose_of_programme?.toLowerCase().includes(q) ||
        b.delivery_location?.toLowerCase().includes(q) ||
        b.reference_code?.toLowerCase().includes(q) ||
        b.status?.toLowerCase().includes(q)
      )
    }

    return result
  }, [allBookings, filter, searchTerm])

  useEffect(() => {
    if (!highlightedReference || isLoading || filteredBookings.length === 0) return
    const target = Array.from(document.querySelectorAll("[data-booking-reference]"))
      .find((el) => normaliseReference(el.getAttribute("data-booking-reference")) === normaliseReference(highlightedReference))
    if (!target) return
    const timer = window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 80)
    return () => window.clearTimeout(timer)
  }, [filteredBookings, highlightedReference, isLoading])

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    try {
      await cancelMutation.mutateAsync(cancelTarget.id)
      setCancelTarget(null)
      toast.success("Booking cancelled successfully.")
    } catch {
      toast.error("Could not cancel this booking. Please try again.")
    } finally {
      setCancelLoading(false)
    }
  }

  const handleSave = () => {
    setShowForm(false)
    setEditData(null)
    toast.success(editData ? "Booking updated!" : "Booking submitted!")
  }

  return (
    <MainLayout>
      <div className="max-w-[1400px] mx-auto w-full">

        {/* Back nav */}
        <button
          onClick={() => navigate("/mess")}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Food Bookings
        </button>

        {/* Page header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">My Space</p>
            <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
              My Food Bookings
            </h1>
            <p className="text-[15px] text-gray-600 mt-2">
              Review and manage your current and past food booking requests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setEditData(null); setShowForm(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-700 text-white text-[14px] font-semibold hover:bg-green-800 transition-all duration-150 shadow-sm"
            >
              <Utensils className="w-4 h-4" />
              <span className="hidden sm:inline">New Booking</span>
              <span className="sm:hidden">New</span>
            </button>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search events, locations, codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-[14px] bg-white outline-none focus:ring-2 focus:ring-green-50 focus:border-green-500 placeholder:text-gray-400 shadow-sm transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition">
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] font-medium text-gray-600 hover:bg-gray-50 transition-all duration-150 disabled:opacity-40 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Panel */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-3 border-b border-gray-200 bg-gray-50/50">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-gray-600">
              Request History
            </span>
            <div className="flex gap-2 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors ${
                    filter === tab.id ? "bg-green-100 text-green-800" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* States */}
          {isLoading ? (
            <div className="flex flex-col">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-7 py-6 border-b border-gray-100 animate-pulse bg-white">
                  <div className="flex justify-between mb-5">
                    <div className="h-6 bg-gray-100 rounded w-24" />
                    <div className="h-4 bg-gray-100 rounded w-32" />
                  </div>
                  <div className="grid gap-7" style={{ gridTemplateColumns: "1.8fr 1.6fr 2.6fr" }}>
                    <div><div className="h-3 bg-gray-100 rounded w-16 mb-3" /><div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" /><div><div className="h-4 bg-gray-100 rounded w-28 mb-1" /><div className="h-3 bg-gray-100 rounded w-20" /></div></div></div>
                    <div><div className="h-3 bg-gray-100 rounded w-12 mb-3" /><div className="space-y-3"><div className="h-8 bg-gray-100 rounded w-28" /><div className="h-8 bg-gray-100 rounded w-28" /></div></div>
                    <div><div className="h-3 bg-gray-100 rounded w-24 mb-3" /><div className="h-5 bg-gray-100 rounded w-40 mb-2" /><div className="h-4 bg-gray-100 rounded w-56" /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-20 text-center px-8">
              <p className="text-[15px] font-semibold text-gray-900 mb-2">{error}</p>
              <button onClick={() => window.location.reload()} className="text-green-700 text-[14px] font-medium hover:underline">
                Reload page
              </button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-20 text-center px-8">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-6 h-6 text-green-700" />
              </div>
              <p className="text-[15px] font-semibold text-gray-900">
                {searchTerm || filter !== "ALL" ? "No matching bookings found" : "No bookings yet"}
              </p>
              <p className="text-[13.5px] text-gray-500 mt-1.5">
                {searchTerm || filter !== "ALL"
                  ? "Try changing your search terms or filters."
                  : "When you book a meal, it will appear here."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onEdit={(b) => { setEditData(b); setShowForm(true) }}
                  onCancel={(b) => setCancelTarget(b)}
                  isHighlighted={normaliseReference(booking.reference_code) === normaliseReference(highlightedReference)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <MessBookingForm
          onClose={() => { setShowForm(false); setEditData(null) }}
          editData={editData}
          onSave={handleSave}
        />
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}
    </MainLayout>
  )
}

export default MyMessBookingsPage