# HMH AAA Continuous Improvement Cycle 064

Date: `2026-08-17`
Status: `RANGED-ROLE STEERING VALIDATED · LIVE BROWSER EVIDENCE · PRODUCTION/WEB3 UNCHANGED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `bac9679e`

Numbered `064` rather than `063`: Grok reserved `063` when renaming their crit-upgrade note after the earlier `062` collision. Reusing it would recreate the problem we had just resolved.

## Bounded slice

Close the last unvalidated steering path in `planEnemyIntent`. Cycle 062 fixed the flanker; suppressor, demolition, and support still steered without consulting the navgrid. Reuse the existing sampler and `lineBlocked` contract — no fourth navigation authority, no archetype/speed/damage/tell change.

## The defect: two holes, not one

```js
const near = distance < archetype.preferredDistance - 70;
const far = distance > archetype.preferredDistance + 90;
if (near) direction = { x: -direct.x, y: -direct.y };
else if (!far) direction = normalize(tangent.x * 0.82 + direct.x * 0.18, ...);
```

1. **Near-range backoff** drove straight away from the player with no check on what was behind it. This was the worse of the two: retreating into a wall reads as the unit bumping scenery while the player closes.
2. **Mid-range strafe** blended a raw perpendicular, identical to the flanker's old bug.

### Measurement correction

A first measurement sampled a single line of positions and reported an 82% backoff-blocker rate. That was an artifact of where the line ran, not a real rate, and it is recorded here so the inflated figure is not cited later.

A 2D sweep over walkable origins on the authored level gives the honest baseline:

| Path | Samples | Blocker aims | Rate |
| --- | ---: | ---: | ---: |
| near-range backoff | 217 | 24 | 11.1% |
| mid-range strafe | 193 | 11 | 5.7% |

## Implementation

Both paths reuse `sampleFlankLaneDirection` from Cycle 062 and the pre-existing `navigation.lineBlocked`:

- **Backoff:** probe one cell behind via `lineBlocked`. If that is blocked and a legal lane exists, sidestep along the lane instead. Otherwise keep the original backoff vector.
- **Strafe:** substitute the validated lane for the raw tangent at the identical `0.82 / 0.18` blend ratio, or keep the original blend when no lane exists.

Lanes are skipped during committed tells. Priority order is unchanged: hazard > cover > chokepoint > role steering. `RANGED_BACKOFF_PROBE_DISTANCE = 60` is one navgrid cell.

`flankLaneSeeking` telemetry is reused rather than duplicated. It means "using a validated lateral lane," which is exactly what these roles now do.

## Result, stated precisely

Across `1,671` swept samples over the three ranged archetypes:

| Steering | Blocker aims | Rate |
| --- | ---: | ---: |
| unvalidated (before) | 58 | 3.5% |
| validated (after) | 24 | 1.4% |

A **59% reduction, not elimination.** Unlike the flanker — which reached zero — this path can still aim into a blocker when the backoff is blocked *and* no legal lane exists. In that case it deliberately falls back to the prior vector rather than inventing motion or freezing the unit. Do not describe this slice as removing the behaviour.

## Verification

- `npm run check`: **PASS**, `347` JavaScript modules + `49` Python scripts.
- Focused suites (`enemy-simulation`, `enemy-navgrid`, `encounter-director`, `enemy-role-detail`, `enemy-endurance-soak`, `enemy-attack-presentation`): **PASS** `75/75`.
- `npm run bench:hmh:enemies`: **PASS** — `sameSeedEqual: true`, `differentSeedDiverged: true`, `oneVsFourFixedStepFramesEqual: true`.
- `npm run test:release`: **PASS**, `2,231` = `2,180` passed + `51` exact expected legacy failures.
- `npm run build`: **PASS**, HMH initial JS `944.5 KB / 1.00 MB`, headroom `80.9 KB` (slice cost ~`0.4 KB`).
- `npm run visual:reboot`: **PASS**, 12 scenes at exact zero delta.
- `npm run smoke:hmh:enemy-endurance -- --seconds=30`: **PASS** both profiles, `128` bodies.
- `npm run repo:health:strict`: **PASS**. `npm run docs:production`: **PASS**.

### Live browser evidence

`npm run smoke:hmh:flank-lane -- --seconds=20`: **PASS**

| Profile | Bodies | Lane peak, Cycle 062 | Lane peak, now |
| --- | ---: | ---: | ---: |
| desktop 1440x900 | 128 | 24 | **68** |
| mobile 390x844 | 128 | 24 | **69** |

The jump is the evidence. Ranged roles emit the same aggregate, so a peak that stayed at `24` would have meant the ranged branch was not resolving lanes in the live runtime and the slice was passing on unit fixtures alone.

## Boundaries preserved

- Fixed 60 Hz simulation and four-step catch-up unchanged.
- Canonical collision, traversal, elevation, bounds, stuck recovery, and attack tokens still execute every tick.
- Committed attack tells are never overridden by a lane.
- No new navigation authority; both fixes reuse Cycle 062's sampler and the existing `lineBlocked`.
- `SETTLEMENT_LIVE=false` unchanged. No push, no promote, no deployment.
- Production remains `dpl_Hm2bB5eEgnr6VvacT9xWU7SxVRJr` / `lesters-arcade-v18-hmh-mobile-character-start`.

## Best next slice

Every steering branch in `planEnemyIntent` now resolves through a validated contract, so Wave 10 role depth is closed. The residual 1.4% is the honest remainder: cases where no legal lane exists. Reducing it further needs a wider candidate search or a hold-position behaviour, and both change movement character — they warrant their own measured slice and an owner call on whether a ranged unit should ever stop rather than back into cover.
