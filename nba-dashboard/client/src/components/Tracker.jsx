import { useEffect, useState } from 'react';
import Card from './Card.jsx';
import HitRateChart from './HitRateChart.jsx';
import PropsBoard from './PropsBoard.jsx';
import BestPicks from './BestPicks.jsx';
import { fetchSlate } from '../api.js';
import { STATS, formatDate, pct, signed } from '../stats.js';

function Tile({ label, value, detail }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums mt-1">{value}</p>
      {detail && <p className="text-xs text-slate-500 tabular-nums mt-0.5">{detail}</p>}
    </div>
  );
}

// Every saved slate, graded against what actually happened: season-long
// ROI and hit rates, how well the model's probabilities are calibrated, and any past
// day's full board.
export default function Tracker({ history, dates }) {
  const gradedDates = dates.filter((d) => history.days?.some((day) => day.date === d));
  const [selected, setSelected] = useState('');
  const [slate, setSlate] = useState(null);
  const date = selected || gradedDates[0];

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    fetchSlate(date)
      .then((doc) => !cancelled && setSlate(doc))
      .catch(() => !cancelled && setSlate(null));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const overall = history.overall || {};
  const top = history.topPicks || {};

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Tile label="Props tracked" value={overall.n ?? 0} detail={`${history.days?.length ?? 0} graded slates`} />
        <Tile
          label="ROI · every lean"
          value={pct(overall.roi, 1)}
          detail={`${signed(overall.units, 1)}u · hit ${pct(overall.hitRate)} (exp ${pct(overall.expectedHitRate)})`}
        />
        <Tile
          label="ROI · daily top 10"
          value={pct(top.roi, 1)}
          detail={`${signed(top.units, 1)}u · ${top.hits ?? 0}/${top.n ?? 0} hit`}
        />
        <Tile label="Avg miss" value={overall.mae ?? '–'} detail="mean |actual − projection|" />
      </div>

      <HitRateChart days={history.days || []} />

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <Card title="By market">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left font-medium px-4 py-2">Market</th>
                <th className="text-right font-medium px-3 py-2">Props</th>
                <th className="text-right font-medium px-3 py-2">Hit rate</th>
                <th className="text-right font-medium px-3 py-2">ROI</th>
                <th className="text-right font-medium px-4 py-2">Avg miss</th>
              </tr>
            </thead>
            <tbody>
              {STATS.map((s) => {
                const row = history.byStat?.[s.key] || {};
                return (
                  <tr key={s.key} className="border-t border-slate-700/40">
                    <td className="px-4 py-2 text-slate-200">{s.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">{row.n ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">{pct(row.hitRate, 1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white font-semibold">{pct(row.roi, 1)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-400">{row.mae ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Calibration" aside="does the model's probability match reality?">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left font-medium px-4 py-2">Model prob. of lean</th>
                <th className="text-right font-medium px-3 py-2">Props</th>
                <th className="text-right font-medium px-3 py-2">Expected</th>
                <th className="text-right font-medium px-4 py-2">Actual</th>
              </tr>
            </thead>
            <tbody>
              {(history.calibration || []).map((b) => (
                <tr key={b.lo} className="border-t border-slate-700/40">
                  <td className="px-4 py-2 text-slate-200 tabular-nums">
                    {pct(b.lo)}–{pct(b.hi)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{b.n}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{pct(b.expectedHitRate, 1)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-white font-semibold">{pct(b.hitRate, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {gradedDates.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Past slate</h2>
            <select
              value={date}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded-md bg-slate-900/70 border border-slate-700 px-2 py-1.5 text-sm text-slate-200"
            >
              {gradedDates.map((d) => {
                const day = history.days.find((x) => x.date === d);
                return (
                  <option key={d} value={d}>
                    {formatDate(d)} — {day.hits}/{day.n} hit · {signed(day.units, 1)}u
                  </option>
                );
              })}
            </select>
          </div>
          {slate && slate.date === date && (
            <>
              <BestPicks slate={slate} />
              <PropsBoard key={date} slate={slate} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
