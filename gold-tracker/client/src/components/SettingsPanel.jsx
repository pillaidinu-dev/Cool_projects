import { useRef, useState } from 'react';
import { formatMoney } from '../lib/gold.js';

export default function SettingsPanel({ settings, livePrice, purchases, onChange, onImport, onClose }) {
  const fileRef = useRef(null);
  const [message, setMessage] = useState('');
  const { currency } = settings;

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, settings, purchases }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gold-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.purchases;
      const ok =
        Array.isArray(list) &&
        list.every((p) => p.id && p.date && p.grams > 0 && (p.type === 'paxg' ? p.paxg > 0 : [24, 22].includes(p.karat)) && p.paid >= 0);
      if (!ok) throw new Error('not a Gold Tracker backup');
      if (!confirm(`Replace your ${purchases.length} purchases with ${list.length} from the backup?`)) return;
      onImport(list);
      if (data.settings) onChange(data.settings);
      setMessage(`Restored ${list.length} purchases.`);
    } catch (err) {
      setMessage(`Couldn't import: ${err.message}`);
    }
  }

  const numberOrNull = (v) => (v === '' ? null : Math.max(0, Number(v)));

  return (
    <section className="mb-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Settings</h2>
        <button onClick={onClose} className="text-sm text-muted hover:text-ink">
          Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Savings goal (grams)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={settings.goalGrams ?? ''}
            onChange={(e) => onChange({ goalGrams: numberOrNull(e.target.value) ?? 0 })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Local premium over spot (%)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={settings.premiumPct}
            onChange={(e) => onChange({ premiumPct: Number(e.target.value) || 0 })}
          />
          <span className="mt-1 block text-xs text-muted">
            Spot is the international rate. In India, import duty + 3% GST put retail ~9% higher.
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-2">Manual 24K rate per gram ({currency})</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder={livePrice ? `Live: ${formatMoney(livePrice, currency)}` : 'Leave empty for live price'}
            value={settings.manualPrice24k ?? ''}
            onChange={(e) => onChange({ manualPrice24k: numberOrNull(e.target.value) })}
          />
          <span className="mt-1 block text-xs text-muted">
            Use your jeweller's or bank's rate instead of the live price. Clear it to go back to live.
          </span>
        </label>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="text-sm font-medium">Backup</div>
        <p className="mb-2 text-xs text-muted">
          Your data is saved in this browser only. Export a backup to keep it safe or move it to
          another device.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportBackup}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-bg"
          >
            Export backup
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-bg"
          >
            Import backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        </div>
        {message && <p className="mt-2 text-xs text-ink-2">{message}</p>}
      </div>
    </section>
  );
}
