#!/usr/bin/env python3
"""The once-a-day NBA prop pipeline:

1. Fetch every game finished since the last run into the game-log store
   (data/boxscores/), bootstrapping from last season on the very first run.
2. Grade every saved slate whose box scores are now in, and roll them into
   the season-long tracker (data/history.json).
3. Project today's slate (data/projections/<date>.json) and point
   data/latest.json at it.

A slate's projections are frozen once any of its games tips off — a rerun
mid-evening never overwrites them, so every graded prop was a genuine
pre-game call. (--force overrides that, for testing.)

Usage:
    python daily.py                       # today, US Eastern
    python daily.py --date 2026-11-02
    python daily.py --data-dir /tmp/nba-data

Needs outbound access to ESPN's public API (site.api.espn.com).
"""
import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import espn_client
import gamelogs
from features import add_derived, player_form
from grade import build_history, day_loader, grade_pending, projections_dir
from projections import build_projections, build_slate

DEFAULT_DATA_DIR = Path(os.environ.get("NBA_DATA_DIR") or Path(__file__).resolve().parent.parent / "data")
HISTORY_DAYS = 400


def eastern_today():
    return datetime.now(ZoneInfo("America/New_York")).date()


def _log(message):
    print(message, file=sys.stderr)


def _write_latest(data_dir, today):
    """latest.json is today's slate, or — on an off day — the most recent
    one, flagged so the UI can say so."""
    saved = sorted(projections_dir(data_dir).glob("*.json"))
    if not saved:
        return None
    todays = projections_dir(data_dir) / f"{today.isoformat()}.json"
    source = todays if todays.exists() else saved[-1]
    doc = json.loads(source.read_text())
    if source != todays:
        doc["note"] = f"No NBA games on {today.isoformat()} — showing the most recent slate ({doc['date']})."
    (Path(data_dir) / "latest.json").write_text(json.dumps(doc, separators=(",", ":")))
    return doc["date"]


def _write_index(data_dir):
    """index.json lists every saved slate, for readers that can't list a
    directory (the deployed server reads data/ over raw.githubusercontent.com)."""
    dates = sorted((p.stem for p in projections_dir(data_dir).glob("*.json")), reverse=True)
    (Path(data_dir) / "index.json").write_text(json.dumps({"dates": dates}) + "\n")


def run(data_dir, today, client=espn_client, force=False, is_sample=False, log=_log):
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    fetched = gamelogs.update(data_dir, today, client=client, log=log)
    logs = add_derived(gamelogs.load(data_dir, since=today - timedelta(days=HISTORY_DAYS)))
    last_fetched = gamelogs.read_state(data_dir).get("lastFetched")
    graded = grade_pending(data_dir, last_fetched, day_loader(logs))

    games = [g for g in client.get_scoreboard(today) if gamelogs.is_real_game(g)]
    out = projections_dir(data_dir) / f"{today.isoformat()}.json"
    started = any(g["state"] != "pre" for g in games)
    if not games:
        status = "no games"
    elif logs.empty:
        status = "no history yet"
    elif out.exists() and started and not force:
        status = "kept (slate already tipped off)"
    else:
        form = player_form(logs, today)
        slate = build_slate(games, client, form, today, log=log)
        doc = build_projections(logs, form, slate, games, today)
        doc["generatedAt"] = datetime.now(timezone.utc).isoformat()
        doc["isSample"] = is_sample
        if started:
            doc["note"] = "Generated after tip-off — injury news may be stale for games already underway."
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(doc, separators=(",", ":")))
        status = f"projected {len(doc['players'])} players"

    latest = _write_latest(data_dir, today)
    history = build_history(data_dir, is_sample=is_sample)
    _write_index(data_dir)
    return {
        "date": today.isoformat(),
        "fetchedDays": len(fetched),
        "graded": graded,
        "games": len(games),
        "slate": status,
        "latest": latest,
        "trackedProps": history["overall"]["n"],
        "hitRate": history["overall"]["hitRate"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--date", type=date.fromisoformat, default=None, help="Slate date (default: today, ET)")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--force", action="store_true", help="Re-project even if the slate has started")
    args = parser.parse_args()

    summary = run(args.data_dir, args.date or eastern_today(), force=args.force)
    # One line on stdout so the server's refresh log (and the GitHub Action
    # log) shows what a run actually did.
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
