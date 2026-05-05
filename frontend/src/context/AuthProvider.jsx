import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    // NEW: States for the Role Override system
    const [effectiveRole, setEffectiveRole] = useState(null);
    const [hasActiveOverride, setHasActiveOverride] = useState(false);
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
                
                // NEW: Extract the dynamic permissions calculated mathematically by the backend
                setEffectiveRole(userData.effective_role);
                setHasActiveOverride(userData.has_active_override);
            } else {
                setUser(null);
                setEffectiveRole(null);
                setHasActiveOverride(false);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
            setEffectiveRole(null);
            setHasActiveOverride(false);
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
            // Actually hit the backend to clear the HttpOnly cookies securely
            await fetch('http://localhost:8000/api/auth/logout/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
        } catch (error) {
            console.error("Logout request failed", error);
        } finally {
            // Always clear local state even if network fails
            setUser(null);
            setEffectiveRole(null);
            setHasActiveOverride(false);
        }
    };

    return (
        // NEW: Expose effectiveRole and hasActiveOverride to the entire app
        <AuthContext.Provider value={{ 
            user, 
            effectiveRole, 
            hasActiveOverride, 
            isLoading, 
            login, 
            logout 
        }}>
            {children}
        </AuthContext.Provider>
    );
};