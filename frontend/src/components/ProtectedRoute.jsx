import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ allowedRoles }) => {
    // NEW: Pulling effectiveRole from our updated context
    const { user, effectiveRole, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <p className="font-semibold tracking-wide">Verifying clearance...</p>
                </div>
            </div>
        );
    }

    // 1. Not authenticated at all -> Send back to login
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // 2. Role-based Authorization Check
    if (allowedRoles && allowedRoles.length > 0) {
        // Absolute Backend Admins bypass all React routing rules
        const hasClearance = user.is_superuser || allowedRoles.includes(effectiveRole);
        
        if (!hasClearance) {
            // They are logged in, but tried to sneak into an admin route. 
            // Send them back to their standard dashboard.
            return <Navigate to="/dashboard" replace />;
        }
    }

    // 3. Authorized -> Render the requested page
    return <Outlet />;
};

export default ProtectedRoute;