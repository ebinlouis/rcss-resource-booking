import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import LinkedBookingWizard from "./components/LinkedBookingWizard";

// Pages
import Login from "./pages/Login";
import Home from "./pages/Home";
import Transport from "./pages/Transport";
import Mess from "./pages/Mess";
import Media from "./pages/Media";
import MediaSchedule from "./pages/MediaSchedule"; // Renamed from MediaRunsheet
import MyMediaBookingsPage from "./pages/MyMediaBookingsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import NotificationsPage from "./pages/NotificationsPage";
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
import AdminUsersPage from "./pages/admin/AdminUsersPage";

// New Space Scoping Pages
import BlocksManagement from "./pages/admin/BlocksManagement";
import SpaceApproversManagement from "./pages/admin/SpaceApproversManagement";

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
            <Route path="/media/my-bookings" element={<MyMediaBookingsPage />} />
            <Route path="/mess" element={<Mess />} />
            <Route path="/my-bookings" element={<MyBookingsPage />} />
            <Route path="/bookings/:referenceCode" element={<MyBookingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* ========================================== */}
          {/* ADMIN ROUTES                               */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute requiredCapability="can_access_admin_portal" />}>
            <Route element={<AdminLayout />}>

              <Route path="/admin" element={<AdminDashboard />} />

              {/* ── Shared Equipment Admin ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_equipment" />}>
                <Route path="/admin/equipment" element={<AdminEquipmentPage />} />
              </Route>

              {/* ── Mess admin ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_mess" />}>
                <Route path="/admin/mess" element={<AdminMess />} />
              </Route>

              {/* ── Media admin ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_media" />}>
                <Route path="/admin/media" element={<AdminMediaPage />} />
                <Route path="/media/schedule" element={<MediaSchedule />} />
              </Route>

              {/* ── System admin routes ── */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_system" />}>
                <Route path="/admin/spaces" element={<AdminSpacesPage />} />
                <Route path="/admin/blocks" element={<BlocksManagement />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/approvers" element={<SpaceApproversManagement />} />
                <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
                <Route path="/admin/transport" element={<AdminTransportPage />} />
                <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
              </Route>

            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
        <LinkedBookingWizard />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
