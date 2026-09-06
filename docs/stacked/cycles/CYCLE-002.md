# STACKED Cycle 002 — deterministic placement engine

Date: 2026-09-06

Cycle: S-02

Branch: `feature/stacked-solo`
Implementation base: `64ba50c18c2b93bc2d277c25610f7cb9888d8f67`

## Implementation boundary

The DOM-free placement engine now owns the y-up 10×24 board, seven frozen piece geometries,
quarter-turn and 180-degree kick tables, spin classification, unbiased 7-bag randomization,
queue and hold discipline, integer Q16 gravity, soft/hard drop handling, lock delay, edge-detected
input precedence, deterministic snapshots, state hashes, and exact tick-ceiling lifecycle.

The contract wins over the lower-precedence refill prose: the initial queue consumes two bags and
another bag is drawn after every seventh spawn, so `bagRefills === 2 + floor(piecesSpawned / 7)`.
STACKED uses the new rejection-sampled `nextBelow()` path; the existing seeded-RNG float stream and
draw-count semantics remain unchanged.

This cycle does not implement line clears, scoring, rising-ledger application, evidence codec,
portal integration, rendering, saves, browser gates, settlement, or deployment. Those remain later
cycles. No production-only test loading hook or mutable board escape was added.

## Verification

- Strict TDD RED: missing `uint32`, `nextBelow`, placement module, and purity audit produced 5
  intended failures while the 11 pre-existing RNG tests passed.
- S-02 repair RED: the seed-5 hold replay failed with `piecesSpawned === 8` instead of `5`, and
  the frozen seed-48 replay failed with `lowestYReached === 16` instead of `15` after its final
  downward kick. Both failures were recorded before their production fixes.
- S-02 repair GREEN: 84 focused tests passed (the independently confirmed 76 plus eight new
  acceptance tests), with 0 failures, 0 skipped, and 0 todo. Coverage now proves legal witnesses
  for all 104 kick offsets, four-direction immobility including up, unconditional O behavior,
  opposing-horizontal release, separate hard-over-soft and hold precedence, rejected grounded
  hold timing, integer Q16 movement, grounded countdown, reset-cap exhaustion, and lowest-Y reset.
- S-02 final-review RED: four level-14 seed-5 regressions failed because successful hold skipped
  the complete gravity phase. Hold-only, hold+hard, and hold+hard+soft left the incoming O at
  `y === 18` instead of `17`; hold+soft also left it at `18` instead of applying soft drop.
- S-02 final-review correction selects one drop phase per tick. A hard-drop edge without successful
  hold hard-drops and ends the tick; otherwise gravity runs, with the soft bit stripped only when
  successful hold suppresses a simultaneous hard-drop edge. This preserves hold-before-hard and
  hard-over-soft together without applying gravity to a piece spawned after a lock.
- S-02 final-review GREEN: all prior 84 focused tests plus the four explicit priority regressions
  passed (`88 / 88`, 0 failures, 0 skipped, 0 todo). RED/GREEN logs are under
  `.tmp/stacked-s02/final-fix/`.
- Queue-draw accounting now distinguishes a fresh queue draw from reactivating a held piece.
  The frozen contract takes precedence over lower-spec prose: normal queue occupancy is 7..14 and
  `bagRefills === 2 + floor(piecesSpawned / 7)`.
- The downward-kick counterexample is frozen at
  `tests/fixtures/stacked-downkick-counterexample.json` and uses only public masks, with no state
  injection or production test-state hook.
- Executable purity passed: 10 banned tokens absent and exactly 2 imports allowed.
- An early worker was restricted to focused checks; its attempted repository-wide check was
  rejected by that worker's scoped boundary. This was not a user prohibition on full verification.
- The lead subsequently ran all eight checks on the final candidate. Focused tests passed
  **88/88**, with zero skips and todos. `design:stacked-purity`, `check`, `test:release`,
  `vercel:build`, `assets:verify`, and `repo:health:strict` all passed.
- Raw `npm test` returned 2640 tests: 2589 passed and the exact 51 pre-existing retired HMH
  failures remained. Failure names were compared programmatically against the clean baseline:
  **zero new failures**, no new retirement entries, no skipped tests.
- The independent final reviewer approved frozen patch
  `62d83f217c726c2484c000bd319e8506f4dc53afdc5c3dbcc1718dbdf1cc02dd` with no blockers.
  Runtime/test/build source remained unchanged afterward. Generated file-inventory and
  retirement-count receipts were refreshed by the successful gates.
- Durable evidence: `CYCLE-002-verification.json`. Raw execution logs remain under
  `.tmp/stacked-gates/S02/20260906T233128Z/`. Earlier RED/GREEN artifacts remain in
  `.tmp/stacked-s02/`.

## Honest visual note

There is no renderer or cabinet in S-02. No screenshots, browser runs, responsive checks, or visual
quality claims are applicable. The evidence is Node execution of the pure simulation only.
