# NBA prop data (accumulated)

Written by `ml/daily.py`, committed back to the repo once or twice a day by
`.github/workflows/nba-daily.yml`. Don't hand-edit; rerun the pipeline instead.

- `boxscores/<date>.csv` — every player-game the models train on, one file per game date.
- `projections/<date>.json` — each day's prop projections, frozen at tip-off and graded
  (actuals + hit/miss per prop) the next morning.
- `history.json` — the season-long tracker rolled up from every graded slate.
- `latest.json` — today's slate (or the most recent one on an off day).
- `state.json` — the last date fully fetched, so each run only pulls what's new.
