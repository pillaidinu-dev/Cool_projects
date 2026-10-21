import { Bar, BarChart, CartesianGrid, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from './Card.jsx';
import { lean, pct } from '../stats.js';

const BAR_COLOR = '#0284c7';

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100">
        {row.name} <span className="text-slate-500">{row.team}</span>
      </p>
      <p className="text-slate-400 mt-0.5">
        {row.home ? 'vs' : '@'} {row.opp}
      </p>
      <p className="mt-1 text-slate-200">
        Projected <span className="font-semibold tabular-nums">{row.proj}</span> {unit}
        <span className="text-slate-500 tabular-nums"> ({row.lo}–{row.hi})</span>
      </p>
      <p className="text-slate-400 tabular-nums">
        Line {row.line} · {lean(row) === 'over' ? 'Over' : 'Under'} {pct(Math.max(row.pOver, 1 - row.pOver))}
      </p>
    </div>
  );
}

// Top projections for one market, with each bar's low–high band.
export default function ProjectionChart({ title, unit, rows }) {
  const data = rows.map((r) => ({
    ...r,
    errorRange: [Math.max(r.proj - r.lo, 0), Math.max(r.hi - r.proj, 0)],
  }));
  const height = Math.max(data.length * 30, 120);

  return (
    <Card title={title} aside="projection · bar = likely range">
      {data.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">No projections for this market.</p>
      ) : (
        <div style={{ width: '100%', height }} className="pt-2 pb-1 pr-4">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
              <CartesianGrid horizontal={false} stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={128}
                tick={{ fill: '#cbd5e1', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="proj" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={14}>
                <ErrorBar dataKey="errorRange" stroke="#94a3b8" strokeWidth={1.5} width={4} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
