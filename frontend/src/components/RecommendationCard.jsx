// src/components/RecommendationCard.jsx
// Displays the recommended next calibration date and stability status.
//
// TODO: The `recommendation` prop is currently mock data.
//       When the real statistical engine is implemented in the backend
//       (see backend/app/routers/calibrations.py → get_chart_data),
//       this component will receive real output and requires no code changes.

import './RecommendationCard.css';

const STABILITY_CONFIG = {
  stable: {
    badge: 'badge-success',
    label: 'Stable',
    icon: '✓',
    cardClass: 'rec-card--stable',
  },
  marginal: {
    badge: 'badge-warning',
    label: 'Marginal',
    icon: '⚠',
    cardClass: 'rec-card--marginal',
  },
  unstable: {
    badge: 'badge-danger',
    label: 'Unstable',
    icon: '✕',
    cardClass: 'rec-card--unstable',
  },
};

function CalendarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

/**
 * @param {{ recommendation: { stability, label, nextDate, intervalYears, message } }} props
 */
export default function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;

  const config = STABILITY_CONFIG[recommendation.stability] || STABILITY_CONFIG.marginal;

  const formattedDate = (() => {
    try {
      return new Date(recommendation.nextDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return recommendation.nextDate;
    }
  })();

  return (
    <div className={`rec-card card ${config.cardClass}`}>
      <div className="rec-card-header">
        <div className="rec-card-icon-wrap">
          <CalendarIcon />
        </div>
        <div>
          <h3 className="rec-card-title">Next Calibration</h3>
          <p className="rec-card-subtitle">Recommended date based on stability analysis</p>
        </div>
        <span className={`badge ${config.badge} rec-card-badge`}>
          {config.icon} {config.label}
        </span>
      </div>

      <div className="rec-card-body">
        <div className="rec-card-date">{formattedDate}</div>
        <div className="rec-card-interval">
          Every {recommendation.intervalYears} year{recommendation.intervalYears !== 1 ? 's' : ''}
        </div>
        <p className="rec-card-message">{recommendation.message}</p>
      </div>

      {/* TODO: Replace the above hardcoded values with results from the
               real statistical calculation once the backend engine is ready.
               The real engine should set recommendation.stability,
               recommendation.nextDate, and recommendation.intervalYears. */}
    </div>
  );
}
