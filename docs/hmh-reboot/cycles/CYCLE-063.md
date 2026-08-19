# HMH AAA Continuous Improvement Cycle 063

Date: `2026-08-17`
Status: `LOCAL WAVE 11 CRIT-UPGRADE BENCHMARK SEAM · REBASED ONTO CYCLE 062 · NOT PUSHED · NOT PROMOTED`
Branch: `grok/wave11-crit-upgrade-benchmark`
Based on: `bac9679e` (Cycle 062 flanker lane)

## Numbering

This slice was authored in parallel with Cycle 062 and originally numbered 062 on isolated branch `5cc99699`. Continuation landed the Wave 10 flanker as Cycle 062 at `bac9679e`. This note is the same seam, rebased and renumbered. Do not treat the old isolated 062 as a second flanker cycle.

## Bounded slice

Close the Priority C weapon-upgrade -> Liquidator benchmark gap named by Cycle 061 and the 2026-08-13 handoff: drive one existing crit card through the real first-level offer/selection contract into the existing fixed-tick combat resolver and Liquidator damage authority.

This is an evidence seam. It does not rewrite boss AI, add a second combat engine, import into `main.mjs`, or change offer hashing, weapon damage tables, role/punish multipliers, or parent/Web3 authority. It does not touch `enemy-navgrid.mjs` / `enemy-simulation.mjs`.

## Contract

`apps/hmh-reboot/src/liquidator-upgrade-benchmark.mjs` drives only existing authorities:

- `createRunProgression` / `grantRunXp` / `selectRunUpgrade`
- `resolveCombatHits`
- `stepLiquidatorBoss`
- `applyLiquidatorDamage`
- `getLiquidatorPunishWindow`
- `getLiquidatorRoleCheck`
- `createLiquidatorAddCandidates`

Canonical card: `precision-ledger` (`+6%` critical chance, cap `0.45` at the live hit site). Seed `1337` legally offers `{ precision-ledger, gas-optimization }` after the authored first-level `300` XP. Seed `0` does not offer it and fail-closes. Rank injection is rejected by construction — the seam calls `selectRunUpgrade` and throws `not currently offered` when the card is absent.

Per-tick pistol hits reuse the Cycle 055 ordinary-weapon identity (`coin-blaster` @ `4`, distance `200`) but now go through `resolveCombatHits` with the live `8% / 1.75x` base, then `applyLiquidatorDamage(damageApplied)`. Role stays `1`. Punish stays `1.1` on the 60-tick total-liquidation recovery window. Crit chance/multiplier constants are asserted against `main.mjs`.

## Measured outcomes at seed `1337`

| Mode | Chance | Defeated | Defeat tick | Crit hits | Ordinary hits | Punish | Adds |
|---|---:|---|---:|---:|---:|---:|---:|
| ordinary | 0.08 | yes | 2,837 | 217 | 2,620 | 60 | 3 |
| precision-ledger | 0.14 | yes | 2,721 | 371 | 2,350 | 60 | 3 |

Ordinary pistol still clears the one-minute fight (116 ticks later than the upgraded run). One Precision Ledger rank is a bounded spike, not a new baseline: crits stay well below ordinary hits. Same seed is byte-equal. One-step equals four-catch-up. Seed `14` also legally offers the card and diverges (`2,718` / `374` crits).

The health-only matrix baseline remains `2,994` because that seam never consults `resolveCombatHits`. This seam is the live combat path; the 157-tick gap versus the matrix is the authored `8%` crit table, not a regression.

## Verification

| Gate | Result |
|---|---|
| focused upgrade + Liquidator + progression set | PASS `56/56` at `5cc99699`; re-verified after rebase |
| `npm run check` | PASS at original landing; module count after rebase includes Cycle 062's flank-lane script plus this seam |
| `npm run test:release` | PASS `2,231 = 2,180 + 51` at `5cc99699` (7 new tests on top of Cycle 061). Cycle 062 added its own tests; the rebased ledger is the union |
| `npm run build` | PASS at original landing. New module is not in `dist/` (`upgrade-benchmark-liquidator` absent) |

No browser or visual smoke for this seam: `main.mjs` does not import the new module. Cycle 062's flank-lane browser evidence is independent.

## Authority

`SETTLEMENT_LIVE=false`. No push, promote, wallet, contract, or LitVM write. Child bundle is unchanged because the runtime entry does not import this seam.

## Best next slice

Wave 11 power-up audit before expansion: heal, caches, time dilation, berserk, nuke, stack/reset policy, boss safety, silhouette, audio, and telemetry. Do not add Block Shield / Fee Holiday / Flash Crash / Liquidity Magnet until that set is certified.

Wave 10 leftover (suppressor/demolition/support unvalidated tangent) stays with the flanker owner unless they decline it.
