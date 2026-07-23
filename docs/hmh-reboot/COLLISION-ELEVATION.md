# HMH Reboot Collision, Elevation, and Traversal Contract

Status: `reboot-07` implementation contract

## Authoritative fixed-step order

Every 60 Hz simulation step follows one deterministic order:

1. Read the canonical input snapshot.
2. Query the current authored ground surface.
3. Derive a restrained terrain/slope speed multiplier.
4. Integrate player acceleration, velocity, recoil, and enemy pressure into a candidate planar delta.
5. Resolve the candidate with swept-circle static collision and world-boundary collision.
6. Preserve tangential motion for obstacle sliding.
7. Sweep the collision-resolved path through authored traversal surfaces so narrow water, ramps, and ledges cannot be skipped.
8. Publish one final `(x, y, groundZ)` sample to the actor state.
9. Render interpolation and camera smoothing consume that state but never write back into it.

Pixi display objects are presentation only. Collision and elevation never read sprite bounds, transforms, or render-time interpolation.

## Coordinate and body model

- `x`: right
- `y`: down
- `z`: up
- Actor collision uses a ground-contact circle plus an explicit vertical interval.
- Static blockers use circles, capsules, or convex polygons plus explicit `minZ` and `maxZ` intervals.
- Regular enemy bodies remain soft pressure bodies.
- Boss bodies remain hard contacts with deterministic tangent escape.

## Authored collision truth

Every solid blocker must reference visible presentation metadata through `visibleAssetId` or `terrainBoundaryId`. Every visible hard barrier must reference at least one collision blocker. `auditCollisionWorld()` rejects mismatches.

The runtime uses the same authored blocker collection for:

- swept collision,
- visible graybox geometry,
- debug blocker IDs,
- height-band filtering.

The finite world edge is visible and radius-aware. High-speed movement cannot tunnel through circles, capsules, convex polygons, chained obstacles, or world bounds.

## Depenetration and sliding

- Initial overlap is resolved deterministically before requested movement.
- Blockers are processed in stable ID order.
- Earliest-time ties use stable blocker IDs.
- Remaining motion is projected onto the contact tangent.
- Inward locomotion and recoil velocity are removed after contact.
- Telemetry records collision iterations, repeated zero-displacement frames, depenetration, and the contacted blocker ID.

## Authored elevation surfaces

Supported surfaces:

- ground,
- continuous ramps,
- stairs,
- ledges,
- shallow water,
- deep water,
- bridge decks.

Every surface requires `visibleTerrainId`. Priority controls intentional overlap, such as a bridge deck above deep water. Ramp/stair height is continuous along its authored axis and returns a truthful surface normal.

Deep water is non-walkable unless a higher-priority bridge or legal traversal surface covers the route. Elevated bridge decks require visible approach ramps or visible curb metadata. Invisible upward steps are rejected.

One-way ledges:

- permit only the authored downward direction,
- never permit upward cliff climbing,
- reject unmarked large drops.

## Movement, projectiles, LOS, and AI

- Uphill movement receives a restrained slowdown.
- Downhill movement receives only a small bounded gain.
- Shallow water slows movement.
- Deep water blocks traversal.
- High-ground range and knockback modifiers are bounded by authored height layers.
- Projectile height bands can pass low cover while colliding with taller cover.
- Height-aware LOS interpolates projectile height along the swept planar path.
- Enemy route candidates use the same legal traversal transition contract as player movement.

These systems are pure deterministic modules so future projectile, AI, and director phases can reuse one source of collision and traversal truth.

## Debug mode

Use `?debugGrid=1` on the child runtime.

The overlay and stage diagnostics expose:

- player body radius,
- last contact normal,
- blocker ID,
- zero-displacement count,
- current surface ID,
- physical `groundZ`,
- traversal result,
- sampled world height labels.

Debug rendering is read-only and never enters replay state.

## Verification gates

`reboot-07` requires:

- collision unit tests,
- elevation/traversal unit tests,
- movement/world-space regressions,
- deterministic repeat checks,
- standalone and embedded browser smoke,
- build and bundle budget checks,
- exact legacy-retirement ledger comparison,
- security audit,
- independent read-only diff review.

Production replacement and deployment remain prohibited until the explicit `reboot-19` approval gate.
