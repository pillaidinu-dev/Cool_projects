// Live gold spot price, converted to price per gram of 24K gold.
//
// Sources are free and keyless, tried in order:
//   1. goldprice.org — XAU per troy ounce, quoted directly in the currency.
//   2. gold-api.com (XAU in USD per ounce) × an exchange rate from
//      open.er-api.com, falling back to frankfurter.app.
// Results are cached for CACHE_MS so page loads don't hammer the sources, and
// the last good price is served (marked stale) if every source is down.

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'AED', 'GBP', 'EUR', 'SGD', 'CAD', 'AUD'];

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const CACHE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;

const cache = new Map(); // currency -> { at, value }

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (gold-tracker)', Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fromGoldPriceOrg(currency) {
  const data = await fetchJson(`https://data-asg.goldprice.org/dbXRates/${currency}`);
  const item = data?.items?.[0];
  const perOunce = Number(item?.xauPrice);
  if (!(perOunce > 0)) throw new Error('goldprice.org returned no price');
  const prevClose = Number(item.xauClose);
  return {
    perOunce,
    prevPerOunce: prevClose > 0 ? prevClose : null,
    source: 'goldprice.org',
  };
}

async function usdRate(currency) {
  if (currency === 'USD') return 1;
  try {
    const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
    const rate = Number(data?.rates?.[currency]);
    if (rate > 0) return rate;
  } catch {
    // fall through to the next FX source
  }
  const data = await fetchJson(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
  const rate = Number(data?.rates?.[currency]);
  if (!(rate > 0)) throw new Error('No exchange rate available');
  return rate;
}

async function fromGoldApi(currency) {
  const data = await fetchJson('https://api.gold-api.com/price/XAU');
  const usdPerOunce = Number(data?.price);
  if (!(usdPerOunce > 0)) throw new Error('gold-api.com returned no price');
  const rate = await usdRate(currency);
  return { perOunce: usdPerOunce * rate, prevPerOunce: null, source: 'gold-api.com' };
}

export async function getGoldPrice(currency) {
  const hit = cache.get(currency);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const errors = [];
  for (const source of [fromGoldPriceOrg, fromGoldApi]) {
    try {
      const { perOunce, prevPerOunce, source: name } = await source(currency);
      const value = {
        currency,
        perGram24k: perOunce / GRAMS_PER_TROY_OUNCE,
        prevPerGram24k: prevPerOunce ? prevPerOunce / GRAMS_PER_TROY_OUNCE : null,
        source: name,
        fetchedAt: new Date().toISOString(),
        stale: false,
      };
      cache.set(currency, { at: Date.now(), value });
      return value;
    } catch (err) {
      errors.push(err.message);
    }
  }

  if (hit) return { ...hit.value, stale: true };
  throw new Error(errors.join('; '));
}
