import { useState, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import api from '../api/axios';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // This flag prevents React from complaining about setting state 
        // on a component that might have already unmounted.
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                const response = await api.get('auth/me/');
                if (isMounted) {
                    setUser(response.data);
                }
            } catch {
                if (isMounted) {
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        initializeAuth();

        // Cleanup function runs when the component unmounts
        return () => {
            isMounted = false;
        };
    }, []); // Empty dependency array ensures this strictly runs only once on mount

    const login = async (credentials) => {
        try {
            const response = await api.post('auth/login/', credentials);
            
            if (response.status === 200) {
                // Fetch fresh user data immediately after successful login
                try {
                    const userResponse = await api.get('auth/me/');
                    setUser(userResponse.data);
                    return { success: true, user: userResponse.data };
                } catch {
                    return { success: false, error: 'Failed to fetch user profile.' };
                }
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
            // Guarantee the user is cleared locally even if the network fails
            setUser(null);
        }
    };

    const updateUser = (updatedUser) => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{
            user,
            effectiveRoles: user?.effective_roles || [],
            isLoading,
            login,
            logout,
            updateUser,

            // Spread the capabilities directly into context
            ...user?.capabilities,
        }}>
            {children}
        </AuthContext.Provider>
    );
};