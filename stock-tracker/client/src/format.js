const moneyFormatters = new Map();

export function money(value, currency = 'USD', { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const key = `${currency}:${compact}`;
  if (!moneyFormatters.has(key)) {
    moneyFormatters.set(
      key,
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : 2,
      }),
    );
  }
  return moneyFormatters.get(key).format(value);
}

export function signedMoney(value, currency = 'USD', opts) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0.004 ? '+' : value < -0.004 ? '−' : '';
  return sign + money(Math.abs(value), currency, opts);
}

export function signedPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0.004 ? '+' : value < -0.004 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function shares(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

export function shortDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export function longDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
