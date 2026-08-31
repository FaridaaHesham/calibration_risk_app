// src/components/RecommendationCard.jsx
// Displays the recommended next calibration date and stability status.
// Driven by the statistical prediction engine output.

import './RecommendationCard.css';

const STABILITY_CONFIG = {
  stable: {
    badge: 'badge-success',
    label: 'Stable',
    cardClass: 'rec-card--stable',
  },
  marginal: {
    badge: 'badge-warning',
    label: 'Marginal',
    cardClass: 'rec-card--marginal',
  },
  unstable: {
    badge: 'badge-danger',
    label: 'Unstable',
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
 * @param {{ recommendation: { stability, label, next_date, interval_years, message } }} props
 */
export default function RecommendationCard({ recommendation }) {
  if (!recommendation) return null;

  const config = STABILITY_CONFIG[recommendation.stability] || STABILITY_CONFIG.marginal;

  const formattedDate = (() => {
    if (!recommendation.next_date) return 'N/A';
    try {
      const d = new Date(recommendation.next_date);
      if (isNaN(d.getTime())) {
        return recommendation.next_date;
      }
      return d.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return recommendation.next_date;
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
          {config.label}
        </span>
      </div>

      <div className="rec-card-body">
        <div className="rec-card-date">{formattedDate}</div>
        <div className="rec-card-interval">
          Every {recommendation.interval_years} year{recommendation.interval_years !== 1 ? 's' : ''}
        </div>
        <p className="rec-card-message">{recommendation.message}</p>

        {recommendation.reasoning && (
          <div className="rec-card-reasoning-wrap" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.08)', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Why this recommendation?</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
              {recommendation.reasoning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
