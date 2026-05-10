/**
 * fleetApi.js — src/api/fleetApi.js
 *
 * Axios-based API layer for the Fleet/Transport module.
 * Mirrors the pattern used in messApi.js and mediaApi.js:
 *  - All requests go through the shared axios instance (withCredentials for HttpOnly cookies).
 *  - Functions return response.data directly.
 *  - Errors propagate to the caller for UI-level handling.
 */

import api from "./axios"


// ==========================================
// VEHICLES
// ==========================================

/**
 * GET /api/fleet/vehicles/
 * Returns the list of active vehicles for the booking form dropdown.
 */
export const getVehicles = async () => {
  const res = await api.get("/fleet/vehicles/")
  return res.data
}


// ==========================================
// FLEET BOOKINGS — USER
// ==========================================

/**
 * GET /api/fleet/bookings/
 * Returns the current user's own bookings.
 * Optional query params:
 *   status  — filter by PENDING | APPROVED | REJECTED | CANCELLED
 *   date    — filter by start_datetime date (YYYY-MM-DD)
 *   vehicle — filter by vehicle id
 */
export const getMyBookings = async (params = {}) => {
  const res = await api.get("/fleet/bookings/", { params })
  return res.data
}

/**
 * GET /api/fleet/bookings/<id>/
 * Returns a single booking (must be owner or admin).
 */
export const getBookingById = async (id) => {
  const res = await api.get(`/fleet/bookings/${id}/`)
  return res.data
}

/**
 * POST /api/fleet/bookings/
 * Creates a new fleet booking.
 * The backend auto-assigns user + department from the JWT session.
 *
 * Payload shape:
 * {
 *   vehicle:           <id>,
 *   purpose:           string,
 *   start_datetime:    "YYYY-MM-DDTHH:MM",
 *   end_datetime:      "YYYY-MM-DDTHH:MM",
 *   pickup_location:   string,
 *   destination:       string,
 *   total_passengers:  number,
 *   user_notes:        string (optional),
 * }
 */
export const createBooking = async (payload) => {
  const res = await api.post("/fleet/bookings/", payload)
  return res.data
}

/**
 * PATCH /api/fleet/bookings/<id>/
 * Updates a PENDING booking (owner only).
 * Send only the fields you want to change.
 */
export const updateBooking = async (id, payload) => {
  const res = await api.patch(`/fleet/bookings/${id}/`, payload)
  return res.data
}

/**
 * PATCH /api/fleet/bookings/<id>/cancel/
 * Cancels the user's own PENDING booking.
 */
export const cancelBooking = async (id) => {
  const res = await api.patch(`/fleet/bookings/${id}/cancel/`)
  return res.data
}

/**
 * DELETE /api/fleet/bookings/<id>/
 * Hard-delete (admin only). Regular users should use cancelBooking().
 */
export const deleteBooking = async (id) => {
  const res = await api.delete(`/fleet/bookings/${id}/`)
  return res.data
}


// ==========================================
// FLEET BOOKINGS — ADMIN
// ==========================================

/**
 * GET /api/fleet/bookings/?view=general
 * Admin-only: returns ALL bookings across all users.
 */
export const getAllBookings = async (params = {}) => {
  const res = await api.get("/fleet/bookings/", { params: { ...params, view: "general" } })
  return res.data
}

/**
 * PATCH /api/fleet/bookings/<id>/review/
 * Admin-only: approve or reject a PENDING booking.
 *
 * Payload: { status: "APPROVED" | "REJECTED", remarks: string }
 * remarks is required when status === "REJECTED".
 */
export const reviewBooking = async (id, { status, remarks = "" }) => {
  const res = await api.patch(`/fleet/bookings/${id}/review/`, { status, remarks })
  return res.data
}

// ==========================================
// FLEET BOOKINGS — ADMIN VIEWS
// Add these functions to the existing fleetApi.js
// They mirror the pattern of getAllBookings() above.
// ==========================================

/**
 * GET /api/fleet/bookings/?view=pending
 * Admin-only: returns all PENDING fleet bookings across all users.
 * Used by AdminTransportPage "Pending Requests" tab.
 */
export const getPendingBookings = async (params = {}) => {
  const res = await api.get("/fleet/bookings/", { params: { ...params, view: "pending" } })
  return res.data
}

/**
 * GET /api/fleet/bookings/?view=resolved_by_me
 * Admin-only: returns all bookings resolved (approved/rejected) by the
 * currently authenticated admin. Used by "Resolved by Me" tab.
 */
export const getResolvedByMe = async (params = {}) => {
  const res = await api.get("/fleet/bookings/", { params: { ...params, view: "resolved_by_me" } })
  return res.data
}

/**
 * GET /api/fleet/bookings/?view=active
 * Admin-only: returns all currently APPROVED fleet bookings.
 * Used by "Active Bookings" tab for operational visibility.
 */
export const getActiveBookings = async (params = {}) => {
  const res = await api.get("/fleet/bookings/", { params: { ...params, view: "active" } })
  return res.data
}

/**
 * PATCH /api/fleet/bookings/<id>/reschedule/
 * Admin-only: reschedule or reassign resources on an APPROVED booking.
 * Payload may include any subset of:
 * {
 *   vehicle:          <id>,
 *   start_datetime:   "YYYY-MM-DDTHH:MM",
 *   end_datetime:     "YYYY-MM-DDTHH:MM",
 *   pickup_location:  string,
 *   destination:      string,
 *   total_passengers: number,
 *   remarks_by_admin: string,
 * }
 */
export const rescheduleBooking = async (id, payload) => {
  const res = await api.patch(`/fleet/bookings/${id}/reschedule/`, payload)
  return res.data
}