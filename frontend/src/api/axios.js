import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api/',
    withCredentials: true,
    // Axios natively handles Django CSRF tokens with these two lines:
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
});

// Redirect to login on session expiry mid-use
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Prevent the interceptor from firing on the initial auth check or login attempt.
        // This allows React Router to handle unauthenticated users gracefully.
        const isAuthEndpoint = error.config?.url?.includes('auth/me') || error.config?.url?.includes('auth/login');
        
        if (error.response?.status === 401 && !isAuthEndpoint) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/') {
                // Only force a hard redirect if a session expires while they are actively using the app
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;