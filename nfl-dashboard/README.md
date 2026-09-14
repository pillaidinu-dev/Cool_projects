# NFL Week Live

A live dashboard for a full NFL week (Thursday through Monday): scores, passing/rushing/receiving
leaders, and a touchdown-scorer feed. It polls the backend every 20 seconds so scores and stats
update automatically while games are in progress.

## What it shows

The **Scoreboard & Leaders** tab:

- **Scoreboard** — every game across the current NFL week (Thu/Fri/Sat/Sun/Mon), grouped by day,
  with live score, quarter/clock (or final/scheduled status) and team records.
- **Passing leaders** — QB completions/attempts, yards, TDs, interceptions.
- **Rushing leaders** — carries, yards, TDs.
- **Receiving leaders** — split into WR and TE tables, with receptions, yards, TDs.

The **Touchdowns** tab:

- **Touchdown scorers** — every player who scored this week, ranked by touchdown count.
- **Touchdown feed** — the play-by-play behind that: every touchdown scored across the week's
  games, newest first, pulled from each game's scoring plays.

The **Projections** tab:

- **Passing / rushing / receiving yardage charts** — projected yards for the upcoming week's
  starters, with a low–high range band, for QBs, RBs, and WR/TE respectively.
- **Anytime touchdown probability** — every skill player's estimated chance of scoring a
  touchdown in their upcoming game.
- A **backtested accuracy line** (mean absolute error, in yards) so the numbers come with an
  honest sense of how far off they typically are.

## Weekly projections (the ML model)

`ml/` is a small Python pipeline, separate from the live Node dashboard, that projects next
week's stats from this season's box scores so far:

1. **`dataset.py`** walks every completed week of the season via ESPN's API and builds a
   player-game-log table (one row per player per game actually played).
2. **`features.py`** turns that into leakage-free training rows — each week's *target* stat is
   predicted only from *prior* weeks: last game, trailing 3-game average, season average, games
   played, home/away, and how many yards the upcoming opponent has allowed to that position so
   far.
3. **`model.py`** fits one Ridge regression per yardage category (passing/rushing/receiving) and
   a Poisson regression for touchdowns, then reports 5-fold cross-validated MAE so the dashboard
   can show how trustworthy the current numbers are.
4. **`train.py`** orchestrates all of the above for the upcoming week and writes
   `predictions/latest.json`, which the server's `/api/predictions` route serves as-is.

Ridge regression (not a heavier model) is deliberate: early in a season a player may have one or
two games of history, and a high-variance model overfits that noise. Ridge's regularization
keeps projections sane on thin data, and gets more confident as the season accumulates games —
that's what the backtested MAE shown in the UI is tracking.

**Running it**: needs network access to ESPN (`site.api.espn.com`), which some sandboxed dev
environments block — run it locally, in CI, or from the deployed server:

```bash
cd nfl-dashboard/ml
pip install -r requirements.txt
python train.py                 # projects ESPN's current week, writes predictions/latest.json
python train.py --week 7 --year 2026   # a specific week
```

The Node server also tries this itself: on boot and every 6 hours (`server/src/predictions.js`),
it shells out to `python3 train.py` and serves whatever the latest successful run produced,
falling back to the last good file (or the checked-in sample) if a run fails — for example,
because the container has no network path to ESPN. The Docker image bundles Python 3 and the
`ml/` dependencies specifically so this works out of the box.

**The checked-in `ml/predictions/latest.json`** is sample data generated from synthetic game
logs (`ml/make_sample.py`) — clearly flagged `isSample: true` and shown with a banner in the UI —
so the Projections tab has something real-shaped to render before the pipeline has ever run
against live data.

**Verifying the pipeline without ESPN access**: `python tests/selftest.py` exercises
`features.py` and `model.py` end-to-end against synthetic game logs (no network needed) and
asserts the output shapes are sane — this is how the pipeline was validated in a sandbox that
can't reach ESPN.

## Data source

Stats come from ESPN's public scoreboard/summary endpoints (no API key needed). The server
fetches per-game box scores and scoring plays and reshapes them into the leader lists and TD
feed above, caching each response for 15 seconds so multiple dashboard tabs don't hammer ESPN.
ESPN doesn't publish or version-guarantee this API, so the server treats every field as optional
and degrades gracefully (an empty list, not a crash) if a shape changes.

## Stack

- **Backend** (`server/`): Express, no database — everything is fetched live and cached in memory.
- **Frontend** (`client/`): React + Vite + Tailwind CSS v4, polling-based (no websockets).

## Running locally

Two terminals:

```bash
# Terminal 1 — API on http://localhost:4100
cd nfl-dashboard/server
npm install
npm run dev

# Terminal 2 — web app on http://localhost:5173 (proxies /api to the server)
cd nfl-dashboard/client
npm install
npm run dev
```

Open http://localhost:5173. It always shows the current NFL week (Thursday through the following
Monday) — during game days that's live/in-progress games; between weeks it shows the week that
just finished, until the next Thursday's games kick off.

## Notes / limitations

- "Week" is defined as Thursday through Monday (UTC calendar days), which covers the standard
  Thu/Sun/Mon slate plus the Friday/Saturday games that show up late in the season (Thanksgiving,
  Christmas, week 18). Pass `?date=YYYYMMDD` to the API routes to look at the week containing a
  different date, e.g. for testing a past week.
- Player position (WR vs TE) comes from ESPN's roster data; if it's ever missing for a player,
  they're bucketed into the WR table rather than dropped.
- This depends on an unofficial, undocumented ESPN endpoint. It's the same data source widely
  used by other open-source NFL scoreboards, but ESPN could change or rate-limit it at any time.
- **Projections are early-season-weak by design** — in weeks 1–2 there's almost no history to
  learn from, so numbers lean heavily on the backtested MAE shown in the UI and widen visibly.
  They get more reliable as the season accumulates games.
- Projections only cover players who appeared in one of the last two completed weeks (a proxy
  for "likely to play"), so a season debut or a return from a long injury won't show up until
  they've played at least once. There's no injury-report integration.
- The touchdown model predicts *rushing/receiving* touchdowns only (the usual "anytime TD
  scorer" definition) — passing touchdowns are credited to the receiver, not counted again for
  the QB.
