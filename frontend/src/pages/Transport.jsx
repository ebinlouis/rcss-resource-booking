import React, { useState } from "react"
import Navbar from "../components/Navbar"
import TransportBookingModal from "../components/TransportBookingModal"
import Footer from "../components/Footer"
import {
  CalendarDays,
  Pencil,
  Trash2,
  Bus,
  X
} from "lucide-react"

function Transport() {

  const initialBookings = {
    "2026-05-05": [
      {
        time: "09:00",
        title: "College Bus - Route A",
        desc: "Pickup: Kakkanad → Campus",
        status: "confirmed"
      },
      {
        time: "11:00",
        title: "Van Booking",
        desc: "Dept visit, 11:00 - 02:00",
        status: "pending"
      }
    ],
    "2026-05-06": [
      {
        time: "10:00",
        title: "Bus - Route B",
        desc: "City → Campus",
        status: "confirmed"
      }
    ]
  }

  const today = new Date()

  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))

  // ALL BOOKINGS STATE
  const [allBookings, setAllBookings] = useState(initialBookings)

  // BOOKING MODAL
  const [showModal, setShowModal] = useState(false)

  // EDIT STATES
  const [editMode, setEditMode] = useState(false)
  const [selectedEditBooking, setSelectedEditBooking] = useState(null)
  const [selectedEditIndex, setSelectedEditIndex] = useState(null)

  // DELETE MODAL
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)

  const bookings = allBookings[selectedDate] || []

  const displayDate = new Date(selectedDate).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short"
  })

  const openDeleteModal = (booking) => {
    setSelectedBooking(booking)
    setShowDeleteModal(true)
  }

  const openEditModal = (booking, index) => {
    setSelectedEditBooking(booking)
    setSelectedEditIndex(index)
    setEditMode(true)
    setShowModal(true)
  }

  const deleteBooking = () => {

    const updated = { ...allBookings }

    updated[selectedDate] = updated[selectedDate].filter(
      (_, index) => index !== selectedEditIndex
    )

    setAllBookings(updated)

    setShowDeleteModal(false)
    setSelectedBooking(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* NAVBAR */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      <div className="p-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">

          <div>
            <h1 className="text-2xl font-bold">
              Transport Bookings
            </h1>

            <p className="text-gray-500">
              Your bus and vehicle bookings
            </p>
          </div>

          {/* DATE */}
          <div className="bg-white rounded-2xl shadow-sm px-1 py-1">

            

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none border-none cursor-pointer"
              
            />

          </div>

        </div>

        {/* TODAY BOOKINGS HEADER */}
        <div className="flex justify-between items-center mb-2">

          <h2 className="text-lg font-semibold">
            Today's bookings
          </h2>

          <button
            onClick={() => {
              setEditMode(false)
              setSelectedEditBooking(null)
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition"
          >
            <span className="text-lg">+</span>
            Book Transport
          </button>

        </div>

        <p className="text-gray-500 text-sm mb-4">
          Confirmed and pending transport usage for selected date.
        </p>

        {/* BOOKINGS */}
        <div className="border rounded-xl overflow-hidden bg-white">

          {/* HEADER */}
          <div className="hidden md:grid grid-cols-4 bg-gray-100 text-gray-500 text-sm px-4 py-2">
            <span>TIME</span>
            <span className="col-span-3">BOOKING</span>
          </div>

          {/* EMPTY */}
          {bookings.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">
              No bookings for this day
            </p>
          )}

          {/* DATA */}
          {bookings.map((b, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center px-4 py-4 border-t gap-3"
            >

              {/* TIME */}
              <span className="font-semibold text-gray-700 text-lg">
                {b.time}
              </span>

              {/* CARD */}
              <div
                className={`md:col-span-3 p-4 rounded-xl border ${
                  b.status === "confirmed"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-yellow-50 border-yellow-300"
                }`}
              >

                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">

                  {/* LEFT */}
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                      <Bus size={18} />
                      {b.title}
                    </h3>

                    <p className="text-sm text-gray-500 mt-1">
                      {b.desc}
                    </p>
                  </div>

                  {/* RIGHT */}
                  <div className="flex items-center gap-3 flex-wrap">

                    {/* STATUS */}
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${
                        b.status === "confirmed"
                          ? "bg-blue-200 text-blue-700"
                          : "bg-yellow-200 text-yellow-700"
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
                        onClick={() => {
                          setSelectedEditIndex(i)
                          openDeleteModal(b)
                        }}
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

      {/* BOOKING MODAL */}
      {showModal && (
        <TransportBookingModal
          onClose={() => {
            setShowModal(false)
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

            setShowModal(false)
            setEditMode(false)
            setSelectedEditBooking(null)
          }}
        />
      )}

      {/* DELETE CONFIRM MODAL */}
      {showDeleteModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 px-4">

          <div className="bg-white rounded-2xl w-full max-w-sm p-5 relative shadow-2xl text-center">

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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Cancel Booking?
            </h2>

            {/* MESSAGE */}
            <p className="text-gray-500 text-sm leading-relaxed">
              You're about to cancel your booking for
            </p>

            {/* BOOKING */}
            <div className="mt-4">
              <h3 className="text-xl font-bold text-gray-800 break-words">
                {selectedBooking.title}
              </h3>

              <p className="text-gray-400 text-sm mt-1 break-words">
                {selectedBooking.desc}
              </p>
            </div>

            {/* WARNING */}
            <p className="text-red-400 text-sm mt-5">
              This action cannot be undone.
            </p>

            {/* BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">

              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Keep booking
              </button>

              <button
                onClick={deleteBooking}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl text-sm font-semibold transition"
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

export default Transport