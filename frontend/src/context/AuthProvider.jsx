import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
    // The user object now holds EVERYTHING: id, email, effective_role, 
    // can_access_admin_portal, and can_manage_system.
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuthStatus = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:8000/api/auth/me/', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', 
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData); // All capabilities are now safely in state!
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const initializeAuth = async () => {
            await checkAuthStatus();
        };
        initializeAuth();
    }, [checkAuthStatus]);

    const login = async (credentials) => {
        try {
            const response = await fetch('http://localhost:8000/api/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
                credentials: 'include', 
            });

            if (response.ok) {
                await checkAuthStatus(); 
                return { success: true };
            }
            return { success: false, error: 'Invalid credentials' };
        } catch (error) {
            console.error("Login network error:", error); 
            return { success: false, error: 'Network error occurred' };
        }
    };

    const logout = async () => {
        try {
            await fetch('http://localhost:8000/api/auth/logout/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
        } catch (error) {
            console.error("Logout request failed", error);
        } finally {
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            // For backward compatibility if any of your older components still look for effectiveRole:
            effectiveRole: user?.effective_role || null, 
            isLoading, 
            login, 
            logout 
        }}>
            {children}
        </AuthContext.Provider>
    );
};