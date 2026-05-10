import { useState, useEffect, useMemo } from "react"
import api from "../api/axios"
import MainLayout from "../layouts/MainLayout"
import BookingModal from "../components/BookingModal"

import { useNavigate } from "react-router-dom"

import {
  RefreshCcw,
  Trash2,
  Pencil,
  CalendarClock,
  Search,
  X as XIcon,
  Package,
  StickyNote,
  ChevronDown,
  Building2,
  Users
} from "lucide-react"

// ─── Utilities ────────────────────────────────────────────────────────────────

const formatDateTime = (isoString) => {
  if (!isoString) return 'TBD';
  return new Intl.DateTimeFormat('en-IN', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(isoString));
};

const timeAgo = (isoString) => {
  if (!isoString) return '';
  const mins = Math.round((Date.now() - new Date(isoString)) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

// ─── Booking Card Component (Admin Style) ─────────────────────────────────────

const BookingCard = ({ booking, onEdit, onCancel, isActionLoading, getStatusBadge, navigate }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasEquipment = booking.equipment_requests && booking.equipment_requests.length > 0;
  const hasNotes = booking.user_notes && booking.user_notes.trim().length > 0;
  
  // Expiry check
  const isExpired = new Date(booking.end_datetime) < new Date();
  const showEditCancel = booking.can_modify && (booking.status === "PENDING" || booking.status === "APPROVED") && !isExpired;

  return (
    <div className={`px-7 border-b border-gray-100 last:border-0 transition-colors duration-150 ${isExpanded ? 'bg-[#f8fafc]' : 'bg-white hover:bg-[#f8fafc]'}`}>
      
      {/* CLICKABLE QUICK-GLANCE HEADER */}
      <div 
        className="py-6 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Top strip */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-2.5 flex-wrap">
            {getStatusBadge(booking.status)}
            {booking.attendee_count > 0 && (
              <span className="flex items-center gap-1.5 text-[14px] text-gray-600 font-medium ml-2">
                <Users className="w-4 h-4 text-emerald-700" />
                {booking.attendee_count} {booking.attendee_count === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-gray-500 font-medium">Submitted {timeAgo(booking.created_at)}</span>
            <div className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
              <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {/* 3-col info grid (Always Visible) */}
        <div className="grid gap-7 grid-cols-1 md:grid-cols-3" style={{ gridTemplateColumns: '1.8fr 1.6fr 2.6fr' }}>
          
          {/* Space */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Space</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-gray-900 leading-tight">
                  {booking.space_details?.name || "Unknown Space"}
                </p>
                <p className="text-[13px] text-gray-500 mt-0.5 capitalize">
                  {booking.space_details?.space_type?.replace('_', ' ') || "Workspace"}
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
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">From</span>
                  <span className="text-[15px] font-semibold text-gray-900">{formatDateTime(booking.start_datetime)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <div>
                  <span className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">To</span>
                  <span className="text-[15px] font-semibold text-gray-900">{formatDateTime(booking.end_datetime)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Context (Replaces Requester in User View) */}
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2.5">Current Status</p>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-gray-900 leading-tight">
                  {isExpired 
                    ? "Schedule Completed" 
                    : booking.status === "PENDING" 
                      ? "Awaiting Admin Review" 
                      : booking.status === "APPROVED" 
                        ? "Space Reserved Successfully"
                        : booking.status === "REJECTED"
                          ? "Request Declined"
                          : "Booking Cancelled"}
                </p>
                <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                   {isExpired 
                    ? "This booking has already taken place." 
                    : booking.status === "PENDING" 
                      ? "You will be notified once an administrator processes this request." 
                      : booking.status === "APPROVED" 
                        ? "Your slot is confirmed. You may edit or cancel if plans change."
                        : booking.status === "REJECTED"
                          ? "Please check the admin feedback notes below."
                          : "This request has been withdrawn."}
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
            
            {/* Purpose */}
            <div className="mb-6">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2">Purpose of Booking</p>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3.5">
                <p className="text-[14.5px] text-emerald-900 font-medium leading-relaxed">
                  {booking.purpose_of_booking || booking.purpose || 'No purpose provided.'}
                </p>
              </div>
            </div>

            {/* Equipment & Notes */}
            {(hasEquipment || hasNotes) && (
              <div className="flex flex-col gap-5 mb-6">
                {hasEquipment && (
                  <div>
                    <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-emerald-600 inline-block">
                      Equipment Requested
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {booking.equipment_requests.map((er) => (
                        <span key={er.id} className="inline-flex items-center gap-2 text-[14px] font-semibold text-emerald-900 bg-emerald-100 px-3.5 py-1.5 rounded-xl">
                          <Package className="w-3.5 h-3.5 text-emerald-700" />
                          {er.equipment_name}
                          {er.quantity > 1 && <span className="text-emerald-700 opacity-70 font-medium">× {er.quantity}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {hasNotes && (
                  <div>
                    <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-amber-500 inline-block">
                      Additional Notes
                    </p>
                    <div className="mt-2 bg-amber-50/50 border border-amber-100 rounded-xl px-4 py-3.5">
                      <p className="text-[14.5px] text-gray-700 leading-relaxed">
                        {booking.user_notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ADMIN FEEDBACK */}
            {booking.status === "REJECTED" && booking.remarks_by_admin && (
              <div className="mb-6">
                 <p className="text-[13px] font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-red-500 inline-block">
                    Administrator Feedback
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
                  {isExpired ? "Booking Completed" : "No Further Actions"}
                </p>
              )}

              {/* CANCEL */}
              {showEditCancel && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(booking.id); }}
                  disabled={isActionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-[14.5px] font-medium text-gray-700 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-150 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" /> 
                  {isActionLoading ? "Processing..." : "Cancel Request"}
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
                  onClick={(e) => { e.stopPropagation(); navigate("/dashboard"); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-[14.5px] font-semibold hover:bg-amber-700 transition-all duration-150"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Find Another Space
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

const MyBookingsPage = () => {
  const [myBookings, setMyBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isActionLoading, setIsActionLoading] = useState(false)

  const navigate = useNavigate()

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)

  // Search
  const [searchTerm, setSearchTerm] = useState("")

  // ================= FETCH =================

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      try {
        const response = await api.get("/spaces/requests/")

        if (isMounted) {
          const data = response.data.results || response.data || []
          setMyBookings(data)
          setError(null)
        }
      } catch (err) {
        console.error("Fetch error:", err)
        if (isMounted) {
          setError("Failed to load your booking history.")
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  // ================= FILTER =================

  const filteredBookings = useMemo(() => {
    if (!searchTerm.trim()) return myBookings

    const q = searchTerm.toLowerCase()

    return myBookings.filter((booking) => {
      const hall      = booking.space_details?.name?.toLowerCase() || ""
      const purpose   = booking.purpose_of_booking?.toLowerCase() || ""
      const status    = booking.status?.toLowerCase() || ""

      return (
        hall.includes(q) ||
        purpose.includes(q) ||
        status.includes(q)
      )
    })
  }, [myBookings, searchTerm])

  // ================= REFRESH =================

  const refreshData = async () => {
    try {
      const response = await api.get("/spaces/requests/")
      const data = response.data.results || response.data || []
      setMyBookings(data)
    } catch (err) {
      console.error("Refresh error:", err)
    }
  }

  // ================= CANCEL =================

  const handleCancelBooking = async (id) => {
    if (!window.confirm("Are you sure? This will free up the space for others.")) return;

    setIsActionLoading(true)

    try {
      await api.delete(`/spaces/requests/${id}/`)
      await refreshData()
    } catch {
      alert("Could not cancel booking.")
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

  const getStatusBadge = (status) => {
    const styles = {
      APPROVED:  "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
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

        {/* Page header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-7">
          <div>
            <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-1.5">
              Personal Workspace
            </p>
            <h1 className="text-[26px] font-bold text-gray-900 tracking-tight leading-none">
              My Bookings
            </h1>
            <p className="text-[15px] text-gray-600 mt-2">
              Review and manage your current and past space reservations.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             {/* SEARCH */}
             <div className="relative w-full sm:w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search spaces, purposes..."
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
          
          {/* Panel header */}
          <div className="flex items-center px-7 py-4 border-b border-gray-200 bg-gray-50/50">
            <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-gray-600">
              Booking History
            </span>
          </div>

          {/* States */}
          {isLoading ? (
            <div className="py-20 text-center">
               <p className="text-[14px] text-gray-500 font-medium">Loading your bookings…</p>
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
                <CalendarClock className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-[15px] font-semibold text-gray-900">
                 {searchTerm ? "No matching bookings found" : "No bookings yet"}
              </p>
              <p className="text-[13.5px] text-gray-500 mt-1.5">
                 {searchTerm ? "Try adjusting your search terms." : "When you reserve a space, it will appear here."}
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
                />
              ))}
            </div>
          )}
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
            refreshData()
          }}
        />
      )}
    </MainLayout>
  )
}

export default MyBookingsPage