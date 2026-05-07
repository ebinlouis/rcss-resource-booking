import api from './axios'; 

const API_PREFIX = 'auth/';

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
     * @param {Object} data - The override data { user: ID, overridden_role: ID, expires_at: ISO-String }.
     * @returns {Promise<Object>} The created override object.
     */
    grantOverride: async (data) => {
        const response = await api.post(`${API_PREFIX}role-overrides/`, data);
        return response.data;
    },

    /**
     * Revoke an active override (Soft delete / deactivate).
     * @param {number|string} id - The ID of the override to revoke.
     * @returns {Promise<Object>} The updated override object.
     */
    revokeOverride: async (id) => {
        const response = await api.patch(`${API_PREFIX}role-overrides/${id}/`, {
            is_active: false
        });
        return response.data;
    },

    /**
     * Fetch available roles/groups from the system to populate the grant form.
     * @returns {Promise<Array>} List of available role objects (e.g., [{id: 1, name: 'IT_ADMIN'}]).
     */
    getRoles: async () => {
        const response = await api.get(`${API_PREFIX}roles/`);
        return response.data;
    },

    /**
     * Search users by name, email, or ID for the autocomplete dropdown.
     * @param {string} query - The search string.
     * @returns {Promise<Array>} List of matching user objects.
     */
    searchUsers: async (query) => {
        const response = await api.get(`${API_PREFIX}users/search/?q=${encodeURIComponent(query)}`);
        return response.data;
    }
};

export default roleOverrideService;