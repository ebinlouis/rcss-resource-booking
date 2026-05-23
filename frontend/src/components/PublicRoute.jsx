import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PublicRoute = () => {
    const { user, isLoading } = useAuth();

    // 1. Wait for the backend check
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900 font-geist">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent"></div>
                    <p className="font-semibold tracking-wide text-sm">Checking session...</p>
                </div>
            </div>
        );
    }

    // 2. If they are already logged in, they shouldn't be on the login page!
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    // 3. Not logged in? Safe to show the Login page.
    return <Outlet />;
};

export default PublicRoute;