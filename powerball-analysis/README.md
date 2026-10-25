# Powerball Pattern Analysis

Looks for patterns in every Powerball draw since the current 5-of-69 + 1-of-26 format started
(2015-10-07), and picks the most frequently drawn numbers.

```
python3 analyze.py            # uses the bundled powerball.csv
python3 analyze.py other.csv  # or any CSV with date,white_balls,red_ball columns
```

Standard library only. `powerball.csv` is a snapshot through 2026-10-24 from
[jbaranski/jeffs-lottery-utils](https://github.com/jbaranski/jeffs-lottery-utils), which mirrors the
official results.

## What it reports

- **Frequencies**: most and least drawn white balls and Powerballs, overall and in the last 100 draws.
- **Overdue numbers**: white balls that have been absent the longest.
- **Pairs, sums, odd/even, consecutive numbers**, each compared with what pure chance predicts.
- **Chi-square test**: is the spread of counts more uneven than a fair machine would produce?
- **Backtest**: if you had played the 5 "hottest" numbers before every draw, would you have beaten chance?

## Findings (1,424 draws)

| | Pick | Times drawn | Expected if fair |
|---|---|---|---|
| Most frequent white balls | **21, 61, 64, 28, 32** | 128, 126, 125, 121, 120 | 103 |
| Most frequent Powerball | **14** | 68 | 55 |

There is no exploitable pattern. The chi-square p-values are 0.18 for white balls and 0.51 for the
Powerball, so the counts are as uneven as random draws normally are. Playing the "hot" numbers
scored 0.36–0.39 matches per draw against 0.36 by chance. Sums, odd/even splits and consecutive
pairs all match the theory. Every ticket, including 21 28 32 61 64 + PB 14, has the same
1-in-292,201,338 jackpot odds.
