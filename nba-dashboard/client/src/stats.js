// Prop markets, in display order. `key` matches the pipeline's stat names.
export const STATS = [
  { key: 'pts', label: 'Points', short: 'PTS' },
  { key: 'reb', label: 'Rebounds', short: 'REB' },
  { key: 'ast', label: 'Assists', short: 'AST' },
  { key: 'fg3m', label: '3-Pointers Made', short: '3PM' },
  { key: 'stl', label: 'Steals', short: 'STL' },
  { key: 'blk', label: 'Blocks', short: 'BLK' },
  { key: 'pra', label: 'Pts + Reb + Ast', short: 'PRA' },
  { key: 'stocks', label: 'Steals + Blocks', short: 'STL+BLK' },
];

export const STAT_BY_KEY = Object.fromEntries(STATS.map((s) => [s.key, s]));

// Mirrors ml/grade.py: the lean is whichever side the model rates above
// the "fair" price implied by the player's own last-10 average, and the
// edge is by how much.
export function lean(prop) {
  return prop.pOver >= prop.pFair ? 'over' : 'under';
}

export function sideProb(prop) {
  return lean(prop) === 'over' ? prop.pOver : 1 - prop.pOver;
}

export function edge(prop) {
  return lean(prop) === 'over' ? prop.pOver - prop.pFair : prop.pFair - prop.pOver;
}

export function signed(value, digits = 2) {
  if (value == null) return '–';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function pct(value, digits = 0) {
  return value == null ? '–' : `${(value * 100).toFixed(digits)}%`;
}

// 'YYYYMMDD' or 'YYYY-MM-DD' -> 'Tue, Oct 21'. Dated at noon UTC so no
// viewer time zone shifts it to the neighbouring day.
export function formatDate(value, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const ymd = String(value).replaceAll('-', '');
  const date = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`);
  return date.toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

export function easternYmd(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '');
}

export function shiftYmd(ymd, days) {
  const d = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replaceAll('-', '');
}
