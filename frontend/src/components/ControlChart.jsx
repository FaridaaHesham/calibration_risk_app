// src/components/ControlChart.jsx
// Line chart visualizing the 'closeness-to-edge' score over time.
// Renders the calibration scores against the 80% warning and 100% failure limits.

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
import './ControlChart.css';

const WARNING_THRESHOLD = 80.0;
const FAILURE_LIMIT = 100.0;

function isFailResult(result) {
  return (result || '').trim().toLowerCase() === 'fail';
}

/** Plain-language label for a score, shown alongside the % in the tooltip. */
function scoreLabel(score, result) {
  if (score >= FAILURE_LIMIT || isFailResult(result)) return 'At the limit';
  if (score >= WARNING_THRESHOLD) return 'Getting close';
  return 'Comfortably within range';
}

// Custom dot: red if failed, orange if warning, blue otherwise
function ScoreDot(props) {
  const { cx, cy, payload } = props;
  const isFail = payload.score >= FAILURE_LIMIT || isFailResult(payload.result);
  const isWarning = !isFail && payload.score >= WARNING_THRESHOLD;

  let fill = 'var(--chart-value)';
  let r = 4;

  if (isFail) {
    fill = 'var(--danger)';
    r = 6;
  } else if (isWarning) {
    fill = 'var(--warning)';
    r = 5;
  }

  return (
    <Dot
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke="#fff"
      strokeWidth={1.5}
    />
  );
}

// Custom tooltip
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const isFail = d && (d.score >= FAILURE_LIMIT || isFailResult(d.result));
  const isWarning = d && !isFail && (d.score >= WARNING_THRESHOLD);

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-year">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="chart-tooltip-row" style={{ color: entry.color }}>
          <span>{entry.name}:</span>
          <strong>{entry.value?.toFixed ? entry.value.toFixed(1) : entry.value}%</strong>
        </p>
      ))}
      {d && <p className="chart-tooltip-row"><span>Result:</span> <strong>{isFailResult(d.result) ? 'Fail' : 'Pass'}</strong></p>}

      {d && (
        <p
          className="chart-tooltip-alert"
          style={{ color: isFail ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--success)' }}
        >
          {scoreLabel(d.score, d.result)}
        </p>
      )}
    </div>
  );
}

/**
 * Control chart component.
 * @param {{ data: Array<{year,score,result}> }} props
 */
export default function ControlChart({ data }) {
  if (!data?.length) return null;

  // Fixed axis: scores are now always capped at 100%, so the chart never
  // needs to rescale itself based on the data. A stable, predictable axis
  // is much easier for a non-technical viewer to read at a glance.
  const yDomain = [0, 105];

  return (
    <div className="control-chart-wrap">
      <div className="control-chart-legend-manual">
        <span className="legend-item legend-value">Closeness to Edge Score</span>
        <span className="legend-item" style={{ color: 'var(--warning)', fontWeight: 600 }}>Warning Threshold (80%)</span>
        <span className="legend-item" style={{ color: 'var(--danger)', fontWeight: 600 }}>Failure Limit (100%)</span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 12, right: 36, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />

          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-dark)' }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
          />

          <Tooltip content={<ChartTooltip />} />

          {/* Warning Threshold */}
          <ReferenceLine
            y={WARNING_THRESHOLD}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: `Warning`, position: 'right', fontSize: 11, fill: 'var(--warning)', fontWeight: 600 }}
          />

          {/* Failure Limit */}
          <ReferenceLine
            y={FAILURE_LIMIT}
            stroke="var(--danger)"
            strokeWidth={1.5}
            label={{ value: `Limit`, position: 'right', fontSize: 11, fill: 'var(--danger)', fontWeight: 600 }}
          />

          {/* Score line */}
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--chart-value)"
            strokeWidth={2}
            dot={<ScoreDot />}
            activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
            name="Score"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}