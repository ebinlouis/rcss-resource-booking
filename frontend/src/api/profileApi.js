import api from './axios';

const PROFILE_ENDPOINT = 'auth/me/';
const DEPARTMENTS_ENDPOINT = 'auth/departments/';

const profileApi = {
    getCurrentProfile: async () => {
        const response = await api.get(PROFILE_ENDPOINT);
        return response.data;
    },

    updateProfile: async (profileData) => {
        const isFormData = profileData instanceof FormData;
        const response = await api.patch('auth/profile/', profileData, {
            headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
        });
        return response.data;
    },

    getDepartments: async () => {
        const response = await api.get(`${DEPARTMENTS_ENDPOINT}?active=true`);
        return response.data;
    }
};

export default profileApi;
