import { money } from '../format.js';
import { Delta } from './ui.jsx';

function Tile({ label, children, sub }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface border border-line px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-lg sm:text-xl font-semibold">{children}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default function SummaryCards({ totals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="col-span-2 lg:col-span-1 rounded-xl bg-surface border border-line px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted">Market value</p>
        <p className="mt-1 text-3xl font-semibold">{money(totals.marketValue)}</p>
        <p className="mt-1 text-sm">
          <Delta value={totals.dayChange} percent={totals.dayChangePercent} /> <span className="text-muted">today</span>
        </p>
      </div>
      <Tile label="Total profit" sub="Unrealized + realized, after fees">
        <Delta value={totals.totalPnl} />
      </Tile>
      <Tile label="Unrealized" sub={`On ${money(totals.costBasis)} cost basis`}>
        <Delta value={totals.unrealized} percent={totals.unrealizedPercent} />
      </Tile>
      <Tile label="Realized" sub={`From closed shares · ${money(totals.fees)} fees paid`}>
        <Delta value={totals.realized} />
      </Tile>
    </div>
  );
}
