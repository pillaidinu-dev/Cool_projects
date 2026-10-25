"""Powerball pattern analysis: frequencies, randomness tests, and a hot-number backtest.

Uses every draw in the current 5/69 + 1/26 format (since 2015-10-07). Standard library only.

    python3 analyze.py [path/to/powerball.csv]
"""

import csv
import math
import sys
from collections import Counter
from datetime import datetime
from itertools import combinations
from pathlib import Path

WHITE_MAX = 69
RED_MAX = 26


def load_draws(path):
    draws = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            whites = sorted(int(n) for n in row["white_balls"].split("|"))
            draws.append((datetime.strptime(row["date"], "%m/%d/%Y").date(), whites, int(row["red_ball"])))
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


def chi2_uniform(counts, size, total):
    expected = total / size
    stat = sum((counts.get(n, 0) - expected) ** 2 / expected for n in range(1, size + 1))
    return stat, chi2_sf(stat, size - 1)


def ranked(counts, size):
    return sorted(range(1, size + 1), key=lambda n: (-counts.get(n, 0), n))


def fmt(nums, counts):
    return ", ".join(f"{n}({counts.get(n, 0)})" for n in nums)


def backtest_hot(draws, window, top_k):
    """Each draw, pick the top_k most frequent white balls of the previous `window` draws.
    Returns (average hits per draw, hits expected by pure chance)."""
    hits = trials = 0
    for i in range(window, len(draws)):
        counts = Counter(n for _, w, _ in draws[i - window:i] for n in w)
        picks = set(ranked(counts, WHITE_MAX)[:top_k])
        hits += len(picks & set(draws[i][1]))
        trials += 1
    return hits / trials, top_k * 5 / WHITE_MAX


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("powerball.csv")
    draws = load_draws(path)
    n = len(draws)
    white = Counter(x for _, w, _ in draws for x in w)
    red = Counter(r for _, _, r in draws)

    print(f"Draws analysed: {n}  ({draws[0][0]} to {draws[-1][0]})\n")

    print("== Most frequent numbers (all draws) ==")
    print(f"White balls, top 10: {fmt(ranked(white, WHITE_MAX)[:10], white)}")
    print(f"White balls, bottom 5: {fmt(ranked(white, WHITE_MAX)[-5:], white)}")
    print(f"Powerball,   top 5:  {fmt(ranked(red, RED_MAX)[:5], red)}")
    print(f"Powerball,   bottom 3: {fmt(ranked(red, RED_MAX)[-3:], red)}")
    print(f"Expected per number if fair: white {5 * n / WHITE_MAX:.1f}, Powerball {n / RED_MAX:.1f}\n")

    recent = draws[-100:]
    rw = Counter(x for _, w, _ in recent for x in w)
    rr = Counter(r for _, _, r in recent)
    print("== Hot in the last 100 draws ==")
    print(f"White: {fmt(ranked(rw, WHITE_MAX)[:5], rw)}   Powerball: {fmt(ranked(rr, RED_MAX)[:3], rr)}\n")

    last_seen = {}
    for i, (_, w, _) in enumerate(draws):
        for x in w:
            last_seen[x] = i
    overdue = sorted(range(1, WHITE_MAX + 1), key=lambda x: last_seen.get(x, -1))[:5]
    print("== Longest-absent white balls ('overdue') ==")
    print(", ".join(f"{x}({n - 1 - last_seen.get(x, -1)} draws)" for x in overdue) + "\n")

    pairs = Counter(p for _, w, _ in draws for p in combinations(w, 2))
    exp_pair = n * 10 / math.comb(WHITE_MAX, 2)
    print("== Most common white-ball pairs ==")
    print(", ".join(f"{a}-{b}({c})" for (a, b), c in pairs.most_common(5)) + f"  [expected ~{exp_pair:.1f}]\n")

    sums = [sum(w) for _, w, _ in draws]
    odds = Counter(sum(x % 2 for x in w) for _, w, _ in draws)
    consec = sum(any(b - a == 1 for a, b in zip(w, w[1:])) for _, w, _ in draws)
    print("== Shape of a draw ==")
    print(f"Sum of white balls: mean {sum(sums) / n:.1f} (theory 175.0), middle 50% "
          f"{sorted(sums)[n // 4]}-{sorted(sums)[3 * n // 4]}")
    print("Odd count per draw: " + ", ".join(f"{k} odd: {odds[k] / n:.0%}" for k in range(6)))
    print(f"Draws with at least one consecutive pair: {consec / n:.0%} (theory ~26%)\n")

    ws, wp = chi2_uniform(white, WHITE_MAX, 5 * n)
    rs, rp = chi2_uniform(red, RED_MAX, n)
    print("== Is any of this a real pattern? (chi-square test vs. a fair machine) ==")
    print(f"White balls: chi2={ws:.1f}, df={WHITE_MAX - 1}, p={wp:.2f}")
    print(f"Powerball:   chi2={rs:.1f}, df={RED_MAX - 1}, p={rp:.2f}")
    print("p > 0.05 means the spread of counts is what a fair, random draw normally produces.\n")

    print("== Backtest: does betting on 'hot' numbers beat chance? ==")
    for window in (50, 100, 300):
        got, chance = backtest_hot(draws, window, 5)
        print(f"Top-5 hottest of last {window:>3} draws: {got:.3f} hits/draw vs {chance:.3f} by chance")
    print()

    top_white = ranked(white, WHITE_MAX)[:5]
    top_red = ranked(red, RED_MAX)[0]
    print("== Most-frequent-number ticket ==")
    print(f"White: {' '.join(map(str, sorted(top_white)))}   Powerball: {top_red}")
    print("Odds of the jackpot are 1 in 292,201,338 for this ticket, the same as for any other.")


if __name__ == "__main__":
    main()
