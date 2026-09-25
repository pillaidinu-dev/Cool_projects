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
Regenerating the data means re-running the same steps in a Claude session with
Robinhood MCP access:

1. **Screen the broad market.** A saved Robinhood scanner (`YTD 100%+ Gainers
   (Broad Market)`) filters `FILTER_TYPE_INSTRUMENT_TYPE = STOCK`, price ≥ $1,
   30-day average volume ≥ 50,000 shares, and an expression filter:
   ```
   tradeAllDay.price >= 2 * close(candleCount=184, candlePeriod="1d", session="all")
   ```
   `184` is the number of US trading days between 2025-12-31 and the snapshot
   date (2026-09-25) — re-derive it for a new date by counting trading days, or
   just re-run the scan on the day you regenerate the data (the candle count
   needs to match "today" for the comparison to land on Dec 31).

2. **Verify every candidate against split-adjusted prices.** This step is not
   optional. The scanner's `close()` expression returns **raw, unadjusted**
   historical prices, but a stock that did a reverse split during the year will
   show a huge fake "gain" under raw prices (the reverse split multiplies the
   *current* price without adjusting the old one). Building this dashboard once
   without this step put 37 reverse-split artifacts in the top of the list —
   including one "top gainer" that was actually down ~74% for the year. The fix:
   fetch each candidate's actual **2025-12-31 close with `adjustment_type=split`**
   (the default) via `get_equity_historicals`, and recompute
   `(current_price - split_adjusted_close) / split_adjusted_close`. Only keep
   rows where that recomputed number is still ≥ 100%.

3. **Drop non-equity noise.** A handful of leveraged/inverse ETNs pass the raw
   filters (Robinhood classifies some of them as `STOCK`); they're excluded by
   name pattern (`ETN|Leveraged|Inverse`).

4. **Pull weekly closes** for the top movers (`get_equity_historicals`, weekly
   interval, split-adjusted) for the sparkline charts.

The result — `data/gainers.json` and `data/sparklines.json` — is what the
dashboard actually reads. `data/gainers.json` carries a `methodology` block
describing exactly what was screened.

## Running locally

```bash
cd momentum-dashboard/server
npm install
npm run dev
```

Open http://localhost:4100. The server just serves the static `client/` folder
and the `data/` folder — there's no build step and no database.

## Refreshing the data

There's no automated refresh (see above — it needs a live Robinhood MCP
session). To refresh: ask Claude, with Robinhood MCP access, to re-run the scan
above, re-verify the split-adjusted YTD for each result, and overwrite
`data/gainers.json` / `data/sparklines.json`. The saved scan (`YTD 100%+
Gainers (Broad Market)`) is already in the Robinhood account it was created
from — `run_scan` on it gets the current raw candidate list; steps 2–4 above
still need to be redone by hand (or by Claude) each time.

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
