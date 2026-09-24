# Bot arena (2026-09-24)

Complete games inside the engine. The level under test sits at a different seat each game. Win = lowest total at the end (a tie shares it); loss = highest total. With four players, an equal player wins and loses 25% of the time.

| Matchup | Games | Wins (±95%) | Losses (±95%) | Average rank | Verdict |
|---|---|---|---|---|---|
| A: one hard vs three medium | 400 | 52.1% ± 4.9% | 3.8% ± 1.9% | 1.70 | ✅ clearly better |
| B: one medium vs three easy | 1500 | 45.3% ± 2.5% | 10.3% ± 1.5% | 1.92 | ✅ clearly better |
| C: one easy vs three placeholder bots | 1500 | 55.7% ± 2.5% | 6.6% ± 1.3% | 1.71 | ✅ not worse |
| D: one hard vs three easy | 300 | 65.8% ± 5.4% | 1.0% ± 1.1% | 1.42 | for information |

## Picking: the picker's own score in the contracts it chose

| Level | dineri | damet | pli | farcha | ray | general | trix | ×4 last picks | All picks |
|---|---|---|---|---|---|---|---|---|---|
| medium | 39 | 43 | 48 | 18 | 63 | 207 | -38 | 289 (177) | 54 (11963) |
| hard | 23 | 32 | 45 | 12 | 39 | 108 | -47 | 86 (27) | 43 (2809) |
| easy | 46 | 43 | 44 | 60 | 58 | 249 | -45 | 194 (847) | 69 (32478) |
| placeholder | 46 | 43 | 41 | 64 | 54 | 497 | -38 | 497 (1615) | 65 (26972) |

## Hard's thinking time per move

81597 moves: median 0.4 ms, 99th percentile 3.0 ms, slowest 17.8 ms. Under 30 ms: 100.0% ✅.

Run time 204 s. All checks passed.
