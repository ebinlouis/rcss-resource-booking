import React, { useState } from "react"
import Navbar from "../components/Navbar"
import MessBookingForm from "../components/MessBookingForm"
import Footer from "../components/Footer"
import {
  Pencil,
  Trash2,
  Users,
  Clock3,
  UtensilsCrossed,
  X
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
        status: "confirmed"
      },
      {
        meal: "Lunch",
        items: "Biriyani",
        time: "01:00 PM",
        type: "Non-Veg",
        people: 80,
        status: "pending"
      },
      {
        meal: "Dinner",
        items: "Chapathi & Curry",
        time: "08:00 PM",
        type: "Veg",
        people: 60,
        status: "confirmed"
      },
      {
        meal: "Snacks",
        items: "Banana Fritters & Tea",
        time: "05:00 PM",
        type: "Veg",
        people: 50,
        status: "confirmed"
      }
    ]
  }

  const today = new Date()

  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [mealFilter, setMealFilter] = useState("All")

  // ALL BOOKINGS STATE
  const [allBookings, setAllBookings] = useState(initialBookings)

  // FORM STATES
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedEditBooking, setSelectedEditBooking] = useState(null)
  const [selectedEditIndex, setSelectedEditIndex] = useState(null)

  // DELETE MODAL
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
    <div className="min-h-screen bg-white">

      {/* NAVBAR */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <div className="p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">

          <div>
            <h1 className="text-2xl font-bold">
              Mess Bookings
            </h1>

            <p className="text-gray-600">
              Manage your food and catering requests
            </p>
          </div>

          {/* DATE */}
          <div className="bg-white rounded-xl shadow-sm px-3 py-2">

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none border-none cursor-pointer"
            />

          </div>

        </div>

        {/* FILTER + BUTTON */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">

          <div className="flex gap-3 flex-wrap">
            {["All", "Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => (
              <button
                key={meal}
                onClick={() => setMealFilter(meal)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
                  mealFilter === meal
                    ? "bg-gray-100 text-gray-800 border-gray-300"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {meal}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setEditMode(false)
              setSelectedEditBooking(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition"
          >
            + Book Meal
          </button>

        </div>

        {/* TABLE */}
        <div className="border rounded-xl overflow-hidden bg-white">

          {/* HEADER */}
          <div className="grid grid-cols-4 bg-gray-100 text-gray-500 text-sm px-4 py-2">
            <span>MEAL</span>
            <span className="col-span-3">BOOKING</span>
          </div>

          {/* EMPTY */}
          {filteredBookings.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">
              No bookings for this day
            </p>
          )}

          {/* DATA */}
          {filteredBookings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-4 items-center px-4 py-4 border-t"
            >

              {/* LEFT */}
              <span className="font-semibold text-gray-700">
                {b.meal}
              </span>

              {/* CARD */}
              <div
                className={`col-span-3 p-4 rounded-xl border ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-orange-50 border-orange-300"
                }`}
              >

                <div className="flex justify-between items-center gap-4">

                  {/* LEFT CONTENT */}
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                      <UtensilsCrossed size={18} />
                      {b.items}
                    </h3>

                    <p className="text-sm text-gray-500 flex items-center gap-3 flex-wrap mt-1">

                      {/* PEOPLE */}
                      <span className="flex items-center gap-1">
                        <Users size={15} />
                        {b.people}
                      </span>

                      {/* TIME */}
                      <span className="flex items-center gap-1">
                        <Clock3 size={15} />
                        {b.time}
                      </span>

                      {/* TYPE */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          b.type === "Veg"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {b.type}
                      </span>

                    </p>
                  </div>

                  {/* RIGHT */}
                  <div className="flex items-center gap-3">

                    {/* STATUS */}
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${
                        b.status === "confirmed"
                          ? "bg-blue-200 text-blue-700"
                          : "bg-orange-200 text-orange-700"
                      }`}
                    >
                      {b.status}
                    </span>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-2">

                      {/* EDIT */}
                      <button
                        onClick={() => openEditModal(b, i)}
                        className="text-gray-400 hover:text-blue-600 transition"
                      >
                        <Pencil size={18} />
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => openDeleteModal(b)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={18} />
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
                ...updatedBooking
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

          <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md p-5 sm:p-6 relative shadow-2xl text-center">

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
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Cancel Booking?
            </h2>

            {/* MESSAGE */}
            <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
              You're about to cancel your booking for
            </p>

            {/* BOOKING */}
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">
                {selectedBooking.items}
              </h3>

              <p className="text-gray-400 text-sm sm:text-base mt-1 break-words">
                {selectedBooking.meal} • {selectedBooking.time}
              </p>
            </div>

            {/* WARNING */}
            <p className="text-red-400 text-sm sm:text-base mt-5">
              This action cannot be undone.
            </p>

            {/* BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">

              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm sm:text-base font-medium hover:bg-gray-50 transition"
              >
                Keep booking
              </button>

              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm sm:text-base font-semibold transition"
              >
                Yes, cancel it
              </button>

            </div>

          </div>

        </div>
      )}

      <Footer />

    </div>
  )
}

export default Mess