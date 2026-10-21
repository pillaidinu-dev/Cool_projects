import { useCallback, useEffect, useState } from 'react';
import { fetchHistory, fetchPortfolio } from './api.js';
import SummaryCards from './components/SummaryCards.jsx';
import AddPositionForm from './components/AddPositionForm.jsx';
import HoldingsTable from './components/HoldingsTable.jsx';
import { ProfitChart, TickerProfitChart, ValueChart } from './components/charts.jsx';

const TABS = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'graphs', label: 'Profit Graphs' },
];

const RANGES = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: 'all', label: 'All' },
];

// Quotes are cached server-side for a minute, so polling faster than that
// would just return the same numbers.
const REFRESH_MS = 60_000;

const EMPTY_PORTFOLIO = { holdings: [], totals: { cost: 0, value: 0, profit: 0, profitPct: null, dayChange: 0, unpriced: [] } };

export default function App() {
  const [tab, setTab] = useState('portfolio');
  const [portfolio, setPortfolio] = useState(EMPTY_PORTFOLIO);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [range, setRange] = useState('6m');
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  // Bumped whenever positions change so the graphs refetch.
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setPortfolio(await fetchPortfolio());
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const onPositionsChanged = useCallback(() => {
    refresh();
    setVersion((v) => v + 1);
  }, [refresh]);

  // History walks every held ticker's daily closes, so only load it when
  // the graphs tab is actually open.
  useEffect(() => {
    if (tab !== 'graphs') return undefined;
    let cancelled = false;
    setHistoryLoading(true);
    fetchHistory(range)
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
        setHistoryError(null);
      })
      .catch((err) => !cancelled && setHistoryError(err.message))
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, range, version]);

  const { holdings, totals } = portfolio;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto px-4 pt-8 pb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Stock Tracker</h1>
          <p className="text-slate-400 text-sm">Your positions, what they're worth now, and how your profit has moved</p>
        </div>
        <div className="text-xs text-slate-500 text-right">
          {loading && <span>Loading…</span>}
          {!loading && lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
          {error && <p className="text-rose-400">{error}</p>}
        </div>
      </header>

      <nav className="max-w-6xl mx-auto px-4 flex gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        <SummaryCards totals={totals} />
        {totals.unpriced.length > 0 && (
          <p className="text-xs text-amber-400 -mt-5">
            No price available for {totals.unpriced.join(', ')}, so {totals.unpriced.length === 1 ? 'it is' : 'they are'}{' '}
            left out of the totals.
          </p>
        )}

        {tab === 'portfolio' && (
          <>
            <AddPositionForm onAdded={onPositionsChanged} />
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Holdings</h2>
              <HoldingsTable holdings={holdings} onChanged={onPositionsChanged} />
            </section>
          </>
        )}

        {tab === 'graphs' && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Profit over time</h2>
              <div className="flex items-center gap-2 text-xs">
                {historyLoading && <span className="text-slate-500">Loading…</span>}
                <div className="flex rounded-lg border border-slate-700/60 overflow-hidden">
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRange(r.key)}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        range === r.key ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {historyError && <p className="text-rose-400 text-sm">{historyError}</p>}
            {history?.failed?.length > 0 && (
              <p className="text-xs text-amber-400">
                Couldn't load price history for {history.failed.map((f) => f.symbol).join(', ')}.
              </p>
            )}

            {history && history.points.length === 0 && !historyLoading && (
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-8 text-center text-sm text-slate-500">
                {holdings.length === 0
                  ? 'Add a position on the Portfolio tab to see profit graphs.'
                  : 'No price history in this range yet.'}
              </div>
            )}

            {history && history.points.length > 0 && (
              <>
                <ProfitChart points={history.points} />
                <section className="grid gap-6 lg:grid-cols-2">
                  <ValueChart points={history.points} />
                  <TickerProfitChart points={history.points} symbols={history.symbols} />
                </section>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
