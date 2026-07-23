# HMH Reboot Projectile and Hurtbox Foundation

Status: certified 2026-07-22
Scope: master-plan Phase 11 / `reboot-08` combat foundation

## Authority and update order

The isolated child simulation owns hurt targets, projectile positions, hit ordering, damage events, and target health. Pixi graphics consume previous/current projectile positions and resolved impact points only. The parent portal retains wallets, signing, contracts, settlement, persistence, profiles, achievements, scoring authority, and analytics authority through `hmh-bridge/v1`.

Fixed-step order in `apps/hmh-reboot/src/main.mjs`:

1. Snapshot previous actor and enemy ground contacts.
2. Resolve aim intent.
3. Resolve player movement, authored collision, traversal, and elevation.
4. Resolve enemy pressure and current enemy ground height.
5. Build immutable hurt targets.
6. Advance capped projectiles and resolve swept hits against current target state and authored combat cover.
7. Apply stable damage/death events.
8. Spawn eligible shots up to the 128-projectile cap.
9. Render interpolated actors, previous/current tracers, and impact feedback non-authoritatively.

## Concrete implementation map

| Checklist item | Implementation | Behavioral evidence |
| --- | --- | --- |
| Ground-contact body and separate hurt shapes | `createHurtTarget` in `projectile-physics.mjs` | independent circle/capsule validation and immutability tests |
| Broadphase at 100 and 150 enemies | `queryProjectileCandidates`, `UniformHurtboxGrid`, 64-target runtime switch | benchmark parity and timing; grid hook and batch-health tests |
| Previous/current projectile record | `createProjectileState` | immutable swept-position test and runtime tracer contract |
| Swept high-speed and moving-target collision | relative-motion circle/capsule sweep | fast bullet and frame-stall crossing tests |
| Elevation and cover policy | projectile Z interpolation plus explicit `combatCover` authored blocker flag | bridge-layer rejection and low-decoration/high-cover tests |
| Stop, pierce, ricochet, splash, pellet, and hitscan policies | `resolveProjectilePath` | stable ordering, reflected-path, blast-path, and no-duplicate tests |
| Target death during a batch | `resolveProjectileBatch` | earlier kill removes target from later projectile resolution |
| Straight muzzle correction | `correctMuzzleAim` | bounded one-time correction with no curved trajectory state |
| Runtime cap and pooling pressure | `MAX_ACTIVE_PROJECTILES = 128` with deterministic drop accounting | one-minute 150-target overload soak |
| Visible evidence | `projectileTrails`, `projectileImpacts`, explicit visible cover | desktop cover/hit and mobile screenshots plus Playwright state checks |
| Debug isolation | projectile datasets emitted only when `debugGrid=1` | normal-mode browser smoke |

## Broadphase decision

Command: `node scripts/hmh-reboot-projectile-benchmark.mjs`

| Targets | 2,000 scan queries | 2,000 grid queries | Speedup | Candidate parity |
| ---: | ---: | ---: | ---: | --- |
| 100 | 32.997 ms | 14.290 ms | 2.309x | exact |
| 150 | 40.788 ms | 10.359 ms | 3.938x | exact |

Runtime selection: bounded simple scan below 64 active targets; one 96-unit uniform grid per fixed tick at 64+ targets, reused by the batch. Candidate IDs are mapped back to current authoritative target state so grid objects never own health or death state. Splash and ricochet conservatively examine all capped targets because their secondary paths can leave the original segment AABB.

## Determinism and stress evidence

- Focused reboot tests: 144/144 passed.
- Projectile suite: 19/19 passed.
- Seeded property run: 20,000 cases at 150 targets; scan/grid candidate and full-resolution parity; repeat hash `8d88d351`; 5,331 resolved hits.
- One-minute overload soak: 3,600 fixed ticks, 150 targets, 458,688 projectile resolutions, peak 128 active, 6,720 deterministic drops, repeat hash `e57ed205`, 267,024-byte heap delta after GC.
- Existing simulation gates prove exact 60 Hz stepping, maximum four catch-up steps, partition-invariant replay, and low-FPS fixed-step collision invocation.

## Browser and visual evidence

Playwright smoke: `.hermes/tmp/hmh-phase8-projectile-smoke.mjs`

- Direct line of fire stopped on visible `concrete-divider`; target remained at 120 health.
- Authored route around the north rail and divider produced deterministic target damage.
- Projectile count remained within 128 and drop count remained zero under normal fire.
- Normal mode exposed no collision, traversal, ground, or projectile debug datasets.
- Touch controls remained visible and usable in mobile viewport.
- 1080p hit evidence contains player, straight tracer, impact ring, red target, and surrounding physical geometry.

Evidence files:

- `.hermes/evidence/hmh-reboot-phase8-projectiles/desktop-projectile-cover.png`
- `.hermes/evidence/hmh-reboot-phase8-projectiles/desktop-projectile-hit.png`
- `.hermes/evidence/hmh-reboot-phase8-projectiles/mobile-projectile-cover.png`

## Compatibility and security

- Renderer remains exactly `pixi.js@8.19.0`.
- `GAME_ID="hmh"`, `CABINET_ID="wo71"`, `lesters-arcade-save-v1`, schema 2, and `hmh-bridge/v1` remain unchanged.
- Security audit: PASS, 5/5 checks, zero findings.
- Contract structure, generated-asset verification, portal interaction smoke, build, repository health, and normal/debug browser gates passed.
- Full suite: 1,433 tests, 1,380 passed, exactly 53 failures. File and normalized assertion comparison against `LEGACY-TEST-RETIREMENT.json`: zero missing and zero unexpected failures.
- `assets:qa` continues to report the same eight archived animated-roster actor families and is not a projectile regression; `assets:verify` passes.
- Child runtime contains no wallet, signing, settlement, persistence, profile, achievement, scoring-authority, analytics-authority, or Web3 authority.

## Phase boundary

This document certifies the shared projectile/hurtbox foundation only. `reboot-08` remains active. Pistol, shotgun, machine gun, grenade launcher, melee, hand grenades, and Dash remain Phase 12–13 work and must not be marked complete from this foundation.
