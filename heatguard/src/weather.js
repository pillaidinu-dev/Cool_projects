// Site weather: live from Open-Meteo (free, no key), with a simulated Dubai profile as a
// fallback so the demo still works offline. Demo scenarios override both.

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

export const SCENARIOS = {
  morning: { label: 'Cool morning', tempC: 31, rh: 55, solarWm2: 400, windMs: 3 },
  afternoon: { label: 'Hot afternoon', tempC: 37, rh: 45, solarWm2: 850, windMs: 3 },
  spike: { label: 'Heat spike', tempC: 41, rh: 40, solarWm2: 900, windMs: 2 },
};

export async function getConditions(site, scenario = 'live', now = new Date()) {
  if (SCENARIOS[scenario]) {
    const { label, ...values } = SCENARIOS[scenario];
    return { ...values, source: `scenario: ${label}`, observedAt: now.toISOString() };
  }
  const cached = cache.get(site.id);
  if (cached && now - cached.fetchedAt < CACHE_MS) return cached.data;
  let data;
  try {
    data = await fetchOpenMeteo(site);
  } catch (err) {
    data = simulateDubai(now);
    data.source = `simulated (live weather unavailable: ${err.message})`;
  }
  cache.set(site.id, { fetchedAt: now, data });
  return data;
}

async function fetchOpenMeteo({ lat, lon }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Dubai',
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const { current: c } = await res.json();
  return {
    tempC: c.temperature_2m,
    rh: c.relative_humidity_2m,
    windMs: c.wind_speed_10m,
    solarWm2: c.shortwave_radiation,
    source: 'Open-Meteo (live)',
    observedAt: new Date().toISOString(),
  };
}

// Typical Dubai daily highs/lows by month (°C). Used only when live data is unavailable.
const MONTHLY = [
  [24, 15], [25, 16], [29, 18], [33, 22], [38, 26], [40, 28],
  [42, 31], [42, 31], [40, 28], [36, 24], [31, 20], [26, 16],
];

export function simulateDubai(now = new Date()) {
  const local = new Date(now.getTime() + 4 * 3600 * 1000);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  const [hi, lo] = MONTHLY[local.getUTCMonth()];
  // Temperature peaks around 14:00 and bottoms out around 05:00.
  const phase = Math.cos(((hour - 14) / 24) * 2 * Math.PI);
  const tempC = lo + (hi - lo) * (phase + 1) / 2;
  const rh = 75 - 40 * (phase + 1) / 2; // humid nights, drier afternoons
  const sun = Math.sin(((hour - 6) / 13) * Math.PI); // daylight 06:00–19:00
  return {
    tempC: Math.round(tempC * 10) / 10,
    rh: Math.round(rh),
    windMs: 3,
    solarWm2: Math.round(Math.max(0, sun) * 900),
    source: 'simulated',
    observedAt: now.toISOString(),
  };
}
