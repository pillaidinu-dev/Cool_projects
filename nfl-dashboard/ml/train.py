#!/usr/bin/env python3
"""Builds this week's projections: passing yards (QB), rushing yards (RB),
receiving yards (WR/TE), and touchdown probability (RB/WR/TE/QB) — trained on
every game played so far this season.

Usage:
    python train.py                     # current week, writes predictions/latest.json
    python train.py --week 7 --year 2026
    python train.py --out /tmp/out.json

Needs outbound network access to ESPN's public API (site.api.espn.com),
which most sandboxed dev environments block — run this locally, in CI, or
from the deployed server where that access is available.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import dataset
import espn_client
from features import build_training_frame, build_upcoming_frame
from model import project_touchdowns, project_yardage

CATEGORIES = {
    "passing": {"stat_col": "pass_yards", "positions": ["QB"], "per_team": 1, "limit": 40},
    "rushing": {"stat_col": "rush_yards", "positions": ["RB"], "per_team": 2, "limit": 40},
    "receiving": {"stat_col": "rec_yards", "positions": ["WR", "TE"], "per_team": 3, "limit": 60},
}
TOUCHDOWN_POSITIONS = ["RB", "WR", "TE", "QB"]
TOUCHDOWN_PER_TEAM = 2
TOUCHDOWN_LIMIT = 60


def top_per_team(df, sort_col, per_team, limit):
    """The `per_team` best rows for every team, then trimmed to an overall
    cap by `sort_col` -- without this, a flat top-N over the whole league
    lets a handful of standout teams crowd out every other game, so a week
    with ~16 games ends up showing players from only 3-4 of them. Taking a
    floor per team first guarantees every team (and so every game) gets a
    slot before the remaining spots go to the highest projections overall.
    """
    if df.empty:
        return df
    ranked = df.sort_values(sort_col, ascending=False)
    floor = ranked.groupby("team", group_keys=False).head(per_team)
    return floor.sort_values(sort_col, ascending=False).head(limit)


def round2(value):
    return round(float(value), 1)


def yardage_rows(df):
    return [
        {
            "name": r["player"],
            "team": r["team"],
            "position": r.get("position"),
            "opponent": r["opponent"],
            "projection": round2(r["projection"]),
            "low": round2(r["low"]),
            "high": round2(r["high"]),
        }
        for _, r in df.sort_values("projection", ascending=False).iterrows()
    ]


def touchdown_rows(df):
    return [
        {
            "name": r["player"],
            "team": r["team"],
            "position": r.get("position"),
            "opponent": r["opponent"],
            "expectedTouchdowns": round2(r["expected_td"]),
            "probability": round(float(r["td_probability"]) * 100, 1),
        }
        for _, r in df.sort_values("td_probability", ascending=False).iterrows()
    ]


def build_projections(year, week):
    gamelogs = dataset.fetch_season_gamelogs(year, week)
    if gamelogs.empty:
        return {
            "season": year,
            "week": week,
            "metrics": {},
            "passing": [],
            "rushing": [],
            "receiving": [],
            "touchdowns": [],
            "note": (
                f"No games have finished yet this season, so there's no history to project Week "
                f"{week} from — this fills in automatically once Week 1 wraps up (including "
                f"Monday Night Football)."
            ),
        }

    gamelogs["td_total"] = gamelogs["rush_td"] + gamelogs["rec_td"]
    matchups = dataset.fetch_upcoming_matchups(year, week)

    output = {"season": year, "week": week, "metrics": {}}
    for category, cfg in CATEGORIES.items():
        train_df = build_training_frame(gamelogs, cfg["stat_col"], cfg["positions"])
        upcoming_df = build_upcoming_frame(gamelogs, cfg["stat_col"], cfg["positions"], matchups)
        predicted, mae = project_yardage(train_df, upcoming_df)
        output["metrics"][f"{category}MAE"] = round2(mae) if mae is not None else None
        output[category] = yardage_rows(top_per_team(predicted, "projection", cfg["per_team"], cfg["limit"]))

    train_td = build_training_frame(gamelogs, "td_total", TOUCHDOWN_POSITIONS, drop_zero_debuts=False)
    upcoming_td = build_upcoming_frame(gamelogs, "td_total", TOUCHDOWN_POSITIONS, matchups)
    predicted_td = project_touchdowns(train_td, upcoming_td)
    output["touchdowns"] = touchdown_rows(top_per_team(predicted_td, "td_probability", TOUCHDOWN_PER_TEAM, TOUCHDOWN_LIMIT))

    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int, default=None, help="Season year (defaults to ESPN's current season)")
    parser.add_argument("--week", type=int, default=None, help="Week to project (defaults to ESPN's current week)")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent / "predictions" / "latest.json",
        help="Where to write the projections JSON",
    )
    args = parser.parse_args()

    year, week = args.year, args.week
    if year is None or week is None:
        detected_year, detected_week = espn_client.get_current_week()
        year = year or detected_year
        week = week or detected_week

    print(f"Building projections for {year} week {week}...", file=sys.stderr)
    result = build_projections(year, week)
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    result["isSample"] = False

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2))
    archive = args.out.parent / f"week-{week}.json"
    archive.write_text(json.dumps(result, indent=2))
    print(f"Wrote {args.out}", file=sys.stderr)

    # A one-line summary on stdout (not stderr) so it shows up in the
    # server's "Weekly projections regenerated: <stdout>" log line -- the
    # only cheap way to confirm from outside the container what a
    # successful run actually produced, without a live view of the JSON.
    counts = {k: len(result.get(k, [])) for k in ("passing", "rushing", "receiving", "touchdowns")}
    print(f"season={year} week={week} counts={counts} note={result.get('note')!r}")


if __name__ == "__main__":
    main()
