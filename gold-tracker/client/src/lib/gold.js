export const KARATS = [24, 22];
export const CURRENCIES = ['USD', 'INR', 'AED', 'GBP', 'EUR', 'SGD', 'CAD', 'AUD'];

// Fraction of pure gold in each karat (22K is sold as "916", i.e. 91.6%).
export const PURITY = { 24: 0.999, 22: 0.916 };

// Price of a karat is quoted relative to 24K (which is itself ~99.9% pure).
export const karatPrice = (price24k, karat) => price24k * (PURITY[karat] / PURITY[24]);

// PAX Gold: each PAXG token is backed by one fine troy ounce of gold, so a
// PAXG purchase is tracked as its token amount × 31.1 g of pure gold.
export const GRAMS_PER_OZ = 31.1034768;
export const isPaxg = (p) => p.type === 'paxg';

// What a purchase is worth today. Physical gold uses the 24K rate (with any
// local premium or manual rate); PAXG uses the plain spot price per gram,
// falling back to the 24K rate when there is no live price.
export function purchaseValue(p, price24k, spotPerGram) {
  if (isPaxg(p)) {
    const rate = spotPerGram ?? price24k;
    return rate == null ? null : p.grams * rate;
  }
  return price24k == null ? null : p.grams * karatPrice(price24k, p.karat);
}

export function summarize(purchases, price24k, spotPerGram) {
  let grams = 0;
  let pureGrams = 0;
  let paxgGrams = 0;
  let invested = 0;
  let value = 0;
  let priced = true;
  for (const p of purchases) {
    grams += p.grams;
    pureGrams += isPaxg(p) ? p.grams : p.grams * PURITY[p.karat];
    if (isPaxg(p)) paxgGrams += p.grams;
    invested += p.paid;
    const v = purchaseValue(p, price24k, spotPerGram);
    if (v == null) priced = false;
    else value += v;
  }
  if (!priced) value = null;
  const gain = value == null ? null : value - invested;
  return {
    grams,
    pureGrams,
    paxgGrams,
    physicalGrams: grams - paxgGrams,
    invested,
    value,
    gain,
    gainPct: gain != null && invested > 0 ? (gain / invested) * 100 : null,
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

// A sovereign (also called a pavan) is 8 g of gold, usually 22K.
export const SOVEREIGN_GRAMS = 8;

export function formatSovereigns(grams) {
  const n = grams / SOVEREIGN_GRAMS;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)} sovereign${n === 1 ? '' : 's'}`;
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
