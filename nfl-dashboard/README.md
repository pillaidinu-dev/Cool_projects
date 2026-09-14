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
