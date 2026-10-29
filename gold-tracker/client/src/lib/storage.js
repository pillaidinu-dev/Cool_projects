const PURCHASES_KEY = 'gold-tracker-purchases-v1';
const SETTINGS_KEY = 'gold-tracker-settings-v1';

export const DEFAULT_SETTINGS = {
  currency: 'USD',
  // Goal, in grams of gold (total weight).
  goalGrams: 100,
  // Spot price is the international rate; local retail usually sits above it
  // (in India, import duty + GST add roughly 9%). This markup is applied to the
  // live spot price when valuing holdings.
  premiumPct: 0,
  // If set, a manual 24K price per gram (e.g. your jeweller's rate today) that
  // replaces the live price entirely.
  manualPrice24k: null,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private browsing, quota) — the app still works for
    // the rest of the session, it just won't remember on reload.
  }
}

export const loadPurchases = () => load(PURCHASES_KEY, []);
export const savePurchases = (purchases) => save(PURCHASES_KEY, purchases);
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) });
export const saveSettings = (settings) => save(SETTINGS_KEY, settings);
