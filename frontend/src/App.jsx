import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';

// Your Pages
import Login from './pages/Login';
import Home from './pages/Home';

function App() {
  return (
    // 1. Wrap the entire app in the AuthProvider so the session state is globally available
    <AuthProvider>
      <BrowserRouter> 
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* 2. Protected Routes Wrapper */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Home />} />
            
            {/* Future modules can go here: */}
            {/* <Route path="/spaces" element={<SpacesModule />} /> */}
          </Route>

          {/* Catch-all: Redirect unknown routes back to the root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;