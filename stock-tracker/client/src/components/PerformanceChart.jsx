import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { longDate, money, shortDate, signedMoney } from '../format.js';
import { AXIS_TICK, CHART, RANGES } from '../theme.js';
import { Card, ChartTooltipBox, Delta, Segmented } from './ui.jsx';

function PerformanceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-ink">{longDate(p.date)}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-muted">Value</dt>
        <dd className="text-right text-ink">{money(p.value)}</dd>
        <dt className="text-muted">Cost basis</dt>
        <dd className="text-right text-ink-2">{money(p.cost)}</dd>
        <dt className="text-muted">Total profit</dt>
        <dd className="text-right">
          <Delta value={p.pnl} />
        </dd>
      </dl>
    </ChartTooltipBox>
  );
}

function LegendKey({ color, dashed, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <svg width="18" height="8" aria-hidden="true">
        <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  );
}

export default function PerformanceChart({ series, range, onRangeChange, loading }) {
  const [mode, setMode] = useState('value');
  const first = series[0];
  const last = series[series.length - 1];
  const rangePnl = first && last ? last.pnl - first.pnl : null;

  // Split the profit area's gradient at zero so the fill turns red below
  // the baseline.
  const pnls = series.map((p) => p.pnl);
  const max = Math.max(0, ...pnls);
  const min = Math.min(0, ...pnls);
  const zeroAt = max === min ? 0.5 : max / (max - min);

  return (
    <Card
      title="Performance"
      right={
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            label="Chart"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'value', label: 'Value vs cost' },
              { value: 'pnl', label: 'Profit' },
            ]}
          />
          <Segmented label="Range" value={range} onChange={onRangeChange} options={RANGES} />
        </div>
      }
    >
      <div className="px-4 pt-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted">
          Profit over {range === 'ALL' ? 'all time' : range}:{' '}
          <Delta value={rangePnl} className="font-semibold" />
        </p>
        {mode === 'value' ? (
          <div className="flex gap-4">
            <LegendKey color={CHART.accent} label="Market value" />
            <LegendKey color={CHART.muted} dashed label="Cost basis" />
          </div>
        ) : (
          <p className="text-xs text-muted">Unrealized + realized profit, by day</p>
        )}
      </div>
      {series.length < 2 ? (
        <p className="px-4 py-12 text-sm text-muted text-center">
          {loading ? 'Loading price history…' : 'Not enough price history for this range yet.'}
        </p>
      ) : (
        <div className="h-72 sm:h-80 px-1 pb-2 pt-2">
          <ResponsiveContainer>
            <ComposedChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="pnlStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={zeroAt} stopColor={CHART.gain} />
                  <stop offset={zeroAt} stopColor={CHART.loss} />
                </linearGradient>
                <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={CHART.gain} stopOpacity={0.25} />
                  <stop offset={zeroAt} stopColor={CHART.gain} stopOpacity={0.04} />
                  <stop offset={zeroAt} stopColor={CHART.loss} stopOpacity={0.04} />
                  <stop offset="1" stopColor={CHART.loss} stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.axis }}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                tickFormatter={(v) => (mode === 'pnl' ? signedMoney(v, 'USD', { compact: true }) : money(v, 'USD', { compact: true }))}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={64}
                domain={mode === 'pnl' ? ['auto', 'auto'] : [(d) => Math.max(0, d * 0.95), 'auto']}
              />
              <Tooltip content={<PerformanceTooltip />} cursor={{ stroke: CHART.muted, strokeWidth: 1 }} />
              {mode === 'value' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={CHART.accent}
                    strokeWidth={2}
                    fill="url(#valueFill)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="cost"
                    stroke={CHART.muted}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
                  />
                </>
              ) : (
                <>
                  <ReferenceLine y={0} stroke={CHART.axis} />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="url(#pnlStroke)"
                    strokeWidth={2}
                    fill="url(#pnlFill)"
                    baseValue={0}
                    isAnimationActive={false}
                    activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
