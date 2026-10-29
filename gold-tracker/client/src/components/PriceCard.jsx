import { GRAMS_PER_OZ, SOVEREIGN_GRAMS, formatMoney, karatPrice } from '../lib/gold.js';

export default function PriceCard({ price, price24k, spotPerGram, settings }) {
  const { currency, manualPrice24k, premiumPct } = settings;
  const { data, error, loading, refresh } = price;
  const manual = manualPrice24k != null;

  // Day change only when the source gives a previous close (and we're on live prices).
  const change =
    !manual && data?.prevPerGram24k ? (data.perGram24k / data.prevPerGram24k - 1) * 100 : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-muted">Today's price · per gram</div>
          <div className="mt-1 text-3xl font-semibold">{formatMoney(price24k, currency)}</div>
          <div className="text-sm text-ink-2">
            24K
            {change != null && (
              <span className={change >= 0 ? 'text-good' : 'text-bad'}>
                {' '}
                · {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}% today
              </span>
            )}
          </div>
        </div>
        {!manual && (
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:bg-bg disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </div>

      <dl className="mt-4 divide-y divide-line text-sm">
        {[22].map((k) => (
          <div key={k} className="flex justify-between py-2">
            <dt className="text-ink-2">{k}K</dt>
            <dd className="tnum font-medium">
              {price24k == null ? '—' : formatMoney(karatPrice(price24k, k), currency)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between py-2">
          <dt className="text-ink-2">10 g · 24K</dt>
          <dd className="tnum font-medium">{price24k == null ? '—' : formatMoney(price24k * 10, currency)}</dd>
        </div>
        {[22, 24].map((k) => (
          <div key={`sov-${k}`} className="flex justify-between py-2">
            <dt className="text-ink-2">1 sovereign (8 g) · {k}K</dt>
            <dd className="tnum font-medium">
              {price24k == null ? '—' : formatMoney(karatPrice(price24k, k) * SOVEREIGN_GRAMS, currency)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between py-2">
          <dt className="text-ink-2">1 PAXG (1 troy oz)</dt>
          <dd className="tnum font-medium">
            {spotPerGram == null && price24k == null ? '—' : formatMoney((spotPerGram ?? price24k) * GRAMS_PER_OZ, currency)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-muted">
        {manual
          ? 'Using the manual rate from Settings.'
          : data
            ? `Live spot price${premiumPct ? ` + ${premiumPct}% local premium` : ''} · ${data.source} · ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${data.stale ? ' (stale)' : ''}`
            : error
              ? `Couldn't load the live price (${error}). Set a manual rate in Settings.`
              : 'Fetching the live price…'}
      </p>
    </section>
  );
}
