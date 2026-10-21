import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Node's built-in SQLite driver -- no native module to compile, so the
// server installs the same way on a laptop, in CI, and in the slim Docker
// image.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'stocks.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;

  -- One row per purchase (lot). Buying the same ticker twice at different
  -- prices is two rows, so profit stays exact per lot.
  CREATE TABLE IF NOT EXISTS positions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol     TEXT    NOT NULL,
    shares     REAL    NOT NULL CHECK (shares > 0),
    buy_price  REAL    NOT NULL CHECK (buy_price >= 0),
    buy_date   TEXT    NOT NULL,              -- YYYY-MM-DD
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Daily closes, cached so the profit graphs don't refetch years of
  -- history on every page load.
  CREATE TABLE IF NOT EXISTS daily_prices (
    symbol TEXT NOT NULL,
    date   TEXT NOT NULL,                      -- YYYY-MM-DD
    close  REAL NOT NULL,
    PRIMARY KEY (symbol, date)
  );

  -- When each symbol's history was last pulled, and how far back it goes.
  CREATE TABLE IF NOT EXISTS price_fetches (
    symbol     TEXT PRIMARY KEY,
    fetched_at TEXT NOT NULL,
    earliest   TEXT NOT NULL
  );
`);

export default db;
