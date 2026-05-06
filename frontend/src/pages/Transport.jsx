import React, { useState } from "react"
import MainLayout from "../layouts/MainLayout"
import TransportBookingModal from "../components/TransportBookingModal"

import {
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

  // BOOKINGS STATE
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
    <MainLayout>

      <div className="space-y-8">

        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">

          {/* LEFT */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Transport Bookings
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Your bus and vehicle bookings
            </p>
          </div>

          {/* DATE PICKER */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2">

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm text-gray-700 bg-transparent outline-none border-none cursor-pointer"
            />

          </div>

        </div>

        {/* SECTION HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Today's bookings
            </h2>

            <p className="text-sm text-gray-400 mt-0.5">
              Confirmed and pending transport usage for selected date.
            </p>
          </div>

          {/* BUTTON */}
          <button
            onClick={() => {
              setEditMode(false)
              setSelectedEditBooking(null)
              setShowModal(true)
            }}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl shadow-sm text-sm font-medium transition"
          >
            <span className="text-lg leading-none">+</span>
            Book Transport
          </button>

        </div>

        {/* BOOKINGS */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">

  {/* TABLE HEADER */}
  <div className="hidden md:grid grid-cols-12 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400">
    <div className="col-span-2">Time</div>
    <div className="col-span-7">Transport Details</div>
    <div className="col-span-3 text-right pr-12">Status & Actions</div>
  </div>

  {/* TABLE BODY */}
  <div className="divide-y divide-gray-100">
    {bookings.map((b, i) => (
      <div
        key={i}
        className="grid grid-cols-12 px-4 py-4 gap-2 md:items-center group hover:bg-gray-50/50 transition-colors"
      >

        {/* TIME */}
        <div className="col-span-12 md:col-span-2 text-sm font-semibold text-gray-700">
          {b.time}
        </div>

        {/* BOOKING DETAILS */}
        <div className="col-span-12 md:col-span-7">
          <div
            className={`p-3 rounded-lg border ${
              b.status === "confirmed"
                ? "bg-blue-50 border-blue-100 text-blue-700"
                : "bg-yellow-50 border-yellow-100 text-yellow-700"
            }`}
          >
            <p className="font-semibold text-sm">
              {b.title}
            </p>

            <p className="text-xs opacity-70">
              {b.desc}
            </p>
          </div>
        </div>

        {/* STATUS + ACTIONS */}
        <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center gap-4 mt-2 md:mt-0">

          <span
            className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${
              b.status === "confirmed"
                ? "bg-blue-100 text-blue-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {b.status}
          </span>

          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">

            {/* EDIT */}
            <button
              onClick={() => openEditModal(b, i)}
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* DELETE */}
            <button
              onClick={() => {
                setSelectedEditIndex(i)
                openDeleteModal(b)
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>

          </div>

        </div>

      </div>
    ))}
  </div>

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

      {/* DELETE MODAL */}
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

    </MainLayout>
  )
}

export default Transport