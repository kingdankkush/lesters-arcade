# HMH AAA Continuous Improvement Cycle 059

Date: `2026-08-17`
Status: `LOCAL WAVE 11 LIQUIDATOR COVER COUNTERPLAY · EXACT-INDEX CERTIFIED · COMMIT PENDING · NOT PUSHED · NOT PROMOTED`
Branch: `reboot/hmh-aaa-continuous`
Based on: `6bf8faf4` (Cycle 058 melee/crowd-control matrix)

## Bounded slice

Close the smallest remaining Wave 11 positional-mechanic gap without rewriting the Liquidator: locked line attacks now respect existing authored combat cover through the shared height-aware line-of-sight authority.

This crosses boss attack resolution, authored Level One blockers, runtime damage routing, deterministic tests, and desktop/mobile browser evidence. It does not change the boss timeline, tell geometry, damage values, phase thresholds, RNG, movement, collision, weapon multipliers, parent authority, or Web3 state.

## TDD evidence

The first focused run after adding the contract failed exactly as expected:

```text
node --test tests/hmh-reboot-liquidator-boss.test.mjs
17 passed / 2 failed
```

Failures proved that a tall `combatCover` blocker did not yet stop a locked `crash-lane` hit and that malformed blocker lists were silently ignored.

The completed focused boss suite passes `20/20`, including:

- tall authored combat cover blocks line pressure and reports the stable blocker ID;
- the locked tell geometry remains unchanged;
- non-cover props do not become shields;
- blockers below the 24-unit attack ray do not become full-height shields;
- malformed blocker collections fail closed;
- the real `town-east-lean-to` in the Liquidation Market protects a far-lane player from the canonical arena origin;
- existing 60/30/20 partition invariance, phase events, safe zones, adds, role checks, punish windows, defeat, and runtime authority remain green.

## Implementation

- `apps/hmh-reboot/src/liquidator-boss.mjs`
  - `resolveLiquidatorAttack(...)` accepts a bounded blocker list.
  - Only locked line geometry uses cover resolution.
  - Only solid authored `combatCover` participates.
  - The shared `traceHeightAwareLineOfSight(...)` resolver supplies deterministic height-aware blocker truth.
  - A blocked hit returns `{ hit: false, damage: 0, reason: 'cover', blockerId }`.
- `apps/hmh-reboot/src/main.mjs`
  - The live boss resolution path passes canonical `WORLD_BLOCKERS`; no second world or collision authority was added.
- `tests/hmh-reboot-liquidator-boss.test.mjs`
  - Adds synthetic height/policy edge cases and a real authored-world integration case.
- `scripts/hmh-reboot-combat-browser-smoke.mjs`
  - Replaces stale hard-coded `38` blocker assertions with the canonical world count (`42`).
  - Captures the required mobile opening enemy roster before the smoke intentionally kills an enemy for death-visual evidence, while retaining bounded post-combat roster checks.

## Verification

| Gate | Result |
|---|---|
| Focused Liquidator boss tests | PASS `20/20` |
| Liquidator boss/build/phase focused set | PASS `31/31` before the final authored-world case; final boss file PASS `20/20` |
| `npm run check` | PASS `344` JS + `49` Python |
| `npm run test:release` | PASS `2,219 = 2,168 passed + 51 exact expected legacy failures` |
| `npm run build` | PASS |
| `npm run contracts:check` | PASS |
| `npm run design:third-party-security` | PASS `3/3` |
| desktop/mobile/world-tour combat browser smoke | PASS; zero console/page errors |
| `npm run audit:hmh:network` | PASS; `215` responses across four scenarios, zero HTTP/request/console/page errors |
| `npm run visual:reboot` | PASS `12/12`; every scene `meanDelta=0`, `maxDelta=0`, `changedCells=0` |
| `npm run smoke:hmh:performance` | PASS desktop/mobile; no runtime long tasks or errors |

Browser performance evidence at the current candidate build:

| Profile | Average | P95 | P99 | Max | Heap delta |
|---|---:|---:|---:|---:|---:|
| desktop | `7.916 ms` | `13.9 ms` | `14.0 ms` | `14.1 ms` | `+585,543 B` |
| mobile | `6.948 ms` | `7.0 ms` | `7.1 ms` | `8.9 ms` | `-25,773,915 B` |

Bundle accounting remains within the existing one-megabyte initial-JS cap:

- child entry: `389,007 B`;
- Pixi vendor: `575,891 B`;
- combined initial JS: `964,898 B`;
- headroom: `83,678 B`.

The first browser-smoke attempt exposed stale harness expectations (`38` blockers versus canonical `42`), and the second exposed a post-combat roster timing assertion after the same smoke had intentionally killed the Forkrunner. Neither was counted as PASS. The final repaired run passed desktop, portrait touch, and authored bridge-world evidence with zero errors.

The final frozen staged patch received a hash-bound independent offline review with verdict `PASS`, zero blockers, and zero suggestions. The local commit remained pending at documentation freeze; no timeout, partial transcript, failed hosted delegation, or hash-mismatched review was counted as approval.

## Authority and next seam

Production, Preview, aliases, rollback, `main`, wallets, contracts, settlement, transactions, paid/external services, asset uploads, and LitVM writes were untouched. `SETTLEMENT_LIVE=false` remains intact.

Best next bounded Wave 11 seam: add one deterministic phase-two safe-sector rotation that reuses the existing safe-zone telegraph/resolution contract, then prove locked geometry, partition invariance, desktop/mobile readability, and ordinary-weapon viability without broad boss-AI changes.
