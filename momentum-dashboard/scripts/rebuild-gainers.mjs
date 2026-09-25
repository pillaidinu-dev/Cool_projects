#!/usr/bin/env node
// Turns raw Robinhood MCP tool output into data/gainers.json.
//
// Usage:
//   node rebuild-gainers.mjs --scan raw/scan_results.json --baselines raw/baselines.json --out ../data/gainers.json [--date 2026-09-25]
//
// Inputs (see README.md "Data pipeline" for how to produce them):
//   --scan       A JSON array, the concatenation of every `.data.result.results`
//                page from preview_scan calls (each element looks like
//                { ticker, columns: { Name, Last, "Market cap", "Average volume",
//                Volume, "% Change" } } -- the raw "YTD Baseline Close"/"YTD %
//                Change" columns from the scan are IGNORED here on purpose,
//                because they're computed from unadjusted prices and are wrong
//                for any ticker that had a stock split during the year).
//   --baselines  A JSON object { TICKER: splitAdjustedDec31CloseNumber },
//                built from get_equity_historicals (default split-adjusted)
//                for exactly 2025-12-31 (or whatever the prior year-end is),
//                one entry per ticker in --scan. A ticker missing from this
//                file is dropped (no baseline = can't verify YTD%).
//
// This script is the only place the "100%+ YTD" business rule lives:
// split-adjusted recomputation, ETN/leveraged-product exclusion, and the
// >=100% threshold. Keeping it in code (not re-derived by an LLM each week)
// is what prevents a repeat of the reverse-split false-positive bug that this
// project's README documents.

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    scan: { type: "string" },
    baselines: { type: "string" },
    out: { type: "string" },
    date: { type: "string" },
  },
});

if (!values.scan || !values.baselines || !values.out) {
  console.error("Usage: node rebuild-gainers.mjs --scan <path> --baselines <path> --out <path> [--date YYYY-MM-DD]");
  process.exit(1);
}

const scanRows = JSON.parse(readFileSync(values.scan, "utf8"));
const baselines = JSON.parse(readFileSync(values.baselines, "utf8"));
const generatedAt = values.date ? `${values.date}T00:00:00Z` : new Date().toISOString();

const EXCLUDE_NAME_RE = /ETN|Leveraged|Inverse/i;
const seen = new Set();
const rows = [];

for (const row of scanRows) {
  const ticker = row.ticker;
  if (!ticker || seen.has(ticker)) continue;
  seen.add(ticker);

  const c = row.columns || {};
  const name = c.Name;
  if (!name || EXCLUDE_NAME_RE.test(name)) continue;

  const marketCapRaw = c["Market cap"];
  if (marketCapRaw === undefined || marketCapRaw === null || marketCapRaw === "") continue;
  const marketCap = Number(marketCapRaw);
  if (!Number.isFinite(marketCap)) continue;

  const baseline = baselines[ticker];
  if (baseline === undefined || baseline === null) continue; // no split-adjusted baseline available
  const baselineNum = Number(baseline);
  if (!Number.isFinite(baselineNum) || baselineNum <= 0) continue;

  const last = Number(c.Last);
  if (!Number.isFinite(last)) continue;

  const ytdPct = (last - baselineNum) / baselineNum;
  if (ytdPct < 1.0) continue; // the real, split-adjusted gate

  rows.push({
    ticker,
    name,
    last,
    ytd_pct: ytdPct,
    ytd_baseline: baselineNum,
    market_cap: marketCap,
    avg_volume: Number(c["Average volume"]) || 0,
    volume: Number(c.Volume) || 0,
    day_change_pct: Number(c["% Change"]) || 0,
  });
}

rows.sort((a, b) => b.ytd_pct - a.ytd_pct);

const out = {
  generated_at: generatedAt,
  as_of_note: `Live intraday snapshot captured ${generatedAt.slice(0, 10)} via Robinhood MCP scanner + historicals`,
  methodology: {
    universe: "All Robinhood-tradable US common stocks (FILTER_TYPE_INSTRUMENT_TYPE=STOCK), price >= $1, 30-day average volume >= 50,000 shares",
    ytd_baseline: "Split-adjusted closing price on the last trading day of the prior year, fetched per-ticker via get_equity_historicals",
    ytd_calc: "(current_price - baseline_close) / baseline_close, using split-adjusted prices throughout so reverse/forward stock splits during the year do not distort the return",
    threshold: "ytd_pct >= 1.00 (100%+)",
    excluded: "Leveraged/inverse ETNs, and any candidate whose apparent gain was a stock-split artifact rather than real price appreciation (verified and excluded — see README)",
    note: "Broad market screen, not restricted to the S&P 500 — includes S&P 500 constituents alongside small- and micro-cap names",
  },
  count: rows.length,
  stocks: rows,
};

writeFileSync(values.out, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${rows.length} qualifying stocks to ${values.out}`);
