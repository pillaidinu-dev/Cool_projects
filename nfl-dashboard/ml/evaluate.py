#!/usr/bin/env python3
"""Backtests the weekly projections against what actually happened: rebuilds
the projections train.py would have produced for a completed week (trained
only on games strictly before it, exactly like a real run) and joins them
against that week's real final box scores.

Usage:
    python evaluate.py --year 2026 --week 5
    python evaluate.py --year 2026 --week 5 --out /tmp/eval.json

Needs outbound network access to ESPN's public API (site.api.espn.com),
same constraint as train.py -- run this locally, in CI, or from the
deployed server where that access is available.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

import dataset
from features import build_training_frame, build_upcoming_frame
from model import project_touchdowns, project_yardage
from train import CATEGORIES, TOUCHDOWN_POSITIONS


def _lookup(df, value_col):
    """player/team -> value_col, for joining projections against actuals."""
    return df.set_index(["player", "team"])[value_col]


def _join_actual(predicted, actual_lookup, out_col):
    values = [actual_lookup.get((r["player"], r["team"])) for _, r in predicted.iterrows()]
    return predicted.assign(**{out_col: values}).dropna(subset=[out_col])


def evaluate(history, actual, matchups):
    """Pure comparison, no network: given history (games strictly before the
    target week), that week's real box scores, and its matchups, rebuilds
    the projections train.py would have produced and scores them against
    what actually happened. Returns a report dict."""
    history = history.copy()
    actual = actual.copy()
    history["td_total"] = history["rush_td"] + history["rec_td"]
    actual["td_total"] = actual["rush_td"] + actual["rec_td"]

    report = {"categories": {}}

    for category, cfg in CATEGORIES.items():
        train_df = build_training_frame(history, cfg["stat_col"], cfg["positions"])
        upcoming_df = build_upcoming_frame(history, cfg["stat_col"], cfg["positions"], matchups)
        predicted, _ = project_yardage(train_df, upcoming_df)

        actual_scoped = actual[actual["position"].isin(cfg["positions"])]
        joined = _join_actual(predicted, _lookup(actual_scoped, cfg["stat_col"]), "actual")
        if joined.empty:
            report["categories"][category] = {"n": 0}
            continue

        err = joined["actual"] - joined["projection"]
        in_band = (joined["actual"] >= joined["low"]) & (joined["actual"] <= joined["high"])
        report["categories"][category] = {
            "n": int(len(joined)),
            "mae": round(float(err.abs().mean()), 2),
            "bias": round(float(err.mean()), 2),  # positive = model under-projected on average
            "bandCoverage": round(float(in_band.mean()) * 100, 1),  # how often actual fell in [low, high]
        }

    train_td = build_training_frame(history, "td_total", TOUCHDOWN_POSITIONS)
    upcoming_td = build_upcoming_frame(history, "td_total", TOUCHDOWN_POSITIONS, matchups)
    predicted_td = project_touchdowns(train_td, upcoming_td)

    joined_td = _join_actual(predicted_td, _lookup(actual, "td_total"), "actual_td")
    if joined_td.empty:
        report["categories"]["touchdowns"] = {"n": 0}
    else:
        scored = (joined_td["actual_td"] > 0).astype(float)
        brier = float(np.mean((joined_td["td_probability"] - scored) ** 2))
        report["categories"]["touchdowns"] = {
            "n": int(len(joined_td)),
            "brier": round(brier, 4),  # lower is better; 0.25 is what a coin-flip baseline scores
            "actualScoreRate": round(float(scored.mean()) * 100, 1),
            "meanPredictedProbability": round(float(joined_td["td_probability"].mean()) * 100, 1),
        }

    return report


def evaluate_week(year, week):
    """Fetches history (weeks before `week`) and `week`'s real results from
    ESPN, then scores the projections that history alone would have produced."""
    history = dataset.fetch_season_gamelogs(year, week)
    if history.empty:
        raise SystemExit(f"No completed games before {year} week {week} to train on")
    actual = dataset.fetch_week_gamelogs(year, week)
    if actual.empty:
        raise SystemExit(f"{year} week {week} has no final box scores yet")
    matchups = dataset.fetch_upcoming_matchups(year, week)

    report = evaluate(history, actual, matchups)
    report["season"] = year
    report["week"] = week
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--week", type=int, required=True, help="A completed week to backtest against")
    parser.add_argument("--out", type=Path, default=None, help="Optional path to write the report JSON")
    args = parser.parse_args()

    print(f"Backtesting {args.year} week {args.week}...", file=sys.stderr)
    report = evaluate_week(args.year, args.week)
    text = json.dumps(report, indent=2)
    print(text)
    if args.out:
        args.out.write_text(text)
        print(f"Wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
