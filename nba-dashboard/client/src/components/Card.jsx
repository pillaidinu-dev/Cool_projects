export default function Card({ title, aside, children, className = '' }) {
  return (
    <div className={`rounded-xl bg-slate-800/60 border border-slate-700/60 overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
          {aside && <span className="text-xs text-slate-500">{aside}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
