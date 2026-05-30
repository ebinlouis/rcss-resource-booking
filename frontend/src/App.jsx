import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Outlet, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import { Toaster } from 'react-hot-toast'
import AppLoader from "./components/common/AppLoader";
import LinkedBookingWizard from "./components/LinkedBookingWizard";
import { ensureProtectedQuery, prefetchProtectedQuery } from './lib/loaderUtils';

// Import APIs for loaders
import spaceApi from './api/spaceApi';
import { getVehicles } from './api/fleetApi';
import mediaApi from './api/mediaApi';
import messService from './api/messService';
import notificationService from './api/notificationService';
import approvalService from './api/approvalService';
import api from './api/axios';
import spaceAdminService from './api/spaceAdminService';

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

const AppRoot = () => (
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
      <Outlet />
    </Suspense>
    <LinkedBookingWizard />
  </AuthProvider>
);

const router = createBrowserRouter([
  {
    element: <AppRoot />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          { path: "/login", element: <Login /> }
        ]
      },
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      {
        path: "/dashboard",
        element: <Home />,
        loader: () => {
          prefetchProtectedQuery({ queryKey: ['spaces', 'catalog'], queryFn: () => spaceApi.getSpaces() });
          prefetchProtectedQuery({ queryKey: ['spaces', 'bookings', 'mine'], queryFn: () => spaceApi.getMyBookings() });
          return null;
        }
      },
      {
        path: "/transport",
        element: <Transport />,
        loader: () => ensureProtectedQuery({
          queryKey: ['fleet', 'vehicles'], queryFn: () => getVehicles()
        })
      },
      {
        path: "/media",
        element: <Media />,
        loader: () => prefetchProtectedQuery({
          queryKey: ['media', 'bookings', 'mine'], queryFn: () => mediaApi.getMyBookings()
        })
      },
      {
        path: "/mess",
        element: <Mess />,
        loader: () => prefetchProtectedQuery({
          queryKey: ['mess', 'bookings', 'mine'], queryFn: () => messService.getMyBookings()
        })
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/media/my-bookings",
            element: <MyMediaBookingsPage />,
            loader: () => prefetchProtectedQuery({
              queryKey: ['media', 'bookings', 'mine'], queryFn: () => mediaApi.getMyBookings()
            })
          },
          {
            path: "/my-bookings",
            element: <MyBookingsPage />,
            loader: () => prefetchProtectedQuery({
              queryKey: ['spaces', 'bookings', 'mine'], queryFn: () => spaceApi.getMyBookings()
            })
          },
          {
            path: "/bookings/:referenceCode",
            element: <MyBookingsPage />,
            loader: () => prefetchProtectedQuery({
              queryKey: ['spaces', 'bookings', 'mine'], queryFn: () => spaceApi.getMyBookings()
            })
          },
          {
            path: "/notifications",
            element: <NotificationsPage />,
            loader: () => prefetchProtectedQuery({
              queryKey: ['notifications', 'all', {}], queryFn: () => notificationService.getNotifications({})
            })
          },
          { path: "/profile", element: <Profile /> },
          {
            path: "/faculty-approvals",
            element: <FacultyApprovalPage />,
            loader: () => prefetchProtectedQuery({
              queryKey: ['approvals', 'faculty', 'pending'], queryFn: () => approvalService.fetchFacultyPending()
            })
          }
        ]
      },
      {
        element: <ProtectedRoute requiredCapability="can_access_admin_portal" />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                path: "/admin",
                element: <AdminDashboard />,
                loader: () => {
                  prefetchProtectedQuery({ queryKey: ['approvals', 'spaces', 'PENDING'], queryFn: () => approvalService.getApprovals({ domain: 'spaces', status: 'PENDING' }) });
                  prefetchProtectedQuery({ queryKey: ['approvals', 'spaces', 'APPROVED'], queryFn: () => approvalService.getApprovals({ domain: 'spaces', status: 'APPROVED' }) });
                  prefetchProtectedQuery({ queryKey: ['approvals', 'spaces', 'REJECTED'], queryFn: () => approvalService.getApprovals({ domain: 'spaces', status: 'REJECTED' }) });
                  prefetchProtectedQuery({ queryKey: ['approvals', 'spaces', 'CANCELLED'], queryFn: () => approvalService.getApprovals({ domain: 'spaces', status: 'CANCELLED' }) });
                  return null;
                }
              },
              { path: "/admin/faculties", element: <AdminFacultiesPage /> },
              {
                element: <ProtectedRoute requiredCapability="can_manage_equipment" />,
                children: [
                  { path: "/admin/equipment", element: <AdminEquipmentPage /> }
                ]
              },
              {
                element: <ProtectedRoute requiredCapability="can_manage_mess" />,
                children: [
                  { path: "/admin/mess", element: <AdminMess /> }
                ]
              },
              {
                element: <ProtectedRoute requiredCapability="can_manage_media" />,
                children: [
                  { path: "/admin/media", element: <AdminMediaPage /> },
                  { path: "/media/schedule", element: <MediaSchedule /> }
                ]
              },
              {
                element: <ProtectedRoute requiredCapability="can_manage_system" />,
                children: [
                  { path: "/admin/blocks", element: <BlocksManagement /> },
                  { path: "/admin/users", element: <AdminUsersPage /> },
                  { path: "/admin/approvers", element: <SpaceApproversManagement /> },
                  { path: "/admin/departments", element: <AdminDepartmentsPage /> },
                  { path: "/admin/departments/:id/faculties", element: <AdminFacultiesPage /> },
                  { path: "/admin/transport", element: <AdminTransportPage /> },
                  { path: "/admin/role-overrides", element: <RoleOverridesPage /> }
                ]
              },
              {
                element: <ProtectedRoute requiredCapabilities={["can_manage_system", "can_manage_spaces"]} />,
                children: [
                  { 
                    path: "/admin/spaces", 
                    element: <AdminSpacesPage />,
                    loader: () => {
                      prefetchProtectedQuery({ queryKey: ['spaces', 'catalog', 'manage'], queryFn: () => api.get('/spaces/catalog/?manage=true').then(res => res.data) });
                      prefetchProtectedQuery({ queryKey: ['spaces', 'blocks'], queryFn: () => spaceAdminService.getBlocks() });
                      return null;
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      { path: "*", element: <Navigate to="/dashboard" replace /> }
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;