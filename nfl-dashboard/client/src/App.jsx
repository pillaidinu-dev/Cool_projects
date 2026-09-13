import { useEffect, useState, useCallback } from 'react';
import { fetchGames, fetchLeaders } from './api.js';
import ScoreboardCard from './components/ScoreboardCard.jsx';
import LeadersTable from './components/LeadersTable.jsx';
import TouchdownFeed from './components/TouchdownFeed.jsx';

const REFRESH_MS = 20_000;

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
  const [games, setGames] = useState([]);
  const [leaders, setLeaders] = useState({ passing: [], rushing: [], receiving: [], touchdowns: [] });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [gamesData, leadersData] = await Promise.all([fetchGames(), fetchLeaders()]);
      setGames(gamesData.games || []);
      setLeaders(leadersData);
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
          <h1 className="text-2xl font-bold">NFL Sunday Live</h1>
          <p className="text-slate-400 text-sm">Scores, stat leaders, and touchdown feed</p>
        </div>
        <div className="text-xs text-slate-500 text-right">
          {loading && <span>Loading…</span>}
          {!loading && lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
          {error && <p className="text-rose-400">{error}</p>}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-12 flex flex-col gap-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Scoreboard
          </h2>
          {games.length === 0 ? (
            <p className="text-slate-500 text-sm">No games found for this date.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <ScoreboardCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <LeadersTable title="Passing Leaders (QB)" columns={PASSING_COLUMNS} rows={leaders.passing} />
          <LeadersTable title="Rushing Leaders (RB)" columns={RUSHING_COLUMNS} rows={leaders.rushing} />
          <LeadersTable title="Receiving Leaders (WR)" columns={RECEIVING_COLUMNS} rows={receivers} />
          <LeadersTable title="Receiving Leaders (TE)" columns={RECEIVING_COLUMNS} rows={tightEnds} />
        </section>

        <section>
          <TouchdownFeed touchdowns={leaders.touchdowns} />
        </section>
      </main>
    </div>
  );
}
