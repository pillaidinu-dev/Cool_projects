# Stock Tracker

Track the stocks you own: add each purchase (ticker, shares, buy price, date), see what your
holdings are worth right now and your profit or loss, and graph how that profit has moved over
time.

## What it shows

The **Portfolio** tab:

- **Summary cards** for current value, cost basis, total profit/loss (in dollars and percent),
  and today's change.
- **Add a position** form. Typing a ticker looks it up and shows the company name and current
  price, with a one-click "use as buy price".
- **Holdings** table, one row per ticker with shares, average cost, price, value and profit/loss.
  Expand a ticker to see each purchase (lot) separately, and edit or remove it.

The **Profit Graphs** tab, with a 1M / 3M / 6M / 1Y / 5Y / All range toggle:

- **Profit / loss over time** for the whole portfolio, green above zero and red below.
- **Value vs. cost basis**, where the cost line steps up each time you bought more, so new money
  in isn't mistaken for profit.
- **Profit by ticker**, one line per holding.

Each purchase only counts from its buy date onward, so the graphs show what your profit actually
was on each day, not what today's holdings would have made.

## Running locally

Needs Node 22.13 or newer (for the built-in `node:sqlite`).

```bash
# Terminal 1: API on http://localhost:4200
cd stock-tracker/server
npm install
npm run dev          # live prices from Yahoo Finance
# or: npm run demo   # made-up prices, works offline

# Terminal 2: web app on http://localhost:5173 (proxies /api to the server)
cd stock-tracker/client
npm install
npm run dev
```

## Prices

`PRICE_SOURCE` picks where prices come from:

- `yahoo` (default) uses Yahoo Finance's public chart endpoint. No API key needed. Quotes are
  cached for a minute and daily history for an hour, and history is stored in SQLite so the
  graphs don't refetch years of closes on every load. If Yahoo is unreachable the app falls back
  to the last cached close and marks the ticker as stale.
- `demo` generates a repeatable random walk per ticker (the same ticker always gets the same
  prices). Use it offline, in CI, or anywhere Yahoo is blocked. Demo tickers are labelled
  "(demo data)" in the UI.

## Data

SQLite, at `server/data/stocks.db` by default (override with `DB_PATH`). Tables:

- `positions` holds one row per purchase: symbol, shares, buy price, buy date.
- `daily_prices` caches daily closes per symbol.
- `price_fetches` records when each symbol's history was last pulled.

When deploying, put `DB_PATH` on a persistent volume. On a host with an ephemeral disk (like
Render's free plan) positions are wiped on every redeploy or restart.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/positions` | Holdings with live value and profit, plus totals |
| POST | `/api/positions` | Add a lot: `{ symbol, shares, buyPrice, buyDate }` |
| PUT | `/api/positions/:id` | Edit any of those fields |
| DELETE | `/api/positions/:id` | Remove a lot |
| GET | `/api/history?range=6m` | Daily value, cost, profit and per-ticker profit (`1m`, `3m`, `6m`, `1y`, `5y`, `all`) |
| GET | `/api/quote/:symbol` | Name and current price for one ticker |
| GET | `/api/health` | Health check, and which price source is active |

## Docker

```bash
docker build -f stock-tracker/Dockerfile -t stock-tracker .
docker run -p 4200:4200 -v stock-data:/data stock-tracker
```

The image builds the client and serves it from the API server on port 4200.
