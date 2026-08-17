# HMH AAA Continuous Improvement Cycle 065

Date: `2026-08-17`
Status: `CANONICAL CRIT-UPGRADE → WEAPON → LIQUIDATOR BENCHMARK CERTIFIED · PRODUCTION/WEB3 UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `47326841`

## Bounded slice

Close the Priority C gap named by the 2026-08-13 continuation handoff: route one existing legal run-upgrade offer and selection through the canonical weapon cadence/reload authority, seeded combat critical resolver, Liquidator role/punish policy, and deterministic boss damage target.

This is a read-only certification seam. `main.mjs` does not import it. It does not change live weapon values, upgrade offers, boss AI, collision, damage authority, bundle startup, parent authority, or Web3 state.

## RED and parallel-work reconciliation

The focused test first failed with `ERR_MODULE_NOT_FOUND` for `critical-liquidator-benchmark.mjs`.

Two isolated branches already contained competing versions of this idea. They were inspected rather than overwritten:

- `grok/wave11-crit-upgrade-benchmark` (`b1834262`) legally selected Precision Ledger and used `resolveCombatHits`, but injected one boss hit every fixed tick instead of consuming `stepWeaponLoadout`; it therefore did not prove real pistol cadence/reload behavior and was not integrated.
- `hermes/wave11-crit-liquidator-benchmark` (`755d85f8`) used `stepWeaponLoadout` and supplied useful read-only prior art, but it predated Cycles 062/064 and did not exercise the authored final-phase punish multiplier or 60/30/20 partitions.

Cycle 065 implements the complete contract on current continuation HEAD without merging or modifying either worktree.

## Contract

`apps/hmh-reboot/src/critical-liquidator-benchmark.mjs` composes existing authorities only:

1. `createRunProgression` + `grantRunXp` produce the real first-level offer for seed `1337`: `precision-ledger` and `gas-optimization`.
2. The control legally selects `gas-optimization`; the crit build legally selects `precision-ledger`. Both are rank 1 from `selectRunUpgrade`, with no private rank injection.
3. `stepWeaponLoadout` owns Coin Blaster fire cadence, clip, and reload timing.
4. Each emitted shot routes through `resolveCombatHits` with the live `0.08 / 1.75x` base critical contract and the selected upgrade snapshot.
5. `getLiquidatorRoleCheck` and `getLiquidatorPunishWindow` are applied in the same order as the runtime before `applyLiquidatorDamage`.
6. `stepLiquidatorBoss` remains the phase/add timeline authority. The benchmark records only bounded aggregate outcomes.

The module is not imported by runtime `main.mjs`, so it cannot become a second gameplay authority.

## Measured one-minute outcomes

Seed: `1337`. Duration: `3,600` fixed ticks.

| Build | Selected card | Crit chance | Shots | Reload start/complete | Crit hits | Damage | Boss health | Punish contacts/damage | Adds |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mobility control | `gas-optimization` | 0.08 | 128 | 16 / 15 | 13 | 411 | 11,589 | 3 / 12 | 6 |
| crit | `precision-ledger` | 0.14 | 128 | 16 / 15 | 19 | 423 | 11,577 | 3 / 12 | 6 |

The one-rank uplift is `12` damage (`2.9%`) over this seeded one-minute window. It changes only critical outcomes: cadence, reloads, phase timeline, punish contacts, and add count remain equal. Ordinary pistol damage stays non-vacuous. Neither build falsely defeats the 12,000-health boss within one minute.

All three authored phases are exercised. Control phase damage is `133 / 138 / 140`; Precision Ledger is `137 / 142 / 144`.

## Verification

| Gate | Result |
| --- | --- |
| RED | `node --test tests/hmh-reboot-critical-liquidator-benchmark.test.mjs` failed on missing module |
| Focused benchmark | PASS `6/6` |
| Focused progression/weapon/combat/Liquidator regression | PASS `51/51` |
| Same-seed and render partitions | PASS; byte-equal at 60/30/20 Hz partitions |
| `npm run check` | PASS; `349` JavaScript modules + `49` Python scripts |
| `npm run test:release` | PASS; `2,237 = 2,186 passed + 51 exact expected legacy failures` |
| `npm run build` | PASS; entry `391,292`, Pixi vendor `575,891`, combined `967,183 / 1,048,576`, headroom `81,393` bytes |
| `npm run design:long-run` | PASS |
| `npm run visual:reboot` | PASS; 12 scenes exact `0 / 0 / 0` delta |
| Local browser network audit | PASS; four scenarios, zero HTTP/request/console/page errors |
| Browser performance | PASS; desktop/mobile p95 `7.0 / 7.0 ms`, p99 `7.1 / 7.1 ms`, zero steady-state long tasks/runtime errors |
| Production asset QA | PASS; 4 heroes, 7 enemy/boss atlases, 107 authored props within budgets |
| Security / third-party sandbox | PASS `5/5` findings `0`; PASS `3/3` |
| Web3 source audit / live readiness | PASS `9/9`; expected `PARTIAL 3/4` with hardened publication still blocked |
| Strict repo health / CDN gate | PASS; no destructive action |

The failed first network attempt at an absent default `127.0.0.1:8791` server is not counted as PASS. The audit was rerun against an explicitly started `apps/portal` origin on port `8899`, then the listener was stopped and verified closed.

## Boundaries preserved

- Fixed 60 Hz simulation and four-step catch-up unchanged.
- No gameplay, render, asset, schema, service-worker, bridge, parent, or runtime-entry change.
- Human/zombie-only canon unchanged.
- `SETTLEMENT_LIVE=false` unchanged.
- No push, deployment, promotion, external upload, paid service, wallet, signature, contract, transaction, settlement, or LitVM write.

## Best next slice

Begin the Wave 11 existing-power-up audit before expansion. The smallest safe vertical seam is deterministic lifecycle/boss-safety certification for heal, weapon caches, time dilation, berserk, and nuke: exact fixed-tick refresh/expiry and reset policy, capped refill/selection behavior, non-deleting Liquidator nuke behavior, bounded summary telemetry, and desktop/mobile pickup/expiry evidence. Do not add Block Shield, Fee Holiday, Flash Crash, or Liquidity Magnet until the existing set passes that contract.
