import { useEffect, useMemo, useState } from 'react';
import WeekHeader from './components/WeekHeader.jsx';
import WeekGrid from './components/WeekGrid.jsx';
import TaskModal from './components/TaskModal.jsx';
import ReminderToast from './components/ReminderToast.jsx';
import { loadTasks, saveTasks } from './lib/storage.js';
import { playReminderChime } from './lib/sound.js';
import { addDays, isoDate, startOfWeek, taskDateTime } from './lib/dates.js';

const REMINDER_WINDOW_MS = 15 * 60 * 1000; // fire for tasks due within the last 15 minutes
const CHECK_INTERVAL_MS = 20 * 1000;

export default function App() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [tasks, setTasks] = useState(() => loadTasks());
  const [draft, setDraft] = useState(null); // task being added/edited, or null
  const [dueReminders, setDueReminders] = useState([]);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // Ask quietly on load so reminders can use the OS notification tray too;
      // the in-app toast still works if the user declines.
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    function checkReminders() {
      const now = Date.now();
      setTasks((prev) => {
        let changed = false;
        const dueNow = [];
        const next = prev.map((task) => {
          if (!task.remind || task.notified || task.done) return task;
          const dueAt = taskDateTime(task).getTime();
          if (now >= dueAt && now - dueAt <= REMINDER_WINDOW_MS) {
            dueNow.push(task);
            changed = true;
            return { ...task, notified: true };
          }
          return task;
        });
        if (dueNow.length > 0) {
          setDueReminders((current) => [...current, ...dueNow]);
          playReminderChime();
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            dueNow.forEach((task) => {
              new Notification('Planner Pal 🔔', { body: task.text });
            });
          }
        }
        return changed ? next : prev;
      });
    }

    checkReminders();
    const id = setInterval(checkReminders, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const todayIso = useMemo(() => isoDate(new Date()), []);

  function handleAddTask(date, hour) {
    setDraft({ date, hour, text: '', subject: 'homework', remind: false, done: false });
  }

  function handleEditTask(task) {
    setDraft(task);
  }

  function handleSaveTask(taskData) {
    setTasks((prev) => {
      if (taskData.id) {
        return prev.map((t) => (t.id === taskData.id ? { ...t, ...taskData } : t));
      }
      const newTask = {
        id: crypto.randomUUID(),
        date: taskData.date,
        hour: taskData.hour,
        text: taskData.text,
        subject: taskData.subject,
        remind: taskData.remind,
        done: false,
        notified: false,
      };
      return [...prev, newTask];
    });
    setDraft(null);
  }

  function handleDeleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDraft(null);
  }

  function dismissReminder(id) {
    setDueReminders((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="min-h-screen">
      <WeekHeader
        weekStart={weekStart}
        onPrev={() => setWeekStart((d) => addDays(d, -7))}
        onNext={() => setWeekStart((d) => addDays(d, 7))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
      />

      <WeekGrid
        weekStart={weekStart}
        tasks={tasks}
        todayIso={todayIso}
        onAddTask={handleAddTask}
        onEditTask={handleEditTask}
      />

      {draft && (
        <TaskModal
          draft={draft}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setDraft(null)}
        />
      )}

      <ReminderToast reminders={dueReminders} onDismiss={dismissReminder} />
    </div>
  );
}
