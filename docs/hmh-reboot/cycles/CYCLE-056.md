# HMH AAA Continuous Improvement Cycle 056

Date: `2026-08-17`
Status: `LOCAL ENDURANCE PROBE HARDENING · NOT PUSHED · NOT PROMOTED`
Branch: `reboot/hmh-aaa-continuous`
Based on: `1c5dfee6` (Cycle 055 fast-forwarded onto continuation)

## Bounded slice

The 128-body browser endurance gate failed once on Claude's post-merge cert of `a676e29b` with mobile `["projectile pool was not exercised"]`, then passed on rerun with every other occupancy metric bit-identical. The assertion watches an instantaneous `projectileCount` peak that has only ever been `1`. On mobile the old probe fired a CDP touch drag every eighth loop and sampled once during a 100 ms hold.

This cycle does not weaken the assertion. It still fails if no projectile is observed. It stops depending on a one-sample window.

## Change

`scripts/hmh-reboot-enemy-endurance-browser-smoke.mjs`:

- `latchProjectilePeak(...)` polls `dataset.projectileCount` on animation frames for the fire hold.
- Desktop Space hold latches for 180 ms instead of sleeping 45 ms.
- Mobile touch fire runs every movement cycle, not every eighth, and latches for 220 ms.
- Occupancy records `latchedProjectilePeak`. The `<= 0` failure is unchanged.

No runtime, bundle, CSS, or boss change.

## Verification

Focused source contract in `tests/hmh-reboot-enemy-endurance-soak.test.mjs`: 5/5 PASS. Requires the latch helper and forbids `movementIndex % 8`.

`npm run smoke:hmh:enemy-endurance -- --seconds=30` at this source: **PASS** both profiles.

| Profile | Samples | Latched projectile peak | Bodies | P95 |
|---|---|---|---|---|
| desktop | 65 | 1 | 128–128 | 20.8 ms |
| mobile | 82 | 1 | 128–128 | 13.9 ms |

A first attempt after the latch-only change failed mobile with `only 40 samples` because the longer fire hold dropped below `seconds * 2`. That was a probe-cadence defect I introduced, not a runtime regression. Sampling after each fire phase restored the count. Projectile assertion was already satisfied on that first attempt (`latchedProjectilePeak: 1`).

Do not treat Claude's pre-change FAIL-then-PASS pair as promotion evidence. This slice is the hardening that pair asked for.
