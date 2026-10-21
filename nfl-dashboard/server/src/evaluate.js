import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ML_DIR = path.join(__dirname, '..', '..', 'ml');

// Same order of magnitude as predictions.js's retrain timeout -- evaluate.py
// does comparable work (walk every week's ESPN boxscores) plus one extra
// week's worth for the actuals it's backtesting against.
const EVALUATE_TIMEOUT_MS = 5 * 60 * 1000;

/** Runs ml/evaluate.py for a given season/week and resolves with its report
 * (the same JSON it prints to stdout on success). Rejects with the
 * subprocess's stderr message on failure -- most commonly no ESPN network
 * access, or the requested week not having any final box scores yet. */
export function runEvaluate(year, week) {
  return new Promise((resolve, reject) => {
    execFile(
      'python3',
      ['evaluate.py', '--year', String(year), '--week', String(week)],
      { cwd: ML_DIR, timeout: EVALUATE_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || err.message));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error('evaluate.py did not return valid JSON'));
        }
      }
    );
  });
}
