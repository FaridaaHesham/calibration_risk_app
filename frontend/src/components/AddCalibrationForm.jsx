import { useState, useCallback } from 'react';
import { DEPARTMENTS } from '../data/mockData';
import { getDevice } from '../api/devices';
import './AddCalibrationForm.css';

// ─── Empty test row template ──────────────────────────────────────────────
const newTestRow = () => ({
  id: Date.now() + Math.random(),
  test_label: '',
  test_point_unit: '',
  reference_value: '',
  actual_value: '',
  MIN_value: '',
  MAX_value: '',
  result: 'auto', // 'auto' | 'Pass' | 'Fail'
});

// ─── Auto-compute pass/fail based on min and max ──────────────
function autoResult(actual, minVal, maxVal) {
  const a = parseFloat(actual);
  const min = parseFloat(minVal);
  const max = parseFloat(maxVal);
  if (isNaN(a) || isNaN(min) || isNaN(max)) return null;
  return (a >= min && a <= max) ? 'Pass' : 'Fail';
}

// ─── Individual test row component ───────────────────────────────────────
function TestRow({ row, index, onChange, onRemove, canRemove }) {
  const computedResult = row.result === 'auto'
    ? autoResult(row.actual_value, row.MIN_value, row.MAX_value)
    : row.result;

  const deviation = (() => {
    const r = parseFloat(row.reference_value);
    const a = parseFloat(row.actual_value);
    if (isNaN(r) || isNaN(a)) return '';
    const d = a - r;
    return (d > 0 ? '+' : '') + d.toFixed(4).replace(/\.?0+$/, '');
  })();

  function field(name) {
    return (e) => onChange(row.id, name, e.target.value);
  }

  return (
    <div className="test-row card">
      <div className="test-row-header">
        <span className="test-row-num">Test {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            className="btn-remove-test"
            onClick={() => onRemove(row.id)}
            aria-label={`Remove test ${index + 1}`}
          >
            <RemoveIcon /> Remove
          </button>
        )}
      </div>

      <div className="test-row-grid">
        {/* Test label */}
        <div className="tf tf--span2">
          <label className="form-label" htmlFor={`test-label-${row.id}`}>
            Test Label <span className="req">*</span>
          </label>
          <input
            id={`test-label-${row.id}`}
            type="text"
            className="form-input"
            value={row.test_label}
            onChange={field('test_label')}
            placeholder="e.g. Temperature Calibration"
            required
          />
        </div>

        {/* Unit */}
        <div className="tf">
          <label className="form-label" htmlFor={`test-unit-${row.id}`}>Test Point Unit</label>
          <input
            id={`test-unit-${row.id}`}
            type="text"
            className="form-input"
            value={row.test_point_unit}
            onChange={field('test_point_unit')}
            placeholder="e.g. °C, %, RPM"
          />
        </div>

        {/* Reference value */}
        <div className="tf">
          <label className="form-label" htmlFor={`test-ref-${row.id}`}>
            Reference Value <span className="req">*</span>
          </label>
          <input
            id={`test-ref-${row.id}`}
            type="number"
            step="any"
            className="form-input"
            value={row.reference_value}
            onChange={field('reference_value')}
            placeholder="0.00"
            required
          />
        </div>

        {/* Actual value */}
        <div className="tf">
          <label className="form-label" htmlFor={`test-actual-${row.id}`}>
            Actual Value <span className="req">*</span>
          </label>
          <input
            id={`test-actual-${row.id}`}
            type="number"
            step="any"
            className="form-input"
            value={row.actual_value}
            onChange={field('actual_value')}
            placeholder="0.00"
            required
          />
        </div>

        {/* MIN value */}
        <div className="tf">
          <label className="form-label" htmlFor={`test-min-${row.id}`}>
            MIN Value <span className="req">*</span>
          </label>
          <input
            id={`test-min-${row.id}`}
            type="number" step="any"
            className="form-input"
            value={row.MIN_value}
            onChange={field('MIN_value')}
            placeholder="0.00"
            required
          />
        </div>

        {/* MAX value */}
        <div className="tf">
          <label className="form-label" htmlFor={`test-max-${row.id}`}>
            MAX Value <span className="req">*</span>
          </label>
          <input
            id={`test-max-${row.id}`}
            type="number" step="any"
            className="form-input"
            value={row.MAX_value}
            onChange={field('MAX_value')}
            placeholder="0.00"
            required
          />
        </div>

        {/* Deviation — computed, read-only */}
        <div className="tf">
          <label className="form-label">Deviation (auto)</label>
          <div className={`deviation-display ${
            deviation.startsWith('+') ? 'dev-pos' :
            deviation.startsWith('-') ? 'dev-neg' : ''
          }`}>
            {deviation || '—'}
          </div>
        </div>

        {/* Result */}
        <div className="tf">
          <label className="form-label" htmlFor={`result-${row.id}`}>Result</label>
          <div className="result-wrap">
            <select
              id={`result-${row.id}`}
              className="form-select"
              value={row.result}
              onChange={field('result')}
            >
              <option value="auto">Auto-calculate</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
            </select>
            {computedResult && (
              <span className={`result-badge badge ${computedResult === 'Pass' ? 'badge-success' : 'badge-danger'}`}>
                {computedResult}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Form component ──────────────────────────────────────────────────
export default function AddCalibrationForm() {
  // Device lookup state
  const [serialInput, setSerialInput]   = useState('');
  const [department, setDepartment]     = useState('');
  const [device, setDevice]             = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError]   = useState('');

  // Session metadata (Calibration_records)
  const [calibrationYear, setCalibrationYear] = useState(new Date().getFullYear().toString());
  const [accessoryType, setAccessoryType]     = useState('');
  const [accessoryModel, setAccessoryModel]   = useState('');
  const [accessorySerial, setAccessorySerial] = useState('');

  // Test rows (Calibration_measurements)
  const [tests, setTests] = useState([newTestRow()]);

  // Submission
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submitError, setSubmitError] = useState('');

  // New Device Creation state
  const [isCreating, setIsCreating]         = useState(false);
  const [newDeviceType, setNewDeviceType]   = useState('');
  const [newDeviceModel, setNewDeviceModel] = useState('');
  const [newDeviceMfr, setNewDeviceMfr]     = useState('');

  // ── Device lookup ────────────────────────────────────────────
  async function handleDeviceLookup(e) {
    e.preventDefault();
    if (!serialInput.trim()) return;
    setDeviceLoading(true);
    setDeviceError('');
    setDevice(null);
    setIsCreating(false);
    try {
      const dev = await getDevice(serialInput.trim());
      if (!dev) {
        setDeviceError(`No device found for serial number "${serialInput}". Check the number and try again or add a new device.`);
      } else {
        setDevice(dev);
        if (dev.department && !department) setDepartment(dev.department);
      }
    } catch {
      setDeviceError('Failed to look up device. Please try again.');
    } finally {
      setDeviceLoading(false);
    }
  }

  function handleSaveNewDevice() {
    if (!newDeviceType.trim() || !newDeviceModel.trim() || !newDeviceMfr.trim() || !department) {
      setDeviceError('Please fill in all device fields (Department, Type, Model, Manufacturer).');
      return;
    }
    const newDev = {
      serialNumber: serialInput.trim(),
      department: department,
      deviceType: newDeviceType.trim(),
      model: newDeviceModel.trim(),
      manufacturer: newDeviceMfr.trim(),
    };
    setDevice(newDev);
    setIsCreating(false);
    setDeviceError('');
  }

  // ── Test row management ──────────────────────────────────────
  const handleTestChange = useCallback((id, field, value) => {
    setTests((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  }, []);

  function addTestRow() {
    setTests((prev) => [...prev, newTestRow()]);
  }

  function removeTestRow(id) {
    setTests((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!device) {
      setSubmitError('Please look up and confirm a device before saving.');
      return;
    }
    if (!calibrationYear) {
      setSubmitError('Please specify the calibration year.');
      return;
    }
    if (tests.some((t) => !t.test_label.trim() || t.reference_value === '' || t.actual_value === '' || t.MIN_value === '' || t.MAX_value === '')) {
      setSubmitError('Each test row must have a label, reference value, actual value, MIN value, and MAX value.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    // Mock API Call delay
    await new Promise((r) => setTimeout(r, 900));

    setSubmitting(false);
    setSubmitted(true);
  }

  function handleReset() {
    setDevice(null);
    setSerialInput('');
    setDepartment('');
    setCalibrationYear(new Date().getFullYear().toString());
    setAccessoryType('');
    setAccessoryModel('');
    setAccessorySerial('');
    setIsCreating(false);
    setNewDeviceType('');
    setNewDeviceModel('');
    setNewDeviceMfr('');
    setTests([newTestRow()]);
    setSubmitted(false);
    setSubmitError('');
  }

  // ─── Success screen ────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="add-cal-form-wrap">
        <div className="add-cal-success card">
          <div className="success-icon-wrap">
            <SuccessIcon />
          </div>
          <h2>Record Saved</h2>
          <p>
            Calibration data for <strong>{device?.serialNumber}</strong> ({calibrationYear}) has been
            recorded successfully with <strong>{tests.length} test{tests.length !== 1 ? 's' : ''}</strong>.
          </p>
          <p className="success-note">
            In this demo, the record is not persisted. The real implementation will
            write to the database and update the device's control chart.
          </p>
          <div className="success-actions">
            <button type="button" className="btn btn-primary" onClick={handleReset}>
              Add Another Record
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="add-cal-form-wrap">
      <form id="add-calibration-form" onSubmit={handleSubmit} noValidate>

        {/* ── Section 1: Device Identification ─────────────────── */}
        <section className="add-cal-section">
          <div className="add-cal-section-header">
            <StepBadge n={1} />
            <div>
              <h2 className="add-cal-section-title">Device Identification</h2>
              <p className="add-cal-section-desc">Search for the device you are calibrating by its serial number.</p>
            </div>
          </div>

          <div className="card add-cal-card">
            <div className="add-cal-lookup-row">
              <div className="tf">
                <label htmlFor="add-dept" className="form-label">Department Name</label>
                <select
                  id="add-dept"
                  className="form-select"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="tf tf--grow">
                <label htmlFor="add-serial" className="form-label">
                  Serial Number <span className="req">*</span>
                </label>
                <input
                  id="add-serial"
                  type="text"
                  className="form-input"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="e.g. SN-AND-001"
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeviceLookup(e)}
                />
              </div>

              <div className="tf">
                <label className="form-label" aria-hidden="true">&nbsp;</label>
                <button
                  id="btn-lookup-device"
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDeviceLookup}
                  disabled={deviceLoading || !serialInput.trim()}
                >
                  {deviceLoading
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Looking up…</>
                    : <><SearchIcon /> Find Device</>
                  }
                </button>
              </div>
            </div>

            {/* Demo tip */}
            <p className="lookup-tip">
              Try:
              {['SN-AND-001', 'SN-IVF-012', 'SN-BLD-007', 'SN-PATH-003', 'SN-OR-015'].map((s) => (
                <code key={s} onClick={() => setSerialInput(s)} style={{ cursor: 'pointer' }}>{s}</code>
              ))}
            </p>

            {/* Device error / create prompt */}
            {deviceError && !isCreating && (
              <div className="add-cal-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertIcon /> {deviceError}
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setIsCreating(true)}
                >
                  Add this device
                </button>
              </div>
            )}

            {/* Create New Device inline form */}
            {isCreating && !device && (
              <div className="device-found-card" style={{ background: '#FFFDF0', borderColor: '#F4D03F' }}>
                <div className="device-found-label" style={{ color: '#9A7D0A' }}>
                  <PlusIcon /> Adding New Device
                </div>
                <div className="device-found-grid" style={{ marginBottom: 14 }}>
                  <div className="tf">
                    <label className="form-label">Device Type</label>
                    <input type="text" className="form-input" value={newDeviceType} onChange={(e) => setNewDeviceType(e.target.value)} placeholder="e.g. Centrifuge" />
                  </div>
                  <div className="tf">
                    <label className="form-label">Model</label>
                    <input type="text" className="form-input" value={newDeviceModel} onChange={(e) => setNewDeviceModel(e.target.value)} placeholder="e.g. 5810R" />
                  </div>
                  <div className="tf">
                    <label className="form-label">Manufacturer</label>
                    <input type="text" className="form-input" value={newDeviceMfr} onChange={(e) => setNewDeviceMfr(e.target.value)} placeholder="e.g. Eppendorf" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setIsCreating(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleSaveNewDevice}>Save & Continue</button>
                </div>
              </div>
            )}

            {/* Device info card */}
            {device && (
              <div className="device-found-card">
                <div className="device-found-label">
                  <CheckIcon /> Device found
                </div>
                <div className="device-found-grid">
                  <DeviceField label="Serial Number"  value={device.serialNumber} />
                  <DeviceField label="Department Name"     value={device.department} />
                  <DeviceField label="Device Type"    value={device.deviceType} />
                  <DeviceField label="Model"          value={device.model} />
                  <DeviceField label="Manufacturer"   value={device.manufacturer} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: Session Details ────────────────────────── */}
        <section className="add-cal-section">
          <div className="add-cal-section-header">
            <StepBadge n={2} />
            <div>
              <h2 className="add-cal-section-title">Calibration Session Details</h2>
              <p className="add-cal-section-desc">Record the calibration year and any reference accessories used.</p>
            </div>
          </div>

          <div className="card add-cal-card">
            <div className="session-grid">
              <div className="tf">
                <label htmlFor="cal-year" className="form-label">
                  Calibration Year <span className="req">*</span>
                </label>
                <input
                  id="cal-year"
                  type="number"
                  className="form-input"
                  value={calibrationYear}
                  onChange={(e) => setCalibrationYear(e.target.value)}
                  placeholder="YYYY"
                  required
                />
              </div>

              <div className="tf">
                <label htmlFor="acc-type" className="form-label">
                  Accessory Type
                </label>
                <input
                  id="acc-type"
                  type="text"
                  className="form-input"
                  value={accessoryType}
                  onChange={(e) => setAccessoryType(e.target.value)}
                  placeholder="e.g. NIST Traceable Thermometer"
                />
              </div>

              <div className="tf">
                <label htmlFor="acc-model" className="form-label">
                  Accessory Model
                </label>
                <input
                  id="acc-model"
                  type="text"
                  className="form-input"
                  value={accessoryModel}
                  onChange={(e) => setAccessoryModel(e.target.value)}
                  placeholder="e.g. Model X-200"
                />
              </div>

              <div className="tf">
                <label htmlFor="acc-serial" className="form-label">
                  Accessory Serial
                </label>
                <input
                  id="acc-serial"
                  type="text"
                  className="form-input"
                  value={accessorySerial}
                  onChange={(e) => setAccessorySerial(e.target.value)}
                  placeholder="e.g. SN-ACC-12345"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: Test Measurements ──────────────────────── */}
        <section className="add-cal-section">
          <div className="add-cal-section-header">
            <StepBadge n={3} />
            <div>
              <h2 className="add-cal-section-title">Calibration Measurements</h2>
              <p className="add-cal-section-desc">
                Enter one row per test performed. Result is automatically calculated based on MIN and MAX values.
              </p>
            </div>
          </div>

          <div className="tests-list">
            {tests.map((row, i) => (
              <TestRow
                key={row.id}
                row={row}
                index={i}
                onChange={handleTestChange}
                onRemove={removeTestRow}
                canRemove={tests.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            id="btn-add-test"
            className="btn btn-secondary add-test-btn"
            onClick={addTestRow}
          >
            <PlusIcon /> Add Another Test
          </button>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        {submitError && (
          <div className="add-cal-error submit-error" role="alert">
            <AlertIcon /> {submitError}
          </div>
        )}

        <div className="add-cal-footer">
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Clear Form
          </button>
          <button
            id="btn-save-calibration"
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting
              ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Saving…</>
              : <><SaveIcon /> Save Calibration Data</>
            }
          </button>
        </div>

      </form>
    </div>
  );
}

// ─── Small helper components ──────────────────────────────────────────────

function StepBadge({ n }) {
  return <div className="step-badge" aria-hidden="true">{n}</div>;
}

function DeviceField({ label, value }) {
  return (
    <div className="device-found-field">
      <span className="dff-label">{label}</span>
      <span className="dff-value">{value}</span>
    </div>
  );
}

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const RemoveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const SaveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SuccessIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
