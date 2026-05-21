import api from './axios';

const notificationService = {
    getNotifications: async (params = {}) => {
        const response = await api.get('notifications/', { params });
        return response.data;
    },

    getUnreadCount: async () => {
        const response = await api.get('notifications/unread-count/');
        return response.data.unread_count ?? 0;
    },

    markRead: async (id) => {
        const response = await api.patch(`notifications/${id}/read/`);
        return response.data;
    },

    markAllRead: async () => {
        const response = await api.patch('notifications/mark-all-read/');
        return response.data;
    },
};

export default notificationService;
