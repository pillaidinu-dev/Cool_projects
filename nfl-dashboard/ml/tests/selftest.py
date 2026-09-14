#!/usr/bin/env python3
"""Exercises the feature/model pipeline against synthetic game logs, with no
network access — proves dataset.py's *shape* is consumed correctly by
features.py and model.py without needing a real ESPN connection. Run from
the ml/ directory: `python tests/selftest.py`.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import random

import pandas as pd

from features import FEATURE_COLS, build_training_frame, build_upcoming_frame
from model import project_touchdowns, project_yardage
from train import touchdown_rows, yardage_rows


def synthetic_gamelogs(weeks=5, seed=7):
    random.seed(seed)
    teams = ["AAA", "BBB", "CCC", "DDD"]
    rosters = {
        team: {
            "QB": [f"{team} QB1"],
            "RB": [f"{team} RB1", f"{team} RB2"],
            "WR": [f"{team} WR1", f"{team} WR2", f"{team} WR3"],
            "TE": [f"{team} TE1"],
        }
        for team in teams
    }
    rows = []
    for week in range(1, weeks + 1):
        pairings = list(zip(teams[::2], teams[1::2]))
        for home, away in pairings:
            for team, opp, is_home in ((home, away, 1), (away, home, 0)):
                for name in rosters[team]["QB"]:
                    att = random.randint(25, 38)
                    rows.append(
                        _row(week, team, opp, is_home, name, "QB", pass_att=att, pass_yards=random.randint(150, 340),
                             pass_td=random.randint(0, 3), pass_int=random.randint(0, 2))
                    )
                for name in rosters[team]["RB"]:
                    rows.append(
                        _row(week, team, opp, is_home, name, "RB", rush_car=random.randint(5, 22),
                             rush_yards=random.randint(10, 130), rush_td=random.choice([0, 0, 0, 1]))
                    )
                for name in rosters[team]["WR"] + rosters[team]["TE"]:
                    pos = "TE" if "TE" in name else "WR"
                    rows.append(
                        _row(week, team, opp, is_home, name, pos, rec=random.randint(1, 9),
                             rec_yards=random.randint(5, 120), rec_td=random.choice([0, 0, 0, 1]))
                    )
    return pd.DataFrame(rows), pairings


def _row(week, team, opponent, is_home, player, position, **stats):
    base = {
        "week": week, "year": 2026, "event_id": f"E{week}-{team}-{opponent}",
        "player": player, "team": team, "opponent": opponent, "is_home": is_home,
        "position": position,
        "pass_att": 0.0, "pass_yards": 0.0, "pass_td": 0.0, "pass_int": 0.0,
        "rush_car": 0.0, "rush_yards": 0.0, "rush_td": 0.0,
        "rec": 0.0, "rec_yards": 0.0, "rec_td": 0.0,
    }
    base.update({k: float(v) for k, v in stats.items()})
    return base


def main():
    gamelogs, last_pairings = synthetic_gamelogs()
    gamelogs["td_total"] = gamelogs["rush_td"] + gamelogs["rec_td"]
    matchups = [
        {"event_id": f"next-{h}-{a}", "name": f"{a} @ {h}", "home": h, "away": a} for h, a in last_pairings
    ]

    checks = 0

    for category, stat_col, positions in [
        ("passing", "pass_yards", ["QB"]),
        ("rushing", "rush_yards", ["RB"]),
        ("receiving", "rec_yards", ["WR", "TE"]),
    ]:
        train_df = build_training_frame(gamelogs, stat_col, positions)
        assert not train_df.empty, f"{category}: training frame is empty"
        assert list(train_df[FEATURE_COLS].columns) == FEATURE_COLS
        assert train_df[FEATURE_COLS].isna().sum().sum() == 0, f"{category}: NaNs leaked into features"

        upcoming_df = build_upcoming_frame(gamelogs, stat_col, positions, matchups)
        assert not upcoming_df.empty, f"{category}: upcoming frame is empty"

        predicted, mae = project_yardage(train_df, upcoming_df)
        assert (predicted["projection"] >= 0).all(), f"{category}: negative projection"
        assert (predicted["high"] >= predicted["low"]).all(), f"{category}: high < low"
        rows = yardage_rows(predicted)
        assert rows and "projection" in rows[0]
        checks += 1
        print(f"[ok] {category}: {len(train_df)} training rows, {len(upcoming_df)} projected, MAE={mae}")

    train_td = build_training_frame(gamelogs, "td_total", ["RB", "WR", "TE", "QB"])
    upcoming_td = build_upcoming_frame(gamelogs, "td_total", ["RB", "WR", "TE", "QB"], matchups)
    predicted_td = project_touchdowns(train_td, upcoming_td)
    assert ((predicted_td["td_probability"] >= 0) & (predicted_td["td_probability"] <= 1)).all(), "prob out of [0,1]"
    rows = touchdown_rows(predicted_td)
    assert rows and "probability" in rows[0]
    checks += 1
    print(f"[ok] touchdowns: {len(train_td)} training rows, {len(upcoming_td)} projected")

    from espn_client import _all_games_final

    assert _all_games_final([]) is False, "no events shouldn't count as 'final'"
    assert _all_games_final([{"status": {"type": {"state": "post"}}}]) is True
    assert (
        _all_games_final(
            [{"status": {"type": {"state": "post"}}}, {"status": {"type": {"state": "in"}}}]
        )
        is False
    ), "one game still in progress means the week isn't done"
    assert _all_games_final([{"status": {"type": {"state": "pre"}}}]) is False
    print("[ok] week rollover: _all_games_final")

    print(f"\nselftest passed ({checks + 2} sections)")


if __name__ == "__main__":
    main()
