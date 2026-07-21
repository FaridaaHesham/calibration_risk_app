// src/components/CalibrationHistoryTable.jsx
// Table of past calibration records for a device.

import './CalibrationHistoryTable.css';

/**
 * @param {{ records: Array }} props
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
      <table className="data-table cal-history-table" aria-label="Calibration history">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Test</th>
            <th scope="col">Reference Value</th>
            <th scope="col">Actual Value</th>
            <th scope="col">Deviation</th>
            <th scope="col">Tolerance</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {[...records].reverse().map((rec, idx) => (
            <tr key={idx}>
              <td className="col-year">{rec.year}</td>
              <td>{rec.testLabel}</td>
              <td className="col-num">{rec.referenceValue}</td>
              <td className="col-num">{rec.actualValue}</td>
              <td className={`col-num ${getDeviationClass(rec.deviation)}`}>
                {rec.deviation > 0 ? '+' : ''}{rec.deviation}
              </td>
              <td className="col-num">{rec.tolerance}</td>
              <td>
                <span className={`badge ${rec.result === 'Pass' ? 'badge-success' : 'badge-danger'}`}>
                  {rec.result === 'Pass' ? '✓' : '✕'} {rec.result}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getDeviationClass(deviation) {
  const abs = Math.abs(deviation);
  if (abs === 0)   return 'dev-zero';
  if (abs < 0.5)   return 'dev-low';
  if (abs < 1.0)   return 'dev-medium';
  return 'dev-high';
}

const TableIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);
