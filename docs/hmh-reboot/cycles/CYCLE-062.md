# HMH AAA Continuous Improvement Cycle 062

Date: `2026-08-17`
Status: `WAVE 10 FLANKER ROLE DEPTH INTEGRATED · LIVE BROWSER EVIDENCE · PRODUCTION/WEB3 UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `6015c2a2`

## Bounded slice

Close the last named Wave 10 role gap from the 2026-08-13 closeout: give the flanker a navgrid-validated lane on the existing stable-side contract. No second nav or movement authority, no archetype/speed/damage/tell changes.

## The defect

The flanker was the only steering branch that never consulted the navgrid:

| Branch | Nav contract |
| --- | --- |
| hazard | `sampleHazardAwareDirection` — validated walkable |
| cover | `sampleCoverDirection` — validated walkable |
| chokepoint (Cycle 050) | `sampleChokepointDirection` — validated walkable |
| flanker | raw perpendicular blend, no nav call |

```js
direction = normalize(direct.x * 0.55 + tangent.x * 0.9, direct.y * 0.55 + tangent.y * 0.9);
```

That vector was computed without asking whether the lane was walkable, so a flanker could commit into a blocker and fall through to generic stuck recovery. Measured across a 60-position sweep on the authored level, the raw blend aimed into a blocker in **6** cases; the validated lane aims into one in **0**.

`stableSign(enemy.id)` already split flanker sides, so side-oscillation was never the gap. That hypothesis was tested and rejected before implementation.

## Implementation

`sampleFlankLaneDirection(grid, fromX, fromY, targetX, targetY, { stableSide, maxCells })` in `enemy-navgrid.mjs` mirrors the existing sampler contract and is the inverse of cover on the same lateral geometry:

- candidate must be walkable;
- candidate must be reachable without crossing a blocker;
- the player must stay **exposed** from the lane, where cover requires the opposite;
- the lane must not be a retreat;
- the enemy's own stable side is tried first, the opposite side is a fallback;
- returns `null` when no legal lane exists.

`enemy-simulation.mjs` consumes it in the flanker branch at the identical blend ratio, swapping only the unvalidated tangent for the validated lane vector. Priority remains hazard > cover > chokepoint > flank lane, the lane is skipped during committed tells, and when the sampler returns `null` behaviour is byte-identical to before.

### A false green worth recording

The first implementation passed `19/19` while doing nothing. The retreat guard was `hypot(target -> player) > magnitude`, but a perpendicular lane **always** lengthens the player vector, so every candidate was rejected and the lane never fired. The integration test passed silently through its fallback branch.

It was caught by instrumenting branch counts rather than trusting the green: `laneSeeking=0, fallback=60, velocityChanged=0`. Corrected with a bounded widening factor:

```js
export const MAX_FLANK_WIDENING = 1.25;
```

After the fix: `laneSeeking=59, fallback=1, velocityChanged=59`.

The tests were then rewritten to be non-vacuous. They now assert that the lane branch is taken, that the fallback branch is also exercised, that the raw blend demonstrates the defect, and that a validated lane never steers into a blocker. A conditional assertion that can pass through its else-branch is not coverage.

## Telemetry

`flankLaneSeeking` / `flankLaneTarget` on the intent, an aggregate `flankLaneSeeking` count on the population step, and `dataset.enemyFlankLaneSeeking` on the stage. Read-only evidence, added only because the behaviour is actually integrated. The aggregate resets to zero with no navigation.

## Verification

- `npm run check`: **PASS**, `347` JavaScript modules + `49` Python scripts.
- Focused suites (`enemy-simulation`, `enemy-navgrid`, `encounter-director`, `enemy-role-detail`, `enemy-endurance-soak`): **PASS** `69/69`.
- `npm run bench:hmh:enemies`: **PASS** — `sameSeedEqual: true`, `differentSeedDiverged: true`, `oneVsFourFixedStepFramesEqual: true`, `teleportViolations: 0`, `candidateReductionPct: 90.45`.
- `npm run test:release`: **PASS**, `2,229` evaluated = `2,178` passed + `51` exact expected legacy failures.
- `npm run build`: **PASS**, HMH initial JS `944.1 KB / 1.00 MB`, headroom `81.2 KB` (slice cost ~`1.9 KB`).
- `npm run visual:reboot`: **PASS**, 12 scenes `meanDelta=0 / maxDelta=0 / changedCells=0`.
- `npm run smoke:hmh:enemy-endurance -- --seconds=30`: **PASS** both profiles, `128` bodies.
- `npm run repo:health:strict`: **PASS**. `npm run docs:production`: **PASS**.

### Live browser evidence

Neither existing gate can evidence this behaviour: the twelve visual scenes never capture a flanker mid-lane, and the endurance soak does not sample flank telemetry. `scripts/hmh-reboot-flank-lane-browser-smoke.mjs` reads the aggregate off the running stage and fails closed on a zero peak.

`npm run smoke:hmh:flank-lane -- --seconds=20`: **PASS**

| Profile | Samples | Ticks advanced | Bodies | Flank lane peak | Console errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| desktop 1440x900 | 76 | 1,190 | 128 | **24** | 0 |
| mobile 390x844 | 76 | 1,187 | 128 | **24** | 0 |

The new script was added to the explicit `syntax-check.mjs` list. It had silently escaped the gate on first run — the module count staying at `346` after adding a file is what exposed it. The gate is explicit by design precisely so this cannot happen; the count is now `347`.

## Boundaries preserved

- Fixed 60 Hz simulation and four-step catch-up unchanged.
- Canonical collision, traversal, elevation, bounds, stuck recovery, attack tokens, and hazard damage still execute every tick.
- Committed attack tells are never overridden by a lane.
- Projection-only rule intact; no art, VFX, or audio change.
- `SETTLEMENT_LIVE=false` unchanged. No push, no promote, no deployment.
- Production remains `dpl_Hm2bB5eEgnr6VvacT9xWU7SxVRJr` / `lesters-arcade-v18-hmh-mobile-character-start`.

## Best next slice

The suppressor/demolition/support branch at `enemy-simulation.mjs` has the identical no-nav problem — it blends `tangent` without validation in exactly the same way the flanker did. `sampleFlankLaneDirection` is likely reusable there with a different preferred distance, which would close the last unvalidated steering path without adding a fourth sampler.
