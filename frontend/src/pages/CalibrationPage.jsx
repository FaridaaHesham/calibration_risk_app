// src/pages/CalibrationPage.jsx
import { useState } from 'react';
import { DEPARTMENTS } from '../data/mockData';
import { getDevice, getCalibrationHistory, getChartData } from '../api/devices';
import DeviceInfoCard from '../components/DeviceInfoCard';
import ControlChart from '../components/ControlChart';
import RecommendationCard from '../components/RecommendationCard';
import CalibrationHistoryTable from '../components/CalibrationHistoryTable';
import './CalibrationPage.css';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

export default function CalibrationPage() {
  const [department, setDepartment] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [loading, setLoading]        = useState(false);
  const [notFound, setNotFound]      = useState(false);
  const [device, setDevice]          = useState(null);
  const [chartData, setChartData]    = useState(null);
  const [history, setHistory]        = useState([]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!serialInput.trim()) return;

    setLoading(true);
    setNotFound(false);
    setDevice(null);
    setChartData(null);
    setHistory([]);

    try {
      // Parallel fetches — all three calls run simultaneously
      const [dev, chart, hist] = await Promise.all([
        getDevice(serialInput.trim()),
        getChartData(serialInput.trim()),
        getCalibrationHistory(serialInput.trim()),
      ]);

      if (!dev) {
        setNotFound(true);
      } else {
        setDevice(dev);
        setChartData(chart);
        setHistory(hist);
      }
    } catch (err) {
      console.error('Search error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const hasResults = Boolean(device);

  return (
    <div className="cal-page">
      {/* ─────────────────────────────────────────────────────────────
          Step 1 — Search controls
      ───────────────────────────────────────────────────────────── */}
      <section className="cal-section" aria-label="Device search">
        <div className="cal-section-header">
          <StepBadge n={1} />
          <div>
            <h2 className="cal-section-title">Select Device</h2>
            <p className="cal-section-desc">Choose a department and enter the device serial number to load its calibration data.</p>
          </div>
        </div>

        <form id="device-search-form" onSubmit={handleSearch} className="cal-search-form card">
          <div className="cal-search-fields">
            {/* Department */}
            <div className="cal-field">
              <label htmlFor="select-department" className="form-label">Department</label>
              <select
                id="select-department"
                className="form-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Serial number */}
            <div className="cal-field cal-field--grow">
              <label htmlFor="input-serial" className="form-label">Serial Number</label>
              <input
                id="input-serial"
                type="text"
                className="form-input"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="e.g. SN-AND-001, SN-IVF-012, SN-BLD-007…"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Search button */}
            <div className="cal-field cal-field--btn">
              <label className="form-label" aria-hidden="true">&nbsp;</label>
              <button
                id="btn-search-device"
                type="submit"
                className="btn btn-primary"
                disabled={loading || !serialInput.trim()}
              >
                {loading ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />Searching…</> : <><SearchIcon />Search</>}
              </button>
            </div>
          </div>

          {/* Demo tip */}
          <p className="cal-tip">
            Try: <code onClick={() => setSerialInput('SN-AND-001')}>SN-AND-001</code>
            <code onClick={() => setSerialInput('SN-IVF-012')}>SN-IVF-012</code>
            <code onClick={() => setSerialInput('SN-BLD-007')}>SN-BLD-007</code>
            <code onClick={() => setSerialInput('SN-PATH-003')}>SN-PATH-003</code>
            <code onClick={() => setSerialInput('SN-OR-015')}>SN-OR-015</code>
          </p>
        </form>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          Loading state
      ───────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="card cal-loading">
          <DeviceInfoCard loading={true} device={null} />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Not found
      ───────────────────────────────────────────────────────────── */}
      {notFound && !loading && (
        <div className="card cal-not-found empty-state">
          <NotFoundIcon />
          <h3>No device found</h3>
          <p>No device was found with serial number &ldquo;<strong>{serialInput}</strong>&rdquo;. Check the serial number and try again.</p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Results
      ───────────────────────────────────────────────────────────── */}
      {hasResults && !loading && (
        <>
          {/* Step 2 — Device info */}
          <section className="cal-section" aria-label="Device information">
            <div className="cal-section-header">
              <StepBadge n={2} />
              <div>
                <h2 className="cal-section-title">Device Information</h2>
              </div>
            </div>
            <DeviceInfoCard device={device} loading={false} />
          </section>

          {/* Step 3 — Control chart + recommendation */}
          <section className="cal-section" aria-label="Control chart">
            <div className="cal-section-header">
              <StepBadge n={3} />
              <div>
                <h2 className="cal-section-title">Control Chart</h2>
                <p className="cal-section-desc">Statistical process control chart with UCL, CL, and LCL reference lines.</p>
              </div>
            </div>

            <div className="cal-chart-row">
              {/* Chart */}
              <div className="cal-chart-card card">
                <div className="cal-chart-card-header">
                  <ChartIcon />
                  <span>Calibration Measurements Over Time</span>
                </div>
                {chartData?.points ? (
                  <ControlChart data={chartData.points} />
                ) : (
                  <div className="empty-state"><p>No chart data available.</p></div>
                )}
              </div>

              {/* Recommendation */}
              {chartData?.recommendation && (
                <div className="cal-rec-col">
                  <RecommendationCard recommendation={chartData.recommendation} />
                </div>
              )}
            </div>
          </section>

          {/* Step 4 — Calibration history */}
          <section className="cal-section" aria-label="Calibration history">
            <div className="cal-section-header">
              <StepBadge n={4} />
              <div>
                <h2 className="cal-section-title">Calibration History</h2>
                <p className="cal-section-desc">Full record of past calibration tests, most recent first.</p>
              </div>
            </div>
            <div className="card">
              <CalibrationHistoryTable records={history} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StepBadge({ n }) {
  return <div className="step-badge" aria-hidden="true">{n}</div>;
}

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--primary-light)' }}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const NotFoundIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);
