// api/approvalService.js
import api from './axios';

/**
 * Each admin page passes its own domain so the backend only returns
 * bookings relevant to that page. The backend enforces this strictly —
 * omitting the param or passing an unknown domain returns a 400.
 *
 * Valid domains (must match VALID_DOMAINS in apps/approvals/views.py):
 *   'spaces' | 'fleet' | 'mess' | 'media'
 *
 * For a multi-domain admin view in future, pass a comma-separated string:
 *   getPendingApprovals({ domain: 'spaces,fleet' })
 */

const approvalService = {
    getPendingApprovals: async ({ domain }) => {
        if (!domain) {
            throw new Error("approvalService.getPendingApprovals requires a 'domain' argument.");
        }
        const response = await api.get('approvals/queue/', {
            params: { domain },
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
};

export default approvalService;