import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Home from "./pages/Home";
import Transport from "./pages/Transport";
import Mess from "./pages/Mess";

// Admin Pages
import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from './pages/admin/AdminDashboard';
import RoleOverridesPage from "./pages/admin/RoleOverridesPage";
import AdminSpacesPage from "./pages/admin/AdminSpacesPage"; // <-- ADDED IMPORT

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* General Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Home />} />
            <Route path="/transport" element={<Transport />} />
            <Route path="/mess" element={<Mess />} />
          </Route>

          {/* STRICTLY Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['IT_ADMIN']} />}>
            
            {/* The Admin Layout Wrapper */}
            <Route element={<AdminLayout />}>
              {/* The "index" route maps to exactly /admin */}
              <Route path="/admin" element={<AdminDashboard />} />
              
              {/* Manage Spaces Route */}
              <Route path="/admin/spaces" element={<AdminSpacesPage />} />
              
              {/* Nested route maps to /admin/role-overrides */}
              <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
            </Route>

          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;