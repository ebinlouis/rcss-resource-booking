/**
 * mediaApi.js — src/api/mediaApi.js
 *
 * Axios-based API layer for the Media booking module.
 * Mirrors the pattern used by messService.js and fleetApi.js.
 * All requests use the shared axios instance (HttpOnly cookie auth + CSRF).
 */
import api from './axios';

const MEDIA_ENDPOINT = 'media/bookings/';

const mediaService = {
  /**
   * GET /api/spaces/spaces/
   * Returns spaces for media booking form.
   */
  getSpaces: async () => {
    const response = await api.get('spaces/catalog/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  /**
   * GET /api/media/bookings/?view=mine
   * Returns only the current user's own bookings.
   */
  getMyBookings: async () => {
    const response = await api.get(MEDIA_ENDPOINT, { params: { view: 'mine' } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  /**
   * GET /api/media/bookings/?view=general
   * Returns all non-rejected bookings (general activity feed).
   */
  getAllBookings: async () => {
    const response = await api.get(MEDIA_ENDPOINT, { params: { view: 'general' } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getPendingBookings: async () => {
    const response = await api.get(MEDIA_ENDPOINT, { params: { view: 'pending' } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getActiveBookings: async () => {
    const response = await api.get(MEDIA_ENDPOINT, { params: { view: 'active' } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getResolvedByMe: async () => {
    const response = await api.get(MEDIA_ENDPOINT, { params: { view: 'resolved_by_me' } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  /**
   * POST /api/media/bookings/
   * Creates a new media booking.
   * Backend auto-assigns user and department from the JWT session.
   */
  createBooking: async (bookingData) => {
    const response = await api.post(MEDIA_ENDPOINT, bookingData);
    return response.data;
  },

  /**
   * PATCH /api/media/bookings/<id>/
   * Updates a PENDING media booking (owner only).
   */
  updateBooking: async (id, updateData) => {
    const response = await api.patch(`${MEDIA_ENDPOINT}${id}/`, updateData);
    return response.data;
  },

  /**
   * DELETE /api/media/bookings/<id>/
   * Deletes a booking. Django returns 204 No Content on success.
   */
  deleteBooking: async (id) => {
    await api.delete(`${MEDIA_ENDPOINT}${id}/`);
  },

  /**
   * PATCH /api/media/bookings/<id>/review/
   * Admin action: approve or reject a PENDING media booking.
   * Payload: { status: 'APPROVED' | 'REJECTED', remarks_by_admin: string }
   */
  reviewBooking: async (id, { status, remarks_by_admin = '' }) => {
    const response = await api.patch(`${MEDIA_ENDPOINT}${id}/review/`, {
      status,
      remarks_by_admin,
    });
    return response.data;
  },
};

export default mediaService;
