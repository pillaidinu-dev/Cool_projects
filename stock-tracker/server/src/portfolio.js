import db from './db.js';
import { getQuote, getHistory, lastCachedClose } from './prices.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function listPositions() {
  return db
    .prepare('SELECT id, symbol, shares, buy_price AS buyPrice, buy_date AS buyDate, notes FROM positions ORDER BY symbol, buy_date, id')
    .all();
}

// Current value and profit/loss for every lot, plus per-ticker and overall
// totals. A ticker whose live quote fails falls back to its last cached
// close (flagged `stale`) rather than dropping out of the totals.
export async function portfolioSnapshot() {
  const positions = listPositions();
  const symbols = [...new Set(positions.map((p) => p.symbol))];

  const quotes = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        quotes[symbol] = { ...(await getQuote(symbol)), stale: false };
      } catch (err) {
        const cached = lastCachedClose(symbol);
        quotes[symbol] = cached
          ? { symbol, name: symbol, price: cached.close, previousClose: null, asOf: cached.date, stale: true }
          : { symbol, name: symbol, price: null, previousClose: null, stale: true, error: err.message };
      }
    }),
  );

  const lots = positions.map((p) => {
    const quote = quotes[p.symbol];
    const cost = p.shares * p.buyPrice;
    const value = quote.price == null ? null : p.shares * quote.price;
    const profit = value == null ? null : value - cost;
    return {
      ...p,
      price: quote.price,
      cost: round2(cost),
      value: value == null ? null : round2(value),
      profit: profit == null ? null : round2(profit),
      profitPct: profit == null || cost === 0 ? null : round2((profit / cost) * 100),
    };
  });

  const holdings = symbols.map((symbol) => {
    const quote = quotes[symbol];
    const mine = lots.filter((l) => l.symbol === symbol);
    const shares = mine.reduce((s, l) => s + l.shares, 0);
    const cost = mine.reduce((s, l) => s + l.cost, 0);
    const priced = quote.price != null;
    const value = priced ? shares * quote.price : null;
    const dayChange = priced && quote.previousClose != null ? shares * (quote.price - quote.previousClose) : null;
    return {
      symbol,
      name: quote.name,
      price: quote.price,
      previousClose: quote.previousClose,
      stale: quote.stale,
      error: quote.error,
      shares: round2(shares * 10_000) / 10_000,
      avgCost: shares ? round2(cost / shares) : null,
      cost: round2(cost),
      value: priced ? round2(value) : null,
      profit: priced ? round2(value - cost) : null,
      profitPct: priced && cost ? round2(((value - cost) / cost) * 100) : null,
      dayChange: dayChange == null ? null : round2(dayChange),
      lots: mine,
    };
  });

  const priced = holdings.filter((h) => h.value != null);
  const totalCost = priced.reduce((s, h) => s + h.cost, 0);
  const totalValue = priced.reduce((s, h) => s + h.value, 0);
  const dayChange = priced.reduce((s, h) => s + (h.dayChange ?? 0), 0);

  return {
    holdings,
    totals: {
      cost: round2(totalCost),
      value: round2(totalValue),
      profit: round2(totalValue - totalCost),
      profitPct: totalCost ? round2(((totalValue - totalCost) / totalCost) * 100) : null,
      dayChange: round2(dayChange),
      unpriced: holdings.filter((h) => h.value == null).map((h) => h.symbol),
    },
  };
}

const RANGE_DAYS = { '1m': 30, '3m': 91, '6m': 182, '1y': 365, '5y': 1826 };
export const RANGES = [...Object.keys(RANGE_DAYS), 'all'];

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

// Portfolio value, cost basis and profit for each trading day in the range,
// plus each ticker's own profit line. A lot only counts from its buy date
// onward, so buying more shows up as a step in cost basis, not as profit.
export async function profitHistory(range = '6m') {
  const positions = listPositions();
  if (positions.length === 0) return { range, symbols: [], points: [] };

  const firstBuy = positions.reduce((min, p) => (p.buyDate < min ? p.buyDate : min), positions[0].buyDate);
  let start = firstBuy;
  if (range !== 'all') {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - RANGE_DAYS[range]);
    if (ymd(d) > start) start = ymd(d);
  }

  // Start a week early so every ticker has a close to carry forward into
  // day one of the window, even across a long weekend.
  const seed = new Date(`${start}T00:00:00Z`);
  seed.setUTCDate(seed.getUTCDate() - 7);
  const seedFrom = ymd(seed);

  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const closesBySymbol = {};
  const failed = [];
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const rows = await getHistory(symbol, seedFrom);
        closesBySymbol[symbol] = new Map(rows.map((r) => [r.date, r.close]));
      } catch (err) {
        failed.push({ symbol, error: err.message });
        closesBySymbol[symbol] = new Map();
      }
    }),
  );

  // Every date any held ticker traded, so markets with different holidays
  // still line up; missing closes carry the previous one forward.
  const allDates = [...new Set(Object.values(closesBySymbol).flatMap((m) => [...m.keys()]))].sort();
  const dates = allDates.filter((d) => d >= start);

  const lastClose = {};
  for (const date of allDates) {
    if (date >= start) break;
    for (const symbol of symbols) {
      const close = closesBySymbol[symbol].get(date);
      if (close != null) lastClose[symbol] = close;
    }
  }
  const points = dates.map((date) => {
    let value = 0;
    let cost = 0;
    const bySymbol = {};
    for (const symbol of symbols) {
      const close = closesBySymbol[symbol].get(date);
      if (close != null) lastClose[symbol] = close;
    }
    for (const p of positions) {
      if (p.buyDate > date) continue;
      const close = lastClose[p.symbol];
      if (close == null) continue;
      const lotCost = p.shares * p.buyPrice;
      const lotValue = p.shares * close;
      value += lotValue;
      cost += lotCost;
      bySymbol[p.symbol] = (bySymbol[p.symbol] ?? 0) + lotValue - lotCost;
    }
    const point = { date, value: round2(value), cost: round2(cost), profit: round2(value - cost) };
    for (const [symbol, profit] of Object.entries(bySymbol)) point[symbol] = round2(profit);
    return point;
  });

  return { range, start, symbols, points, failed };
}
