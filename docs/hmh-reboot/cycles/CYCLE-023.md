# HMH AAA Continuous Improvement Cycle 023

Date: `2026-07-27`
Status: `LOCAL GATES PASSED · PUSHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `70cf778b`

## Scope: playtest defect, pickup identification

Second accepted item from the same human playtest that drove Cycle 022:

> "it's also hard to tell what power-ups or weapon pick-ups are"

## Root cause

Authored pickup art already existed, but several silhouettes were
indistinguishable **from the camera the player actually uses**. Viewed at the
55-degree top-down pitch, `hash-rail-core` (double cone), `berserk-candle`
(cylinder + cone) and `nuke-liquidation` (cylinder + cone + fins) all read as
the same cone, and `bonus-life` — the most important pickup in the game to
identify instantly — was a sphere with a halo that read as a featureless
circle. The shapes differed in elevation but not in **plan footprint**, which
is what a top-down player sees.

## What changed

Reshaped the four worst-reading collectibles inside the existing authored-prop
Blender pipeline. No parallel pipeline was added: the art, manifest, atlas and
runtime wiring already existed and only the silhouettes were wrong.

| Pickup | Was | Now |
| --- | --- | --- |
| `bonus-life` | sphere + halo (a plain circle) | med-kit case with a bold cross on the lid |
| `hash-rail-core` | double cone (a diamond) | ribbed ammo cell with a lit terminal cap |
| `nuke-liquidation` | cylinder + nose cone | round bomb with four radial fins and a spark |
| `berserk-candle` | bare cylinder + flame | candle in a wide dish, giving a ringed footprint |

Each now has a distinct plan footprint — box, ribbed barrel, solid circle with
spokes, ring — so shape identifies the pickup before colour does.

## Preserved invariants

- Projection-only. Effect, amount, duration and weapon binding all still come
  from `collectible-system.mjs`; only `create-hmh-authored-props.py`
  silhouettes changed.
- Palettes, `runtimeScale`, asset ids, categories and the point-of-interest
  mapping are untouched, so placement and gameplay are unchanged.
- Regenerated with `--verify-reproducible`: the pipeline renders twice and
  requires byte-identical output. `uniqueSourceFrames: 29` of 29 assets.

## Gates

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 332 JS modules + 49 Python scripts |
| `npm run test:release` | PASS — `1733 / 1681 / 52 accepted / 0 unexpected` |
| `npm run build` | PASS — HMH bundle 993.2 KB, under gate |
| `npm run assets:hmh:authored-props:verify` | PASS — reproducible, 29/29 unique frames |
| `npm run assets:qa:hmh-reboot` | PASS — this gate initially **failed** because the first regeneration ran without `--verify-reproducible`; the gate was right and the pipeline was re-run properly |
| `npm run visual:reboot` | 8/8 unchanged — pickups are not in the certified scene framings |
| `design:security-audit` 5/5, `design:web3-audit` 9/9 | PASS |
| `repo:health:strict`, `docs:links` | PASS |
| Chrome five-viewport certification | PASS |
| `smoke:hmh:collectibles` | PASS — all nine effects, reset and timed expiry |
| `smoke:hmh:cockpit`, `smoke:hmh:performance` | PASS |
| `smoke:portal:e2e` | PASS — six flows |

## Evidence

- `.tmp/art-review/existing-pickups.png` — before, showing the cone collisions
- `.tmp/art-review/pickups-improved.png` — after, all nine distinguishable

## Not in this cycle

**Character and enemy model detail remains the outstanding playtest item.**
Bodies are primitive-built and render at 128px; raising this means more
geometry (face, hands, feet, gear), a better lighting rig and a higher render
resolution. The roster also still renders at a 45-degree camera pitch while
heroes use 55, so actors do not sit in exactly the same projection. That
reconciliation belongs with the same slice.

## Deployment

Pushed to `reboot/hmh-aaa-continuous`, which auto-deploys to production.
Human physical-device acceptance from the Cycle 021 handoff remains
outstanding and is not satisfied by automated viewport certification.
