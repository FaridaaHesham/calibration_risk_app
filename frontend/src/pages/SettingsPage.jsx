import { useState, useEffect } from 'react';
import { getPredictionSettings, savePredictionSettings } from '../api/devices';
import './SettingsPage.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    edge_warning_threshold: 75.0,
    min_trend_increase: 10.0,
    calibration_month: 10,
    due_soon_months: 2,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    getPredictionSettings()
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load prediction settings.');
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await savePredictionSettings({
        edge_warning_threshold: parseFloat(settings.edge_warning_threshold),
        min_trend_increase: parseFloat(settings.min_trend_increase),
        calibration_month: parseInt(settings.calibration_month),
        due_soon_months: parseInt(settings.due_soon_months),
      });
      setSuccess('Settings updated successfully.');
    } catch (err) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-page card" style={{ padding: '24px', textAlign: 'center' }}>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>System Settings</h2>
        <p className="settings-subheader" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Configure parameters for the calibration interval prediction engine</p>
      </div>

      <div className="card settings-card" style={{ padding: '24px' }}>
        <form onSubmit={handleSubmit}>
          {error && <div className="settings-error alert alert-danger" style={{ color: 'var(--danger)', marginBottom: '16px' }}>{error}</div>}
          {success && <div className="settings-success alert alert-success" style={{ color: 'var(--success)', marginBottom: '16px' }}>{success}</div>}

          {/* Warning threshold */}
          <div className="settings-field" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="edge-warning-threshold" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Closeness-to-Edge Warning Threshold (%)
            </label>
            <p className="field-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
              If a device score reaches this threshold, the system recommends a 1-year calibration interval.
            </p>
            <div className="slider-input-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                id="edge-warning-threshold"
                type="range"
                min="1"
                max="100"
                step="1"
                style={{ flex: 1 }}
                value={settings.edge_warning_threshold}
                onChange={(e) => setSettings({ ...settings, edge_warning_threshold: e.target.value })}
              />
              <span className="slider-value" style={{ fontWeight: 600, width: '40px', textAlign: 'right' }}>{settings.edge_warning_threshold}%</span>
            </div>
          </div>

          {/* Min trend increase */}
          <div className="settings-field" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="min-trend-increase" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Minimum Trend Increase per Year (%)
            </label>
            <p className="field-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
              The minimum yearly rise in the closeness-to-edge score required to trigger an "upward trend" warning.
            </p>
            <div className="slider-input-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                id="min-trend-increase"
                type="range"
                min="1"
                max="50"
                step="0.5"
                style={{ flex: 1 }}
                value={settings.min_trend_increase}
                onChange={(e) => setSettings({ ...settings, min_trend_increase: e.target.value })}
              />
              <span className="slider-value" style={{ fontWeight: 600, width: '40px', textAlign: 'right' }}>{settings.min_trend_increase}%</span>
            </div>
          </div>

          {/* Calibration Month */}
          <div className="settings-field" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="calibration-month" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Annual Calibration Month
            </label>
            <p className="field-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
              The month in which calibrations are normally conducted each year.
            </p>
            <select
              id="calibration-month"
              className="form-select"
              value={settings.calibration_month}
              onChange={(e) => setSettings({ ...settings, calibration_month: e.target.value })}
            >
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          {/* Due Soon Months */}
          <div className="settings-field" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="due-soon-months" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Due Soon Notification Window (months)
            </label>
            <p className="field-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
              Devices with calibration due within this many months will appear in the notification bell.
            </p>
            <div className="slider-input-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <input
                id="due-soon-months"
                type="range"
                min="1"
                max="12"
                step="1"
                style={{ flex: 1 }}
                value={settings.due_soon_months}
                onChange={(e) => setSettings({ ...settings, due_soon_months: e.target.value })}
              />
              <span className="slider-value" style={{ fontWeight: 600, width: '60px', textAlign: 'right' }}>
                {settings.due_soon_months} {parseInt(settings.due_soon_months) === 1 ? 'month' : 'months'}
              </span>
            </div>
          </div>

          <div className="settings-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
