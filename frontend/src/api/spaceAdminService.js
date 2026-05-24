import api from './axios';

const PREFIX = 'spaces/';

const spaceAdminService = {
    // --- BLOCKS ---
    getBlocks: async () => {
        const response = await api.get(`${PREFIX}blocks/`);
        return response.data;
    },
    createBlock: async (data) => {
        const response = await api.post(`${PREFIX}blocks/`, data);
        return response.data;
    },
    updateBlock: async (id, data) => {
        const response = await api.patch(`${PREFIX}blocks/${id}/`, data);
        return response.data;
    },
    // Assuming backend handles soft-delete via DELETE or PATCH is_active
    deleteBlock: async (id) => {
        const response = await api.delete(`${PREFIX}blocks/${id}/`);
        return response.data;
    },

    // --- SPACE APPROVERS ---
    getApprovers: async (params = {}) => {
        // params can be { user, role, block, active } based on your view filters
        const response = await api.get(`${PREFIX}approvers/`, { params });
        return response.data;
    },
    createApprover: async (data) => {
        const response = await api.post(`${PREFIX}approvers/`, data);
        return response.data;
    },
    updateApprover: async (id, data) => {
        const response = await api.patch(`${PREFIX}approvers/${id}/`, data);
        return response.data;
    },
    deleteApprover: async (id) => {
        const response = await api.delete(`${PREFIX}approvers/${id}/`);
        return response.data;
    },

    // --- FACULTY ---
    fetchFacultyList: async (departmentId) => {
        const url = departmentId ? `${PREFIX}faculty-list/?department=${departmentId}` : `${PREFIX}faculty-list/`;
        const response = await api.get(url);
        return response.data;
    }
};

export default spaceAdminService;