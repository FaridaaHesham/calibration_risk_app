// src/components/RiskScorecard.jsx
// Displays a risk classification scorecard for a device.
//
// TODO: This entire component is a placeholder for the risk classification
//       feature. Real requirements and scoring logic are still to be defined.
//       See backend/app/routers/risk.py for the server-side counterpart.

import './RiskScorecard.css';

const RISK_CONFIG = {
  Low:    { cardClass: 'risk--low',    badge: 'badge-success', barColor: 'var(--success)' },
  Medium: { cardClass: 'risk--medium', badge: 'badge-warning', barColor: 'var(--warning)' },
  High:   { cardClass: 'risk--high',   badge: 'badge-danger',  barColor: 'var(--danger)'  },
};

const FACTOR_COLORS = {
  Low:    'var(--success)',
  Medium: 'var(--warning)',
  High:   'var(--danger)',
};

function ScoreBar({ score, maxScore, color }) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="score-bar-wrap" title={`${score} / ${maxScore}`}>
      <div
        className="score-bar-fill"
        style={{ width: `${pct}%`, background: color }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={maxScore}
      />
    </div>
  );
}

/**
 * @param {{ data: object|null, loading: boolean }} props
 */
export default function RiskScorecard({ data, loading }) {
  if (loading) {
    return (
      <div className="card risk-card-loading">
        <div className="spinner-wrap"><div className="spinner" /> Loading risk data…</div>
      </div>
    );
  }

  if (!data) return null;

  const config = RISK_CONFIG[data.riskLevel] || RISK_CONFIG.Medium;
  const overallPct = Math.round((data.riskScore / data.maxScore) * 100);

  return (
    <div className={`risk-scorecard card ${config.cardClass}`}>
      {/* Header */}
      <div className="risk-header">
        <div className="risk-icon-wrap">
          <ShieldIcon />
        </div>
        <div className="risk-header-text">
          <h2>Risk Classification</h2>
          <p className="risk-subtitle">
            Last assessed: {new Date(data.lastAssessed).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className={`badge ${config.badge} risk-level-badge`}>
          {data.riskLevel} Risk
        </span>
      </div>

      {/* Overall score */}
      <div className="risk-overall">
        <div className="risk-overall-label">
          <span>Overall Risk Score</span>
          <span className="risk-overall-num">{data.riskScore} / {data.maxScore}</span>
        </div>
        <ScoreBar score={data.riskScore} maxScore={data.maxScore} color={config.barColor} />
        <div className="risk-overall-pct">{overallPct}%</div>
      </div>

      {/* Factor breakdown */}
      <div className="risk-factors">
        <h3 className="risk-factors-title">Factor Breakdown</h3>
        <table className="data-table risk-table" aria-label="Risk factor breakdown">
          <thead>
            <tr>
              <th scope="col">Factor</th>
              <th scope="col">Score</th>
              <th scope="col">Level</th>
              <th scope="col" style={{ width: 140 }}>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {data.factors.map((f) => (
              <tr key={f.factor}>
                <td className="factor-name">{f.factor}</td>
                <td className="col-num">{f.score} / {f.maxScore}</td>
                <td>
                  <span className={`badge ${RISK_CONFIG[f.level]?.badge || 'badge-muted'}`}>
                    {f.level}
                  </span>
                </td>
                <td>
                  <ScoreBar
                    score={f.score}
                    maxScore={f.maxScore}
                    color={FACTOR_COLORS[f.level] || 'var(--text-muted)'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recommendation */}
      <div className="risk-recommendation">
        <strong>Recommendation:</strong> {data.recommendation}
      </div>
    </div>
  );
}

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
