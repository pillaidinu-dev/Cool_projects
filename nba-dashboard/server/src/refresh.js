import { execFile } from 'node:child_process';
import { ML_DIR } from './store.js';

// The scheduled GitHub Action (.github/workflows/nba-daily.yml) is the
// primary daily refresh, and the only one whose output is kept (it commits
// data/ back to the repo). This in-server refresh is a fallback for when
// that hasn't run yet today; its output lives only as long as the
// container. Off unless NBA_SERVER_REFRESH=1 (the Docker image sets it), so
// a local `npm run dev` doesn't rewrite the checked-in data/ under you.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

function refresh() {
  execFile('python3', ['daily.py'], { cwd: ML_DIR, timeout: 15 * 60 * 1000 }, (err, stdout, stderr) => {
    if (err) {
      // Expected without network access to ESPN or without the ml/ Python
      // deps — the server keeps serving whatever data/ already has.
      console.warn('NBA prop refresh skipped:', stderr?.trim().split('\n').pop() || err.message);
      return;
    }
    console.log('NBA props refreshed:', stdout?.trim());
  });
}

export function startDailyRefresh() {
  if (process.env.NBA_SERVER_REFRESH !== '1') return;
  refresh();
  setInterval(refresh, REFRESH_INTERVAL_MS);
}
