import Tooltip from "../components/Tooltip"
import { useState, useEffect, useMemo } from "react"
import { useParams } from "react-router-dom"
import api from "../api/axios"
import MainLayout from "../layouts/MainLayout"
import BookingModal from "../components/BookingModal"
import { getSubmissionTimestamp } from "../utils/submissionTime"
import toast from 'react-hot-toast'
import { useMySpaceBookings, useCancelSpaceBooking } from "../hooks/useSpaceQueries"
import {
  RefreshCcw,
  Trash2,
  Pencil,
  CalendarClock,
  Search,
  X as XIcon,
  Package,
  ChevronDown,
  Building2,
  Users,
  Clock3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  TriangleAlert
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

const formatDateTime = (isoString) => {
  if (!isoString) return "TBD"

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoString))
}

const timeAgo = (isoString) => {
  if (!isoString) return ""

  const mins = Math.round((Date.now() - new Date(isoString)) / 60000)

  if (mins < 60) return `${mins} min ago`

  const hrs = Math.round(mins / 60)

  if (hrs < 24) return `${hrs}h ago`

  return `${Math.round(hrs / 24)}d ago`
}

const getBookingStatusMeta = (booking) => {
  const isExpired = booking.status === "COMPLETED" || new Date(booking.end_datetime) < new Date()

  if (booking.status === "EXPIRED") {
    return {
      title: "Approval Window Expired",
      description: "This request was not approved before the event began.",
      bg: "bg-orange-50",
      border: "border-orange-100",
      icon: <AlertCircle className="w-5 h-5 text-orange-600" />
    }
  }

  if (isExpired) {
    return {
      title: "Schedule Completed",
      description: "This booking has already taken place.",
      bg: "bg-slate-50",
      border: "border-slate-200",
      icon: <CheckCircle2 className="w-5 h-5 text-slate-500" />
    }
  }

  switch (booking.status) {
    case "PENDING":
      return {
        title: "Waiting for Approval",
        description:
          "Your request is being reviewed. You'll be notified once approved or declined.",
        bg: "bg-yellow-50",
        border: "border-yellow-100",
        icon: <Clock3 className="w-5 h-5 text-yellow-600" />
      }

    case "APPROVED":
      return {
        title: "Venue Reserved Successfully",
        description:
          "Your booking is confirmed. You may still edit or cancel if needed.",
        bg: "bg-emerald-50",
        border: "border-emerald-100",
        icon: <CheckCircle2 className="w-5 h-5 text-green-600" />
      }

    case "REJECTED":
      return {
        title: "Booking Not Approved",
        description:
          "This request was not approved. Review feedback below.",
        bg: "bg-red-50",
        border: "border-red-100",
        icon: <XCircle className="w-5 h-5 text-red-600" />
      }

    case "CANCELLED":
      return {
        title: "Booking Cancelled",
        description: "This booking was cancelled.",
        bg: "bg-slate-50",
        border: "border-slate-200",
        icon: <AlertCircle className="w-5 h-5 text-slate-500" />
      }

    case "AWAITING_FACULTY":
      return {
        title: "Waiting for Faculty Approval",
        description: "This booking was not approved. See admin comments below",
        bg: "bg-blue-50",
        border: "border-blue-100",
        icon: <Clock3 className="w-5 h-5 text-blue-600" />
      }

    case "FACULTY_ESCALATED":
      return {
        title: booking.faculty_timed_out ? "Escalated to Admin" : "Sent for Final Approval",
        description: booking.faculty_timed_out 
          ? "Faculty did not respond in time, so this request was automatically escalated for admin review."
          : "Faculty has approved this request and sent it for final approval.",
        bg: "bg-purple-50",
        border: "border-purple-100",
        icon: <AlertCircle className="w-5 h-5 text-purple-600" />
      }

    default:
      return {
        title: "Status Unavailable",
        description: "Booking status information unavailable.",
        bg: "bg-slate-50",
        border: "border-slate-200",
        icon: <AlertCircle className="w-5 h-5 text-slate-500" />
      }
  }
}
// ─────────────────────────────────────────────────────────────
// Booking Card Component
// ─────────────────────────────────────────────────────────────

const BookingCard = ({
  booking,
  onEdit,
  onCancel,
  isActionLoading,
  getStatusBadge,
  isHighlighted,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasEquipment =
    booking.equipment_requests && booking.equipment_requests.length > 0

  const hasNotes =
    booking.user_notes && booking.user_notes.trim().length > 0

  const isExpired = booking.status === "COMPLETED" || new Date(booking.end_datetime) < new Date()

  const showEditCancel =
    booking.can_modify &&
    (booking.status === "PENDING" || booking.status === "APPROVED") &&
    !isExpired

  const statusMeta = getBookingStatusMeta(booking)

  return (
    <div
      data-booking-reference={booking.reference_code || ""}
      className={`
        rounded-3xl border transition-all duration-300 overflow-hidden
        ${
          isHighlighted
            ? "border-green-400 bg-white shadow-xl ring-4 ring-green-100"
            : isExpanded
            ? "border-emerald-200 bg-white shadow-lg ring-2 ring-emerald-50"
            : "border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300"
        }
      `}
    >
      {/* CLICKABLE HEADER */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer px-4 py-4 md:px-8 md:py-7 select-none"
      >
        {/* TOP ROW */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="flex items-center flex-wrap gap-3">
            {getStatusBadge(booking.status)}

            {booking.attendee_count > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-100">
                <Users className="w-4 h-4 text-green-700" />
                <span className="text-[13px] font-semibold text-green-800">
                  {booking.attendee_count}{" "}
                  {booking.attendee_count === 1 ? "person" : "people"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <span className="text-[13px] font-medium text-gray-500">
              Submitted {timeAgo(getSubmissionTimestamp(booking))}
            </span>

            <Tooltip text={isExpanded ? "Collapse this booking card." : "Expand to see full details, notes, and actions for this booking."} position="top">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 transition cursor-pointer">
                <span className="text-[13px] font-medium text-gray-500">
                  {isExpanded ? "Hide Details" : "View Details"}
                </span>

                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </Tooltip>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
          {/* SPACE */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-3">
              Venue
            </p>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 md:w-6 md:h-6 text-green-700" />
              </div>

              <div>
                <h3 className="text-[15px] md:text-[18px] font-bold text-gray-900 leading-tight">
                  {booking.space_details?.name || "Unknown Venue"}
                </h3>

                <p className="text-[14px] text-gray-500 mt-1 capitalize">
                  {booking.space_details?.space_type?.replace("_", " ") ||
                    "Workspace"}
                </p>
              </div>
            </div>
          </div>

          {/* TIMELINE */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-3">
              Schedule
            </p>

            <div className="relative pl-5 md:pl-7">
              <div className="absolute left-[10px] top-4 bottom-4 w-px bg-gray-200"></div>

              {/* START */}
              <div className="relative flex items-start gap-4 mb-4 md:mb-6">
                <span className="absolute left-[-17px] top-2.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></span>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 mb-1">
                    Starts
                  </p>

                  <p className="text-[15px] font-semibold text-gray-900">
                    {formatDateTime(booking.start_datetime)}
                  </p>
                </div>
              </div>

              {/* END */}
              <div className="relative flex items-start gap-4">
                <span className="absolute left-[-17px] top-2.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow"></span>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500 mb-1">
                    Ends
                  </p>

                  <p className="text-[15px] font-semibold text-gray-900">
                    {formatDateTime(booking.end_datetime)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* STATUS */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-3">
              Current Status
            </p>

            <div
              className={`rounded-xl md:rounded-2xl border p-2.5 md:p-4 ${statusMeta.bg} ${statusMeta.border}`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{statusMeta.icon}</div>

                <div>
                  <h4 className="text-[15px] font-semibold text-gray-900">
                    {statusMeta.title}
                  </h4>

                  <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">
                    {statusMeta.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
{isExpanded && (
  <div className="px-4 pb-4 md:px-8 md:pb-5 animate-in fade-in slide-in-from-top-2 duration-200">
    <div className="border-t border-gray-200 pt-4">

      {/* PURPOSE */}
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-2">
          Purpose of Booking
        </p>

        <div className="rounded-xl border border-green-100 bg-green-50 p-2.5 md:p-3">
          <p className="text-[14px] text-green-900 font-medium leading-relaxed">
            {booking.purpose_of_booking ||
              booking.purpose ||
              "No purpose provided."}
          </p>
        </div>
      </div>

      {/* EQUIPMENT */}
      {hasEquipment && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-2">
            Equipment Requested
          </p>

          <div className="flex flex-wrap gap-2">
            {booking.equipment_requests.map((er) => (
              <div
                key={er.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <Package className="w-3.5 h-3.5 text-gray-600" />

                <span className="text-[13px] font-medium text-gray-800">
                  {er.equipment_name}
                </span>

                {er.quantity > 1 && (
                  <span className="text-[12px] text-gray-500">
                    × {er.quantity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTES */}
      {hasNotes && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-2">
            Additional Notes
          </p>

          <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-2.5 md:p-3">
            <p className="text-[13px] text-gray-700 leading-relaxed">
              {booking.user_notes}
            </p>
          </div>
        </div>
      )}

      {/* ADMIN FEEDBACK */}
      {booking.status === "REJECTED" && booking.remarks_by_admin && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-2">
            Admin Feedback
          </p>

          <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 md:p-3">
            <p className="text-[13px] italic text-red-900 leading-relaxed">
              "{booking.remarks_by_admin}"
            </p>
          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div className="border-t border-gray-200 pt-4 flex justify-end flex-wrap gap-3">
        {!showEditCancel && booking.status !== "REJECTED" && (
          <p className="mr-auto text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 self-center">
            {isExpired ? "Booking Completed" : "No Further Actions"}
          </p>
        )}

        {showEditCancel && (
          <Tooltip text="Withdraw this booking request. This cannot be undone." position="top">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel(booking.id)
              }}
              disabled={isActionLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              {isActionLoading ? "Processing..." : "Cancel Request"}
            </button>
          </Tooltip>
        )}

        {showEditCancel && (
          <Tooltip
            text={
              booking.status === "APPROVED"
                ? "Change your booking details. Note: edits to an approved booking will need admin re-approval."
                : "Update the details of this pending booking request."
            }
            position="top"
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(booking)
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-[13px] font-semibold hover:bg-green-700 transition-all"
            >
              <Pencil className="w-4 h-4" />
              {booking.status === "APPROVED"
                ? "Edit & Re-submit"
                : "Edit Details"}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  </div>
)}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

const MyBookingsPage = () => {
  const { referenceCode } = useParams()
  const { data: myBookingsData, isLoading, isError, refetch: refreshData } = useMySpaceBookings();
  const myBookings = myBookingsData || [];
  const error = isError ? "Failed to load your booking history." : null;
  const [isActionLoading, setIsActionLoading] = useState(false)

  // MODAL STATE
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [cancelBookingId, setCancelBookingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState("ALL")

  // SEARCH
  const [searchTerm, setSearchTerm] = useState(referenceCode ?? "")

  useEffect(() => {
    if (!referenceCode) return undefined

    const timer = window.setTimeout(() => {
      setSearchTerm(referenceCode)
      setStatusFilter("ALL")
    }, 0)

    return () => window.clearTimeout(timer)
  }, [referenceCode])

  // ───────────────────────────────────────────────────────────
  // FILTER BOOKINGS
  // ───────────────────────────────────────────────────────────

const filteredBookings = useMemo(() => {
  let filtered = myBookings

  // SEARCH
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase()

    filtered = filtered.filter((booking) => {
      const hall = booking.space_details?.name?.toLowerCase() || ""
      const reference = booking.reference_code?.toLowerCase() || ""
      const purpose = booking.purpose_of_booking?.toLowerCase() || ""
      const status = booking.status?.toLowerCase() || ""

      return (
        hall.includes(q) ||
        reference.includes(q) ||
        purpose.includes(q) ||
        status.includes(q)
      )
    })
  }

  // STATUS FILTER
  if (statusFilter !== "ALL") {
    const now = new Date()

    filtered = filtered.filter((booking) => {
      if (statusFilter === "PENDING") {
        return booking.status === "PENDING"
      }

      if (statusFilter === "ACTIVE") {
        return (
          booking.status === "APPROVED" &&
          new Date(booking.end_datetime) > now
        )
      }

      if (statusFilter === "COMPLETED") {
        return booking.status === "COMPLETED" || (
          booking.status === "APPROVED" &&
          new Date(booking.end_datetime) < now
        )
      }

      return true
    })
  }

  return filtered
}, [myBookings, searchTerm, statusFilter])

  useEffect(() => {
    if (!referenceCode || isLoading || filteredBookings.length === 0) return undefined

    const timer = window.setTimeout(() => {
      const target = Array.from(document.querySelectorAll("[data-booking-reference]"))
        .find((element) => element.getAttribute("data-booking-reference") === referenceCode)

      target?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 80)

    return () => window.clearTimeout(timer)
  }, [filteredBookings, isLoading, referenceCode])

  // ───────────────────────────────────────────────────────────
  // DASHBOARD STATS
  // ───────────────────────────────────────────────────────────

  const dashboardStats = useMemo(() => {
    const now = new Date()

    const total = myBookings.length

    const pending = myBookings.filter(
      (booking) => booking.status === "PENDING"
    ).length

    const approved = myBookings.filter(
      (booking) =>
        booking.status === "APPROVED" &&
        new Date(booking.end_datetime) > now
    ).length

    const completed = myBookings.filter(
      (booking) =>
        booking.status === "COMPLETED" ||
        (
          booking.status === "APPROVED" &&
          booking.end_datetime &&
          new Date(booking.end_datetime) < now
        )
    ).length

    return {
      total,
      pending,
      approved,
      completed,
    }
  }, [myBookings])

  // ───────────────────────────────────────────────────────────
  // CANCEL BOOKING
  // ───────────────────────────────────────────────────────────

const cancelMutation = useCancelSpaceBooking()

const handleCancelBooking = (id) => {
  setCancelBookingId(id)
}

const confirmCancelBooking = async () => {
  if (!cancelBookingId) return

  setIsActionLoading(true)

  try {
    await cancelMutation.mutateAsync(cancelBookingId)
    setCancelBookingId(null)
  } catch {
    toast.error("Booking could not be cancelled. Please try again.")
  } finally {
    setIsActionLoading(false)
  }
}

  // ───────────────────────────────────────────────────────────
  // EDIT BOOKING
  // ───────────────────────────────────────────────────────────

  const handleEditClick = (booking) => {
    setSelectedBooking(booking)
    setIsEditModalOpen(true)
  }

  // ───────────────────────────────────────────────────────────
  // STATUS BADGE
  // ───────────────────────────────────────────────────────────

  const getStatusBadge = (status) => {
    const badgeMap = {
      APPROVED: {
        classes:
          "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        label: "Approved",
      },

      REJECTED: {
        classes:
          "bg-red-50 text-red-700 border-red-200",
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: "Rejected",
      },

      CANCELLED: {
        classes:
          "bg-slate-50 text-slate-700 border-slate-200",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: "Cancelled",
      },

      EXPIRED: {
        classes:
          "bg-orange-50 text-orange-700 border-orange-200",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: "Expired",
      },

      COMPLETED: {
        classes:
          "bg-slate-50 text-slate-700 border-slate-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        label: "Completed",
      },

      PENDING: {
        classes:
          "bg-yellow-50 text-yellow-700 border-yellow-200",
        icon: <Clock3 className="w-3.5 h-3.5" />,
        label: "Pending Review",
      },

      AWAITING_FACULTY: {
        classes: "bg-blue-50 text-blue-700 border-blue-200",
        icon: <Clock3 className="w-3.5 h-3.5" />,
        label: "Awaiting Faculty",
      },

      FACULTY_ESCALATED: {
        classes: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <Clock3 className="w-3.5 h-3.5" />,
        label: "Escalated",
      },
    }

    const config = badgeMap[status] || badgeMap.PENDING

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[11px] font-bold uppercase tracking-[0.08em] ${config.classes}`}
      >
        {config.icon}
        {config.label}
      </span>
    )
  }
  
    return (
      
    <MainLayout>
      
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div className="max-w-[1450px] mx-auto w-full px-3 md:px-6 py-4 md:py-8">

          {/* PAGE HEADER */}
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 md:gap-6 mb-5 md:mb-8">
            {/* LEFT */}
            <div>
              <h1 className="text-[24px] md:text-[34px] font-bold tracking-tight text-gray-900 leading-none">
                My Bookings
              </h1>

              <p className="text-[13px] md:text-[15px] text-gray-600 mt-2 md:mt-3 max-w-2xl">
                View and manage all your venue bookings in one place.
              </p>
            </div>

            {/* RIGHT CONTROLS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full xl:w-auto">
              {/* SEARCH */}
              <div className="relative w-full sm:w-[340px]">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="w-4 h-4 text-gray-400" />
                </div>

                <input
                  type="text"
                  placeholder="Search by reference, venue, purpose, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="
                    w-full
                    pl-11
                    pr-11
                    py-2.5 md:py-3
                    rounded-2xl
                    border
                    border-gray-200
                    bg-white
                    text-[14px]
                    outline-none
                    shadow-sm
                    transition-all
                    focus:ring-4
                    focus:ring-emerald-50
                    focus:border-emerald-400
                    placeholder:text-gray-400
                  "
                />

                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 transition"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* REFRESH */}
              <button
                onClick={() => window.location.reload()}
                disabled={isLoading}
                className="
                  inline-flex
                  items-center
                  justify-center
                  gap-2
    px-4 md:px-6
py-2.5 md:py-3
rounded-xl md:rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  text-[14px]
                  font-semibold
                  text-gray-700
                  shadow-sm
                  hover:bg-gray-50
                  hover:shadow-md
                  transition-all
                  disabled:opacity-40
                "
              >
                <RefreshCcw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>



          {/* BOOKINGS PANEL */}
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* PANEL HEADER */}
            <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-gray-200">
              <div>
                <h2 className="text-[18px] md:text-[22px] font-bold text-gray-900">
                  Booking History
                </h2>
              </div>

<div className="hidden md:flex items-center gap-3 flex-wrap">
  <button
    onClick={() => setStatusFilter("ALL")}
    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      statusFilter === "ALL"
        ? "bg-green-600 text-white shadow-sm"
        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
    }`}
  >
    All ({myBookings.length})
  </button>

  <button
    onClick={() => setStatusFilter("PENDING")}
    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      statusFilter === "PENDING"
        ? "bg-green-600 text-white shadow-sm"
        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
    }`}
  >
    Pending ({dashboardStats.pending})
  </button>

  <button
    onClick={() => setStatusFilter("ACTIVE")}
    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      statusFilter === "ACTIVE"
        ? "bg-green-600 text-white shadow-sm"
        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
    }`}
  >
    Active ({dashboardStats.approved})
  </button>

  <button
    onClick={() => setStatusFilter("COMPLETED")}
    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      statusFilter === "COMPLETED"
        ? "bg-green-600 text-white shadow-sm"
        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
    }`}
  >
    Completed ({dashboardStats.completed})
  </button>
</div>
            </div>
                        {/* CONTENT STATES */}
            {isLoading ? (
              <div className="bg-slate-50 p-2 md:p-6 flex flex-col gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-3xl border border-gray-200 bg-white p-6 animate-pulse">
                    <div className="flex justify-between mb-6">
                      <div className="h-6 w-32 bg-gray-100 rounded-full"></div>
                      <div className="h-4 w-24 bg-gray-100 rounded"></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div><div className="h-3 w-16 bg-gray-100 rounded mb-3"></div><div className="flex gap-4"><div className="w-14 h-14 bg-gray-100 rounded-2xl"></div><div><div className="h-5 w-32 bg-gray-100 rounded mb-2"></div><div className="h-4 w-24 bg-gray-100 rounded"></div></div></div></div>
                      <div><div className="h-3 w-16 bg-gray-100 rounded mb-3"></div><div className="h-12 w-full bg-gray-100 rounded"></div></div>
                      <div><div className="h-3 w-16 bg-gray-100 rounded mb-3"></div><div className="h-16 w-full bg-gray-100 rounded-xl"></div></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="py-28 text-center px-8">
                <div className="w-16 h-16 rounded-2xl md:rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>

                <h3 className="text-[18px] font-bold text-gray-900 mb-2">
                  Something went wrong
                </h3>

                <p className="text-[14px] text-gray-500 mb-6">
                  {error}
                </p>

                <button
                  onClick={() => window.location.reload()}
                  className="
                    inline-flex
                    items-center
                    gap-2
                    px-5
                    py-3
                    rounded-2xl
                    bg-green-600
                    text-white
                    text-[14px]
                    font-semibold
                    hover:bg-green-700
                    transition-all
                  "
                >
                  <RefreshCcw className="w-4 h-4" />
                  Reload Page
                </button>
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="py-28 text-center px-8">
                <div className="w-16 h-16 rounded-2xl md:rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-5">
                  <CalendarClock className="w-6 h-6 text-slate-600" />
                </div>

                <h3 className="text-[20px] font-bold text-gray-900 mb-2">
                  {searchTerm
                    ? "No matching bookings found"
                    : "No bookings yet"}
                </h3>

                <p className="text-[14px] text-gray-500 max-w-md mx-auto leading-relaxed mb-6">
                  {searchTerm
                    ? "Try changing your search keywords or removing filters to see more booking records."
                    : "Your bookings will appear here once you make one."}
                </p>

                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="
                      inline-flex
                      items-center
                      gap-2
                      px-5
                      py-3
                      rounded-2xl
                      border
                      border-gray-200
                      bg-white
                      text-[14px]
                      font-semibold
                      text-gray-700
                      hover:bg-gray-50
                      transition-all
                    "
                  >
                    <XIcon className="w-4 h-4" />
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-2 md:p-6">
                <div className="flex flex-col gap-5">
                  {filteredBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onEdit={handleEditClick}
                      onCancel={handleCancelBooking}
                      isActionLoading={isActionLoading}
                      getStatusBadge={getStatusBadge}
                      isHighlighted={referenceCode === booking.reference_code}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
                  </div>
      </div>

{/* EDIT MODAL */}
{isEditModalOpen && selectedBooking && (
  <BookingModal
    spaceId={selectedBooking.space}
    spaceName={selectedBooking.space_details?.name}
    initialData={selectedBooking}
    onClose={() => {
      setIsEditModalOpen(false)
      setSelectedBooking(null)
    }}
  />
)}

{/* CANCEL CONFIRMATION MODAL */}
{cancelBookingId && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
    <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-200 p-7 animate-in fade-in zoom-in-95 duration-200">

      <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
        <TriangleAlert className="w-8 h-8 text-red-600" />
      </div>

      <div className="text-center">
        <h3 className="text-[22px] font-bold text-gray-900 mb-2">
          Cancel this booking?
        </h3>

        <p className="text-[14px] text-gray-500 leading-relaxed">
          This will cancel your booking and make the venue available for others.
        </p>
      </div>

      <div className="mt-7 flex gap-3">
        <button
          onClick={() => setCancelBookingId(null)}
          disabled={isActionLoading}
          className="
            flex-1
            px-5
            py-3
            rounded-2xl
            border
            border-gray-200
            bg-white
            text-[14px]
            font-semibold
            text-gray-700
            hover:bg-gray-50
            transition-all
          "
        >
          Keep Booking
        </button>

        <button
          onClick={confirmCancelBooking}
          disabled={isActionLoading}
          className="
            flex-1
            px-5
            py-3
            rounded-2xl
            bg-red-600
            text-white
            text-[14px]
            font-semibold
            hover:bg-red-700
            transition-all
            disabled:opacity-50
          "
        >
          {isActionLoading ? "Cancelling booking..." : "Cancel Request"}
        </button>
      </div>
    </div>
  </div>
)}

</MainLayout>
  )
}

export default MyBookingsPage