// Pure portfolio math. Cost basis uses the average-cost method: a sell
// removes shares at the position's current average cost per share, and the
// difference between the sale proceeds (net of fees) and that cost is the
// realized profit. Buy fees are folded into the cost basis.

const EPSILON = 1e-9;

export function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => (a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date < b.date ? -1 : 1));
}

function emptyPosition(symbol) {
  return { symbol, shares: 0, cost: 0, realized: 0, fees: 0, invested: 0, firstDate: null };
}

// Applies one transaction to a position in place. Throws if a sell exceeds
// the shares held at that point.
function apply(position, tx) {
  const fee = tx.fee || 0;
  position.fees += fee;
  if (!position.firstDate) position.firstDate = tx.date;
  if (tx.side === 'buy') {
    position.shares += tx.shares;
    position.cost += tx.shares * tx.price + fee;
    position.invested += tx.shares * tx.price + fee;
    return;
  }
  if (tx.shares > position.shares + EPSILON) {
    throw new Error(
      `Cannot sell ${tx.shares} ${tx.symbol} on ${tx.date}: only ${round(position.shares)} held at that point`,
    );
  }
  const avgCost = position.shares > 0 ? position.cost / position.shares : 0;
  const costOfSold = tx.shares * avgCost;
  position.realized += tx.shares * tx.price - fee - costOfSold;
  position.cost -= costOfSold;
  position.shares -= tx.shares;
  if (position.shares < EPSILON) {
    position.shares = 0;
    position.cost = 0;
  }
}

// Replays every transaction in date order and returns one position per
// symbol: { symbol, shares, cost, realized, fees, invested, firstDate }.
export function replay(transactions) {
  const positions = new Map();
  for (const tx of sortTransactions(transactions)) {
    if (!positions.has(tx.symbol)) positions.set(tx.symbol, emptyPosition(tx.symbol));
    apply(positions.get(tx.symbol), tx);
  }
  return positions;
}

// Combines positions with current quotes. A missing quote falls back to the
// average cost so totals stay meaningful; the holding is flagged as stale.
export function summarize(positions, quotes) {
  const holdings = [];
  for (const p of positions.values()) {
    const quote = quotes[p.symbol];
    const stale = !quote || quote.price == null;
    const avgCost = p.shares > 0 ? p.cost / p.shares : 0;
    const price = stale ? avgCost : quote.price;
    const marketValue = p.shares * price;
    const unrealized = marketValue - p.cost;
    const dayChange = stale || p.shares === 0 ? 0 : p.shares * (quote.change ?? 0);
    holdings.push({
      symbol: p.symbol,
      name: quote?.name ?? p.symbol,
      currency: quote?.currency ?? 'USD',
      shares: round(p.shares),
      avgCost,
      price,
      stale,
      change: stale ? null : quote.change,
      changePercent: stale ? null : quote.changePercent,
      marketValue,
      costBasis: p.cost,
      unrealized,
      unrealizedPercent: p.cost > 0 ? (unrealized / p.cost) * 100 : 0,
      realized: p.realized,
      totalPnl: unrealized + p.realized,
      dayChange,
      fees: p.fees,
      firstDate: p.firstDate,
    });
  }
  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const sum = (key) => holdings.reduce((acc, h) => acc + h[key], 0);
  const marketValue = sum('marketValue');
  const costBasis = sum('costBasis');
  const unrealized = sum('unrealized');
  const realized = sum('realized');
  const dayChange = sum('dayChange');
  const previousValue = marketValue - dayChange;
  return {
    holdings,
    totals: {
      marketValue,
      costBasis,
      unrealized,
      unrealizedPercent: costBasis > 0 ? (unrealized / costBasis) * 100 : 0,
      realized,
      totalPnl: unrealized + realized,
      dayChange,
      dayChangePercent: previousValue > 0 ? (dayChange / previousValue) * 100 : 0,
      fees: sum('fees'),
    },
  };
}

// Builds a daily series of { date, value, cost, pnl } from the first
// transaction to the last available close. `closes` maps symbol to an
// ascending [{ date, close }] list. Prices are carried forward over gaps (a
// holiday on one exchange, a missing bar) and transactions dated on a
// non-trading day take effect on the next trading day.
export function buildHistory(transactions, closes) {
  const sorted = sortTransactions(transactions);
  if (sorted.length === 0) return [];
  const start = sorted[0].date;

  const dates = new Set();
  for (const series of Object.values(closes)) {
    for (const bar of series) if (bar.date >= start) dates.add(bar.date);
  }
  const timeline = [...dates].sort();

  const positions = new Map();
  const lastClose = {};
  const cursors = {};
  let txIndex = 0;
  const out = [];

  for (const date of timeline) {
    while (txIndex < sorted.length && sorted[txIndex].date <= date) {
      const tx = sorted[txIndex++];
      if (!positions.has(tx.symbol)) positions.set(tx.symbol, emptyPosition(tx.symbol));
      apply(positions.get(tx.symbol), tx);
    }
    for (const [symbol, series] of Object.entries(closes)) {
      let i = cursors[symbol] ?? 0;
      while (i < series.length && series[i].date <= date) lastClose[symbol] = series[i++].close;
      cursors[symbol] = i;
    }

    let value = 0;
    let cost = 0;
    let realized = 0;
    for (const p of positions.values()) {
      const price = lastClose[p.symbol] ?? (p.shares > 0 ? p.cost / p.shares : 0);
      value += p.shares * price;
      cost += p.cost;
      realized += p.realized;
    }
    out.push({ date, value: round(value, 2), cost: round(cost, 2), pnl: round(value - cost + realized, 2) });
  }
  return out;
}

const RANGE_MONTHS = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '5Y': 60 };
export const RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'];

// First date (YYYY-MM-DD) included in a range ending today, or null for ALL.
export function rangeStart(range, today = new Date()) {
  if (range === 'ALL') return null;
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (range === 'YTD') return `${d.getUTCFullYear()}-01-01`;
  const months = RANGE_MONTHS[range];
  if (!months) throw new Error(`Unknown range ${range}`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function round(n, digits = 6) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
