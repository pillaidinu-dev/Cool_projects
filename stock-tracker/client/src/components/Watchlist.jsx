import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { addToWatchlist, removeFromWatchlist } from '../api.js';
import { money } from '../format.js';
import { CHART } from '../theme.js';
import { Card, Delta } from './ui.jsx';

function Sparkline({ points }) {
  if (points.length < 2) return <span className="text-xs text-muted">—</span>;
  const up = points[points.length - 1].close >= points[0].close;
  return (
    <div className="h-8 w-28" aria-label={`1-month trend ${up ? 'up' : 'down'}`}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="close" stroke={up ? CHART.gain : CHART.loss} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Watchlist({ items, heldSymbols, onChanged, onSelect }) {
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addToWatchlist(symbol);
      setSymbol('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    try {
      await removeFromWatchlist(s);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card
      title="Watchlist"
      right={
        <form onSubmit={add} className="flex gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Add ticker"
            aria-label="Ticker to watch"
            className="w-28 rounded-lg bg-page border border-line px-3 py-1.5 text-sm uppercase placeholder:normal-case placeholder:text-muted focus:outline-none focus:border-accent"
            required
          />
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Add
          </button>
        </form>
      }
    >
      {error && <p className="px-4 pt-3 text-sm text-loss">{error}</p>}
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">Nothing on your watchlist. Add a ticker to follow its price.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.symbol} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-raised">
              <button type="button" onClick={() => onSelect(item.symbol)} className="flex-1 min-w-0 text-left">
                <span className="font-semibold">{item.symbol}</span>
                {heldSymbols.has(item.symbol) && (
                  <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-2">Held</span>
                )}
                <span className="block text-xs text-muted truncate">{item.quote?.name ?? item.error}</span>
              </button>
              <span className="hidden sm:block">
                <Sparkline points={item.sparkline} />
              </span>
              <span className="text-right">
                <span className="block font-medium tabular-nums">{item.quote ? money(item.quote.price, item.quote.currency) : '—'}</span>
                <span className="block text-xs">
                  {item.quote && <Delta value={item.quote.change} percent={item.quote.changePercent} currency={item.quote.currency} />}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(item.symbol)}
                className="text-muted hover:text-loss text-lg leading-none px-1"
                aria-label={`Remove ${item.symbol}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
