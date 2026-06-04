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
        title: "Faculty Approval Pending",
        description: "Your booking is currently pending review by your faculty sponsor.",
        bg: "bg-blue-50",
        border: "border-blue-100",
        icon: <Clock3 className="w-5 h-5 text-blue-600" />
      }

    case "FACULTY_ESCALATED":
      return {
        title: booking.faculty_timed_out ? "Escalated to Admin" : "Final Approval Pending",
        description: booking.faculty_timed_out 
          ? "Faculty did not respond in time, so this request was automatically escalated for admin review."
          : "Faculty has approved this request. It is now pending final administrative approval.",
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
// Avatar Component
// ─────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name) {
  const colors = ['bg-blue-600','bg-violet-600','bg-pink-600','bg-teal-600','bg-orange-600','bg-cyan-600','bg-indigo-600']
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  return colors[idx]
}

function Avatar({ name, size = 'md', imageUrl = null }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-[42px] h-[42px] text-sm' : 'w-10 h-10 text-sm'
  
  const getProfileImageUrl = (path) => {
    if (!path) return ""
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    return `http://localhost:8000${path.startsWith("/") ? "" : "/"}${path}`
  }

  return (
    <div className={`${sz} ${!imageUrl ? avatarColor(name) : 'bg-gray-100'} rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-gray-100 overflow-hidden select-none`}>
      {imageUrl ? (
        <img src={getProfileImageUrl(imageUrl)} alt={name || "User"} className="w-full h-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Booking Card Component
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Booking Detail Drawer
// ─────────────────────────────────────────────────────────────
const SideDetailRow = ({ icon: Icon, label, value }) => {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-900 font-medium leading-snug break-words">{value}</p>
      </div>
    </div>
  )
}

const BookingDetailDrawer = ({
  booking,
  onClose,
  onEdit,
  onCancel,
  isActionLoading,
}) => {
  const isExpired =
    booking.status === "COMPLETED" ||
    booking.status === "EXPIRED" ||
    booking.status === "CANCELLED" ||
    new Date(booking.end_datetime) < new Date()

  const editableStatuses = [
    "PENDING",
    "APPROVED",
    "AWAITING_FACULTY",
    "FACULTY_ESCALATED"
  ]

  const showEditCancel =
    editableStatuses.includes(booking.status) &&
    !isExpired

  const getTimelineSteps = () => {
    const steps = []
    
    steps.push({
      label: "Booking Submitted",
      desc: formatDateTime(getSubmissionTimestamp(booking)),
      icon: "check",
      bg: "bg-green-500",
      iconColor: "text-green-600"
    })

    if (booking.status === "CANCELLED") {
      steps.push({ label: "Cancelled by User", desc: "", icon: "cross", bg: "bg-red-500", iconColor: "text-red-600" })
      return steps
    }
    
    if (booking.status === "REJECTED") {
      steps.push({ label: "Rejected", desc: "", icon: "cross", bg: "bg-red-500", iconColor: "text-red-600" })
      return steps
    }

    const hasFaculty = !!booking.faculty_sponsor

    if (hasFaculty) {
      if (booking.status === "AWAITING_FACULTY" || booking.status === "PENDING") {
        steps.push({ label: "Faculty Review", desc: "Pending", icon: "dot", bg: "bg-yellow-400", iconColor: "text-yellow-600" })
        steps.push({ label: "Final Venue Approval", desc: "Pending", icon: "dot", bg: "bg-gray-300", iconColor: "text-gray-400" })
        return steps
      } else {
        steps.push({ label: "Faculty Approved", desc: "", icon: "check", bg: "bg-green-500", iconColor: "text-green-600" })
      }
    }

    if (booking.status === "FACULTY_ESCALATED" || (!hasFaculty && booking.status === "PENDING")) {
      steps.push({ label: "Final Venue Approval", desc: "Pending", icon: "dot", bg: "bg-yellow-400", iconColor: "text-yellow-600" })
      return steps
    }

    if (booking.status === "APPROVED" || booking.status === "COMPLETED") {
      steps.push({ label: "Venue Approved", desc: "", icon: "check", bg: "bg-green-500", iconColor: "text-green-600" })
      steps.push({ label: "Booking Confirmed", desc: "", icon: "check", bg: "bg-green-500", iconColor: "text-green-600" })
      return steps
    }

    // Default fallback
    const fallbackLabels = {
      AWAITING_FACULTY: "Faculty Approval Pending",
      FACULTY_ESCALATED: "Final Approval Pending",
      REJECTED: "Rejected",
      CONFIRMED: "Approved",
      APPROVED: "Approved"
    }
    steps.push({ label: fallbackLabels[booking.status] || booking.status, desc: "", icon: "dot", bg: "bg-gray-400", iconColor: "text-gray-600" })
    return steps
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-[110] w-full md:w-[500px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
            <p className="text-xs text-gray-500 mt-1">Ref: {booking.reference_code}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-full transition"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white hide-scrollbar pb-10">
          
          {/* Status & Timeline */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 pb-2">Approval Timeline</p>
            <div className="px-2">
              <div className="relative border-l-2 border-gray-100 pl-6 pb-2 space-y-6">
                
                {getTimelineSteps().map((step, idx) => (
                  <div key={idx} className="relative">
                    <span className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${step.bg}`} />
                    <p className="text-xs font-bold text-gray-900 uppercase flex items-center">
                      {step.icon === 'check' && <span className={`${step.iconColor} mr-1.5 text-[14px]`}>✓</span>}
                      {step.icon === 'cross' && <span className={`${step.iconColor} mr-1.5 text-[14px]`}>✕</span>}
                      {step.icon === 'dot' && <span className={`${step.iconColor} mr-1.5 text-[14px]`}>●</span>}
                      {step.label}
                    </p>
                    {step.desc && <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>}
                  </div>
                ))}

              </div>
            </div>
          </section>

          {/* Details */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 pb-2">Schedule & Venue</p>
            <div className="space-y-4">
              <SideDetailRow icon={Building2} label="Venue" value={booking.space_details?.name} />
              <SideDetailRow icon={CalendarDays} label="Start" value={formatDateTime(booking.start_datetime)} />
              <SideDetailRow icon={CalendarDays} label="End" value={formatDateTime(booking.end_datetime)} />
              {booking.setup_buffer_minutes > 0 && <SideDetailRow icon={Clock3} label="Setup Time" value={`${booking.setup_buffer_minutes} mins`} />}
              {booking.cleanup_buffer_minutes > 0 && <SideDetailRow icon={Clock3} label="Cleanup Time" value={`${booking.cleanup_buffer_minutes} mins`} />}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 pb-2">Event Info</p>
            <div className="space-y-4">
              <SideDetailRow icon={Users} label="Expected Attendees" value={booking.attendee_count} />
              <SideDetailRow icon={CalendarClock} label="Event Type" value={booking.is_internal ? "Internal Event" : "External Event"} />
              <SideDetailRow icon={Building2} label="Department" value={booking.department_details?.name || booking.department?.name || booking.booked_by_department || booking.department_name || booking.department || "Not specified"} />
              
              {(booking.faculty_sponsor_name || booking.faculty_sponsor) ? (
                <div className="flex items-center gap-3">
                  <div className="mt-0.5 shrink-0">
                    <Avatar 
                      name={booking.faculty_sponsor_name || booking.faculty_sponsor} 
                      size="sm" 
                      imageUrl={
                        booking?.faculty_sponsor_details?.profile_picture ||
                        booking?.faculty_sponsor?.profile_picture ||
                        booking?.faculty_details?.profile_picture ||
                        booking?.faculty_sponsor_details?.profile_image ||
                        booking?.faculty_sponsor?.profile_image ||
                        booking?.faculty_details?.profile_image ||
                        booking?.faculty_sponsor_profile_image
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Faculty Sponsor</p>
                    <p className="text-sm text-gray-900 font-medium leading-snug break-words">{booking.faculty_sponsor_name || booking.faculty_sponsor}</p>
                  </div>
                </div>
              ) : (
                <SideDetailRow icon={Users} label="Faculty Sponsor" value="None" />
              )}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 pb-2">Purpose & Notes</p>
            <div className="space-y-4">
              <SideDetailRow icon={Package} label="Purpose" value={booking.purpose_of_booking || booking.purpose} />
              <SideDetailRow icon={Package} label="Notes" value={booking.user_notes} />
              {booking.equipment_requests?.length > 0 && (
                <SideDetailRow icon={Package} label="Equipment" value={booking.equipment_requests.map(e => `${e.equipment_name} (x${e.quantity})`).join(", ")} />
              )}
            </div>
          </section>

          {booking.remarks_by_admin && (
             <section>
               <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 pb-2">Admin Remarks</p>
               <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                 <p className="text-sm text-red-900 font-medium">{booking.remarks_by_admin}</p>
               </div>
             </section>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-5 bg-gray-50/80 backdrop-blur-md">
          {showEditCancel ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => { onClose(); onEdit(booking); }}
                disabled={isActionLoading}
                className="flex-[2] flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm shadow-sm"
              >
                <Pencil className="w-5 h-5" />
                Edit Booking Details
              </button>
              <button
                onClick={() => { onClose(); onCancel(booking.id); }}
                disabled={isActionLoading}
                className="flex-1 flex items-center justify-center gap-2 border border-red-200 bg-white text-red-700 hover:bg-red-50 font-semibold py-3 rounded-xl transition text-sm shadow-sm"
              >
                <Trash2 className="w-5 h-5" />
                Cancel Request
              </button>
            </div>
          ) : (
            <div className="text-center py-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                {isExpired ? "Booking Completed" : "NO FURTHER ACTIONS"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Booking Card Component
// ─────────────────────────────────────────────────────────────

const BookingCard = ({
  booking,
  onViewDetails,
  getStatusBadge,
  isHighlighted,
}) => {
  const statusMeta = getBookingStatusMeta(booking)

  return (
    <div
      data-booking-reference={booking.reference_code || ""}
      className={`
        rounded-3xl border transition-all duration-300 overflow-hidden
        ${
          isHighlighted
            ? "border-green-400 bg-white shadow-xl ring-4 ring-green-100"
            : "border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300"
        }
      `}
    >
      <div className="px-4 py-4 md:px-8 md:py-7">
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
            {booking._recurring_day_count > 1 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <span className="text-[13px] font-semibold text-blue-700">
                  {booking._recurring_day_count} days
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <span className="text-[13px] font-medium text-gray-500">
              Submitted {timeAgo(getSubmissionTimestamp(booking))}
            </span>

            <button
              onClick={() => onViewDetails(booking)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition text-[13px] font-semibold text-gray-700 shadow-sm"
            >
              View Details
            </button>
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

              {/* RECURRING daily hours note */}
              {booking._recurring_day_count > 1 && (() => {
                const startTime = new Date(booking.start_datetime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                const endTime = new Date(booking.end_datetime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                return (
                  <p className="text-[12px] text-blue-600 font-medium mt-3">
                    Daily {startTime} – {endTime}
                  </p>
                )
              })()}
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
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null)
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
  // ── Collapse RECURRING siblings into one representative booking ──
  // Each RECURRING group shares the same group_id. We show it as one card
  // spanning from the first day's start to the last day's end.
  const collapseGroups = (bookings) => {
    const groups = {}
    const singles = []

    bookings.forEach((b) => {
      if (b.booking_type === "RECURRING" && b.group_id) {
        if (!groups[b.group_id]) groups[b.group_id] = []
        groups[b.group_id].push(b)
      } else {
        singles.push(b)
      }
    })

    const collapsed = Object.values(groups).map((siblings) => {
      const sorted = [...siblings].sort(
        (a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)
      )
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      // Representative: first row with end patched to last row's end
      return {
        ...first,
        end_datetime: last.end_datetime,
        _recurring_siblings: sorted,
        _recurring_day_count: sorted.length,
      }
    })

    return [...singles, ...collapsed]
  }

  let filtered = collapseGroups(myBookings)

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
        return [
          "PENDING",
          "AWAITING_FACULTY",
          "FACULTY_ESCALATED"
        ].includes(booking.status)
      }

      if (statusFilter === "ACTIVE") {
        const endDate = new Date(
          booking.end_datetime || booking.end_time || booking.end
        )
        return (
          [
            "APPROVED",
            "CONFIRMED",
            "ACTIVE"
          ].includes(booking.status) &&
          endDate > now
        )
      }

      if (statusFilter === "COMPLETED") {
        const endDate = new Date(
          booking.end_datetime || booking.end_time || booking.end
        )
        return (
          [
            "APPROVED",
            "CONFIRMED",
            "ACTIVE",
            "COMPLETED"
          ].includes(booking.status) &&
          endDate < now
        )
      }

      if (statusFilter === "REJECTED") {
        return [
          "REJECTED",
          "DECLINED",
          "FACULTY_REJECTED",
          "VENUE_REJECTED"
        ].includes(booking.status)
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

    // Count RECURRING groups as one booking each
  const seenGroups = new Set()
  const total = myBookings.filter((b) => {
    if (b.booking_type === "RECURRING" && b.group_id) {
      if (seenGroups.has(b.group_id)) return false
      seenGroups.add(b.group_id)
    }
    return true
  }).length

    const pending = myBookings.filter(
      (booking) => [
        "PENDING",
        "AWAITING_FACULTY",
        "FACULTY_ESCALATED"
      ].includes(booking.status)
    ).length

    const approved = myBookings.filter((booking) => {
      const endDate = new Date(
        booking.end_datetime || booking.end_time || booking.end
      )
      return (
        [
          "APPROVED",
          "CONFIRMED",
          "ACTIVE"
        ].includes(booking.status) &&
        endDate > now
      )
    }).length

    const completed = myBookings.filter((booking) => {
      const endDate = new Date(
        booking.end_datetime || booking.end_time || booking.end
      )
      return (
        [
          "APPROVED",
          "CONFIRMED",
          "ACTIVE",
          "COMPLETED"
        ].includes(booking.status) &&
        endDate < now
      )
    }).length

    const rejected = myBookings.filter((booking) =>
      [
        "REJECTED",
        "DECLINED",
        "FACULTY_REJECTED",
        "VENUE_REJECTED"
      ].includes(booking.status)
    ).length

    return {
      total,
      pending,
      approved,
      completed,
      rejected,
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

      CONFIRMED: {
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
        label: "Faculty Approval Pending",
      },

      FACULTY_ESCALATED: {
        classes: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <Clock3 className="w-3.5 h-3.5" />,
        label: "Final Approval Pending",
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
      
      <div className="mx-auto w-full max-w-[1280px] space-y-6">

        {/* PAGE HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* LEFT */}
          <div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              My Bookings
            </h1>

            <p className="mt-2 text-sm text-gray-600">
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

  <button
    onClick={() => setStatusFilter("REJECTED")}
    className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      statusFilter === "REJECTED"
        ? "bg-green-600 text-white shadow-sm"
        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
    }`}
  >
    Rejected ({dashboardStats.rejected})
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
                      onViewDetails={(b) => setSelectedBookingDetails(b)}
                      getStatusBadge={getStatusBadge}
                      isHighlighted={referenceCode === booking.reference_code}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
      </div>

{/* BOOKING DETAILS DRAWER */}
{selectedBookingDetails && (
  <BookingDetailDrawer
    booking={selectedBookingDetails}
    onClose={() => setSelectedBookingDetails(null)}
    onEdit={handleEditClick}
    onCancel={handleCancelBooking}
    isActionLoading={isActionLoading}
  />
)}

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