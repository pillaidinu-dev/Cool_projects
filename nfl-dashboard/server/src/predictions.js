import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ML_DIR = path.join(__dirname, '..', '..', 'ml');
const PREDICTIONS_FILE = path.join(ML_DIR, 'predictions', 'latest.json');
const RETRAIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // refresh a few times a day; ESPN's own boxscore data only changes after games are final

const EMPTY = {
  generatedAt: null,
  isSample: true,
  metrics: {},
  passing: [],
  rushing: [],
  receiving: [],
  touchdowns: [],
  note: 'Projections have not been generated yet. Run `python3 ml/train.py`.',
};

export function readPredictions() {
  try {
    return JSON.parse(fs.readFileSync(PREDICTIONS_FILE, 'utf-8'));
  } catch {
    return EMPTY;
  }
}

function retrain() {
  execFile('python3', ['train.py'], { cwd: ML_DIR, timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
    if (err) {
      // Expected in any environment without network access to ESPN (this
      // sandbox included) or without the ml/ Python deps installed — the
      // server just keeps serving whatever predictions/latest.json already
      // has (the checked-in sample, until the first successful run).
      console.warn('Projection retrain skipped:', stderr?.trim() || err.message);
      return;
    }
    console.log('Weekly projections regenerated:', stdout?.trim());
  });
}

export function startWeeklyRetraining() {
  retrain();
  setInterval(retrain, RETRAIN_INTERVAL_MS);
}
