// Market data. The default source is Yahoo Finance's public chart API (no
// key needed). PRICE_SOURCE=demo swaps in a deterministic random walk per
// ticker, for working offline or in sandboxes that block outbound requests;
// every response carries `source` so the UI can label demo prices clearly.

import { HttpError } from './errors.js';

export const SOURCE = process.env.PRICE_SOURCE === 'demo' ? 'demo' : 'yahoo';

const QUOTE_TTL_MS = 60_000;
const HISTORY_TTL_MS = 60 * 60_000;
const cache = new Map();

// Caches a promise per key, so concurrent callers share one request and a
// failed request is not cached.
function cached(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = load();
  cache.set(key, { promise, expires: Date.now() + ttl });
  promise.catch(() => cache.delete(key));
  return promise;
}

export function normalizeSymbol(raw) {
  const symbol = String(raw ?? '').trim().toUpperCase();
  if (!/^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$/.test(symbol)) {
    throw new HttpError(400, `"${raw}" is not a valid ticker symbol`);
  }
  return symbol;
}

// { symbol, name, currency, exchange, price, previousClose, change, changePercent, time }
export function getQuote(symbol) {
  return cached(`quote:${symbol}`, QUOTE_TTL_MS, () =>
    SOURCE === 'demo' ? demoQuote(symbol) : yahooQuote(symbol),
  );
}

// Ascending [{ date, close }] of daily closes from `from` (YYYY-MM-DD) to today.
export function getHistory(symbol, from) {
  return cached(`history:${symbol}:${from}`, HISTORY_TTL_MS, () =>
    SOURCE === 'demo' ? demoHistory(symbol, from) : yahooHistory(symbol, from),
  );
}

// --- Yahoo Finance ---------------------------------------------------------

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

async function yahooChart(symbol, params) {
  const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?${new URLSearchParams(params)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (stock-tracker)' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new HttpError(502, `Price lookup for ${symbol} failed: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  const result = body?.chart?.result?.[0];
  if (!result) {
    const description = body?.chart?.error?.description;
    if (res.status === 404 || body?.chart?.error?.code === 'Not Found') {
      throw new HttpError(404, `Unknown ticker ${symbol}`);
    }
    throw new HttpError(502, `Price lookup for ${symbol} failed: ${description || `HTTP ${res.status}`}`);
  }
  return result;
}

async function yahooQuote(symbol) {
  const { meta } = await yahooChart(symbol, { range: '1d', interval: '1d' });
  const price = meta.regularMarketPrice;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  return buildQuote({
    symbol,
    name: meta.longName || meta.shortName || symbol,
    currency: meta.currency || 'USD',
    exchange: meta.fullExchangeName || meta.exchangeName || '',
    price,
    previousClose,
    time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
  });
}

async function yahooHistory(symbol, from) {
  const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const result = await yahooChart(symbol, { period1, period2, interval: '1d' });
  const offset = result.meta?.gmtoffset ?? 0;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const bars = [];
  (result.timestamp ?? []).forEach((ts, i) => {
    if (closes[i] == null) return;
    // Date the bar in the exchange's own timezone, so a close is never
    // shifted onto the neighbouring calendar day.
    bars.push({ date: new Date((ts + offset) * 1000).toISOString().slice(0, 10), close: closes[i] });
  });
  return dedupeByDate(bars);
}

function dedupeByDate(bars) {
  const byDate = new Map(bars.map((b) => [b.date, b]));
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// --- Demo prices -----------------------------------------------------------

const DEMO_START = '2015-01-02';

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const demoSeries = new Map();

// Every weekday from DEMO_START to today, as a seeded random walk so a given
// ticker always shows the same made-up chart.
function demoAllCloses(symbol) {
  if (demoSeries.has(symbol)) return demoSeries.get(symbol);
  const seed = hash(symbol);
  const random = mulberry32(seed);
  const drift = 0.0001 + (seed % 7) * 0.00005;
  const vol = 0.012 + (seed % 5) * 0.003;
  let price = 15 + (seed % 400);
  const bars = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let d = new Date(`${DEMO_START}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    if (date > today) break;
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    // Box-Muller normal draw for the daily log return.
    const z = Math.sqrt(-2 * Math.log(random() || 1e-12)) * Math.cos(2 * Math.PI * random());
    price = Math.max(1, price * Math.exp(drift + vol * z));
    bars.push({ date, close: Math.round(price * 100) / 100 });
  }
  demoSeries.set(symbol, bars);
  return bars;
}

async function demoHistory(symbol, from) {
  return demoAllCloses(symbol).filter((b) => b.date >= from);
}

async function demoQuote(symbol) {
  const bars = demoAllCloses(symbol);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2] ?? last;
  return buildQuote({
    symbol,
    name: `${symbol} (demo)`,
    currency: 'USD',
    exchange: 'Demo',
    price: last.close,
    previousClose: prev.close,
    time: `${last.date}T20:00:00.000Z`,
  });
}

function buildQuote(q) {
  const change = q.price - q.previousClose;
  return { ...q, change, changePercent: q.previousClose ? (change / q.previousClose) * 100 : 0 };
}
