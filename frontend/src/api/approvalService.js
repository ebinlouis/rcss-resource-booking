import api from './axios';

/**
 * Each admin page passes its own domain so the backend only returns
 * bookings relevant to that page. The backend enforces this strictly —
 * omitting the param or passing an unknown domain returns a 400.
 *
 * Valid domains (must match VALID_DOMAINS in apps/approvals/views.py):
 * 'spaces' | 'fleet' | 'mess' | 'media'
 */

const approvalService = {
    getApprovals: async ({ domain, status = 'PENDING' }) => {
        if (!domain) {
            throw new Error("approvalService.getApprovals requires a 'domain' argument.");
        }
        const response = await api.get('approvals/queue/', {
            params: { domain, status },
        });
        return response.data;
    },

    resolveBooking: async ({ module, id, status, remarks = "" }) => {
        const response = await api.patch('approvals/resolve/', {
            module,
            id,
            status,
            remarks,
        });
        return response.data;
    },

    fetchFacultyPending: async () => {
        const response = await api.get('spaces/requests/faculty_pending/');
        return response.data;
    },

    resolveFacultyBooking: async ({ id, action, rejectionNote = "" }) => {
        const endpoint = action === 'approve' ? 'faculty_approve' : 'faculty_reject';
        const response = await api.post(`spaces/requests/${id}/${endpoint}/`, {
            rejection_note: rejectionNote
        });
        return response.data;
    },

    fetchInchargeEscalated: async () => {
        const response = await api.get('spaces/requests/incharge_escalated/');
        return response.data;
    },

    resendFacultyBooking: async (id) => {
        const response = await api.post(`spaces/requests/${id}/incharge_resend/`);
        return response.data;
    },
};

export default approvalService;