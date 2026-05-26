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

    /**
     * Returns all active MEDIA_INCHARGE users.
     * Used for the read-only Media Team Roster card on AdminMediaPage.
     */
    getMediaCrew: async () => {
        const response = await api.get(`${API_PREFIX}admin-users/`, {
            params: { role: 'MEDIA_INCHARGE' },
        });
        // Handle both paginated and plain array responses
        const data = response.data;
        return Array.isArray(data) ? data : (data.results ?? []);
    },
};

export default adminUserService;
