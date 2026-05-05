import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';

// Your Pages
import Login from './pages/Login';
import Home from './pages/Home';

// NEW: Admin Pages
import RoleOverridesPage from './pages/admin/RoleOverridesPage';

function App() {
  return (
    // Wrap the entire app in the AuthProvider so the session state is globally available
    <AuthProvider>
      <BrowserRouter> 
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* General Protected Routes: Requires standard login */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Home />} />
            
            {/* Future standard modules can go here: */}
            {/* <Route path="/spaces" element={<SpacesModule />} /> */}
          </Route>

          {/* STRICTLY Protected Routes: Requires IT_ADMIN clearance (or active override) */}
          <Route element={<ProtectedRoute allowedRoles={['IT_ADMIN']} />}>
            <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
            
            {/* Future admin-only modules can go here: */}
            {/* <Route path="/admin/system-logs" element={<SystemLogs />} /> */}
          </Route>

          {/* Catch-all: Redirect unknown routes back to the root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;