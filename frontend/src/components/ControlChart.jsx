// src/components/ControlChart.jsx
// Line chart visualizing the signed closeness-to-edge score over time (bidirectional).

import { useEffect, useState } from 'react';
import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';

import { getPredictionSettings } from '../api/devices';
import './ControlChart.css';

// The failure limit is fixed at ±100%.
// The warning threshold comes from the prediction settings.
const FAILURE_LIMIT = 100;

function isFailResult(result) {
  return (result || '').trim().toLowerCase() === 'fail';
}

/**
 * Plain-language label for a score.
 */
function scoreLabel(score, result, warningThreshold) {
  if (score >= FAILURE_LIMIT || isFailResult(result)) {
    return 'At the limit';
  }

  if (score >= warningThreshold) {
    return 'Getting close';
  }

  return 'Comfortably within range';
}

/**
 * Single source of truth for status coloring.
 *
 * Positive/negative values determine the normal safe color.
 * Warning values are orange.
 * Limit/fail values are red.
 */
function scoreColor(val, result, warningThreshold) {
  const absVal = Math.abs(val);

  const isFail =
    absVal >= FAILURE_LIMIT || isFailResult(result);

  const isWarning =
    !isFail && absVal >= warningThreshold;

  if (isFail) {
    return 'var(--danger)';
  }

  if (isWarning) {
    return 'var(--warning)';
  }

  // Positive = under-reading
  // Negative = over-reading
  return val >= 0
    ? 'var(--success)'
    : 'var(--primary-light)';
}

function scoreValue(payload) {
  return payload.signed_score !== undefined &&
    payload.signed_score !== null
    ? payload.signed_score
    : payload.score;
}

// Custom dot
function ScoreDot(props) {
  const {
    cx,
    cy,
    payload,
    warningThreshold,
  } = props;

  const val = scoreValue(payload);
  const absVal = Math.abs(val);

  const isFail =
    absVal >= FAILURE_LIMIT ||
    isFailResult(payload.result);

  const isWarning =
    !isFail && absVal >= warningThreshold;

  const r = isFail
    ? 6
    : isWarning
      ? 5
      : 4;

  return (
    <Dot
      cx={cx}
      cy={cy}
      r={r}
      fill={scoreColor(
        val,
        payload.result,
        warningThreshold
      )}
      stroke="#fff"
      strokeWidth={1.5}
    />
  );
}

// Custom active/hover dot
function ActiveScoreDot(props) {
  const {
    cx,
    cy,
    payload,
    warningThreshold,
  } = props;

  const val = scoreValue(payload);

  return (
    <Dot
      cx={cx}
      cy={cy}
      r={7}
      fill={scoreColor(
        val,
        payload.result,
        warningThreshold
      )}
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

// Custom tooltip
function ChartTooltip({
  active,
  payload,
  label,
  warningThreshold,
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const d = payload[0]?.payload;

  const val =
    d.signed_score !== undefined &&
    d.signed_score !== null
      ? d.signed_score
      : d.score;

  const absVal = Math.abs(val);

  const isFail =
    absVal >= FAILURE_LIMIT ||
    isFailResult(d.result);

  const isWarning =
    !isFail && absVal >= warningThreshold;

  return (
    <div className="chart-tooltip">

      <p className="chart-tooltip-year">
        {label}
      </p>

      <p
        className="chart-tooltip-row"
        style={{
          color: scoreColor(
            val,
            d.result,
            warningThreshold
          ),
        }}
      >
        <span>Closeness to Edge:</span>

        <strong>
          {val > 0 ? '+' : ''}
          {val?.toFixed
            ? val.toFixed(1)
            : val}
          %
        </strong>
      </p>

      {d.signed_deviation !== undefined &&
        d.signed_deviation !== null && (
          <p
            className="chart-tooltip-row"
            style={{ color: '#8884d8' }}
          >
            <span>Signed Deviation:</span>

            <strong>
              {d.signed_deviation > 0 ? '+' : ''}
              {d.signed_deviation?.toFixed
                ? d.signed_deviation.toFixed(4)
                : d.signed_deviation}
            </strong>
          </p>
        )}

      <p className="chart-tooltip-row">
        <span>Result:</span>

        <strong>
          {isFailResult(d.result)
            ? 'Fail'
            : 'Pass'}
        </strong>
      </p>

      <p
        className="chart-tooltip-alert"
        style={{
          color: isFail
            ? 'var(--danger)'
            : isWarning
              ? 'var(--warning)'
              : 'var(--success)',
        }}
      >
        {scoreLabel(
          absVal,
          d.result,
          warningThreshold
        )}
      </p>

    </div>
  );
}

/**
 * Control chart component.
 *
 * @param {{
 *   data: Array<{
 *     year,
 *     score,
 *     signed_score,
 *     result,
 *     signed_deviation
 *   }>
 * }} props
 */
export default function ControlChart({ data }) {

  // Prediction settings loaded from backend
  const [settings, setSettings] = useState(null);

  // Load prediction settings once
  useEffect(() => {
    getPredictionSettings()
      .then((result) => {
        console.log(
          'Prediction settings:',
          result
        );

        setSettings(result);
      })
      .catch((err) => {
        console.error(
          'Failed to load prediction settings:',
          err
        );
      });
  }, []);

  // Don't render until we have data and settings
  if (!data?.length || !settings) {
    return null;
  }

  // Warning threshold comes from backend settings
  const WARNING_THRESHOLD = Number(
    settings.edge_warning_threshold
  );

  // Fixed failure limit
  const FAILURE_LIMIT_LOCAL = 100;

  // Safety check in case the backend sends an invalid value
  if (!Number.isFinite(WARNING_THRESHOLD)) {
    console.error(
      'Invalid edge_warning_threshold:',
      settings.edge_warning_threshold
    );

    return null;
  }

  // Fixed axis
  const yDomain = [-105, 105];

  return (
    <div className="control-chart-wrap">

      {/* Legend */}
      <div
        className="control-chart-legend-manual"
        style={{ marginBottom: '12px' }}
      >

        <span className="legend-item legend-value">
          Signed Closeness Score
        </span>

        <span
          className="legend-item"
          style={{
            color: 'var(--success)',
          }}
        >
          Positive (+): Under-reading
          (Ref &gt; Actual)
        </span>

        <span
          className="legend-item"
          style={{
            color: 'var(--primary-light)',
          }}
        >
          Negative (-): Over-reading
          (Ref &lt; Actual)
        </span>

        <span
          className="legend-item"
          style={{
            color: 'var(--warning)',
            fontWeight: 600,
          }}
        >
          Warning (±{WARNING_THRESHOLD}%)
        </span>

        <span
          className="legend-item"
          style={{
            color: 'var(--danger)',
            fontWeight: 600,
          }}
        >
          Limit (±100%)
        </span>

      </div>

      <ResponsiveContainer
        width="100%"
        height={420}
      >

        <ComposedChart
          data={data}
          margin={{
            top: 12,
            right: 92,
            bottom: 8,
            left: 16,
          }}
        >

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#E2E8F0"
            vertical={false}
          />

          <XAxis
            dataKey="year"
            tick={{
              fontSize: 12,
              fill: 'var(--text-muted)',
            }}
            tickLine={false}
            axisLine={{
              stroke: 'var(--border-dark)',
            }}
          />

          <YAxis
            domain={yDomain}
            tick={{
              fontSize: 12,
              fill: 'var(--text-muted)',
            }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v) =>
              v > 0
                ? `+${v.toFixed(0)}%`
                : `${v.toFixed(0)}%`
            }
          />

          <Tooltip
            content={(props) => (
              <ChartTooltip
                {...props}
                warningThreshold={
                  WARNING_THRESHOLD
                }
              />
            )}
          />

          {/* Perfect zero reference line */}
          <ReferenceLine
            y={0}
            stroke="#A0AEC0"
            strokeWidth={1.5}
            label={{
              value: 'Perfect (0%)',
              position: 'right',
              fontSize: 11,
              fill: '#718096',
              fontWeight: 600,
            }}
          />

          {/* Positive warning threshold */}
          <ReferenceLine
            y={WARNING_THRESHOLD}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Warning +${WARNING_THRESHOLD}%`,
              position: 'right',
              fontSize: 11,
              fill: 'var(--warning)',
              fontWeight: 600,
            }}
          />

          {/* Negative warning threshold */}
          <ReferenceLine
            y={-WARNING_THRESHOLD}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Warning -${WARNING_THRESHOLD}%`,
              position: 'right',
              fontSize: 11,
              fill: 'var(--warning)',
              fontWeight: 600,
            }}
          />

          {/* Positive failure limit */}
          <ReferenceLine
            y={FAILURE_LIMIT_LOCAL}
            stroke="var(--danger)"
            strokeWidth={1.5}
            label={{
              value: 'Limit +100%',
              position: 'right',
              fontSize: 11,
              fill: 'var(--danger)',
              fontWeight: 600,
            }}
          />

          {/* Negative failure limit */}
          <ReferenceLine
            y={-FAILURE_LIMIT_LOCAL}
            stroke="var(--danger)"
            strokeWidth={1.5}
            label={{
              value: 'Limit -100%',
              position: 'right',
              fontSize: 11,
              fill: 'var(--danger)',
              fontWeight: 600,
            }}
          />

          {/* Score line */}
          <Line
            type="monotone"

            dataKey={(d) =>
              d.signed_score !== undefined &&
              d.signed_score !== null
                ? d.signed_score
                : d.score
            }

            stroke="var(--chart-value)"
            strokeWidth={2}

            dot={(props) => (
              <ScoreDot
                {...props}
                warningThreshold={
                  WARNING_THRESHOLD
                }
              />
            )}

            activeDot={(props) => (
              <ActiveScoreDot
                {...props}
                warningThreshold={
                  WARNING_THRESHOLD
                }
              />
            )}

            name="Score"
          />

        </ComposedChart>

      </ResponsiveContainer>

    </div>
  );
}