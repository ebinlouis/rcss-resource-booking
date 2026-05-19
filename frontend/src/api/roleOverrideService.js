import api from './axios'; 

const API_PREFIX = 'auth/';
const SPACES_PREFIX = 'spaces/';

const roleOverrideService = {
    /**
     * Get all role overrides.
     * @param {boolean} activeOnly - If true, fetches only currently active overrides.
     * @returns {Promise<Array>} List of override objects.
     */
    getOverrides: async (activeOnly = false) => {
        const url = activeOnly 
            ? `${API_PREFIX}role-overrides/?active=true` 
            : `${API_PREFIX}role-overrides/`;
        const response = await api.get(url);
        return response.data;
    },

    /**
     * Grant a new role override to a user.
     * Payload includes user, role (TextChoice), expires_at, and optional scope_type, block, space.
     */
    grantOverride: async (data) => {
        const response = await api.post(`${API_PREFIX}role-overrides/`, data);
        return response.data;
    },

    /**
     * Revoke an active override via the dedicated backend action.
     */
    revokeOverride: async (id) => {
        const response = await api.post(`${API_PREFIX}role-overrides/${id}/revoke/`);
        return response.data;
    },

    /**
     * Fetch available roles from the system (now TextChoices).
     */
    getRoles: async () => {
        const response = await api.get(`${API_PREFIX}roles/`);
        return response.data;
    },

    /**
     * Search users by name, email, or ID for the autocomplete dropdown.
     */
    searchUsers: async (query) => {
        const response = await api.get(`${API_PREFIX}users/search/?q=${encodeURIComponent(query)}`);
        return response.data;
    },

    /**
     * Fetch all blocks for scoping.
     */
    getBlocks: async () => {
        const response = await api.get(`${SPACES_PREFIX}blocks/`);
        return response.data;
    },

    /**
     * Fetch all spaces for scoping.
     */
    getSpaces: async () => {
        const response = await api.get(`${SPACES_PREFIX}catalog/`);
        return response.data;
    }
};

export default roleOverrideService;