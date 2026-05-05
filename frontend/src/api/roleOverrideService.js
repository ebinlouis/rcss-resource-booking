import axiosInstance from './axios'; // Assuming this is your configured instance

const API_URL = 'role-overrides/';

const roleOverrideService = {
    // Get all overrides (optional: filter by active status)
    getOverrides: async (activeOnly = false) => {
        const url = activeOnly ? `${API_URL}?active=true` : API_URL;
        const response = await axiosInstance.get(url);
        return response.data;
    },

    // Grant a new override
    grantOverride: async (data) => {
        // data expects: { user: ID, overridden_role: ID, expires_at: "ISO-8601-String" }
        const response = await axiosInstance.post(API_URL, data);
        return response.data;
    },

    // Revoke an override (Soft delete / deactivate)
    revokeOverride: async (id) => {
        const response = await axiosInstance.patch(`${API_URL}${id}/`, {
            is_active: false
        });
        return response.data;
    }
};

export default roleOverrideService;