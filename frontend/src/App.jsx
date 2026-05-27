import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import { Toaster } from 'react-hot-toast'
import AppLoader from "./components/common/AppLoader";

// LinkedBookingWizard stays eager — mounted on every page
import LinkedBookingWizard from "./components/LinkedBookingWizard";

// Pages — lazy loaded
const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const Transport = lazy(() => import("./pages/Transport"));
const Mess = lazy(() => import("./pages/Mess"));
const Media = lazy(() => import("./pages/Media"));
const MediaSchedule = lazy(() => import("./pages/MediaSchedule"));
const MyMediaBookingsPage = lazy(() => import("./pages/MyMediaBookingsPage"));
const MyBookingsPage = lazy(() => import("./pages/MyBookingsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const Profile = lazy(() => import("./pages/Profile"));
const FacultyApprovalPage = lazy(() => import("./pages/FacultyApprovalPage"));

// Admin Pages — lazy loaded
const AdminLayout = lazy(() => import("./layouts/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const RoleOverridesPage = lazy(() => import("./pages/admin/RoleOverridesPage"));
const AdminSpacesPage = lazy(() => import("./pages/admin/AdminSpacesPage"));
const AdminEquipmentPage = lazy(() => import("./pages/admin/AdminEquipmentPage"));
const AdminDepartmentsPage = lazy(() => import("./pages/admin/AdminDepartmentsPage"));
const AdminTransportPage = lazy(() => import("./pages/admin/AdminTransportPage"));
const AdminMess = lazy(() => import("./pages/admin/AdminMess"));
const AdminMediaPage = lazy(() => import("./pages/admin/AdminMediaPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const BlocksManagement = lazy(() => import("./pages/admin/BlocksManagement"));
const SpaceApproversManagement = lazy(() => import("./pages/admin/SpaceApproversManagement"));
const AdminFacultiesPage = lazy(() => import("./pages/admin/AdminFacultiesPage"));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '14px',
              fontWeight: '600',
              padding: '14px 18px',
            },
            success: {
              iconTheme: {
                primary: '#16a34a',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#fff',
              },
            },
          }}
        />
        <Suspense fallback={<AppLoader />}>
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
                  <Route path="/admin/equipment" element={<AdminEquipmentPage />} />
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
                  <Route path="/media/schedule" element={<MediaSchedule />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute requiredCapability="can_manage_system" />
                  }
                >
                  <Route path="/admin/blocks" element={<BlocksManagement />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/approvers" element={<SpaceApproversManagement />} />
                  <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
                  <Route path="/admin/departments/:id/faculties" element={<AdminFacultiesPage />} />
                  <Route path="/admin/transport" element={<AdminTransportPage />} />
                  <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
                </Route>

                <Route
                  element={
                    <ProtectedRoute requiredCapabilities={["can_manage_system", "can_manage_spaces"]} />
                  }
                >
                  <Route path="/admin/spaces" element={<AdminSpacesPage />} />
                </Route>
              </Route>
            </Route>

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />

          </Routes>
        </Suspense>

        <LinkedBookingWizard />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;