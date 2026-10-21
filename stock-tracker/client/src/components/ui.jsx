import { signedMoney, signedPercent } from '../format.js';

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-xl bg-surface border border-line ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-2">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function tone(value) {
  if (value > 0.004) return 'text-gain';
  if (value < -0.004) return 'text-loss';
  return 'text-muted';
}

// A gain or loss: arrow + sign + amount, so direction never rests on colour.
export function Delta({ value, percent, currency, className = '' }) {
  if (value == null) return <span className="text-muted">—</span>;
  const arrow = value > 0.004 ? '▲' : value < -0.004 ? '▼' : '';
  return (
    <span className={`tabular-nums ${tone(value)} ${className}`}>
      {arrow && <span aria-hidden="true" className="text-[0.7em] mr-1">{arrow}</span>}
      {signedMoney(value, currency)}
      {percent != null && <> <span className="opacity-90 whitespace-nowrap">({signedPercent(percent)})</span></>}
    </span>
  );
}

export function PercentDelta({ value }) {
  if (value == null) return <span className="text-muted">—</span>;
  const arrow = value > 0.004 ? '▲' : value < -0.004 ? '▼' : '';
  return (
    <span className={`tabular-nums ${tone(value)}`}>
      {arrow && <span aria-hidden="true" className="text-[0.7em] mr-1">{arrow}</span>}
      {signedPercent(value)}
    </span>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg bg-page border border-line p-0.5">
      {options.map((opt) => {
        const key = typeof opt === 'string' ? opt : opt.value;
        const text = typeof opt === 'string' ? opt : opt.label;
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              active ? 'bg-raised text-ink' : 'text-muted hover:text-ink-2'
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function ChartTooltipBox({ children }) {
  return (
    <div className="rounded-lg bg-page border border-line px-3 py-2 text-xs shadow-xl min-w-36">{children}</div>
  );
}
