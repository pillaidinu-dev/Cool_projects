import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100">
        {row.name} <span className="text-slate-500">{row.team}</span>
      </p>
      <p className="text-slate-400 mt-0.5">vs {row.opponent}</p>
      <p className="mt-1 text-slate-200">
        Projected <span className="font-semibold tabular-nums">{row.projection}</span> {unit}
      </p>
      <p className="text-slate-500 tabular-nums">
        Range {row.low}–{row.high} {unit}
      </p>
    </div>
  );
}

export default function ProjectionChart({ title, unit, accent, rows, emptyMessage = 'No projections yet.' }) {
  const data = rows.map((r) => ({
    ...r,
    label: `${r.name}`,
    errorRange: [Math.max(r.projection - r.low, 0), Math.max(r.high - r.projection, 0)],
  }));
  const height = Math.max(data.length * 34, 120);

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
      {data.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div style={{ width: '100%', height }} className="pt-2 pb-1 pr-4">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
              <CartesianGrid horizontal={false} stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={112}
                tick={{ fill: '#cbd5e1', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="projection" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {data.map((row) => (
                  <Cell key={`${row.name}-${row.team}`} fill={accent} />
                ))}
                <ErrorBar dataKey="errorRange" stroke="#94a3b8" strokeWidth={1.5} width={4} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
