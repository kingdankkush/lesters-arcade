# Lester's Arcade Session Analytics Balance Report

Generated: 2026-07-03T12:00:00.000Z  
Source: deterministic-local-prototype-sessions

## Summary

- Total runs: 5
- Ranked runs: 5
- Settled runs: 2
- Unique wallets: 5
- Global p50 score: 3800
- Global p90 survival: 701s

## Game balance table

| Game | Runs | p50 score | p90 score | p50 survival | p90 survival | Kills/min | Settled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hard Money Heroes | 3 | 6900 | 11380 | 388s | 806s | 8.52 | 2/3 |
| Chikun's Escape | 2 | 960 | 1136 | 89s | 102s | 0 | 0/2 |

## Balance flags

- **INFO** hmh-master-run-window: 6.5m p50 / 13.4m p90 — Hard Money Heroes sample sits inside the intended 5-minute average / 15-20 minute mastery window.
- **INFO** chikun-early-slice-sample: 2 run(s) — Chikun is a vertical slice; keep sample sizes separate from HMH balance calls.

## Recent samples

- game-session-000000201: lester-blaster, 3800 pts, 252s, trust=settled
- game-session-000000202: lester-blaster, 6900 pts, 388s, trust=prototype
- game-session-000000203: lester-blaster, 12500 pts, 910s, trust=settled
- game-session-000000204: chikun, 740 pts, 72s, trust=prototype
- game-session-000000205: chikun, 1180 pts, 105s, trust=prototype

## Action items

- Re-run `npm run design:session-analytics` after any balance-affecting change.
- Compare p50/p90 survival against the target HMH average/mastery window.
- Treat Chikun vertical-slice samples separately until it has a larger run population.
- Investigate suspicious/rejected trust rows before using them for tuning.
