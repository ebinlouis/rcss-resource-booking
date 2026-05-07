import api from './axios';

// Assuming your DRF router in mess/urls.py registers the ViewSet under 'mess/bookings/'
const MESS_ENDPOINT = 'mess/bookings/'; 

const messService = {
    /**
     * Fetch bookings.
     * The backend ViewSet automatically filters this based on the user's role
     * (Standard users see only theirs, staff see all).
     */
    getBookings: async () => {
        const response = await api.get(MESS_ENDPOINT);
        return response.data;
    },

    /**
     * Create a new mess booking.
     * @param {Object} bookingData - The strictly mapped JSON payload.
     */
    createBooking: async (bookingData) => {
        const response = await api.post(MESS_ENDPOINT, bookingData);
        return response.data;
    },

    /**
     * Update an existing booking (e.g., if a user edits their request).
     * Using PATCH for partial updates so we don't have to send the whole object.
     * @param {number|string} id - The primary key of the booking.
     * @param {Object} updateData - The fields to update.
     */
    updateBooking: async (id, updateData) => {
        const response = await api.patch(`${MESS_ENDPOINT}${id}/`, updateData);
        return response.data;
    },

    /**
     * Cancel/Delete a booking.
     * @param {number|string} id - The primary key of the booking.
     */
    deleteBooking: async (id) => {
        const response = await api.delete(`${MESS_ENDPOINT}${id}/`);
        return response.data;
    }
};

export default messService;