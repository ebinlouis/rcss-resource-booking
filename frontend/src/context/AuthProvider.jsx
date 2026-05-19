import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import api from '../api/axios';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuthStatus = useCallback(async () => {
        try {
            const response = await api.get('auth/me/');
            setUser(response.data);
        } catch {
            // Credentials absent or expired — treat as logged out.
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // FIX: Wrapping checkAuthStatus() in an async IIFE means all setState
    // calls inside it happen inside an async callback, not synchronously in
    // the effect body, which satisfies the lint rule.
    useEffect(() => {
        (async () => {
            await checkAuthStatus();
        })();
    }, [checkAuthStatus]);

    const login = async (credentials) => {
        try {
            const response = await api.post('auth/login/', credentials);
            if (response.status === 200) {
                await checkAuthStatus();
                return { success: true, user: response.data };
            }
            return { success: false, error: 'Invalid credentials' };
        } catch (err) {
            const message = err?.response?.data?.detail || 'Invalid credentials';
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        try {
            await api.post('auth/logout/');
        } catch (err) {
            console.error('Logout request failed', err);
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            effectiveRoles: user?.effective_roles || [],
            isLoading,
            login,
            logout,

            // Spread the capabilities directly into context so
            // `const { can_manage_mess } = useAuth()` works cleanly.
            ...user?.capabilities,
        }}>
            {children}
        </AuthContext.Provider>
    );
};