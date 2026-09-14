import { useEffect, useState, useCallback } from 'react';
import { fetchGames, fetchLeaders, fetchPredictions } from './api.js';
import ScoreboardCard from './components/ScoreboardCard.jsx';
import LeadersTable from './components/LeadersTable.jsx';
import TouchdownFeed from './components/TouchdownFeed.jsx';
import TouchdownScorers from './components/TouchdownScorers.jsx';
import ProjectionChart from './components/ProjectionChart.jsx';
import TouchdownProbability from './components/TouchdownProbability.jsx';

const TABS = [
  { key: 'scoreboard', label: 'Scoreboard & Leaders' },
  { key: 'touchdowns', label: 'Touchdowns' },
  { key: 'projections', label: 'Projections' },
];

const REFRESH_MS = 20_000;

function formatDayHeading(ymd) {
  // ymd is 'YYYYMMDD' as returned by the API, dated in UTC to match how
  // ESPN buckets games by day.
  const date = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const PASSING_COLUMNS = [
  { key: 'completionsAttempts', label: 'C/ATT' },
  { key: 'yards', label: 'Yds' },
  { key: 'touchdowns', label: 'TD' },
  { key: 'interceptions', label: 'Int' },
];

const RUSHING_COLUMNS = [
  { key: 'carries', label: 'Car' },
  { key: 'yards', label: 'Yds' },
  { key: 'touchdowns', label: 'TD' },
  { key: 'long', label: 'Lng' },
];

const RECEIVING_COLUMNS = [
  { key: 'receptions', label: 'Rec' },
  { key: 'yards', label: 'Yds' },
  { key: 'touchdowns', label: 'TD' },
  { key: 'long', label: 'Lng' },
];

export default function App() {
  const [days, setDays] = useState([]);
  const [leaders, setLeaders] = useState({ passing: [], rushing: [], receiving: [], touchdowns: [] });
  const [predictions, setPredictions] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('scoreboard');

  const refresh = useCallback(async () => {
    try {
      const [gamesData, leadersData, predictionsData] = await Promise.all([
        fetchGames(),
        fetchLeaders(),
        fetchPredictions(),
      ]);
      setDays(gamesData.days || []);
      setLeaders(leadersData);
      setPredictions(predictionsData);
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

  const receivers = leaders.receiving.filter((r) => r.position === 'WR' || !r.position);
  const tightEnds = leaders.receiving.filter((r) => r.position === 'TE');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto px-4 pt-8 pb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">NFL Week Live</h1>
          <p className="text-slate-400 text-sm">Scores, stat leaders, and touchdown feed — Thursday through Monday</p>
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
        {tab === 'scoreboard' && (
          <>
            <section className="flex flex-col gap-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 -mb-3">
                Scoreboard
              </h2>
              {days.length === 0 ? (
                <p className="text-slate-500 text-sm">No games found this week.</p>
              ) : (
                days.map((day) => (
                  <div key={day.date}>
                    <h3 className="text-xs font-medium text-slate-500 mb-2">{formatDayHeading(day.date)}</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {day.games.map((game) => (
                        <ScoreboardCard key={game.id} game={game} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <LeadersTable title="Passing Leaders (QB)" columns={PASSING_COLUMNS} rows={leaders.passing} />
              <LeadersTable title="Rushing Leaders (RB)" columns={RUSHING_COLUMNS} rows={leaders.rushing} />
              <LeadersTable title="Receiving Leaders (WR)" columns={RECEIVING_COLUMNS} rows={receivers} />
              <LeadersTable title="Receiving Leaders (TE)" columns={RECEIVING_COLUMNS} rows={tightEnds} />
            </section>
          </>
        )}

        {tab === 'touchdowns' && (
          <section className="grid gap-6 lg:grid-cols-2 items-start">
            <TouchdownScorers touchdowns={leaders.touchdowns} />
            <TouchdownFeed touchdowns={leaders.touchdowns} />
          </section>
        )}

        {tab === 'projections' && predictions && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Week {predictions.week ?? '–'} Projections
              </h2>
              <p className="text-xs text-slate-500">
                Ridge/Poisson regression trained on every game played so far this season — rolling
                form, season average, home/away, and strength of upcoming opponent.
                {predictions.metrics?.passingMAE != null && (
                  <>
                    {' '}
                    Backtested MAE: {predictions.metrics.passingMAE} pass yds ·{' '}
                    {predictions.metrics.rushingMAE} rush yds · {predictions.metrics.receivingMAE} rec yds.
                  </>
                )}
              </p>
              {predictions.isSample && (
                <p className="text-xs text-amber-400 mt-1">
                  Sample projections from synthetic data — run{' '}
                  <code className="text-amber-300">ml/train.py</code> against live ESPN data for real ones.
                </p>
              )}
              {predictions.note && !predictions.isSample && (
                <p className="text-xs text-slate-500 mt-1">{predictions.note}</p>
              )}
            </div>

            <section className="grid gap-6 lg:grid-cols-2">
              <ProjectionChart title="Passing Yards (QB)" unit="yds" accent="#38bdf8" rows={predictions.passing} />
              <ProjectionChart title="Rushing Yards (RB)" unit="yds" accent="#f59e0b" rows={predictions.rushing} />
              <ProjectionChart
                title="Receiving Yards (WR/TE)"
                unit="yds"
                accent="#a78bfa"
                rows={predictions.receiving}
              />
              <TouchdownProbability rows={predictions.touchdowns} />
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
