import { formatWeekLabel } from '../lib/dates.js';

export default function WeekHeader({ weekStart, onPrev, onNext, onToday }) {
  return (
    <header className="flex flex-col items-center gap-3 px-4 pt-6 pb-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <h1 className="text-3xl font-extrabold text-[#3a3a3a] sm:text-4xl">
          🗓️ Planner Pal
        </h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Write down your to-dos, pick a subject, and never forget a thing!
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-md">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous week"
          className="rounded-xl bg-[#FFE8CC] px-3 py-2 text-lg font-bold text-[#FF9F45] transition hover:scale-105 active:scale-95"
        >
          ◀
        </button>
        <div className="min-w-[150px] px-2 text-base font-bold text-[#3a3a3a] sm:min-w-[180px]">
          {formatWeekLabel(weekStart)}
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next week"
          className="rounded-xl bg-[#FFE8CC] px-3 py-2 text-lg font-bold text-[#FF9F45] transition hover:scale-105 active:scale-95"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={onToday}
          className="ml-1 rounded-xl bg-[#5B8DEF] px-3 py-2 text-sm font-bold text-white transition hover:scale-105 active:scale-95"
        >
          Today
        </button>
      </div>
    </header>
  );
}
