import { HOURS, DAY_SHORT, addDays, formatHour, isoDate } from '../lib/dates.js';
import TaskChip from './TaskChip.jsx';

export default function WeekGrid({ weekStart, tasks, todayIso, onAddTask, onEditTask }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto px-2 pb-8 sm:px-4">
      <div className="min-w-[760px] rounded-2xl bg-white/70 p-2 shadow-md">
        <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1">
          <div />
          {days.map((day) => {
            const iso = isoDate(day);
            const isToday = iso === todayIso;
            return (
              <div
                key={iso}
                className={`rounded-xl px-2 py-2 text-center font-bold ${
                  isToday ? 'bg-[#5B8DEF] text-white' : 'bg-[#FFE8CC] text-[#3a3a3a]'
                }`}
              >
                <div className="text-sm">{DAY_SHORT[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                <div className="text-xs opacity-80">{day.getDate()}</div>
              </div>
            );
          })}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex items-start justify-end pr-2 pt-2 text-xs font-semibold text-[#8c97a8]">
                {formatHour(hour)}
              </div>
              {days.map((day) => {
                const iso = isoDate(day);
                const cellTasks = tasks.filter((t) => t.date === iso && t.hour === hour);
                return (
                  <button
                    type="button"
                    key={`${iso}-${hour}`}
                    onClick={() => onAddTask(iso, hour)}
                    className="group min-h-[56px] rounded-xl border-2 border-dashed border-transparent bg-[#fbfbfd] p-1 text-left transition hover:border-[#5B8DEF] hover:bg-[#eef4ff]"
                  >
                    <div className="flex flex-col gap-1">
                      {cellTasks.map((task) => (
                        <TaskChip key={task.id} task={task} onClick={onEditTask} />
                      ))}
                    </div>
                    {cellTasks.length === 0 && (
                      <span className="hidden text-lg font-bold text-[#c3cbe0] group-hover:block">+</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
