// Reads what the daily pipeline (ml/daily.py) writes: today's slate
// (latest.json), every saved slate (projections/<date>.json, listed in
// index.json) and the season-long tracker (history.json).
//
// When NBA_DATA_URL is set (the deployed service points it at this repo's
// data/ folder on raw.githubusercontent.com), files are read from there, so
// each daily commit shows up within minutes without a rebuild. Otherwise —
// or if that fetch fails — they're read from the local data/ directory, and
// until the first real run has produced data/latest.json, from data-sample/
// (synthetic, flagged isSample so the UI says so).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ML_DIR = path.join(__dirname, '..', '..', 'ml');
export const DATA_DIR = process.env.NBA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
export const DATA_URL = process.env.NBA_DATA_URL?.replace(/\/+$/, '');
const SAMPLE_DIR = path.join(__dirname, '..', '..', 'data-sample');

// raw.githubusercontent.com itself caches for ~5 minutes, so refetching more
// often than that buys nothing.
const REMOTE_CACHE_MS = 5 * 60 * 1000;
const remoteCache = new Map(); // relative path -> { at, data }

async function readRemote(rel) {
  const cached = remoteCache.get(rel);
  if (cached && Date.now() - cached.at < REMOTE_CACHE_MS) return cached.data;
  try {
    const res = await fetch(`${DATA_URL}/${rel}`);
    // A 404 is a real answer (no such slate, or no real run yet), so it's
    // cached like any other; only network/server errors fall through.
    const data = res.ok ? await res.json() : res.status === 404 ? null : undefined;
    if (data !== undefined) remoteCache.set(rel, { at: Date.now(), data });
    return data;
  } catch {
    return undefined;
  }
}

function localDir() {
  return fs.existsSync(path.join(DATA_DIR, 'latest.json')) ? DATA_DIR : SAMPLE_DIR;
}

function readLocal(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(localDir(), rel), 'utf-8'));
  } catch {
    return null;
  }
}

// The remote copy wins once it has a real run in it (latest.json exists);
// before that, or when GitHub is unreachable, the bundled files are served.
async function readJson(rel) {
  if (DATA_URL && (await readRemote('latest.json'))) {
    const data = await readRemote(rel);
    if (data !== undefined) return data;
  }
  return readLocal(rel);
}

export async function readLatest() {
  return (
    (await readJson('latest.json')) || {
      date: null,
      isSample: true,
      metrics: {},
      games: [],
      players: [],
      note: 'Projections have not been generated yet. Run `python3 ml/daily.py`.',
    }
  );
}

export async function readHistory() {
  return (await readJson('history.json')) || { overall: {}, byStat: {}, days: [], calibration: [] };
}

export async function listSlateDates() {
  const index = await readJson('index.json');
  if (index?.dates) return index.dates;
  // Data written before index.json existed: list the directory instead.
  try {
    return fs
      .readdirSync(path.join(localDir(), 'projections'))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readSlate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readJson(`projections/${date}.json`);
}
