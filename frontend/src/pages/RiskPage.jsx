// src/pages/RiskPage.jsx — Risk Assessment & Risk Classification Module UI

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { getRiskDashboard, getDeviceRiskDetails, updateRiskAssessment, listRiskAssessments } from '../api/risk';
import './RiskPage.css';

const RISK_CLASS_COLORS = {
  CLASS_1: '#10b981', // Green
  CLASS_2: '#f59e0b', // Yellow / Amber
  CLASS_3: '#ef4444', // Red
};

const CAL_RISK_COLORS = {
  LOW: '#10b981',
  MEDIUM: '#f97316',
  HIGH: '#dc2626',
};

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  );
}

const EMPTY_EDIT_FORM = {
  device_type: '',
  arabic_name: '',
  process_risk: 1,
  patient_risk: 1,
  minimum_required: 1,
  equipment_count: 1,
  recommended_action: '',
  preventive_action: '',
  corrective_action: '',
  notes: '',
};

function isAdminUser() {
  try {
    const user = JSON.parse(localStorage.getItem('auth_user') || '{}');
    const role = (user.role || '').toLowerCase();
    // Roles that can edit risk configs: admin OR Biomedical Engineer
    return role === 'admin' || role === 'biomedical engineer' || role === 'biomedical_engineer';
  } catch { return false; }
}

export default function RiskPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskClass, setSelectedRiskClass] = useState('ALL');
  const [selectedCalRisk, setSelectedCalRisk] = useState('ALL');

  // Modal / Drawer state for detailed device view
  const [selectedDeviceSerial, setSelectedDeviceSerial] = useState(null);
  const [deviceDetails, setDeviceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Edit form state (admin only)
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editConfigId, setEditConfigId] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isAdmin = isAdminUser();

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    const query = searchParams.get('search');
    if (query) {
      setSearchTerm(query);
    }
  }, [searchParams]);

  const handlePrintRiskReport = (serial) => {
    if (!serial) return;
    window.open(`/print/risk/${encodeURIComponent(serial)}`, '_blank');
  };

  const handleExportCSV = () => {
    if (!dashboardData || !dashboardData.devices || dashboardData.devices.length === 0) return;
    const rows = filteredDevices.length > 0 ? filteredDevices : dashboardData.devices;
    const headers = [
      'Serial Number',
      'Department',
      'Equipment Type',
      'Model',
      'Manufacturer',
      'Risk Class',
      'Probability of Occurrence',
      'Equipment Risk Score',
      'Risk Percentage (%)',
      'Calibration Risk Level',
      'Calibration Failure Rate (%)',
      'Calibration Status',
      'Days Remaining'
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.serial_number || ''}"`,
        `"${r.department || ''}"`,
        `"${r.device_type || ''}"`,
        `"${r.model || ''}"`,
        `"${r.manufacturer || ''}"`,
        `"${r.risk_class || ''}"`,
        r.probability_occurrence !== null && r.probability_occurrence !== undefined ? r.probability_occurrence : '',
        r.equipment_risk !== null && r.equipment_risk !== undefined ? r.equipment_risk : '',
        r.risk_percentage !== null && r.risk_percentage !== undefined ? r.risk_percentage : '',
        `"${r.calibration_risk_level || ''}"`,
        r.calibration_failure_rate !== null && r.calibration_failure_rate !== undefined ? r.calibration_failure_rate : '',
        `"${r.calibration_status || ''}"`,
        r.days_remaining !== null && r.days_remaining !== undefined ? r.days_remaining : ''
      ].join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Medical_Equipment_Risk_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRiskDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load risk dashboard:', err);
      setError('Unable to load risk assessment data. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Edit helpers ──
  const handleStartEdit = async () => {
    if (!deviceDetails) return;
    const er = deviceDetails.equipment_risk;
    try {
      const allConfigs = await listRiskAssessments();
      const match = allConfigs.find(
        (c) => c.device_type.trim().toLowerCase() === er.device_type.trim().toLowerCase()
      );
      if (match) {
        setEditConfigId(match.id);
        setEditForm({
          device_type: match.device_type,
          arabic_name: match.arabic_name || '',
          process_risk: match.process_risk,
          patient_risk: match.patient_risk,
          minimum_required: match.minimum_required,
          equipment_count: match.equipment_count,
          recommended_action: match.recommended_action || '',
          preventive_action: match.preventive_action || '',
          corrective_action: match.corrective_action || '',
          notes: match.notes || '',
        });
      } else {
        setEditConfigId(null);
        setEditForm({ ...EMPTY_EDIT_FORM, device_type: er.device_type, arabic_name: er.arabic_name || '',
          process_risk: er.process_risk, patient_risk: er.patient_risk,
          minimum_required: er.minimum_required, equipment_count: er.equipment_count,
          recommended_action: er.recommended_action || '', preventive_action: er.preventive_action || '',
          corrective_action: er.corrective_action || '' });
      }
    } catch (err) { console.error('Could not load config list:', err); }
    setIsEditing(true); setSaveError(null); setSaveSuccess(false);
  };

  const handleCancelEdit = () => { setIsEditing(false); setSaveError(null); setSaveSuccess(false); };

  const handleFormChange = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  const handleSaveEdit = async () => {
    if (!editConfigId) { setSaveError('No risk config ID found for this device type.'); return; }
    setSaveLoading(true); setSaveError(null); setSaveSuccess(false);
    try {
      await updateRiskAssessment(editConfigId, {
        device_type: editForm.device_type,
        arabic_name: editForm.arabic_name || null,
        process_risk: Number(editForm.process_risk),
        patient_risk: Number(editForm.patient_risk),
        minimum_required: Number(editForm.minimum_required),
        equipment_count: Number(editForm.equipment_count),
        recommended_action: editForm.recommended_action || null,
        preventive_action: editForm.preventive_action || null,
        corrective_action: editForm.corrective_action || null,
        notes: editForm.notes || null,
      });
      setSaveSuccess(true); setIsEditing(false);
      const details = await getDeviceRiskDetails(selectedDeviceSerial);
      setDeviceDetails(details);
      fetchDashboard();
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError(err?.response?.data?.detail || 'Failed to save. Please try again.');
    } finally { setSaveLoading(false); }
  };

  const handleOpenDeviceDetails = async (serialNumber) => {
    setSelectedDeviceSerial(serialNumber);
    setDetailsLoading(true);
    setIsEditing(false); setSaveError(null); setSaveSuccess(false);
    try {
      const details = await getDeviceRiskDetails(serialNumber);
      setDeviceDetails(details);
    } catch (err) {
      console.error('Failed to fetch device risk details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedDeviceSerial(null);
    setDeviceDetails(null);
    setIsEditing(false); setSaveError(null); setSaveSuccess(false);
  };

  if (loading) {
    return (
      <div className="risk-page" style={{ textAlign: 'center', padding: '60px' }}>
        <h3>Loading Risk Assessment Module...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-page">
        <div className="safety-notice-banner" style={{ background: '#fef2f2', borderColor: '#ef4444', color: '#991b1b' }}>
          <span className="safety-notice-icon">⚠️</span>
          <div>
            <strong>Error Loading Risk Module</strong>
            <p>{error}</p>
            <button className="btn-view-details" onClick={fetchDashboard} style={{ marginTop: '10px' }}>
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { overall_stats, risk_distribution, calibration_risk_distribution, devices } = dashboardData;

  // Filter devices list
  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      !searchTerm ||
      (d.serial_number && d.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.department && d.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.device_type && d.device_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.model && d.model.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesClass = selectedRiskClass === 'ALL' || d.risk_class === selectedRiskClass;
    const matchesCalRisk = selectedCalRisk === 'ALL' || d.calibration_risk_level === selectedCalRisk;

    return matchesSearch && matchesClass && matchesCalRisk;
  });

  return (
    <div className="risk-page">
      {/* Clean Page Title */}
      <div className="risk-page-title-row">
        <h2 className="risk-page-main-title">
          <span className="risk-title-icon"><ShieldIcon /></span> Medical Equipment Risk Assessment & Classification
        </h2>
      </div>

      {/* Distribution Charts */}
      <div className="risk-charts-grid">
        {/* Equipment Risk Distribution Chart */}
        <div className="chart-card">
          <h3>Equipment Risk Classification</h3>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={risk_distribution} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {risk_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RISK_CLASS_COLORS[entry.risk_class] || '#2563eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Calibration Risk Level Distribution Chart */}
        <div className="chart-card">
          <h3>Calibration Risk Indicators</h3>
          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={calibration_risk_distribution} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {calibration_risk_distribution.map((entry, index) => (
                    <Cell key={`cell-cal-${index}`} fill={CAL_RISK_COLORS[entry.level] || '#2563eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filterable Table Section */}
      <div className="risk-table-section">
        <div className="risk-table-controls">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search serial, dept, type, model..."
              className="risk-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: '240px' }}
            />

            <select
              className="risk-select-filter"
              value={selectedRiskClass}
              onChange={(e) => setSelectedRiskClass(e.target.value)}
            >
              <option value="ALL">All Equipment Risk Classes</option>
              <option value="CLASS_1">Class 1 (Low Risk)</option>
              <option value="CLASS_2">Class 2 (Medium Risk)</option>
              <option value="CLASS_3">Class 3 (High Criticality)</option>
            </select>

            <select
              className="risk-select-filter"
              value={selectedCalRisk}
              onChange={(e) => setSelectedCalRisk(e.target.value)}
            >
              <option value="ALL">All Calibration Risk Levels</option>
              <option value="LOW">LOW Calibration Risk</option>
              <option value="MEDIUM">MEDIUM Calibration Risk</option>
              <option value="HIGH">HIGH Calibration Risk</option>
            </select>
          </div>

          <div className="table-controls-right">
            <button className="btn-export-csv" onClick={handleExportCSV} title="Export current risk dataset to CSV">
              <DownloadIcon /> Export CSV
            </button>
            <div className="table-count-label">
              Showing <strong>{filteredDevices.length}</strong> of {devices.length} devices
            </div>
          </div>
        </div>

        <div className="risk-table-container">
          <table className="risk-table">
            <thead>
              <tr>
                <th>Serial Number</th>
                <th>Department</th>
                <th>Equipment Type</th>
                <th>Model</th>
                <th>Equipment Risk Class</th>
                <th>Prob. of Occurrence</th>
                <th>Risk %</th>
                <th>Cal Failure Rate</th>
                <th>Cal Risk Indicator</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                    No devices match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDevices.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.serial_number}</strong></td>
                    <td>{d.department || '—'}</td>
                    <td>{d.device_type}</td>
                    <td>{d.model || '—'}</td>
                    <td>
                      <span className={`badge-${d.risk_class.toLowerCase()}`}>
                        {d.risk_class.replace('_', ' ')}
                      </span>
                    </td>
                    <td><strong>{d.probability_occurrence !== undefined && d.probability_occurrence !== null ? d.probability_occurrence : '—'}</strong></td>
                    <td>{d.risk_percentage}%</td>
                    <td>
                      {d.calibration_failure_rate !== null ? `${d.calibration_failure_rate}%` : 'N/A'}
                    </td>
                    <td>
                      <span className={`badge-cal-${d.calibration_risk_level.toLowerCase()}`}>
                        {d.calibration_risk_level}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-view-details"
                        onClick={() => handleOpenDeviceDetails(d.serial_number)}
                      >
                        Risk Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device Details Modal */}
      {selectedDeviceSerial && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="risk-modal" onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="modal-header">
              <h2>Device Risk Evaluation — {selectedDeviceSerial}</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {deviceDetails && !isEditing && (
                  <button className="btn-print-risk" onClick={() => handlePrintRiskReport(selectedDeviceSerial)}>
                    <FileTextIcon /> Download / Print Report
                  </button>
                )}
                {isAdmin && deviceDetails && !isEditing && (
                  <button className="btn-edit-risk" onClick={handleStartEdit}>
                    <EditIcon /> Edit Configuration
                  </button>
                )}
                <button className="btn-close-modal" onClick={handleCloseModal}>&times;</button>
              </div>
            </div>

            <div className="modal-body">
              {detailsLoading || !deviceDetails ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>Loading device risk details...</div>
              ) : isEditing ? (

                /* ── EDIT FORM ── */
                <div className="edit-risk-form">
                  <div className="edit-form-header">
                    Editing Risk Configuration — <strong>{editForm.device_type}</strong>
                  </div>
                  {saveError && <div className="edit-form-error">{saveError}</div>}

                  {/* Risk Scoring Guide Card */}
                  <div className="risk-scoring-guide-box">
                    <div className="guide-box-header">
                      <span><strong>Risk Criteria Guide (دليل معايير التقييم):</strong></span>
                    </div>
                    <div className="guide-box-content">
                      <div className="guide-col">
                        <strong>Process Impact (تأثير العملية):</strong>
                        <ul>
                          <li><strong>1 (Low):</strong> Minor impact / لا يؤثر على سير العمل أو توجد بدائل فورية</li>
                          <li><strong>2 (Medium):</strong> Partial delay or service disruption / تعطيل جزئي أو تأخير</li>
                          <li><strong>3 (High):</strong> Full process stop or critical unit halt / توقف كامل للعمليات الحيوية</li>
                        </ul>
                      </div>
                      <div className="guide-col">
                        <strong>Patient Impact (تأثير المريض):</strong>
                        <ul>
                          <li><strong>1 (Low):</strong> No direct patient hazard / لا خطر مباشر على سلامة المريض</li>
                          <li><strong>2 (Medium):</strong> Indirect risk or delayed diagnosis / خطر غير مباشر أو تأخير تشخيص</li>
                          <li><strong>3 (High):</strong> Direct life-threat (defibrillator, ventilator, etc.) / خطر مباشر يهدد الحياة</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="edit-section-title">Risk Factors</div>
                  <div className="edit-grid">
                    <div className="edit-field">
                      <label>Arabic Name (الاسم بالعربي)</label>
                      <input type="text" value={editForm.arabic_name}
                        onChange={(e) => handleFormChange('arabic_name', e.target.value)}
                        placeholder="e.g. جهاز قياس ضغط الدم" />
                    </div>
                    <div className="edit-field">
                      <label>Process Impact Risk (تأثير تعطل العملية)</label>
                      <select value={editForm.process_risk} onChange={(e) => handleFormChange('process_risk', e.target.value)}>
                        <option value={1}>1 — Low: Minor impact (لا يؤثر على سير العمل أو توجد بدائل)</option>
                        <option value={2}>2 — Medium: Partial service delay (تعطيل جزئي أو تأخير)</option>
                        <option value={3}>3 — High: Complete process halt (توقف كامل للعمليات الحيوية)</option>
                      </select>
                      <small className="field-hint">
                        {editForm.process_risk === 1 && "Level 1: Routine equipment, non-critical process impact."}
                        {editForm.process_risk === 2 && "Level 2: Important equipment, temporary workflow delays."}
                        {editForm.process_risk === 3 && "Level 3: Critical facility equipment (Central O2, OR units, Generators)."}
                      </small>
                    </div>
                    <div className="edit-field">
                      <label>Patient Impact Risk (تأثير سلامة المريض)</label>
                      <select value={editForm.patient_risk} onChange={(e) => handleFormChange('patient_risk', e.target.value)}>
                        <option value={1}>1 — Low: No direct patient injury (لا خطر مباشر على المريض)</option>
                        <option value={2}>2 — Medium: Indirect risk / diagnostic delay (خطر غير مباشر أو تأخير تشخيص)</option>
                        <option value={3}>3 — High: Direct life hazard (خطر مباشر يهدد الحياة كأجهزة الإنعاش)</option>
                      </select>
                      <small className="field-hint">
                        {editForm.patient_risk === 1 && "Level 1: Administrative, comfort, or non-contact devices."}
                        {editForm.patient_risk === 2 && "Level 2: Diagnostic devices, lab monitors, general wards."}
                        {editForm.patient_risk === 3 && "Level 3: Life-support, ICU, Defibrillator, Ventilator, Anesthesia."}
                      </small>
                    </div>
                    <div className="edit-field">
                      <label>Minimum Required (العدد المطلوب)</label>
                      <input type="number" min="1" value={editForm.minimum_required}
                        onChange={(e) => handleFormChange('minimum_required', e.target.value)} />
                    </div>
                    <div className="edit-field">
                      <label>Equipment Count (العدد الموجود)</label>
                      <input type="number" min="0" value={editForm.equipment_count}
                        onChange={(e) => handleFormChange('equipment_count', e.target.value)} />
                    </div>
                  </div>

                  <div className="edit-section-title">Maintenance Actions</div>
                  <div className="edit-grid-full">
                    <div className="edit-field">
                      <label>Recommended Action</label>
                      <textarea rows={2} value={editForm.recommended_action}
                        onChange={(e) => handleFormChange('recommended_action', e.target.value)}
                        placeholder="General recommended action..." />
                    </div>
                    <div className="edit-field">
                      <label>Preventive Action</label>
                      <textarea rows={2} value={editForm.preventive_action}
                        onChange={(e) => handleFormChange('preventive_action', e.target.value)}
                        placeholder="Scheduled preventive maintenance steps..." />
                    </div>
                    <div className="edit-field">
                      <label>Corrective Action</label>
                      <textarea rows={2} value={editForm.corrective_action}
                        onChange={(e) => handleFormChange('corrective_action', e.target.value)}
                        placeholder="Steps to take when device fails..." />
                    </div>
                    <div className="edit-field">
                      <label>Notes</label>
                      <textarea rows={2} value={editForm.notes}
                        onChange={(e) => handleFormChange('notes', e.target.value)}
                        placeholder="Additional notes..." />
                    </div>
                  </div>

                  <div className="edit-form-actions">
                    <button className="btn-cancel-edit" onClick={handleCancelEdit} disabled={saveLoading}>Cancel</button>
                    <button className="btn-save-edit" onClick={handleSaveEdit} disabled={saveLoading}>
                      {saveLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

              ) : (
                /* ── VIEW MODE ── */
                <>
                  {saveSuccess && (
                    <div className="edit-form-success">Risk configuration updated successfully.</div>
                  )}

                  {/* Device Metadata */}
                  <div className="detail-section">
                    <h4>Device Metadata</h4>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">Serial Number</span><span className="detail-val">{deviceDetails.device.serial_number}</span></div>
                      <div className="detail-item"><span className="detail-label">Department</span><span className="detail-val">{deviceDetails.device.department || 'N/A'}</span></div>
                      <div className="detail-item"><span className="detail-label">Equipment Type</span><span className="detail-val">{deviceDetails.device.device_type}</span></div>
                      <div className="detail-item"><span className="detail-label">Manufacturer / Model</span><span className="detail-val">{deviceDetails.device.manufacturer || '—'} / {deviceDetails.device.model || '—'}</span></div>
                    </div>
                  </div>

                  {/* Equipment Risk */}
                  <div className="detail-section">
                    <h4>
                      Equipment Risk Assessment
                      <span className={`badge-${deviceDetails.equipment_risk.risk_class.toLowerCase()}`}>
                        {deviceDetails.equipment_risk.risk_class.replace('_', ' ')}
                      </span>
                    </h4>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">Arabic Name</span><span className="detail-val">{deviceDetails.equipment_risk.arabic_name || '—'}</span></div>
                      <div className="detail-item"><span className="detail-label">Patient Impact Risk</span><span className="detail-val">{deviceDetails.equipment_risk.patient_risk} / 3</span></div>
                      <div className="detail-item"><span className="detail-label">Process Impact Risk</span><span className="detail-val">{deviceDetails.equipment_risk.process_risk} / 3</span></div>
                      <div className="detail-item"><span className="detail-label">Equipment Count / Min Required</span><span className="detail-val">{deviceDetails.equipment_risk.equipment_count} / {deviceDetails.equipment_risk.minimum_required}</span></div>
                      <div className="detail-item">
                        <span className="detail-label">Probability of Occurrence</span>
                        <span className="detail-val">{deviceDetails.equipment_risk.probability_occurrence}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Equipment Risk Score</span>
                        <span className="detail-val">{deviceDetails.equipment_risk.equipment_risk}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Risk Percentage</span>
                        <span className="detail-val">{deviceDetails.equipment_risk.risk_percentage}%</span>
                      </div>
                      {deviceDetails.equipment_risk.recommended_action && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}><span className="detail-label">Recommended Action</span><span className="detail-val">{deviceDetails.equipment_risk.recommended_action}</span></div>
                      )}
                      {deviceDetails.equipment_risk.preventive_action && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}><span className="detail-label">Preventive Action</span><span className="detail-val">{deviceDetails.equipment_risk.preventive_action}</span></div>
                      )}
                      {deviceDetails.equipment_risk.corrective_action && (
                        <div className="detail-item" style={{ gridColumn: '1 / -1' }}><span className="detail-label">Corrective Action</span><span className="detail-val">{deviceDetails.equipment_risk.corrective_action}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Calibration Risk */}
                  <div className="detail-section">
                    <h4>
                      Calibration Risk Indicator
                      <span className={`badge-cal-${deviceDetails.calibration_risk.calibration_risk_level.toLowerCase()}`}>
                        {deviceDetails.calibration_risk.calibration_risk_level} RISK
                      </span>
                    </h4>
                    <div className="detail-grid">
                      <div className="detail-item"><span className="detail-label">Total Calibration Visits</span><span className="detail-val">{deviceDetails.calibration_risk.total_calibrations}</span></div>
                      <div className="detail-item"><span className="detail-label">Passed / Failed Visits</span><span className="detail-val">{deviceDetails.calibration_risk.passed_calibrations} Passed / {deviceDetails.calibration_risk.failed_calibrations} Failed</span></div>
                      <div className="detail-item"><span className="detail-label">Calibration Failure Rate</span><span className="detail-val">{deviceDetails.calibration_risk.calibration_failure_rate !== null ? `${deviceDetails.calibration_risk.calibration_failure_rate}%` : 'No Records'}</span></div>
                      <div className="detail-item"><span className="detail-label">Total Tests / Failed Tests</span><span className="detail-val">{deviceDetails.calibration_risk.total_tests} Tests / {deviceDetails.calibration_risk.failed_tests} Failed</span></div>
                      <div className="detail-item"><span className="detail-label">Average Deviation</span><span className="detail-val">{deviceDetails.calibration_risk.avg_deviation !== null ? deviceDetails.calibration_risk.avg_deviation : 'N/A'}</span></div>
                      <div className="detail-item"><span className="detail-label">Max Absolute Deviation</span><span className="detail-val">{deviceDetails.calibration_risk.max_deviation !== null ? deviceDetails.calibration_risk.max_deviation : 'N/A'}</span></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}