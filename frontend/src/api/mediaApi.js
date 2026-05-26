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
  // UPDATED: Now accepts full ISO Datetimes for multi-day sweeps
  checkAvailability: async (start, end, exclude_id = null) => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}check_availability/`, {
      params: { start, end, exclude: exclude_id },
    });
    return data;
  },

  getDailyAvailability: async (date, type = 'equipment') => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}daily_availability/`, {
      params: { date, type },
    });
    return data;
  },

  // ── Crew ──────────────────────────────────────────────────────────────────
  /**
   * Fetches all MEDIA_INCHARGE users annotated with is_busy/busy_bookings
   * for the given booking's time window. Used by the admin approval modal.
   */
  getCrewAvailability: async (bookingId) => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}${bookingId}/crew_availability/`);
    return data;
  },

  /**
   * Returns { total_crew, free_crew, is_full } for a given time window.
   * Pass start/end ISO strings for a specific window, or omit for today.
   */
  getCrewCount: async (params = {}) => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}crew_count/`, { params });
    return data;
  },

  /**
   * Returns the full list of active MEDIA_INCHARGE users for the
   * read-only roster card on the Admin Media page.
   */
  getCrewRoster: async () => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}crew_roster/`);
    return Array.isArray(data) ? data : [];
  },

  getEditCrewAvailability: async (bookingId) => {
    const { data } = await api.get(`${MEDIA_ENDPOINT}${bookingId}/edit_crew_availability/`);
    return data;
  },

  updateCrew: async (bookingId, assignedCrew) => {
    const { data } = await api.patch(`${MEDIA_ENDPOINT}${bookingId}/update_crew/`, {
      assigned_crew: assignedCrew,
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

  getHistoryBookings: async () => {
    const { data } = await api.get(MEDIA_ENDPOINT, { params: { view: 'history' } });
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

  /**
   * UPDATED: now accepts assigned_crew (array of user PKs) when approving.
   * The backend requires at least one crew ID to approve a booking.
   */
  reviewBooking: async (id, { status, remarks_by_admin = '', assigned_crew = [] }) => {
    const { data } = await api.patch(
      `${MEDIA_ENDPOINT}${id}/review/`,
      { status, remarks_by_admin, assigned_crew },
      { params: { view: 'general' } },
    );
    return data;
  },
};

export default mediaApi;
