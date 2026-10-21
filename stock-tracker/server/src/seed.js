// Loads a small sample ledger so the charts have something to show. Each
// trade is priced at that day's close from the active price source, so it
// works with real (Yahoo) and demo prices alike.
import { db } from './db.js';
import { getHistory } from './prices.js';

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const SAMPLE = [
  ['AAPL', 'buy', 10, daysAgo(700)],
  ['MSFT', 'buy', 5, daysAgo(650)],
  ['NVDA', 'buy', 20, daysAgo(600)],
  ['AAPL', 'buy', 5, daysAgo(400)],
  ['VOO', 'buy', 8, daysAgo(380)],
  ['NVDA', 'sell', 8, daysAgo(250)],
  ['AMZN', 'buy', 12, daysAgo(200)],
  ['MSFT', 'buy', 3, daysAgo(120)],
  ['AMZN', 'sell', 4, daysAgo(40)],
];

if (db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n > 0) {
  console.log('Ledger already has transactions; leaving it alone.');
} else {
  const insert = db.prepare('INSERT INTO transactions (symbol, side, shares, price, fee, date) VALUES (?, ?, ?, ?, ?, ?)');
  for (const [symbol, side, shares, date] of SAMPLE) {
    const [bar] = await getHistory(symbol, date);
    insert.run(symbol, side, shares, bar.close, 1, bar.date);
  }
  for (const symbol of ['GOOGL', 'TSLA', 'META']) {
    db.prepare('INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)').run(symbol);
  }
  console.log(`Seeded ${SAMPLE.length} transactions and 3 watchlist tickers.`);
}
