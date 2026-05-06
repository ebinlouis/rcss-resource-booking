import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Home from "./pages/Home";
import Transport from "./pages/Transport";
import Mess from "./pages/Mess";
import Media from "./pages/Media";

// Admin Pages
import AdminLayout from "./layouts/admin/AdminLayout";
import AdminDashboard from './pages/admin/AdminDashboard';
import RoleOverridesPage from "./pages/admin/RoleOverridesPage";
import AdminSpacesPage from "./pages/admin/AdminSpacesPage";
import AdminEquipmentPage from "./pages/admin/AdminEquipmentPage"; // <-- ADD THIS

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
          </Route>

          {/* STRICTLY Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['IT_ADMIN']} />}>
            
            {/* The Admin Layout Wrapper */}
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/spaces" element={<AdminSpacesPage />} />
              <Route path="/admin/equipment" element={<AdminEquipmentPage />} /> {/* <-- ADD THIS */}
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