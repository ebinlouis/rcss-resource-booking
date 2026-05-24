import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import LinkedBookingWizard from "./components/LinkedBookingWizard";

// Pages
import Login from "./pages/Login";
import Home from "./pages/Home";
import Transport from "./pages/Transport";
import Mess from "./pages/Mess";
import Media from "./pages/Media";
import MediaSchedule from "./pages/MediaSchedule";
import MyMediaBookingsPage from "./pages/MyMediaBookingsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import Profile from "./pages/Profile";
import FacultyApprovalPage from "./pages/FacultyApprovalPage";

// Admin Pages
import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import RoleOverridesPage from "./pages/admin/RoleOverridesPage";
import AdminSpacesPage from "./pages/admin/AdminSpacesPage";
import AdminEquipmentPage from "./pages/admin/AdminEquipmentPage";
import AdminDepartmentsPage from "./pages/admin/AdminDepartmentsPage";
import AdminTransportPage from "./pages/admin/AdminTransportPage";
import AdminMess from "./pages/admin/AdminMess";
import AdminMediaPage from "./pages/admin/AdminMediaPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import BlocksManagement from "./pages/admin/BlocksManagement";
import SpaceApproversManagement from "./pages/admin/SpaceApproversManagement";
import AdminFacultiesPage from "./pages/admin/AdminFacultiesPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* PUBLIC LOGIN ROUTE */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>

          {/* PUBLIC VIEW ROUTES */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/transport" element={<Transport />} />
          <Route path="/media" element={<Media />} />
          <Route path="/mess" element={<Mess />} />
          <Route path="/media/schedule" element={<MediaSchedule />} />

          {/* PROTECTED USER ROUTES */}
          <Route element={<ProtectedRoute />}>
            <Route path="/media/my-bookings" element={<MyMediaBookingsPage />} />
            <Route path="/my-bookings" element={<MyBookingsPage />} />
            <Route path="/bookings/:referenceCode" element={<MyBookingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/faculty-approvals" element={<FacultyApprovalPage />} />
          </Route>

          {/* ADMIN ROUTES */}
          <Route
            element={
              <ProtectedRoute requiredCapability="can_access_admin_portal" />
            }
          >
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/faculties" element={<AdminFacultiesPage />} />

              <Route
                element={
                  <ProtectedRoute requiredCapability="can_manage_equipment" />
                }
              >
                <Route
                  path="/admin/equipment"
                  element={<AdminEquipmentPage />}
                />
              </Route>

              <Route
                element={<ProtectedRoute requiredCapability="can_manage_mess" />}
              >
                <Route path="/admin/mess" element={<AdminMess />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute requiredCapability="can_manage_media" />
                }
              >
                <Route path="/admin/media" element={<AdminMediaPage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute requiredCapability="can_manage_system" />
                }
              >
                <Route path="/admin/spaces" element={<AdminSpacesPage />} />
                <Route path="/admin/blocks" element={<BlocksManagement />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route
                  path="/admin/approvers"
                  element={<SpaceApproversManagement />}
                />
                <Route
                  path="/admin/departments"
                  element={<AdminDepartmentsPage />}
                />
                <Route
                  path="/admin/departments/:id/faculties"
                  element={<AdminFacultiesPage />}
                />
                <Route
                  path="/admin/transport"
                  element={<AdminTransportPage />}
                />
                <Route
                  path="/admin/role-overrides"
                  element={<RoleOverridesPage />}
                />
              </Route>
            </Route>
          </Route>

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>

        <LinkedBookingWizard />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;