# HMH AAA Continuous Improvement Cycle 055

Date: `2026-08-17`
Status: `LOCAL WAVE 11 BUILD-MATRIX SEAM · NOT PUSHED · NOT PROMOTED`
Branch: `grok/wave11-liquidator-build-matrix`
Based on: `a676e29b` (Cycle 054 hotfix merge)

## Bounded slice

Finish the smallest Wave 11 Liquidator baseline-versus-high/low-DPS build-matrix seam requested by `docs/handoffs/2026-08-13-hmh-production-closeout-next-session.md` and Cycle 053.

This is an evidence seam. It does not rewrite boss AI, add a second combat engine, or import into `main.mjs`. Child-bundle bytes are unchanged.

## Contract

`apps/hmh-reboot/src/liquidator-build-matrix.mjs` drives only existing authorities:

- `stepLiquidatorBoss`
- `applyLiquidatorDamage`
- `getLiquidatorPunishWindow`
- `getLiquidatorRoleCheck`
- `createLiquidatorAddCandidates`

Frozen profiles:

| Build | Weapon | `damagePerTick` | Distance | Role |
|---|---|---|---|---|
| `no-hit` | `coin-blaster` | 0 | 200 | none |
| `baseline` | `coin-blaster` | 4 | 200 | none |
| `high-dps` | `hash-rail` | 20 | 480 | rail-punish `1.15` |
| `low-dps` | `coin-blaster` | 2 | 200 | none |

Per-tick amounts match the existing `simulateLiquidatorDps` buckets so ordinary-weapon identity can be compared against the already-certified TTK table. Role and punish multipliers are applied to the amount before `applyLiquidatorDamage`, the same order as `main.mjs`.

## Measured outcomes at seed `1337`

| Build | Defeated | Defeat tick | Remaining | Punish contacts | Adds |
|---|---|---|---|---|---|
| `no-hit` | no | — | 12,000 | 0 | 6 |
| `baseline` | yes | 2,994 | 0 | 60 | 6 |
| `high-dps` | yes | 522 | 0 | 0 | 0 |
| `low-dps` | no | — | 4,788 | 60 | 6 |

Baseline dies six ticks earlier than the old 3,000-tick health-only sim because the 60-tick `1.1` punish window is now applied (`60 × 4 × 0.1 = 24`). High-DPS dies in `market-open` from Hash Rail role `1.15` (`20 × 1.15 = 23` → tick 522) and never reaches adds or punish. One-step and four-catch-up reports match. Same seed is byte-equal.

Multipliers remain `1.15` / `1.1`. Punish ticks stay `0–59` active / `60` inactive.

## Verification

| Gate | Result |
|---|---|
| focused build-matrix tests | 6/6 PASS |
| existing liquidator boss tests | 17/17 PASS |
| `npm run check` | PASS 344 JS + 49 Python |
| `npm run build` | PASS 942.0 KB / 1.00 MB, 83.4 KB headroom — unchanged vs Cycle 054 |
| `npm run test:release` | PASS 2,213 evaluated = 2,162 passed + 51 expected legacy |

No browser smoke. Claude owns post-merge visual/hero-selector certification of `afbff304`/`a676e29b` on the Desktop checkout. This worktree does not touch those files.

## Authority

`SETTLEMENT_LIVE=false`. No push, promote, wallet, contract, or LitVM write.
