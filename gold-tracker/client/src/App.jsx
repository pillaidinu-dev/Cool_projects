import { useEffect, useMemo, useState } from 'react';
import { loadPurchases, loadSettings, savePurchases, saveSettings } from './lib/storage.js';
import { CURRENCIES, summarize } from './lib/gold.js';
import { usePrice } from './lib/usePrice.js';
import PriceCard from './components/PriceCard.jsx';
import Summary from './components/Summary.jsx';
import GramsChart from './components/GramsChart.jsx';
import PurchaseForm from './components/PurchaseForm.jsx';
import PurchaseList from './components/PurchaseList.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';

export default function App() {
  const [purchases, setPurchases] = useState(loadPurchases);
  const [settings, setSettings] = useState(loadSettings);
  const [editing, setEditing] = useState(null); // purchase being edited, or 'new'
  const [showSettings, setShowSettings] = useState(false);
  const price = usePrice(settings.currency);

  useEffect(() => savePurchases(purchases), [purchases]);
  useEffect(() => saveSettings(settings), [settings]);

  // The 24K per-gram rate everything is valued at: a manual rate if one is
  // set, otherwise the live spot price plus the local premium.
  const livePrice = price.data?.perGram24k ?? null;
  const price24k =
    settings.manualPrice24k != null
      ? settings.manualPrice24k
      : livePrice != null
        ? livePrice * (1 + settings.premiumPct / 100)
        : null;

  const sorted = useMemo(
    () => [...purchases].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [purchases],
  );
  const totals = useMemo(() => summarize(purchases, price24k), [purchases, price24k]);

  function upsert(purchase) {
    setPurchases((list) =>
      list.some((p) => p.id === purchase.id)
        ? list.map((p) => (p.id === purchase.id ? purchase : p))
        : [...list, purchase],
    );
    setEditing(null);
  }

  const remove = (id) => setPurchases((list) => list.filter((p) => p.id !== id));
  const updateSettings = (patch) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-xl font-semibold leading-tight">Gold Tracker</h1>
            <p className="text-sm text-muted">Your gold savings at today's price</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Currency"
            className="!w-auto"
            value={settings.currency}
            onChange={(e) => {
              // Amounts paid are stored as plain numbers in the chosen currency,
              // so switching doesn't convert them — say so before it happens.
              if (
                purchases.length > 0 &&
                !confirm(
                  `Your purchases were entered in ${settings.currency}. Switching to ${e.target.value} won't convert the amounts you paid. Switch anyway?`,
                )
              ) {
                return;
              }
              updateSettings({ currency: e.target.value, manualPrice24k: null });
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-bg"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
          >
            Settings
          </button>
          <button
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
            onClick={() => setEditing('new')}
          >
            + Add gold
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          livePrice={livePrice}
          purchases={purchases}
          onChange={updateSettings}
          onImport={setPurchases}
          onClose={() => setShowSettings(false)}
        />
      )}

      {editing && (
        <PurchaseForm
          initial={editing === 'new' ? null : editing}
          currency={settings.currency}
          price24k={price24k}
          onSave={upsert}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Summary totals={totals} settings={settings} />
        <PriceCard price={price} price24k={price24k} settings={settings} />
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold">Gold saved over time</h2>
        <p className="mb-3 text-sm text-muted">Total grams held after each purchase</p>
        <GramsChart purchases={sorted} goalGrams={settings.goalGrams} />
      </section>

      <PurchaseList
        purchases={sorted}
        currency={settings.currency}
        price24k={price24k}
        onEdit={setEditing}
        onDelete={remove}
        onAdd={() => setEditing('new')}
      />
    </div>
  );
}
