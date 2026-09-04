import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDevice, getCalibrationHistory, getChartData, getDevicesByPrediction, getDepartments, updateDevice, deleteDevice } from '../api/devices';
import DeviceInfoCard from '../components/DeviceInfoCard';
import ControlChart from '../components/ControlChart';
import RecommendationCard from '../components/RecommendationCard';
import CalibrationHistoryTable from '../components/CalibrationHistoryTable';
import AddCalibrationForm from '../components/AddCalibrationForm';
import './CalibrationPage.css';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

export default function CalibrationPage() {
  const [searchParams] = useSearchParams();
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  const [serialInput, setSerialInput] = useState('');
  const [loading, setLoading]        = useState(false);
  const [notFound, setNotFound]      = useState(false);
  const [device, setDevice]          = useState(null);
  const [chartData, setChartData]    = useState(null);
  const [history, setHistory]        = useState([]);
  const [selectedAccessory, setSelectedAccessory] = useState('');

  // Prediction filter state
  const [selectedInterval, setSelectedInterval] = useState(null);
  const [predStability, setPredStability]       = useState(null);
  const [predDevices, setPredDevices]           = useState([]);
  const [predLoading, setPredLoading]           = useState(false);
  const [activeTab, setActiveTab]               = useState('direct'); // 'direct' | 'prediction' | 'add'
  const [searchText, setSearchText]             = useState('');
  const [searchInput, setSearchInput]           = useState(''); // raw text box value, committed on Search button click
  const [hasSearched, setHasSearched]           = useState(false); // whether the user has clicked Search at least once

  // Edit-device modal state (opened from the Search tab's results table)
  const [editingDevice, setEditingDevice]       = useState(null); // full device object being edited, or null
  const [editLoading, setEditLoading]           = useState(false); // fetching device details before opening modal
  const [editSaving, setEditSaving]             = useState(false);
  const [editError, setEditError]               = useState('');
  const [editFields, setEditFields]             = useState({ department: '', deviceType: '', model: '', manufacturer: '', resolution: '' });

  // Delete-device state (used from the Search tab's row actions, the Direct
  // Lookup device info section, and the edit modal).
  const [deletingSerial, setDeletingSerial]     = useState(null); // serial currently being deleted, or null
  const [deleteError, setDeleteError]           = useState('');

  useEffect(() => {
    getDepartments()
      .then(setDepartments)
      .catch((err) => console.error('Failed to load departments:', err));
  }, []);

  useEffect(() => {
    const query = searchParams.get('search') || searchParams.get('serial');
    if (query) {
      const serial = query.trim();
      setSerialInput(serial);
      setActiveTab('direct');
      executeSearch(serial);
    }
  }, [searchParams]);

  // Reactive fetch: fires whenever the committed search text, filters, or tab changes.
  // All values read inside the effect are listed in the dep array — no stale closures.
  // A cancellation flag ensures that a slow earlier response can never overwrite the
  // results of a faster later one (avoids race conditions on quick successive searches).
  useEffect(() => {
    if (activeTab !== 'prediction' || !hasSearched) return;

    let cancelled = false;
    setPredLoading(true);

    getDevicesByPrediction(selectedInterval, predStability, searchText || null)
      .then((results)  => { if (!cancelled) setPredDevices(results); })
      .catch((err)     => { console.error('Failed to fetch predictions:', err); })
      .finally(()      => { if (!cancelled) setPredLoading(false); });

    return () => { cancelled = true; };
  }, [selectedInterval, predStability, activeTab, searchText, hasSearched]);

  // Kept as a helper so handleSaveEdit can trigger a refresh after editing a device.
  async function handleFetchPredictions(interval, stability, search) {
    setPredLoading(true);
    try {
      const results = await getDevicesByPrediction(interval, stability, search);
      setPredDevices(results);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
    } finally {
      setPredLoading(false);
    }
  }

  // Commits the typed text into searchText state. The useEffect above reacts to
  // that change and fires the fetch — no direct fetch call needed here.
  function handlePredSearch(e) {
    e.preventDefault();
    setSearchText(searchInput.trim());
    setHasSearched(true);
  }

  async function executeSearch(serial) {
    if (!serial.trim()) return;
    setLoading(true);
    setNotFound(false);
    setDevice(null);
    setChartData(null);
    setHistory([]);

    try {
      const [dev, chart, hist] = await Promise.all([
        getDevice(serial.trim(), department),
        getChartData(serial.trim()),
        getCalibrationHistory(serial.trim()),
      ]);

      if (!dev) {
        setNotFound(true);
      } else {
        setDevice(dev);
        setChartData(chart);
        setHistory(hist);

        if (chart?.accessories) {
          const keys = Object.keys(chart.accessories);
          if (keys.length > 0) {
            // Prefer "Main Device" if present; otherwise default to whichever
            // accessory track has the longest history, so the page opens on
            // the most complete, most meaningful chart rather than whatever
            // key happened to come back first.
            const defaultKey = keys.includes('Main Device')
              ? 'Main Device'
              : keys.reduce((best, key) =>
                  (chart.accessories[key]?.points?.length || 0) >
                  (chart.accessories[best]?.points?.length || 0)
                    ? key
                    : best
                , keys[0]);
            setSelectedAccessory(defaultKey);
          }
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    await executeSearch(serialInput);
  }

  function handleSelectPredDevice(sn) {
    setSerialInput(sn);
    setActiveTab('direct');
    executeSearch(sn);
  }

  // ── Edit-device modal (opened from the Search tab's results table) ──────
  async function openEditModal(serialNumber) {
    setEditError('');
    setEditLoading(true);
    try {
      const dev = await getDevice(serialNumber);
      if (!dev) {
        setEditError(`Could not load device "${serialNumber}".`);
        return;
      }
      setEditingDevice(dev);
      setEditFields({
        department: dev.department || '',
        deviceType: dev.deviceType || '',
        model: dev.model || '',
        manufacturer: dev.manufacturer || '',
        resolution: dev.resolution !== undefined && dev.resolution !== null ? dev.resolution.toString() : '',
      });
    } catch (err) {
      setEditError(err.message || 'Failed to load device details.');
    } finally {
      setEditLoading(false);
    }
  }

  function closeEditModal() {
    setEditingDevice(null);
    setEditError('');
  }

  // ── Delete device (and everything under it: calibration records + tests) ──
  async function handleDeleteDevice(serialNumber) {
    if (!serialNumber) return;
    const confirmed = window.confirm(
      `Permanently delete device "${serialNumber}" and ALL of its calibration records and test data? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteError('');
    setDeletingSerial(serialNumber);
    try {
      await deleteDevice(serialNumber);

      // Clear it out of every view that might currently be showing it.
      if (device && device.serialNumber === serialNumber) {
        setDevice(null);
        setChartData(null);
        setHistory([]);
        setNotFound(false);
        setSerialInput('');
      }
      if (editingDevice && editingDevice.serialNumber === serialNumber) {
        closeEditModal();
      }
      if (activeTab === 'prediction' && hasSearched) {
        handleFetchPredictions(selectedInterval, predStability, searchText);
      }
    } catch (err) {
      setDeleteError(err.message || `Failed to delete device "${serialNumber}".`);
    } finally {
      setDeletingSerial(null);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingDevice) return;
    if (!editFields.deviceType.trim()) {
      setEditError('Device Type is required.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await updateDevice(editingDevice.serialNumber, {
        department_name: editFields.department.trim() || null,
        device_type: editFields.deviceType.trim(),
        model: editFields.model.trim() || null,
        manufacturer: editFields.manufacturer.trim() || null,
        resolution: editFields.resolution.trim() ? parseFloat(editFields.resolution.trim()) : null,
      });

      // Reflect the change in the Search tab's results table right away.
      if (activeTab === 'prediction') {
        handleFetchPredictions(selectedInterval, predStability, searchText);
      }
      // If the same device is currently open in the Direct Lookup view, sync it too.
      if (device && device.serialNumber === updated.serialNumber) {
        setDevice(updated);
      }

      closeEditModal();
    } catch (err) {
      setEditError(err.message || 'Failed to update device. Please try again.');
    } finally {
      setEditSaving(false);
    }
  }

  const hasResults = Boolean(device);

  // ── Export Calibration Report ─────────────────────────────────────────────
  function downloadReport() {
    const rows = [];
    // Header row
    rows.push([
      'Serial Number', 'Department', 'Device Type', 'Model', 'Manufacturer',
      'Calibration Year', 'Certificate No', 'Accessory Type',
      'Test Label', 'Unit', 'Reference Value', 'Actual Value',
      'Min Value', 'Max Value', 'Deviation', 'Result'
    ].join(','));

    if (history && history.length > 0 && device) {
      history.forEach(record => {
        if (record.tests && record.tests.length > 0) {
          record.tests.forEach(test => {
            rows.push([
              device.serialNumber,
              device.department || '',
              device.deviceType || '',
              device.model || '',
              device.manufacturer || '',
              record.calibration_year,
              record.certificate_num || '',
              record.accessory_type || 'Main Device',
              test.test_label || '',
              test.test_point_unit || '',
              test.reference_value ?? '',
              test.actual_value ?? '',
              test.min_value ?? '',
              test.max_value ?? '',
              test.deviation ?? '',
              test.result || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
          });
        } else {
          // Record with no tests
          rows.push([
            device.serialNumber,
            device.department || '',
            device.deviceType || '',
            device.model || '',
            device.manufacturer || '',
            record.calibration_year,
            record.certificate_num || '',
            record.accessory_type || 'Main Device',
            '', '', '', '', '', '', '', record.result || ''
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        }
      });
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `calibration_report_${device?.serialNumber || 'all'}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }


  return (
    <div className="cal-page">
      {/* ─────────────────────────────────────────────────────────────
          Page Mode Toggle Bar
      ───────────────────────────────────────────────────────────── */}
      <div className="cal-tab-bar">
        <button
          type="button"
          className={`btn ${activeTab === 'direct' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('direct')}
          style={{ fontSize: '0.8125rem' }}
        >
          Direct Serial Lookup
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'prediction' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('prediction')}
          style={{ fontSize: '0.8125rem' }}
        >
          Search
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'add' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('add')}
          style={{ fontSize: '0.8125rem' }}
        >
          Add Calibration Data
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={downloadReport}
          style={{ fontSize: '0.8125rem', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <DownloadIcon /> Export Report
        </button>
      </div>

      {deleteError && (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '10px 16px', fontSize: '0.85rem' }}>
          {deleteError}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Add Calibration Data Mode
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'add' && (
        <AddCalibrationForm />
      )}

      {/* ─────────────────────────────────────────────────────────────
          Prediction Search Mode
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'prediction' && (
        <div className="card pred-search-card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 6px' }}>Filter Devices by Predicted Calibration Interval</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Select a predicted interval to list all medical devices estimated for calibration within that timeframe.
          </p>

            <form onSubmit={handlePredSearch} className="pred-search-row">
              <div className="cal-field" style={{ flex: 1 }}>
                <label htmlFor="pred-search-text" className="form-label">Search (serial, department, or type)</label>
                <div className="pred-search-box" style={{ maxWidth: 'none' }}>
                  <span className="pred-search-box-icon"><SearchIcon /></span>
                  <input
                    id="pred-search-text"
                    type="text"
                    className="form-input"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePredSearch(e); } }}
                    placeholder="e.g. ICU, Ventilator, or a serial number"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="cal-field cal-field--btn" style={{ justifyContent: 'flex-end' }}>
                <label className="form-label" aria-hidden="true">&nbsp;</label>
                <button type="submit" className="btn btn-primary" disabled={predLoading}>
                  {predLoading ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />Searching…</> : <><SearchIcon />Search</>}
                </button>
              </div>
            </form>

            <div className="pred-filter-bar">
              <span className="pred-filter-label">Filter by Prediction:</span>
              <button
                type="button"
                className={`pred-filter-btn ${selectedInterval === null && predStability === null ? 'active' : ''}`}
                onClick={() => { setSelectedInterval(null); setPredStability(null); }}
              >
                All Devices
              </button>
              <button
                type="button"
                className={`pred-filter-btn ${selectedInterval === 2 && predStability === 'stable' ? 'active' : ''}`}
                onClick={() => { setSelectedInterval(2); setPredStability('stable'); }}
              >
                Predict: 2 Years Interval (Stable)
              </button>
              <button
                type="button"
                className={`pred-filter-btn ${selectedInterval === 1 && predStability === 'marginal' ? 'active' : ''}`}
                onClick={() => { setSelectedInterval(1); setPredStability('marginal'); }}
              >
                Predict: 1 Year Interval (Marginal)
              </button>
              <button
                type="button"
                className={`pred-filter-btn ${predStability === 'unstable' ? 'active' : ''}`}
                onClick={() => { setSelectedInterval(null); setPredStability('unstable'); }}
              >
                Predict: Unstable (Immediate)
              </button>
            </div>

            {!hasSearched ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Enter a search term or choose a filter above, then click <strong>Search</strong> to view devices.
              </div>
            ) : predLoading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                Loading predicted devices...
              </div>
            ) : predDevices.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No devices match the selected filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table className="pred-results-table">
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Department</th>
                      <th>Device & Model</th>
                      <th>Stability Prediction</th>
                      <th>Predicted Interval</th>
                      <th>Next Calibration Due (Month / Year)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predDevices.map((dev) => (
                      <tr key={dev.serial_number}>
                        <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{dev.serial_number}</td>
                        <td>{dev.department}</td>
                        <td>{dev.device_type} ({dev.model})</td>
                        <td>
                          <span className={`badge-stability ${dev.stability}`}>
                            {dev.label || dev.stability}
                          </span>
                        </td>
                        <td><strong>{dev.interval_years} {dev.interval_years === 1 ? 'Year' : 'Years'}</strong></td>
                        <td>{dev.next_date}</td>
                        <td>
                          <div className="pred-row-actions">
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleSelectPredDevice(dev.serial_number)}
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => openEditModal(dev.serial_number)}
                              disabled={editLoading}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-danger-outline"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteDevice(dev.serial_number)}
                              disabled={deletingSerial === dev.serial_number}
                            >
                              {deletingSerial === dev.serial_number ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Edit Device Modal — reachable from the Search tab's results
          table (Direct Serial Lookup edits inline via DeviceInfoCard).
      ───────────────────────────────────────────────────────────── */}
      {editingDevice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit device"
          className="edit-device-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
        >
          <div className="card edit-device-modal">
            <div className="edit-device-modal-header">
              <h3>Edit Device — {editingDevice.serialNumber}</h3>
              <button type="button" className="edit-device-modal-close" onClick={closeEditModal} aria-label="Close">✕</button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {editError && <div className="error-message" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: 10 }}>{editError}</div>}

              <div className="edit-device-grid">
                <div className="tf">
                  <label className="form-label">Serial Number</label>
                  <input type="text" className="form-input" value={editingDevice.serialNumber} disabled style={{ background: '#f5f5f5', cursor: 'not-allowed' }} />
                </div>
                <div className="tf">
                  <label className="form-label">Department</label>
                  <input
                    type="text" className="form-input"
                    value={editFields.department}
                    onChange={(e) => setEditFields((f) => ({ ...f, department: e.target.value }))}
                  />
                </div>
                <div className="tf">
                  <label className="form-label">Device Type <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text" className="form-input" required
                    value={editFields.deviceType}
                    onChange={(e) => setEditFields((f) => ({ ...f, deviceType: e.target.value }))}
                  />
                </div>
                <div className="tf">
                  <label className="form-label">Model</label>
                  <input
                    type="text" className="form-input"
                    value={editFields.model}
                    onChange={(e) => setEditFields((f) => ({ ...f, model: e.target.value }))}
                  />
                </div>
                <div className="tf">
                  <label className="form-label">Manufacturer</label>
                  <input
                    type="text" className="form-input"
                    value={editFields.manufacturer}
                    onChange={(e) => setEditFields((f) => ({ ...f, manufacturer: e.target.value }))}
                  />
                </div>
                <div className="tf">
                  <label className="form-label">Resolution</label>
                  <input
                    type="number" step="any" className="form-input"
                    value={editFields.resolution}
                    onChange={(e) => setEditFields((f) => ({ ...f, resolution: e.target.value }))}
                  />
                </div>
              </div>

              <div className="edit-device-actions" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-danger-outline"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => handleDeleteDevice(editingDevice.serialNumber)}
                  disabled={editSaving || deletingSerial === editingDevice.serialNumber}
                >
                  {deletingSerial === editingDevice.serialNumber ? 'Deleting…' : 'Delete Device'}
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={closeEditModal} disabled={editSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={editSaving}>
                    {editSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Direct Search Mode (Step-by-step)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'direct' && (
        <>
          <section className="cal-section" aria-label="Device search">
            <div className="cal-section-header">
              <StepBadge n={1} />
              <div>
                <h2 className="cal-section-title">Select Device</h2>
                <p className="cal-section-desc">Search for a medical device by its unique serial number.</p>
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
                  {departments.map((d) => (
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
                  placeholder="Enter the device serial number"
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


          </form>
          </section>
        </>
      )}

      {activeTab === 'direct' && loading && (
        <div className="card cal-loading">
          <DeviceInfoCard loading={true} device={null} />
        </div>
      )}

      {activeTab === 'direct' && notFound && !loading && (
        <div className="card cal-not-found empty-state">
          <NotFoundIcon />
          <h3>No device found</h3>
          <p>No device was found with serial number &ldquo;<strong>{serialInput}</strong>&rdquo;. Check the serial number and try again.</p>
        </div>
      )}

      {activeTab === 'direct' && hasResults && !loading && (
        <>
          {/* Step 2 — Device info */}
          <section className="cal-section" aria-label="Device information">
            <div className="cal-section-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <StepBadge n={2} />
                <div>
                  <h2 className="cal-section-title">Device Information</h2>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-danger-outline"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={() => handleDeleteDevice(device.serialNumber)}
                disabled={deletingSerial === device.serialNumber}
              >
                {deletingSerial === device.serialNumber ? 'Deleting…' : 'Delete Device'}
              </button>
            </div>
            <DeviceInfoCard device={device} loading={false} />
          </section>

          {/* Step 3 — Control chart + recommendation */}
          <section className="cal-section" aria-label="Control chart">
            <div className="cal-section-header">
              <StepBadge n={3} />
              <div>
                <h2 className="cal-section-title">Prediction Engine</h2>
                <p className="cal-section-desc">Analysis of how close the device readings approach the failure limits over time.</p>
              </div>
            </div>

            <div className="cal-chart-row">
              {/* Chart */}
              <div className="cal-chart-card card">
                <div className="cal-chart-card-header">
                  <ChartIcon />
                  <span>Closeness to Edge Score</span>

                  {chartData?.accessories && Object.keys(chartData.accessories).length > 1 && (
                    <select
                      className="form-select"
                      style={{ marginLeft: 'auto', padding: '2px 24px 2px 8px', width: 'auto', fontSize: '0.8125rem' }}
                      value={selectedAccessory}
                      onChange={(e) => setSelectedAccessory(e.target.value)}
                    >
                      {Object.keys(chartData.accessories).map(acc => (
                        <option key={acc} value={acc}>{acc === 'Main Device' ? 'Base Unit (No Accessory)' : acc}</option>
                      ))}
                    </select>
                  )}
                </div>
                {chartData?.accessories?.[selectedAccessory]?.points?.length > 0 ? (
                  <ControlChart data={chartData.accessories[selectedAccessory].points} />
                ) : (
                  <div className="empty-state"><p>No chart data available.</p></div>
                )}
              </div>

              {/* Recommendation */}
              {chartData?.accessories?.[selectedAccessory]?.recommendation && (
                <div className="cal-rec-col">
                  <RecommendationCard recommendation={chartData.accessories[selectedAccessory].recommendation} />
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
              <CalibrationHistoryTable records={history} serialNumber={device.serialNumber} />
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