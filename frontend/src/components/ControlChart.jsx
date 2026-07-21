// src/components/ControlChart.jsx
// Recharts-based Statistical Process Control (SPC) chart.
// Renders measurement values over time with UCL, LCL, and Mean reference lines.

import {
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import './ControlChart.css';

// Custom dot: red if outside control limits, blue otherwise
function ControlDot(props) {
  const { cx, cy, payload } = props;
  const isOutOfControl = payload.value > payload.ucl || payload.value < payload.lcl;
  const fill = isOutOfControl ? 'var(--danger)' : 'var(--chart-value)';
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={isOutOfControl ? 6 : 4}
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
  const isOut = d && (d.value > d.ucl || d.value < d.lcl);
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-year">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="chart-tooltip-row" style={{ color: entry.color }}>
          <span>{entry.name}:</span>
          <strong>{entry.value?.toFixed ? entry.value.toFixed(3) : entry.value}</strong>
        </p>
      ))}
      {isOut && (
        <p className="chart-tooltip-alert">⚠ Out of control limits</p>
      )}
    </div>
  );
}

/**
 * Control chart component.
 * @param {{ data: Array<{year,value,mean,ucl,lcl}> }} props
 */
export default function ControlChart({ data }) {
  if (!data?.length) return null;

  // Compute Y-axis domain with padding
  const allVals = data.flatMap((d) => [d.value, d.ucl, d.lcl]);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const pad = (max - min) * 0.15 || 0.5;
  const yDomain = [
    parseFloat((min - pad).toFixed(3)),
    parseFloat((max + pad).toFixed(3)),
  ];

  // UCL / LCL / mean are constant — grab from first point
  const { ucl, lcl, mean } = data[0];

  return (
    <div className="control-chart-wrap">
      <div className="control-chart-legend-manual">
        <span className="legend-item legend-value">● Measured Value</span>
        <span className="legend-item legend-mean">— Center Line (Mean)</span>
        <span className="legend-item legend-limit">- - UCL / LCL</span>
        <span className="legend-item legend-oc">● Out of Control</span>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 16 }}>
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
            width={60}
            tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(1) : v)}
          />

          <Tooltip content={<ChartTooltip />} />

          {/* UCL */}
          <ReferenceLine
            y={ucl}
            stroke="var(--chart-ucl)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `UCL ${ucl}`, position: 'right', fontSize: 11, fill: 'var(--danger)', fontWeight: 600 }}
          />

          {/* Mean (CL) */}
          <ReferenceLine
            y={mean}
            stroke="var(--chart-mean)"
            strokeWidth={1.5}
            label={{ value: `CL ${mean}`, position: 'right', fontSize: 11, fill: 'var(--success)', fontWeight: 600 }}
          />

          {/* LCL */}
          <ReferenceLine
            y={lcl}
            stroke="var(--chart-lcl)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{ value: `LCL ${lcl}`, position: 'right', fontSize: 11, fill: 'var(--danger)', fontWeight: 600 }}
          />

          {/* Measurement line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-value)"
            strokeWidth={2}
            dot={<ControlDot />}
            activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
            name="Measured"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
