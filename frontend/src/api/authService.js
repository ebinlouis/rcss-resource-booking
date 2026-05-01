import api from './axios';

export const authService = {
    login: async (email, password) => {
        const response = await api.post('auth/login/', { email, password });
        return response.data;
    },
    logout: async () => {
        await api.post('auth/logout/');
    }
};