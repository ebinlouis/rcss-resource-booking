import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Home from "./pages/Home";
import Transport from "./pages/Transport";
import Mess from "./pages/Mess";

// Admin Pages
import RoleOverridesPage from "./pages/admin/RoleOverridesPage";
// Admin Imports
import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from './pages/admin/AdminDashboard';

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

          {/* Admin Only Routes */}
          <Route element={<ProtectedRoute allowedRoles={["IT_ADMIN"]} />}>
            <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
            {/* <Route path="/spaces" element={<SpacesModule />} /> */}
          </Route>

          {/* STRICTLY Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['IT_ADMIN']} />}>
            
            {/* The Admin Layout Wrapper */}
            <Route element={<AdminLayout />}>
              {/* The "index" route maps to exactly /admin */}
              <Route path="/admin" element={<AdminDashboard />} />
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