# US Open Prediction Markets Dashboard

A Robinhood-styled dashboard for browsing sports prediction markets (event
contracts), scoped exclusively to the **US Open** — Men's and Women's
Singles.

## Why sample data

Robinhood does run event-contract prediction markets, but the Robinhood
trading API/MCP tools available in this environment only cover stocks,
options, crypto, indexes, and scanners — there's no endpoint for sports
prediction markets. So this dashboard ships with a realistic, clearly
labeled sample dataset (`src/data/markets.js`) instead of a live feed. The
UI, sorting, search, sparklines, and bracket view all work exactly the same
once a real feed is wired in — just replace `loadMarkets()`.

## What's in it

- **Championship winner market** — one row per contender, priced in ¢ as
  implied probability (a $1 "Yes" contract), with 24h change, volume, and a
  sparkline, for both the Men's and Women's draws.
- **Quarterfinal matchups** — head-to-head contract pricing for each
  quarterfinal pairing.
- **Detail panel** — expanded chart and mock Yes/No buy buttons (disabled;
  this dashboard is read-only) for the selected contender.
- Search and sort (by probability, biggest movers, or volume).

## Running locally

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).

## Going live

Replace `loadMarkets()` in `src/data/markets.js` with a call to whatever
real prediction-market data source you wire up (a scraper, a partner API,
manual entry, etc.) returning the same shape:

```js
{
  men:   { outright: [...contenders], bracket: [...matchups] },
  women: { outright: [...contenders], bracket: [...matchups] },
}
```

Everything downstream (rows, charts, search, sort, bracket cards) consumes
that shape and needs no changes.
