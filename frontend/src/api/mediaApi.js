/**
 * mediaApi.js — src/api/mediaApi.js
 *
 * Axios-based API layer for the Media booking module.
 * Mirrors the pattern used by messService.js and fleetApi.js.
 */
import api from './axios';

const MEDIA_ENDPOINT = 'media/bookings/';

const mediaService = {
  /**
   * GET /api/spaces/catalog/
   * Returns spaces for media booking form.
   */
  getSpaces: async () => {
    const response = await api.get('spaces/catalog/');
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  /**
   * GET /api/media/bookings/check_availability/
   * Returns exact inventory math for the selected time window.
   */
  checkAvailability: async (date, start, end) => {
    const response = await api.get(`${MEDIA_ENDPOINT}check_availability/`, {
      params: { date, start, end }
    });
    return response.data;
  },

  getMyBookings: async () => {
    const response = await api.get(MEDIA_ENDPOINT, { params: { view: 'mine' } });
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

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
   */
  createBooking: async (bookingData) => {
    const response = await api.post(MEDIA_ENDPOINT, bookingData);
    return response.data;
  },

  /**
   * PATCH /api/media/bookings/<id>/
   */
  updateBooking: async (id, updateData) => {
    const response = await api.patch(`${MEDIA_ENDPOINT}${id}/`, updateData);
    return response.data;
  },

  /**
   * DELETE /api/media/bookings/<id>/
   */
  deleteBooking: async (id) => {
    await api.delete(`${MEDIA_ENDPOINT}${id}/`);
  },

  /**
   * PATCH /api/media/bookings/<id>/review/
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