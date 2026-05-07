import React, { useState } from "react"
import MainLayout from "../layouts/MainLayout"
import MessBookingForm from "../components/MessBookingForm"

import {
  Pencil,
  Trash2,
  Users,
  Clock3,
  UtensilsCrossed,
  X,
} from "lucide-react"

function Mess() {
  const initialBookings = {
    "2026-05-05": [
      {
        meal: "Breakfast",
        items: "Appam & Curry",
        time: "08:30 AM",
        type: "Veg",
        people: 120,
        status: "confirmed",
      },
      {
        meal: "Lunch",
        items: "Biriyani",
        time: "01:00 PM",
        type: "Non-Veg",
        people: 80,
        status: "pending",
      },
      {
        meal: "Dinner",
        items: "Chapathi & Curry",
        time: "08:00 PM",
        type: "Veg",
        people: 60,
        status: "confirmed",
      },
      {
        meal: "Snacks",
        items: "Banana Fritters & Tea",
        time: "05:00 PM",
        type: "Veg",
        people: 50,
        status: "confirmed",
      },
    ],
  }

  const today = new Date()

  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [mealFilter, setMealFilter] = useState("All")

  const [allBookings, setAllBookings] = useState(initialBookings)

  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedEditBooking, setSelectedEditBooking] = useState(null)
  const [selectedEditIndex, setSelectedEditIndex] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)

  const bookings = allBookings[selectedDate] || []

  const filteredBookings =
    mealFilter === "All"
      ? bookings
      : bookings.filter((b) => b.meal === mealFilter)

  const openDeleteModal = (booking) => {
    setSelectedBooking(booking)
    setShowDeleteModal(true)
  }

  const openEditModal = (booking, index) => {
    setSelectedEditBooking(booking)
    setSelectedEditIndex(index)
    setEditMode(true)
    setShowForm(true)
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* HEADER */}
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

        {/* FILTERS */}
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

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* BOOKINGS */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* HEADER */}
          <div className="grid grid-cols-4 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-4 border-b border-gray-100">
            <span>Meal</span>
            <span className="col-span-3">Booking Details</span>
          </div>

          {/* EMPTY */}
          {filteredBookings.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-400">
              No bookings for this day
            </div>
          )}

          {/* BOOKINGS */}
          {filteredBookings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start px-5 py-5 border-t border-gray-100 hover:bg-gray-50/60 transition-all"
            >
              {/* LEFT */}
              <div>
                <span className="font-semibold text-gray-800 text-sm">
                  {b.meal}
                </span>
              </div>

              {/* CARD */}
              <div
                className={`md:col-span-3 rounded-2xl border p-5 ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-100"
                    : "bg-yellow-50 border-yellow-100"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* LEFT CONTENT */}
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <UtensilsCrossed size={18} />
                      {b.items}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                      {/* PEOPLE */}
                      <span className="flex items-center gap-1">
                        <Users size={15} />
                        {b.people} people
                      </span>

                      {/* TIME */}
                      <span className="flex items-center gap-1">
                        <Clock3 size={15} />
                        {b.time}
                      </span>

                      {/* TYPE */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          b.type === "Veg"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {b.type}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className="flex items-center gap-3">
                    {/* STATUS */}
                    <span
                      className={`text-[10px] uppercase tracking-wide font-bold px-3 py-1 rounded-full ${
                        b.status === "confirmed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {b.status}
                    </span>

                    {/* ACTIONS */}
                    <div className="flex items-center gap-1">
                      {/* EDIT */}
                      <button
                        onClick={() => openEditModal(b, i)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-100 transition-all"
                      >
                        <Pencil size={17} />
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => openDeleteModal(b)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-100 transition-all"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              const updated = { ...allBookings }

              updated[selectedDate][selectedEditIndex] = {
                ...updated[selectedDate][selectedEditIndex],
                ...updatedBooking,
              }

              setAllBookings(updated)
            }

            setShowForm(false)
            setEditMode(false)
            setSelectedEditBooking(null)
          }}
        />
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 px-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative shadow-2xl text-center">
            {/* CLOSE */}
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            {/* ICON */}
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>

            {/* TITLE */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Cancel Booking?
            </h2>

            {/* MESSAGE */}
            <p className="text-gray-500 text-sm leading-relaxed">
              You're about to cancel your booking for
            </p>

            {/* BOOKING DETAILS */}
            <div className="mt-4">
              <h3 className="text-xl font-bold text-gray-800 break-words">
                {selectedBooking.items}
              </h3>

              <p className="text-gray-400 text-sm mt-1 break-words">
                {selectedBooking.meal} • {selectedBooking.time}
              </p>
            </div>

            <p className="text-red-400 text-sm mt-5">
              This action cannot be undone.
            </p>

            {/* BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Keep Booking
              </button>

              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm font-semibold transition"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

export default Mess