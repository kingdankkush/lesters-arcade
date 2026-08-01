# HMH AAA Continuous Improvement Cycle 043

Date: `2026-08-01`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: Cycle 042 (terrain fidelity)

## Scope: MAP-REDO slice 3 — enemy navgrid pathing

Owner playtest: "Enemy AI behaviors and pathing is terrible not knowing how
to move around walls." Root cause confirmed in audit: `planEnemyIntent`
steered straight at the player (with role modifiers) and the swept collision
just stopped or slid enemies on blockers — no routing.

### What shipped

1. **`enemy-navgrid.mjs`** (new SIMULATION module):
   - `createEnemyNavGrid` — a 60-unit cell grid (200×80) over the authored
     world contract. A cell is unwalkable when a 3×3 sample lattice
     intersects any blocker inflated by an 18-unit enemy clearance (the
     sub-cell sampling is what keeps radius-18 fences from slipping between
     cell centres), or when the centre sits in deep water. Directed edge
     legality runs through the canonical
     `resolveSweptTraversalPath` with the strictest movement limits across
     all ordinary archetypes (curb 8, drop 12, ascent 48), so one-way ledge
     drops propagate correctly and one shared field is legal for every role.
   - `computeEnemyFlowField` — integer BFS outward from the player's cell;
     expansion B→A requires the directed edge A→B (an enemy at A must be
     able to step toward B). Fixed neighbour order, first-writer-wins ties:
     fully deterministic. Orthogonal steps only, so corner cutting is
     structurally impossible (locked by a test anyway).
   - `sampleFlowDirection`, `navLineBlocked` (supercover walkability
     raycast).
2. **`planEnemyIntent`** accepts optional `navigation`; when the direct line
   to the player crosses unwalkable cells, the base pursuit direction is the
   cell's flow direction instead. Role modifiers (flanker tangent,
   suppressor standoff) still shape the final heading. Without `navigation`
   the behavior is byte-identical to before — soaks and older tests are
   unaffected.
3. **`main.mjs` wiring** — the grid builds once at boot from authored data;
   the flow field refreshes every 30 ticks inside the fixed-step simulation,
   keyed to the tick counter, and feeds `stepEnemyPopulation`.

### Determinism and replay note

The grid derives only from the frozen world contract; the field derives from
the grid plus the player's simulated position on a fixed tick cadence. No
RNG, no wall-clock, integer BFS costs, fixed iteration order. Same build +
same seed still reproduces identical runs. This IS a versioned gameplay
change: replays recorded against pre-043 builds diverge from 043 playback,
as with any simulation change.

### RED-first evidence

`tests/hmh-reboot-enemy-navgrid.test.mjs` (6 tests) was written before the
module existed. The behavioral anchor: an enemy at `(1,950, 1,940)` with the
player across the relay gate fence closes to under 120 units in 10 simulated
seconds with navigation, versus wall-sliding alone which ends >100 units
further out; flow-field greedy-following crosses the map without ever
entering an unwalkable cell; construction and fields are deepEqual across
rebuilds.

### Review finding fixed post-commit

The exact-index review caught a restart-determinism BLOCKER: the flow field
lived in module state across `initializeSession`, so an in-game restart
inherited the previous run's field (steering blocked pursuit with stale
data) until the new run's tick counter caught up — same-seed runs diverged
fresh-load vs post-restart. Fixed by resetting `enemyFlowField` /
`enemyFlowFieldTick` at the top of `initializeSession`, with a source-guard
test. Two review notes carried as debt: the enemy soak and enemy-simulation
suites exercise the navigation-less path only (still byte-identical, but no
longer the shipped pursuit path), and the boot-time grid build (~410 ms
desktop, worse on low-end mobile) should move off the first-paint path — a
follow-up task chip exists for the lazy build.

## Gates

- check 338 JS + 49 Python PASS
- navgrid suite 6/6 (RED-first: module absent, then thin-fence and
  bridge-corridor defects surfaced by the tests during bring-up — cell size
  60 and 3×3 sub-cell sampling are what those failures bought)
- test:release `1,833 / 1,781 / 52 / 0`
- build: child bundle `1,036,322 / 1,050,000` bytes (~13.4 KB headroom;
  navgrid module ~4 KB)
- visual regression 8/8 after inspection (combat scene enemy positions
  shift — enemies now path; terrain scenes carry the corrected 512px bake)
- browser certification five profiles PASS
- combat, collectible (10 cases), mobile (4 devices) smokes PASS
- performance p95 `7 ms` desktop and mobile

## Production promotion (owner-approved "push live")

| Release fact | Verified value |
| --- | --- |
| Branch head deployed | `6d5bcd57` |
| Production deployment ID | `dpl_EFrNTXNpSWk4XmrAfgNcT78DCNUu` |
| Immutable production URL | <https://lesters-arcade-mmj4eu8uc-justin-agent-projects.vercel.app> |
| Public alias | <https://lestersarcade.io> |
| Live HMH bundle SHA-256 | `1e374765b3c771a8633c8ba95981863ae78030d4cd814496f7b20dea0842fc83` — byte-identical to the local build |
| Live terrain manifest | `hmh-terrain-tiles-v2`, 512px, painted |
| Live certification | five profiles PASS against the public alias |
| Rollback | `dpl_GCzM6feNQxWF4ye6ZCXDspk82Bvx` (Cycle 041 production) |

`SETTLEMENT_LIVE` untouched.
