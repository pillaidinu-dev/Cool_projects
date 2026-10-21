#!/usr/bin/env python3
"""End-to-end check of the daily prop pipeline against a synthetic league
served in ESPN's response shapes (tests/fake_espn.py) — no network needed.
Runs daily.run() day by day the way the scheduled job does, then asserts
on the box-score store, the saved slates, grading and the tracker.

Run from the ml/ directory: `python tests/selftest.py`
"""
import json
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import daily  # noqa: E402
from boxscore import parse_boxscore, parse_minutes  # noqa: E402
from fake_espn import FakeESPN  # noqa: E402
from features import STATS  # noqa: E402
from model import p_over, prop_line  # noqa: E402


def quiet(_msg):
    pass


def test_pipeline():
    start, today = date(2026, 10, 1), date(2026, 11, 10)
    with tempfile.TemporaryDirectory() as tmp:
        data = Path(tmp)
        # Bootstrap run on an empty store, then one run per day for 8 days.
        for offset in range(8, -1, -1):
            day = today - timedelta(days=offset)
            fake = FakeESPN(start, days=45, now=day)
            summary = daily.run(data, day, client=fake, log=quiet)

        assert (data / "state.json").exists()
        assert json.loads((data / "state.json").read_text())["lastFetched"] == (today - timedelta(days=1)).isoformat()
        box_files = sorted((data / "boxscores").glob("*.csv"))
        assert len(box_files) >= 20, f"expected a bootstrapped store, got {len(box_files)} days"

        slates = sorted((data / "projections").glob("*.json"))
        assert slates, "no slates saved"
        docs = [json.loads(p.read_text()) for p in slates]
        todays = docs[-1]
        assert todays["date"] == today.isoformat() and not todays["graded"], "today's slate should be ungraded"
        assert all(d["graded"] for d in docs[:-1]), "every past slate should be graded"

        players = todays["players"]
        assert players, "today's slate has no players"
        names = {p["name"] for p in players}
        assert not any("Deep Bench" in n for n in names), "sub-12-minute players should be filtered out"
        assert "BOS Sixth Man" not in names, "players ruled Out on the roster should be excluded"
        for p in players:
            assert p["props"] and set(p["props"]) <= set(STATS), f"{p['name']}: {set(p['props'])}"
            for stat, prop in p["props"].items():
                assert 0 <= prop["pOver"] <= 1 and 0 <= prop["pFair"] <= 1, f"{stat} probability out of range"
                assert prop["lo"] <= prop["proj"] <= prop["hi"], f"{stat} range doesn't contain projection"
                assert prop["line"] % 1 == 0.5, f"{stat} line {prop['line']} isn't a half-point"
        from projections import MIN_L10

        posted = [(s, prop) for p in players for s, prop in p["props"].items()]
        assert all(prop["l10"] >= MIN_L10[s] for s, prop in posted), "posted a market below its L10 floor"
        assert {s for s, _ in posted} == set(STATS), "every market should be posted for someone"
        for stat, m in todays["metrics"].items():
            assert m and m["mae"] >= 0 and m["baselineMae"] >= 0, f"{stat} has no backtest"

        graded = docs[-2]
        played = [p for p in graded["players"] if p["actual"]]
        assert played and all("result" in prop for p in played for prop in p["props"].values())

        history = json.loads((data / "history.json").read_text())
        assert history["overall"]["n"] > 0 and 0 <= history["overall"]["hitRate"] <= 1
        assert sum(d["n"] for d in history["days"]) == history["overall"]["n"]
        assert sum(b["n"] for b in history["calibration"]) == history["overall"]["n"]
        assert abs(sum(d["units"] for d in history["days"]) - history["overall"]["units"]) < 0.1
        assert history["overall"]["roi"] is not None
        assert json.loads((data / "latest.json").read_text())["date"] == today.isoformat()

        # Re-running after tip-off must not overwrite the frozen slate.
        before = (data / "projections" / f"{today.isoformat()}.json").read_text()
        started = FakeESPN(start, days=45, now=today + timedelta(days=1))
        summary = daily.run(data, today, client=started, log=quiet)
        assert summary["slate"].startswith("kept"), summary
        assert (data / "projections" / f"{today.isoformat()}.json").read_text() == before

        print(f"[ok] pipeline: {len(box_files)} box-score days, {len(slates)} slates, "
              f"{history['overall']['n']} graded props, ROI {history['overall']['roi']}, "
              f"top-10 ROI {history['topPicks']['roi']}")


def test_parse_boxscore():
    summary = {
        "header": {"competitions": [{"competitors": [
            {"homeAway": "home", "team": {"abbreviation": "LAL"}},
            {"homeAway": "away", "team": {"abbreviation": "GSW"}},
        ]}]},
        "boxscore": {"players": [{
            "team": {"abbreviation": "GSW"},
            "statistics": [{
                # keys only, no labels: the newer payload shape
                "keys": ["minutes", "points", "rebounds", "assists", "steals", "blocks", "turnovers",
                         "threePointFieldGoalsMade-threePointFieldGoalsAttempted"],
                "athletes": [
                    {"athlete": {"id": "1", "displayName": "Shooter"}, "starter": True,
                     "stats": ["36:30", "31", "4", "6", "2", "0", "3", "7-13"]},
                    {"athlete": {"id": "2", "displayName": "Benched"}, "didNotPlay": True, "stats": []},
                    {"athlete": {"id": "3", "displayName": "Zero Min"}, "stats": ["0", "0", "0", "0", "0", "0", "0", "0-0"]},
                ],
            }],
        }]},
    }
    rows = parse_boxscore(summary, "2026-11-01", "99")
    assert [r["player"] for r in rows] == ["Shooter"], rows
    r = rows[0]
    assert (r["pts"], r["fg3m"], r["fg3a"], r["opponent"], r["is_home"]) == (31, 7, 13, "LAL", 0)
    assert abs(r["min"] - 36.5) < 1e-9
    assert parse_minutes("34") == 34 and parse_minutes(None) == 0
    print("[ok] boxscore: keys-only payload, DNP and zero-minute rows skipped")


def test_pricing():
    from grade import edge, lean, units

    under_line = {"pOver": 0.41, "pFair": 0.30}  # line above the mean: under is the "easy" side
    assert lean(under_line) == "over", "model rates the over above its price, so it leans over"
    assert abs(edge(under_line) - 0.11) < 1e-9
    assert abs(units(under_line, True) - (1 / 0.30 - 1)) < 1e-9 and units(under_line, False) == -1
    assert lean({"pOver": 0.62, "pFair": 0.70}) == "under"
    print("[ok] grade: leans priced against the L10-average line")


def test_lines_and_odds():
    assert prop_line(24.3) == 24.5 and prop_line(24.9) == 24.5 and prop_line(0.2) == 0.5
    assert p_over("pts", 30, 6, 24.5) > 0.5 > p_over("pts", 20, 6, 24.5)
    assert abs(p_over("blk", 1.0, 1.0, 0.5) - (1 - 2.718281828 ** -1)) < 1e-6
    print("[ok] model: half-point lines and over probabilities")


if __name__ == "__main__":
    test_parse_boxscore()
    test_lines_and_odds()
    test_pricing()
    test_pipeline()
    print("\nselftest passed")
