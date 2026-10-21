"""Grades saved projections against what actually happened, and rolls every
graded day up into the season-long prop tracker (data/history.json).

Lines are proxies (the x.5 nearest a player's last-10 average), so a raw
hit rate would mostly measure where the line sits — a 1.4 spg player's 1.5
steals line goes under ~60% of the time no matter who picks it. Instead
each prop is priced: `pFair` is the over probability implied by the
player's own last-10 average, the price a form-anchored book would hang.
The model's lean is whichever side it rates above that price, and a pick
is scored in units at fair (no-vig) odds: +(1/price - 1) for a hit, -1 for
a miss. Positive ROI means the model knows something the L10 average
doesn't. All lines are x.5, so there are no pushes; a player who didn't
play is void.
"""
import json
from datetime import datetime, timezone
from pathlib import Path


from features import STATS

CONFIDENCE_BUCKETS = [(0.0, 0.40), (0.40, 0.50), (0.50, 0.60), (0.60, 0.70), (0.70, 1.01)]
PRICE_CLAMP = (0.05, 0.95)
# The daily top-10 skips flagged players (see projections.history_flags),
# matching the dashboard's Top 10 edges card.
TOP_PICKS_PER_DAY = 10


def projections_dir(data_dir):
    return Path(data_dir) / "projections"


def lean(prop):
    return "over" if prop["pOver"] >= prop["pFair"] else "under"


def side_probs(prop):
    """(model probability, fair price) of the leaned side."""
    if lean(prop) == "over":
        return prop["pOver"], prop["pFair"]
    return 1 - prop["pOver"], 1 - prop["pFair"]


def edge(prop):
    model, price = side_probs(prop)
    return model - price


def units(prop, hit):
    price = min(max(side_probs(prop)[1], PRICE_CLAMP[0]), PRICE_CLAMP[1])
    return 1 / price - 1 if hit else -1.0


def grade_doc(doc, day_logs):
    """Adds `actual` to every player (None if they didn't play) and a
    `result` ("hit"/"miss") to each of their props."""
    by_id = {str(r["player_id"]): r for _, r in day_logs.iterrows()} if not day_logs.empty else {}
    for player in doc["players"]:
        row = by_id.get(str(player["id"]))
        if row is None:
            player["actual"] = None
            continue
        player["actual"] = {stat: float(sum(row[c] for c in cols)) for stat, cols in STATS.items()}
        player["actual"]["min"] = float(row["min"])
        for stat, prop in player["props"].items():
            went_over = player["actual"][stat] > prop["line"]
            prop["result"] = "hit" if went_over == (lean(prop) == "over") else "miss"
    doc["graded"] = True
    doc["gradedAt"] = datetime.now(timezone.utc).isoformat()
    return doc


def grade_pending(data_dir, last_fetched, load_day):
    """Grades every saved slate whose date's box scores are now stored.
    `load_day(date_str)` returns that date's player-game rows."""
    graded = []
    for path in sorted(projections_dir(data_dir).glob("*.json")):
        if not last_fetched or path.stem > last_fetched:
            continue
        doc = json.loads(path.read_text())
        if doc.get("graded"):
            continue
        grade_doc(doc, load_day(path.stem))
        path.write_text(json.dumps(doc, separators=(",", ":")))
        graded.append(path.stem)
    return graded


def _tally():
    return {"n": 0, "hits": 0, "units": 0.0, "absErr": 0.0, "expected": 0.0}


def _add(t, hit, u, err, model_prob):
    t["n"] += 1
    t["hits"] += hit
    t["units"] += u
    t["absErr"] += err
    t["expected"] += model_prob


def _finish(t):
    n = t["n"]
    return {
        "n": n,
        "hits": t["hits"],
        "hitRate": round(t["hits"] / n, 3) if n else None,
        "units": round(t["units"], 2),
        "roi": round(t["units"] / n, 3) if n else None,
        "expectedHitRate": round(t["expected"] / n, 3) if n else None,
        "mae": round(t["absErr"] / n, 2) if n else None,
    }


def build_history(data_dir, is_sample=False):
    by_stat = {stat: _tally() for stat in STATS}
    buckets = [(lo, hi, _tally()) for lo, hi in CONFIDENCE_BUCKETS]
    top, overall = _tally(), _tally()
    days = []

    for path in sorted(projections_dir(data_dir).glob("*.json")):
        doc = json.loads(path.read_text())
        if not doc.get("graded"):
            continue
        day, day_top = _tally(), _tally()
        picks = []
        for player in doc["players"]:
            if not player.get("actual"):
                continue
            for stat, prop in player["props"].items():
                if "result" not in prop:
                    continue
                hit = prop["result"] == "hit"
                args = (hit, units(prop, hit), abs(player["actual"][stat] - prop["proj"]), side_probs(prop)[0])
                for t in (by_stat[stat], overall, day):
                    _add(t, *args)
                for lo, hi, t in buckets:
                    if lo <= args[3] < hi:
                        _add(t, *args)
                if not player.get("flags"):
                    picks.append((edge(prop), args))
        for _, args in sorted(picks, key=lambda x: -x[0])[:TOP_PICKS_PER_DAY]:
            _add(day_top, *args)
            _add(top, *args)
        if day["n"]:
            days.append({"date": doc["date"], **_finish(day), "top": _finish(day_top)})

    history = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "isSample": is_sample,
        "overall": _finish(overall),
        "byStat": {stat: _finish(t) for stat, t in by_stat.items()},
        "topPicks": _finish(top),
        "calibration": [{"lo": lo, "hi": min(hi, 1.0), **_finish(t)} for lo, hi, t in buckets],
        "days": days,
    }
    (Path(data_dir) / "history.json").write_text(json.dumps(history, indent=2) + "\n")
    return history


def day_loader(logs):
    """load_day() for grade_pending, backed by an already-loaded frame."""
    if logs.empty:
        return lambda _date: logs
    dates = logs["date"].dt.strftime("%Y-%m-%d")
    return lambda date: logs[dates == date]

