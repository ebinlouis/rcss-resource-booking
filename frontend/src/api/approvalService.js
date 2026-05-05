// api/approvalService.js
import api from './axios';

const approvalService = {
    getPendingApprovals: async () => {
        const response = await api.get('approvals/queue/');
        return response.data;
    },

    resolveBooking: async ({ module, id, status, remarks = "" }) => {
        // Correcting the keys to match what Django's request.data.get() expects
        const response = await api.patch('approvals/resolve/', {
            module: module, // 'module' matches backend
            id: id,         // Changed from booking_id to id
            status: status, // 'status' matches backend
            remarks: remarks // Changed from remarks_by_admin to remarks
        });
        return response.data;
    }
};

export default approvalService;