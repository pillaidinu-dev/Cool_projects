import { useState } from 'react';
import { addTransaction, fetchQuote } from '../api.js';
import { money, today } from '../format.js';
import { Card, Segmented } from './ui.jsx';

const input =
  'w-full rounded-lg bg-page border border-line px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent';
const label = 'block text-xs text-muted mb-1';

const blank = () => ({ symbol: '', side: 'buy', shares: '', price: '', fee: '', date: today(), note: '' });

export default function TransactionForm({ onAdded }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  async function useLivePrice() {
    if (!form.symbol) return setError('Enter a ticker first');
    setError(null);
    try {
      const q = await fetchQuote(form.symbol.trim());
      setForm((f) => ({ ...f, price: String(Math.round(q.price * 100) / 100) }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addTransaction(form);
      setForm((f) => ({ ...blank(), side: f.side }));
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const total = Number(form.shares) * Number(form.price) + (form.side === 'buy' ? 1 : -1) * Number(form.fee || 0);

  return (
    <Card title="Record a trade">
      <form onSubmit={submit} className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
        <div className="col-span-2 sm:col-span-1">
          <span className={label}>Side</span>
          <Segmented
            label="Side"
            value={form.side}
            onChange={set('side')}
            options={[
              { value: 'buy', label: 'Buy' },
              { value: 'sell', label: 'Sell' },
            ]}
          />
        </div>
        <label>
          <span className={label}>Ticker</span>
          <input className={`${input} uppercase`} value={form.symbol} onChange={set('symbol')} placeholder="AAPL" required />
        </label>
        <label>
          <span className={label}>Shares</span>
          <input className={input} type="number" min="0" step="any" value={form.shares} onChange={set('shares')} required />
        </label>
        <label className="relative">
          <span className={label}>
            Price{' '}
            <button type="button" onClick={useLivePrice} className="text-accent hover:underline">
              (use live)
            </button>
          </span>
          <input className={input} type="number" min="0" step="any" value={form.price} onChange={set('price')} required />
        </label>
        <label>
          <span className={label}>Fee</span>
          <input className={input} type="number" min="0" step="any" value={form.fee} onChange={set('fee')} placeholder="0" />
        </label>
        <label>
          <span className={label}>Date</span>
          <input className={input} type="date" max={today()} value={form.date} onChange={set('date')} required />
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className={label}>Note</span>
          <input className={input} value={form.note} onChange={set('note')} placeholder="Optional" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 sm:col-span-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Saving…' : `Add ${form.side}`}
        </button>
        <p className="col-span-full text-xs text-muted min-h-4">
          {error ? (
            <span className="text-loss">{error}</span>
          ) : Number.isFinite(total) && total > 0 ? (
            `${form.side === 'buy' ? 'Total cost' : 'Net proceeds'}: ${money(total)}`
          ) : (
            'Costs use the average-cost method; buy fees add to cost basis, sell fees reduce realized profit.'
          )}
        </p>
      </form>
    </Card>
  );
}
