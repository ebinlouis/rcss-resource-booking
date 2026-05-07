import React, { useState } from "react"
import MainLayout from "../layouts/MainLayout"

import {
  UtensilsCrossed,
  Pencil,
  Trash2,
  X
} from "lucide-react"

function Mess() {

  const initialMeals = {
    "2026-05-05": [
      {
        meal: "Breakfast",
        time: "08:00 AM",
        menu: "Idli, Sambar & Tea",
        status: "confirmed"
      },
      {
        meal: "Lunch",
        time: "01:00 PM",
        menu: "Meals + Fish Curry",
        status: "pending"
      }
    ],

    "2026-05-06": [
      {
        meal: "Dinner",
        time: "08:00 PM",
        menu: "Chapathi & Chicken Curry",
        status: "confirmed"
      }
    ]
  }

  const today = new Date()

  const formatDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const [selectedDate, setSelectedDate] = useState(formatDate(today))

  const [allMeals, setAllMeals] = useState(initialMeals)

  const [showMealModal, setShowMealModal] = useState(false)

  const [editMode, setEditMode] = useState(false)

  const [selectedMeal, setSelectedMeal] = useState(null)

  const [selectedIndex, setSelectedIndex] = useState(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const meals = allMeals[selectedDate] || []

  const openEditModal = (meal, index) => {
    setSelectedMeal(meal)
    setSelectedIndex(index)
    setEditMode(true)
    setShowMealModal(true)
  }

  const openDeleteModal = (meal, index) => {
    setSelectedMeal(meal)
    setSelectedIndex(index)
    setShowDeleteModal(true)
  }

  const deleteMeal = () => {

    const updated = { ...allMeals }

    updated[selectedDate] = updated[selectedDate].filter(
      (_, i) => i !== selectedIndex
    )

    setAllMeals(updated)

    setShowDeleteModal(false)

    setSelectedMeal(null)
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-start">

          <div>

            <h1 className="text-2xl font-bold text-gray-900">
              Mess Bookings
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Manage your meal reservations and food schedules
            </p>

          </div>

          <button
            onClick={() => {
              setEditMode(false)
              setSelectedMeal(null)
              setShowMealModal(true)
            }}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition"
          >
            <span className="text-lg leading-none">+</span>
            Reserve Meal
          </button>

        </div>

        {/* DATE SECTION */}
        <div className="flex justify-between items-start">

          <div>

            <h2 className="text-lg font-semibold text-gray-900">
              Reserved meals
            </h2>

            <p className="text-sm text-gray-400 mt-0.5">
              Breakfast, lunch, and dinner bookings for selected date
            </p>

          </div>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="
              border border-gray-200
              rounded-lg
              px-3 py-1.5
              text-sm
              bg-white
              shadow-sm
              outline-none
              focus:ring-2
              focus:ring-green-500/20
              focus:border-green-500
            "
          />

        </div>

        {/* BOOKINGS */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">

          {/* TABLE HEADER */}
          <div className="hidden md:grid grid-cols-12 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-widest text-gray-400">

            <div className="col-span-2">
              Meal
            </div>

            <div className="col-span-2">
              Time
            </div>

            <div className="col-span-5">
              Menu
            </div>

            <div className="col-span-3 text-right pr-12">
              Status & Actions
            </div>

          </div>

          {/* TABLE BODY */}
          <div className="divide-y divide-gray-100">

            {meals.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">
                No meal reservations for this day
              </div>
            )}

            {meals.map((meal, index) => (

              <div
                key={index}
                className="grid grid-cols-12 px-4 py-4 gap-2 md:items-center group hover:bg-gray-50/50 transition-colors"
              >

                {/* MEAL */}
                <div className="col-span-12 md:col-span-2">

                  <div className="flex items-center gap-2">

                    <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">

                      <UtensilsCrossed className="w-4 h-4 text-green-700" />

                    </div>

                    <div>

                      <p className="text-sm font-semibold text-gray-800">
                        {meal.meal}
                      </p>

                    </div>

                  </div>

                </div>

                {/* TIME */}
                <div className="col-span-12 md:col-span-2 text-sm font-medium text-gray-600">
                  {meal.time}
                </div>

                {/* MENU */}
                <div className="col-span-12 md:col-span-5">

                  <div
                    className={`p-3 rounded-lg border ${
                      meal.status === "confirmed"
                        ? "bg-green-50 border-green-100 text-green-700"
                        : "bg-yellow-50 border-yellow-100 text-yellow-700"
                    }`}
                  >

                    <p className="text-sm font-semibold">
                      {meal.menu}
                    </p>

                  </div>

                </div>

                {/* STATUS + ACTIONS */}
                <div className="col-span-12 md:col-span-3 flex justify-between md:justify-end items-center gap-4 mt-2 md:mt-0">

                  <span
                    className={`text-[10px] font-bold uppercase tracking-tight px-2 py-1 rounded-md ${
                      meal.status === "confirmed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {meal.status}
                  </span>

                  <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">

                    {/* EDIT */}
                    <button
                      onClick={() => openEditModal(meal, index)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* DELETE */}
                    <button
                      onClick={() => openDeleteModal(meal, index)}
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

      {/* SIMPLE MODAL */}
      {showMealModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 px-4">

          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative">

            <button
              onClick={() => setShowMealModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {editMode ? "Edit Meal Booking" : "Reserve Meal"}
            </h2>

            <p className="text-sm text-gray-500 mb-6">
              Meal booking form goes here
            </p>

            <button
              onClick={() => setShowMealModal(false)}
              className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-xl text-sm font-semibold transition"
            >
              Done
            </button>

          </div>

        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && selectedMeal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50 px-4">

          <div className="bg-white rounded-2xl w-full max-w-sm p-5 relative shadow-2xl text-center">

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
              Cancel Reservation?
            </h2>

            {/* MESSAGE */}
            <p className="text-gray-500 text-sm leading-relaxed">
              You're about to cancel your meal booking for
            </p>

            {/* BOOKING */}
            <div className="mt-4">

              <h3 className="text-xl font-bold text-gray-800">
                {selectedMeal.meal}
              </h3>

              <p className="text-gray-400 text-sm mt-1">
                {selectedMeal.menu}
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
                Keep Reservation
              </button>

              <button
                onClick={deleteMeal}
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

export default Mess