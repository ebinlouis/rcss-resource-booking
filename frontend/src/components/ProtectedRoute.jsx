import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppLoader from "./common/AppLoader";

const ProtectedRoute = ({ requiredCapability, requiredCapabilities }) => {
    const authContext = useAuth();
    const { user, isLoading } = authContext;

    if (isLoading) {
        return <AppLoader message="Checking your access..." />;
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