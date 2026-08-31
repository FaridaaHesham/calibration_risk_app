// src/components/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';
import logoImg from '../assets/logo.png';

// ── SVG icons ────────────────────────────────────────────────
const CalibrationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const AddCalibrationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

const RiskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/**
 * Persistent left sidebar navigation.
 */
export default function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
  const isAdmin = user.role === 'Admin' || user.name === 'Adam International Hospital Admin' || user.name === 'adam_admin';

  function handleLogout() {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    onLogout?.();
    navigate('/', { replace: true });
  }

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src={logoImg} alt="Adam International Hospital" className="sidebar-logo-img" />
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">Adam International</span>
          <span className="sidebar-logo-sub">Hospital</span>
        </div>
      </div>

      <div className="sidebar-divider" />

      <p className="sidebar-section-label">NAVIGATION</p>

      <nav className="sidebar-nav">
        <NavLink
          to="/app/calibration"
          id="nav-calibration"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <CalibrationIcon />
          <span>Calibration</span>
        </NavLink>

        <NavLink
          to="/app/risk"
          id="nav-risk"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          <RiskIcon />
          <span>Risk Classification</span>
        </NavLink>

        {isAdmin && (
          <NavLink
            to="/app/settings"
            id="nav-settings"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <SettingsIcon />
            <span>Settings</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-divider" />

      <button
        id="btn-logout"
        className="sidebar-logout"
        onClick={handleLogout}
        type="button"
      >
        <LogoutIcon />
        <span>Log Out</span>
      </button>
    </aside>
  );
}


