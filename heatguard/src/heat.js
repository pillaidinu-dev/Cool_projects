// Heat-stress maths. Everything here is a pure function so it can be unit tested.
//
// We estimate Wet Bulb Globe Temperature (WBGT), the standard occupational heat-stress
// index, from ordinary weather data:
//   WBGT (outdoor) = 0.7 * Tw + 0.2 * Tg + 0.1 * Ta
// where Tw is natural wet-bulb (Stull 2011 approximation) and Tg is black-globe
// temperature (approximated from air temperature, solar radiation and wind).
// This is an estimate for planning. A real deployment should use on-site WBGT meters.

const toRad = Math.atan;

/** Stull (2011) wet-bulb temperature, °C. Valid roughly for RH 5–99%, Ta -20–50 °C. */
export function wetBulb(tempC, rh) {
  return (
    tempC * toRad(0.151977 * Math.sqrt(rh + 8.313659)) +
    toRad(tempC + rh) -
    toRad(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * toRad(0.023101 * rh) -
    4.686035
  );
}

/** Rough black-globe temperature: sun heats the globe, wind cools it. */
export function globeTemp(tempC, solarWm2 = 0, windMs = 2) {
  const boost = (Math.max(0, solarWm2) / 1000) * 13 / (1 + 0.15 * Math.max(0, windMs));
  return tempC + boost;
}

export function estimateWbgt({ tempC, rh, solarWm2 = 0, windMs = 2, inShade = false }) {
  const tw = wetBulb(tempC, rh);
  const tg = inShade ? tempC : globeTemp(tempC, solarWm2, windMs);
  return round1(0.7 * tw + 0.2 * tg + 0.1 * tempC);
}

/** NOAA heat index ("feels like"), °C. Shown to supervisors; not used for decisions. */
export function heatIndex(tempC, rh) {
  const t = tempC * 9 / 5 + 32;
  let hi = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  if (hi >= 80) {
    hi = -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh -
      0.00683783 * t * t - 0.05481717 * rh * rh + 0.00122874 * t * t * rh +
      0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
  }
  return round1((hi - 32) * 5 / 9);
}

export const LEVELS = ['Normal', 'Caution', 'High', 'Danger', 'Extreme'];

// WBGT thresholds (°C) for heavy work. Lighter work tolerates more heat.
// Loosely follows ACGIH / ISO 7243 action limits for acclimatised workers.
const HEAVY_THRESHOLDS = [26, 28, 30, 32];
const INTENSITY_OFFSET = { heavy: 0, moderate: 1.5, light: 3 };

export function riskLevel(wbgt, intensity = 'moderate') {
  const offset = INTENSITY_OFFSET[intensity] ?? INTENSITY_OFFSET.moderate;
  let level = 0;
  for (const t of HEAVY_THRESHOLDS) if (wbgt >= t + offset) level++;
  return level;
}

// The minimum protective plan for each level. Minutes are real (unscaled) minutes.
// checkin: how often workers must confirm they're OK (null = no check-ins).
export const PLANS = [
  { level: 0, water: 30, work: 55, rest: 5, checkin: null },
  { level: 1, water: 20, work: 50, rest: 10, checkin: 60 },
  { level: 2, water: 15, work: 45, rest: 15, checkin: 30 },
  { level: 3, water: 15, work: 30, rest: 30, checkin: 15 },
  { level: 4, water: 15, work: 0, rest: 60, checkin: 15 }, // stop heavy outdoor work
];

export function floorPlan(level) {
  return { ...PLANS[Math.max(0, Math.min(4, level))] };
}

/** True when `plan` protects workers at least as much as the floor for `level`. */
export function isAtLeastAsStrict(plan, level) {
  const f = floorPlan(level);
  return plan.level >= f.level && plan.water <= f.water && plan.work <= f.work && plan.rest >= f.rest;
}

// UAE midday break: outdoor work under direct sun is banned 12:30–15:00, 15 June–15 September.
export function isMiddayBreak(date = new Date()) {
  const dubai = new Date(date.getTime() + 4 * 3600 * 1000); // Asia/Dubai is UTC+4, no DST
  const m = dubai.getUTCMonth() + 1;
  const d = dubai.getUTCDate();
  const inSeason = (m > 6 && m < 9) || (m === 6 && d >= 15) || (m === 9 && d <= 15);
  const minutes = dubai.getUTCHours() * 60 + dubai.getUTCMinutes();
  return inSeason && minutes >= 12 * 60 + 30 && minutes < 15 * 60;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
