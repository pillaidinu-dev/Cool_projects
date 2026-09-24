const KEY = 'planner-pal-tasks-v1';

export function loadTasks() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tasks));
  } catch {
    // Storage unavailable (private browsing, quota) — the planner still
    // works for the rest of the session, it just won't remember on reload.
  }
}
