import { useState } from 'react';
import { deleteTransaction } from '../api.js';
import { longDate, money, shares } from '../format.js';
import { Card } from './ui.jsx';

const th = 'px-3 py-2 font-medium text-right whitespace-nowrap';
const td = 'px-3 py-2.5 text-right tabular-nums whitespace-nowrap';

function toCsv(transactions) {
  const header = ['date', 'symbol', 'side', 'shares', 'price', 'fee', 'note'];
  const escape = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : v);
  return [header.join(','), ...transactions.map((t) => header.map((k) => escape(t[k] ?? '')).join(','))].join('\n');
}

function download(transactions) {
  const url = URL.createObjectURL(new Blob([toCsv(transactions)], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'transactions.csv' });
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsTable({ transactions, onChanged, onSelect }) {
  const [error, setError] = useState(null);

  async function remove(t) {
    if (!window.confirm(`Delete ${t.side} of ${shares(t.shares)} ${t.symbol} on ${t.date}?`)) return;
    setError(null);
    try {
      await deleteTransaction(t.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card
      title={`Trades (${transactions.length})`}
      right={
        transactions.length > 0 && (
          <button type="button" onClick={() => download(transactions)} className="text-xs text-accent hover:underline">
            Export CSV
          </button>
        )
      }
    >
      {error && <p className="px-4 pt-3 text-sm text-loss">{error}</p>}
      {transactions.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No trades recorded yet. Add your first one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted border-b border-line">
              <tr>
                <th className="px-3 py-2 font-medium text-left">Date</th>
                <th className="px-3 py-2 font-medium text-left">Ticker</th>
                <th className="px-3 py-2 font-medium text-left">Side</th>
                <th className={th}>Shares</th>
                <th className={th}>Price</th>
                <th className={th}>Fee</th>
                <th className={th}>Total</th>
                <th className="px-3 py-2 font-medium text-left">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{longDate(t.date)}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" className="font-semibold hover:underline" onClick={() => onSelect(t.symbol)}>
                      {t.symbol}
                    </button>
                  </td>
                  <td className={`px-3 py-2.5 ${t.side === 'buy' ? 'text-gain' : 'text-loss'}`}>
                    {t.side === 'buy' ? '▲ Buy' : '▼ Sell'}
                  </td>
                  <td className={td}>{shares(t.shares)}</td>
                  <td className={td}>{money(t.price)}</td>
                  <td className={`${td} text-muted`}>{t.fee ? money(t.fee) : '—'}</td>
                  <td className={td}>{money(t.shares * t.price + (t.side === 'buy' ? t.fee : -t.fee))}</td>
                  <td className="px-3 py-2.5 text-muted max-w-48 truncate">{t.note}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button type="button" onClick={() => remove(t)} className="text-xs text-muted hover:text-loss" aria-label="Delete trade">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
