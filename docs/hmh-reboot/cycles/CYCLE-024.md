# HMH AAA Continuous Improvement Cycle 024

Date: `2026-07-27`
Status: `LOCAL GATES PASSED · PUSHED · PRODUCTION PROMOTION PENDING`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `52db1be3`

## Scope: playtest defect, character and enemy model detail

Third and final item from the human playtest that drove Cycles 022 and 023:

> "The character models and enemy models are smooth moving I suppose, but not
> very detailed."

## What changed

### Geometry

The roster bodies were built from a torso, hips, a bare sphere head and four
limb boxes. Limbs ended in flat stumps, the head had no features, and there
was no gear. Added to the shared parametric builder, so every actor benefits:

- **Head**: brow ridge, jaw, recessed eye sockets and a crown/hood mass. A bare
  sphere read as a featureless ball at gameplay scale, which was most of why
  the roster looked undetailed.
- **Hands** at the forearm ends and **shoulder caps** at the deltoids.
- **Boots** with a forward toe box, so a leg reads its ground contact.
- **Gear**: a belt with buckle and two chest harness straps, breaking up the
  torso slab.

### Projection reconciliation

The roster rendered at a **45-degree** camera pitch while the certified hero
pipeline uses **55**, so heroes and enemies did not sit in the same projection.
This was carried debt from Cycle 006. The roster camera is now derived from
`cameraPitchDegrees` (55) with the distance solved so the view ray still meets
the actor mass, and heroes and enemies finally share one projection.

### Resolution and budget

Frame size raised 128 -> 160px for the rank and file. Lighting softened (key
330 -> 235, fill 120 -> 95, rim 190 -> 165, world 0.55 -> 0.42, exposure
-0.15 -> -0.35) because the brighter skin palettes were blowing out to near
white.

Two budget gates fired and were respected rather than raised:

1. The shelf packer refused tighter framing (ortho 1.95, then 2.18) because
   152 frames no longer fit a 2048 atlas. Framing was returned to the
   packing-safe 2.35 rather than doubling texture memory to 4096.
2. `assets:qa:hmh-reboot` then failed: the boss atlas hit 2.6 MB against a
   2 MB per-actor budget, because the boss carries **three** phase silhouettes
   and so three times the frames. Rather than raise the budget, per-actor
   `frameSize` support was added and the boss renders at 128px while the rank
   and file stay at 160. Its pivot is scaled with the frame so ground contact
   is unchanged.

Total roster atlas bytes: 6,096,221 across 7 actors, 1,368 frames, all
pixel-unique, `reproducibleVerified: true`.

## Preserved invariants

- Projection-only. Collision radius, damage, AI, spawn order and results still
  come from `enemy-archetypes.mjs`; only silhouettes, materials and camera
  changed.
- Every actor still reads as a human survivor or a zombie, enforced by test.
- Atlases remain lazy-loaded per archetype — a run fetches only the archetypes
  it spawns, not all seven.

## Gates

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 332 JS modules + 49 Python scripts |
| `npm run test:release` | PASS — `1733 / 1681 / 52 accepted / 0 unexpected` |
| `npm run build` | PASS — HMH bundle 993.2 KB, under gate |
| `npm run assets:hmh:enemy-roster:verify` | PASS — reproducible, 1368 frames, 0 duplicates |
| `npm run assets:qa:hmh-reboot` | PASS — after the boss frame-size fix above |
| `npm run visual:reboot` | 8/8 unchanged — enemies are not in the certified scene framings |
| `tests/hmh-reboot-enemy-roster-atlas.test.mjs` | PASS — 9/9 |
| Chrome five-viewport certification | PASS |
| `smoke:portal:e2e` | PASS — six flows |
| `smoke:hmh:performance` | PASS — p95 unchanged |
| `smoke:hmh:collectibles`, security, repo health, docs links | PASS |

## Known debt

- Bodies are still primitive-composed rather than sculpted; this raises detail
  substantially but is not hand-modelled character art.
- Hero atlases were not re-rendered this cycle; they already run at 160px/55
  degrees, but their materials were not retuned alongside the roster.
- Boss phases differ by silhouette but still share one body build.

## Deployment

Pushed to `reboot/hmh-aaa-continuous`. As recorded in Cycle 023, pushing this
branch produces a **Preview** deployment only; promotion to production is a
separate manual step requiring Vercel dashboard or authenticated CLI access,
which this checkout does not have.
