# Momentum Dashboard

A dashboard of every US stock currently trading **100%+ above its 2025-12-31 closing
price** — a broad market screen (not restricted to the S&P 500) built from live
Robinhood market data via the Robinhood MCP connector.

## What's in it

- **KPI tiles** — how many stocks qualify, the median YTD gain, the single biggest
  gainer, and how many of them are large/mega-cap names (so it doesn't read as
  "all penny stocks").
- **Top 20 gainers** bar chart.
- **Market cap vs. YTD gain** scatter (log-scale market cap, colored by size tier)
  and a **distribution histogram** of gain sizes.
- **Price-trend sparklines** for the top 12 movers since Dec 31.
- **A full sortable, searchable, filterable table** of all qualifying stocks.

## Data pipeline (how the list was built)

This is a **snapshot**, not a live-refreshing feed — the Robinhood MCP connector
is only reachable from inside a Claude session, not from this deployed server.
A weekly Routine re-runs the steps below in a fresh Claude session (see
"Refreshing the data"). The fiddly, easy-to-get-wrong parts (split-adjustment
verification, ETN exclusion, the >=100% threshold, the YTD-anchor date math)
live in `scripts/*.mjs`, not in a prompt someone re-derives from memory —
that's deliberate, see the postmortem in step 2.

1. **Compute the YTD anchor.** The scanner has no native "since Jan 1" filter,
   so it's built as "price >= 2x price N trading days ago," where `N` is a
   moving count of NYSE trading days that has to be recomputed on every run:
   ```bash
   node scripts/trading-day-offset.mjs        # or: ... 2026-09-25
   ```
   This is pure calendar math against a hardcoded NYSE holiday calendar (no
   network call) — see the script for the holiday list if the exchange
   calendar ever changes.

2. **Screen the broad market.** Call `preview_scan` (or `run_scan` on the
   saved scan `YTD 100%+ Gainers (Broad Market)`, then edit its filter's
   `candleCount` if the anchor from step 1 changed) with:
   - `FILTER_TYPE_INSTRUMENT_TYPE = STOCK`
   - `FILTER_TYPE_LAST >= 1`
   - `FILTER_TYPE_AVERAGE_VOLUME >= 50000` (interval `1d`, length `30`)
   - expression filter: `tradeAllDay.price >= 2 * close(candleCount=<N from step 1>, candlePeriod="1d", session="all")`
   - columns: `Market cap` (needed by the rebuild script; everything else it
     needs — `Last`, `Name`, `Average volume`, `Volume`, `% Change` — comes
     back by default)

   Robinhood's scan tools cap a single response at 200 rows. If `total_items`
   in the response is over 200, re-run with an added
   `FILTER_TYPE_LAST < <price of the 200th/last row>` filter to get the rest,
   and concatenate every page's `results` array into one flat JSON array —
   save it as `scripts/raw/scan_results.json`.

   **Do not trust this scan's own `YTD %`/`YTD Baseline Close` columns if you
   add them** — they're computed from Robinhood's raw, unadjusted `close()`,
   which is wrong for any ticker that split during the year (see step 4).
   `rebuild-gainers.mjs` ignores them entirely and recomputes from scratch.

3. **Fetch a split-adjusted baseline for every candidate.** For each ticker
   from step 2 (batched 10 per call — `get_equity_historicals` takes up to 10
   symbols), fetch a single day of history for the prior year's last trading
   day (e.g. `start_time: "2025-12-31T00:00:00Z"`, `end_time:
   "2026-01-01T23:59:00Z"`, `interval: "day"`, default `adjustment_type` —
   i.e. **do not** pass `adjustment_type: "none"`). Build an object
   `{ TICKER: close_price }` from each response's `bars[0].close_price`
   (skip tickers with an empty `bars` array — usually a stock that IPO'd
   after the baseline date) and save it as `scripts/raw/baselines.json`.

4. **Rebuild the verified dataset.**
   ```bash
   node scripts/rebuild-gainers.mjs \
     --scan scripts/raw/scan_results.json \
     --baselines scripts/raw/baselines.json \
     --out data/gainers.json
   ```
   This is where the actual "100%+ YTD" rule lives: it recomputes
   `(current_price - split_adjusted_baseline) / split_adjusted_baseline` for
   every row using the step-3 baseline (not the scan's raw one), drops
   anything that doesn't clear 100% on that corrected number, and drops
   ETN/leveraged/inverse products by name. Building this dashboard once
   *without* this step put 37 reverse-split artifacts at the top of the
   list — including one "top gainer" that had actually **fallen** ~74% for
   the year, because a reverse split had multiplied its current price
   without adjusting the old one it was being compared against. Any prompt
   or agent regenerating this data must run this script rather than
   recomputing the filter inline — that bug is exactly what re-deriving the
   logic by hand reproduces.

5. **Fetch sparklines for the new top movers.** Take the top ~20 tickers from
   the just-written `data/gainers.json` (the ranking shifts after step 4's
   correction, so use *this* list, not the raw scan's top tickers). Fetch
   `get_equity_historicals` for them (batched 10 per call, `interval: "week"`,
   `start_time` = the prior year-end, default split-adjusted), concatenate
   the `results` arrays into `scripts/raw/sparklines_raw.json`, then:
   ```bash
   node scripts/rebuild-sparklines.mjs \
     --raw scripts/raw/sparklines_raw.json \
     --out data/sparklines.json
   ```

`data/gainers.json` carries a `methodology` block describing exactly what was
screened, generated fresh by `rebuild-gainers.mjs` on every run.

## Running locally

```bash
cd momentum-dashboard/server
npm install
npm run dev
```

Open http://localhost:4100. The server just serves the static `client/` folder
and the `data/` folder — there's no build step and no database.

## Refreshing the data

A weekly Routine (Saturday mornings, US Eastern) spawns a fresh Claude session
with Robinhood MCP and push access to this repo, which runs the pipeline above
end to end and commits `data/gainers.json` + `data/sparklines.json` straight to
`main`. To trigger a refresh manually instead, ask Claude (with Robinhood MCP
access) to follow the "Data pipeline" steps above — the saved scan
(`YTD 100%+ Gainers (Broad Market)`) already exists in the connected Robinhood
account for step 2's `run_scan` path.

## Stack

- **Client**: static HTML/CSS/vanilla JS, [Chart.js](https://www.chartjs.org/)
  (vendored locally in `client/vendor/`, no CDN dependency) for the bar/scatter/
  histogram charts, and hand-rolled inline SVG for the sparklines.
- **Server**: a ~15-line Express static file server (`server/`).

## Not investment advice

This is a market-data screen. It does not recommend buying, selling, or
holding anything. A stock being up 100% YTD says nothing about what it does
next — several names on this list are speculative micro-caps with thin
volume. Do your own research.
