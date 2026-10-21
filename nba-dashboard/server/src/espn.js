// Thin client for ESPN's public (unofficial, undocumented) NBA endpoints.
// No API key is required, but the shape of the responses isn't guaranteed,
// so callers should treat every field as optional.
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';

// Short cache so several dashboard clients polling at once, plus the
// per-game summary fan-out, don't hammer ESPN on every request.
const CACHE_MS = 15_000;

const scoreboardCache = new Map(); // ymd -> { at, data }
const summaryCache = new Map(); // eventId -> { at, data }

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN request failed (${res.status}): ${url}`);
  }
  return res.json();
}

// Today's date in US Eastern time as YYYYMMDD — NBA slates (and ESPN's
// `dates=` param) are bucketed by Eastern calendar day, so a 10:30pm ET tip
// still counts as that day's game wherever the server runs.
export function easternYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts.replaceAll('-', '');
}

export function normalizeYmd(value) {
  const ymd = String(value || '').replaceAll('-', '');
  return /^\d{8}$/.test(ymd) ? ymd : easternYmd();
}

export async function getScoreboard(ymd) {
  const cached = scoreboardCache.get(ymd);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }
  const data = await fetchJson(`${SCOREBOARD_URL}?dates=${ymd}`);
  scoreboardCache.set(ymd, { at: Date.now(), data });
  return data;
}

// Box score + header for a single game.
export async function getEventSummary(eventId) {
  const cached = summaryCache.get(eventId);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }
  const data = await fetchJson(`${SUMMARY_URL}?event=${eventId}`);
  summaryCache.set(eventId, { at: Date.now(), data });
  return data;
}
