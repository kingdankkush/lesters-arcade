# HMH Level Design Bible (L1 & L2) — Tracked Backlog (ingested 2026-06-20)

Source: `HMH_Level_Design_Bible_L1_L2.pdf` (author pass: Claude Opus 4.8). Companion to the
World Design, World Systems, and Environmental FX briefs.

Scope: world/level design + the sprite-vs-code asset split + the combat / physics / grenade /
gore / power-up systems for an isometric run-and-gun roguelite. L1 = Crypto Wasteland,
L2 = Litecoin City (district content packs on the shared L1 engine).

This file merges the bible's §10 work order into our tracked work and records the **honest current
status** of each item against the actual repo (runtime lives in `apps/portal/main.js`; pure,
testable systems in `apps/portal/src/*.mjs`).

## Through-line constraints (apply to every slice)
- Every asset/effect tagged **SPRITE** (draw), **CODE** (program), or **HYBRID** (art driven by a system).
- **Determinism boundary**: anything that affects gameplay/score (projectile motion, physics,
  explosion damage, grenade arcs, drop tables) lives in the seeded, fixed-timestep sim; purely
  cosmetic FX (blood, debris, sparks) are render-side and free. No float nondeterminism across platforms.
- **Readability under chaos**: at peak density, dampen ambient/cosmetic FX so telegraphs / pickups /
  player stay vivid. Silhouette readability always wins.
- **Biome-extensible**: L2 districts load as content packs on the L1 engine with no engine changes.
- Canon honored: no persisted-ID changes; ranked stays same-RNG / never pay-to-win; all
  real-funds / deploy / branding actions remain **gated to Justin**.

## Status legend
- ✅ DONE — shipped / verified in repo
- 🟡 PARTIAL — foundation exists, gaps remain
- ⬜ TODO — not started
- 🔒 GATED — needs Justin approval / external verification

---

## §10 Work Order — small verified slices (sequenced)

| # | Status | Slice | Repo reality / gap |
|---|---|---|---|
| 1 | 🟡 PARTIAL | **Combat core**: pooled projectiles + swept collision + muzzle/impact FX; then grenades (arc / bounce / fuse / AoE + **landing shadow marker showing blast radius**) | Bullets (`updateBullets`/`updateRoguelikeBullets`), `combat.bullets[]` array, `spawnMuzzleFlash`, impact sparks all live in `main.js`. Swept-AABB + circle overlap + `stepProjectile` (gravity/bounce) are pure & tested in `combat-physics.mjs`. **Grenades DONE (commit c5efdc9):** real fused throw via pure `planGrenadeThrow` (clamped range + telegraph marker) → `combat.activeGrenades` → `updateRoguelikeGrenades` detonates with shared `grenadeBlastDamageAt` radial falloff; pulsing landing-shadow blast-radius ring drawn on the ground (the bible's §6.3 readability ask). `explosionImpulseAt` pure helper added (feeds slice #2). **Remaining:** projectiles still use a plain array (re-alloc each shot), not a recycled pool — pooling is the last sub-item of this slice. |
| 2 | 🟡 PARTIAL | **Physics**: knockback + explosion impulse + environmental force zones (deterministic) | `knockback()` pure helper exists (type-scaled, armor-resist). Water slow zones exist (`resolveWaterCollision`). **Gaps:** explosion radial impulse with falloff not extracted as a pure helper; no generalized environmental force-zone model (quicksand sink / conveyor / wind) as deterministic zones. |
| 3 | 🟡 PARTIAL | **Destructibles + barrels + environmental kills** (collision/pathing re-query) | Props with HP exist (`damageProp`, kinds `cover`/`crate`/`wall`/`barrel`), explosive barrels render + body-check. **Gaps:** barrel **chain** detonation; destroyed-cover collision/pathing **re-query** so enemies re-route; environmental-kill crediting near choke points. |
| 4 | 🟡 PARTIAL | **Power-up system** (drop tables, spawn rules, magnet, XP gems) + icons | `ROGUELIKE_POWERUP_POOL`, `dropRoguelikePowerUp`, `applyPowerUp`, magnet/slow/berserk timers, `combat.xpGems[]` + `updateRoguelikeXpGems` all live. **Gaps:** drop tables not parameterized by enemy/elite/boss/biome × luck/loot-quality as a pure model; "never spawn in collision / under death clutter" placement rule not enforced by a tested helper. |
| 5 | 🟡 PARTIAL | **Gore/blood** (toggle, pooled decals, gibs, density dampening) — cosmetic-only, verified | Gore toggle (locked pre-run intent), `goreFrames`, blood spurts on hit all exist; accessibility panel already gates shake/flash. **Gaps:** pooled+capped ground/wall splat decals that fade; dismember gibs (sprite chunks + impulse) on explosive/heavy kills; explicit density-dampening of cosmetic FX at high threat count. |
| 6 | 🟡 PARTIAL | **L1 refinement pass** with the art/code asset manifest | L1 Crypto Wasteland authored world + runtime shipped (`hmh-campaign-levels.mjs`, `district-generator.mjs`, environment manifest). **Gap:** the sprite-vs-code asset manifest (every asset tagged + acceptance fields) per §4 is not yet a single tracked artifact. |
| 7 | ⬜ TODO | **L2 first district end-to-end** (Litecoin Square hub + one spoke, e.g. DeFi Harbor for water systems) on the shared engine | L2 Litecoin City world plan doc exists (`hard-money-heroes-level-2-litecoin-city-world-plan.md`); no district pack wired to runtime yet. |
| 8 | ⬜ TODO | **Remaining L2 districts** as content packs; verticality + harbor + parks | Depends on #7 establishing the district-pack contract. |
| 9 | ⬜ TODO | **Theming + readability + perf pass** across both levels | Litecoin-accurate theming (PoW mining / digital silver / MimbleWimble / fast payments), ~1-in-5 props themed; readability + particle/decal/projectile caps. |

---

## §9 Acceptance & tests (gate every slice)
- **Determinism**: projectile / physics / grenade / explosion outcomes reproduce identically from
  seed + inputs; gore/debris never alter the sim (golden-run test).
- **Readability**: at max density, FX dampening keeps telegraphs / pickups / player clear.
- **No tunneling**: fast projectiles vs thin walls always register (swept-collision test).
- **No traps**: knockback / explosions / movers never lock the player in collision (fuzz test).
- **Destruction integrity**: destroyed cover updates collision + pathing (enemies re-route).
- **Placement**: zero spawns/pickups in collision/hazard; pickups never under death clutter.
- **Biome-extensible**: an L2 district pack loads on the L1 engine with no engine changes.
- **Perf**: particle/decal/projectile caps respected; stable frame time at peak density; FPS-independent sim.

## Sequencing note
Execute top-down in small verified slices. Each slice: pure model + unit tests in `src/`, then wire
the runtime in `main.js`, then `npm test && npm run check && npm run smoke:portal:interactions`, then
an incremental commit. Real-funds / deploy / branding stay gated to Justin.
