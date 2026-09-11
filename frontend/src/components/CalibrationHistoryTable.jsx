// src/components/CalibrationHistoryTable.jsx
// Year-grouped calibration history with click-to-expand test rows.
// Supports per-test entry inline editing & deletion, as well as full session editing & deletion.

import { useState } from 'react';
import './CalibrationHistoryTable.css';

function getDeviationClass(deviation) {
  if (deviation === null || deviation === undefined || isNaN(deviation)) return '';
  const abs = Math.abs(Number(deviation));
  if (abs === 0)   return 'dev-zero';
  if (abs < 0.5)   return 'dev-low';
  if (abs < 1.0)   return 'dev-medium';
  return 'dev-high';
}

function normalizeResult(result) {
  const r = (result || '').trim().toLowerCase();
  if (r === 'pass') return 'Pass';
  if (r === 'fail') return 'Fail';
  return result || '—';
}

function ResultBadge({ result }) {
  const isPass = (result || '').trim().toLowerCase() === 'pass';
  const isFail = (result || '').trim().toLowerCase() === 'fail';
  const display = isPass ? 'Pass' : isFail ? 'Fail' : (result || '—');
  return (
    <span className={`badge ${isPass ? 'badge-success' : 'badge-danger'}`}>
      {display}
    </span>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`expand-chevron ${open ? 'open' : ''}`}
      width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Single expandable year row + its child test sub-rows */
function YearRow({ session, serialNumber, onDeleteRecord, onUpdateRecord, onDeleteTest, onUpdateTest }) {
  const [open, setOpen] = useState(false);

  // Per-test entry editing state
  const [editingTestId, setEditingTestId] = useState(null);
  const [testEditLabel, setTestEditLabel] = useState('');
  const [testEditUnit, setTestEditUnit] = useState('');
  const [testEditRef, setTestEditRef] = useState('');
  const [testEditAct, setTestEditAct] = useState('');
  const [testEditMin, setTestEditMin] = useState('');
  const [testEditMax, setTestEditMax] = useState('');
  const [savingTest, setSavingTest] = useState(false);
  const [testError, setTestError] = useState('');

  // Session metadata editing state
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [sessYear, setSessYear] = useState('');
  const [sessCert, setSessCert] = useState('');
  const [sessAccType, setSessAccType] = useState('');
  const [sessAccModel, setSessAccModel] = useState('');
  const [sessAccSerial, setSessAccSerial] = useState('');
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // Compute test results dynamically from actual/min/max
  const computedTests = session.tests.map(t => {
    const isPass = t.actual_value >= t.min_value && t.actual_value <= t.max_value;
    return { ...t, result: isPass ? 'Pass' : 'Fail' };
  });

  const passCount = computedTests.filter(t => t.result === 'Pass').length;
  const failCount = computedTests.length - passCount;

  const overallResult = computedTests.length > 0
    ? (failCount === 0 ? 'Pass' : 'Fail')
    : normalizeResult(session.result);

  // Start editing a specific test measurement entry
  function startEditingTest(test) {
    setEditingTestId(test.id);
    setTestEditLabel(test.test_label || '');
    setTestEditUnit(test.test_point_unit || '');
    setTestEditRef(test.reference_value !== null && test.reference_value !== undefined ? test.reference_value : '');
    setTestEditAct(test.actual_value !== null && test.actual_value !== undefined ? test.actual_value : '');
    setTestEditMin(test.min_value !== null && test.min_value !== undefined ? test.min_value : '');
    setTestEditMax(test.max_value !== null && test.max_value !== undefined ? test.max_value : '');
    setTestError('');
  }

  function cancelEditingTest() {
    setEditingTestId(null);
    setTestError('');
  }

  async function handleSaveTest(testId) {
    if (!onUpdateTest) return;

    if (!testEditLabel.trim()) {
      setTestError('Test parameter label is required.');
      return;
    }
    if (testEditAct === '' || isNaN(parseFloat(testEditAct))) {
      setTestError('Valid actual value is required.');
      return;
    }
    if (testEditMin === '' || isNaN(parseFloat(testEditMin))) {
      setTestError('Valid minimum tolerance value is required.');
      return;
    }
    if (testEditMax === '' || isNaN(parseFloat(testEditMax))) {
      setTestError('Valid maximum tolerance value is required.');
      return;
    }

    const refNum = testEditRef !== '' && !isNaN(parseFloat(testEditRef)) ? parseFloat(testEditRef) : null;
    const actNum = parseFloat(testEditAct);
    const minNum = parseFloat(testEditMin);
    const maxNum = parseFloat(testEditMax);

    setSavingTest(true);
    setTestError('');
    try {
      await onUpdateTest(testId, {
        test_label: testEditLabel.trim(),
        test_point_unit: testEditUnit.trim() || null,
        reference_value: refNum,
        actual_value: actNum,
        min_value: minNum,
        max_value: maxNum,
      });
      setEditingTestId(null);
    } catch (err) {
      setTestError(err.message || 'Failed to save test entry.');
    } finally {
      setSavingTest(false);
    }
  }

  // Session metadata editing
  function startEditingSession() {
    setIsEditingSession(true);
    setSessYear(session.calibration_year || '');
    setSessCert(session.certificate_num || '');
    setSessAccType(session.accessory_type || '');
    setSessAccModel(session.accessory_model || '');
    setSessAccSerial(session.accessory_serial || '');
    setSessionError('');
  }

  function cancelEditingSession() {
    setIsEditingSession(false);
    setSessionError('');
  }

  async function handleSaveSession() {
    if (!onUpdateRecord) return;
    setSavingSession(true);
    setSessionError('');
    try {
      await onUpdateRecord(session.id, {
        calibration_year: sessYear ? parseInt(sessYear) : null,
        certificate_num: sessCert.trim() || null,
        accessory_type: sessAccType.trim() || null,
        accessory_model: sessAccModel.trim() || null,
        accessory_serial: sessAccSerial.trim() || null,
      });
      setIsEditingSession(false);
    } catch (err) {
      setSessionError(err.message || 'Failed to update session.');
    } finally {
      setSavingSession(false);
    }
  }

  return (
    <>
      {/* ── Year summary row (clickable) ── */}
      <tr
        className={`year-row ${open ? 'year-row--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}
      >
        <td className="year-cell">
          <ChevronIcon open={open} />
          <span className="year-label">{session.calibration_year || '—'}</span>
        </td>
        <td>{session.certificate_num || '—'}</td>
        <td>{session.accessory_type || '—'}</td>
        <td className="col-num">
          {session.tests.length} test{session.tests.length !== 1 ? 's' : ''}
        </td>
        <td>
          <span className="pass-fail-summary">
            {passCount > 0 && <span className="pf-pass">{passCount} Pass</span>}
            {failCount > 0 && <span className="pf-fail">{failCount} Fail</span>}
          </span>
        </td>
        <td>
          <ResultBadge result={overallResult} />
        </td>
        <td className="col-action" onClick={(e) => e.stopPropagation()}>
          {onDeleteRecord && (
            <button
              type="button"
              className="btn-delete-record"
              title={`Delete calibration session ${session.calibration_year || ''}`}
              aria-label={`Delete calibration session for year ${session.calibration_year || ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRecord(session.id, session.calibration_year);
              }}
            >
              <TrashIcon />
              <span>Delete</span>
            </button>
          )}
        </td>
      </tr>

      {/* ── Expanded test sub-rows ── */}
      {open && (
        <>
          {/* Sub-header */}
          <tr className="subheader-row">
            <td colSpan={7}>
              <div className="subheader-inner">
                {/* Header bar inside expanded panel */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingRight: '4px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Detailed Measurement Entries ({computedTests.length})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isEditingSession ? (
                      onUpdateRecord && (
                        <button
                          type="button"
                          className="btn-print-sm"
                          onClick={startEditingSession}
                          title="Edit session details (Year, Cert #, Accessory)"
                        >
                          <PencilIcon />
                          <span>Edit Session Info</span>
                        </button>
                      )
                    ) : null}
                    <a href={`/print/certificate/${serialNumber}/${session.id}`} target="_blank" rel="noopener noreferrer" className="btn-print-sm" style={{ textDecoration: 'none' }}>
                      Print Certificate
                    </a>
                    {onDeleteRecord && (
                      <button
                        type="button"
                        className="btn-delete-sm"
                        onClick={() => onDeleteRecord(session.id, session.calibration_year)}
                        title="Delete entire calibration record session"
                      >
                        <TrashIcon />
                        <span>Delete Session</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Session edit form (if editing session metadata) */}
                {isEditingSession && (
                  <div className="session-edit-box">
                    {sessionError && <div className="sub-edit-error">{sessionError}</div>}
                    <div className="session-edit-grid">
                      <div>
                        <label>Year</label>
                        <input type="number" value={sessYear} onChange={(e) => setSessYear(e.target.value)} className="sub-edit-input" />
                      </div>
                      <div>
                        <label>Certificate No.</label>
                        <input type="text" value={sessCert} onChange={(e) => setSessCert(e.target.value)} className="sub-edit-input" />
                      </div>
                      <div>
                        <label>Accessory Type</label>
                        <input type="text" value={sessAccType} onChange={(e) => setSessAccType(e.target.value)} className="sub-edit-input" />
                      </div>
                      <div>
                        <label>Accessory Model</label>
                        <input type="text" value={sessAccModel} onChange={(e) => setSessAccModel(e.target.value)} className="sub-edit-input" />
                      </div>
                      <div>
                        <label>Accessory Serial</label>
                        <input type="text" value={sessAccSerial} onChange={(e) => setSessAccSerial(e.target.value)} className="sub-edit-input" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                      <button type="button" className="btn-cancel-sm" onClick={cancelEditingSession} disabled={savingSession}>
                        <CancelIcon /> Cancel
                      </button>
                      <button type="button" className="btn-save-sm" onClick={handleSaveSession} disabled={savingSession}>
                        <CheckIcon /> {savingSession ? 'Saving...' : 'Save Session Info'}
                      </button>
                    </div>
                  </div>
                )}

                {testError && <div className="sub-edit-error" style={{ marginBottom: '10px' }}>{testError}</div>}

                {/* Measurements subtable */}
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Test Parameter</th>
                      <th className="col-num" style={{ textAlign: 'right' }}>Unit</th>
                      <th className="col-num" style={{ textAlign: 'right' }}>Reference</th>
                      <th className="col-num" style={{ textAlign: 'right' }}>Actual</th>
                      <th className="col-num" style={{ textAlign: 'right' }}>Deviation</th>
                      <th className="col-num" style={{ textAlign: 'right' }}>Tolerance [Min, Max]</th>
                      <th style={{ textAlign: 'left', paddingLeft: '14px' }}>Result</th>
                      <th style={{ textAlign: 'center', width: '130px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedTests.map((test, i) => {
                      const isEditingThis = editingTestId === test.id;

                      if (isEditingThis) {
                        const refNum = testEditRef !== '' && !isNaN(parseFloat(testEditRef)) ? parseFloat(testEditRef) : null;
                        const actNum = testEditAct !== '' && !isNaN(parseFloat(testEditAct)) ? parseFloat(testEditAct) : null;
                        const minNum = testEditMin !== '' && !isNaN(parseFloat(testEditMin)) ? parseFloat(testEditMin) : null;
                        const maxNum = testEditMax !== '' && !isNaN(parseFloat(testEditMax)) ? parseFloat(testEditMax) : null;

                        const liveDev = (refNum !== null && actNum !== null) ? (refNum - actNum) : null;
                        const livePass = (actNum !== null && minNum !== null && maxNum !== null)
                          ? (minNum <= actNum && actNum <= maxNum ? 'Pass' : 'Fail')
                          : 'Pass';

                        return (
                          <tr key={test.id || i} className="sub-row sub-row--editing">
                            <td>
                              <input
                                type="text"
                                className="sub-edit-input"
                                value={testEditLabel}
                                onChange={(e) => setTestEditLabel(e.target.value)}
                                placeholder="Parameter Label"
                              />
                            </td>
                            <td className="col-num">
                              <input
                                type="text"
                                className="sub-edit-input sub-edit-input-sm"
                                value={testEditUnit}
                                onChange={(e) => setTestEditUnit(e.target.value)}
                                placeholder="Unit"
                              />
                            </td>
                            <td className="col-num">
                              <input
                                type="number"
                                step="any"
                                className="sub-edit-input sub-edit-input-num"
                                value={testEditRef}
                                onChange={(e) => setTestEditRef(e.target.value)}
                                placeholder="Ref"
                              />
                            </td>
                            <td className="col-num">
                              <input
                                type="number"
                                step="any"
                                className="sub-edit-input sub-edit-input-num"
                                value={testEditAct}
                                onChange={(e) => setTestEditAct(e.target.value)}
                                placeholder="Actual"
                              />
                            </td>
                            <td className={`col-num ${getDeviationClass(liveDev)}`}>
                              {liveDev !== null ? (liveDev > 0 ? `+${liveDev.toFixed(4)}` : liveDev.toFixed(4)) : '—'}
                            </td>
                            <td className="col-num">
                              <div className="sub-edit-tolerance-group">
                                <input
                                  type="number"
                                  step="any"
                                  className="sub-edit-input sub-edit-input-num"
                                  value={testEditMin}
                                  onChange={(e) => setTestEditMin(e.target.value)}
                                  placeholder="Min"
                                />
                                <span>-</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="sub-edit-input sub-edit-input-num"
                                  value={testEditMax}
                                  onChange={(e) => setTestEditMax(e.target.value)}
                                  placeholder="Max"
                                />
                              </div>
                            </td>
                            <td style={{ paddingLeft: '14px' }}>
                              <ResultBadge result={livePass} />
                            </td>
                            <td className="sub-actions-cell">
                              <div className="sub-actions-group">
                                <button
                                  type="button"
                                  className="btn-save-sm"
                                  title="Save changes to this entry"
                                  onClick={() => handleSaveTest(test.id)}
                                  disabled={savingTest}
                                >
                                  <CheckIcon />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-cancel-sm"
                                  title="Cancel editing"
                                  onClick={cancelEditingTest}
                                  disabled={savingTest}
                                >
                                  <CancelIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={test.id || i} className="sub-row">
                          <td className="sub-test-label">{test.test_label}</td>
                          <td className="col-num sub-unit">{test.test_point_unit || '—'}</td>
                          <td className="col-num">{test.reference_value !== null && test.reference_value !== undefined ? test.reference_value : '—'}</td>
                          <td className="col-num">{test.actual_value}</td>
                          <td className={`col-num ${getDeviationClass(test.deviation)}`}>
                            {test.deviation !== null && test.deviation !== undefined ? (Number(test.deviation) > 0 ? '+' : '') + test.deviation : '—'}
                          </td>
                          <td className="col-num">[{test.min_value}, {test.max_value}]</td>
                          <td style={{ paddingLeft: '14px' }}><ResultBadge result={test.result} /></td>
                          <td className="sub-actions-cell">
                            <div className="sub-actions-group">
                              {onUpdateTest && (
                                <button
                                  type="button"
                                  className="btn-edit-sm"
                                  title="Edit this test measurement entry"
                                  onClick={() => startEditingTest(test)}
                                >
                                  <PencilIcon />
                                  <span>Edit</span>
                                </button>
                              )}
                              {onDeleteTest && (
                                <button
                                  type="button"
                                  className="btn-delete-sm"
                                  title="Delete this specific test measurement entry"
                                  onClick={() => onDeleteTest(test.id, test.test_label)}
                                >
                                  <TrashIcon />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {computedTests.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                          No test measurement entries found in this record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {session.accessory_model && (
                  <p className="session-cert">
                    <strong>Accessory Model:</strong> {session.accessory_model}
                    {session.accessory_serial && <> &nbsp;|&nbsp; <strong>Serial:</strong> {session.accessory_serial}</>}
                  </p>
                )}
              </div>
            </td>
          </tr>
        </>
      )}
    </>
  );
}

/**
 * @param {{
 *   records: Array,
 *   serialNumber: string,
 *   onDeleteRecord?: Function,
 *   onUpdateRecord?: Function,
 *   onDeleteTest?: Function,
 *   onUpdateTest?: Function
 * }} props
 */
export default function CalibrationHistoryTable({
  records,
  serialNumber,
  onDeleteRecord,
  onUpdateRecord,
  onDeleteTest,
  onUpdateTest,
}) {
  if (!records?.length) {
    return (
      <div className="empty-state">
        <TableIcon />
        <h3>No calibration records</h3>
        <p>No historical calibration data found for this device.</p>
      </div>
    );
  }

  return (
    <div className="cal-history-table-wrap">
      <p className="cal-history-hint">
        Click a year row to expand and view or edit the individual test entries for that calibration session.
      </p>
      <table className="data-table cal-history-table" aria-label="Calibration history">
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left' }}>Year</th>
            <th scope="col" style={{ textAlign: 'left' }}>Certificate No.</th>
            <th scope="col" style={{ textAlign: 'left' }}>Accessory Type</th>
            <th scope="col" className="col-num" style={{ textAlign: 'right' }}>Tests</th>
            <th scope="col" style={{ textAlign: 'left' }}>Summary</th>
            <th scope="col" style={{ textAlign: 'left' }}>Overall</th>
            <th scope="col" style={{ textAlign: 'center', width: '100px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((session) => (
            <YearRow
              key={session.id || session.calibration_year}
              session={session}
              serialNumber={serialNumber}
              onDeleteRecord={onDeleteRecord}
              onUpdateRecord={onUpdateRecord}
              onDeleteTest={onDeleteTest}
              onUpdateTest={onUpdateTest}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TableIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);