// src/pages/RiskPage.jsx — Risk Assessment & Risk Classification Module UI

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  getRiskDashboard,
  getDeviceRiskDetails,
  updateRiskAssessment,
  listRiskAssessments,
  createRiskAssessment,
  deleteRiskAssessment,
} from '../api/risk';
import { createDevice, deleteDevice } from '../api/devices';
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
  equipment_category: 'medical',
  process_risk: 1,
  patient_risk: 1,
  minimum_required: 1,
  equipment_count: 1,
  occurrence_value: 0,
  recommended_action: '',
  preventive_action: '',
  corrective_action: '',
  notes: '',
  // Optional: for Add form only — register a serial number immediately
  serial_number: '',
  department: '',
  model: '',
  manufacturer: '',
};

const EMPTY_REGISTER_UNIT_FORM = {
  serial_number: '',
  device_type: '',
  department: 'General',
  model: '',
  manufacturer: '',
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
  const [selectedCategory, setSelectedCategory] = useState('ALL');

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

  // ── Risk Classification Manager state ──
  const [allConfigs, setAllConfigs] = useState([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_EDIT_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // ── Register Physical Unit (Device Inventory) state ──
  const [showRegisterUnitModal, setShowRegisterUnitModal] = useState(false);
  const [registerUnitForm, setRegisterUnitForm] = useState(EMPTY_REGISTER_UNIT_FORM);
  const [registerUnitLoading, setRegisterUnitLoading] = useState(false);
  const [registerUnitError, setRegisterUnitError] = useState(null);
  const [registerUnitSuccess, setRegisterUnitSuccess] = useState(false);

  // ── Delete single registered physical unit state ──
  const [deleteUnitConfirmSerial, setDeleteUnitConfirmSerial] = useState(null);
  const [deleteUnitLoading, setDeleteUnitLoading] = useState(false);
  const [deleteUnitError, setDeleteUnitError] = useState(null);

  // ── Inline Config Edit state (edit directly from accordion, no need to open device) ──
  const [inlineEditConfig, setInlineEditConfig] = useState(null); // the config object being edited
  const [inlineEditForm, setInlineEditForm] = useState(EMPTY_EDIT_FORM);
  const [inlineSaveLoading, setInlineSaveLoading] = useState(false);
  const [inlineSaveError, setInlineSaveError] = useState(null);
  const [inlineSaveSuccess, setInlineSaveSuccess] = useState(false);
  // Live preview of calculated fields
  const [inlineCalcPreview, setInlineCalcPreview] = useState(null);

  // ── Accordion: which device-type groups are expanded ──
  const [expandedGroups, setExpandedGroups] = useState({});

  const isAdmin = isAdminUser();

  useEffect(() => {
    fetchDashboard();
    fetchAllConfigs();
  }, []);

  const fetchAllConfigs = async () => {
    setConfigsLoading(true);
    try {
      const data = await listRiskAssessments();
      setAllConfigs(data);
    } catch (err) {
      console.error('Failed to load risk configs:', err);
    } finally {
      setConfigsLoading(false);
    }
  };

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
    if (!allConfigs || allConfigs.length === 0) return;
    const headers = [
      'Device Type',
      'Arabic Name',
      'Category',
      'Process Risk',
      'Patient Risk',
      'Occurrence Value',
      'Equipment Count',
      'Min Required',
      'Probability of Occurrence',
      'Normalized Probability',
      'Equipment Risk Score',
      'Risk Percentage (%)',
      'Risk Class',
      'Preventive Action',
      'Corrective Action'
    ];

    const csvContent = [
      headers.join(','),
      ...allConfigs.map(c => [
        `"${c.device_type || ''}"`,
        `"${c.arabic_name || ''}"`,
        `"${c.equipment_category || 'medical'}"`,
        c.process_risk ?? '',
        c.patient_risk ?? '',
        c.occurrence_value ?? '',
        c.equipment_count ?? '',
        c.minimum_required ?? '',
        c.probability_occurrence ?? '',
        c.normalized_probability ?? '',
        c.equipment_risk ?? '',
        c.risk_percentage ?? '',
        `"${c.risk_class || ''}"`,
        `"${(c.preventive_action || '').replace(/"/g, '""')}"`,
        `"${(c.corrective_action || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Risk_Classification_Dataset_${new Date().toISOString().split('T')[0]}.csv`);
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
      const configs = await listRiskAssessments();
      const match = configs.find(
        (c) => c.device_type.trim().toLowerCase() === er.device_type.trim().toLowerCase() ||
               (c.arabic_name && er.arabic_name && c.arabic_name.trim() === er.arabic_name.trim())
      );
      if (match) {
        setEditConfigId(match.id);
        setEditForm({
          device_type: match.device_type,
          arabic_name: match.arabic_name || '',
          equipment_category: match.equipment_category || 'medical',
          process_risk: match.process_risk,
          patient_risk: match.patient_risk,
          minimum_required: match.minimum_required,
          equipment_count: match.equipment_count,
          occurrence_value: match.occurrence_value ?? 0,
          recommended_action: match.recommended_action || '',
          preventive_action: match.preventive_action || '',
          corrective_action: match.corrective_action || '',
          notes: match.notes || '',
        });
      } else {
        setEditConfigId(null);
        setEditForm({
          ...EMPTY_EDIT_FORM,
          device_type: er.device_type,
          arabic_name: er.arabic_name || '',
          equipment_category: er.equipment_category || 'medical',
          process_risk: er.process_risk,
          patient_risk: er.patient_risk,
          minimum_required: er.minimum_required,
          equipment_count: er.equipment_count,
          occurrence_value: er.occurrence_value ?? 0,
          recommended_action: er.recommended_action || '',
          preventive_action: er.preventive_action || '',
          corrective_action: er.corrective_action || ''
        });
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
        equipment_category: editForm.equipment_category || 'medical',
        process_risk: Number(editForm.process_risk),
        patient_risk: Number(editForm.patient_risk),
        minimum_required: Number(editForm.minimum_required),
        equipment_count: Number(editForm.equipment_count),
        occurrence_value: Number(editForm.occurrence_value || 0),
        recommended_action: editForm.recommended_action || null,
        preventive_action: editForm.preventive_action || null,
        corrective_action: editForm.corrective_action || null,
        notes: editForm.notes || null,
      });
      setSaveSuccess(true); setIsEditing(false);
      if (selectedDeviceSerial) {
        const details = await getDeviceRiskDetails(selectedDeviceSerial);
        setDeviceDetails(details);
      }
      fetchDashboard();
      fetchAllConfigs();
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError(err?.response?.data?.detail || 'Failed to save. Please try again.');
    } finally { setSaveLoading(false); }
  };

  // ── Add new device type handlers ──
  const handleAddFormChange = (field, value) => setAddForm((prev) => ({ ...prev, [field]: value }));

  const handleOpenAddForm = () => {
    setAddForm(EMPTY_EDIT_FORM);
    setAddError(null);
    setAddSuccess(false);
    setShowAddForm(true);
  };

  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setAddError(null);
    setAddSuccess(false);
  };

  const handleSubmitAdd = async () => {
    if (!addForm.device_type.trim()) { setAddError('Device type name is required.'); return; }
    setAddLoading(true); setAddError(null); setAddSuccess(false);
    try {
      let configCreated = false;
      try {
        await createRiskAssessment({
          device_type: addForm.device_type.trim(),
          arabic_name: addForm.arabic_name || null,
          equipment_category: addForm.equipment_category || 'medical',
          process_risk: Number(addForm.process_risk),
          patient_risk: Number(addForm.patient_risk),
          minimum_required: Number(addForm.minimum_required),
          equipment_count: Number(addForm.equipment_count),
          occurrence_value: Number(addForm.occurrence_value || 0),
          recommended_action: addForm.recommended_action || null,
          preventive_action: addForm.preventive_action || null,
          corrective_action: addForm.corrective_action || null,
          notes: addForm.notes || null,
        });
        configCreated = true;
      } catch (cfgErr) {
        if (cfgErr?.response?.status === 409 && addForm.serial_number && addForm.serial_number.trim()) {
          // Classification config already exists; proceed to register physical unit
          configCreated = true;
        } else {
          throw cfgErr;
        }
      }

      // Optionally register a physical device with the given serial number
      if (addForm.serial_number && addForm.serial_number.trim()) {
        try {
          await createDevice({
            serialNumber: addForm.serial_number.trim(),
            department: addForm.department || 'General',
            deviceType: addForm.device_type.trim(),
            model: addForm.model || null,
            manufacturer: addForm.manufacturer || null,
          });
        } catch (devErr) {
          console.warn('Could not register device serial:', devErr?.message);
          if (!configCreated) throw devErr;
        }
      }

      const targetType = addForm.device_type.trim();
      setExpandedGroups((prev) => ({ ...prev, [targetType]: true }));

      setAddSuccess(true);
      setShowAddForm(false);
      fetchAllConfigs();
      fetchDashboard();
    } catch (err) {
      console.error('Create failed:', err);
      setAddError(err?.response?.data?.detail || err?.message || 'Failed to add device type. It may already exist.');
    } finally { setAddLoading(false); }
  };

  // ── Register Physical Unit handlers ──
  const handleOpenRegisterUnit = (prefillType = '') => {
    setRegisterUnitForm({
      ...EMPTY_REGISTER_UNIT_FORM,
      device_type: prefillType || (allConfigs[0]?.device_type || ''),
    });
    setRegisterUnitError(null);
    setRegisterUnitSuccess(false);
    setShowRegisterUnitModal(true);
  };

  const handleCloseRegisterUnit = () => {
    setShowRegisterUnitModal(false);
    setRegisterUnitError(null);
    setRegisterUnitSuccess(false);
  };

  const handleSubmitRegisterUnit = async () => {
    if (!registerUnitForm.serial_number.trim()) {
      setRegisterUnitError('Serial number is required.');
      return;
    }
    if (!registerUnitForm.device_type.trim()) {
      setRegisterUnitError('Equipment type is required.');
      return;
    }
    setRegisterUnitLoading(true);
    setRegisterUnitError(null);
    setRegisterUnitSuccess(false);
    try {
      await createDevice({
        serialNumber: registerUnitForm.serial_number.trim(),
        department: registerUnitForm.department || 'General',
        deviceType: registerUnitForm.device_type.trim(),
        model: registerUnitForm.model || null,
        manufacturer: registerUnitForm.manufacturer || null,
      });

      // Expand the accordion group for this device type automatically so user sees it right away
      const targetType = registerUnitForm.device_type.trim();
      setExpandedGroups((prev) => ({ ...prev, [targetType]: true }));

      setRegisterUnitSuccess(true);
      setShowRegisterUnitModal(false);
      fetchDashboard();
      fetchAllConfigs();
    } catch (err) {
      console.error('Register unit failed:', err);
      setRegisterUnitError(err?.message || 'Failed to register unit. Serial number may already exist.');
    } finally {
      setRegisterUnitLoading(false);
    }
  };

  // ── Delete device type handlers (Instant Optimistic UI) ──
  const handleDeleteConfirm = (id) => { setDeleteConfirmId(id); setDeleteError(null); };
  const handleCancelDelete = () => { setDeleteConfirmId(null); setDeleteError(null); };

  const handleDeleteConfig = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;
    
    // 1. Instant Optimistic UI update: remove item and close modal immediately
    setDeleteConfirmId(null);
    setDeleteLoading(false);
    setAllConfigs((prev) => prev.filter((c) => c.id !== targetId));

    try {
      await deleteRiskAssessment(targetId);
      // Quiet background re-sync
      fetchAllConfigs();
      fetchDashboard();
    } catch (err) {
      console.error('Delete failed:', err);
      // If failed, reload to restore
      fetchAllConfigs();
      fetchDashboard();
    }
  };

  // ── Delete single registered unit handlers (Instant Optimistic UI) ──
  const handleDeleteUnitConfirm = (serialNumber) => {
    setDeleteUnitConfirmSerial(serialNumber);
    setDeleteUnitError(null);
  };

  const handleCancelDeleteUnit = () => {
    setDeleteUnitConfirmSerial(null);
    setDeleteUnitError(null);
  };

  const handleDeleteUnit = async () => {
    if (!deleteUnitConfirmSerial) return;
    const targetSerial = deleteUnitConfirmSerial;

    // 1. Instant Optimistic UI update: remove unit from state & close modal immediately
    setDeleteUnitConfirmSerial(null);
    setDeleteUnitLoading(false);
    if (selectedDeviceSerial === targetSerial) {
      handleCloseModal();
    }

    setDashboardData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        devices: (prev.devices || []).filter((d) => d.serial_number !== targetSerial),
      };
    });

    try {
      await deleteDevice(targetSerial);
      // Quiet background re-sync
      fetchDashboard();
      fetchAllConfigs();
    } catch (err) {
      console.error('Delete unit failed:', err);
      // Restore on failure
      fetchDashboard();
      fetchAllConfigs();
    }
  };

  // ── Inline Edit (accordion-level, no device modal needed) ──
  const handleOpenInlineEdit = (cfg, e) => {
    e.stopPropagation();
    setInlineEditConfig(cfg);
    setInlineEditForm({
      device_type: cfg.device_type,
      arabic_name: cfg.arabic_name || '',
      equipment_category: cfg.equipment_category || 'medical',
      process_risk: cfg.process_risk,
      patient_risk: cfg.patient_risk,
      minimum_required: cfg.minimum_required,
      equipment_count: cfg.equipment_count,
      occurrence_value: cfg.occurrence_value ?? 0,
      recommended_action: cfg.recommended_action || '',
      preventive_action: cfg.preventive_action || '',
      corrective_action: cfg.corrective_action || '',
      notes: cfg.notes || '',
    });
    setInlineSaveError(null);
    setInlineSaveSuccess(false);
    // Show live calculated preview from current config values
    setInlineCalcPreview({
      probability_occurrence: cfg.probability_occurrence,
      normalized_probability: cfg.normalized_probability,
      equipment_risk: cfg.equipment_risk,
      risk_percentage: cfg.risk_percentage,
      risk_class: cfg.risk_class,
    });
  };

  const handleCloseInlineEdit = () => {
    setInlineEditConfig(null);
    setInlineSaveError(null);
    setInlineSaveSuccess(false);
    setInlineCalcPreview(null);
  };

  const handleInlineFormChange = (field, value) => {
    setInlineEditForm((prev) => ({ ...prev, [field]: value }));
    // Do a client-side preview of the calculated fields when inputs change
    // (actual authoritative values are computed by backend on save)
    try {
      const cat = field === 'equipment_category' ? value : inlineEditForm.equipment_category;
      const occ = Number(field === 'occurrence_value' ? value : inlineEditForm.occurrence_value || 0);
      const cnt = Number(field === 'equipment_count' ? value : inlineEditForm.equipment_count || 1);
      const pr = Number(field === 'process_risk' ? value : inlineEditForm.process_risk || 1);
      const pat = Number(field === 'patient_risk' ? value : inlineEditForm.patient_risk || 1);
      if (cnt > 0) {
        const prob = occ / cnt;
        const normConst = cat === 'non_medical' ? 9 / 11.66666667 : 9 / 38.5;
        const normProb = prob * normConst;
        const riskScore = pr * pat * normProb;
        const maxDenom = cat === 'non_medical' ? 27.77142856 : 36.0;
        const riskPct = Math.min(100, (riskScore / maxDenom) * 100);
        let riskClass;
        if (cat === 'non_medical') {
          riskClass = riskPct <= 30 ? 'CLASS_1' : riskPct < 70 ? 'CLASS_2' : 'CLASS_3';
        } else {
          riskClass = riskPct <= 10 ? 'CLASS_1' : riskPct < 50 ? 'CLASS_2' : 'CLASS_3';
        }
        setInlineCalcPreview({
          probability_occurrence: Math.round(prob * 1e6) / 1e6,
          normalized_probability: Math.round(normProb * 1e6) / 1e6,
          equipment_risk: Math.round(riskScore * 1e6) / 1e6,
          risk_percentage: Math.round(riskPct * 1e4) / 1e4,
          risk_class: riskClass,
        });
      }
    } catch (_) {}
  };

  const handleSaveInlineEdit = async () => {
    if (!inlineEditConfig) return;
    setInlineSaveLoading(true); setInlineSaveError(null); setInlineSaveSuccess(false);
    try {
      await updateRiskAssessment(inlineEditConfig.id, {
        device_type: inlineEditForm.device_type,
        arabic_name: inlineEditForm.arabic_name || null,
        equipment_category: inlineEditForm.equipment_category || 'medical',
        process_risk: Number(inlineEditForm.process_risk),
        patient_risk: Number(inlineEditForm.patient_risk),
        minimum_required: Number(inlineEditForm.minimum_required),
        equipment_count: Number(inlineEditForm.equipment_count),
        occurrence_value: Number(inlineEditForm.occurrence_value || 0),
        recommended_action: inlineEditForm.recommended_action || null,
        preventive_action: inlineEditForm.preventive_action || null,
        corrective_action: inlineEditForm.corrective_action || null,
        notes: inlineEditForm.notes || null,
      });
      setInlineSaveSuccess(true);
      setInlineEditConfig(null);
      fetchAllConfigs();
      fetchDashboard();
    } catch (err) {
      console.error('Inline save failed:', err);
      setInlineSaveError(err?.response?.data?.detail || 'Failed to save. Please try again.');
    } finally { setInlineSaveLoading(false); }
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

  if (loading && !dashboardData) {
    return (
      <div className="risk-page" style={{ textAlign: 'center', padding: '60px' }}>
        <h3>Loading Risk Assessment Module...</h3>
      </div>
    );
  }

  if (error && !dashboardData) {
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

  const { overall_stats, risk_distribution, calibration_risk_distribution, devices = [] } = dashboardData || {};

  // Group physical inventory devices by device_type
  const physicalDevicesByType = {};
  devices.forEach((d) => {
    const key = (d.device_type || 'Unknown').trim().toLowerCase();
    if (!physicalDevicesByType[key]) physicalDevicesByType[key] = [];
    physicalDevicesByType[key].push(d);
  });

  // Create unified map of all items (configs + physical types)
  const unifiedTypesMap = {};

  allConfigs.forEach((cfg) => {
    const key = cfg.device_type.trim().toLowerCase();
    const physDevs = physicalDevicesByType[key] || [];
    unifiedTypesMap[key] = {
      typeName: cfg.device_type,
      arabicName: cfg.arabic_name,
      config: cfg,
      category: cfg.equipment_category || 'medical',
      riskClass: cfg.risk_class || 'CLASS_1',
      riskPercentage: cfg.risk_percentage ?? 0,
      riskScore: cfg.equipment_risk ?? 0,
      probOcc: cfg.probability_occurrence ?? 0,
      devices: physDevs,
    };
  });

  // Also include any physical devices whose type might not be in allConfigs yet
  Object.keys(physicalDevicesByType).forEach((key) => {
    if (!unifiedTypesMap[key]) {
      const physDevs = physicalDevicesByType[key];
      const sample = physDevs[0];
      unifiedTypesMap[key] = {
        typeName: sample.device_type,
        arabicName: '',
        config: null,
        category: 'medical',
        riskClass: sample.risk_class || 'CLASS_1',
        riskPercentage: sample.risk_percentage ?? 0,
        riskScore: sample.equipment_risk ?? 0,
        probOcc: sample.probability_occurrence ?? 0,
        devices: physDevs,
      };
    }
  });

  // Calculate counts for category tabs
  const allEntries = Object.values(unifiedTypesMap);
  const totalClassificationsCount = allEntries.length;
  const medicalCount = allEntries.filter(e => e.category === 'medical').length;
  const nonMedicalCount = allEntries.filter(e => e.category === 'non_medical').length;

  // Filter unified items
  const filteredEntries = allEntries.filter((item) => {
    // Category filter
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

    // Risk Class filter
    if (selectedRiskClass !== 'ALL' && item.riskClass !== selectedRiskClass) return false;

    // Calibration Risk filter
    if (selectedCalRisk !== 'ALL') {
      const hasMatchingCalRisk = item.devices.some(d => d.calibration_risk_level === selectedCalRisk);
      if (!hasMatchingCalRisk && item.devices.length > 0) return false;
    }

    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      const qNoZero = q.replace(/^0+/, '');
      const matchType = item.typeName && item.typeName.toLowerCase().includes(q);
      const matchArabic = item.arabicName && item.arabicName.toLowerCase().includes(q);
      const matchSerial = item.devices.some(d => {
        const sn = (d.serial_number || '').toLowerCase();
        return sn.includes(q) || (qNoZero && sn.includes(qNoZero));
      });
      const matchDept = item.devices.some(d => d.department && d.department.toLowerCase().includes(q));
      if (!matchType && !matchArabic && !matchSerial && !matchDept) return false;
    }

    return true;
  });

  // Sort by Type Name
  filteredEntries.sort((a, b) => a.typeName.localeCompare(b.typeName));

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="risk-page">
      {/* ── Page Title Row with Add Actions ── */}
      <div className="risk-page-title-row">
        <h2 className="risk-page-main-title">
          <span className="risk-title-icon"><ShieldIcon /></span> Medical &amp; Non-Medical Risk Assessment &amp; Classification
        </h2>
        {isAdmin && (
          <div className="risk-title-actions">
            <button
              className="btn-register-unit-top"
              onClick={() => handleOpenRegisterUnit('')}
              id="btn-open-register-unit"
              title="Register a physical machine with a Serial Number into hospital inventory"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Register Unit (Serial No.)
            </button>
            <button
              className="btn-add-device-type"
              onClick={handleOpenAddForm}
              id="btn-add-device-type"
              title="Define a new equipment category with its Excel risk criteria"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Equipment Classification Type
            </button>
          </div>
        )}
      </div>

      {/* ── Category Pill Tabs & Quick Stats ── */}
      <div className="risk-top-dashboard-row">
        <div className="risk-category-tabs">
          <button
            className={`risk-cat-tab-btn ${selectedCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            All Classifications <span className="risk-cat-tab-count">{totalClassificationsCount}</span>
          </button>
          <button
            className={`risk-cat-tab-btn ${selectedCategory === 'medical' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('medical')}
          >
            Medical Equipment <span className="risk-cat-tab-count">{medicalCount}</span>
          </button>
          <button
            className={`risk-cat-tab-btn ${selectedCategory === 'non_medical' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('non_medical')}
          >
            Non-Medical Equipment <span className="risk-cat-tab-count">{nonMedicalCount}</span>
          </button>
        </div>
      </div>

      {/* Distribution Charts */}
      {risk_distribution && calibration_risk_distribution && (
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
      )}

      {/* ── Grouped Accordion Device Table ── */}
      <div className="risk-table-section">
        <div className="risk-table-controls">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search type name, arabic, serial..."
              className="risk-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ minWidth: '240px' }}
            />
            <select className="risk-select-filter" value={selectedRiskClass} onChange={(e) => setSelectedRiskClass(e.target.value)}>
              <option value="ALL">All Risk Classes</option>
              <option value="CLASS_1">Class 1 (Low Risk)</option>
              <option value="CLASS_2">Class 2 (Medium Risk)</option>
              <option value="CLASS_3">Class 3 (High Criticality)</option>
            </select>
            <select className="risk-select-filter" value={selectedCalRisk} onChange={(e) => setSelectedCalRisk(e.target.value)}>
              <option value="ALL">All Calibration Risk Levels</option>
              <option value="LOW">LOW Calibration Risk</option>
              <option value="MEDIUM">MEDIUM Calibration Risk</option>
              <option value="HIGH">HIGH Calibration Risk</option>
            </select>
          </div>
          <div className="table-controls-right">
            <button className="btn-export-csv" onClick={handleExportCSV} title="Export full classification dataset to CSV">
              <DownloadIcon /> Export Dataset CSV
            </button>
            <div className="table-count-label">
              Showing <strong>{filteredEntries.length}</strong> of {totalClassificationsCount} equipment types
            </div>
          </div>
        </div>

        {/* Accordion groups */}
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
            {configsLoading ? 'Loading classifications...' : 'No equipment classifications match the selected filters.'}
          </div>
        ) : (
          <div className="accordion-list">
            {filteredEntries.map((item) => {
              const { typeName, arabicName, config: cfg, category, riskClass, riskPercentage, riskScore, probOcc, devices: groupDevices } = item;
              const isOpen = !!expandedGroups[typeName];
              const isNonMedical = category === 'non_medical';
              const highestCalRisk = groupDevices.some(d => d.calibration_risk_level === 'HIGH') ? 'HIGH'
                : groupDevices.some(d => d.calibration_risk_level === 'MEDIUM') ? 'MEDIUM'
                : groupDevices.length > 0 ? 'LOW' : null;

              return (
                <div key={typeName} className={`accordion-group${isOpen ? ' accordion-open' : ''}`}>
                  {/* Group Header — clickable to expand */}
                  <div
                    className="accordion-header"
                    onClick={() => toggleGroup(typeName)}
                    role="button"
                    aria-expanded={isOpen}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggleGroup(typeName)}
                  >
                    <div className="accordion-header-left">
                      <span className={`accordion-chevron${isOpen ? ' rotated' : ''}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </span>
                      <span className="accordion-type-name">
                        {typeName} {arabicName && arabicName !== typeName ? <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'normal' }}>({arabicName})</span> : ''}
                      </span>
                      <span
                        className="accordion-cat-chip"
                        style={{
                          background: isNonMedical ? '#fef3c7' : '#e0e7ff',
                          color: isNonMedical ? '#92400e' : '#3730a3',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                      >
                        {isNonMedical ? 'Non-Medical' : 'Medical'}
                      </span>
                      <span className="accordion-count-chip">
                        {groupDevices.length} registered unit{groupDevices.length !== 1 ? 's' : ''}
                      </span>
                      <span className={`badge-${riskClass.toLowerCase()}`} style={{ fontSize: '0.72rem' }}>
                        {riskClass.replace('_', ' ')} ({riskPercentage}%)
                      </span>
                      {highestCalRisk && (
                        <span className={`badge-cal-${highestCalRisk.toLowerCase()}`} style={{ fontSize: '0.72rem' }}>
                          Cal: {highestCalRisk}
                        </span>
                      )}
                    </div>
                    <div className="accordion-header-right" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && cfg && (
                        <>
                          <button
                            className="btn-edit-inline"
                            onClick={(e) => handleOpenInlineEdit(cfg, e)}
                            title={`Edit ${typeName} classification`}
                          >
                            <EditIcon /> Edit
                          </button>
                          <button
                            className="btn-remove-device-type"
                            onClick={() => handleDeleteConfirm(cfg.id)}
                            title={`Remove ${typeName} from risk classification`}
                            id={`btn-remove-cfg-${cfg.id}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="accordion-body">
                      {/* Classification Metrics Summary Card */}
                      {cfg && (
                        <div className="classification-summary-box">
                          <div className="summary-box-header">
                            <div className="summary-box-header-title">
                              <strong>Risk Formula &amp; Parameters</strong>
                              <span className="formula-type-tag">
                                {isNonMedical ? 'Non-Medical Sheet (Max: 27.77)' : 'Medical Sheet (Max: 36.0)'}
                              </span>
                            </div>
                            {isAdmin && (
                              <button
                                className="btn-edit-inline-sm"
                                onClick={(e) => handleOpenInlineEdit(cfg, e)}
                                title="Edit editable parameters"
                              >
                                <EditIcon /> Edit Parameters
                              </button>
                            )}
                          </div>

                          {/* Group 1: Configurable Input Parameters */}
                          <div className="summary-subgroup">
                            <div className="summary-subgroup-title">
                              <span>Input Parameters (المعايير الأساسية المدخلة)</span>
                              <span className="subgroup-badge input-badge">Editable</span>
                            </div>
                            <div className="classification-summary-grid">
                              <div className="summary-stat-item">
                                <span className="summary-stat-label">Process Impact Risk</span>
                                <span className="summary-stat-value">{cfg.process_risk} <span className="val-denom">/ 3</span></span>
                                <span className="stat-hint">Impact on clinical/hospital process</span>
                              </div>
                              <div className="summary-stat-item">
                                <span className="summary-stat-label">Patient Impact Risk</span>
                                <span className="summary-stat-value">{cfg.patient_risk} <span className="val-denom">/ 3</span></span>
                                <span className="stat-hint">Impact on direct patient safety</span>
                              </div>
                              <div className="summary-stat-item">
                                <span className="summary-stat-label">Occurrence Value</span>
                                <span className="summary-stat-value">{cfg.occurrence_value ?? 0}</span>
                                <span className="stat-hint">Failure/breakdown occurrence count</span>
                              </div>
                              <div className="summary-stat-item">
                                <span className="summary-stat-label">Equipment Count / Min Req</span>
                                <span className="summary-stat-value">{cfg.equipment_count} <span className="val-denom">/ {cfg.minimum_required}</span></span>
                                <span className="stat-hint">Available count vs minimum required</span>
                              </div>
                            </div>
                          </div>

                          {/* Group 2: Calculated Logic Output Metrics */}
                          <div className="summary-subgroup">
                            <div className="summary-subgroup-title">
                              <span>Calculated Formula Results (النتائج المحسوبة بالمعادلات)</span>
                              <span className="subgroup-badge calc-badge">Auto-Calculated by Backend</span>
                            </div>
                            <div className="classification-summary-grid">
                              <div className="summary-stat-item summary-stat-calculated">
                                <span className="summary-stat-label">Probability of Occurrence</span>
                                <span className="summary-stat-value calc-val">{cfg.probability_occurrence ?? '—'}</span>
                                <span className="stat-hint">Occurrence ÷ Available Count</span>
                              </div>
                              <div className="summary-stat-item summary-stat-calculated">
                                <span className="summary-stat-label">Normalized Probability</span>
                                <span className="summary-stat-value calc-val">{cfg.normalized_probability ?? '—'}</span>
                                <span className="stat-hint">Prob × (9 ÷ Normalization Const)</span>
                              </div>
                              <div className="summary-stat-item summary-stat-calculated">
                                <span className="summary-stat-label">Equipment Risk Score</span>
                                <span className="summary-stat-value calc-val">{cfg.equipment_risk ?? '—'}</span>
                                <span className="stat-hint">Process × Patient × Norm Prob</span>
                              </div>
                              <div className="summary-stat-item summary-stat-calculated">
                                <span className="summary-stat-label">Risk Percentage &amp; Class</span>
                                <span className="summary-stat-value" style={{ color: riskClass === 'CLASS_3' ? '#dc2626' : riskClass === 'CLASS_2' ? '#d97706' : '#16a34a' }}>
                                  {cfg.risk_percentage}% ({riskClass.replace('_', ' ')})
                                </span>
                                <span className="stat-hint">(Score ÷ Formula Max) × 100%</span>
                              </div>
                            </div>
                          </div>

                          {(cfg.preventive_action || cfg.corrective_action) && (
                            <div className="summary-actions-block">
                              {cfg.preventive_action && (
                                <div className="action-row">
                                  <strong className="action-tag prev-tag">Preventive Action (الإجراء الوقائي):</strong>
                                  <span>{cfg.preventive_action}</span>
                                </div>
                              )}
                              {cfg.corrective_action && (
                                <div className="action-row" style={{ marginTop: '6px' }}>
                                  <strong className="action-tag corr-tag">Corrective Action (الإجراء التصحيحي):</strong>
                                  <span>{cfg.corrective_action}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Physical inventory devices table */}
                      <div className="accordion-inventory-header">
                        <div className="inventory-header-left">
                          <strong>Registered Physical Inventory Units</strong>
                          <span className="inventory-count-tag">{groupDevices.length} unit{groupDevices.length !== 1 ? 's' : ''}</span>
                        </div>
                        {isAdmin && (
                          <button
                            className="btn-add-unit-sm"
                            onClick={() => handleOpenRegisterUnit(typeName)}
                            title={`Register a new physical unit for ${typeName}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Register Unit for {typeName}
                          </button>
                        )}
                      </div>

                      {groupDevices.length > 0 ? (
                        <table className="accordion-devices-table">
                          <thead>
                            <tr>
                              <th>Serial Number</th>
                              <th>Department</th>
                              <th>Model</th>
                              <th>Prob. Occurrence</th>
                              <th>Risk Score</th>
                              <th>Risk %</th>
                              <th>Cal Failure Rate</th>
                              <th>Cal Risk</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupDevices.map((d) => (
                              <tr key={d.id}>
                                <td>
                                  <strong
                                    className="serial-link"
                                    onClick={() => handleOpenDeviceDetails(d.serial_number)}
                                    title="View device risk details"
                                  >
                                    {d.serial_number}
                                  </strong>
                                </td>
                                <td>{d.department || '—'}</td>
                                <td>{d.model || '—'}</td>
                                <td><strong>{d.probability_occurrence !== null && d.probability_occurrence !== undefined ? d.probability_occurrence : '—'}</strong></td>
                                <td>{d.equipment_risk !== null && d.equipment_risk !== undefined ? d.equipment_risk : '—'}</td>
                                <td>{d.risk_percentage}%</td>
                                <td>{d.calibration_failure_rate !== null ? `${d.calibration_failure_rate}%` : 'N/A'}</td>
                                <td>
                                  <span className={`badge-cal-${d.calibration_risk_level.toLowerCase()}`}>
                                    {d.calibration_risk_level}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button className="btn-view-details" onClick={() => handleOpenDeviceDetails(d.serial_number)}>
                                      Risk Details
                                    </button>
                                    {isAdmin && (
                                      <button
                                        className="btn-delete-unit"
                                        onClick={() => handleDeleteUnitConfirm(d.serial_number)}
                                        title={`Delete registered unit ${d.serial_number}`}
                                        id={`btn-delete-unit-${d.serial_number}`}
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '0 0 8px 8px', border: '1px solid #e2e8f0', borderTop: 'none', color: '#64748b', fontSize: '0.88rem' }}>
                          <span>No physical serialized units registered in hospital inventory for this equipment type yet.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Register Physical Unit Modal ── */}
      {showRegisterUnitModal && (
        <div className="modal-overlay" onClick={handleCloseRegisterUnit}>
          <div className="risk-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Physical Unit in Inventory</h2>
              <button className="btn-close-modal" onClick={handleCloseRegisterUnit}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="edit-risk-form">
                {registerUnitError && <div className="edit-form-error">{registerUnitError}</div>}
                {registerUnitSuccess && <div className="edit-form-success">Device unit registered successfully!</div>}

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px', fontSize: '0.84rem', color: '#1e40af', lineHeight: 1.5 }}>
                   <strong>Register a Physical Machine:</strong> Enter the unit's serial number and department to link it to its equipment risk classification. It will immediately appear in your dashboard.
                </div>

                <div className="edit-section-title">Unit Identification (English)</div>
                <div className="edit-grid">
                  <div className="edit-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Serial Number <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={registerUnitForm.serial_number}
                      onChange={(e) => setRegisterUnitForm(prev => ({ ...prev, serial_number: e.target.value }))}
                      placeholder="e.g. SN-2024-001 or PHIL-DEF-09"
                      autoFocus
                    />
                  </div>
                  <div className="edit-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Equipment Type <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={registerUnitForm.device_type}
                      onChange={(e) => setRegisterUnitForm(prev => ({ ...prev, device_type: e.target.value }))}
                    >
                      <option value="">-- Select Equipment Type --</option>
                      {Array.from(new Set(allConfigs.map(c => c.device_type).filter(Boolean)))
                        .sort((a, b) => a.localeCompare(b))
                        .map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <small className="field-hint">Select the English equipment type to link this unit.</small>
                  </div>
                  <div className="edit-field">
                    <label>Department</label>
                    <input
                      type="text"
                      value={registerUnitForm.department}
                      onChange={(e) => setRegisterUnitForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="e.g. ICU, Emergency, Radiology, General"
                    />
                  </div>
                  <div className="edit-field">
                    <label>Manufacturer</label>
                    <input
                      type="text"
                      value={registerUnitForm.manufacturer}
                      onChange={(e) => setRegisterUnitForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                      placeholder="e.g. Philips, GE Healthcare, Siemens, Mindray"
                    />
                  </div>
                  <div className="edit-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Model</label>
                    <input
                      type="text"
                      value={registerUnitForm.model}
                      onChange={(e) => setRegisterUnitForm(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="e.g. HeartStart XL, IntelliVue MX700"
                    />
                  </div>
                </div>

                <div className="edit-form-actions">
                  <button className="btn-cancel-edit" onClick={handleCloseRegisterUnit} disabled={registerUnitLoading}>Cancel</button>
                  <button className="btn-save-edit" onClick={handleSubmitRegisterUnit} disabled={registerUnitLoading} id="btn-submit-register-unit">
                    {registerUnitLoading ? 'Registering...' : 'Register Unit in Inventory'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add New Device Type Modal ── */}
      {showAddForm && (
        <div className="modal-overlay" onClick={handleCloseAddForm}>
          <div className="risk-modal risk-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Device Type Classification</h2>
              <button className="btn-close-modal" onClick={handleCloseAddForm}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="edit-risk-form">
                {addError && <div className="edit-form-error">{addError}</div>}

                {/* Risk Scoring Guide */}
                <div className="risk-scoring-guide-box">
                  <div className="guide-box-header">
                    <span><strong>Risk Criteria Guide (دليل معايير التقييم الإكسيل):</strong></span>
                  </div>
                  <div className="guide-box-content">
                    <div className="guide-col">
                      <strong>Medical Equipment (Sheet: medical):</strong>
                      <ul>
                        <li><strong>Probability:</strong> Occurrence / Number of Equipment</li>
                        <li><strong>Norm. Prob:</strong> Probability × (9 / 38.5)</li>
                        <li><strong>Risk %:</strong> (Process × Patient × Norm Prob / 36) × 100</li>
                        <li><strong>Thresholds:</strong> ≤10% (Class 1) | &lt;50% (Class 2) | ≥50% (Class 3)</li>
                      </ul>
                    </div>
                    <div className="guide-col">
                      <strong>Non-Medical Equipment (Sheet: non medical):</strong>
                      <ul>
                        <li><strong>Probability:</strong> Occurrence / Number of Equipment</li>
                        <li><strong>Norm. Prob:</strong> Probability × (9 / 11.66666667)</li>
                        <li><strong>Risk %:</strong> (Process × Patient × Norm Prob / 27.77142856) × 100</li>
                        <li><strong>Thresholds:</strong> ≤30% (Class 1) | &lt;70% (Class 2) | ≥70% (Class 3)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="edit-section-title">Device Identification &amp; Category</div>
                <div className="edit-grid">
                  <div className="edit-field">
                    <label>Device Type Name (English) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      id="add-device-type-name"
                      value={addForm.device_type}
                      onChange={(e) => handleAddFormChange('device_type', e.target.value)}
                      placeholder="e.g. Defibrillator or Split AC Units"
                      autoFocus
                    />
                  </div>
                  <div className="edit-field">
                    <label>Arabic Name (الاسم بالعربي)</label>
                    <input
                      type="text"
                      value={addForm.arabic_name}
                      onChange={(e) => handleAddFormChange('arabic_name', e.target.value)}
                      placeholder="e.g. جهاز صدمات كهربائي"
                    />
                  </div>
                  <div className="edit-field">
                    <label>Equipment Category (تصنيف الجهاز) <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={addForm.equipment_category}
                      onChange={(e) => handleAddFormChange('equipment_category', e.target.value)}
                    >
                      <option value="medical">Medical Equipment (طبي — Max: 36, Thresholds: 10%/50%)</option>
                      <option value="non_medical">Non-Medical Equipment (غير طبي — Max: 27.77, Thresholds: 30%/70%)</option>
                    </select>
                  </div>
                </div>

                <div className="edit-section-title">Risk Factors &amp; Occurrence</div>
                <div className="edit-grid">
                  <div className="edit-field">
                    <label>Process Impact Risk (تأثير تعطل العملية)</label>
                    <select value={addForm.process_risk} onChange={(e) => handleAddFormChange('process_risk', e.target.value)}>
                      <option value={1}>1 — Low: Minor impact (لا يؤثر على سير العمل أو توجد بدائل)</option>
                      <option value={2}>2 — Medium: Partial service delay (تعطيل جزئي أو تأخير)</option>
                      <option value={3}>3 — High: Complete process halt (توقف كامل للعمليات الحيوية)</option>
                    </select>
                  </div>
                  <div className="edit-field">
                    <label>Patient Impact Risk (تأثير سلامة المريض)</label>
                    <select value={addForm.patient_risk} onChange={(e) => handleAddFormChange('patient_risk', e.target.value)}>
                      <option value={1}>1 — Low: No direct patient injury (لا خطر مباشر على المريض)</option>
                      <option value={2}>2 — Medium: Indirect risk / diagnostic delay (خطر غير مباشر أو تأخير تشخيص)</option>
                      <option value={3}>3 — High: Direct life hazard (خطر مباشر يهدد الحياة كأجهزة الإنعاش)</option>
                    </select>
                  </div>
                  <div className="edit-field">
                    <label>Occurrence Value (قيمة التكرار من الإكسيل)</label>
                    <input type="number" min="0" step="any" value={addForm.occurrence_value}
                      onChange={(e) => handleAddFormChange('occurrence_value', e.target.value)} />
                    <small className="field-hint">Occurrence count (J in Medical, I in Non-Medical)</small>
                  </div>
                  <div className="edit-field">
                    <label>Equipment Count (العدد الموجود) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="number" min="1" value={addForm.equipment_count}
                      onChange={(e) => handleAddFormChange('equipment_count', e.target.value)} />
                  </div>
                  <div className="edit-field">
                    <label>Minimum Required (العدد المطلوب)</label>
                    <input type="number" min="1" value={addForm.minimum_required}
                      onChange={(e) => handleAddFormChange('minimum_required', e.target.value)} />
                  </div>
                </div>

                <div className="edit-section-title">Maintenance Actions</div>
                <div className="edit-grid-full">
                  <div className="edit-field">
                    <label>Recommended Action</label>
                    <textarea rows={2} value={addForm.recommended_action}
                      onChange={(e) => handleAddFormChange('recommended_action', e.target.value)}
                      placeholder="General recommended action..." />
                  </div>
                  <div className="edit-field">
                    <label>Preventive Action (الإجراء الوقائي)</label>
                    <textarea rows={2} value={addForm.preventive_action}
                      onChange={(e) => handleAddFormChange('preventive_action', e.target.value)}
                      placeholder="e.g. availability of spare device & Increase preventive maintenace rate..." />
                  </div>
                  <div className="edit-field">
                    <label>Corrective Action (الإجراء التصحيحي)</label>
                    <textarea rows={2} value={addForm.corrective_action}
                      onChange={(e) => handleAddFormChange('corrective_action', e.target.value)}
                      placeholder="e.g. repair or acquisition of new device / notify concerned departments..." />
                  </div>
                  <div className="edit-field">
                    <label>Notes</label>
                    <textarea rows={2} value={addForm.notes}
                      onChange={(e) => handleAddFormChange('notes', e.target.value)}
                      placeholder="Additional notes..." />
                  </div>
                </div>
                <div className="edit-section-title">📋 Optional: Register a Physical Device (Serial Number)</div>
                <div className="edit-grid">
                  <div className="edit-field">
                    <label>Serial Number (الرقم التسلسلي)</label>
                    <input
                      type="text"
                      value={addForm.serial_number}
                      onChange={(e) => handleAddFormChange('serial_number', e.target.value)}
                      placeholder="e.g. SN-2024-001 (leave empty if no device yet)"
                    />
                    <small className="field-hint">If you have a serial number, fill it to register the device in hospital inventory immediately.</small>
                  </div>
                  <div className="edit-field">
                    <label>Department (القسم)</label>
                    <input
                      type="text"
                      value={addForm.department}
                      onChange={(e) => handleAddFormChange('department', e.target.value)}
                      placeholder="e.g. ICU, Radiology, General"
                    />
                  </div>
                  <div className="edit-field">
                    <label>Manufacturer (الشركة المصنعة)</label>
                    <input
                      type="text"
                      value={addForm.manufacturer}
                      onChange={(e) => handleAddFormChange('manufacturer', e.target.value)}
                      placeholder="e.g. Philips, GE, Siemens"
                    />
                  </div>
                  <div className="edit-field">
                    <label>Model (الموديل)</label>
                    <input
                      type="text"
                      value={addForm.model}
                      onChange={(e) => handleAddFormChange('model', e.target.value)}
                      placeholder="e.g. MX700, Vivid E95"
                    />
                  </div>
                </div>

                <div className="edit-form-actions">
                  <button className="btn-cancel-edit" onClick={handleCloseAddForm} disabled={addLoading}>Cancel</button>
                  <button className="btn-save-edit" onClick={handleSubmitAdd} disabled={addLoading} id="btn-submit-add-device">
                    {addLoading ? 'Adding...' : 'Add Device Type'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal (Device Type Config) ── */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <h3>Remove Device Type?</h3>
            <p>
              Are you sure you want to remove the risk classification config for{' '}
              <strong>{allConfigs.find(c => c.id === deleteConfirmId)?.device_type}</strong>?
              <br />This action cannot be undone.
            </p>
            {deleteError && <div className="edit-form-error" style={{ marginTop: '10px' }}>{deleteError}</div>}
            <div className="delete-confirm-actions">
              <button className="btn-cancel-edit" onClick={handleCancelDelete} disabled={deleteLoading}>Cancel</button>
              <button className="btn-delete-confirm" onClick={handleDeleteConfig} disabled={deleteLoading} id="btn-confirm-delete">
                {deleteLoading ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Unit Confirmation Modal (Physical Registered Device) ── */}
      {deleteUnitConfirmSerial && (
        <div className="modal-overlay" onClick={handleCancelDeleteUnit}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <h3>Delete Registered Unit?</h3>
            <p>
              Are you sure you want to delete unit serial{' '}
              <strong>{deleteUnitConfirmSerial}</strong> from inventory?
              <br />This will also delete its calibration records. This action cannot be undone.
            </p>
            {deleteUnitError && <div className="edit-form-error" style={{ marginTop: '10px' }}>{deleteUnitError}</div>}
            <div className="delete-confirm-actions">
              <button className="btn-cancel-edit" onClick={handleCancelDeleteUnit} disabled={deleteUnitLoading}>Cancel</button>
              <button className="btn-delete-confirm" onClick={handleDeleteUnit} disabled={deleteUnitLoading} id="btn-confirm-delete-unit">
                {deleteUnitLoading ? 'Deleting...' : 'Yes, Delete Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Edit Config Modal ── */}
      {inlineEditConfig && (
        <div className="modal-overlay" onClick={handleCloseInlineEdit}>
          <div className="risk-modal risk-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Classification — {inlineEditConfig.device_type}</h2>
              <button className="btn-close-modal" onClick={handleCloseInlineEdit}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="edit-risk-form">
                {inlineSaveError && <div className="edit-form-error">{inlineSaveError}</div>}
                {inlineSaveSuccess && <div className="edit-form-success">Configuration updated successfully!</div>}

                {/* Calculated fields — read-only live preview */}
                {inlineCalcPreview && (
                  <div className="calculated-preview-box">
                    <div className="calculated-preview-title">🔒 Calculated Fields (auto-computed by backend — read-only)</div>
                    <div className="calculated-preview-grid">
                      <div className="calc-preview-item">
                        <span className="calc-label">Probability of Occurrence</span>
                        <span className="calc-value">{inlineCalcPreview.probability_occurrence}</span>
                      </div>
                      <div className="calc-preview-item">
                        <span className="calc-label">Normalized Probability</span>
                        <span className="calc-value">{inlineCalcPreview.normalized_probability}</span>
                      </div>
                      <div className="calc-preview-item">
                        <span className="calc-label">Equipment Risk Score</span>
                        <span className="calc-value">{inlineCalcPreview.equipment_risk}</span>
                      </div>
                      <div className="calc-preview-item">
                        <span className="calc-label">Risk Percentage</span>
                        <span className="calc-value" style={{ color: inlineCalcPreview.risk_class === 'CLASS_3' ? '#dc2626' : inlineCalcPreview.risk_class === 'CLASS_2' ? '#d97706' : '#16a34a', fontWeight: 700 }}>
                          {inlineCalcPreview.risk_percentage}%
                        </span>
                      </div>
                      <div className="calc-preview-item">
                        <span className="calc-label">Risk Class</span>
                        <span className={`badge-${inlineCalcPreview.risk_class.toLowerCase()}`} style={{ fontSize: '0.78rem' }}>
                          {inlineCalcPreview.risk_class.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <small style={{ color: '#94a3b8', display: 'block', marginTop: '6px' }}>These values update as you change the fields below. Final values are computed by the server on save.</small>
                  </div>
                )}

                <div className="edit-section-title">Device Identification &amp; Category</div>
                <div className="edit-grid">
                  <div className="edit-field">
                    <label>Device Type Name (English)</label>
                    <input
                      type="text"
                      value={inlineEditForm.device_type}
                      onChange={(e) => handleInlineFormChange('device_type', e.target.value)}
                    />
                  </div>
                  <div className="edit-field">
                    <label>Arabic Name (الاسم بالعربي)</label>
                    <input
                      type="text"
                      value={inlineEditForm.arabic_name}
                      onChange={(e) => handleInlineFormChange('arabic_name', e.target.value)}
                      placeholder="e.g. جهاز صدمات كهربائي"
                    />
                  </div>
                  <div className="edit-field">
                    <label>Equipment Category (تصنيف الجهاز)</label>
                    <select
                      value={inlineEditForm.equipment_category}
                      onChange={(e) => handleInlineFormChange('equipment_category', e.target.value)}
                    >
                      <option value="medical">Medical Equipment (طبي — Max: 36, Thresholds: 10%/50%)</option>
                      <option value="non_medical">Non-Medical Equipment (غير طبي — Max: 27.77, Thresholds: 30%/70%)</option>
                    </select>
                  </div>
                </div>

                <div className="edit-section-title">Risk Factors &amp; Occurrence</div>
                <div className="edit-grid">
                  <div className="edit-field">
                    <label>Process Impact Risk (تأثير تعطل العملية)</label>
                    <select value={inlineEditForm.process_risk} onChange={(e) => handleInlineFormChange('process_risk', e.target.value)}>
                      <option value={1}>1 — Low: Minor impact</option>
                      <option value={2}>2 — Medium: Partial service delay</option>
                      <option value={3}>3 — High: Complete process halt</option>
                    </select>
                  </div>
                  <div className="edit-field">
                    <label>Patient Impact Risk (تأثير سلامة المريض)</label>
                    <select value={inlineEditForm.patient_risk} onChange={(e) => handleInlineFormChange('patient_risk', e.target.value)}>
                      <option value={1}>1 — Low: No direct patient injury</option>
                      <option value={2}>2 — Medium: Indirect risk / diagnostic delay</option>
                      <option value={3}>3 — High: Direct life hazard</option>
                    </select>
                  </div>
                  <div className="edit-field">
                    <label>Occurrence Value (قيمة التكرار)</label>
                    <input type="number" min="0" step="any" value={inlineEditForm.occurrence_value}
                      onChange={(e) => handleInlineFormChange('occurrence_value', e.target.value)} />
                  </div>
                  <div className="edit-field">
                    <label>Equipment Count (العدد الموجود)</label>
                    <input type="number" min="1" value={inlineEditForm.equipment_count}
                      onChange={(e) => handleInlineFormChange('equipment_count', e.target.value)} />
                  </div>
                  <div className="edit-field">
                    <label>Minimum Required (العدد المطلوب)</label>
                    <input type="number" min="1" value={inlineEditForm.minimum_required}
                      onChange={(e) => handleInlineFormChange('minimum_required', e.target.value)} />
                  </div>
                </div>

                <div className="edit-section-title">Maintenance Actions</div>
                <div className="edit-grid-full">
                  <div className="edit-field">
                    <label>Recommended Action</label>
                    <textarea rows={2} value={inlineEditForm.recommended_action}
                      onChange={(e) => handleInlineFormChange('recommended_action', e.target.value)}
                      placeholder="General recommended action..." />
                  </div>
                  <div className="edit-field">
                    <label>Preventive Action (الإجراء الوقائي)</label>
                    <textarea rows={2} value={inlineEditForm.preventive_action}
                      onChange={(e) => handleInlineFormChange('preventive_action', e.target.value)}
                      placeholder="Preventive maintenance steps..." />
                  </div>
                  <div className="edit-field">
                    <label>Corrective Action (الإجراء التصحيحي)</label>
                    <textarea rows={2} value={inlineEditForm.corrective_action}
                      onChange={(e) => handleInlineFormChange('corrective_action', e.target.value)}
                      placeholder="Steps when device fails..." />
                  </div>
                  <div className="edit-field">
                    <label>Notes</label>
                    <textarea rows={2} value={inlineEditForm.notes}
                      onChange={(e) => handleInlineFormChange('notes', e.target.value)}
                      placeholder="Additional notes..." />
                  </div>
                </div>

                <div className="edit-form-actions">
                  <button className="btn-cancel-edit" onClick={handleCloseInlineEdit} disabled={inlineSaveLoading}>Cancel</button>
                  <button className="btn-save-edit" onClick={handleSaveInlineEdit} disabled={inlineSaveLoading}>
                    {inlineSaveLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <>
                    <button className="btn-edit-risk" onClick={handleStartEdit}>
                      <EditIcon /> Edit Configuration
                    </button>
                    <button
                      className="btn-delete-unit-modal"
                      onClick={() => handleDeleteUnitConfirm(selectedDeviceSerial)}
                      title={`Delete registered unit ${selectedDeviceSerial}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      Delete Unit
                    </button>
                  </>
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
                      <span><strong>Risk Criteria Guide (دليل معايير التقييم الإكسيل):</strong></span>
                    </div>
                    <div className="guide-box-content">
                      <div className="guide-col">
                        <strong>Medical Equipment (Sheet: medical):</strong>
                        <ul>
                          <li><strong>Probability:</strong> Occurrence / Number of Equipment</li>
                          <li><strong>Norm. Prob:</strong> Probability × (9 / 38.5)</li>
                          <li><strong>Risk %:</strong> (Process × Patient × Norm Prob / 36) × 100</li>
                          <li><strong>Thresholds:</strong> ≤10% (Class 1) | &lt;50% (Class 2) | ≥50% (Class 3)</li>
                        </ul>
                      </div>
                      <div className="guide-col">
                        <strong>Non-Medical Equipment (Sheet: non medical):</strong>
                        <ul>
                          <li><strong>Probability:</strong> Occurrence / Number of Equipment</li>
                          <li><strong>Norm. Prob:</strong> Probability × (9 / 11.66666667)</li>
                          <li><strong>Risk %:</strong> (Process × Patient × Norm Prob / 27.77142856) × 100</li>
                          <li><strong>Thresholds:</strong> ≤30% (Class 1) | &lt;70% (Class 2) | ≥70% (Class 3)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="edit-section-title">Category &amp; Risk Factors</div>
                  <div className="edit-grid">
                    <div className="edit-field">
                      <label>Arabic Name (الاسم بالعربي)</label>
                      <input type="text" value={editForm.arabic_name}
                        onChange={(e) => handleFormChange('arabic_name', e.target.value)}
                        placeholder="e.g. جهاز قياس ضغط الدم" />
                    </div>
                    <div className="edit-field">
                      <label>Equipment Category (تصنيف الجهاز)</label>
                      <select
                        value={editForm.equipment_category}
                        onChange={(e) => handleFormChange('equipment_category', e.target.value)}
                      >
                        <option value="medical">Medical Equipment (طبي — Max: 36)</option>
                        <option value="non_medical">Non-Medical Equipment (غير طبي — Max: 27.77)</option>
                      </select>
                    </div>
                    <div className="edit-field">
                      <label>Process Impact Risk (تأثير تعطل العملية)</label>
                      <select value={editForm.process_risk} onChange={(e) => handleFormChange('process_risk', e.target.value)}>
                        <option value={1}>1 — Low: Minor impact (لا يؤثر على سير العمل أو توجد بدائل)</option>
                        <option value={2}>2 — Medium: Partial service delay (تعطيل جزئي أو تأخير)</option>
                        <option value={3}>3 — High: Complete process halt (توقف كامل للعمليات الحيوية)</option>
                      </select>
                    </div>
                    <div className="edit-field">
                      <label>Patient Impact Risk (تأثير سلامة المريض)</label>
                      <select value={editForm.patient_risk} onChange={(e) => handleFormChange('patient_risk', e.target.value)}>
                        <option value={1}>1 — Low: No direct patient injury (لا خطر مباشر على المريض)</option>
                        <option value={2}>2 — Medium: Indirect risk / diagnostic delay (خطر غير مباشر أو تأخير تشخيص)</option>
                        <option value={3}>3 — High: Direct life hazard (خطر مباشر يهدد الحياة كأجهزة الإنعاش)</option>
                      </select>
                    </div>
                    <div className="edit-field">
                      <label>Occurrence Value (قيمة التكرار من الإكسيل)</label>
                      <input type="number" min="0" step="any" value={editForm.occurrence_value}
                        onChange={(e) => handleFormChange('occurrence_value', e.target.value)} />
                    </div>
                    <div className="edit-field">
                      <label>Equipment Count (العدد الموجود)</label>
                      <input type="number" min="1" value={editForm.equipment_count}
                        onChange={(e) => handleFormChange('equipment_count', e.target.value)} />
                    </div>
                    <div className="edit-field">
                      <label>Minimum Required (العدد المطلوب)</label>
                      <input type="number" min="1" value={editForm.minimum_required}
                        onChange={(e) => handleFormChange('minimum_required', e.target.value)} />
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
                      <div className="detail-item"><span className="detail-label">Category</span><span className="detail-val" style={{ textTransform: 'capitalize' }}>{deviceDetails.equipment_risk.equipment_category || 'Medical'}</span></div>
                      <div className="detail-item"><span className="detail-label">Arabic Name</span><span className="detail-val">{deviceDetails.equipment_risk.arabic_name || '—'}</span></div>
                      <div className="detail-item"><span className="detail-label">Patient Impact Risk</span><span className="detail-val">{deviceDetails.equipment_risk.patient_risk} / 3</span></div>
                      <div className="detail-item"><span className="detail-label">Process Impact Risk</span><span className="detail-val">{deviceDetails.equipment_risk.process_risk} / 3</span></div>
                      <div className="detail-item"><span className="detail-label">Occurrence Value</span><span className="detail-val">{deviceDetails.equipment_risk.occurrence_value ?? 0}</span></div>
                      <div className="detail-item"><span className="detail-label">Equipment Count / Min Required</span><span className="detail-val">{deviceDetails.equipment_risk.equipment_count} / {deviceDetails.equipment_risk.minimum_required}</span></div>
                      <div className="detail-item">
                        <span className="detail-label">Probability of Occurrence</span>
                        <span className="detail-val">{deviceDetails.equipment_risk.probability_occurrence}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Normalized Probability</span>
                        <span className="detail-val">{deviceDetails.equipment_risk.normalized_probability ?? '—'}</span>
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