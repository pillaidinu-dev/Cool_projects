import { formatDate, formatGrams, formatMoney, isPaxg, purchaseValue } from '../lib/gold.js';

export default function PurchaseList({ purchases, currency, price24k, spotPerGram, onEdit, onDelete, onAdd }) {
  if (purchases.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
        <p className="font-medium">No gold recorded yet</p>
        <p className="mt-1 text-sm text-muted">
          Add each coin, bar or piece you buy — weight, purity and what you paid.
        </p>
        <button
          onClick={onAdd}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          + Add your first purchase
        </button>
      </section>
    );
  }

  // Newest first for the list.
  const rows = [...purchases].reverse();

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface">
      <h2 className="px-4 pt-4 text-base font-semibold sm:px-5">Purchases</h2>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[640px] whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium sm:px-5">Date</th>
              <th className="px-2 py-2 text-right font-medium">Weight</th>
              <th className="px-2 py-2 font-medium">Purity</th>
              <th className="px-2 py-2 text-right font-medium">Paid</th>
              <th className="px-2 py-2 text-right font-medium">Paid / g</th>
              <th className="px-2 py-2 text-right font-medium">Worth today</th>
              <th className="px-2 py-2 text-right font-medium">Gain</th>
              <th className="px-4 py-2 sm:px-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((p) => {
              const worth = purchaseValue(p, price24k, spotPerGram);
              const gain = worth != null ? worth - p.paid : null;
              const pct = gain != null && p.paid > 0 ? (gain / p.paid) * 100 : null;
              // Rounds to 0.0% (e.g. a PAXG buy at today's price): no arrow or color.
              const flat = pct == null || Math.abs(pct) < 0.05;
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 sm:px-5">
                    <div>{formatDate(p.date)}</div>
                    {p.note && <div className="text-xs text-muted">{p.note}</div>}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="font-medium">{formatGrams(p.grams)}</div>
                    {isPaxg(p) && <div className="text-xs text-muted">{p.paxg} PAXG</div>}
                  </td>
                  <td className="px-2 py-2.5">{isPaxg(p) ? 'PAXG' : `${p.karat}K`}</td>
                  <td className="px-2 py-2.5 text-right">{formatMoney(p.paid, currency)}</td>
                  <td className="px-2 py-2.5 text-right text-ink-2">
                    {formatMoney(p.paid / p.grams, currency)}
                  </td>
                  <td className="px-2 py-2.5 text-right">{formatMoney(worth, currency)}</td>
                  <td className={`px-2 py-2.5 text-right ${flat ? 'text-ink-2' : gain >= 0 ? 'text-good' : 'text-bad'}`}>
                    {pct == null ? '—' : flat ? '0.0%' : `${gain >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right sm:px-5">
                    <button onClick={() => onEdit(p)} className="text-xs font-medium text-accent hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete the ${formatGrams(p.grams)} purchase from ${formatDate(p.date)}?`)) {
                          onDelete(p.id);
                        }
                      }}
                      className="ml-3 text-xs font-medium text-muted hover:text-bad"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
