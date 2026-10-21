import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, signedMoney } from '../format.js';
import { AXIS_TICK, CHART } from '../theme.js';
import { Card, ChartTooltipBox, Delta } from './ui.jsx';

// Value label at the outer end of the bar: right of a gain, left of a loss.
function EndLabel({ x, y, width, height, value }) {
  const left = Math.min(x, x + width);
  const right = Math.max(x, x + width);
  const gain = value >= 0;
  return (
    <text
      x={gain ? right + 6 : left - 6}
      y={y + height / 2}
      dy="0.35em"
      textAnchor={gain ? 'start' : 'end'}
      fill={CHART.ink2}
      fontSize={11}
    >
      {signedMoney(value, 'USD', { compact: true })}
    </text>
  );
}

function ProfitTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const h = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-ink">{h.symbol}</p>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
        <dt className="text-muted">Unrealized</dt>
        <dd className="text-right">
          <Delta value={h.unrealized} />
        </dd>
        <dt className="text-muted">Realized</dt>
        <dd className="text-right">
          <Delta value={h.realized} />
        </dd>
        <dt className="text-muted">Cost basis</dt>
        <dd className="text-right text-ink-2">{money(h.costBasis)}</dd>
      </dl>
    </ChartTooltipBox>
  );
}

export default function ProfitBars({ holdings }) {
  const rows = [...holdings].sort((a, b) => b.totalPnl - a.totalPnl);
  const height = Math.max(rows.length * 36 + 16, 120);
  // Leave room past each bar's outer end for its value label.
  const values = rows.map((h) => h.totalPnl);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = (hi - lo || 1) * 0.18;
  const domain = [lo < 0 ? lo - pad : 0, hi > 0 ? hi + pad : 0];
  return (
    <Card title="Profit by ticker" right={<span className="text-xs text-muted">Unrealized + realized</span>}>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No trades yet.</p>
      ) : (
        <div style={{ height }} className="px-2 py-2">
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <XAxis type="number" hide domain={domain} />
              <YAxis
                type="category"
                dataKey="symbol"
                width={56}
                tick={{ ...AXIS_TICK, fill: CHART.ink2, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke={CHART.axis} />
              <Tooltip content={<ProfitTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="totalPnl" maxBarSize={16} radius={4} isAnimationActive={false}>
                {rows.map((h) => (
                  <Cell key={h.symbol} fill={h.totalPnl >= 0 ? CHART.gain : CHART.loss} />
                ))}
                <LabelList dataKey="totalPnl" content={<EndLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
