import { useEffect, useRef, useState } from 'react';
import { formatDate, formatGrams } from '../lib/gold.js';

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
const DAY = 24 * 60 * 60 * 1000;

const toTime = (iso) => new Date(`${iso}T00:00:00`).getTime();

function niceMax(v) {
  if (v <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

// Step chart of cumulative grams held — one step up per purchase day.
export default function GramsChart({ purchases, goalGrams }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (purchases.length === 0) {
    return (
      <div ref={wrapRef} className="flex h-[120px] items-center justify-center text-sm text-muted">
        Your chart appears after the first purchase.
      </div>
    );
  }

  // One point per purchase day with the running total after that day.
  const points = [];
  let total = 0;
  for (const p of purchases) {
    total += p.grams;
    const last = points[points.length - 1];
    if (last && last.date === p.date) last.grams = total;
    else points.push({ date: p.date, t: toTime(p.date), grams: total });
  }

  const t0 = points[0].t;
  const t1 = Math.max(now, points[points.length - 1].t + DAY);
  // Show the goal line only when it's within reach of the visible scale.
  const showGoal = goalGrams > 0 && goalGrams <= total * 1.5;
  const yMax = niceMax(Math.max(total, showGoal ? goalGrams : 0) * 1.05);

  const iw = Math.max(50, width - PAD.left - PAD.right);
  const ih = HEIGHT - PAD.top - PAD.bottom;
  const x = (t) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * iw;
  const y = (g) => PAD.top + ih - (g / yMax) * ih;

  // Step path: flat until the next purchase, then up.
  let d = `M${x(t0)},${y(0)} L${x(t0)},${y(points[0].grams)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${x(points[i].t)},${y(points[i - 1].grams)} L${x(points[i].t)},${y(points[i].grams)}`;
  }
  d += ` L${x(t1)},${y(total)}`;
  const area = `${d} L${x(t1)},${y(0)} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xLabels = [t0, t0 + (t1 - t0) / 2, t1].map((t) =>
    new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
  );

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let nearest = points[0];
    for (const p of points) if (Math.abs(x(p.t) - px) < Math.abs(x(nearest.t) - px)) nearest = p;
    setHover(nearest);
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Gold held over time, now ${formatGrams(total)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="block touch-pan-y"
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + iw} y1={y(v)} y2={y(v)} stroke="var(--border)" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {v % 1 === 0 ? v : v.toFixed(1)}g
            </text>
          </g>
        ))}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={PAD.left + (iw * i) / 2}
            y={HEIGHT - 6}
            textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
            fontSize="11"
            fill="var(--muted)"
          >
            {label}
          </text>
        ))}

        {showGoal && (
          <g>
            <line
              x1={PAD.left}
              x2={PAD.left + iw}
              y1={y(goalGrams)}
              y2={y(goalGrams)}
              stroke="var(--ink-2)"
              strokeDasharray="4 4"
            />
            <text x={PAD.left + iw} y={y(goalGrams) - 5} textAnchor="end" fontSize="11" fill="var(--ink-2)">
              Goal {formatGrams(goalGrams)}
            </text>
          </g>
        )}

        <path d={area} fill="var(--series-soft)" />
        <path d={d} fill="none" stroke="var(--series)" strokeWidth="2" strokeLinejoin="round" />

        {points.map((p) => (
          <circle
            key={p.date}
            cx={x(p.t)}
            cy={y(p.grams)}
            r={hover?.date === p.date ? 5 : 3.5}
            fill="var(--series)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        ))}
        {hover && (
          <line
            x1={x(hover.t)}
            x2={x(hover.t)}
            y1={PAD.top}
            y2={PAD.top + ih}
            stroke="var(--muted)"
            strokeWidth="1"
          />
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(x(hover.t) - 70, 0), width - 140),
            top: Math.max(y(hover.grams) - 52, 0),
            width: 140,
          }}
        >
          <div className="text-muted">{formatDate(hover.date)}</div>
          <div className="font-semibold">{formatGrams(hover.grams)} held</div>
        </div>
      )}
    </div>
  );
}
