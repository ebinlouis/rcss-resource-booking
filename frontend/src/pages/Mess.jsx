import React, { useState, useEffect } from "react"
import MainLayout from "../layouts/MainLayout"
import MessBookingForm from "../components/MessBookingForm"
import messService from "../api/messService"

import {
  Pencil,
  Trash2,
  Users,
  Clock3,
  X,
  CheckCircle2,
  ChevronRight
} from "lucide-react"

function Mess() {
  const today = new Date()
  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`
  const todayStr = formatDate(today)

  // State Management
  const [bookings, setBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState("")

  // Filter State
  const [selectedDate, setSelectedDate] = useState("") // Empty string defaults to "Upcoming" mode
  const [mealFilter, setMealFilter] = useState("All")
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)

  // Side Panel State
  const [selectedViewBooking, setSelectedViewBooking] = useState(null)

  // Modal States
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedEditBooking, setSelectedEditBooking] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedBookingToDelete, setSelectedBookingToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch Data on Mount
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await messService.getBookings()
        setBookings(data)
      } catch (err) {
        console.error("Failed to fetch mess bookings:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchBookings()
  }, [])

  // Smart List Filtering Logic
  let filteredBookings = [...bookings]

  // Date Filtering Mode vs Upcoming Mode
  if (selectedDate) {
    filteredBookings = filteredBookings.filter((b) => b.booking_date === selectedDate)
  } else {
    // Upcoming Mode: Filter dates >= today and sort chronologically
    filteredBookings = filteredBookings
      .filter((b) => b.booking_date >= todayStr)
      .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
    
    // Limit to top 3 unless "View All" is toggled
    if (!showAllUpcoming) {
      filteredBookings = filteredBookings.slice(0, 3)
    }
  }

  // Apply Meal Filter
  if (mealFilter !== "All") {
    filteredBookings = filteredBookings.filter((b) => {
      if (mealFilter === "Breakfast" && !b.breakfast_required) return false
      if (mealFilter === "Lunch" && !b.lunch_required) return false
      if (mealFilter === "Dinner" && !b.dinner_required) return false
      if (mealFilter === "Snacks" && !b.morning_tea_required && !b.evening_tea_required) return false
      return true
    })
  }

  // Helpers
  const showToast = (message) => {
    setToastMsg(message)
    setTimeout(() => setToastMsg(""), 4000)
  }

  const getRequestedMealsStr = (b) => {
    const meals = []
    if (b.breakfast_required) meals.push("Breakfast")
    if (b.morning_tea_required) meals.push("Morning Tea")
    if (b.lunch_required) meals.push("Lunch")
    if (b.evening_tea_required) meals.push("Evening Tea")
    if (b.dinner_required) meals.push("Dinner")
    return meals.join(", ") || "No meals selected"
  }

  // Action Handlers
  const openSidePanel = (booking) => {
    setSelectedViewBooking(booking)
  }

  const closeSidePanel = () => {
    setSelectedViewBooking(null)
  }

  const openDeleteModal = (booking) => {
    setSelectedBookingToDelete(booking)
    setShowDeleteModal(true)
    closeSidePanel() // Close panel when opening modal
  }

  const handleDelete = async () => {
    if (!selectedBookingToDelete) return
    setIsDeleting(true)
    try {
      await messService.deleteBooking(selectedBookingToDelete.id)
      setBookings((prev) => prev.filter((b) => b.id !== selectedBookingToDelete.id))
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

  const openEditModal = (booking) => {
    setSelectedEditBooking(booking)
    setEditMode(true)
    setShowForm(true)
    closeSidePanel() // Close panel when opening form
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 sm:p-6 relative">
        
        {/* Success Toast Notification */}
        {toastMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mess Bookings
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your food and catering requests
            </p>
          </div>

          <button
            onClick={() => {
              setEditMode(false)
              setSelectedEditBooking(null)
              setShowForm(true)
            }}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-sm text-sm font-medium transition-all"
          >
            <span className="text-lg leading-none">+</span>
            Book Now
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex gap-3 flex-wrap">
            {["All", "Breakfast", "Lunch", "Dinner", "Snacks"].map(
              (meal) => (
                <button
                  key={meal}
                  onClick={() => setMealFilter(meal)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    mealFilter === meal
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {meal}
                </button>
              )
            )}
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

        {/* List Section Header */}
        <div className="flex items-center justify-between mt-8 mb-2">
          <h2 className="text-lg font-semibold text-gray-800">
            {selectedDate 
              ? `Bookings for ${selectedDate}` 
              : "My Upcoming Bookings"}
          </h2>
          {!selectedDate && bookings.filter((b) => b.booking_date >= todayStr).length > 3 && (
            <button 
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="text-sm text-emerald-600 font-medium hover:underline"
            >
              {showAllUpcoming ? "Show Less" : "View All Upcoming"}
            </button>
          )}
        </div>

        {/* Data List */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          
          <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-4 border-b border-gray-100">
            <span className="col-span-2">Ref Code</span>
            <span className="col-span-4">Event Purpose</span>
            <span className="col-span-3">Date & Time</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1 text-right">Action</span>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-sm text-gray-400 flex justify-center items-center gap-2">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-emerald-600 rounded-full animate-spin"></span>
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
              onClick={() => openSidePanel(b)}
              className="grid grid-cols-12 items-center px-5 py-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {/* Ref Code */}
              <div className="col-span-2">
                <span className="font-medium text-gray-700 text-sm">
                  {b.reference_code || "N/A"}
                </span>
              </div>

              {/* Event Purpose & Brief Menu */}
              <div className="col-span-4 pr-4">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {b.purpose_of_programme}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {getRequestedMealsStr(b)}
                </p>
              </div>

              {/* Date & Time */}
              <div className="col-span-3">
                <p className="text-sm text-gray-800 font-medium">
                  {b.booking_date}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock3 size={12} /> {b.delivery_time?.slice(0, 5)}
                </p>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <span
                  className={`text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-full ${
                    b.status === "confirmed"
                      ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                  }`}
                >
                  {b.status}
                </span>
              </div>

              {/* Action */}
              <div className="col-span-1 flex justify-end">
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SIDE PANEL (Slide-over) */}
      {selectedViewBooking && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm transition-opacity">
          <div 
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-100"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Booking Details
                </h2>
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

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              
              {/* General Info */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    General Information
                  </h3>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-md ${
                      selectedViewBooking.status === "confirmed"
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                    }`}
                  >
                    {selectedViewBooking.status}
                  </span>
                </div>
                <p className="text-base font-semibold text-gray-900 mb-4">
                  {selectedViewBooking.purpose_of_programme}
                </p>
                
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Date</p>
                    <p className="font-medium text-gray-900">{selectedViewBooking.booking_date}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Time</p>
                    <p className="font-medium text-gray-900">{selectedViewBooking.delivery_time?.slice(0, 5)}</p>
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

              {/* Menu Details */}
              <section>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Catering Menu
                </h3>
                <div className="space-y-4">
                  {selectedViewBooking.breakfast_required && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 block mb-1">Breakfast</span>
                      <p className="text-sm text-gray-800">{selectedViewBooking.breakfast_menu}</p>
                    </div>
                  )}
                  {selectedViewBooking.morning_tea_required && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 block mb-1">Morning Tea</span>
                      <p className="text-sm text-gray-800">{selectedViewBooking.morning_snack_option}</p>
                    </div>
                  )}
                  {selectedViewBooking.lunch_required && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 block mb-1">Lunch</span>
                      <p className="text-sm text-gray-800">{selectedViewBooking.lunch_menu}</p>
                    </div>
                  )}
                  {selectedViewBooking.evening_tea_required && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 block mb-1">Evening Tea</span>
                      <p className="text-sm text-gray-800">{selectedViewBooking.evening_snack_option}</p>
                    </div>
                  )}
                  {selectedViewBooking.dinner_required && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 block mb-1">Dinner</span>
                      <p className="text-sm text-gray-800">{selectedViewBooking.dinner_menu}</p>
                    </div>
                  )}
                </div>
              </section>

            </div>

            {/* Panel Footer / Actions */}
            {selectedViewBooking.status === "pending" && (
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

      {/* FORM MODAL */}
      {showForm && (
        <MessBookingForm
          onClose={() => {
            setShowForm(false)
            setEditMode(false)
            setSelectedEditBooking(null)
          }}
          editData={editMode ? selectedEditBooking : null}
          onSave={(updatedBooking) => {
            if (editMode) {
              setBookings((prev) =>
                prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b))
              )
              showToast("Booking updated successfully!")
            } else {
              setBookings((prev) => [updatedBooking, ...prev])
              showToast("Booking submitted! Awaiting admin approval.")
              setSelectedDate("") // Clear date to show new booking in upcoming
            }
            setShowForm(false)
            setEditMode(false)
            setSelectedEditBooking(null)
          }}
        />
      )}

      {/* DELETE MODAL */}
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

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Cancel Booking?
            </h2>

            <p className="text-gray-500 text-sm leading-relaxed">
              You're about to cancel the catering request for:
            </p>

            <div className="mt-4">
              <h3 className="text-xl font-bold text-gray-800 break-words">
                {selectedBookingToDelete.purpose_of_programme}
              </h3>
              <p className="text-gray-400 text-sm mt-1 break-words">
                {selectedBookingToDelete.booking_date} • {selectedBookingToDelete.delivery_time?.slice(0, 5)}
              </p>
            </div>

            <p className="text-red-400 text-sm mt-5">
              This action cannot be undone.
            </p>

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
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

export default Mess