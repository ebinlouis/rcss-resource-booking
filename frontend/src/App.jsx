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

// Admin Pages
import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from './pages/admin/AdminDashboard';
import RoleOverridesPage from "./pages/admin/RoleOverridesPage";
import AdminSpacesPage from "./pages/admin/AdminSpacesPage";
import AdminEquipmentPage from "./pages/admin/AdminEquipmentPage"; 
import AdminDepartmentsPage from "./pages/admin/AdminDepartmentsPage";
import AdminMess from "./pages/admin/AdminMess"; 

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
          </Route>

          {/* ========================================== */}
          {/* TIER 1: DYNAMIC APPROVER ROUTES */}
          {/* ========================================== */}
          <Route element={<ProtectedRoute requiredCapability="can_access_admin_portal" />}>
            <Route element={<AdminLayout />}>
              
              {/* Global Dashboard */}
              <Route path="/admin" element={<AdminDashboard />} />

              {/* ========================================== */}
              {/* MESS ADMIN ROUTE */}
              {/* ========================================== */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_mess" />}>
                <Route path="/admin/mess" element={<AdminMess />} />
              </Route>

              {/* ========================================== */}
              {/* TIER 2: SYSTEM ADMIN ROUTES */}
              {/* ========================================== */}
              <Route element={<ProtectedRoute requiredCapability="can_manage_system" />}>
                <Route path="/admin/spaces" element={<AdminSpacesPage />} />
                <Route path="/admin/equipment" element={<AdminEquipmentPage />} /> 
                <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
                <Route path="/admin/role-overrides" element={<RoleOverridesPage />} />
              </Route>

            </Route>
          </Route>

          {/* Catch-all throws you to login if the URL doesn't exist */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;