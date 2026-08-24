// src/pages/RiskPage.jsx
//
// ============================================================
// TODO: This page is a PLACEHOLDER.
//       The real risk classification requirements and scoring
//       logic are still to be determined. The UI layout mirrors
//       the Calibration page for visual consistency, but all
//       data shown is mocked. Replace with real logic when ready.
//       See also: backend/app/routers/risk.py
// ============================================================

import { useState, useEffect } from 'react';
import { getDevice, getRiskData, getDepartments } from '../api/devices';
import DeviceInfoCard from '../components/DeviceInfoCard';
import RiskScorecard from '../components/RiskScorecard';
import './RiskPage.css';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export default function RiskPage() {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [loading, setLoading]         = useState(false);
  const [notFound, setNotFound]       = useState(false);
  const [device, setDevice]           = useState(null);
  const [riskData, setRiskData]       = useState(null);

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!serialInput.trim()) return;

    setLoading(true);
    setNotFound(false);
    setDevice(null);
    setRiskData(null);

    try {
      const [dev, risk] = await Promise.all([
        getDevice(serialInput.trim()),
        getRiskData(serialInput.trim()),
      ]);

      if (!dev) {
        setNotFound(true);
      } else {
        setDevice(dev);
        setRiskData(risk);
      }
    } catch (err) {
      console.error('Risk search error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const hasResults = Boolean(device);

  return (
    <div className="risk-page">
      {/* Placeholder banner */}
      <div className="risk-placeholder-banner">
        <InfoIcon />
        <div>
          <strong>Placeholder page</strong> — Risk classification requirements are still being defined.
          This page demonstrates the layout and mock output only. Real scoring logic will be added later.
        </div>
      </div>

      {/* Step 1 — Search */}
      <section aria-label="Device search">
        <div className="risk-section-header">
          <StepBadge n={1} />
          <div>
            <h2 className="risk-section-title">Select Device</h2>
            <p className="risk-section-desc">Choose a department and enter the device serial number to view its risk classification.</p>
          </div>
        </div>

        <form id="risk-search-form" onSubmit={handleSearch} className="risk-search-form card">
          <div className="risk-search-fields">
            <div className="risk-field">
              <label htmlFor="risk-select-department" className="form-label">Department</label>
              <select
                id="risk-select-department"
                className="form-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="risk-field risk-field--grow">
              <label htmlFor="risk-input-serial" className="form-label">Serial Number</label>
              <input
                id="risk-input-serial"
                type="text"
                className="form-input"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="Enter the device serial number"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="risk-field risk-field--btn">
              <label className="form-label" aria-hidden="true">&nbsp;</label>
              <button
                id="btn-risk-search"
                type="submit"
                className="btn btn-primary"
                disabled={loading || !serialInput.trim()}
              >
                {loading
                  ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />Searching…</>
                  : <><SearchIcon />Search</>}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Not found */}
      {notFound && !loading && (
        <div className="card risk-not-found empty-state">
          <NotFoundIcon />
          <h3>No device found</h3>
          <p>No device was found with serial number &ldquo;<strong>{serialInput}</strong>&rdquo;. Check the serial number and try again.</p>
        </div>
      )}

      {/* Results */}
      {hasResults && !loading && (
        <>
          {/* Step 2 — Device info */}
          <section aria-label="Device information">
            <div className="risk-section-header">
              <StepBadge n={2} />
              <h2 className="risk-section-title">Device Information</h2>
            </div>
            <DeviceInfoCard device={device} loading={false} />
          </section>

          {/* Step 3 — Risk scorecard */}
          <section aria-label="Risk scorecard">
            <div className="risk-section-header">
              <StepBadge n={3} />
              <div>
                <h2 className="risk-section-title">Risk Classification Scorecard</h2>
                <p className="risk-section-desc">
                  Mock risk scores across five assessment factors.
                  {/* TODO: Replace with real risk scoring model output */}
                </p>
              </div>
            </div>
            <RiskScorecard data={riskData} loading={loading} />
          </section>
        </>
      )}
    </div>
  );
}

function StepBadge({ n }) {
  return <div className="step-badge" style={{ background: 'var(--primary)' }} aria-hidden="true">{n}</div>;
}

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--info)' }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const NotFoundIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);