// src/App.jsx — Root component: routing setup
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage         from './pages/LoginPage';
import CalibrationPage   from './pages/CalibrationPage';
import RiskPage          from './pages/RiskPage';
import SettingsPage      from './pages/SettingsPage';
import TolerancesPage    from './pages/TolerancesPage';
import UsersPage         from './pages/UsersPage';
import CertificatePrint  from './pages/CertificatePrint';
import RiskReportPrint   from './pages/RiskReportPrint';
import Layout            from './components/Layout';
import { isAdminUser }   from './api/auth';
import './App.css';

function ProtectedRoute({ children }) {
  const isAuthenticated = Boolean(localStorage.getItem('auth_user'));
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  // Admin-ness is now decided the same way on both ends: does the user's
  // `role` contain "admin" (case-insensitive)? This used to also special-case
  // two specific hardcoded names/full-names, which meant the frontend's idea
  // of "admin" could disagree with the backend's real, now-enforced role
  // check (see app/routers/auth.py's require_admin) — a user could see the
  // Settings link but have every request to it rejected with 403, or vice
  // versa. See src/api/auth.js for the single shared implementation.
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  return isAdminUser(user) ? children : <Navigate to="/app/calibration" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="calibration" replace />} />
          <Route path="calibration"     element={<CalibrationPage />} />
          <Route path="risk"            element={<RiskPage />} />
          <Route
            path="settings"
            element={
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            }
          />
          <Route
            path="tolerances"
            element={
              <AdminRoute>
                <TolerancesPage />
              </AdminRoute>
            }
          />
          <Route
            path="users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route 
          path="/print/certificate/:serialNumber/:recordId" 
          element={
            <ProtectedRoute>
              <CertificatePrint />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/print/risk/:serialNumber" 
          element={
            <ProtectedRoute>
              <RiskReportPrint />
            </ProtectedRoute>
          } 
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}