import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext'; 

export const AuthProvider = ({ children }) => {
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
                setUser(userData); 
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
                return { success: true, user: await response.json() };
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