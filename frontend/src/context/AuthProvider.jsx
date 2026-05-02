import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext'; // Import the context object

// This file now exports ONLY a component, making Vite Fast Refresh perfectly happy.
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkAuthStatus = useCallback(async () => {
        try {
            // FIXED: Pointing to /api/auth/me/ instead of /api/users/me/
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
            // This was already correct based on your urls.py mapping
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
        // Optional: Call your Django logout endpoint here to clear cookies server-side
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};