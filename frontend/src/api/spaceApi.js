import api from './axios';

const spaceApi = {
  getSpaces: async () => {
    const response = await api.get('/spaces/catalog/');
    return response.data.results ?? response.data ?? [];
  },

  getMyBookings: async () => {
    const response = await api.get('/spaces/requests/', {
      params: { view: 'mine' },
    });
    return response.data.results ?? response.data ?? [];
  },

  cancelBooking: async (id) => {
    const response = await api.delete(`/spaces/requests/${id}/`);
    return response.data;
  },

  createBooking: async (data) => {
    const response = await api.post('/spaces/requests/', data);
    return response.data;
  },

  updateBooking: async ({ id, data }) => {
    const response = await api.patch(`/spaces/requests/${id}/`, data);
    return response.data;
  },
};

export default spaceApi;
