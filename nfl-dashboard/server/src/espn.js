// Thin client for ESPN's public (unofficial, undocumented) NFL endpoints.
// No API key is required, but the shape of the responses isn't guaranteed,
// so callers should treat every field as optional.
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary';

// Short cache so several dashboard clients polling at once, plus the
// per-game summary fan-out, don't hammer ESPN on every request.
const CACHE_MS = 15_000;

let scoreboardCache = { key: null, at: 0, data: null };
const summaryCache = new Map(); // eventId -> { at, data }

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN request failed (${res.status}): ${url}`);
  }
  return res.json();
}

// The most recent Sunday on or before `now`, in UTC.
export function mostRecentSunday(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function toYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Games for a given date (defaults to the most recent Sunday), cached briefly.
export async function getScoreboard(dateOverride) {
  const date = dateOverride ? new Date(dateOverride) : mostRecentSunday();
  const key = toYmd(date);
  if (scoreboardCache.key === key && Date.now() - scoreboardCache.at < CACHE_MS) {
    return scoreboardCache.data;
  }
  const data = await fetchJson(`${SCOREBOARD_URL}?dates=${key}`);
  scoreboardCache = { key, at: Date.now(), data };
  return data;
}

// Box score + scoring plays for a single game.
export async function getEventSummary(eventId) {
  const cached = summaryCache.get(eventId);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }
  const data = await fetchJson(`${SUMMARY_URL}?event=${eventId}`);
  summaryCache.set(eventId, { at: Date.now(), data });
  return data;
}
