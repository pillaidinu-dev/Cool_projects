#!/usr/bin/env node
// Turns raw get_equity_historicals output into data/sparklines.json.
//
// Usage:
//   node rebuild-sparklines.mjs --raw raw/sparklines_raw.json --out ../data/sparklines.json
//
// Input: a JSON array, the concatenation of every `.data.results` page from
// get_equity_historicals calls (weekly interval, default split-adjusted,
// start_time = prior year-end) for the tickers you want sparklines for --
// normally the top ~20 rows of the just-rebuilt data/gainers.json (fetch
// sparklines AFTER rebuild-gainers.mjs runs, using ITS top tickers, not the
// scan's raw top tickers -- split-adjustment reshuffles the ranking a lot).

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    raw: { type: "string" },
    out: { type: "string" },
  },
});

if (!values.raw || !values.out) {
  console.error("Usage: node rebuild-sparklines.mjs --raw <path> --out <path>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(values.raw, "utf8"));

const out = raw.map((series) => ({
  symbol: series.symbol,
  points: (series.bars || [])
    .filter((b) => !b.interpolated)
    .map((b) => Math.round(Number(b.close_price) * 100) / 100),
}));

writeFileSync(values.out, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote sparklines for ${out.length} tickers to ${values.out}`);
