export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// 7am through 8pm, one row per hour.
export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function formatWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export function formatHour(hour) {
  const period = hour < 12 ? 'AM' : 'PM';
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12} ${period}`;
}

export function taskDateTime(task) {
  return new Date(`${task.date}T${String(task.hour).padStart(2, '0')}:00:00`);
}
