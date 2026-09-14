#!/usr/bin/env python3
"""Generates predictions/latest.json from synthetic game logs (no ESPN
access needed) so the dashboard has something to render before the real
pipeline (train.py) has ever been run against live data. Output is flagged
isSample: true so the UI can say so.

Run from the ml/ directory: `python make_sample.py`
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "tests"))

from features import build_training_frame, build_upcoming_frame
from model import project_touchdowns, project_yardage
from selftest import synthetic_gamelogs
from train import CATEGORIES, TOUCHDOWN_POSITIONS, round2, touchdown_rows, yardage_rows


def main():
    gamelogs, last_pairings = synthetic_gamelogs(weeks=6)
    gamelogs["td_total"] = gamelogs["rush_td"] + gamelogs["rec_td"]
    matchups = [{"event_id": f"s-{h}-{a}", "name": f"{a} @ {h}", "home": h, "away": a} for h, a in last_pairings]

    output = {"season": 2026, "week": 7, "metrics": {}}
    for category, cfg in CATEGORIES.items():
        train_df = build_training_frame(gamelogs, cfg["stat_col"], cfg["positions"])
        upcoming_df = build_upcoming_frame(gamelogs, cfg["stat_col"], cfg["positions"], matchups)
        predicted, mae = project_yardage(train_df, upcoming_df)
        output["metrics"][f"{category}MAE"] = round2(mae) if mae is not None else None
        output[category] = yardage_rows(predicted.sort_values("projection", ascending=False).head(cfg["limit"]))

    train_td = build_training_frame(gamelogs, "td_total", TOUCHDOWN_POSITIONS)
    upcoming_td = build_upcoming_frame(gamelogs, "td_total", TOUCHDOWN_POSITIONS, matchups)
    predicted_td = project_touchdowns(train_td, upcoming_td)
    output["touchdowns"] = touchdown_rows(predicted_td.sort_values("td_probability", ascending=False).head(20))

    output["generatedAt"] = datetime.now(timezone.utc).isoformat()
    output["isSample"] = True
    output["note"] = "Sample projections generated from synthetic data for preview purposes. Run train.py with network access to ESPN for real projections."

    out = Path(__file__).parent / "predictions" / "latest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(output, indent=2))
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
