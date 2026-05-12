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
        } catch (error) {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    const login = async (credentials) => {
        try {
            const response = await api.post('auth/login/', credentials);
            if (response.status === 200) {
                await checkAuthStatus();
                return { success: true, user: response.data };
            }
            return { success: false, error: 'Invalid credentials' };
        } catch (error) {
            const message = error?.response?.data?.detail || 'Invalid credentials';
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        try {
            await api.post('auth/logout/');
        } catch (error) {
            console.error('Logout request failed', error);
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            effectiveRole: user?.effective_role || null, 
            isLoading, 
            login, 
            logout,
            
            // Spread the capabilities directly into context so 
            // `const { can_manage_mess } = useAuth()` works cleanly.
            ...user?.capabilities 
        }}>
            {children}
        </AuthContext.Provider>
    );
};