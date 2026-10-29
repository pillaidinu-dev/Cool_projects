import { useState } from 'react';
import { KARATS, formatMoney, karatPrice, todayISO } from '../lib/gold.js';

export default function PurchaseForm({ initial, currency, price24k, onSave, onCancel }) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [grams, setGrams] = useState(initial ? String(initial.grams) : '');
  const [karat, setKarat] = useState(initial?.karat ?? 24);
  const [paid, setPaid] = useState(initial ? String(initial.paid) : '');
  const [note, setNote] = useState(initial?.note ?? '');

  const g = Number(grams);
  const amount = Number(paid);
  const valid = g > 0 && amount >= 0 && paid !== '' && date;
  const perGram = g > 0 && amount > 0 ? amount / g : null;
  const todayRate = price24k != null ? karatPrice(price24k, karat) : null;

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      createdAt: initial?.createdAt ?? Date.now(),
      date,
      grams: g,
      karat: Number(karat),
      paid: amount,
      note: note.trim(),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-2xl border border-accent bg-surface p-4 sm:p-5"
    >
      <h2 className="mb-3 text-base font-semibold">{initial ? 'Edit purchase' : 'Add gold'}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Date</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Weight (grams)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            placeholder="e.g. 10"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Purity</span>
          <select value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
            {KARATS.map((k) => (
              <option key={k} value={k}>
                {k}K
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Total paid ({currency})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="incl. making & GST"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Note (optional)</span>
          <input
            type="text"
            placeholder="coin, bar, SGB…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {perGram != null && <>You paid {formatMoney(perGram, currency)}/g. </>}
          {todayRate != null && <>Today's {karat}K rate is {formatMoney(todayRate, currency)}/g.</>}
          {todayRate != null && g > 0 && paid === '' && (
            <button
              type="button"
              className="ml-2 font-medium text-accent underline"
              onClick={() => setPaid((todayRate * g).toFixed(2))}
            >
              Use today's rate
            </button>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-bg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
