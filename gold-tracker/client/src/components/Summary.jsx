import { formatGrams, formatMoney } from '../lib/gold.js';

function Tile({ label, value, sub, tone }) {
  const toneClass = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink-2';
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub && <div className={`text-xs ${toneClass}`}>{sub}</div>}
    </div>
  );
}

export default function Summary({ totals, settings }) {
  const { currency, goalGrams } = settings;
  const pct = goalGrams > 0 ? Math.min(100, (totals.grams / goalGrams) * 100) : 0;
  const up = totals.gain != null && totals.gain >= 0;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="text-sm font-medium text-muted">Total gold saved</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className="text-5xl font-semibold tracking-tight">{formatGrams(totals.grams)}</span>
        {totals.grams > 0 && (
          <span className="text-sm text-ink-2">{formatGrams(totals.pureGrams)} pure gold</span>
        )}
      </div>

      {goalGrams > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-ink-2">
            <span>Goal: {formatGrams(goalGrams)}</span>
            <span>
              {pct.toFixed(1)}%
              {totals.grams < goalGrams && ` · ${formatGrams(goalGrams - totals.grams)} to go`}
            </span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-bg"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress toward goal"
          >
            <div className="h-full rounded-full bg-series" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Worth today" value={formatMoney(totals.value, currency)} />
        <Tile label="Total invested" value={formatMoney(totals.invested, currency)} />
        <Tile
          label="Gain / loss"
          value={totals.gain == null ? '—' : `${up ? '+' : '−'}${formatMoney(Math.abs(totals.gain), currency)}`}
          sub={totals.gainPct == null ? null : `${up ? '▲' : '▼'} ${Math.abs(totals.gainPct).toFixed(2)}%`}
          tone={totals.gain == null ? null : up ? 'good' : 'bad'}
        />
        <Tile
          label="Avg cost per gram"
          value={formatMoney(totals.avgPerGram, currency)}
        />
      </div>
    </section>
  );
}
