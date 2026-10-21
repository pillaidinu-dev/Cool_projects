import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { axisMoney, longDate, money, shortDate, signedMoney } from '../format.js';

// Categorical hues stepped for a dark surface, assigned in this fixed order
// by the ticker's position in the (alphabetical) holdings list so a ticker
// keeps its color as long as the set of holdings doesn't change.
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const MAX_SERIES = SERIES_COLORS.length;

const GAIN = '#34d399';
const LOSS = '#fb7185';
const GRID = '#1e293b';
const AXIS = '#64748b';
const SURFACE = '#0f172a';

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID },
};

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      <div className="mt-3 h-72">{children}</div>
    </div>
  );
}

function TooltipBox({ label, rows }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-100 mb-1">{longDate(label)}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 text-slate-300">
          {r.color && <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-slate-400">{r.name}</span>
          <span className="ml-auto pl-4 tabular-nums text-slate-100">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

// Where zero sits in the profit range, as a 0..1 offset from the top, so the
// area's fill can switch from gain to loss color exactly at the zero line.
function zeroOffset(points) {
  const values = points.map((p) => p.profit);
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

export function ProfitChart({ points }) {
  const off = zeroOffset(points);
  const last = points.at(-1);
  return (
    <ChartCard
      title="Profit / loss over time"
      subtitle={last ? `${signedMoney(last.profit)} as of ${longDate(last.date)}` : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="profitStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor={GAIN} />
              <stop offset={off} stopColor={LOSS} />
            </linearGradient>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={GAIN} stopOpacity={0.35} />
              <stop offset={off} stopColor={GAIN} stopOpacity={0.05} />
              <stop offset={off} stopColor={LOSS} stopOpacity={0.05} />
              <stop offset={1} stopColor={LOSS} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} {...axisProps} />
          <YAxis tickFormatter={axisMoney} width={64} {...axisProps} />
          <ReferenceLine y={0} stroke={AXIS} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={label}
                  rows={[
                    { name: 'Profit', value: signedMoney(payload[0].payload.profit) },
                    { name: 'Value', value: money(payload[0].payload.value) },
                    { name: 'Cost basis', value: money(payload[0].payload.cost) },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="url(#profitStroke)"
            strokeWidth={2}
            fill="url(#profitFill)"
            activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2, fill: last && last.profit < 0 ? LOSS : GAIN }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ValueChart({ points }) {
  return (
    <ChartCard title="Value vs. cost basis" subtitle="Cost basis steps up on each new purchase">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} {...axisProps} />
          <YAxis tickFormatter={axisMoney} width={64} domain={['auto', 'auto']} {...axisProps} />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={label}
                  rows={payload.map((p) => ({ name: p.name, value: money(p.value), color: p.color }))}
                />
              ) : null
            }
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          <Line
            type="monotone"
            dataKey="value"
            name="Value"
            stroke={SERIES_COLORS[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="cost"
            name="Cost basis"
            stroke={AXIS}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TickerProfitChart({ points, symbols }) {
  // Past eight tickers a ninth hue would be unreadable; show the eight with
  // the biggest absolute profit today and say so.
  const latest = points.at(-1) || {};
  const shown =
    symbols.length <= MAX_SERIES
      ? symbols
      : [...symbols].sort((a, b) => Math.abs(latest[b] ?? 0) - Math.abs(latest[a] ?? 0)).slice(0, MAX_SERIES).sort();
  const colorOf = (symbol) => SERIES_COLORS[symbols.indexOf(symbol) % MAX_SERIES];

  return (
    <ChartCard
      title="Profit by ticker"
      subtitle={
        symbols.length > MAX_SERIES ? `Showing the ${MAX_SERIES} tickers with the largest profit or loss` : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} {...axisProps} />
          <YAxis tickFormatter={axisMoney} width={64} {...axisProps} />
          <ReferenceLine y={0} stroke={AXIS} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={label}
                  rows={[...payload]
                    .sort((a, b) => b.value - a.value)
                    .map((p) => ({ name: p.name, value: signedMoney(p.value), color: p.color }))}
                />
              ) : null
            }
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          {shown.map((symbol) => (
            <Line
              key={symbol}
              type="monotone"
              dataKey={symbol}
              name={symbol}
              stroke={colorOf(symbol)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
