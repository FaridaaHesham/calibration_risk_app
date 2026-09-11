import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import './NotificationCenter.css';

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const ClockWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#f59e0b' }}>
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState({
    total_alerts: 0,
    overdue_count: 0,
    due_soon_count: 0,
    high_risk_assessment_count: 0,
    high_risk_calibration_count: 0,
    alerts: [],
  });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchAlerts = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiClient.get('/api/devices/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setFetchError('Unable to sync calibration alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 120000); // refresh every 2 mins
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleDeviceClick = (serial) => {
    setOpen(false);
    navigate(`/app/calibration?search=${encodeURIComponent(serial)}`);
  };

  // Show only due-soon devices (status === 'DUE_SOON', days_remaining >= 0)
  const dueSoonAlerts = useMemo(() => {
    return (alerts.alerts || []).filter(
      (alert) => alert.days_remaining >= 0 && alert.status === 'DUE_SOON'
    );
  }, [alerts]);

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button
        className={`bell-button ${open ? 'active' : ''} ${dueSoonAlerts.length > 0 ? 'has-overdue' : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchAlerts();
        }}
        aria-label={`Notifications${dueSoonAlerts.length > 0 ? ` (${dueSoonAlerts.length})` : ''}`}
        title="Calibration Due Soon Alerts"
      >
        <BellIcon />
        {dueSoonAlerts.length > 0 && (
          <span className="bell-badge">
            {dueSoonAlerts.length > 99 ? '99+' : dueSoonAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <div className="header-title-row">
              <h3>Calibration Due Soon</h3>
              <div className="header-actions">
                {loading && <span className="spinner-small" title="Syncing..."></span>}
                <button className="btn-refresh-mini" onClick={fetchAlerts} title="Refresh Alerts">
                  ↻
                </button>
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Devices due for calibration within the configured window
            </p>
          </div>

          <div className="dropdown-body">
            {fetchError ? (
              <div className="alerts-error-box">
                <p>{fetchError}</p>
                <button onClick={fetchAlerts}>Retry</button>
              </div>
            ) : dueSoonAlerts.length === 0 ? (
              <div className="no-alerts">
                <p>✓ No devices due for calibration soon</p>
              </div>
            ) : (
              dueSoonAlerts.map((alert, idx) => (
                <div
                  key={`${alert.serial_number}-${idx}`}
                  className="alert-item is-due-soon"
                  onClick={() => handleDeviceClick(alert.serial_number)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="alert-icon">
                    <ClockWarning />
                  </div>
                  <div className="alert-content">
                    <div className="alert-title">
                      {alert.device_type} <span className="alert-serial">({alert.serial_number})</span>
                    </div>

                    <div className="alert-badges-row">
                      <span className="mini-badge badge-yellow">Due in {alert.days_remaining}d</span>
                    </div>

                    <div className="alert-meta">
                      {alert.department || 'No Dept'} · <strong>Next Due: {alert.predicted_date || 'N/A'}</strong>
                    </div>

                    <div className="alert-quick-links">
                      <span className="quick-link cal-link" title="Open Calibration Page">
                        Calibration Record →
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dropdown-footer">
            <button onClick={() => { setOpen(false); navigate('/app/calibration'); }}>
              Open Calibration Page →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
