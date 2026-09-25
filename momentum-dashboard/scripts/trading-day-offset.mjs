#!/usr/bin/env node
// Computes the `candleCount` to pass to Robinhood's scanner expression
// `close(candleCount=N, candlePeriod="1d", session="all")` so that it resolves
// to the split-adjusted close on 2025-12-31, or whatever "the last trading day
// of the prior year" is for the run date.
//
// Usage: node trading-day-offset.mjs [YYYY-MM-DD]
// With no argument, uses today's date (UTC). Prints a single integer to stdout.
//
// Why this exists: the scanner has no native "since Jan 1" filter, so the YTD
// screen is built as "price >= 2x price N trading days ago". N has to be
// recomputed on every run, because it's a moving count of NYSE trading days,
// not a fixed number. Getting N wrong doesn't error -- it silently anchors the
// comparison to the wrong date, so this is computed deterministically here
// instead of eyeballed each time.

function isWeekend(d) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

// Anonymous Gregorian algorithm for the date of Easter Sunday (UTC).
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function nthWeekdayOfMonth(year, month, weekday, n) {
  // month: 0-indexed. weekday: 0=Sun..6=Sat. n: 1-indexed occurrence.
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (true) {
    if (d.getUTCDay() === weekday) {
      count++;
      if (count === n) return new Date(d);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function lastWeekdayOfMonth(year, month, weekday) {
  const d = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function observed(date) {
  // NYSE observance: Saturday holiday -> observed Friday; Sunday -> observed Monday.
  const day = date.getUTCDay();
  if (day === 6) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
  if (day === 0) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  return date;
}

function nyseHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(easter.getUTCDate() - 2);

  return [
    observed(new Date(Date.UTC(year, 0, 1))), // New Year's Day
    nthWeekdayOfMonth(year, 0, 1, 3), // MLK Day: 3rd Monday of Jan
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents Day: 3rd Monday of Feb
    goodFriday,
    lastWeekdayOfMonth(year, 4, 1), // Memorial Day: last Monday of May
    observed(new Date(Date.UTC(year, 5, 19))), // Juneteenth
    observed(new Date(Date.UTC(year, 6, 4))), // Independence Day
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor Day: 1st Monday of Sep
    nthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving: 4th Thursday of Nov
    observed(new Date(Date.UTC(year, 11, 25))), // Christmas
  ].map((d) => d.toISOString().slice(0, 10));
}

function isTradingDay(d, holidaySet) {
  if (isWeekend(d)) return false;
  return !holidaySet.has(d.toISOString().slice(0, 10));
}

function tradingDayOffset(todayStr) {
  const today = todayStr ? new Date(todayStr + "T00:00:00Z") : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const year = today.getUTCFullYear();
  const holidaySet = new Set([...nyseHolidays(year), ...nyseHolidays(year - 1)]);

  // First trading day of the current year.
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (!isTradingDay(cursor, holidaySet)) cursor.setUTCDate(cursor.getUTCDate() + 1);

  // Last completed trading day strictly before `today`.
  const lastCompleted = new Date(today);
  lastCompleted.setUTCDate(lastCompleted.getUTCDate() - 1);
  while (!isTradingDay(lastCompleted, holidaySet)) lastCompleted.setUTCDate(lastCompleted.getUTCDate() - 1);

  if (lastCompleted < cursor) {
    throw new Error("Run date is before the first trading day of its own year -- too early in January for a YTD screen to be meaningful.");
  }

  let count = 0;
  const d = new Date(cursor);
  while (d <= lastCompleted) {
    if (isTradingDay(d, holidaySet)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return count + 1; // +1 steps back one more trading day, onto Dec 31 of the prior year.
}

const arg = process.argv[2];
console.log(tradingDayOffset(arg));
