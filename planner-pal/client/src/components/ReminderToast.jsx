import { getSubject } from '../lib/subjects.js';

export default function ReminderToast({ reminders, onDismiss }) {
  if (reminders.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2">
      {reminders.map((task) => {
        const subject = getSubject(task.subject);
        return (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl ring-2"
            style={{ '--tw-ring-color': subject.color }}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">🔔</span>
              <span className="font-bold text-[#3a3a3a]">
                {subject.emoji} {task.text}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(task.id)}
              className="rounded-lg bg-[#f1f2f6] px-2 py-1 text-xs font-bold text-[#3a3a3a]"
            >
              Got it!
            </button>
          </div>
        );
      })}
    </div>
  );
}
