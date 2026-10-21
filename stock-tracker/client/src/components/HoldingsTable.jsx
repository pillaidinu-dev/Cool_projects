import { useState } from 'react';
import { money, shares } from '../format.js';
import { Card, Delta, PercentDelta } from './ui.jsx';

const th = 'px-3 py-2 font-medium text-right whitespace-nowrap';
const td = 'px-3 py-2.5 text-right tabular-nums whitespace-nowrap';

function Swatch({ color }) {
  return <span className="inline-block size-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden="true" />;
}

export default function HoldingsTable({ holdings, colorFor, onSelect }) {
  const [showClosed, setShowClosed] = useState(false);
  const open = holdings.filter((h) => h.shares > 0);
  const closed = holdings.filter((h) => h.shares === 0);

  return (
    <Card title="Holdings" right={<span className="text-xs text-muted">Select a row for its price chart</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted border-b border-line">
            <tr>
              <th className="px-3 py-2 font-medium text-left">Ticker</th>
              <th className={th}>Shares</th>
              <th className={th}>Avg cost</th>
              <th className={th}>Price</th>
              <th className={th}>Today</th>
              <th className={th}>Value</th>
              <th className={th}>Unrealized</th>
              <th className={th}>Realized</th>
            </tr>
          </thead>
          <tbody>
            {open.map((h) => (
              <tr
                key={h.symbol}
                onClick={() => onSelect(h.symbol)}
                className="border-b border-line last:border-0 hover:bg-raised cursor-pointer"
              >
                <td className="px-3 py-2.5">
                  <button type="button" className="flex items-center gap-2 text-left" onClick={() => onSelect(h.symbol)}>
                    <Swatch color={colorFor(h.symbol)} />
                    <span>
                      <span className="font-semibold text-ink">{h.symbol}</span>
                      <span className="block text-xs text-muted max-w-40 truncate">{h.name}</span>
                    </span>
                  </button>
                </td>
                <td className={td}>{shares(h.shares)}</td>
                <td className={`${td} text-ink-2`}>{money(h.avgCost, h.currency)}</td>
                <td className={td}>
                  {h.stale ? (
                    <span className="text-muted" title="Live price unavailable — showing average cost">
                      n/a
                    </span>
                  ) : (
                    money(h.price, h.currency)
                  )}
                </td>
                <td className={td}>
                  <PercentDelta value={h.changePercent} />
                </td>
                <td className={`${td} font-medium`}>{money(h.marketValue, h.currency)}</td>
                <td className={td}>
                  <Delta value={h.unrealized} percent={h.unrealizedPercent} currency={h.currency} />
                </td>
                <td className={td}>
                  <Delta value={h.realized} currency={h.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {closed.length > 0 && (
        <div className="border-t border-line px-4 py-2">
          <button type="button" className="text-xs text-muted hover:text-ink-2" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? '▾' : '▸'} {closed.length} closed position{closed.length === 1 ? '' : 's'}
          </button>
          {showClosed && (
            <ul className="mt-2 mb-1 space-y-1 text-sm">
              {closed.map((h) => (
                <li key={h.symbol} className="flex justify-between gap-3">
                  <button type="button" className="font-semibold hover:underline" onClick={() => onSelect(h.symbol)}>
                    {h.symbol}
                  </button>
                  <span>
                    <span className="text-muted text-xs mr-2">realized</span>
                    <Delta value={h.realized} currency={h.currency} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
