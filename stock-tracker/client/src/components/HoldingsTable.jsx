import { Fragment, useState } from 'react';
import { deletePosition, updatePosition } from '../api.js';
import { money, signedMoney, signedPct, gainClass, shares as fmtShares, longDate } from '../format.js';

const cellInput =
  'w-24 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100 tabular-nums focus:outline-none focus:border-emerald-400';

function LotRow({ lot, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  function startEdit() {
    setDraft({ shares: String(lot.shares), buyPrice: String(lot.buyPrice), buyDate: lot.buyDate });
    setEditing(true);
  }

  async function save() {
    try {
      await updatePosition(lot.id, {
        shares: Number(draft.shares),
        buyPrice: Number(draft.buyPrice),
        buyDate: draft.buyDate,
      });
      setEditing(false);
      setError(null);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${fmtShares(lot.shares)} ${lot.symbol} bought ${longDate(lot.buyDate)}?`)) return;
    try {
      await deletePosition(lot.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <tr className="text-xs text-slate-400 bg-slate-900/40">
      <td className="pl-8 pr-3 py-2">
        {editing ? (
          <input className={cellInput} type="date" value={draft.buyDate} onChange={set('buyDate')} />
        ) : (
          `Bought ${longDate(lot.buyDate)}`
        )}
        {error && <p className="text-rose-400 mt-1">{error}</p>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {editing ? (
          <input className={cellInput} type="number" step="any" min="0" value={draft.shares} onChange={set('shares')} />
        ) : (
          fmtShares(lot.shares)
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
        {editing ? (
          <input className={cellInput} type="number" step="any" min="0" value={draft.buyPrice} onChange={set('buyPrice')} />
        ) : (
          money(lot.buyPrice)
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{money(lot.price)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{money(lot.value)}</td>
      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${gainClass(lot.profit)}`}>
        {signedMoney(lot.profit)}
        <span className="block text-[11px] opacity-80">{signedPct(lot.profitPct)}</span>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {editing ? (
          <>
            <button type="button" onClick={save} className="text-emerald-400 hover:text-emerald-300 mr-3">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-200">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={startEdit} className="text-slate-400 hover:text-slate-200 mr-3">
              Edit
            </button>
            <button type="button" onClick={remove} className="text-rose-400/80 hover:text-rose-300">
              Remove
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default function HoldingsTable({ holdings, onChanged }) {
  const [open, setOpen] = useState({});

  if (holdings.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-8 text-center text-sm text-slate-500">
        No positions yet. Add your first one above.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-700/60">
            <th className="text-left font-medium px-3 py-2">Ticker</th>
            <th className="text-right font-medium px-3 py-2">Shares</th>
            <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">Avg cost</th>
            <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">Price</th>
            <th className="text-right font-medium px-3 py-2">Value</th>
            <th className="text-right font-medium px-3 py-2">Profit / loss</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const expanded = open[h.symbol];
            return (
              <Fragment key={h.symbol}>
                <tr className="border-t border-slate-700/40 first:border-t-0">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-100">{h.symbol}</p>
                    {h.name !== h.symbol && <p className="text-xs text-slate-500 truncate max-w-48">{h.name}</p>}
                    {h.stale && (
                      <p className="text-[11px] text-amber-400">
                        {h.price == null ? 'No price' : 'Last close (live price unavailable)'}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtShares(h.shares)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">{money(h.avgCost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell">{money(h.price)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(h.value)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-medium whitespace-nowrap ${gainClass(h.profit)}`}>
                    {signedMoney(h.profit)}
                    <span className="block text-xs font-normal opacity-80">{signedPct(h.profitPct)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [h.symbol]: !o[h.symbol] }))}
                      className="text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap"
                    >
                      {expanded ? 'Hide' : h.lots.length === 1 ? '1 lot' : `${h.lots.length} lots`}
                    </button>
                  </td>
                </tr>
                {expanded && h.lots.map((lot) => <LotRow key={lot.id} lot={lot} onChanged={onChanged} />)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
