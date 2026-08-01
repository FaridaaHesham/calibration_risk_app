// src/App.jsx — Root component: routing setup
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage         from './pages/LoginPage';
import CalibrationPage   from './pages/CalibrationPage';
import RiskPage          from './pages/RiskPage';
import Layout            from './components/Layout';
import './App.css';

function ProtectedRoute({ children }) {
  const isAuthenticated = Boolean(localStorage.getItem('auth_user'));
  return isAuthenticated ? children : <Navigate to="/" replace />;
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
