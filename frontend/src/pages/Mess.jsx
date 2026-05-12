import React, { useState, useEffect, useRef } from "react"
import MainLayout from "../layouts/MainLayout"
import MessBookingForm from "../components/MessBookingForm"
import messService from "../api/messService"
import { MEALS, getEarliestTime, getRequestedMeals } from "../api/messConfig"

import {
  Pencil,
  Trash2,
  Users,
  Clock3,
  X,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
} from "lucide-react"

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const todayStr = formatDate(new Date())

const getStatusStyle = (status) => {
  switch (status?.toLowerCase()) {
    case "confirmed": return "bg-blue-50 text-blue-700 border border-blue-100"
    case "rejected":  return "bg-red-50 text-red-700 border border-red-100"
    default:          return "bg-yellow-50 text-yellow-700 border border-yellow-100"
  }
}

/** True for any status where edit/cancel should be available. */
const isEditable = (status) => {
  const s = status?.toLowerCase()
  return s === "pending" || s === "confirmed"
}

/** Renders a compact pill for each selected meal with its time. */
const MealTimePills = ({ booking }) => {
  const selected = MEALS.filter((m) => booking[`${m.id}_required`])
  if (selected.length === 0) return <span className="text-gray-400 text-xs italic">No meals</span>

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {selected.map(({ id, label, timeKey }) => {
        const raw  = booking[timeKey]
        const time = raw && typeof raw === "string" && raw.length >= 5 ? raw.slice(0, 5) : null
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 border border-gray-200"
          >
            {label}
            {time && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-emerald-600 font-semibold">{time}</span>
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

function Mess() {
  const [bookings,                setBookings]                = useState([])
  const [isLoading,               setIsLoading]               = useState(true)
  const [toastMsg,                setToastMsg]                = useState("")
  const [refreshTrigger,          setRefreshTrigger]          = useState(0) 

  const [selectedDate,            setSelectedDate]            = useState("")
  const [mealFilter,              setMealFilter]              = useState("All")
  const [showAllUpcoming,         setShowAllUpcoming]         = useState(false)

  const [selectedViewBooking,     setSelectedViewBooking]     = useState(null)
  const [showForm,                setShowForm]                = useState(false)
  const [editMode,                setEditMode]                = useState(false)
  const [selectedEditBooking,     setSelectedEditBooking]     = useState(null)
  const [showDeleteModal,         setShowDeleteModal]         = useState(false)
  const [selectedBookingToDelete, setSelectedBookingToDelete] = useState(null)
  const [isDeleting,              setIsDeleting]              = useState(false)

  // Used to avoid setting isLoading to true on background refetches
  const isFirstLoad = useRef(true)

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true
    const fetchBookings = async () => {
      if (isFirstLoad.current) {
        setIsLoading(true)
        isFirstLoad.current = false
      }
      
      try {
        const data = await messService.getMyBookings()
        if (isMounted) {
          setBookings(data)
          setIsLoading(false)
        }
      } catch (err) {
        console.error("Failed to fetch mess bookings:", err)
        if (isMounted) setIsLoading(false)
      }
    }
    
    fetchBookings()
    return () => { isMounted = false }
  }, [refreshTrigger]) 

  // ── Filtering ───────────────────────────────────────────────────────────────

  let filteredBookings = [...bookings]

  if (selectedDate) {
    filteredBookings = filteredBookings.filter((b) => b.booking_date === selectedDate)
  } else {
    filteredBookings = filteredBookings
      .filter((b) => b.booking_date >= todayStr)
      .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
    if (!showAllUpcoming) filteredBookings = filteredBookings.slice(0, 3)
  }

  if (mealFilter !== "All") {
    filteredBookings = filteredBookings.filter((b) => {
      if (mealFilter === "Breakfast" && !b.breakfast_required)                              return false
      if (mealFilter === "Lunch"     && !b.lunch_required)                                  return false
      if (mealFilter === "Dinner"    && !b.dinner_required)                                 return false
      if (mealFilter === "Snacks"    && !b.morning_tea_required && !b.evening_tea_required) return false
      return true
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const showToast = (message) => {
    setToastMsg(message)
    setTimeout(() => setToastMsg(""), 4000)
  }

  const closeSidePanel = () => setSelectedViewBooking(null)

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

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedBookingToDelete) return
    setIsDeleting(true)
    try {
      await messService.deleteBooking(selectedBookingToDelete.id)
      setRefreshTrigger(prev => prev + 1) 
      setShowDeleteModal(false)
      showToast("Booking cancelled successfully.")
    } catch (err) {
      console.error("Failed to delete:", err)
      alert("Could not cancel booking. Please try again.")
    } finally {
      setIsDeleting(false)
      setSelectedBookingToDelete(null)
    }
  }

  const handleSave = () => {
    closeForm()
    showToast(editMode ? "Booking updated successfully!" : "Booking submitted! Awaiting admin approval.")
    setSelectedDate("")
    setRefreshTrigger(prev => prev + 1) 
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const upcomingCount = bookings.filter((b) => b.booking_date >= todayStr).length

  return (
    <MainLayout>
      <div className="space-y-6 p-4 sm:p-6 relative">

        {/* Toast */}
        {toastMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mess Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your food and catering requests</p>
          </div>
          <button
            onClick={() => { setEditMode(false); setSelectedEditBooking(null); setShowForm(true) }}
           className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-medium transition-all"
          >
            <span className="text-lg leading-none">+</span>
            Book Now
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex gap-3 flex-wrap">

            {["All", "Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (

              <button
                key={meal}
                onClick={() => setMealFilter(meal)}

                className={`px-5 py-2 rounded-xl border text-sm font-medium transition-all ${
                  mealFilter === meal
                  ? "bg-green-600 text-white border-green-600 shadow-sm"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {meal}
              </button>

            ))}

        </div>
          <div className="flex items-center gap-3">
            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Clear Date
              </button>
            )}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List header */}
        <div className="flex items-center justify-between mt-8 mb-2">
          <h2 className="text-lg font-semibold text-gray-800">
            {selectedDate ? `Bookings for ${selectedDate}` : "My Upcoming Bookings"}
          </h2>
          {!selectedDate && upcomingCount > 3 && (
            <button
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="text-sm text-emerald-600 font-medium hover:underline"
            >
              {showAllUpcoming ? "Show Less" : "View All Upcoming"}
            </button>
          )}
        </div>

        {/* Booking list */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-4 border-b border-gray-100">
            <span className="col-span-2">Ref Code</span>
            <span className="col-span-3">Event Purpose</span>
            <span className="col-span-5">Meal Timings</span>
            <span className="col-span-1">Status</span>
            <span className="col-span-1 text-right">Action</span>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-sm text-gray-400 flex justify-center items-center gap-2">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
              Loading bookings...
            </div>
          )}

          {!isLoading && filteredBookings.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              No bookings found for the selected criteria.
            </div>
          )}

          {!isLoading && filteredBookings.map((b) => (
            <div
              key={b.id}
              onClick={() => setSelectedViewBooking(b)}
              className="grid grid-cols-12 items-center px-5 py-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="col-span-2">
                <span className="font-medium text-gray-700 text-sm">{b.reference_code || "N/A"}</span>
                <p className="text-xs text-gray-400 mt-0.5">{b.booking_date}</p>
              </div>

              <div className="col-span-3 pr-4">
                <p className="font-semibold text-gray-900 text-sm truncate">{b.purpose_of_programme}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock3 size={11} className="text-emerald-500 shrink-0" />
                  Starts {getEarliestTime(b)}
                </p>
              </div>

              <div className="col-span-5 pr-2">
                <MealTimePills booking={b} />
              </div>

              <div className="col-span-1">
                <span className={`text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full ${getStatusStyle(b.status)}`}>
                  {b.status}
                </span>
              </div>

              <div className="col-span-1 flex justify-end">
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Side panel ── */}
      {selectedViewBooking && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100">

            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  REF: {selectedViewBooking.reference_code}
                </p>
              </div>
              <button
                onClick={closeSidePanel}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

              {/* General info */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    General Information
                  </h3>
                  <span className={`text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-md ${getStatusStyle(selectedViewBooking.status)}`}>
                    {selectedViewBooking.status}
                  </span>
                </div>

                <p className="text-base font-semibold text-gray-900 mb-4">
                  {selectedViewBooking.purpose_of_programme}
                </p>

                {selectedViewBooking.status?.toLowerCase() === "rejected" && selectedViewBooking.rejection_remark && (
                  <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">
                        Rejection Reason
                      </p>
                      <p className="text-sm text-red-700 leading-relaxed">
                        {selectedViewBooking.rejection_remark}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Date</p>
                    <p className="font-medium text-gray-900">{selectedViewBooking.booking_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">First Delivery</p>
                    <p className="font-semibold text-emerald-600 text-base flex items-center gap-1.5">
                      <Clock3 size={15} className="text-emerald-500" />
                      {getEarliestTime(selectedViewBooking)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 mb-1">Location</p>
                    <p className="font-medium text-gray-900">{selectedViewBooking.delivery_location}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 mb-1">Attendees</p>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <Users size={16} className="text-gray-400" />
                      {selectedViewBooking.total_persons} Total
                      <span className="text-gray-400 text-xs ml-1">
                        ({selectedViewBooking.veg_persons} Veg, {selectedViewBooking.nonveg_persons} Non-Veg)
                      </span>
                    </p>
                  </div>
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* Catering menu */}
              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Catering Menu
                </h3>
                <div className="space-y-3">
                  {MEALS.filter((m) => selectedViewBooking[`${m.id}_required`]).map(({ id, label, menuKey, timeKey }) => {
                    const raw  = selectedViewBooking[timeKey]
                    const time = raw && typeof raw === "string" && raw.length >= 5 ? raw.slice(0, 5) : null
                    return (
                      <div key={id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                          {time ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1">
                              <Clock3 size={13} className="text-emerald-500" />
                              <span className="text-sm font-bold text-emerald-700">{time}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No time set</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 px-4 py-3 leading-relaxed">
                          {selectedViewBooking[menuKey]}
                        </p>
                      </div>
                    )
                  })}
                  {getRequestedMeals(selectedViewBooking).length === 0 && (
                    <p className="text-sm text-gray-400 italic">No meals selected.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Footer — edit/cancel available for pending AND confirmed bookings */}
            {isEditable(selectedViewBooking.status) && (
              <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
                <button
                  onClick={() => openDeleteModal(selectedViewBooking)}
                  className="px-4 py-2 text-sm border border-gray-200 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-100 transition-colors font-medium flex items-center gap-2"
                >
                  <Trash2 size={15} /> Cancel Booking
                </button>
                <button
                  onClick={() => openEditModal(selectedViewBooking)}
                  className="px-6 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium flex items-center gap-2"
                >
                  <Pencil size={15} /> Edit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative shadow-2xl text-center">
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cancel Booking?</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              You're about to cancel the catering request for:
            </p>

            <div className="mt-4">
              <h3 className="text-xl font-bold text-gray-800 break-words">
                {selectedBookingToDelete.purpose_of_programme}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {selectedBookingToDelete.booking_date} · {getEarliestTime(selectedBookingToDelete)}
              </p>
            </div>

            <p className="text-red-400 text-sm mt-5">This action cannot be undone.</p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm font-semibold transition disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

export default Mess