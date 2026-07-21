// src/components/Layout.jsx
// Shared layout for all authenticated pages.
// Renders the persistent Sidebar + top header + main content area.

import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Layout.css';

const PAGE_TITLES = {
  '/app/calibration': 'Device Calibration',
  '/app/risk':        'Risk Classification',
};

export default function Layout() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  // TODO: Replace with real user data from auth context/JWT when available
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('auth_user')) || { name: 'User', role: '' };
    } catch {
      return { name: 'User', role: '' };
    }
  })();

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-main">
        {/* Top header */}
        <header className="app-header">
          <div className="app-header-title">
            <h1 className="app-header-page">{pageTitle}</h1>
          </div>
          <div className="app-header-user">
            <div className="user-avatar" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              {user.role && <span className="user-role">{user.role}</span>}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
