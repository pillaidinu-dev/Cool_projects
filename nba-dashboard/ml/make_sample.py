#!/usr/bin/env python3
"""Generates nba-dashboard/data-sample/ — a few weeks of slates, graded
results and a tracker, built by the real pipeline (daily.run) from the
synthetic league in tests/fake_espn.py. The server falls back to it until
the first real run has written data/latest.json, so every tab has
something real-shaped to render. Everything is flagged isSample: true.

Run from the ml/ directory: `python make_sample.py`
"""
import shutil
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tests"))

import daily  # noqa: E402
from fake_espn import FakeESPN  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data-sample"
SLATE_DAYS = 14


def main():
    today = daily.eastern_today()
    start = today - timedelta(days=40)
    shutil.rmtree(OUT, ignore_errors=True)
    for offset in range(SLATE_DAYS, -1, -1):
        day = today - timedelta(days=offset)
        daily.run(OUT, day, client=FakeESPN(start, days=41, now=day), is_sample=True, log=lambda _m: None)
    # The box-score store is only pipeline input; the dashboard never reads it.
    shutil.rmtree(OUT / "boxscores")
    (OUT / "state.json").unlink()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
