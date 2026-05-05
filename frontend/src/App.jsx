import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';

// Your Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Transport from "./pages/Transport";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter> 
        <Routes>

          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>

            <Route path="/dashboard" element={<Home />} />

            {/* ✅ NEW TRANSPORT ROUTE */}
            <Route path="/transport" element={<Transport />} />

          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;