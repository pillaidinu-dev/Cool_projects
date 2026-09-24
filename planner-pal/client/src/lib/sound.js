let ctx;

function getContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// A short, friendly two-tone bell — no audio file needed. Browsers only
// allow audio after some user gesture on the page; since reminders fire
// well after the user has already tapped around the planner, the context
// is unlocked by the time this runs.
export function playReminderChime() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [880, 1318.51].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch {
    // Audio isn't critical to the reminder — the toast still shows either way.
  }
}
