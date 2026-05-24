import api from './axios';

const MESS_ENDPOINT = 'mess/bookings/';

const messService = {
  // Used by the personal dashboard. Always returns only the current
  // user's own bookings, regardless of their role.
  getMyBookings: async () => {
    const response = await api.get(`${MESS_ENDPOINT}my-bookings/`);
    return response.data;
  },

  // Used by the admin dashboard. Returns all bookings for admin roles,
  // and own bookings for standard users (scoped by the backend).
  // Handles both paginated { results: [] } and plain array responses.
  getAllBookings: async () => {
    const response = await api.get(MESS_ENDPOINT);
    const data = response.data;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  createBooking: async (bookingData) => {
    const response = await api.post(MESS_ENDPOINT, bookingData);
    return response.data;
  },

  updateBooking: async (id, updateData) => {
    const response = await api.patch(`${MESS_ENDPOINT}${id}/`, updateData);
    return response.data;
  },

  // Django returns 204 No Content on successful delete — no response body.
  deleteBooking: async (id) => {
    await api.delete(`${MESS_ENDPOINT}${id}/`);
  },

  approveBooking: async (id) => {
    const response = await api.patch(`${MESS_ENDPOINT}${id}/approve/`);
    return response.data;
  },

  // rejection_remark is required. The backend will return HTTP 400
  // with a field error if it is missing or blank.
  rejectBooking: async (id, rejectionRemark) => {
    const response = await api.patch(`${MESS_ENDPOINT}${id}/reject/`, {
      rejection_remark: rejectionRemark,
    });
    return response.data;
  },

  // NEW: Fetch suggestions for autocomplete
  getSuggestions: async (field) => {
    const response = await api.get(
      `${MESS_ENDPOINT}suggestions/?field=${field}`
    );
    return response.data;
  },
};

export default messService;