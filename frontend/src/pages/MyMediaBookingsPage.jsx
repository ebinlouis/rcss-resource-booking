import { useState, useEffect, useMemo } from "react"
import toast from 'react-hot-toast'

import MainLayout from "../layouts/MainLayout"
import MediaBookingModal from "../components/MediaBookingModal" 
import { useNavigate, useSearchParams } from "react-router-dom"
import { getSubmissionTimestamp } from "../utils/submissionTime"

import {
  RefreshCcw,
  Trash2,
  Pencil,
  Search,
  X as XIcon,
  Package,
  ChevronDown,
  Building2,
  Wrench,
  Clapperboard,
  ArrowLeft,
  Users,
  Phone,
} from "lucide-react"

import mediaApi from "../api/mediaApi"
import { useMyMediaBookings, useCancelMediaBooking } from "../hooks/useMediaQueries"
// ─── Utilities ────────────────────────────────────────────────────────────────

// UPDATED: Now accepts a single ISO string instead of splitting date and time
const formatDateTime = (isoString) => {
  if (!isoString) return 'TBD';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'TBD';
  
  return new Intl.DateTimeFormat('en-IN', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
};

const timeAgo = (isoString) => {
  if (!isoString) return '';
  const mins = Math.round((Date.now() - new Date(isoString)) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

// UPDATED: Now checks expiration using the new teardown_end_datetime
const checkIsExpired = (booking) => {
  if (booking.status === "COMPLETED" || booking.status === "EXPIRED") return true;
  try {
      const endString = booking.teardown_end_datetime || booking.event_end_datetime;
      if (endString) {
          return new Date(endString) < new Date();
      }
  } catch (e) {
      console.error(e);
  }
  return false;
};

const normaliseReference = (value) => String(value || "").trim().toUpperCase();

// ─── Booking Card Component (Media Style) ─────────────────────────────────────

const BookingCard = ({ booking, onEdit, onCancel, isActionLoading, getStatusBadge, navigate, isHighlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isHighlighted) return undefined;
    const timer = window.setTimeout(() => setIsExpanded(true), 0);
    return () => window.clearTimeout(timer);
  }, [isHighlighted]);

  const equipment    = booking.equipment_requests ?? [];
  const hasEquipment = equipment.length > 0;
  const hasServices  = Boolean(booking.requested_services?.trim());
  const hasNotes     = Boolean(booking.user_notes?.trim());
  
  const isExpired = checkIsExpired(booking);

  // Media allows modification if PENDING or APPROVED
  const showEditCancel = booking.can_modify !== false && (booking.status === "PENDING" || booking.status === "APPROVED") && !isExpired;

  const spaceName = booking.space_details?.name || 'Any suitable venue';
  const location  = booking.space_details?.location || 'Location not specified';

  return (
    <div
      data-booking-reference={booking.reference_code || ""}
      className={`px-7 border-b border-gray-100 last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-[#f8fafc]' : 'bg-white hover:bg-[#f8fafc]'} ${isHighlighted ? 'ring-2 ring-emerald-300 ring-inset bg-emerald-50/70' : ''}`}
    >
      
      {/* CLICKABLE QUICK-GLANCE HEADER */}
      <div 
        className="py-6 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Top strip */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-2.5 flex-wrap">
            {getStatusBadge(booking.status, isExpired)}
            <span className="font-mono text-[13.5px] font-semibold text-emerald-900 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 tracking-wide ml-2">
                {booking.reference_code}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-gray-500 font-medium">Submitted {timeAgo(getSubmissionTimestamp(booking))}</span>
            <div className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
              <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* 3-col info grid (Always Visible) */}
        <div className="grid gap-7 grid-cols-1 md:grid-cols-3" style={{ gridTemplateColumns: '1.8fr 1.6fr 2.6fr' }}>
          
          {/* Venue / Location */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Venue & Location</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-gray-900 leading-tight">
                  {spaceName}
                </p>
                <p className="truncate text-[13px] text-gray-500 mt-0.5">
                  {location}
                </p>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">When</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Starts</span>
                  {/* UPDATED: Pass the new datetime fields */}
                  <span className="text-[15px] font-semibold text-gray-900">{formatDateTime(booking.setup_start_datetime || booking.event_start_datetime)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Ends</span>
                  {/* UPDATED: Pass the new datetime fields */}
                  <span className="text-[15px] font-semibold text-gray-900">{formatDateTime(booking.teardown_end_datetime || booking.event_end_datetime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Context */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Current Status</p>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-gray-900 leading-tight">
                  {isExpired && booking.status === "APPROVED"
                    ? "Event Completed" 
                    : booking.status === "PENDING" 
                      ? "Waiting for approval" 
                      : booking.status === "APPROVED" 
                        ? "Equipment/Services Confirmed"
                        : booking.status === "COMPLETED"
                          ? "Event Completed"
                          : booking.status === "EXPIRED"
                            ? "Approval Window Expired"
                        : booking.status === "REJECTED"
                          ? "Cancelled by Admin"
                          : "Request Cancelled"}
                </p>
                <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                   {isExpired && booking.status === "APPROVED"
                    ? "This media request has already taken place." 
                    : booking.status === "PENDING" 
                      ? "You'll be notified once your request is reviewed." 
                      : booking.status === "APPROVED" 
                        ? "Your media request is confirmed. You may edit or cancel if needed."
                        : booking.status === "COMPLETED"
                          ? "This media request has already taken place."
                          : booking.status === "EXPIRED"
                            ? "This request was not approved in time."
                        : booking.status === "REJECTED"
                          ? "Please check the feedback notes below."
                          : "This request has been cancelled."}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* EXPANDED CONTENT AREA */}
      {isExpanded && (
        <div className="pb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pt-6 border-t border-gray-200">
            
            {/* Event Name */}
            <div className="mb-6">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2">Event Details</p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3.5">
                <p className="text-[14.5px] text-emerald-900 font-medium leading-relaxed flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-emerald-700" />
                  {booking.event_name || 'No event name provided.'}
                </p>
              </div>
            </div>

            {/* Equipment & Services */}
            <div className="grid gap-5 md:grid-cols-2 mb-6">
                <div>
                    <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-emerald-600 inline-block">
                        Equipment Requested
                    </p>
                    {hasEquipment ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {equipment.map((item) => (
                                <span key={item.id ?? item.equipment} className="inline-flex items-center gap-2 text-[14px] font-semibold text-emerald-900 bg-emerald-100 px-3.5 py-1.5 rounded-xl">
                                    <Package className="w-3.5 h-3.5 text-emerald-700" />
                                    {item.equipment_name || `Equipment #${item.equipment}`}
                                    {item.quantity > 1 && <span className="text-emerald-700 opacity-70 font-medium">× {item.quantity}</span>}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[14px] text-gray-500 mt-1">No equipment requested.</p>
                    )}
                </div>
                
                <div>
                    <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-indigo-500 inline-block">
                        Services Requested
                    </p>
                    {hasServices ? (
                        <p className="flex items-start gap-2 text-[14.5px] text-gray-700 leading-relaxed mt-1">
                            <Wrench className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                            {booking.requested_services}
                        </p>
                    ) : (
                        <p className="text-[14px] text-gray-500 mt-1">No extra services requested.</p>
                    )}
                </div>
            </div>

            {/* Notes */}
            {hasNotes && (
                <div className="mb-6">
                    <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-amber-500 inline-block">
                        Additional Notes
                    </p>
                    <div className="mt-1 bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-3.5">
                        <p className="text-[14.5px] text-gray-700 leading-relaxed">
                            {booking.user_notes}
                        </p>
                    </div>
                </div>
            )}

            {/* ASSIGNED CREW — only for APPROVED bookings with crew */}
            {booking.status === "APPROVED" && (booking.assigned_crew ?? []).length > 0 && (
              <div className="mb-6">
                <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-emerald-600 inline-block">
                  Assigned Media Team
                </p>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {booking.assigned_crew.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[13px] font-bold text-emerald-700">
                        {member.name?.charAt(0)?.toUpperCase() ?? <Users className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-gray-900">{member.name}</p>
                        {member.designation && (
                          <p className="truncate text-[12px] text-gray-500">{member.designation}</p>
                        )}
                        {member.phone && (
                          <p className="flex items-center gap-1.5 text-[12.5px] text-gray-700 mt-0.5">
                            <Phone className="h-3 w-3 text-emerald-600" /> {member.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              {/* NO ACTIONS STATUS */}
              {!showEditCancel && booking.status !== "REJECTED" && (
                <p className="text-[11.5px] font-bold text-gray-400 uppercase tracking-widest mt-2 mr-auto">
                  {isExpired && booking.status === "APPROVED" ? "Event Completed" : "No Actions Available"}
                </p>
              )}

              {/* CANCEL */}
              {showEditCancel && (
                <button
onClick={(e) => { e.stopPropagation(); onCancel(booking.id); }}                  disabled={isActionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-[14.5px] font-medium text-gray-700 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-150 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" /> 
                  {isActionLoading ? "Please wait..." : "Cancel Request"}
                </button>
              )}

              {/* EDIT */}
              {showEditCancel && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(booking); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-[14.5px] font-semibold hover:bg-emerald-800 transition-all duration-150 disabled:opacity-40"
                >
                  <Pencil className="w-4 h-4" />
                  {booking.status === "APPROVED" ? "Edit & Re-submit" : "Edit Details"}
                </button>
              )}

              {/* RESCHEDULE */}
              {booking.status === "REJECTED" && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/media"); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-[14.5px] font-semibold hover:bg-amber-700 transition-all duration-150"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Submit New Request
                </button>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};


// ─── Main Page Component ──────────────────────────────────────────────────────

const MyMediaBookingsPage = () => {
  const { data: myBookingsData, isLoading, isError, refetch: refreshData } = useMyMediaBookings();
  const myBookings = myBookingsData || [];
  const error = isError ? "Failed to load your media history." : null;
  const [isActionLoading, setIsActionLoading] = useState(false)

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightedReference = searchParams.get("booking") || ""

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter] = useState("ALL")

  const [bookingToCancel, setBookingToCancel] = useState(null);

  const FILTER_TABS = [
    { id: 'ALL', label: 'All' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'EXPIRED', label: 'Expired' },
    { id: 'REJECTED', label: 'Rejected' },
  ]

  // ================= FILTER =================

  const filteredBookings = useMemo(() => {
    let result = myBookings;

    if (filter !== "ALL") {
        result = result.filter(booking => {
            const isExpired = checkIsExpired(booking);
            if (filter === "COMPLETED") return booking.status === "COMPLETED" || (isExpired && booking.status === "APPROVED");
            if (filter === "APPROVED") return booking.status === "APPROVED" && !isExpired;
            return booking.status === filter;
        });
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((booking) => {
        const eventName = booking.event_name?.toLowerCase() || ""
        const status    = booking.status?.toLowerCase() || ""
        const refCode   = booking.reference_code?.toLowerCase() || ""
        const spaceName = booking.space_details?.name?.toLowerCase() || ""
        const location  = booking.space_details?.location?.toLowerCase() || ""

        return (
          eventName.includes(q) ||
          status.includes(q) ||
          refCode.includes(q) ||
          spaceName.includes(q) ||
          location.includes(q)
        )
      })
    }

    return result;
  }, [myBookings, searchTerm, filter])

  useEffect(() => {
    if (!highlightedReference) return undefined
    const timer = window.setTimeout(() => {
      setSearchTerm(highlightedReference)
      setFilter("ALL")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [highlightedReference])

  useEffect(() => {
    if (!highlightedReference || isLoading || filteredBookings.length === 0) return undefined

    const target = Array.from(document.querySelectorAll("[data-booking-reference]"))
      .find((element) => normaliseReference(element.getAttribute("data-booking-reference")) === normaliseReference(highlightedReference))

    if (!target) return undefined

    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)

    return () => window.clearTimeout(timer)
  }, [filteredBookings, highlightedReference, isLoading])

  // ================= CANCEL =================
  const cancelMutation = useCancelMediaBooking();

  const handleCancelBooking = async (id) => {
    setIsActionLoading(true)

    try {
      await cancelMutation.mutateAsync(id)
    } catch {
      toast.error("Booking could not be cancelled. Please try again.")
    } finally {
      setIsActionLoading(false)
    }
  }

  // ================= EDIT =================

  const handleEditClick = (booking) => {
    setSelectedBooking(booking)
    setIsEditModalOpen(true)
  }

  // ================= STATUS BADGE =================

  const getStatusBadge = (status, isExpired) => {
    if (isExpired && status === "APPROVED") {
        return (
            <span className="px-3 py-1 border text-[11px] font-bold rounded-lg uppercase tracking-wide bg-slate-100 text-slate-600 border-slate-200">
                Completed
            </span>
        )
    }

    const styles = {
      APPROVED:  "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
      COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
      EXPIRED:   "bg-orange-100 text-orange-700 border-orange-200",
      REJECTED:  "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]",
      CANCELLED: "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]",
      PENDING:   "bg-[#fef3c7] text-[#b45309] border-[#fde68a]",
    }

    const currentStyle = styles[status] || styles["PENDING"]
    const label = status === "PENDING" ? "Pending Review" : status.charAt(0) + status.slice(1).toLowerCase()

    return (
      <span className={`px-3 py-1 border text-[11px] font-bold rounded-lg uppercase tracking-wide ${currentStyle}`}>
        {label}
      </span>
    )
  }

  return (
    <MainLayout>
      
      <div className="max-w-[1400px] mx-auto w-full">

        <button onClick={() => navigate('/media')} className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Media Support
        </button>

        {/* Page header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">
              My Space
            </p>
            <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
              My Media Requests
            </h1>
            <p className="text-[15px] text-gray-600 mt-2">
              Review and manage your current and past equipment and media services.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-[14px] font-semibold hover:bg-emerald-800 transition-all duration-150 shadow-sm"
            >
              <Clapperboard className="w-4 h-4" />
              <span className="hidden sm:inline">New Request</span>
              <span className="sm:hidden">New</span>
            </button>

             {/* SEARCH */}
             <div className="relative w-full sm:w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search events, venues, codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-[14px] bg-white outline-none focus:ring-2 focus:ring-emerald-50 focus:border-emerald-500 placeholder:text-gray-400 shadow-sm transition-all"
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
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Queue panel */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          
          {/* Panel header & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-3 border-b border-gray-200 bg-gray-50/50">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-gray-600">
              Request History
            </span>
            <div className="flex gap-2">
                {FILTER_TABS.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setFilter(tab.id)}
                        className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors ${filter === tab.id ? 'bg-emerald-100 text-emerald-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
          </div>

          {/* States */}
          {isLoading ? (
            <div className="flex flex-col">
              {[1, 2, 3].map(i => (
                <div key={i} className="px-7 py-6 border-b border-gray-100 animate-pulse bg-white">
                  <div className="flex justify-between mb-5">
                    <div className="h-6 bg-gray-100 rounded w-24"></div>
                    <div className="h-4 bg-gray-100 rounded w-32"></div>
                  </div>
                  <div className="grid gap-7 grid-cols-1 md:grid-cols-3" style={{ gridTemplateColumns: '1.8fr 1.6fr 2.6fr' }}>
                    <div><div className="h-3 bg-gray-100 rounded w-24 mb-3"></div><div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0"></div><div><div className="h-4 bg-gray-100 rounded w-32 mb-1"></div><div className="h-3 bg-gray-100 rounded w-24"></div></div></div></div>
                    <div><div className="h-3 bg-gray-100 rounded w-16 mb-3"></div><div className="space-y-3"><div className="flex gap-3"><div className="w-2.5 h-2.5 rounded-full bg-gray-200 mt-1"></div><div className="h-8 bg-gray-100 rounded w-24"></div></div><div className="flex gap-3"><div className="w-2.5 h-2.5 rounded-full bg-gray-200 mt-1"></div><div className="h-8 bg-gray-100 rounded w-24"></div></div></div></div>
                    <div><div className="h-3 bg-gray-100 rounded w-24 mb-3"></div><div className="h-5 bg-gray-100 rounded w-48 mb-2"></div><div className="h-4 bg-gray-100 rounded w-64"></div></div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-20 text-center px-8">
              <p className="text-[15px] font-semibold text-gray-900 mb-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-emerald-700 text-[14px] font-medium hover:underline"
              >
                Reload page
              </button>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-20 text-center px-8">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Clapperboard className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-[15px] font-semibold text-gray-900">
                 {searchTerm || filter !== "ALL" ? "No matching requests found" : "No requests yet"}
              </p>
              <p className="text-[13.5px] text-gray-500 mt-1.5">
                 {searchTerm || filter !== "ALL" ? "Try changing your search terms or filters." : "When you request equipment, it will appear here."}
              </p>
            </div>
          ) : (
            /* BOOKINGS LIST */
            <div className="flex flex-col">
              {filteredBookings.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onEdit={handleEditClick}
                  onCancel={handleCancelBooking}
                  isActionLoading={isActionLoading}
                  getStatusBadge={getStatusBadge}
                  navigate={navigate}
                  isHighlighted={normaliseReference(booking.reference_code) === normaliseReference(highlightedReference)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

          {bookingToCancel && (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold">
                Cancel Request?
            </h3>

            <p className="text-sm text-gray-500 mt-2">
                Are you sure you want to cancel this media request?
            </p>

            <div className="flex justify-end gap-3 mt-6">
                <button
                    onClick={() => setBookingToCancel(null)}
                    className="px-4 py-2 bg-gray-100 rounded-lg"
                >
                    Keep Request
                </button>

                <button
                    onClick={async () => {
                        await handleCancelBooking(bookingToCancel);
                        setBookingToCancel(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                    Cancel Request
                </button>
            </div>
        </div>
    </div>
)}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <MediaBookingModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false)
          }}
        />
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedBooking && (
        <MediaBookingModal
          initialData={selectedBooking}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedBooking(null)
          }}
          onSuccess={() => {
            setIsEditModalOpen(false)
            setSelectedBooking(null)
          }}
        />
      )}
    </MainLayout>
  )
}

export default MyMediaBookingsPage