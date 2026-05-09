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
} from "lucide-react"

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
      const reference = booking.reference_code?.toLowerCase() || ""
      const status    = booking.status?.toLowerCase() || ""

      return (
        hall.includes(q) ||
        purpose.includes(q) ||
        reference.includes(q) ||
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
    if (
      !window.confirm(
        "Are you sure? This will free up the space for others."
      )
    )
      return

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
      APPROVED:  "bg-emerald-100 text-emerald-700 border-emerald-200",
      REJECTED:  "bg-red-100 text-red-700 border-red-200",
      CANCELLED: "bg-gray-100 text-gray-700 border-gray-200",
      PENDING:   "bg-amber-100 text-amber-700 border-amber-200",
    }

    const currentStyle = styles[status] || styles["PENDING"]

    const label =
      status === "PENDING"
        ? "Pending Review"
        : status.charAt(0) + status.slice(1).toLowerCase()

    return (
      <span
        className={`px-2.5 py-1 border text-[10px] font-bold rounded-full uppercase tracking-wider ${currentStyle}`}
      >
        {label}
      </span>
    )
  }

  return (
    <MainLayout>

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          {/* LEFT */}
          <div>
            <h1 className="text-[38px] font-bold text-gray-900 tracking-tight">
              My Booking History
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View and manage your resource requests.
            </p>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">

            {/* SEARCH */}
            <div className="relative w-full sm:w-64">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search className="w-4 h-4 text-gray-500" strokeWidth={2.2} />
              </div>
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-10 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-600 placeholder:text-gray-400 shadow-sm transition-all"
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

            {/* REFRESH */}
            <button
              onClick={() => window.location.reload()}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <RefreshCcw className="w-4 h-4" />
              <span className="text-sm font-semibold">Refresh</span>
            </button>

          </div>

        </div>

        {/* MAIN WRAPPER */}
        <div className="relative overflow-hidden bg-white/90 backdrop-blur-xl rounded-[22px] border border-gray-100 shadow-[0_10px_40px_rgba(0,0,0,0.05)] min-h-[450px]">

          {/* GRID BG */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #10b981 1px, transparent 1px), linear-gradient(to bottom, #10b981 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }}
            />
          </div>

          {/* LOADING */}
          {isLoading ? (
            <div className="relative flex flex-col items-center justify-center p-24 space-y-4 text-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400 font-medium animate-pulse">
                Syncing with database...
              </p>
            </div>

          ) : error ? (
            <div className="relative flex flex-col items-center justify-center p-16 text-center">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-emerald-600 text-sm font-medium hover:underline"
              >
                Reload page
              </button>
            </div>

          ) : filteredBookings.length === 0 ? (
            <div className="relative flex flex-col items-center justify-center p-24 text-center">
              <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                <CalendarClock className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-base font-bold text-gray-900">
                {searchTerm ? "No matching bookings" : "No bookings yet"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm
                  ? "Try another keyword."
                  : "Your reservation requests will appear here."}
              </p>
            </div>

          ) : (

            /* BOOKINGS LIST */
            <div className="relative space-y-3 p-4">

              {filteredBookings.map((booking) => {
                const hasEquipment =
                  booking.equipment_requests &&
                  booking.equipment_requests.length > 0
                const hasNotes =
                  booking.user_notes &&
                  booking.user_notes.trim().length > 0

                return (
                  <div
                    key={booking.id}
                    className="group relative overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-[0_4px_18px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_28px_rgba(16,185,129,0.08)] transition-all duration-300"
                  >

                    {/* STATUS COLOR BAR */}
                    <div
                      className={`h-1 w-full ${
                        booking.status === "APPROVED"
                          ? "bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400"
                          : booking.status === "REJECTED"
                          ? "bg-gradient-to-r from-red-400 via-red-500 to-red-400"
                          : booking.status === "CANCELLED"
                          ? "bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300"
                          : "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400"
                      }`}
                    />

                    {/* CONTENT */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 p-4">

                      {/* LEFT */}
                      <div className="flex-1 space-y-3">

                        {/* TITLE ROW */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {booking.space_details?.name || "Unknown Space"}
                          </h3>
                          {getStatusBadge(booking.status)}
                        </div>

                        {/* INFO GRID */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                          {/* REFERENCE */}
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">
                              Reference
                            </p>
                            <p className="text-xs font-mono text-gray-700 break-all">
                              {booking.reference_code}
                            </p>
                          </div>

                          {/* DATE */}
                          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">
                              Date & Duration
                            </p>
                            <p className="text-sm text-gray-700">
                              {new Date(booking.start_datetime).toLocaleDateString("en-IN")}
                            </p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">
                              {new Date(booking.start_datetime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" - "}
                              {new Date(booking.end_datetime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                        </div>

                        {/* PURPOSE */}
                        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2">
                            Purpose
                          </p>
                          <p className="text-sm text-gray-700 italic leading-relaxed">
                            "{booking.purpose_of_booking}"
                          </p>
                        </div>

                        {/* EQUIPMENT REQUESTS */}
                        {hasEquipment && (
                          <div className="border border-blue-100 bg-blue-50/60 rounded-xl p-3.5">
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <Package className="w-3.5 h-3.5 text-blue-500" strokeWidth={2.2} />
                              <p className="text-[10px] uppercase tracking-widest font-bold text-blue-500">
                                Equipment requested
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {booking.equipment_requests.map((er) => (
                                <span
                                  key={er.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-blue-200 text-xs font-medium text-blue-700 shadow-sm"
                                >
                                  {er.equipment_name}
                                  {er.quantity > 1 && (
                                    <span className="text-blue-400 font-normal">
                                      &times; {er.quantity}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* USER NOTES */}
                        {hasNotes && (
                          <div className="border border-amber-100 bg-amber-50/60 rounded-xl p-3.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <StickyNote className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.2} />
                              <p className="text-[10px] uppercase tracking-widest font-bold text-amber-500">
                                Notes
                              </p>
                            </div>
                            <p className="text-sm text-amber-900 leading-relaxed">
                              {booking.user_notes}
                            </p>
                          </div>
                        )}

                      </div>

                      {/* RIGHT — ACTIONS */}
                      <div className="flex flex-col gap-2 min-w-[170px] lg:items-end">

                        {/* EDIT — PENDING or APPROVED */}
                        {booking.can_modify &&
                          (booking.status === "PENDING" ||
                            booking.status === "APPROVED") && (
                            <button
                              onClick={() => handleEditClick(booking)}
                              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              {booking.status === "APPROVED"
                                ? "Edit & Re-submit"
                                : "Edit Request"}
                            </button>
                          )}

                        {/* CANCEL — PENDING or APPROVED */}
                        {booking.can_modify &&
                          (booking.status === "PENDING" ||
                            booking.status === "APPROVED") && (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              disabled={isActionLoading}
                              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isActionLoading ? "Please wait..." : "Cancel Request"}
                            </button>
                          )}

                        {/* RESCHEDULE — REJECTED */}
                        {booking.status === "REJECTED" && (
                          <button
                            onClick={() => navigate("/dashboard")}
                            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-100 transition-all duration-300 shadow-sm hover:shadow-md"
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                            Reschedule
                          </button>
                        )}

                        {/* NO ACTIONS — non-owner, non-rejected */}
                        {!booking.can_modify &&
                          booking.status !== "REJECTED" && (
                            <div className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-center">
                              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                                No Actions
                              </p>
                            </div>
                          )}

                        {/* ADMIN FEEDBACK — REJECTED */}
                        {booking.status === "REJECTED" &&
                          booking.remarks_by_admin && (
                            <div className="w-full bg-red-50 p-3 rounded-xl border border-red-100 mt-1">
                              <p className="text-[9px] font-bold text-red-800 uppercase tracking-widest mb-1">
                                Admin Feedback
                              </p>
                              <p className="text-xs text-red-900 italic leading-relaxed">
                                "{booking.remarks_by_admin}"
                              </p>
                            </div>
                          )}

                      </div>

                    </div>

                  </div>
                )
              })}

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