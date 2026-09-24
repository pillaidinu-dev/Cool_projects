import { useEffect, useState, useCallback } from 'react';
import { fetchGames, fetchLeaders, fetchSeasonLeaders, fetchPredictions } from './api.js';
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
// Season leaders walk every completed week's box scores, not just the
// current one -- a heavier fetch, so it refreshes less often and only
// while the season view is actually being looked at (see the effect below).
const SEASON_REFRESH_MS = 60_000;

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

// Season tables reuse the weekly column sets plus a games-played count,
// since "210 yards" means something different across 1 game vs 6.
const SEASON_PASSING_COLUMNS = [...PASSING_COLUMNS, { key: 'games', label: 'GP' }];
const SEASON_RUSHING_COLUMNS = [...RUSHING_COLUMNS, { key: 'games', label: 'GP' }];
const SEASON_RECEIVING_COLUMNS = [...RECEIVING_COLUMNS, { key: 'games', label: 'GP' }];
const TOUCHDOWN_LEADER_COLUMNS = [
  { key: 'touchdowns', label: 'TD' },
  { key: 'games', label: 'GP' },
];

const EMPTY_LEADERS = { passing: [], rushing: [], receiving: [], touchdowns: [] };

export default function App() {
  const [days, setDays] = useState([]);
  const [leaders, setLeaders] = useState(EMPTY_LEADERS);
  const [predictions, setPredictions] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('scoreboard');
  const [leaderRange, setLeaderRange] = useState('week');
  const [seasonLeaders, setSeasonLeaders] = useState(EMPTY_LEADERS);
  const [seasonMeta, setSeasonMeta] = useState(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState(null);

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

  const refreshSeason = useCallback(async () => {
    setSeasonLoading(true);
    try {
      const data = await fetchSeasonLeaders();
      setSeasonLeaders(data);
      setSeasonMeta({ season: data.season, throughWeek: data.throughWeek });
      setSeasonError(null);
    } catch (err) {
      setSeasonError(err.message);
    } finally {
      setSeasonLoading(false);
    }
  }, []);

  // Walking every week's box scores is a much heavier fetch than the
  // current-week view, so only poll it while someone's actually looking at
  // the season toggle -- not on every 20s tick regardless of tab/range.
  useEffect(() => {
    if (tab !== 'scoreboard' || leaderRange !== 'season') return undefined;
    refreshSeason();
    const id = setInterval(refreshSeason, SEASON_REFRESH_MS);
    return () => clearInterval(id);
  }, [tab, leaderRange, refreshSeason]);

  const activeLeaders = leaderRange === 'season' ? seasonLeaders : leaders;
  const receivers = activeLeaders.receiving.filter((r) => r.position === 'WR' || !r.position);
  const tightEnds = activeLeaders.receiving.filter((r) => r.position === 'TE');

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

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Leaders</h2>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex rounded-lg border border-slate-700/60 overflow-hidden">
                    {[
                      { key: 'week', label: 'This Week' },
                      { key: 'season', label: 'Season' },
                    ].map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setLeaderRange(r.key)}
                        className={`px-3 py-1.5 font-medium transition-colors ${
                          leaderRange === r.key
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {leaderRange === 'season' && (
                    <span className="text-slate-500">
                      {seasonLoading && !seasonMeta
                        ? 'Loading…'
                        : seasonMeta && `Through week ${seasonMeta.throughWeek}, ${seasonMeta.season}`}
                    </span>
                  )}
                </div>
              </div>

              {leaderRange === 'season' && seasonError && (
                <p className="text-rose-400 text-sm">{seasonError}</p>
              )}

              <section className="grid gap-6 lg:grid-cols-2">
                {leaderRange === 'week' ? (
                  <>
                    <LeadersTable title="Passing Leaders (QB)" columns={PASSING_COLUMNS} rows={activeLeaders.passing} />
                    <LeadersTable title="Rushing Leaders (RB)" columns={RUSHING_COLUMNS} rows={activeLeaders.rushing} />
                    <LeadersTable title="Receiving Leaders (WR)" columns={RECEIVING_COLUMNS} rows={receivers} />
                    <LeadersTable title="Receiving Leaders (TE)" columns={RECEIVING_COLUMNS} rows={tightEnds} />
                  </>
                ) : (
                  <>
                    <LeadersTable title="Passing Leaders (QB)" columns={SEASON_PASSING_COLUMNS} rows={activeLeaders.passing} />
                    <LeadersTable title="Rushing Leaders (RB)" columns={SEASON_RUSHING_COLUMNS} rows={activeLeaders.rushing} />
                    <LeadersTable title="Receiving Leaders (WR)" columns={SEASON_RECEIVING_COLUMNS} rows={receivers} />
                    <LeadersTable title="Receiving Leaders (TE)" columns={SEASON_RECEIVING_COLUMNS} rows={tightEnds} />
                    <LeadersTable title="Touchdown Leaders" columns={TOUCHDOWN_LEADER_COLUMNS} rows={activeLeaders.touchdowns} />
                  </>
                )}
              </section>
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
            </div>

            {predictions.note && !predictions.isSample && (
              <div className="rounded-xl bg-sky-950/40 border border-sky-800/50 px-4 py-3 text-sm text-sky-200">
                {predictions.note}
              </div>
            )}

            <section className="grid gap-6 lg:grid-cols-2">
              <ProjectionChart
                title="Passing Yards (QB)"
                unit="yds"
                accent="#38bdf8"
                rows={predictions.passing}
                emptyMessage={predictions.note || 'No projections yet.'}
              />
              <ProjectionChart
                title="Rushing Yards (RB)"
                unit="yds"
                accent="#f59e0b"
                rows={predictions.rushing}
                emptyMessage={predictions.note || 'No projections yet.'}
              />
              <ProjectionChart
                title="Receiving Yards (WR/TE)"
                unit="yds"
                accent="#a78bfa"
                rows={predictions.receiving}
                emptyMessage={predictions.note || 'No projections yet.'}
              />
              <TouchdownProbability
                accent="#34d399"
                rows={predictions.touchdowns}
                emptyMessage={predictions.note || 'No projections yet.'}
              />
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
