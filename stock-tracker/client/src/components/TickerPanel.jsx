import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchTickerHistory } from '../api.js';
import { longDate, money, shares, shortDate } from '../format.js';
import { AXIS_TICK, CHART, RANGES } from '../theme.js';
import { ChartTooltipBox, Delta, Segmented } from './ui.jsx';

// Trade markers: up triangle for a buy, down for a sell — shape carries the
// side as well as colour.
function TradeMarker({ cx, cy, side }) {
  if (cx == null || cy == null) return null;
  const s = 7;
  const points =
    side === 'buy'
      ? `${cx},${cy - s} ${cx - s},${cy + s * 0.75} ${cx + s},${cy + s * 0.75}`
      : `${cx},${cy + s} ${cx - s},${cy - s * 0.75} ${cx + s},${cy - s * 0.75}`;
  return (
    <polygon
      points={points}
      fill={side === 'buy' ? CHART.gain : CHART.loss}
      stroke={CHART.surface}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

function PriceTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipBox>
      <p className="font-semibold text-ink">{longDate(p.date)}</p>
      <p className="tabular-nums text-ink-2 mt-0.5">Close {money(p.close, currency)}</p>
      {p.trades?.map((t) => (
        <p key={t.id} className={`tabular-nums mt-0.5 ${t.side === 'buy' ? 'text-gain' : 'text-loss'}`}>
          {t.side === 'buy' ? '▲ Bought' : '▼ Sold'} {shares(t.shares)} @ {money(t.price, currency)}
        </p>
      ))}
    </ChartTooltipBox>
  );
}

export default function TickerPanel({ symbol, holding, onClose }) {
  const [range, setRange] = useState('1Y');
  // Keyed by range so a stale result or error never shows for a new range.
  const [result, setResult] = useState({ range: null, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchTickerHistory(symbol, range)
      .then((data) => !cancelled && setResult({ range, data, error: null }))
      .catch((err) => !cancelled && setResult((r) => ({ ...r, range, error: err.message })));
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data = result.data;
  const error = result.range === range ? result.error : null;

  // Snap each trade onto the first trading day on or after its date, and
  // plot it at the price actually paid.
  const points = useMemo(() => {
    if (!data || data.symbol !== symbol) return [];
    const rows = data.closes.map((c) => ({ ...c, trades: [] }));
    let i = 0;
    for (const t of data.trades) {
      while (i < rows.length && rows[i].date < t.date) i++;
      const row = rows[Math.min(i, rows.length - 1)];
      if (!row) break;
      row.trades.push(t);
      row[t.side] = t.price;
    }
    return rows;
  }, [data, symbol]);

  const quote = data?.symbol === symbol ? data.quote : null;
  const currency = quote?.currency ?? 'USD';
  const first = points[0];
  const last = points[points.length - 1];
  const rangeChange = first && last ? last.close - first.close : null;

  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${symbol} price chart`}
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {symbol} <span className="text-sm font-normal text-muted">{quote?.name !== symbol ? quote?.name : ''}</span>
            </h2>
            {quote && (
              <p className="text-sm">
                <span className="text-xl font-semibold tabular-nums mr-2">{money(quote.price, currency)}</span>
                <Delta value={quote.change} percent={quote.changePercent} currency={currency} />{' '}
                <span className="text-muted">today</span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink text-2xl leading-none px-2" aria-label="Close">
            ×
          </button>
        </div>

        <div className="px-4 pt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted">
            Change over {range === 'ALL' ? 'your holding period' : range}:{' '}
            <Delta value={rangeChange} percent={first ? (rangeChange / first.close) * 100 : null} currency={currency} />
          </p>
          <Segmented label="Range" value={range} onChange={setRange} options={RANGES} />
        </div>
        <div className="px-4 pt-2 flex gap-4 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: CHART.accent }} aria-hidden="true" /> Close
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-gain" aria-hidden="true">▲</span> Buy
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-loss" aria-hidden="true">▼</span> Sell
          </span>
          {holding?.shares > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: CHART.muted }} aria-hidden="true" /> Your avg cost
            </span>
          )}
        </div>

        {error ? (
          <p className="px-4 py-12 text-sm text-loss text-center">{error}</p>
        ) : points.length < 2 ? (
          <p className="px-4 py-12 text-sm text-muted text-center">{data ? 'No price history for this range.' : 'Loading…'}</p>
        ) : (
          <div className="h-80 px-1 py-2">
            <ResponsiveContainer>
              <ComposedChart data={points} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} axisLine={{ stroke: CHART.axis }} tickLine={false} minTickGap={48} />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => money(v, currency, { compact: true })}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip content={<PriceTooltip currency={currency} />} cursor={{ stroke: CHART.muted, strokeWidth: 1 }} />
                {holding?.shares > 0 && (
                  <ReferenceLine
                    y={holding.avgCost}
                    stroke={CHART.muted}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: `Avg ${money(holding.avgCost, currency)}`, fill: CHART.ink2, fontSize: 11, position: 'insideBottomLeft' }}
                  />
                )}
                <Line type="monotone" dataKey="close" stroke={CHART.accent} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2 }} />
                <Scatter dataKey="buy" shape={(p) => <TradeMarker {...p} side="buy" />} isAnimationActive={false} />
                <Scatter dataKey="sell" shape={(p) => <TradeMarker {...p} side="sell" />} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {holding && (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-4 border-t border-line text-sm">
            <div>
              <dt className="text-xs text-muted">Shares</dt>
              <dd className="tabular-nums">{shares(holding.shares)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Value</dt>
              <dd className="tabular-nums">{money(holding.marketValue, currency)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Unrealized</dt>
              <dd>
                <Delta value={holding.unrealized} percent={holding.unrealizedPercent} currency={currency} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Realized</dt>
              <dd>
                <Delta value={holding.realized} currency={currency} />
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
