# Lottery Pattern Analysis

Looks for patterns in every Powerball and Mega Millions draw under the current number ranges, and
picks the most frequently drawn numbers.

```
python3 analyze.py powerball              # uses the bundled powerball.csv
python3 analyze.py megamillions           # uses the bundled megamillions.csv
python3 analyze.py megamillions other.csv # or any CSV in the same format
```

Standard library only. The CSVs are snapshots from
[jbaranski/jeffs-lottery-utils](https://github.com/jbaranski/jeffs-lottery-utils), which mirrors the
official results. To refresh, copy `numbers/powerball.csv` and `numbers/megamillions.csv` from it.

| Game | Draws since | White balls | Bonus ball |
|---|---|---|---|
| Powerball | 2015-10-07 | 5 of 1-69 | Powerball 1-26 |
| Mega Millions | 2017-10-31 | 5 of 1-70 | Mega Ball 1-25, then 1-24 from 2025-04-08 |

Because the Mega Ball range changed, its expected counts are worked out draw by draw: before
April 2025 each number had a 1-in-25 chance, and after that a 1-in-24 chance with 25 retired.

## What it reports

- **Frequencies**: most and least drawn white and bonus balls, overall and in the last 100 draws.
- **Overdue numbers**: white balls that have been absent the longest.
- **Pairs, sums, odd/even, consecutive numbers**, each compared with what pure chance predicts.
- **Chi-square test**: is the spread of counts more uneven than a fair machine would produce?
- **Backtest**: if you had played the 5 "hottest" numbers before every draw, would you have beaten chance?

## Findings

| | Powerball (1,424 draws to 2026-10-24) | Mega Millions (938 draws to 2026-10-23) |
|---|---|---|
| Most frequent white balls | **21, 61, 64, 28, 32** (128-120 times, ~103 expected) | **10, 17, 31, 3, 42** (87-79 times, ~67 expected) |
| Most frequent bonus ball | **14** (68 times, ~55 expected) | **22** (49 times, tied with 24, ~38 expected) |
| Chi-square p-value, white / bonus | 0.18 / 0.51 | 0.73 / 0.65 |
| Hot-number backtest, hits per draw | 0.36-0.39 vs 0.36 by chance | 0.33-0.40 vs 0.36 by chance |
| Jackpot odds, any ticket | 1 in 292,201,338 | 1 in 290,472,336 |

There is no exploitable pattern in either game. Every p-value is well above 0.05, so the counts are
as uneven as random draws normally are. Playing the "hot" numbers lands on both sides of chance
depending on the look-back window, which is what noise looks like. Sums, odd/even splits and
consecutive pairs all match the theory.
