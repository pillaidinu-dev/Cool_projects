import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from './Card.jsx';
import { formatDate, pct, signed } from '../stats.js';

const ALL = '#0284c7';
const TOP = '#d97706';

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs shadow-xl tabular-nums">
      <p className="font-semibold text-slate-100">{formatDate(row.date)}</p>
      <p className="text-slate-300">
        Every lean: {signed(row.units)}u that day <span className="text-slate-500">({row.hits}/{row.n}, {pct(row.hitRate)})</span>
      </p>
      <p className="text-slate-300">
        Top 10: {signed(row.top.units)}u <span className="text-slate-500">({row.top.hits}/{row.top.n})</span>
      </p>
      <p className="text-slate-400 mt-1">
        Season ROI: {pct(row.allRoi, 1)} all · {pct(row.topRoi, 1)} top 10
      </p>
    </div>
  );
}

// Season-to-date ROI (units won per unit staked at fair L10 prices) —
// both series are the same measure on the same scale, so they share one axis.
export default function HitRateChart({ days }) {
  const data = days.reduce((rows, d) => {
    const prev = rows.at(-1) || { su: 0, sn: 0, tu: 0, tn: 0 };
    const next = { su: prev.su + d.units, sn: prev.sn + d.n, tu: prev.tu + d.top.units, tn: prev.tn + d.top.n };
    return [...rows, { ...d, ...next, allRoi: next.su / next.sn, topRoi: next.tn ? next.tu / next.tn : null }];
  }, []);

  return (
    <Card title="Season-to-date ROI" aside="units won per unit staked, at L10-fair odds · 0% = no edge">
      {data.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">
          Nothing graded yet — the first slate is graded the morning after it&apos;s played.
        </p>
      ) : (
        <div style={{ width: '100%', height: 260 }} className="pt-3 pr-4">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatDate(d, { month: 'short', day: 'numeric' })}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis tickFormatter={(v) => pct(v)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#475569' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} iconType="plainline" />
              <Line name="Every lean" dataKey="allRoi" stroke={ALL} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line name="Daily top 10" dataKey="topRoi" stroke={TOP} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
