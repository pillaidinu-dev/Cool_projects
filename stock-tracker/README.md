# Stock Tracker

Log your stock trades and see what they're worth: current holdings, profit on each ticker, and
how your portfolio's value and profit have moved over time. Prices refresh every minute.

## What it shows

The **Portfolio** tab:

- **Summary**: market value with today's change, total profit, unrealized profit (with % return
  on cost basis), and realized profit from shares you've sold.
- **Performance chart**: daily market value against cost basis, or switch to **Profit** to see
  total profit (unrealized + realized) by day. Ranges run from 1M to ALL, and the header shows how
  much profit changed over the selected range.
- **Holdings**: shares, average cost, price, today's move, value, and unrealized and realized
  profit per ticker. Closed positions (fully sold) are listed underneath with their realized profit.
- **Allocation** donut and a **Profit by ticker** bar chart.
- Click any ticker to open its **price chart**, with ▲ buy and ▼ sell markers at the prices you
  paid and a dashed line at your average cost.

The **Trades** tab records buys and sells (shares, price, fee, date, note). The **use live** link
fills in the current price, and **Export CSV** downloads the ledger.

The **Watchlist** tab follows tickers you don't hold, with a 1-month sparkline.

## How profit is calculated

Cost basis uses the **average-cost method**:

- A **buy** adds its shares and `shares × price + fee` to the position's cost basis.
- A **sell** removes shares at the position's current average cost per share. Realized profit is
  `shares × sale price − fee − shares × average cost`.
- **Unrealized** profit is `shares × current price − remaining cost basis`.

The server replays the whole ledger in date order on every change and rejects any trade that would
sell more shares than you held on that date. That includes deleting an old buy that a later sell
depends on.

The performance history uses daily closes. A price is carried forward across gaps, and a trade
dated on a weekend or holiday counts from the next trading day.

## Prices

Live prices come from **Yahoo Finance's public chart API**, which needs no API key. Quotes are
cached for 60 seconds and daily history for an hour. Any symbol Yahoo knows works, including ETFs
(`VOO`), share classes (`BRK-B`), indices (`^GSPC`), non-US listings (`SHOP.TO`) and crypto
(`BTC-USD`).

To run without network access, set `PRICE_SOURCE=demo`. Every ticker then gets a made-up but
consistent random-walk price history, and the UI shows a **Demo prices** banner so it's never
mistaken for real data.

## Stack

- **Backend** (`server/`): Express + `node:sqlite` (Node's built-in SQLite, no native build).
  Trades and the watchlist are stored in `stock-tracker.db`, or the file set by `DB_PATH`.
- **Frontend** (`client/`): React + Vite + Tailwind CSS v4 + Recharts.

## Running locally

Requires Node 22.13+ (for `node:sqlite` without a flag).

```bash
# API server (port 4200)
cd stock-tracker/server
npm install
npm run dev                      # live Yahoo prices
PRICE_SOURCE=demo npm run dev    # offline demo prices

# Optional: load a sample portfolio, priced at each day's actual close
npm run seed

# Client (port 5173, proxies /api to :4200)
cd ../client
npm install
npm run dev
```

Run the server's tests with `npm test` in `server/`. They cover the cost-basis math, the history
builder and Yahoo response parsing.

## Deploying

`render.yaml` includes a `stock-tracker` service built from `stock-tracker/Dockerfile`, which
serves the built client from the API server. On Render's free plan the filesystem is ephemeral, so
the SQLite file resets on every redeploy or restart. To keep your trades, attach a persistent disk
and point `DB_PATH` at it, for example `DB_PATH=/var/data/stock-tracker.db`.
