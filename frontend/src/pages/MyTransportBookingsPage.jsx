import { useState, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import toast from "react-hot-toast"
import MainLayout from "../layouts/MainLayout"
import TransportBookingModal from "../components/TransportBookingModal"
import { useMyFleetBookings, useCancelFleetBooking } from "../hooks/useFleetQueries"
import {
  ArrowLeft,
  Bus,
  RefreshCw,
  Search,
  X as XIcon,
  Trash2,
  Pencil,
  MapPin,
  Users,
  ChevronDown,
  CalendarClock,
} from "lucide-react"
 
// ─── Utilities ────────────────────────────────────────────────────────────────
 
const formatDT = (iso) => {
  if (!iso) return "—"
  const date = new Date(iso)
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}
 
const timeAgo = (isoString) => {
  if (!isoString) return ""
  const mins = Math.round((Date.now() - new Date(isoString)) / 60000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}
 
const normaliseReference = (value) => String(value || "").trim().toUpperCase()
 
// ─── Status Config ─────────────────────────────────────────────────────────────
 
const STATUS_BADGE_STYLES = {
  APPROVED:  "bg-green-100 text-green-700 border-green-200",
  PENDING:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-blue-100 text-blue-700 border-blue-200",
  REJECTED:  "bg-red-100 text-red-700 border-red-200",
  EXPIRED:   "bg-orange-100 text-orange-700 border-orange-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
}
 
const STATUS_CARD_STYLES = {
  APPROVED:  "bg-green-50 border-green-100 text-green-800",
  PENDING:   "bg-yellow-50 border-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-50 border-blue-100 text-blue-800",
  REJECTED:  "bg-red-50 border-red-100 text-red-800",
  EXPIRED:   "bg-orange-50 border-orange-100 text-orange-800",
  CANCELLED: "bg-gray-50 border-gray-100 text-gray-600",
}
 
const STATUS_LABEL = {
  APPROVED:  "Approved",
  PENDING:   "Pending Review",
  COMPLETED: "Completed",
  REJECTED:  "Rejected",
  EXPIRED:   "Expired",
  CANCELLED: "Cancelled",
}
 
const STATUS_DESCRIPTION = {
  APPROVED:  "Your transport request is confirmed.",
  PENDING:   "You'll be notified once your request is reviewed.",
  COMPLETED: "This trip has already taken place.",
  REJECTED:  "Please check the admin remarks below.",
  EXPIRED:   "This request was not approved in time.",
  CANCELLED: "This request has been cancelled.",
}
 
function getStatusBadge(status) {
  const style = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.PENDING
  const label = STATUS_LABEL[status] ?? status
  return (
    <span className={`px-3 py-1 border text-[11px] font-bold rounded-lg uppercase tracking-wide ${style}`}>
      {label}
    </span>
  )
}
 
// ─── Booking Card ──────────────────────────────────────────────────────────────
 
function BookingCard({ booking, onEdit, onCancel, isActionLoading, isHighlighted }) {
  const [isExpanded, setIsExpanded] = useState(false)
 
  useEffect(() => {
    if (!isHighlighted) return
    const timer = window.setTimeout(() => setIsExpanded(true), 0)
    return () => window.clearTimeout(timer)
  }, [isHighlighted])
 
  const isPast = new Date(booking.end_datetime) <= new Date()
  const canAct =
    !isPast &&
    (booking.status === "PENDING" || booking.status === "APPROVED")
 
  const cardStyle = STATUS_CARD_STYLES[booking.status] ?? STATUS_CARD_STYLES.PENDING
  const description = STATUS_DESCRIPTION[booking.status] ?? ""
 
  return (
    <div
      data-booking-reference={booking.reference_code || ""}
      className={`px-7 border-b border-gray-100 last:border-0 transition-colors duration-150
        ${isExpanded ? "bg-[#f8fafc]" : "bg-white hover:bg-[#f8fafc]"}
        ${isHighlighted ? "ring-2 ring-green-300 ring-inset bg-green-50/70" : ""}
      `}
    >
      {/* Clickable header */}
      <div
        className="py-6 cursor-pointer select-none"
        onClick={() => setIsExpanded((v) => !v)}
      >
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
            {booking.created_at && (
              <span className="text-[13px] text-gray-500 font-medium">
                Submitted {timeAgo(booking.created_at)}
              </span>
            )}
            <div className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </div>
 
        {/* 3-col info grid */}
        <div className="grid gap-7" style={{ gridTemplateColumns: "1.8fr 1.6fr 2.6fr" }}>
 
          {/* Route */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Route</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0 text-green-700">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-gray-900 leading-tight">
                  {booking.pickup_location}
                </p>
                <p className="truncate text-[13px] text-gray-500 mt-0.5">
                  → {booking.destination}
                </p>
              </div>
            </div>
          </div>
 
          {/* Schedule */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">When</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Starts</span>
                  <span className="text-[15px] font-semibold text-gray-900">{formatDT(booking.start_datetime)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Ends</span>
                  <span className="text-[15px] font-semibold text-gray-900">{formatDT(booking.end_datetime)}</span>
                </div>
              </div>
            </div>
          </div>
 
          {/* Status context */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Current Status</p>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 leading-tight">
                {STATUS_LABEL[booking.status] ?? booking.status}
              </p>
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
 
        </div>
      </div>
 
      {/* Expanded section */}
      {isExpanded && (
        <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pt-6 border-t border-gray-200">
 
            {/* Vehicle & passengers */}
            <div className="mb-6">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2">Trip Details</p>
              <div className={`rounded-xl border px-4 py-3.5 ${cardStyle}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Bus className="w-4 h-4 opacity-70" />
                    <span className="text-[14.5px] font-semibold">
                      {booking.vehicle_details?.name ?? `Vehicle #${booking.vehicle}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 opacity-70" />
                    <span className="text-[14px] font-medium">{booking.total_passengers} passengers</span>
                  </div>
                </div>
                {booking.purpose && (
                  <p className="mt-2 text-[14px] opacity-80 italic">{booking.purpose}</p>
                )}
              </div>
            </div>
 
            {/* User notes */}
            {booking.user_notes && (
              <div className="mb-6">
                <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-amber-500 inline-block">
                  Additional Notes
                </p>
                <div className="mt-1 bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-3.5">
                  <p className="text-[14.5px] text-gray-700 leading-relaxed">{booking.user_notes}</p>
                </div>
              </div>
            )}
 
            {/* Admin remarks on rejection */}
            {booking.status === "REJECTED" && booking.remarks_by_admin && (
              <div className="mb-6">
                <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-red-500 inline-block">
                  Admin Feedback
                </p>
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3.5">
                  <p className="text-[14.5px] text-red-900 leading-relaxed italic">
                    "{booking.remarks_by_admin}"
                  </p>
                </div>
              </div>
            )}
 
            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-5 border-t border-gray-200">
              {!canAct && (
                <p className="text-[11.5px] font-bold text-gray-400 uppercase tracking-widest mt-2 mr-auto">
                  {isPast && booking.status === "APPROVED" ? "Trip Completed" : "No Actions Available"}
                </p>
              )}
 
              {canAct && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(booking) }}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-[14.5px] font-medium text-gray-700 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-150 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  {isActionLoading ? "Please wait..." : "Cancel Booking"}
                </button>
              )}
 
              {canAct && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(booking) }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-[14.5px] font-semibold hover:bg-green-700 transition-all duration-150"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Booking
                </button>
              )}
            </div>
 
          </div>
        </div>
      )}
    </div>
  )
}
 
// ─── Cancel Confirmation Modal ─────────────────────────────────────────────────
 
function CancelModal({ booking, onConfirm, onClose, loading, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
        >
          <XIcon className="h-5 w-5" />
        </button>
 
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <Trash2 className="h-6 w-6 text-red-500" />
        </div>
 
        <h2 className="text-xl font-bold text-gray-900">Cancel booking?</h2>
        <p className="mt-2 text-sm text-gray-500">This will cancel your transport booking request.</p>
 
        <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">
            {booking.vehicle_details?.name || "Vehicle"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {booking.pickup_location} → {booking.destination}
          </p>
          {booking.reference_code && (
            <p className="mt-2 font-mono text-xs text-gray-400">{booking.reference_code}</p>
          )}
        </div>
 
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
 
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Keep Booking
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? "Cancelling..." : "Yes, Cancel Booking"}
          </button>
        </div>
      </div>
    </div>
  )
}
 
// ─── Main Page ─────────────────────────────────────────────────────────────────
 
const FILTER_TABS = [
  { id: "ALL",       label: "All" },
  { id: "PENDING",   label: "Pending" },
  { id: "APPROVED",  label: "Approved" },
  { id: "COMPLETED", label: "Completed" },
  { id: "EXPIRED",   label: "Expired" },
  { id: "REJECTED",  label: "Rejected" },
]
 
function MyTransportBookingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightedReference = searchParams.get("booking") || ""
 
  const { data: queryData = [], isLoading, isError, refetch } = useMyFleetBookings()
  const allBookings = queryData || []
  const error = isError ? "Failed to load your transport history." : null
 
  const cancelMutation = useCancelFleetBooking()
 
  // Modal states
  const [showModal, setShowModal]         = useState(false)
  const [editData, setEditData]           = useState(null)
  const [cancelTarget, setCancelTarget]   = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError]     = useState("")
 
  // Search & filter
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter]         = useState("ALL")
 
  // Auto-highlight from query param
  useEffect(() => {
    if (!highlightedReference) return
    const timer = window.setTimeout(() => {
      setSearchTerm(highlightedReference)
      setFilter("ALL")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [highlightedReference])
 
  useEffect(() => {
    if (!highlightedReference || isLoading || filteredBookings.length === 0) return
    const target = Array.from(document.querySelectorAll("[data-booking-reference]"))
      .find((el) => normaliseReference(el.getAttribute("data-booking-reference")) === normaliseReference(highlightedReference))
    if (!target) return
    const timer = window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 80)
    return () => window.clearTimeout(timer)
  }, [highlightedReference, isLoading])
 
  const filteredBookings = useMemo(() => {
    let result = allBookings
 
    if (filter !== "ALL") {
      result = result.filter((b) => {
        const isPast = new Date(b.end_datetime) <= new Date()
        if (filter === "COMPLETED") return b.status === "COMPLETED" || (isPast && b.status === "APPROVED")
        if (filter === "APPROVED")  return b.status === "APPROVED" && !isPast
        return b.status === filter
      })
    }
 
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      result = result.filter((b) =>
        b.pickup_location?.toLowerCase().includes(q) ||
        b.destination?.toLowerCase().includes(q) ||
        b.purpose?.toLowerCase().includes(q) ||
        b.reference_code?.toLowerCase().includes(q) ||
        b.vehicle_details?.name?.toLowerCase().includes(q)
      )
    }
 
    return result
  }, [allBookings, filter, searchTerm])
 
  const openEditModal = (booking) => {
    setEditData(booking)
    setShowModal(true)
  }
 
  const openCancelModal = (booking) => {
    setCancelTarget(booking)
    setCancelError("")
    setCancelLoading(false)
  }
 
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    setCancelError("")
    try {
      await cancelMutation.mutateAsync(cancelTarget.id)
      setCancelTarget(null)
      toast.success("Booking cancelled successfully.")
    } catch (err) {
      setCancelError(
        err?.response?.data?.error || "Could not cancel this booking. Please try again."
      )
    } finally {
      setCancelLoading(false)
    }
  }
 
  return (
    <MainLayout>
      <div className="max-w-[1400px] mx-auto w-full">
 
        {/* Back nav */}
        <button
          onClick={() => navigate("/transport")}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Transport Bookings
        </button>
 
        {/* Page header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">
              My Space
            </p>
            <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
              My Transport Bookings
            </h1>
            <p className="text-[15px] text-gray-600 mt-2">
              Review and manage your current and past vehicle booking requests.
            </p>
          </div>
 
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setEditData(null); setShowModal(true) }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-[14px] font-semibold hover:bg-green-700 transition-all duration-150 shadow-sm"
            >
              <Bus className="w-4 h-4" />
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
                placeholder="Search routes, vehicles, codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-[14px] bg-white outline-none focus:ring-2 focus:ring-green-50 focus:border-green-500 placeholder:text-gray-400 shadow-sm transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                >
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
 
          {/* Panel header & filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-3 border-b border-gray-200 bg-gray-50/50">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-gray-600">
              Request History
            </span>
            <div className="flex gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors ${
                    filter === tab.id
                      ? "bg-green-100 text-green-800"
                      : "text-gray-600 hover:bg-gray-100"
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
                    <div>
                      <div className="h-3 bg-gray-100 rounded w-16 mb-3" />
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                        <div>
                          <div className="h-4 bg-gray-100 rounded w-28 mb-1" />
                          <div className="h-3 bg-gray-100 rounded w-20" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="h-3 bg-gray-100 rounded w-12 mb-3" />
                      <div className="space-y-3">
                        <div className="h-8 bg-gray-100 rounded w-28" />
                        <div className="h-8 bg-gray-100 rounded w-28" />
                      </div>
                    </div>
                    <div>
                      <div className="h-3 bg-gray-100 rounded w-24 mb-3" />
                      <div className="h-5 bg-gray-100 rounded w-40 mb-2" />
                      <div className="h-4 bg-gray-100 rounded w-56" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-20 text-center px-8">
              <p className="text-[15px] font-semibold text-gray-900 mb-2">{error}</p>
              <button
                onClick={() => refetch()}
                className="text-green-700 text-[14px] font-medium hover:underline"
              >
                Reload page
              </button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-20 text-center px-8">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <CalendarClock className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-[15px] font-semibold text-gray-900">
                {searchTerm || filter !== "ALL" ? "No matching bookings found" : "No bookings yet"}
              </p>
              <p className="text-[13.5px] text-gray-500 mt-1.5">
                {searchTerm || filter !== "ALL"
                  ? "Try changing your search terms or filters."
                  : "When you book a vehicle, it will appear here."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onEdit={openEditModal}
                  onCancel={openCancelModal}
                  isActionLoading={cancelLoading}
                  isHighlighted={
                    normaliseReference(booking.reference_code) ===
                    normaliseReference(highlightedReference)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
 
      {/* Booking / Edit modal */}
      {showModal && (
        <TransportBookingModal
          editData={editData}
          onClose={() => { setShowModal(false); setEditData(null) }}
          onSave={() => { setShowModal(false); setEditData(null) }}
        />
      )}
 
      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelTarget(null)}
          loading={cancelLoading}
          error={cancelError}
        />
      )}
    </MainLayout>
  )
}
 
export default MyTransportBookingsPage