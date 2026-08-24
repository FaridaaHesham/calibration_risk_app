// src/components/DeviceInfoCard.jsx
import { useState, useEffect } from 'react';
import { updateDevice } from '../api/devices';
import './DeviceInfoCard.css';

/** Row inside the info card */
function InfoRow({ label, value }) {
  return (
    <div className="device-info-row">
      <span className="device-info-label">{label}</span>
      <span className="device-info-value">{value}</span>
    </div>
  );
}

/**
 * Displays static device information.
 * @param {{ device: object|null, loading: boolean, onDeviceUpdated: function }} props
 */
export default function DeviceInfoCard({ device, loading, onDeviceUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [dept, setDept] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Sync state when device prop changes
  useEffect(() => {
    if (device) {
      setDept(device.department || '');
      setDeviceType(device.deviceType || '');
      setModel(device.model || '');
      setManufacturer(device.manufacturer || '');
      setResolution(device.resolution !== undefined && device.resolution !== null ? device.resolution.toString() : '');
      setIsEditing(false);
      setError('');
    }
  }, [device]);

  if (loading) {
    return (
      <div className="device-card card">
        <div className="device-card-header">
          <DeviceIcon />
          <h2>Device Information</h2>
        </div>
        <div className="device-card-skeleton">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton skeleton-label" />
              <div className="skeleton skeleton-value" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!device) return null;

  async function handleSave(e) {
    e.preventDefault();
    if (!deviceType.trim()) {
      setError('Device Type is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateDevice(device.serialNumber, {
        department_name: dept.trim() || null,
        device_type: deviceType.trim(),
        model: model.trim() || null,
        manufacturer: manufacturer.trim() || null,
        resolution: resolution.trim() ? parseFloat(resolution.trim()) : null,
      });
      setIsEditing(false);
      if (onDeviceUpdated) {
        onDeviceUpdated(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to update device.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="device-card card">
      <div className="device-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DeviceIcon />
          <div>
            <h2>Device Information</h2>
            <p className="device-card-subtitle">Static record from the equipment registry</p>
          </div>
        </div>
        {!isEditing && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            onClick={() => setIsEditing(true)}
          >
            Edit Info
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="device-card-body edit-form">
          {error && <div className="error-message" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: 10 }}>{error}</div>}
          
          <div className="edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 15px', marginBottom: 15 }}>
            <div className="tf" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Serial Number</label>
              <input type="text" className="form-input" value={device.serialNumber} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
            </div>

            <div className="tf" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Department</label>
              <input type="text" className="form-input" value={dept} onChange={(e) => setDept(e.target.value)} />
            </div>

            <div className="tf" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Device Type <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" className="form-input" value={deviceType} onChange={(e) => setDeviceType(e.target.value)} required />
            </div>

            <div className="tf" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Model</label>
              <input type="text" className="form-input" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>

            <div className="tf" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Manufacturer</label>
              <input type="text" className="form-input" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>

            <div className="tf" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Resolution</label>
              <input type="number" step="any" className="form-input" value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => { setIsEditing(false); setError(''); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="device-card-body">
          <InfoRow label="Serial Number"  value={device.serialNumber} />
          <InfoRow label="Department"     value={device.department || '—'} />
          <InfoRow label="Device Type"    value={device.deviceType} />
          <InfoRow label="Model"          value={device.model || '—'} />
          <InfoRow label="Manufacturer"   value={device.manufacturer || '—'} />
          <InfoRow label="Resolution"     value={device.resolution !== undefined && device.resolution !== null ? device.resolution : '—'} />
        </div>
      )}
    </div>
  );
}

const DeviceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--primary-light)', flexShrink: 0 }}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);