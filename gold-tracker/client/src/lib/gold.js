export const KARATS = [24, 22, 18, 14];
export const CURRENCIES = ['INR', 'USD', 'AED', 'GBP', 'EUR', 'SGD', 'CAD', 'AUD'];

// Fraction of pure gold in each karat (22K is sold as "916", i.e. 91.6%).
export const PURITY = { 24: 0.999, 22: 0.916, 18: 0.75, 14: 0.585 };

// Price of a karat is quoted relative to 24K (which is itself ~99.9% pure).
export const karatPrice = (price24k, karat) => price24k * (PURITY[karat] / PURITY[24]);

export function summarize(purchases, price24k) {
  let grams = 0;
  let pureGrams = 0;
  let invested = 0;
  let value = 0;
  for (const p of purchases) {
    grams += p.grams;
    pureGrams += p.grams * PURITY[p.karat];
    invested += p.paid;
    if (price24k != null) value += p.grams * karatPrice(price24k, p.karat);
  }
  const gain = value - invested;
  return {
    grams,
    pureGrams,
    invested,
    value: price24k != null ? value : null,
    gain: price24k != null ? gain : null,
    gainPct: price24k != null && invested > 0 ? (gain / invested) * 100 : null,
    avgPerGram: grams > 0 ? invested / grams : null,
  };
}

const LOCALES = { INR: 'en-IN', USD: 'en-US', GBP: 'en-GB', EUR: 'de-DE', AED: 'en-AE' };

export function formatMoney(amount, currency, { compact = false } = {}) {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat(LOCALES[currency] || 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact || Math.abs(amount) >= 1000 ? 0 : 2,
    ...(compact ? { notation: 'compact' } : {}),
  }).format(amount);
}

export function formatGrams(grams) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(grams)} g`;
}

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
