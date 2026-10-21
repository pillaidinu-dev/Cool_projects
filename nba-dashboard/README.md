# NBA Props Live

The NBA sibling of [NFL Week Live](../nfl-dashboard/README.md), built around **player props**:
points, rebounds, assists, threes, steals and blocks (plus PRA and steals+blocks). It has live
scores and stat leaders, daily prop projections, and a tracker that saves and grades every
projection all season.

## What it shows

**Scoreboard & Leaders**: every game on a date (step through days with Prev/Next), with live
score, quarter and clock. Below that, leader boards for points, rebounds, assists, 3-pointers,
steals and blocks, each with the player's full stat line. Polls every 30 seconds.

**Prop Projections** (today's slate):

- Pick a market (PTS, REB, AST, 3PM, STL, BLK, PRA, STL+BLK) to see every rotation player's
  **line**, **projection** with a likely range, the model's **over %**, the **fair** over %
  implied by the player's last-10 average, and the **lean and edge** (which side the model rates
  above that price, and by how much). L5 and L10 averages sit alongside.
- A **Live** column tracks each prop as the game is played and turns green once the over hits.
- Players listed as day-to-day or questionable get a ⚠ badge. Players ruled **Out** are left
  off the slate.
- **Top 10 edges** lists the slate's biggest disagreements with the L10 price, across every
  market.

**Prop Tracker** (accumulated all season):

- **ROI** (units won per unit staked at fair odds) for every lean and for each day's top 10,
  as tiles and as a season-to-date line chart.
- Hit rate, ROI and average miss **by market**.
- **Calibration**: when the model says 65%, does it hit about 65% of the time?
- Any **past slate's** full board, with actual results and ✓ / ✗ on every prop.

## How the daily refresh and accumulation work

`ml/daily.py` runs once a day:

1. **Fetch** every game finished since the last run into `data/boxscores/<date>.csv`, the
   accumulated player-game store. The first run bootstraps by walking back about 40 game days,
   which reaches into the end of last season. That way opening-week projections have real
   history behind them.
2. **Grade** every saved slate whose box scores are now in: write the actuals and hit/miss
   into `data/projections/<date>.json`, then roll everything up into `data/history.json`.
3. **Project** today's slate to `data/projections/<today>.json` and copy it to `latest.json`.
   A slate is **frozen once any of its games tips off**, so every graded prop was a real
   pre-game call.

`.github/workflows/nba-daily.yml` runs it on a schedule: about 10am ET (grade last night,
project today) and about 6pm ET (re-project before tip-off with the latest injury news). It
then **commits `nba-dashboard/data/` back to the repo**. The props and results build up in git,
survive redeploys (Render's free disk doesn't), and every commit redeploys the dashboard with
fresh data. You can also start a run by hand from the Actions tab (**Run workflow**).

The Docker image also runs the pipeline in-process on boot and every 6 hours
(`NBA_SERVER_REFRESH=1`), as a fallback for when the Action hasn't run yet. Output from that
fallback lasts only as long as the container. Local `npm run dev` leaves it off, so it doesn't
rewrite the checked-in data under you. Set `NBA_SERVER_REFRESH=1` to opt in.

Until the first real run, the server serves `data-sample/`: a few weeks of slates and a tracker
built by the real pipeline from a synthetic league (`ml/make_sample.py`). It's flagged in the UI
as sample data.

## The model

- **Features** (`ml/features.py`): last 1/5/10/20-game averages of the stat, minutes over the
  last 5 games, games of history, home/away, rest days (back-to-backs), and the opponent's
  defense factor. The defense factor is how much of that stat the opponent has allowed over its
  last 15 games, relative to league average. Training rows only use games *before* the row's
  date. Windows span seasons, so early-season form leans on last season's tail.
- **Projection** (`ml/model.py`): one Ridge regression per market, the same reasoning as the NFL
  models. A heavier model overfits 10-game noise. The spread scales with the projection (a 30 ppg
  scorer swings more than an 8 ppg one). Over % uses a normal tail for PTS/REB/AST/PRA and a
  Poisson tail for 3PM/STL/BLK/STL+BLK.
- **Backtest**: each market's MAE on the most recent ~20% of dates, set next to a plain L10
  average on the same games. You can see whether the model beats the naive baseline.
- **Lines and pricing**: there's no free source of real sportsbook lines, so each line is the
  x.5 nearest the player's L10 average. Raw hit rate against those lines would mostly measure
  where the line sits: a 1.4 spg player's 1.5 steals line goes under about 60% of the time no
  matter who picks it. So each prop is also **priced** from the L10 average (`Fair`). The lean is
  the side the model rates above that price, and the tracker scores picks in units at those fair
  odds. Positive ROI means the model knows something the L10 average doesn't. Read it as signal
  quality, not real-money returns: real books charge vig and set sharper lines.
- Only rotation players (12+ minutes over the last 5 games) get props. A market is only posted
  once the player's L10 clears a floor (5 pts, 3 reb, 2 ast, 1 three, 0.8 stl/blk, ...).
  Without that floor, near-certain unders like "a point guard's blocks under 0.5" would flood
  the top picks.

## Running locally

```bash
# Terminal 1 — API on http://localhost:4200
cd nba-dashboard/server
npm install
npm run dev

# Terminal 2 — web app on http://localhost:5173 (proxies /api to the server)
cd nba-dashboard/client
npm install
npm run dev

# Refresh the data (needs network access to ESPN)
cd nba-dashboard/ml
pip install -r requirements.txt
python daily.py                     # today (US Eastern)
python daily.py --date 2026-11-02   # a specific slate
```

`python tests/selftest.py` runs the whole pipeline without any network. It uses a fake ESPN
(`tests/fake_espn.py`) that serves a synthetic league in ESPN's real response shapes:
bootstrapping, a run per day, grading, the tracker, and the freeze-at-tip-off rule. CI runs it
on every PR.

## API

| Route | Purpose |
|---|---|
| `GET /api/games?date=YYYYMMDD` | Scoreboard for a date (default: today, ET) |
| `GET /api/leaders?date=YYYYMMDD` | Every player's box score line plus per-stat leaders |
| `GET /api/props/latest` | Today's slate (or the most recent one) |
| `GET /api/props/history` | The season-long tracker |
| `GET /api/props/dates` | Every saved slate date |
| `GET /api/props/date/YYYY-MM-DD` | One saved slate, graded if it's in the past |

## Notes / limitations

- Data comes from ESPN's public but unofficial and undocumented API, the same one the NFL
  dashboard uses. Every field is read defensively, and box-score columns are matched by label
  *or* key, but ESPN could still change or rate-limit it.
- Lines are proxies, as described above. Plugging in a real odds feed would mean replacing
  `prop_line()` and `pFair` in `ml/projections.py`.
- Injury status comes from ESPN's team roster endpoint. If that call fails, the slate falls back
  to "whoever last played for the team", without injury filtering. Players traded in the
  offseason show up under their new team as soon as the roster endpoint lists them.
- The game-log store grows by about 40 KB per game day, roughly 8 MB a season, and the saved
  slates about as much again.
