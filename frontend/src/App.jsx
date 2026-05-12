import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Home from "./pages/Home";
import Transport from "./pages/Transport";
import Mess from "./pages/Mess";
import Media from "./pages/Media";
import MyBookingsPage from "./pages/MyBookingsPage";
import Profile from "./pages/Profile";

// Admin Pages
import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from './pages/admin/AdminDashboard';
import RoleOverridesPage from "./pages/admin/RoleOverridesPage";
import AdminSpacesPage from "./pages/admin/AdminSpacesPage";
import AdminEquipmentPage from "./pages/admin/AdminEquipmentPage";
import AdminDepartmentsPage from "./pages/admin/AdminDepartmentsPage";
import AdminTransportPage from "./pages/admin/AdminTransportPage";
import AdminMess from "./pages/admin/AdminMess";
import AdminMediaPage from "./pages/admin/AdminMediaPage";

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
            <Route path="/media" element={<Media />} />
            <Route path="/mess" element={<Mess />} />
            <Route path="/my-bookings" element={<MyBookingsPage />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* ========================================== */}
          {/* ADMIN ROUTES                               */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute requiredCapability="can_access_admin_portal" />}>
            <Route element={<AdminLayout />}>

              {/* Space approval dashboard — system admins and approvers only.
                  Media admins hitting /admin are redirected inside AdminDashboard. */}
              <Route path="/admin" element={<AdminDashboard />} />

              {/* ── Mess admin ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_mess" />}>
                <Route path="/admin/mess" element={<AdminMess />} />
              </Route>

              {/* ── Media admin — scoped to can_manage_media only, NOT can_manage_system ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_media" />}>
                <Route path="/admin/media" element={<AdminMediaPage />} />
              </Route>

              {/* ── System admin routes ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_system" />}>
                <Route path="/admin/spaces" element={<AdminSpacesPage />} />
                <Route path="/admin/equipment" element={<AdminEquipmentPage />} />
                <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
                <Route path="/admin/transport" element={<AdminTransportPage />} />
                <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
              </Route>

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