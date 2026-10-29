import { useState } from 'react';
import {
  GRAMS_PER_OZ,
  KARATS,
  SOVEREIGN_GRAMS,
  formatGrams,
  formatMoney,
  isPaxg,
  karatPrice,
  todayISO,
} from '../lib/gold.js';

// Round a token amount to 8 decimals (PAXG's precision) without trailing zeros.
const tokens = (n) => String(Number(n.toFixed(8)));

export default function PurchaseForm({ initial, currency, price24k, spotPerGram, onSave, onCancel }) {
  const [kind, setKind] = useState(initial && isPaxg(initial) ? 'paxg' : 'physical');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [paid, setPaid] = useState(initial ? String(initial.paid) : '');
  const [note, setNote] = useState(initial?.note ?? '');

  // Physical gold
  const [weight, setWeight] = useState(initial && !isPaxg(initial) ? String(initial.grams) : '');
  const [unit, setUnit] = useState('g'); // 'g' or 'sov' — always saved as grams
  const [karat, setKarat] = useState(initial && !isPaxg(initial) ? initial.karat : 24);

  // PAXG: dollars spent and the price per token give the amount received;
  // either the price or the amount can be typed and the other follows.
  const livePaxg = spotPerGram != null ? spotPerGram * GRAMS_PER_OZ : null;
  const [paxgQty, setPaxgQty] = useState(initial && isPaxg(initial) ? String(initial.paxg) : '');
  const [paxgPrice, setPaxgPrice] = useState(
    initial && isPaxg(initial)
      ? String(Number((initial.paid / initial.paxg).toFixed(2)))
      : livePaxg != null
        ? livePaxg.toFixed(2)
        : '',
  );

  const paxg = kind === 'paxg';
  const amount = Number(paid);
  const g = paxg
    ? Number(paxgQty) * GRAMS_PER_OZ
    : Number(weight) * (unit === 'sov' ? SOVEREIGN_GRAMS : 1);
  const valid = g > 0 && paid !== '' && amount >= 0 && date;
  const perGram = g > 0 && amount > 0 ? amount / g : null;
  const todayRate = paxg
    ? (spotPerGram ?? price24k)
    : price24k != null
      ? karatPrice(price24k, karat)
      : null;

  function onAmount(v) {
    setPaid(v);
    if (paxg && Number(paxgPrice) > 0 && v !== '') setPaxgQty(tokens(Number(v) / Number(paxgPrice)));
  }
  function onPaxgPrice(v) {
    setPaxgPrice(v);
    if (Number(v) > 0 && paid !== '') setPaxgQty(tokens(amount / Number(v)));
  }
  function onPaxgQty(v) {
    setPaxgQty(v);
    if (Number(v) > 0 && paid !== '') setPaxgPrice((amount / Number(v)).toFixed(2));
  }

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    const base = {
      id: initial?.id ?? crypto.randomUUID(),
      createdAt: initial?.createdAt ?? Date.now(),
      date,
      paid: amount,
      note: note.trim(),
    };
    onSave(
      paxg
        ? { ...base, type: 'paxg', karat: 24, paxg: Number(paxgQty), grams: g }
        : { ...base, type: 'physical', karat: Number(karat), grams: g },
    );
  }

  const field = 'text-sm';
  const label = 'mb-1 block text-ink-2';

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-accent bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{initial ? 'Edit purchase' : 'Add gold'}</h2>
        <div role="radiogroup" aria-label="What did you buy?" className="flex rounded-lg border border-line p-0.5 text-sm">
          {[
            ['physical', 'Physical gold'],
            ['paxg', 'PAXG'],
          ].map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`rounded-md px-3 py-1.5 font-medium ${kind === value ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-bg'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {paxg ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className={field}>
            <span className={label}>Date</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className={field}>
            <span className={label}>Amount invested ({currency})</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="e.g. 100"
              value={paid}
              onChange={(e) => onAmount(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className={field}>
            <span className={label}>Price per PAXG ({currency})</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="price you bought at"
              value={paxgPrice}
              onChange={(e) => onPaxgPrice(e.target.value)}
            />
          </label>
          <label className={field}>
            <span className={label}>PAXG received</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="e.g. 0.0248"
              value={paxgQty}
              onChange={(e) => onPaxgQty(e.target.value)}
              required
            />
          </label>
          <label className={field}>
            <span className={label}>Note (optional)</span>
            <input type="text" placeholder="weekly DCA…" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_0.8fr_1fr_1fr]">
          <label className={field}>
            <span className={label}>Date</span>
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className={field}>
            <span className={label}>Weight</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                placeholder={unit === 'sov' ? 'e.g. 1' : 'e.g. 10'}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                autoFocus
              />
              <select
                aria-label="Weight unit"
                className="!w-auto"
                value={unit}
                onChange={(e) => {
                  // Keep the same amount of gold when switching units.
                  const next = e.target.value;
                  if (weight !== '' && next !== unit) {
                    const n = next === 'sov' ? g / SOVEREIGN_GRAMS : g;
                    setWeight(String(Number(n.toFixed(4))));
                  }
                  setUnit(next);
                }}
              >
                <option value="g">g</option>
                <option value="sov">sov</option>
              </select>
            </div>
          </label>
          <label className={field}>
            <span className={label}>Purity</span>
            <select value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
              {KARATS.map((k) => (
                <option key={k} value={k}>
                  {k}K
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className={label}>Total paid ({currency})</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="incl. making & tax"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              required
            />
          </label>
          <label className={field}>
            <span className={label}>Note (optional)</span>
            <input type="text" placeholder="coin, bar, chain…" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {(paxg || unit === 'sov') && g > 0 && <>= {formatGrams(Number(g.toFixed(3)))} of gold. </>}
          {perGram != null && <>You paid {formatMoney(perGram, currency)}/g. </>}
          {todayRate != null && (
            <>
              Today's {paxg ? 'spot' : `${karat}K`} rate is {formatMoney(todayRate, currency)}/g.
            </>
          )}
          {!paxg && todayRate != null && g > 0 && paid === '' && (
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
