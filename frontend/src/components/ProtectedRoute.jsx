import { Navigate, Outlet } from 'react-router-dom';
// Update this import line to point to your new hook:
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
                <p>Loading session...</p>
            </div>
        );
    }

    return user ? <Outlet /> : <Navigate to="/" replace />;
};

export default ProtectedRoute;