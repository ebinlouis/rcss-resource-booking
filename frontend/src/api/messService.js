import api from './axios';

const MESS_ENDPOINT = 'mess/bookings/'; 

const messService = {
    getBookings: async () => {
        const response = await api.get(MESS_ENDPOINT);
        return response.data;
    },
    createBooking: async (bookingData) => {
        const response = await api.post(MESS_ENDPOINT, bookingData);
        return response.data;
    },
    updateBooking: async (id, updateData) => {
        const response = await api.patch(`${MESS_ENDPOINT}${id}/`, updateData);
        return response.data;
    },
    deleteBooking: async (id) => {
        const response = await api.delete(`${MESS_ENDPOINT}${id}/`);
        return response.data;
    },

    // NEW: Admin Actions
    approveBooking: async (id) => {
        // Calls our custom locked-down Django endpoint
        const response = await api.patch(`${MESS_ENDPOINT}${id}/approve/`);
        return response.data;
    },
    rejectBooking: async (id) => {
        // Standard partial update to flip the status
        const response = await api.patch(`${MESS_ENDPOINT}${id}/`, { status: 'rejected' });
        return response.data;
    }
};

export default messService;