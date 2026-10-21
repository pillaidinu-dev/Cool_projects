import { useEffect, useState, useCallback } from 'react';
import { fetchGames, fetchLeaders, fetchLatestProps, fetchPropHistory, fetchSlateDates } from './api.js';
import ScoreboardCard from './components/ScoreboardCard.jsx';
import LeadersTable from './components/LeadersTable.jsx';
import PropsBoard from './components/PropsBoard.jsx';
import BestPicks from './components/BestPicks.jsx';
import GameBoard from './components/GameBoard.jsx';
import Tracker from './components/Tracker.jsx';
import { easternYmd, formatDate, shiftYmd } from './stats.js';

const TABS = [
  { key: 'scoreboard', label: 'Scoreboard & Leaders' },
  { key: 'props', label: 'Prop Projections' },
  { key: 'tracker', label: 'Prop Tracker' },
];

const LEADER_BOARDS = [
  { stat: 'pts', title: 'Points' },
  { stat: 'reb', title: 'Rebounds' },
  { stat: 'ast', title: 'Assists' },
  { stat: 'fg3m', title: '3-Pointers Made' },
  { stat: 'stl', title: 'Steals' },
  { stat: 'blk', title: 'Blocks' },
];

const REFRESH_MS = 30_000;
const EMPTY_LEADERS = { players: [], leaders: {} };

function liveMap(leaders) {
  return Object.fromEntries((leaders?.players || []).map((p) => [p.id, p]));
}

export default function App() {
  const [date, setDate] = useState(easternYmd);
  const [games, setGames] = useState([]);
  const [leaders, setLeaders] = useState(EMPTY_LEADERS);
  const [slate, setSlate] = useState(null);
  const [slateLive, setSlateLive] = useState({});
  const [history, setHistory] = useState({ days: [] });
  const [dates, setDates] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('scoreboard');
  const [propView, setPropView] = useState('market');

  // Scores/leaders (ESPN, live) and props (the daily pipeline's files) load
  // independently, so ESPN being down never blanks the prop tabs.
  const refresh = useCallback(async () => {
    const [gamesRes, leadersRes, slateRes, historyRes, datesRes] = await Promise.allSettled([
      fetchGames(date),
      fetchLeaders(date),
      fetchLatestProps(),
      fetchPropHistory(),
      fetchSlateDates(),
    ]);
    if (gamesRes.status === 'fulfilled') setGames(gamesRes.value.games || []);
    if (leadersRes.status === 'fulfilled') setLeaders(leadersRes.value);
    if (historyRes.status === 'fulfilled') setHistory(historyRes.value);
    if (datesRes.status === 'fulfilled') setDates(datesRes.value.dates || []);
    if (slateRes.status === 'fulfilled') {
      const doc = slateRes.value;
      setSlate(doc);
      // Live progress on today's props comes from that slate date's box scores.
      const slateYmd = doc.date?.replaceAll('-', '');
      if (slateYmd && !doc.graded) {
        const live = slateYmd === date && leadersRes.status === 'fulfilled' ? leadersRes.value : await fetchLeaders(slateYmd).catch(() => null);
        setSlateLive(liveMap(live));
      }
    }
    const failed = [gamesRes, leadersRes, slateRes].find((r) => r.status === 'rejected');
    setError(failed ? failed.reason.message : null);
    setLastUpdated(new Date());
    setLoading(false);
  }, [date]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const today = easternYmd();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="max-w-6xl mx-auto px-4 pt-8 pb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">NBA Props Live</h1>
          <p className="text-slate-400 text-sm">
            Scores, stat leaders, daily player-prop projections, and a season-long prop tracker
          </p>
        </div>
        <div className="text-xs text-slate-500 text-right">
          {loading && <span>Loading…</span>}
          {!loading && lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
          {error && <p className="text-rose-400">{error}</p>}
        </div>
      </header>

      <nav className="max-w-6xl mx-auto px-4 flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-orange-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        {tab === 'scoreboard' && (
          <>
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mr-2">
                  {formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h2>
                <button type="button" onClick={() => setDate(shiftYmd(date, -1))} className="px-2 py-1 rounded-md border border-slate-700 text-xs text-slate-300 hover:border-slate-500">
                  ← Prev
                </button>
                {date !== today && (
                  <button type="button" onClick={() => setDate(today)} className="px-2 py-1 rounded-md border border-slate-700 text-xs text-slate-300 hover:border-slate-500">
                    Today
                  </button>
                )}
                <button type="button" onClick={() => setDate(shiftYmd(date, 1))} className="px-2 py-1 rounded-md border border-slate-700 text-xs text-slate-300 hover:border-slate-500">
                  Next →
                </button>
              </div>
              {games.length === 0 ? (
                <p className="text-slate-500 text-sm">No games on this date.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {games.map((game) => (
                    <ScoreboardCard key={game.id} game={game} />
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              {LEADER_BOARDS.map((b) => (
                <LeadersTable key={b.stat} title={`${b.title} leaders`} stat={b.stat} rows={leaders.leaders?.[b.stat] || []} />
              ))}
            </section>
          </>
        )}

        {tab === 'props' && slate && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {slate.date ? `${formatDate(slate.date, { weekday: 'long', month: 'short', day: 'numeric' })} slate` : 'Projections'}
                {slate.games?.length ? ` · ${slate.games.length} games · ${slate.players.length} players` : ''}
              </h2>
              <p className="text-xs text-slate-500">
                Ridge regression per market, trained on {slate.trainedOnGames ?? 'every stored'} games: recent form (last
                1/5/10/20), minutes, rest, home/away and the opponent&apos;s defense against that stat. Lines are
                the x.5 nearest each player&apos;s last-10 average (a stand-in for book lines, which have no free
                source); &quot;Fair&quot; is the over chance that average implies, and the lean is whichever side the
                model rates above it. Refreshed daily; frozen at tip-off and graded the next morning.
              </p>
              {slate.isSample && (
                <p className="text-xs text-amber-400 mt-1">
                  Sample projections from a synthetic league — the daily job (<code className="text-amber-300">ml/daily.py</code>)
                  replaces these with real ones on its first run.
                </p>
              )}
            </div>

            {slate.note && !slate.isSample && (
              <div className="rounded-xl bg-sky-950/40 border border-sky-800/50 px-4 py-3 text-sm text-sky-200">{slate.note}</div>
            )}

            {slate.players.length === 0 ? (
              <p className="text-slate-500 text-sm">{slate.note || 'No projections yet.'}</p>
            ) : (
              <>
                <div className="flex gap-1 self-start rounded-lg border border-slate-700 p-0.5" role="group" aria-label="View">
                  {[
                    ['market', 'By market'],
                    ['game', 'By game'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPropView(key)}
                      aria-pressed={propView === key}
                      className={`px-3 py-1 rounded-md text-xs font-semibold ${
                        propView === key ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {propView === 'market' ? <PropsBoard slate={slate} live={slateLive} /> : <GameBoard slate={slate} live={slateLive} />}
                <BestPicks slate={slate} />
              </>
            )}
          </section>
        )}

        {tab === 'tracker' && (
          <>
            {history.isSample && (
              <p className="text-xs text-amber-400 -mb-4">Sample tracker built from a synthetic league — real results accumulate once the daily job runs.</p>
            )}
            <Tracker history={history} dates={dates} />
          </>
        )}
      </main>
    </div>
  );
}
