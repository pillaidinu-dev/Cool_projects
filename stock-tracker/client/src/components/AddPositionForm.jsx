import { useState } from 'react';
import { addPosition, fetchQuote } from '../api.js';
import { money } from '../format.js';

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { symbol: '', shares: '', buyPrice: '', buyDate: today() };

const inputClass =
  'w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400';

export default function AddPositionForm({ onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Look the ticker up when the field loses focus, so the user sees the
  // company name and today's price (and can use it as the buy price).
  async function lookUp() {
    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) return setQuote(null);
    try {
      setQuote(await fetchQuote(symbol));
      setError(null);
    } catch (err) {
      setQuote(null);
      setError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await addPosition({
        symbol: form.symbol,
        shares: Number(form.shares),
        buyPrice: Number(form.buyPrice),
        buyDate: form.buyDate,
      });
      setForm({ ...EMPTY, buyDate: today() });
      setQuote(null);
      setError(null);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Add a position</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Ticker
          <input
            className={`${inputClass} uppercase`}
            placeholder="AAPL"
            value={form.symbol}
            onChange={set('symbol')}
            onBlur={lookUp}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Shares
          <input
            className={inputClass}
            type="number"
            min="0"
            step="any"
            placeholder="10"
            value={form.shares}
            onChange={set('shares')}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Buy price (per share)
          <input
            className={inputClass}
            type="number"
            min="0"
            step="any"
            placeholder="150.00"
            value={form.buyPrice}
            onChange={set('buyPrice')}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Buy date
          <input className={inputClass} type="date" max={today()} value={form.buyDate} onChange={set('buyDate')} required />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
      {quote && (
        <p className="text-xs text-slate-400">
          {quote.name} · now <span className="text-slate-200 tabular-nums">{money(quote.price)}</span>{' '}
          <button
            type="button"
            className="ml-1 text-emerald-400 hover:text-emerald-300"
            onClick={() => setForm((f) => ({ ...f, buyPrice: String(quote.price) }))}
          >
            Use as buy price
          </button>
        </p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </form>
  );
}
