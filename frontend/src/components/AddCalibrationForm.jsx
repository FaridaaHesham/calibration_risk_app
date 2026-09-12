import { useState, useCallback, useEffect } from 'react';

import {
  getDevice,
  createDevice,
  createCalibrationRecord,
  getDepartments,
  getToleranceRules,
  createToleranceRule,
  getDeviceTestLabels,
  getCalibrationHistory,
  getDeviceTypes,
} from '../api/devices';

import './AddCalibrationForm.css';

// ─── Fallback tolerance applied when a test label has no configured
// ToleranceRule. Kept in sync with the backend's bulk-upload fallback
// (see routers/calibrations.py) so behavior matches everywhere.
const DEFAULT_TOLERANCE_PERCENT = 10;

// ─── Empty test row template ──────────────────────────────────────────────

const newTestRow = () => ({
  id: Date.now() + Math.random(),
  test_label: '',
  test_point_unit: '',
  reference_value: '',
  actual_value: '',
  min_value: '',
  max_value: '',
  // true when min/max were computed from DEFAULT_TOLERANCE_PERCENT because
  // no ToleranceRule matched this test_label, rather than a real rule.
  usingDefaultTolerance: false,
});

// ─── Auto-compute pass/fail based on min and max ───────────────────────────

function autoResult(actual, minVal, maxVal) {
  const a = parseFloat(actual);
  const min = parseFloat(minVal);
  const max = parseFloat(maxVal);

  if (Number.isNaN(a) || Number.isNaN(min) || Number.isNaN(max)) {
    return null;
  }

  return a >= min && a <= max ? 'Pass' : 'Fail';
}

// ─── Individual test row component ───────────────────────────────────────

function TestRow({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
  deviceTestLabels = [],
  onAddToleranceRule,
}) {
  const computedResult = autoResult(
    row.actual_value,
    row.min_value,
    row.max_value
  );

  // Deviation convention:
  // reference value - actual value
  //
  // Example:
  // Reference = 6
  // Actual = 5.9
  // Deviation = +0.1

  const deviation = (() => {
    const reference = parseFloat(row.reference_value);
    const actual = parseFloat(row.actual_value);

    if (Number.isNaN(reference) || Number.isNaN(actual)) {
      return '';
    }

    const difference = reference - actual;

    if (difference === 0) {
      return '0';
    }

    return `${difference > 0 ? '+' : ''}${difference
      .toFixed(4)
      .replace(/\.?0+$/, '')}`;
  })();

  function field(name) {
    return (e) => {
      onChange(row.id, name, e.target.value);
    };
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
            <RemoveIcon />
            Remove
          </button>
        )}
      </div>

      <div className="test-row-grid">
        {/* Test Label */}
        <div className="tf tf--span2">
          <label
            className="form-label"
            htmlFor={`test-label-${row.id}`}
          >
            Test Label <span className="req">*</span>
          </label>

          {deviceTestLabels.length > 1 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <select
                id={`test-label-${row.id}`}
                className="form-select"
                value={
                  deviceTestLabels.includes(row.test_label)
                    ? row.test_label
                    : row.test_label
                      ? '__custom__'
                      : ''
                }
                onChange={(e) => {
                  const value = e.target.value;

                  if (value === '__custom__') {
                    onChange(row.id, 'test_label', '');
                  } else {
                    onChange(row.id, 'test_label', value);
                  }
                }}
                required
              >
                <option value="">Select test label...</option>

                {deviceTestLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}

                <option value="__custom__">
                  Enter custom label...
                </option>
              </select>

              {(!deviceTestLabels.includes(row.test_label) ||
                row.test_label === '') && (
                <input
                  type="text"
                  className="form-input"
                  value={row.test_label}
                  onChange={field('test_label')}
                  placeholder="Enter custom label..."
                  required
                />
              )}
            </div>
          ) : deviceTestLabels.length === 1 ? (
            <input
              id={`test-label-${row.id}`}
              type="text"
              className="form-input"
              value={row.test_label}
              readOnly
              required
            />
          ) : (
            <input
              id={`test-label-${row.id}`}
              type="text"
              className="form-input"
              value={row.test_label}
              onChange={field('test_label')}
              placeholder="e.g. Temperature Accuracy Test"
              required
            />
          )}
        </div>

        {/* Unit */}
        <div className="tf">
          <label
            className="form-label"
            htmlFor={`test-unit-${row.id}`}
          >
            Test Point Unit <span className="req">*</span>
          </label>

          <input
            id={`test-unit-${row.id}`}
            type="text"
            className="form-input"
            value={row.test_point_unit}
            onChange={field('test_point_unit')}
            placeholder="e.g. mmHg, BPM"
            required
          />
        </div>

        {/* Reference Value */}
        <div className="tf">
          <label
            className="form-label"
            htmlFor={`test-ref-${row.id}`}
          >
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

        {/* Actual Value */}
        <div className="tf">
          <label
            className="form-label"
            htmlFor={`test-actual-${row.id}`}
          >
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

        {/* MIN Value */}
        <div className="tf">
          <label
            className="form-label"
            htmlFor={`test-min-${row.id}`}
          >
            MIN Value <span className="req">*</span>
          </label>

          <input
            id={`test-min-${row.id}`}
            type="number"
            step="any"
            className="form-input"
            value={row.min_value}
            onChange={field('min_value')}
            placeholder="0.00"
            required
          />
        </div>

        {/* MAX Value */}
        <div className="tf">
          <label
            className="form-label"
            htmlFor={`test-max-${row.id}`}
          >
            MAX Value <span className="req">*</span>
          </label>

          <input
            id={`test-max-${row.id}`}
            type="number"
            step="any"
            className="form-input"
            value={row.max_value}
            onChange={field('max_value')}
            placeholder="0.00"
            required
          />
        </div>

        {/* Deviation */}
        <div className="tf">
          <label className="form-label">
            Deviation (auto)
          </label>

          <div
            className={`deviation-display ${
              deviation.startsWith('+')
                ? 'dev-pos'
                : deviation.startsWith('-')
                  ? 'dev-neg'
                  : ''
            }`}
          >
            {deviation || '—'}
          </div>
        </div>

        {/* Result */}
        <div className="tf">
          <label className="form-label">
            Result (auto)
          </label>

          {computedResult ? (
            <span
              className={`result-badge badge ${
                computedResult === 'Pass'
                  ? 'badge-success'
                  : 'badge-danger'
              }`}
            >
              {computedResult}
            </span>
          ) : (
            <span className="deviation-display">—</span>
          )}
        </div>
      </div>

      {row.usingDefaultTolerance && row.test_label.trim() && (
        <div className="tolerance-fallback-notice">
          <AlertIcon />
          <span>
            No tolerance rule configured for <strong>"{row.test_label}"</strong> —
            using the default ±{DEFAULT_TOLERANCE_PERCENT}% band.
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => onAddToleranceRule(row)}
          >
            Add tolerance rule
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Form component ──────────────────────────────────────────────────

export default function AddCalibrationForm({ onViewDevice }) {
  // Departments
  const [departments, setDepartments] = useState([]);
  const [toleranceRules, setToleranceRules] = useState([]);

  // "Add tolerance rule" inline modal, opened from a test row that has no
  // matching ToleranceRule (see the fallback notice in TestRow above).
  const [toleranceModalRow, setToleranceModalRow] = useState(null);
  const [toleranceRuleForm, setToleranceRuleForm] = useState({
    tolerance_type: 'percentage',
    tolerance_value: String(DEFAULT_TOLERANCE_PERCENT),
    unit: '',
    notes: '',
  });
  const [toleranceRuleError, setToleranceRuleError] = useState('');
  const [savingToleranceRule, setSavingToleranceRule] = useState(false);

  // Device lookup
  const [serialInput, setSerialInput] = useState('');
  const [department, setDepartment] = useState('');
  const [device, setDevice] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState('');

  // Device-specific test information
  const [deviceTestLabels, setDeviceTestLabels] = useState([]);
  const [deviceTestUnits, setDeviceTestUnits] = useState({});

  // Session metadata
  const [calibrationYear, setCalibrationYear] = useState(
    new Date().getFullYear().toString()
  );
  const [certificateNum, setCertificateNum] = useState('');
  const [accessoryType, setAccessoryType] = useState('');
  const [accessoryModel, setAccessoryModel] = useState('');
  const [accessorySerial, setAccessorySerial] = useState('');

  // Test rows
  const [tests, setTests] = useState([newTestRow()]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedSummary, setSavedSummary] = useState(null);

  // New device creation
  const [isCreating, setIsCreating] = useState(false);
  const [creatingDevice, setCreatingDevice] = useState(false);
  const [newDeviceType, setNewDeviceType] = useState('');
  const [knownDeviceTypes, setKnownDeviceTypes] = useState([]);
  const [newDeviceModel, setNewDeviceModel] = useState('');
  const [newDeviceMfr, setNewDeviceMfr] = useState('');
  const [newDeviceResolution, setNewDeviceResolution] = useState('');

  // ── Initial data loading ─────────────────────────────────────

  useEffect(() => {
    async function loadInitialData() {
      try {
        const departmentsData = await getDepartments();
        setDepartments(departmentsData || []);
      } catch (err) {
        console.error(
          'Failed to load departments:',
          err
        );
      }

      try {
        const typesData = await getDeviceTypes();
        setKnownDeviceTypes(typesData || []);
      } catch (err) {
        console.error('Failed to load device types:', err);
      }

      try {
        const rules = await getToleranceRules();
        setToleranceRules(rules || []);
      } catch (err) {
        console.error(
          'Failed to load tolerance rules:',
          err
        );
      }
    }

    loadInitialData();
  }, []);

  // ── Device lookup ─────────────────────────────────────────────

  async function handleDeviceLookup(e) {
    e.preventDefault();

    const serial = serialInput.trim();

    if (!serial) {
      return;
    }

    setDeviceLoading(true);
    setDeviceError('');
    setDevice(null);
    setIsCreating(false);
    setDeviceTestLabels([]);
    setDeviceTestUnits({});

    try {
      const dev = await getDevice(serial);

      if (!dev) {
        setDeviceError(
          `No device found for serial number "${serial}". ` +
          'Check the number and try again, or add it as a new device below.'
        );
        return;
      }

      setDevice(dev);

      if (dev.department && !department) {
        setDepartment(dev.department);
      }

      // ── Fetch test labels ────────────────────────────────────

      try {
        const labels = await getDeviceTestLabels(
          dev.serialNumber
        );

        const labelsList = Array.isArray(labels)
          ? labels
          : [];

        setDeviceTestLabels(labelsList);

        // ── Load historical calibration data ───────────────────

        try {
          const history = await getCalibrationHistory(
            dev.serialNumber
          );

          const unitMap = {};

          if (Array.isArray(history)) {
            history.forEach((record) => {
              if (!Array.isArray(record.tests)) {
                return;
              }

              record.tests.forEach((test) => {
                const label = (
                  test.test_label || ''
                ).trim();

                const unit = (
                  test.test_point_unit || ''
                ).trim();

                if (
                  label &&
                  unit &&
                  !unitMap[label]
                ) {
                  unitMap[label] = unit;
                }
              });
            });
          }

          setDeviceTestUnits(unitMap);

          // If there is only one label,
          // automatically fill label + unit.
          if (labelsList.length === 1) {
            const label = labelsList[0];

            setTests((prev) =>
              prev.map((test) => ({
                ...test,
                test_label: label,
                test_point_unit:
                  unitMap[label] ||
                  test.test_point_unit,
              }))
            );
          }
        } catch (err) {
          console.error(
            'Failed to load historical test units:',
            err
          );

          setDeviceTestUnits({});

          if (labelsList.length === 1) {
            setTests((prev) =>
              prev.map((test) => ({
                ...test,
                test_label: labelsList[0],
              }))
            );
          }
        }
      } catch (err) {
        console.error(
          'Failed to load device test labels:',
          err
        );

        setDeviceTestLabels([]);
        setDeviceTestUnits({});
      }
    } catch (err) {
      console.error(
        'Device lookup failed:',
        err
      );

      setDeviceError(
        'Failed to look up device. Please try again.'
      );
    } finally {
      setDeviceLoading(false);
    }
  }

  // ── Create new device ─────────────────────────────────────────

  async function handleSaveNewDevice() {
    if (!newDeviceType.trim() || !department) {
      setDeviceError(
        'Department Name and Device Type are required.'
      );
      return;
    }

    if (!serialInput.trim()) {
      setDeviceError(
        'Serial Number is required.'
      );
      return;
    }

    setCreatingDevice(true);
    setDeviceError('');
    setDeviceTestLabels([]);
    setDeviceTestUnits({});

    try {
      const newDev = await createDevice({
        serialNumber: serialInput.trim(),
        department,
        deviceType: newDeviceType.trim(),
        model: newDeviceModel.trim() || null,
        manufacturer: newDeviceMfr.trim() || null,
        resolution: newDeviceResolution.trim()
          ? newDeviceResolution.trim()
          : null,
      });

      setDevice(newDev);
      setIsCreating(false);

      // ── Detect test labels & units for new device ────────────────
      try {
        const labels = await getDeviceTestLabels(newDev.serialNumber);
        const labelsList = Array.isArray(labels) ? labels : [];
        setDeviceTestLabels(labelsList);

        const unitMap = {};
        toleranceRules.forEach((rule) => {
          if (rule.test_label && rule.unit) {
            unitMap[rule.test_label] = rule.unit;
          }
        });
        setDeviceTestUnits(unitMap);

        if (labelsList.length === 1) {
          const label = labelsList[0];
          setTests((prev) =>
            prev.map((test) => ({
              ...test,
              test_label: label,
              test_point_unit: unitMap[label] || test.test_point_unit || '',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load test labels for new device:', err);
      }
    } catch (err) {
      console.error(
        'Failed to create device:',
        err
      );

      setDeviceError(
        err.message ||
        'Failed to create device. Please try again.'
      );
    } finally {
      setCreatingDevice(false);
    }
  }

  // ── Test row management ───────────────────────────────────────

  const handleTestChange = useCallback(
    (id, field, value) => {
      setTests((prev) =>
        prev.map((test) => {
          if (test.id !== id) {
            return test;
          }

          const updated = {
            ...test,
            [field]: value,
          };

          // Automatically detect historical unit
          // when test label changes.
          if (field === 'test_label') {
            const selectedLabel = (
              value || ''
            ).trim();

            const detectedUnit =
              deviceTestUnits[selectedLabel];

            if (detectedUnit) {
              updated.test_point_unit =
                detectedUnit;
            }
          }

          // ── Apply tolerance rule ─────────────────────────────

          if (
            field === 'test_label' ||
            field === 'reference_value'
          ) {
            const labelValue =
              field === 'test_label'
                ? value
                : test.test_label;

            const referenceValue =
              field === 'reference_value'
                ? value
                : test.reference_value;

            const labelToMatch = (
              labelValue || ''
            )
              .trim()
              .toLowerCase();

            const reference = parseFloat(
              referenceValue
            );

            const rule = toleranceRules.find(
              (r) =>
                (r.test_label || '')
                  .trim()
                  .toLowerCase() ===
                labelToMatch
            );

            if (rule) {
              updated.usingDefaultTolerance = false;

              // Fill unit from tolerance rule
              // only when no unit has already been detected.
              if (
                rule.unit &&
                !updated.test_point_unit
              ) {
                updated.test_point_unit =
                  rule.unit;
              }

              if (!Number.isNaN(reference)) {
                let min = 0;
                let max = 0;

                if (
                  rule.tolerance_type ===
                  'percentage'
                ) {
                  min =
                    reference *
                    (1 -
                      rule.tolerance_value /
                        100);

                  max =
                    reference *
                    (1 +
                      rule.tolerance_value /
                        100);
                } else if (
                  rule.tolerance_type ===
                  'absolute'
                ) {
                  min =
                    reference -
                    rule.tolerance_value;

                  max =
                    reference +
                    rule.tolerance_value;
                }

                updated.min_value =
                  parseFloat(
                    min.toFixed(4)
                  ).toString();

                updated.max_value =
                  parseFloat(
                    max.toFixed(4)
                  ).toString();
              }
            } else {
              // No configured rule for this label — fall back to the
              // default ±DEFAULT_TOLERANCE_PERCENT% band (same default the
              // backend's bulk-upload endpoint uses) and flag the row so
              // the UI can prompt to add a real rule for it.
              updated.usingDefaultTolerance = Boolean(labelToMatch);

              if (labelToMatch && !Number.isNaN(reference)) {
                const min =
                  reference *
                  (1 - DEFAULT_TOLERANCE_PERCENT / 100);
                const max =
                  reference *
                  (1 + DEFAULT_TOLERANCE_PERCENT / 100);

                updated.min_value =
                  parseFloat(
                    min.toFixed(4)
                  ).toString();

                updated.max_value =
                  parseFloat(
                    max.toFixed(4)
                  ).toString();
              }
            }
          }

          return updated;
        })
      );
    },
    [toleranceRules, deviceTestUnits]
  );

  // ── Add tolerance rule (inline, from a test row's fallback notice) ──

  function openToleranceModal(row) {
    setToleranceModalRow(row);
    setToleranceRuleForm({
      tolerance_type: 'percentage',
      tolerance_value: String(DEFAULT_TOLERANCE_PERCENT),
      unit: row.test_point_unit || '',
      notes: '',
    });
    setToleranceRuleError('');
  }

  function closeToleranceModal() {
    setToleranceModalRow(null);
  }

  async function handleSaveToleranceRule(e) {
    e.preventDefault();
    setToleranceRuleError('');

    const label = (toleranceModalRow?.test_label || '').trim();
    const value = parseFloat(toleranceRuleForm.tolerance_value);

    if (!label) {
      setToleranceRuleError('This test row has no label yet.');
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      setToleranceRuleError('Tolerance value must be a positive number.');
      return;
    }

    setSavingToleranceRule(true);
    try {
      const created = await createToleranceRule({
        test_label: label,
        tolerance_type: toleranceRuleForm.tolerance_type,
        tolerance_value: value,
        unit: toleranceRuleForm.unit.trim() || null,
        notes: toleranceRuleForm.notes.trim() || null,
      });

      setToleranceRules((prev) => [...prev, created]);

      // Apply the new rule immediately to every test row sharing this
      // label — there may be more than one — recomputing MIN/MAX from
      // each row's own reference value and clearing the fallback flag.
      const labelToMatch = label.toLowerCase();
      setTests((prev) =>
        prev.map((test) => {
          if (
            (test.test_label || '').trim().toLowerCase() !==
            labelToMatch
          ) {
            return test;
          }

          const reference = parseFloat(test.reference_value);
          const updated = {
            ...test,
            usingDefaultTolerance: false,
            test_point_unit:
              test.test_point_unit || created.unit || '',
          };

          if (!Number.isNaN(reference)) {
            let min = 0;
            let max = 0;

            if (created.tolerance_type === 'percentage') {
              min = reference * (1 - created.tolerance_value / 100);
              max = reference * (1 + created.tolerance_value / 100);
            } else {
              min = reference - created.tolerance_value;
              max = reference + created.tolerance_value;
            }

            updated.min_value = parseFloat(min.toFixed(4)).toString();
            updated.max_value = parseFloat(max.toFixed(4)).toString();
          }

          return updated;
        })
      );

      setToleranceModalRow(null);
    } catch (err) {
      setToleranceRuleError(
        err.message || 'Failed to save tolerance rule.'
      );
    } finally {
      setSavingToleranceRule(false);
    }
  }

  function addTestRow() {
    const label =
      deviceTestLabels.length === 1
        ? deviceTestLabels[0]
        : '';

    const unit =
      label && deviceTestUnits[label]
        ? deviceTestUnits[label]
        : '';

    setTests((prev) => [
      ...prev,
      {
        ...newTestRow(),
        test_label: label,
        test_point_unit: unit,
      },
    ]);
  }

  function removeTestRow(id) {
    setTests((prev) =>
      prev.filter((test) => test.id !== id)
    );
  }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();

    setSubmitError('');

    if (!device) {
      setSubmitError(
        'Please look up and confirm a device before saving.'
      );
      return;
    }

    if (!calibrationYear) {
      setSubmitError(
        'Please specify the calibration year.'
      );
      return;
    }

    const invalidTest = tests.some(
      (test) =>
        !test.test_label.trim() ||
        test.actual_value === '' ||
        test.min_value === '' ||
        test.max_value === ''
    );

    if (invalidTest) {
      setSubmitError(
        'Each test row must have a label, actual value, MIN value, and MAX value.'
      );
      return;
    }

    setSubmitting(true);

    try {
      const saved =
        await createCalibrationRecord({
          serialNumber:
            device.serialNumber,

          calibrationYear,

          certificateNum,

          accessoryType,

          accessoryModel,

          accessorySerial,

          tests: tests.map((test) => ({
            testLabel:
              test.test_label,

            testPointUnit:
              test.test_point_unit,

            referenceValue:
              test.reference_value,

            actualValue:
              test.actual_value,

            minValue:
              test.min_value,

            maxValue:
              test.max_value,
          })),
        });

      setSavedSummary(saved);
      setSubmitted(true);
    } catch (err) {
      console.error(
        'Failed to save calibration record:',
        err
      );

      setSubmitError(
        err.message ||
        'Failed to save calibration record. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────

  function handleReset() {
    setDevice(null);
    setSerialInput('');
    setDepartment('');

    setCalibrationYear(
      new Date().getFullYear().toString()
    );

    setCertificateNum('');
    setAccessoryType('');
    setAccessoryModel('');
    setAccessorySerial('');

    setIsCreating(false);

    setNewDeviceType('');
    setNewDeviceModel('');
    setNewDeviceMfr('');
    setNewDeviceResolution('');

    setTests([newTestRow()]);

    setSubmitted(false);
    setSubmitError('');
    setSavedSummary(null);

    setDeviceTestLabels([]);
    setDeviceTestUnits({});
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
            Calibration data for{' '}
            <strong>
              {device?.serialNumber}
            </strong>{' '}
            ({calibrationYear}) has been saved
            to the database with{' '}
            <strong>
              {savedSummary?.tests?.length ??
                tests.length}{' '}
              test
              {(savedSummary?.tests?.length ??
                tests.length) !== 1
                ? 's'
                : ''}
            </strong>
            , overall result{' '}
            <strong>
              {savedSummary?.result}
            </strong>
            .
          </p>

          <p className="success-note">
            The device's control chart and
            calibration interval recommendation
            will update automatically to include
            this new record the next time it's
            viewed.
          </p>

          <div className="success-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                if (onViewDevice && device?.serialNumber) {
                  onViewDevice(device.serialNumber);
                } else {
                  handleReset();
                }
              }}
            >
              View Device History &amp; Charts
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleReset}
            >
              Add Another Record
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main form ─────────────────────────────────────────────────

  return (
    <div className="add-cal-form-wrap">
      <form
        id="add-calibration-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {/* ── Section 1: Device Identification ─────────────── */}

        <section className="add-cal-section">
          <div className="add-cal-section-header">
            <StepBadge n={1} />

            <div>
              <h2 className="add-cal-section-title">
                Device Identification
              </h2>

              <p className="add-cal-section-desc">
                Search for the device you are
                calibrating by its serial number.
              </p>
            </div>
          </div>

          <div className="card add-cal-card">
            <div className="add-cal-lookup-row">
              {/* Department */}

              <div className="tf">
                <label
                  htmlFor="add-dept"
                  className="form-label"
                >
                  Department Name
                </label>

                <select
                  id="add-dept"
                  className="form-select"
                  value={department}
                  onChange={(e) =>
                    setDepartment(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select department…
                  </option>

                  {departments.map((dept) => (
                    <option
                      key={dept}
                      value={dept}
                    >
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Serial Number */}

              <div className="tf tf--grow">
                <label
                  htmlFor="add-serial"
                  className="form-label"
                >
                  Serial Number{' '}
                  <span className="req">*</span>
                </label>

                <input
                  id="add-serial"
                  type="text"
                  className="form-input"
                  value={serialInput}
                  onChange={(e) =>
                    setSerialInput(
                      e.target.value
                    )
                  }
                  placeholder="Enter the device serial number"
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDeviceLookup(e);
                    }
                  }}
                />
              </div>

              {/* Lookup button */}

              <div className="tf">
                <label
                  className="form-label"
                  aria-hidden="true"
                >
                  &nbsp;
                </label>

                <button
                  id="btn-lookup-device"
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDeviceLookup}
                  disabled={
                    deviceLoading ||
                    !serialInput.trim()
                  }
                >
                  {deviceLoading ? (
                    <>
                      <div
                        className="spinner"
                        style={{
                          width: 14,
                          height: 14,
                          borderWidth: 2,
                        }}
                      />
                      Looking up…
                    </>
                  ) : (
                    <>
                      <SearchIcon />
                      Find Device
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Device error */}

            {deviceError && !isCreating && (
              <div
                className="add-cal-error"
                role="alert"
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertIcon />
                  {deviceError}
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                  }}
                  onClick={() =>
                    setIsCreating(true)
                  }
                >
                  Add this device
                </button>
              </div>
            )}

            {/* Create New Device */}

            {isCreating && !device && (
              <div
                className="device-found-card"
                style={{
                  background: '#FFFDF0',
                  borderColor: '#F4D03F',
                }}
              >
                <div
                  className="device-found-label"
                  style={{
                    color: '#9A7D0A',
                  }}
                >
                  <PlusIcon />
                  Adding New Device
                </div>

                <div
                  className="device-found-grid"
                  style={{
                    marginBottom: 14,
                  }}
                >
                  {/* Device Type */}

                  <div className="tf">
                    <label className="form-label">
                      Device Type{' '}
                      <span className="req">
                        *
                      </span>
                    </label>

                    <select
                      className="form-select"
                      value={
                        knownDeviceTypes.includes(newDeviceType)
                          ? newDeviceType
                          : (newDeviceType ? '__custom__' : '')
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setNewDeviceType('');
                        } else {
                          setNewDeviceType(val);
                        }
                      }}
                      required
                    >
                      <option value="">Select device type...</option>
                      {knownDeviceTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value="__custom__">
                        Other (Enter custom type...)
                      </option>
                    </select>

                    {(!knownDeviceTypes.includes(newDeviceType) || newDeviceType === '') && (
                      <input
                        type="text"
                        className="form-input"
                        style={{ marginTop: 8 }}
                        value={newDeviceType}
                        onChange={(e) =>
                          setNewDeviceType(e.target.value)
                        }
                        placeholder="Enter custom device type..."
                        required
                      />
                    )}
                  </div>

                  {/* Model */}

                  <div className="tf">
                    <label className="form-label">
                      Model
                    </label>

                    <input
                      type="text"
                      className="form-input"
                      value={newDeviceModel}
                      onChange={(e) =>
                        setNewDeviceModel(
                          e.target.value
                        )
                      }
                      placeholder="e.g. 5810R"
                    />
                  </div>

                  {/* Manufacturer */}

                  <div className="tf">
                    <label className="form-label">
                      Manufacturer
                    </label>

                    <input
                      type="text"
                      className="form-input"
                      value={newDeviceMfr}
                      onChange={(e) =>
                        setNewDeviceMfr(
                          e.target.value
                        )
                      }
                      placeholder="e.g. Eppendorf"
                    />
                  </div>

                  {/* Resolution */}

                  <div className="tf">
                    <label className="form-label">
                      Resolution
                    </label>

                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      value={
                        newDeviceResolution
                      }
                      onChange={(e) =>
                        setNewDeviceResolution(
                          e.target.value
                        )
                      }
                      placeholder="e.g. 0.1"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                    }}
                    onClick={() =>
                      setIsCreating(false)
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                    }}
                    onClick={
                      handleSaveNewDevice
                    }
                    disabled={creatingDevice}
                  >
                    {creatingDevice
                      ? 'Saving…'
                      : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Device information */}

            {device && (
              <div className="device-found-card">
                <div className="device-found-label">
                  <CheckIcon />
                  Device found
                </div>

                <div className="device-found-grid">
                  <DeviceField
                    label="Serial Number"
                    value={
                      device.serialNumber
                    }
                  />

                  <DeviceField
                    label="Department Name"
                    value={
                      device.department
                    }
                  />

                  <DeviceField
                    label="Device Type"
                    value={
                      device.deviceType
                    }
                  />

                  <DeviceField
                    label="Model"
                    value={
                      device.model || '—'
                    }
                  />

                  <DeviceField
                    label="Manufacturer"
                    value={
                      device.manufacturer ||
                      '—'
                    }
                  />

                  <DeviceField
                    label="Resolution"
                    value={
                      device.resolution !==
                        undefined &&
                      device.resolution !==
                        null
                        ? device.resolution
                        : '—'
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: Session Details ───────────────────── */}

        <section className="add-cal-section">
          <div className="add-cal-section-header">
            <StepBadge n={2} />

            <div>
              <h2 className="add-cal-section-title">
                Calibration Session Details
              </h2>

              <p className="add-cal-section-desc">
                Record the calibration year,
                certificate, and any reference
                accessory used.
              </p>
            </div>
          </div>

          <div className="card add-cal-card">
            <div className="session-grid">
              {/* Calibration Year */}

              <div className="tf">
                <label
                  htmlFor="cal-year"
                  className="form-label"
                >
                  Calibration Year{' '}
                  <span className="req">*</span>
                </label>

                <input
                  id="cal-year"
                  type="number"
                  className="form-input"
                  value={calibrationYear}
                  onChange={(e) =>
                    setCalibrationYear(
                      e.target.value
                    )
                  }
                  placeholder="YYYY"
                  required
                />
              </div>

              {/* Certificate */}

              <div className="tf">
                <label
                  htmlFor="cert-num"
                  className="form-label"
                >
                  Certificate Number
                </label>

                <input
                  id="cert-num"
                  type="text"
                  className="form-input"
                  value={certificateNum}
                  onChange={(e) =>
                    setCertificateNum(
                      e.target.value
                    )
                  }
                  placeholder="e.g. CERT-2026-0142"
                />
              </div>

              {/* Accessory Type */}

              <div className="tf">
                <label
                  htmlFor="acc-type"
                  className="form-label"
                >
                  Accessory Type
                </label>

                <input
                  id="acc-type"
                  type="text"
                  className="form-input"
                  value={accessoryType}
                  onChange={(e) =>
                    setAccessoryType(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Convex Probe (leave blank if none)"
                />
              </div>

              {/* Accessory Model */}

              <div className="tf">
                <label
                  htmlFor="acc-model"
                  className="form-label"
                >
                  Accessory Model
                </label>

                <input
                  id="acc-model"
                  type="text"
                  className="form-input"
                  value={accessoryModel}
                  onChange={(e) =>
                    setAccessoryModel(
                      e.target.value
                    )
                  }
                  placeholder="e.g. 3C5P"
                />
              </div>

              {/* Accessory Serial */}

              <div className="tf">
                <label
                  htmlFor="acc-serial"
                  className="form-label"
                >
                  Accessory Serial
                </label>

                <input
                  id="acc-serial"
                  type="text"
                  className="form-input"
                  value={accessorySerial}
                  onChange={(e) =>
                    setAccessorySerial(
                      e.target.value
                    )
                  }
                  placeholder="e.g. LRA5B149403"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: Test Measurements ─────────────────── */}

        <section className="add-cal-section">
          <div className="add-cal-section-header">
            <StepBadge n={3} />

            <div>
              <h2 className="add-cal-section-title">
                Calibration Measurements
              </h2>

              <p className="add-cal-section-desc">
                Enter one row per test performed.
                Deviation and Result are
                calculated automatically.
              </p>
            </div>
          </div>

          <div className="tests-list">
            {tests.map((row, index) => (
              <TestRow
                key={row.id}
                row={row}
                index={index}
                onChange={handleTestChange}
                onRemove={removeTestRow}
                canRemove={
                  tests.length > 1
                }
                deviceTestLabels={
                  deviceTestLabels
                }
                onAddToleranceRule={
                  openToleranceModal
                }
              />
            ))}
          </div>

          <button
            type="button"
            id="btn-add-test"
            className="btn btn-secondary add-test-btn"
            onClick={addTestRow}
          >
            <PlusIcon />
            Add Another Test
          </button>
        </section>

        {/* ── Submit Error ──────────────────────────────────── */}

        {submitError && (
          <div
            className="add-cal-error submit-error"
            role="alert"
          >
            <AlertIcon />
            {submitError}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────── */}

        <div className="add-cal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
          >
            Clear Form
          </button>

          <button
            id="btn-save-calibration"
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div
                  className="spinner"
                  style={{
                    width: 15,
                    height: 15,
                    borderWidth: 2,
                  }}
                />
                Saving…
              </>
            ) : (
              <>
                <SaveIcon />
                Save Calibration Data
              </>
            )}
          </button>
        </div>
      </form>

      {toleranceModalRow && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>Add Tolerance Rule</h2>
              <button
                type="button"
                className="btn-close-modal"
                onClick={closeToleranceModal}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveToleranceRule}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Test Label</label>
                  <input
                    type="text"
                    className="form-input"
                    value={toleranceModalRow.test_label}
                    disabled
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 16, flex: 1 }}>
                    <label>Tolerance Type</label>
                    <select
                      className="form-select"
                      value={toleranceRuleForm.tolerance_type}
                      onChange={(e) =>
                        setToleranceRuleForm({
                          ...toleranceRuleForm,
                          tolerance_type: e.target.value,
                        })
                      }
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
                      value={toleranceRuleForm.tolerance_value}
                      onChange={(e) =>
                        setToleranceRuleForm({
                          ...toleranceRuleForm,
                          tolerance_value: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Unit (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={toleranceRuleForm.unit}
                    onChange={(e) =>
                      setToleranceRuleForm({
                        ...toleranceRuleForm,
                        unit: e.target.value,
                      })
                    }
                    placeholder="e.g. mmHg, BPM"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>Notes (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={toleranceRuleForm.notes}
                    onChange={(e) =>
                      setToleranceRuleForm({
                        ...toleranceRuleForm,
                        notes: e.target.value,
                      })
                    }
                  />
                </div>

                {toleranceRuleError && (
                  <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: 16 }}>
                    {toleranceRuleError}
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={closeToleranceModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingToleranceRule}
                  >
                    {savingToleranceRule ? 'Saving…' : 'Create Rule'}
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

// ─── Small helper components ──────────────────────────────────────────────

function StepBadge({ n }) {
  return (
    <div
      className="step-badge"
      aria-hidden="true"
    >
      {n}
    </div>
  );
}

function DeviceField({ label, value }) {
  return (
    <div className="device-found-field">
      <span className="dff-label">
        {label}
      </span>

      <span className="dff-value">
        {value}
      </span>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line
      x1="21"
      y1="21"
      x2="16.65"
      y2="16.65"
    />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line
      x1="12"
      y1="5"
      x2="12"
      y2="19"
    />
    <line
      x1="5"
      y1="12"
      x2="19"
      y2="12"
    />
  </svg>
);

const RemoveIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const SaveIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const AlertIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="10" />
    <line
      x1="12"
      y1="8"
      x2="12"
      y2="12"
    />
    <line
      x1="12"
      y1="16"
      x2="12.01"
      y2="16"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SuccessIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);