import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { money } from '../format.js';
import { CHART, SERIES } from '../theme.js';
import { Card, ChartTooltipBox } from './ui.jsx';

function AllocationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-ink">{s.symbol}</p>
      <p className="tabular-nums text-ink-2">
        {money(s.value)} · {s.percent.toFixed(1)}%
      </p>
    </ChartTooltipBox>
  );
}

export default function AllocationChart({ holdings, colorFor }) {
  const open = holdings.filter((h) => h.shares > 0 && h.marketValue > 0);
  const total = open.reduce((acc, h) => acc + h.marketValue, 0);
  // Holdings without a colour slot share one "Other" slice.
  const slices = [];
  let other = 0;
  for (const h of open) {
    if (colorFor(h.symbol) === CHART.other && open.length > SERIES.length) other += h.marketValue;
    else slices.push({ symbol: h.symbol, value: h.marketValue, color: colorFor(h.symbol) });
  }
  slices.sort((a, b) => b.value - a.value);
  if (other > 0) slices.push({ symbol: 'Other', value: other, color: CHART.other });
  for (const s of slices) s.percent = total > 0 ? (s.value / total) * 100 : 0;

  return (
    <Card title="Allocation">
      {slices.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No open positions.</p>
      ) : (
        <div className="p-4 flex flex-col sm:flex-row items-center gap-6">
          <div className="size-44 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="symbol"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke={CHART.surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.symbol} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<AllocationTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
            {slices.map((s) => (
              <li key={s.symbol} className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm shrink-0" style={{ background: s.color }} aria-hidden="true" />
                <span className="font-medium">{s.symbol}</span>
                <span className="ml-auto tabular-nums text-ink-2">{s.percent.toFixed(1)}%</span>
                <span className="w-16 text-right tabular-nums text-muted">{money(s.value, 'USD', { compact: true })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
