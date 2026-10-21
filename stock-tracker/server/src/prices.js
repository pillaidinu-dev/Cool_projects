import db from './db.js';

// Where prices come from. 'yahoo' (default) uses Yahoo Finance's public chart
// endpoint, which needs no API key. 'demo' generates a deterministic random
// walk per ticker, for working on the app offline or where Yahoo is blocked.
const SOURCE = (process.env.PRICE_SOURCE || 'yahoo').toLowerCase();

const QUOTE_TTL_MS = 60_000;
// Daily history only changes once a day; refetching it hourly is plenty and
// still picks up today's close soon after the market shuts.
const HISTORY_TTL_MS = 60 * 60_000;

const quoteCache = new Map(); // symbol -> { at, quote }

export function priceSource() {
  return SOURCE;
}

export function normalizeSymbol(raw) {
  return String(raw || '').trim().toUpperCase();
}

export function isValidSymbol(symbol) {
  // Letters, digits, dots and dashes: AAPL, BRK-B, RY.TO, ^GSPC is excluded on purpose.
  return /^[A-Z0-9][A-Z0-9.\-=]{0,14}$/.test(symbol);
}

function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

// ---- Yahoo -----------------------------------------------------------------

async function yahooChart(symbol, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (stock-tracker)' } });
  if (res.status === 404) throw Object.assign(new Error(`Unknown ticker ${symbol}`), { status: 404 });
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${symbol}`);
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result) {
    const message = body?.chart?.error?.description || `No data for ${symbol}`;
    throw Object.assign(new Error(message), { status: 404 });
  }
  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const offset = (meta.gmtoffset || 0) * 1000;
  const history = [];
  timestamps.forEach((ts, i) => {
    if (closes[i] == null) return;
    // Date each bar in the exchange's own timezone so a close isn't shifted
    // to the next UTC day.
    history.push({ date: toYmd(new Date(ts * 1000 + offset)), close: closes[i] });
  });
  return {
    quote: {
      symbol,
      name: meta.longName || meta.shortName || symbol,
      currency: meta.currency || 'USD',
      price: meta.regularMarketPrice ?? history.at(-1)?.close ?? null,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    },
    history,
  };
}

// ---- Demo ------------------------------------------------------------------

function hashString(s) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Five years of weekday closes, the same every run for a given ticker, so
// demo profits are stable between restarts.
function demoChart(symbol) {
  const rand = mulberry32(hashString(symbol));
  const drift = 0.0002 + rand() * 0.0006;
  const vol = 0.012 + rand() * 0.015;
  let price = 20 + rand() * 280;
  const history = [];
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCFullYear(day.getUTCFullYear() - 5);
  const today = toYmd(new Date());
  while (toYmd(day) <= today) {
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      // Box-Muller for a normal-ish daily return.
      const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
      price = Math.max(1, price * (1 + drift + vol * z));
      history.push({ date: toYmd(day), close: Math.round(price * 100) / 100 });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const last = history.at(-1);
  return {
    quote: {
      symbol,
      name: `${symbol} (demo data)`,
      currency: 'USD',
      price: last.close,
      previousClose: history.at(-2)?.close ?? last.close,
      marketTime: new Date().toISOString(),
    },
    history,
  };
}

async function fetchChart(symbol, range) {
  return SOURCE === 'demo' ? demoChart(symbol) : yahooChart(symbol, range);
}

// ---- Cache-aware public API ------------------------------------------------

const upsertPrice = db.prepare(
  'INSERT INTO daily_prices (symbol, date, close) VALUES (?, ?, ?) ON CONFLICT(symbol, date) DO UPDATE SET close = excluded.close',
);
const upsertFetch = db.prepare(
  'INSERT INTO price_fetches (symbol, fetched_at, earliest) VALUES (?, ?, ?) ON CONFLICT(symbol) DO UPDATE SET fetched_at = excluded.fetched_at, earliest = MIN(price_fetches.earliest, excluded.earliest)',
);
const selectFetch = db.prepare('SELECT fetched_at, earliest FROM price_fetches WHERE symbol = ?');
const selectHistory = db.prepare('SELECT date, close FROM daily_prices WHERE symbol = ? AND date >= ? ORDER BY date');
const selectLastClose = db.prepare('SELECT date, close FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1');

function storeHistory(symbol, history) {
  if (history.length === 0) return;
  db.exec('BEGIN');
  try {
    for (const { date, close } of history) upsertPrice.run(symbol, date, close);
    upsertFetch.run(symbol, new Date().toISOString(), history[0].date);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Smallest Yahoo range that reaches back to `since`.
function rangeFor(since) {
  const days = (Date.now() - new Date(`${since}T00:00:00Z`).getTime()) / 86_400_000;
  if (days <= 28) return '1mo';
  if (days <= 88) return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 360) return '1y';
  if (days <= 725) return '2y';
  if (days <= 1820) return '5y';
  if (days <= 3640) return '10y';
  return 'max';
}

export async function getQuote(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.quote;
  const { quote, history } = await fetchChart(symbol, '5d');
  quoteCache.set(symbol, { at: Date.now(), quote });
  storeHistory(symbol, history);
  return quote;
}

// Daily closes for `symbol` from `since` (YYYY-MM-DD) to today, served from
// SQLite when the cache is fresh and already reaches back far enough.
export async function getHistory(symbol, since) {
  const fetched = selectFetch.get(symbol);
  const fresh = fetched && Date.now() - new Date(fetched.fetched_at).getTime() < HISTORY_TTL_MS;
  const coversRange = fetched && fetched.earliest <= since;
  if (!fresh || !coversRange) {
    try {
      const { quote, history } = await fetchChart(symbol, rangeFor(since));
      quoteCache.set(symbol, { at: Date.now(), quote });
      storeHistory(symbol, history);
      if (history.length && history[0].date > since) {
        // The ticker didn't trade that far back; record the full range as
        // covered so we don't refetch on every request.
        upsertFetch.run(symbol, new Date().toISOString(), since);
      }
    } catch (err) {
      // Stale history beats no graph. Only fail if there's nothing cached.
      if (!fetched) throw err;
      console.warn(`Using cached history for ${symbol}: ${err.message}`);
    }
  }
  return selectHistory.all(symbol, since);
}

// Latest known price even when the live source is down, for the positions
// table to fall back on.
export function lastCachedClose(symbol) {
  return selectLastClose.get(symbol) || null;
}
