import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ requiredCapability }) => {
    const authContext = useAuth();
    const { user, isLoading } = authContext;

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900 font-geist">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent"></div>
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
        // We check BOTH the nested capabilities object AND the context root 
        const hasClearance = 
            user.is_superuser || 
            user.capabilities?.[requiredCapability] || 
            authContext[requiredCapability];
        
        if (!hasClearance) {
            console.warn(`🚨 SECURITY BOUNCE: User lacks '${requiredCapability}'. Rerouting to dashboard.`);
            console.log("Current User Capabilities:", user.capabilities);
            
            return <Navigate to="/dashboard" replace />;
        }
    }

    // 3. Authorized -> Render the requested page
    return <Outlet />;
};

export default ProtectedRoute;