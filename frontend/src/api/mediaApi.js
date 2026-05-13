import api from './axios';

const MEDIA_ENDPOINT = 'media/bookings/';
const SETTINGS_ENDPOINT = 'media/settings/';

const mediaApi = {
  // ── Spaces ────────────────────────────────────────────────────────────────
  getSpaces: async () => {
    const { data } = await api.get('spaces/catalog/');
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  // ── Settings (singleton) ──────────────────────────────────────────────────
  getSettings: async () => {
    const { data } = await api.get(SETTINGS_ENDPOINT);
    return data;
  },

  updateSettings: async (payload) => {
    const { data } = await api.patch(SETTINGS_ENDPOINT, payload);
    return data;
  },

  // ── Availability ──────────────────────────────────────────────────────────
  checkAvailability: async (date, start, end) => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}check_availability/`, {
      params: { date, start, end },
    });
    return data;
  },

  getDailyAvailability: async (date, type = 'equipment') => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}daily_availability/`, {
      params: { date, type },
    });
    return data;
  },

  // ── Bookings ──────────────────────────────────────────────────────────────
  getMyBookings: async () => {
    const { data } = await api.get(MEDIA_ENDPOINT, { params: { view: 'mine' } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getAllBookings: async () => {
    const { data } = await api.get(MEDIA_ENDPOINT, { params: { view: 'general' } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getPendingBookings: async () => {
    const { data } = await api.get(MEDIA_ENDPOINT, { params: { view: 'pending' } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getActiveBookings: async () => {
    const { data } = await api.get(MEDIA_ENDPOINT, { params: { view: 'active' } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getResolvedByMe: async () => {
    const { data } = await api.get(MEDIA_ENDPOINT, { params: { view: 'resolved_by_me' } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  getRunsheet: async (date) => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}runsheet/`, { params: { date } });
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  updateLoadout: async (id, equipmentRequests) => {
    const { data } = await api.patch(`${MEDIA_ENDPOINT}${id}/update_loadout/`, {
      equipment_requests: equipmentRequests,
    });
    return data;
  },

  createBooking: async (bookingData) => {
    const { data } = await api.post(MEDIA_ENDPOINT, bookingData);
    return data;
  },

  updateBooking: async (id, updateData) => {
    const { data } = await api.patch(`${MEDIA_ENDPOINT}${id}/`, updateData, {
      params: { view: 'general' },
    });
    return data;
  },

  deleteBooking: async (id) => {
    await api.delete(`${MEDIA_ENDPOINT}${id}/`, { params: { view: 'general' } });
  },

  reviewBooking: async (id, { status, remarks_by_admin = '' }) => {
    const { data } = await api.patch(
      `${MEDIA_ENDPOINT}${id}/review/`,
      { status, remarks_by_admin },
      { params: { view: 'general' } },
    );
    return data;
  },
};

export default mediaApi;