import { money, signedMoney, signedPct, gainClass } from '../format.js';

function Card({ label, value, sub, valueClass = 'text-slate-100' }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{sub}</p>}
    </div>
  );
}

export default function SummaryCards({ totals }) {
  return (
    <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Card label="Current value" value={money(totals.value)} />
      <Card label="Cost basis" value={money(totals.cost)} />
      <Card
        label="Total profit / loss"
        value={signedMoney(totals.profit)}
        sub={signedPct(totals.profitPct)}
        valueClass={gainClass(totals.profit)}
      />
      <Card label="Today" value={signedMoney(totals.dayChange)} valueClass={gainClass(totals.dayChange)} />
    </section>
  );
}
