import { getSubject } from '../lib/subjects.js';

export default function TaskChip({ task, onClick }) {
  const subject = getSubject(task.subject);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
      className="block w-full truncate rounded-lg px-2 py-1 text-left text-xs font-semibold text-white shadow-sm transition hover:scale-[1.03] active:scale-95"
      style={{
        backgroundColor: subject.color,
        opacity: task.done ? 0.5 : 1,
        textDecoration: task.done ? 'line-through' : 'none',
      }}
      title={task.text}
    >
      {subject.emoji} {task.text}
      {task.remind ? ' 🔔' : ''}
    </button>
  );
}
