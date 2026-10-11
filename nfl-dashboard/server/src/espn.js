// Thin client for ESPN's public (unofficial, undocumented) NFL endpoints.
// No API key is required, but the shape of the responses isn't guaranteed,
// so callers should treat every field as optional.
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary';

// Short cache so several dashboard clients polling at once, plus the
// per-game summary fan-out, don't hammer ESPN on every request.
const CACHE_MS = 15_000;

// Longer TTL than the 15s game-day cache: the current week and a given
// week's event list rarely change mid-request-burst, and re-deriving the
// current week means two extra ESPN calls every time.
const SEASON_CACHE_MS = 5 * 60 * 1000;

let scoreboardCache = { key: null, at: 0, data: null };
const summaryCache = new Map(); // eventId -> { at, data }
let currentWeekCache = { at: 0, data: null };
const seasonWeekCache = new Map(); // "year-week" -> { at, data }

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

// The 5 calendar dates (Thu..Mon, UTC) starting at `thursday`. Covers the
// standard Thu/Sun/Mon slate plus the Fri/Sat games that show up late in
// the season (Thanksgiving, Christmas, week 18, etc).
function datesFromThursday(thursday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(thursday);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

// The 5 calendar dates (Thu..Mon, UTC) that make up the NFL week containing
// `now`.
export function weekDates(now = new Date()) {
  return datesFromThursday(mostRecentThursday(now));
}

async function fetchWeekDays(dates) {
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
  return { days, errors };
}

function allGamesFinal(days) {
  const events = days.flatMap((day) => day.events);
  return events.length > 0 && events.every((e) => e.status?.type?.state === 'post');
}

// Every game across the NFL week containing `dateOverride` (defaults to
// now), grouped by the calendar day it was fetched under. Each day is
// fetched independently and cached together as one week, so a single day's
// ESPN request failing doesn't take down the rest of the week — it's
// reported in `errors` and just shows as no games that day.
//
// Once every game in that Thu..Mon window has finished (including Monday
// night), the dashboard advances straight to the next week's Thu..Mon
// window rather than sitting on the just-finished slate through Tuesday
// and Wednesday until the calendar actually reaches the following Thursday.
export async function getWeekScoreboard(dateOverride) {
  const anchor = dateOverride ? new Date(dateOverride) : new Date();
  const anchorThursday = mostRecentThursday(anchor);
  // Keyed off the anchor week rather than the dates actually returned, so
  // the cache still hits every call once a week has rolled over -- otherwise
  // the rolled-forward key would never match itself across calls (this
  // function computes it fresh each time) and every request would re-fetch.
  const key = `week:${toYmd(anchorThursday)}`;

  if (scoreboardCache.key === key && Date.now() - scoreboardCache.at < CACHE_MS) {
    return scoreboardCache.data;
  }

  let dates = datesFromThursday(anchorThursday);
  let { days, errors } = await fetchWeekDays(dates);

  if (!dateOverride && allGamesFinal(days)) {
    const nextThursday = new Date(anchorThursday);
    nextThursday.setUTCDate(nextThursday.getUTCDate() + 7);
    dates = datesFromThursday(nextThursday);
    ({ days, errors } = await fetchWeekDays(dates));
  }

  const data = { weekStart: toYmd(dates[0]), weekEnd: toYmd(dates[dates.length - 1]), days, errors };
  scoreboardCache = { key, at: Date.now(), data };
  return data;
}

// (year, week) ESPN considers "current" for the regular season, advanced by
// one once every game in that week has finished -- mirrors
// ml/espn_client.py's get_current_week() so the season-cumulative leaders
// below stop at the same week boundary the ML projections do.
export async function getCurrentWeek() {
  if (currentWeekCache.data && Date.now() - currentWeekCache.at < SEASON_CACHE_MS) {
    return currentWeekCache.data;
  }
  const data = await fetchJson(SCOREBOARD_URL);
  const year = data?.season?.year;
  const week = data?.week?.number;
  if (!year || !week) {
    throw new Error("Could not determine the current NFL week from ESPN's scoreboard response");
  }
  const weekData = await fetchJson(`${SCOREBOARD_URL}?seasontype=2&week=${week}&year=${year}`);
  const events = weekData.events || [];
  const allFinal = events.length > 0 && events.every((e) => e.status?.type?.state === 'post');
  const result = { year, week: allFinal ? week + 1 : week };
  currentWeekCache = { at: Date.now(), data: result };
  return result;
}

// Every game in a single named regular-season week (as opposed to
// getWeekScoreboard's calendar-date window) -- the season-cumulative
// leaders below walk these week-by-week instead of by date.
export async function getSeasonWeekEvents(year, week) {
  const cacheKey = `${year}-${week}`;
  const cached = seasonWeekCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEASON_CACHE_MS) {
    return cached.data;
  }
  const data = await fetchJson(`${SCOREBOARD_URL}?seasontype=2&week=${week}&year=${year}`);
  const events = (data.events || []).map((e) => ({ id: e.id, name: e.shortName || e.name || '' }));
  seasonWeekCache.set(cacheKey, { at: Date.now(), data: events });
  return events;
}

// Every game played so far this season (weeks 1..currentWeek), flattened.
export async function getSeasonEvents() {
  const { year, week: currentWeek } = await getCurrentWeek();
  const weeks = await Promise.all(
    Array.from({ length: currentWeek }, (_, i) => getSeasonWeekEvents(year, i + 1)),
  );
  return { year, currentWeek, events: weeks.flat() };
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
