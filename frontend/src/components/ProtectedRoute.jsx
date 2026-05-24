import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ requiredCapability, requiredCapabilities }) => {
    const authContext = useAuth();
    const { user, isLoading } = authContext;

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900 font-geist">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent"></div>
                    <p className="font-semibold tracking-wide text-sm">
                        Verifying clearance...
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredCapability || requiredCapabilities) {
        const caps = requiredCapabilities || [requiredCapability];
        const hasClearance =
            user.is_superuser ||
            caps.some(cap => user.capabilities?.[cap] || authContext[cap]);

        if (!hasClearance) {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <Outlet />;
};

export default ProtectedRoute;