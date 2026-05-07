import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // or '../context/AuthProvider' depending on your setup

const ProtectedRoute = ({ requiredCapability }) => {
    // We don't even need to pull effectiveRole anymore!
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900 font-geist">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-t-transparent"></div>
                    <p className="font-semibold tracking-wide text-sm">Verifying clearance...</p>
                </div>
            </div>
        );
    }

    // 1. Not authenticated at all -> Send back to login
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // 2. Capability-based Authorization Check
    if (requiredCapability) {
        // We dynamically check if the user object has the requested capability flag set to true
        // e.g., user["can_access_admin_portal"]
        const hasClearance = user.is_superuser || user[requiredCapability];
        
        if (!hasClearance) {
            // They are logged in, but tried to sneak into a route they lack capabilities for. 
            // Send them back to their standard dashboard.
            return <Navigate to="/dashboard" replace />;
        }
    }

    // 3. Authorized -> Render the requested page
    return <Outlet />;
};

export default ProtectedRoute;