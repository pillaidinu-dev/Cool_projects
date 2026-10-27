"""Lottery pattern analysis: frequencies, randomness tests, and a hot-number backtest.

Covers Powerball (5/69 + 1/26, since 2015-10-07) and Mega Millions (5/70 + Mega Ball, since
2017-10-31; the Mega Ball range shrank from 1-25 to 1-24 on 2025-04-08). Standard library only.

    python3 analyze.py [powerball|megamillions] [path/to/draws.csv]
"""

import csv
import math
import sys
from collections import Counter
from datetime import date, datetime
from itertools import combinations
from pathlib import Path

GAMES = {
    "powerball": {
        "name": "Powerball",
        "bonus": "Powerball",
        "csv": "powerball.csv",
        "bonus_column": "red_ball",
        "white_max": 69,
        # (first draw date, bonus ball max) for each rule era, oldest first
        "bonus_eras": [(date(2015, 10, 7), 26)],
    },
    "megamillions": {
        "name": "Mega Millions",
        "bonus": "Mega Ball",
        "csv": "megamillions.csv",
        "bonus_column": "yellow_ball",
        "white_max": 70,
        "bonus_eras": [(date(2017, 10, 31), 25), (date(2025, 4, 8), 24)],
    },
}


def bonus_max(game, day):
    return [m for start, m in game["bonus_eras"] if start <= day][-1]


def load_draws(path, game):
    draws = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            day = datetime.strptime(row["date"], "%m/%d/%Y").date()
            if day < game["bonus_eras"][0][0]:
                continue
            whites = sorted(int(n) for n in row["white_balls"].split("|"))
            draws.append((day, whites, int(row[game["bonus_column"]])))
    draws.sort(key=lambda d: d[0])
    return draws


def chi2_sf(x, k):
    """P(X >= x) for a chi-square with k degrees of freedom (regularized upper gamma)."""
    a, x = k / 2, x / 2
    if x < a + 1:
        term = total = 1 / a
        n = a
        while abs(term) > 1e-15 * total:
            n += 1
            term *= x / n
            total += term
        return 1 - total * math.exp(-x + a * math.log(x) - math.lgamma(a))
    b, c, d = x + 1 - a, 1e300, 1 / (x + 1 - a)
    h = d
    for i in range(1, 1000):
        an = -i * (i - a)
        b += 2
        d = 1 / (an * d + b)
        c = b + an / c
        h *= d * c
        if abs(d * c - 1) < 1e-15:
            break
    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h


def chi2(counts, expected):
    """Chi-square goodness of fit; `expected` maps each possible number to its expected count."""
    stat = sum((counts.get(n, 0) - e) ** 2 / e for n, e in expected.items())
    return stat, chi2_sf(stat, len(expected) - 1)


def ranked(counts, size):
    return sorted(range(1, size + 1), key=lambda n: (-counts.get(n, 0), n))


def fmt(nums, counts):
    return ", ".join(f"{n}({counts.get(n, 0)})" for n in nums)


def backtest_hot(draws, white_max, window, top_k):
    """Each draw, pick the top_k most frequent white balls of the previous `window` draws.
    Returns (average hits per draw, hits expected by pure chance)."""
    hits = trials = 0
    for i in range(window, len(draws)):
        counts = Counter(n for _, w, _ in draws[i - window:i] for n in w)
        picks = set(ranked(counts, white_max)[:top_k])
        hits += len(picks & set(draws[i][1]))
        trials += 1
    return hits / trials, top_k * 5 / white_max


def main():
    key = sys.argv[1] if len(sys.argv) > 1 else "powerball"
    if key not in GAMES:
        sys.exit(f"usage: analyze.py [{'|'.join(GAMES)}] [csv]")
    game = GAMES[key]
    path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name(game["csv"])
    draws = load_draws(path, game)
    n = len(draws)
    wmax, bname = game["white_max"], game["bonus"]
    bmax_ever = max(m for _, m in game["bonus_eras"])
    bmax_now = game["bonus_eras"][-1][1]
    white = Counter(x for _, w, _ in draws for x in w)
    bonus = Counter(b for _, _, b in draws)
    bonus_expected = {b: sum(1 / bonus_max(game, d) for d, _, _ in draws if b <= bonus_max(game, d))
                      for b in range(1, bmax_ever + 1)}

    print(f"{game['name']}: {n} draws analysed ({draws[0][0]} to {draws[-1][0]})")
    if len(game["bonus_eras"]) > 1:
        print("Rule eras: " + ", ".join(f"{bname} 1-{m} from {d}" for d, m in game["bonus_eras"]))
    print()

    print("== Most frequent numbers (all draws) ==")
    print(f"White balls, top 10: {fmt(ranked(white, wmax)[:10], white)}")
    print(f"White balls, bottom 5: {fmt(ranked(white, wmax)[-5:], white)}")
    print(f"{bname}, top 5: {fmt(ranked(bonus, bmax_ever)[:5], bonus)}")
    print(f"{bname}, bottom 3: {fmt(ranked(bonus, bmax_ever)[-3:], bonus)}")
    print(f"Expected per number if fair: white {5 * n / wmax:.1f}, {bname} {bonus_expected[1]:.1f}"
          + (f" ({bonus_expected[bmax_ever]:.1f} for {bmax_ever}, retired in later eras)"
             if bonus_expected[bmax_ever] != bonus_expected[1] else "") + "\n")

    recent = draws[-100:]
    rw = Counter(x for _, w, _ in recent for x in w)
    rb = Counter(b for _, _, b in recent)
    print("== Hot in the last 100 draws ==")
    print(f"White: {fmt(ranked(rw, wmax)[:5], rw)}   {bname}: {fmt(ranked(rb, bmax_now)[:3], rb)}\n")

    last_seen = {}
    for i, (_, w, _) in enumerate(draws):
        for x in w:
            last_seen[x] = i
    overdue = sorted(range(1, wmax + 1), key=lambda x: last_seen.get(x, -1))[:5]
    print("== Longest-absent white balls ('overdue') ==")
    print(", ".join(f"{x}({n - 1 - last_seen.get(x, -1)} draws)" for x in overdue) + "\n")

    pairs = Counter(p for _, w, _ in draws for p in combinations(w, 2))
    exp_pair = n * 10 / math.comb(wmax, 2)
    print("== Most common white-ball pairs ==")
    print(", ".join(f"{a}-{b}({c})" for (a, b), c in pairs.most_common(5)) + f"  [expected ~{exp_pair:.1f}]\n")

    sums = [sum(w) for _, w, _ in draws]
    odds = Counter(sum(x % 2 for x in w) for _, w, _ in draws)
    consec = sum(any(b - a == 1 for a, b in zip(w, w[1:])) for _, w, _ in draws)
    consec_theory = 1 - math.comb(wmax - 4, 5) / math.comb(wmax, 5)
    print("== Shape of a draw ==")
    print(f"Sum of white balls: mean {sum(sums) / n:.1f} (theory {5 * (wmax + 1) / 2:.1f}), middle 50% "
          f"{sorted(sums)[n // 4]}-{sorted(sums)[3 * n // 4]}")
    print("Odd count per draw: " + ", ".join(f"{k} odd: {odds[k] / n:.0%}" for k in range(6)))
    print(f"Draws with at least one consecutive pair: {consec / n:.0%} (theory {consec_theory:.0%})\n")

    ws, wp = chi2(white, {x: 5 * n / wmax for x in range(1, wmax + 1)})
    bs, bp = chi2(bonus, bonus_expected)
    print("== Is any of this a real pattern? (chi-square test vs. a fair machine) ==")
    print(f"White balls: chi2={ws:.1f}, df={wmax - 1}, p={wp:.2f}")
    print(f"{bname}: chi2={bs:.1f}, df={bmax_ever - 1}, p={bp:.2f}")
    print("p > 0.05 means the spread of counts is what a fair, random draw normally produces.\n")

    print("== Backtest: does betting on 'hot' numbers beat chance? ==")
    for window in (50, 100, 300):
        got, chance = backtest_hot(draws, wmax, window, 5)
        print(f"Top-5 hottest of last {window:>3} draws: {got:.3f} hits/draw vs {chance:.3f} by chance")
    print()

    top_white = ranked(white, wmax)[:5]
    top_bonus = ranked(bonus, bmax_now)[0]
    print("== Most-frequent-number ticket ==")
    print(f"White: {' '.join(map(str, sorted(top_white)))}   {bname}: {top_bonus}")
    print(f"Odds of the jackpot are 1 in {math.comb(wmax, 5) * bmax_now:,} for this ticket, "
          "the same as for any other.")


if __name__ == "__main__":
    main()
