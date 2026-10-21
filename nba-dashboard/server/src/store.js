// Reads what the daily pipeline (ml/daily.py) writes: today's slate
// (latest.json), every saved slate (projections/<date>.json) and the
// season-long tracker (history.json). Until the first real run has
// produced data/latest.json, everything is served from data-sample/ —
// synthetic, and flagged isSample so the UI says so.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ML_DIR = path.join(__dirname, '..', '..', 'ml');
export const DATA_DIR = process.env.NBA_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SAMPLE_DIR = path.join(__dirname, '..', '..', 'data-sample');

function activeDir() {
  return fs.existsSync(path.join(DATA_DIR, 'latest.json')) ? DATA_DIR : SAMPLE_DIR;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

export function readLatest() {
  return (
    readJson(path.join(activeDir(), 'latest.json')) || {
      date: null,
      isSample: true,
      metrics: {},
      games: [],
      players: [],
      note: 'Projections have not been generated yet. Run `python3 ml/daily.py`.',
    }
  );
}

export function readHistory() {
  return readJson(path.join(activeDir(), 'history.json')) || { overall: {}, byStat: {}, days: [], calibration: [] };
}

export function listSlateDates() {
  try {
    return fs
      .readdirSync(path.join(activeDir(), 'projections'))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readSlate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readJson(path.join(activeDir(), 'projections', `${date}.json`));
}
