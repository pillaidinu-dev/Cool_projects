const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const compactCurrency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function money(n) {
  return n == null ? '–' : currency.format(n);
}

// Profit always shows its sign, so a gain and a loss read differently even
// without the color.
export function signedMoney(n) {
  if (n == null) return '–';
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${currency.format(Math.abs(n))}`;
}

export function signedPct(n) {
  if (n == null) return '–';
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`;
}

export function axisMoney(n) {
  return compactCurrency.format(n);
}

export function shares(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function gainClass(n) {
  if (n == null || n === 0) return 'text-slate-300';
  return n > 0 ? 'text-emerald-400' : 'text-rose-400';
}

export function shortDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function longDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
