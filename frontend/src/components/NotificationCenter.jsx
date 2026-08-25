import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import './NotificationCenter.css';

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
  </svg>
);

const ShieldAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#dc2626' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const AlertTriangle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#ef4444' }}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
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
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'HIGH_RISK' | 'OVERDUE' | 'DUE_SOON'
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

  const handleRiskClick = (e, serial) => {
    e.stopPropagation();
    setOpen(false);
    navigate(`/app/risk?search=${encodeURIComponent(serial)}`);
  };

  const totalHighRisk = (alerts.high_risk_assessment_count || 0) + (alerts.high_risk_calibration_count || 0);

  const filteredAlerts = alerts.alerts.filter((alert) => {
    if (activeTab === 'HIGH_RISK') {
      return alert.risk_class === 'CLASS_3' || alert.calibration_risk_level === 'HIGH';
    }
    if (activeTab === 'OVERDUE') return alert.days_remaining < 0;
    if (activeTab === 'DUE_SOON') return alert.days_remaining >= 0 && alert.days_remaining <= 30;
    return true;
  });

  const hasUrgentAlerts = (alerts.overdue_count > 0) || (alerts.high_risk_assessment_count > 0);

  return (
    <div className="notification-center" ref={dropdownRef}>
      <button
        className={`bell-button ${open ? 'active' : ''} ${hasUrgentAlerts ? 'has-overdue' : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchAlerts();
        }}
        aria-label={`Notifications${alerts.total_alerts > 0 ? ` (${alerts.total_alerts})` : ''}`}
      >
        <BellIcon />
        {alerts.total_alerts > 0 && (
          <span className={`bell-badge ${hasUrgentAlerts ? 'badge-urgent' : ''}`}>
            {alerts.total_alerts > 99 ? '99+' : alerts.total_alerts}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h3>Equipment Risk & Calibration Alerts</h3>
            <div className="header-actions">
              {loading && <span className="spinner-small" title="Syncing..."></span>}
              <button className="btn-refresh-mini" onClick={fetchAlerts} title="Refresh Alerts">
                ↻
              </button>
            </div>
          </div>

          <div className="dropdown-tabs">
            <button
              className={`tab all-tab ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              <span className="tab-label">All</span>
              <span className="tab-count">{alerts.total_alerts}</span>
            </button>
            <button
              className={`tab high-risk-tab ${activeTab === 'HIGH_RISK' ? 'active' : ''}`}
              onClick={() => setActiveTab('HIGH_RISK')}
              title="High Risk Assessment & High Calibration Risk"
            >
              <span className="tab-label">High Risk</span>
              <span className="tab-count">{totalHighRisk}</span>
            </button>
            <button
              className={`tab overdue ${activeTab === 'OVERDUE' ? 'active' : ''}`}
              onClick={() => setActiveTab('OVERDUE')}
            >
              <span className="tab-label">Overdue</span>
              <span className="tab-count">{alerts.overdue_count}</span>
            </button>
            <button
              className={`tab due-soon ${activeTab === 'DUE_SOON' ? 'active' : ''}`}
              onClick={() => setActiveTab('DUE_SOON')}
            >
              <span className="tab-label">Due Soon</span>
              <span className="tab-count">{alerts.due_soon_count}</span>
            </button>
          </div>

          <div className="dropdown-body">
            {fetchError ? (
              <div className="alerts-error-box">
                <p>{fetchError}</p>
                <button onClick={fetchAlerts}>Retry</button>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="no-alerts">
                <p>✓ All equipment risk & calibrations are in normal range</p>
              </div>
            ) : (
              filteredAlerts.map((alert, idx) => {
                const isHighRiskAssess = alert.risk_class === 'CLASS_3';
                const isHighCal = alert.calibration_risk_level === 'HIGH';
                const isOverdue = alert.days_remaining < 0;

                return (
                  <div
                    key={`${alert.serial_number}-${idx}`}
                    className={`alert-item ${isHighRiskAssess ? 'is-high-risk' : isOverdue ? 'is-overdue' : 'is-due-soon'}`}
                    onClick={() => handleDeviceClick(alert.serial_number)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="alert-icon">
                      {isHighRiskAssess ? <ShieldAlert /> : isOverdue ? <AlertTriangle /> : <ClockWarning />}
                    </div>
                    <div className="alert-content">
                      <div className="alert-title">
                        {alert.device_type} <span className="alert-serial">({alert.serial_number})</span>
                      </div>
                      
                      {/* Alert Tag Pills */}
                      <div className="alert-badges-row">
                        {isHighRiskAssess && (
                          <span className="mini-badge badge-red">Class 3 High Risk</span>
                        )}
                        {isHighCal && (
                          <span className="mini-badge badge-orange">High Cal Failure ({alert.calibration_failure_rate}%)</span>
                        )}
                        {isOverdue && (
                          <span className="mini-badge badge-red">{Math.abs(alert.days_remaining)}d Overdue</span>
                        )}
                        {!isOverdue && alert.days_remaining <= 30 && (
                          <span className="mini-badge badge-yellow">Due in {alert.days_remaining}d</span>
                        )}
                      </div>

                      <div className="alert-meta">
                        {alert.department || 'No Dept'} · Next Due: {alert.predicted_date || 'N/A'}
                      </div>

                      <div className="alert-quick-links">
                        <span className="quick-link cal-link" title="Open Calibration Page">
                          Calibration →
                        </span>
                        <button
                          className="quick-link risk-link-btn"
                          onClick={(e) => handleRiskClick(e, alert.serial_number)}
                          title="Open Risk Details"
                        >
                          Risk Assessment ↗
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="dropdown-footer">
            <button onClick={() => { setOpen(false); navigate('/app/risk'); }}>
              Open Risk Assessment Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
