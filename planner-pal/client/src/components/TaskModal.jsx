import { useState } from 'react';
import { HOURS, formatHour } from '../lib/dates.js';
import { SUBJECTS } from '../lib/subjects.js';

export default function TaskModal({ draft, onSave, onDelete, onClose }) {
  const [text, setText] = useState(draft.text || '');
  const [subject, setSubject] = useState(draft.subject || SUBJECTS[0].key);
  const [hour, setHour] = useState(draft.hour);
  const [remind, setRemind] = useState(draft.remind || false);
  const [done, setDone] = useState(draft.done || false);

  const isEditing = Boolean(draft.id);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave({ ...draft, text: trimmed, subject, hour, remind, done });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="mb-3 text-xl font-extrabold text-[#3a3a3a]">
          {isEditing ? '✏️ Edit To-Do' : '✨ New To-Do'}
        </h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold text-[#6b6b6b]">What do you need to do?</span>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            rows={2}
            placeholder="e.g. Finish math worksheet"
            className="w-full resize-none rounded-xl border-2 border-[#e5e7eb] p-2 text-sm outline-none focus:border-[#5B8DEF]"
          />
        </label>

        <div className="mb-3">
          <span className="mb-1 block text-sm font-bold text-[#6b6b6b]">Subject</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                type="button"
                key={s.key}
                onClick={() => setSubject(s.key)}
                className="rounded-full px-3 py-1 text-xs font-bold transition"
                style={{
                  backgroundColor: subject === s.key ? s.color : '#f1f2f6',
                  color: subject === s.key ? '#fff' : '#3a3a3a',
                  transform: subject === s.key ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold text-[#6b6b6b]">Time</span>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-full rounded-xl border-2 border-[#e5e7eb] p-2 text-sm outline-none focus:border-[#5B8DEF]"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 flex items-center gap-2 text-sm font-bold text-[#6b6b6b]">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          🔔 Remind me when it's time
        </label>

        {isEditing && (
          <label className="mb-3 flex items-center gap-2 text-sm font-bold text-[#6b6b6b]">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            ✅ Mark as done
          </label>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="rounded-xl bg-[#FDE2E4] px-3 py-2 text-sm font-bold text-[#D64550] transition hover:scale-105 active:scale-95"
            >
              🗑️ Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[#f1f2f6] px-3 py-2 text-sm font-bold text-[#3a3a3a] transition hover:scale-105 active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-xl bg-[#5B8DEF] px-4 py-2 text-sm font-bold text-white transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
