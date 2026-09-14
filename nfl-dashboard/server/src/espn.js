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

function toYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// The Thursday on or before `now`, in UTC — the first day of the NFL week
// containing `now`. Stays on the just-finished week until the next
// Thursday's games kick off.
function mostRecentThursday(now = new Date()) {
  const d = new Date(now);
  const daysSinceThursday = (d.getUTCDay() + 7 - 4) % 7; // 4 = Thursday
  d.setUTCDate(d.getUTCDate() - daysSinceThursday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// The 5 calendar dates (Thu..Mon, UTC) that make up the NFL week containing
// `now`. Covers the standard Thu/Sun/Mon slate plus the Fri/Sat games that
// show up late in the season (Thanksgiving, Christmas, week 18, etc).
export function weekDates(now = new Date()) {
  const thursday = mostRecentThursday(now);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(thursday);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

// Every game across the NFL week containing `dateOverride` (defaults to
// now), grouped by the calendar day it was fetched under. Each day is
// fetched independently and cached together as one week, so a single day's
// ESPN request failing doesn't take down the rest of the week — it's
// reported in `errors` and just shows as no games that day.
export async function getWeekScoreboard(dateOverride) {
  const anchor = dateOverride ? new Date(dateOverride) : new Date();
  const dates = weekDates(anchor);
  const key = dates.map(toYmd).join(',');
  if (scoreboardCache.key === key && Date.now() - scoreboardCache.at < CACHE_MS) {
    return scoreboardCache.data;
  }

  const errors = [];
  const days = await Promise.all(
    dates.map(async (d) => {
      const date = toYmd(d);
      try {
        const data = await fetchJson(`${SCOREBOARD_URL}?dates=${date}`);
        return { date, events: data.events || [] };
      } catch (err) {
        errors.push({ date, error: err.message });
        return { date, events: [] };
      }
    }),
  );

  const data = { weekStart: toYmd(dates[0]), weekEnd: toYmd(dates[dates.length - 1]), days, errors };
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
