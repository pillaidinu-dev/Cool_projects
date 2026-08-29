# US Open Prediction Markets Dashboard

A Robinhood-styled dashboard for browsing sports prediction markets (event
contracts), scoped exclusively to the **US Open** — Men's and Women's
Singles.

## Why this isn't live Robinhood data

Robinhood does run a real event-contract prediction market for the US Open
(robinhood.com/us/en/prediction-markets/tennis/), but two things block
pulling from it directly in this environment: the Robinhood MCP tools only
cover stocks, options, crypto, indexes, and scanners — no event-contract
endpoint — and robinhood.com itself isn't reachable from this environment's
network (egress-blocked).

So `src/data/markets.js` instead ships with the **real current field and
seeding** for the 2026 US Open, with win probabilities compiled from public
sources as of **August 28–29, 2026**:

- Official 2026 US Open men's and women's seeding lists (tennis365.com,
  puntodebreak.com)
- Kalshi's live prediction-market percentages, post-draw
  (news.kalshi.com/p/us-open-mens-odds-2026-alcaraz-favored, reporting via
  Yahoo Sports and oddsshopper.com)
- Sportsbook lines converted to implied probability for a couple of entries
  Kalshi's public reporting didn't cover directly (Yahoo Sports, BetMGM)

Notably, **Jannik Sinner and Holger Rune have both withdrawn** (Sinner: knee
injury, announced Aug 21, 2026) and are correctly absent from the field —
an earlier draft of this dashboard used stale placeholder data that still
had Sinner in it. The "Field (rest of draw)" row is `100 − sum of the ten
listed prices`, since a real market has ~128 entrants per draw, not 10.

The UI, sorting, search, sparklines, and bracket view all work exactly the
same once a genuinely live feed exists — just replace `loadMarkets()`.

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
