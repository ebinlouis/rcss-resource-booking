import api from './axios';

const API_PREFIX = 'auth/';

const adminUserService = {
    getUsers: async (params = {}) => {
        const response = await api.get(`${API_PREFIX}admin-users/`, { params });
        return response.data;
    },

    getRoles: async () => {
        const response = await api.get(`${API_PREFIX}roles/`);
        return response.data;
    },

    setRoles: async (userId, roles) => {
        const response = await api.post(`${API_PREFIX}admin-users/${userId}/set-roles/`, { roles });
        return response.data;
    },
};

export default adminUserService;
