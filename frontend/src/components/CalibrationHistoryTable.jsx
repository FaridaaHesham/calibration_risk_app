// src/components/CalibrationHistoryTable.jsx
// Year-grouped calibration history with click-to-expand test rows.
// Each year row represents one calibration session; clicking it reveals
// the individual test records for that session.

import { useState } from 'react';
import './CalibrationHistoryTable.css';

function getDeviationClass(deviation) {
  const abs = Math.abs(Number(deviation));
  if (abs === 0)   return 'dev-zero';
  if (abs < 0.5)   return 'dev-low';
  if (abs < 1.0)   return 'dev-medium';
  return 'dev-high';
}

/**
 * Normalise a result string from the database (which may be stored as
 * "pass"/"fail"/"Pass"/"Fail"/etc.) into the canonical display form.
 */
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

/** Single expandable year row + its child test sub-rows */
function YearRow({ session }) {
  const [open, setOpen] = useState(false);

  // Compute test results dynamically from actual/min/max — this is the
  // source of truth, since it's derived directly from the measurements
  // shown in the table rather than a separately-stored status string.
  const computedTests = session.tests.map(t => {
    const isPass = t.actual_value >= t.min_value && t.actual_value <= t.max_value;
    return { ...t, result: isPass ? 'Pass' : 'Fail' };
  });

  const passCount = computedTests.filter(t => t.result === 'Pass').length;
  const failCount = computedTests.length - passCount;

  // Prefer the computed result (derived from the actual test rows we're
  // displaying) since it can never disagree with what the user sees below.
  // Only fall back to the stored session.result if there are no test rows
  // to compute from, and normalise its casing either way.
  const overallResult = computedTests.length > 0
    ? (failCount === 0 ? 'Pass' : 'Fail')
    : normalizeResult(session.result);

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
      </tr>

      {/* ── Expanded test sub-rows ── */}
      {open && (
        <>
          {/* Sub-header */}
          <tr className="subheader-row">
            <td colSpan={6}>
              <div className="subheader-inner">
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Test Parameter</th>
                      <th>Unit</th>
                      <th>Reference</th>
                      <th>Actual</th>
                      <th>Deviation</th>
                      <th>Tolerance</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedTests.map((test, i) => (
                      <tr key={i} className="sub-row">
                        <td className="sub-test-label">{test.test_label}</td>
                        <td className="col-num sub-unit">{test.test_point_unit || '—'}</td>
                        <td className="col-num">{test.reference_value}</td>
                        <td className="col-num">{test.actual_value}</td>
                        <td className={`col-num ${getDeviationClass(test.deviation)}`}>
                          {Number(test.deviation) > 0 ? '+' : ''}{test.deviation}
                        </td>
                        <td className="col-num">[{test.min_value}, {test.max_value}]</td>
                        <td><ResultBadge result={test.result} /></td>
                      </tr>
                    ))}
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
 * @param {{ records: Array }} props
 *   records — list of calibration_records from the backend API
 */
export default function CalibrationHistoryTable({ records }) {
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
        Click a year row to expand and view the individual tests performed in that calibration session.
      </p>
      <table className="data-table cal-history-table" aria-label="Calibration history">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Certificate No.</th>
            <th scope="col">Accessory Type</th>
            <th scope="col">Tests</th>
            <th scope="col">Summary</th>
            <th scope="col">Overall</th>
          </tr>
        </thead>
        <tbody>
          {records.map((session) => (
            <YearRow key={session.id || session.calibration_year} session={session} />
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