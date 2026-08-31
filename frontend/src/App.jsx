// src/App.jsx — Root component: routing setup
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage         from './pages/LoginPage';
import CalibrationPage   from './pages/CalibrationPage';
import RiskPage          from './pages/RiskPage';
import SettingsPage      from './pages/SettingsPage';
import CertificatePrint  from './pages/CertificatePrint';
import RiskReportPrint   from './pages/RiskReportPrint';
import Layout            from './components/Layout';
import './App.css';

function ProtectedRoute({ children }) {
  const isAuthenticated = Boolean(localStorage.getItem('auth_user'));
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const isAdmin = user.role === 'Admin' || user.name === 'Adam International Hospital Admin' || user.name === 'adam_admin';
  return isAdmin ? children : <Navigate to="/app/calibration" replace />;
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
