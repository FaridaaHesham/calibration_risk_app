// src/components/DeviceInfoCard.jsx
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
 * @param {{ device: object|null, loading: boolean }} props
 */
export default function DeviceInfoCard({ device, loading }) {
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

  return (
    <div className="device-card card">
      <div className="device-card-header">
        <DeviceIcon />
        <div>
          <h2>Device Information</h2>
          <p className="device-card-subtitle">Static record from the equipment registry</p>
        </div>
      </div>

      <div className="device-card-body">
        <InfoRow label="Serial Number"  value={device.serialNumber} />
        <InfoRow label="Department"     value={device.department} />
        <InfoRow label="Device Type"    value={device.deviceType} />
        <InfoRow label="Model"          value={device.model} />
        <InfoRow label="Manufacturer"   value={device.manufacturer} />
        {/* TODO: Add more fields here as requirements expand */}
      </div>
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
