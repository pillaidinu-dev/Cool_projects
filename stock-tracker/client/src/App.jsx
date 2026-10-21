import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchHealth, fetchPortfolio, fetchPortfolioHistory, fetchTransactions, fetchWatchlist } from './api.js';
import { makeColorFor } from './theme.js';
import SummaryCards from './components/SummaryCards.jsx';
import PerformanceChart from './components/PerformanceChart.jsx';
import HoldingsTable from './components/HoldingsTable.jsx';
import AllocationChart from './components/AllocationChart.jsx';
import ProfitBars from './components/ProfitBars.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import TransactionsTable from './components/TransactionsTable.jsx';
import Watchlist from './components/Watchlist.jsx';
import TickerPanel from './components/TickerPanel.jsx';
import { Card } from './components/ui.jsx';

const TABS = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'trades', label: 'Trades' },
  { key: 'watchlist', label: 'Watchlist' },
];

const REFRESH_MS = 60_000;

export default function App() {
  const [tab, setTab] = useState('portfolio');
  const [source, setSource] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [range, setRange] = useState('1Y');
  const [history, setHistory] = useState({ range: null, series: [] });
  const [transactions, setTransactions] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Bumped after any ledger change so the history chart reloads.
  const [ledgerVersion, setLedgerVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [p, t, w] = await Promise.all([fetchPortfolio(), fetchTransactions(), fetchWatchlist()]);
      setPortfolio(p);
      setTransactions(t.transactions);
      setWatchlist(w.items);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchHealth()
      .then((h) => setSource(h.source))
      .catch(() => {});
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    fetchPortfolioHistory(range)
      .then((h) => !cancelled && setHistory(h))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [range, ledgerVersion]);

  const onLedgerChanged = useCallback(() => {
    setLedgerVersion((v) => v + 1);
    refresh();
  }, [refresh]);

  const holdings = useMemo(() => portfolio?.holdings ?? [], [portfolio]);
  const colorFor = useMemo(() => makeColorFor(holdings.filter((h) => h.shares > 0).map((h) => h.symbol)), [holdings]);
  const heldSymbols = useMemo(() => new Set(holdings.filter((h) => h.shares > 0).map((h) => h.symbol)), [holdings]);
  const closeTicker = useCallback(() => setSelected(null), []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-page/90 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Stock Tracker</h1>
            <p className="text-xs text-muted">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · refreshes every minute` : 'Loading…'}
            </p>
          </div>
          <nav className="flex gap-1" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tab === t.key ? 'bg-raised text-ink' : 'text-muted hover:text-ink-2'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-4">
        {source === 'demo' && (
          <p className="rounded-lg border border-[#c98500]/50 bg-[#c98500]/10 px-4 py-2 text-sm text-ink-2">
            <strong className="text-ink">⚠ Demo prices.</strong> The server is running with <code>PRICE_SOURCE=demo</code>,
            so every price is a made-up random walk — not real market data. Unset it to use live Yahoo Finance prices.
          </p>
        )}
        {error && <p className="rounded-lg border border-loss/50 bg-loss/10 px-4 py-2 text-sm text-ink-2">{error}</p>}
        {portfolio?.errors?.length > 0 && (
          <p className="rounded-lg border border-line px-4 py-2 text-sm text-muted">
            Some prices could not be loaded, so those holdings are valued at cost: {portfolio.errors.join('; ')}
          </p>
        )}

        {tab === 'portfolio' &&
          (portfolio && holdings.length === 0 ? (
            <Card className="px-6 py-12 text-center">
              <p className="text-lg font-semibold">No trades yet</p>
              <p className="mt-1 text-sm text-muted">Record a buy to start tracking value and profit over time.</p>
              <button
                type="button"
                onClick={() => setTab('trades')}
                className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Record a trade
              </button>
            </Card>
          ) : (
            portfolio && (
              <>
                <SummaryCards totals={portfolio.totals} />
                <PerformanceChart
                  series={history.range === range ? history.series : []}
                  loading={history.range !== range}
                  range={range}
                  onRangeChange={setRange}
                />
                <HoldingsTable holdings={holdings} colorFor={colorFor} onSelect={setSelected} />
                <div className="grid lg:grid-cols-2 gap-4">
                  <AllocationChart holdings={holdings} colorFor={colorFor} />
                  <ProfitBars holdings={holdings} />
                </div>
              </>
            )
          ))}

        {tab === 'trades' && (
          <>
            <TransactionForm onAdded={onLedgerChanged} />
            <TransactionsTable transactions={transactions} onChanged={onLedgerChanged} onSelect={setSelected} />
          </>
        )}

        {tab === 'watchlist' && (
          <Watchlist items={watchlist} heldSymbols={heldSymbols} onChanged={refresh} onSelect={setSelected} />
        )}
      </main>

      {selected && (
        <TickerPanel
          key={selected}
          symbol={selected}
          holding={holdings.find((h) => h.symbol === selected)}
          onClose={closeTicker}
        />
      )}
    </div>
  );
}
