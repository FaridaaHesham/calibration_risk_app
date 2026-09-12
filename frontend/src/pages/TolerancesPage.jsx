// src/pages/TolerancesPage.jsx
// Admin page for managing per-test-label tolerance rules. These rules are
// shared across every device type that uses a given test label (e.g.
// "Pressure Accuracy Test" applies to every device with that test) — they
// are not per-device settings. Used by the "Add Calibration Data" form and
// the bulk-upload importer to compute MIN/MAX from a reference value.
import { useState, useEffect } from 'react';
import {
  getToleranceRules,
  createToleranceRule,
  updateToleranceRule,
  deleteToleranceRule,
} from '../api/devices';
import './TolerancesPage.css';

const RulerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
    <line x1="6" y1="6" x2="6" y2="10"></line>
    <line x1="10" y1="6" x2="10" y2="9"></line>
    <line x1="14" y1="6" x2="14" y2="10"></line>
    <line x1="18" y1="6" x2="18" y2="9"></line>
  </svg>
);

const emptyForm = {
  test_label: '',
  tolerance_type: 'percentage',
  tolerance_value: '',
  unit: '',
  notes: '',
};

export default function TolerancesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null); // null = adding new
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getToleranceRules();
      setRules(
        (data || []).slice().sort((a, b) =>
          (a.test_label || '').localeCompare(b.test_label || '')
        )
      );
    } catch (err) {
      console.error('Failed to load tolerance rules:', err);
      setLoadError('Failed to load tolerance rules.');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingLabel(null);
    setForm(emptyForm);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEditModal(rule) {
    setEditingLabel(rule.test_label);
    setForm({
      test_label: rule.test_label || '',
      tolerance_type: rule.tolerance_type || 'percentage',
      tolerance_value:
        rule.tolerance_value !== null && rule.tolerance_value !== undefined
          ? String(rule.tolerance_value)
          : '',
      unit: rule.unit || '',
      notes: rule.notes || '',
    });
    setFormError('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const label = form.test_label.trim();
    const value = parseFloat(form.tolerance_value);

    if (!label) {
      setFormError('Test label is required.');
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      setFormError('Tolerance value must be a positive number.');
      return;
    }

    const payload = {
      test_label: label,
      tolerance_type: form.tolerance_type,
      tolerance_value: value,
      unit: form.unit.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editingLabel) {
        const updated = await updateToleranceRule(editingLabel, payload);
        setRules((prev) =>
          prev
            .map((r) => (r.test_label === editingLabel ? updated : r))
            .sort((a, b) => (a.test_label || '').localeCompare(b.test_label || ''))
        );
      } else {
        const created = await createToleranceRule(payload);
        setRules((prev) =>
          [...prev, created].sort((a, b) =>
            (a.test_label || '').localeCompare(b.test_label || '')
          )
        );
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save tolerance rule.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule) {
    if (
      !window.confirm(
        `Delete the tolerance rule for "${rule.test_label}"? Devices with this test will fall back to the default ±10% band until a new rule is added.`
      )
    ) {
      return;
    }
    try {
      await deleteToleranceRule(rule.test_label);
      setRules((prev) => prev.filter((r) => r.test_label !== rule.test_label));
    } catch (err) {
      alert(err.message || 'Failed to delete tolerance rule.');
    }
  }

  return (
    <div className="tolerances-page">
      <div className="tolerances-header">
        <div>
          <h2 className="tolerances-title">
            <RulerIcon />
            Tolerance Rules
          </h2>
          <p className="tolerances-subtitle">
            Per-test-label MIN/MAX tolerance bands. A rule applies to every
            device that has a test with this label — it's not per device.
            Tests with no matching rule fall back to a default ±10% band.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Add Tolerance Rule
        </button>
      </div>

      <div className="card tolerances-content-card">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
        ) : loadError ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
            {loadError}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Test Label</th>
                <th>Type</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.test_label}>
                  <td><strong>{rule.test_label}</strong></td>
                  <td>
                    <span className={`tol-type-badge ${rule.tolerance_type}`}>
                      {rule.tolerance_type === 'percentage' ? '%' : 'absolute'}
                    </span>
                  </td>
                  <td>
                    {rule.tolerance_type === 'percentage'
                      ? `±${rule.tolerance_value}%`
                      : `±${rule.tolerance_value}`}
                  </td>
                  <td>{rule.unit || '—'}</td>
                  <td className="tol-notes">{rule.notes || '—'}</td>
                  <td>
                    <button className="btn-link" onClick={() => openEditModal(rule)}>
                      Edit
                    </button>{' '}
                    <button
                      className="btn-link"
                      style={{ color: '#dc2626' }}
                      onClick={() => handleDelete(rule)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>
                    No tolerance rules configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>{editingLabel ? 'Edit Tolerance Rule' : 'Add Tolerance Rule'}</h2>
              <button className="btn-close-modal" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Test Label</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.test_label}
                    onChange={(e) => setForm({ ...form, test_label: e.target.value })}
                    placeholder="e.g. Pressure Accuracy Test"
                    disabled={Boolean(editingLabel)}
                    required
                  />
                  {editingLabel && (
                    <p className="field-hint">
                      The label is the rule's identifier and can't be changed here —
                      delete and re-add the rule to rename it.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 16, flex: 1 }}>
                    <label>Tolerance Type</label>
                    <select
                      className="form-select"
                      value={form.tolerance_type}
                      onChange={(e) => setForm({ ...form, tolerance_type: e.target.value })}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="absolute">Absolute (±value)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 16, flex: 1 }}>
                    <label>Tolerance Value</label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={form.tolerance_value}
                      onChange={(e) => setForm({ ...form, tolerance_value: e.target.value })}
                      placeholder={form.tolerance_type === 'percentage' ? 'e.g. 10' : 'e.g. 3'}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Unit (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. mmHg, BPM"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>Notes (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. NIBP / infusion pump pressure"
                  />
                </div>

                {formError && (
                  <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 16 }}>
                    {formError}
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: 0 }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : editingLabel ? 'Save Changes' : 'Create Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
