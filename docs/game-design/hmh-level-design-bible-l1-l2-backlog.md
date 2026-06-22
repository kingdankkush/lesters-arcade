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
| 1 | ✅ DONE | **Combat core**: pooled projectiles + swept collision + muzzle/impact FX; then grenades (arc / bounce / fuse / AoE + **landing shadow marker showing blast radius**) | Bullets, `spawnMuzzleFlash`, impact sparks live in `main.js`. Swept-AABB + circle overlap + `stepProjectile` pure & tested in `combat-physics.mjs`. **Grenades DONE (c5efdc9):** fused throw + landing-shadow blast telegraph. **Projectile pool DONE (d215dbb):** `projectile-pool.mjs` with dynamic capacity growth. |
| 2 | ✅ DONE | **Physics**: knockback + explosion impulse + environmental force zones (deterministic) | `knockback()` exists. **DONE (7620372):** `explosionImpulseAt` (radial falloff) + `applyEnvironmentalForces` (water slow / quicksand sink / conveyor push / wind drift) as pure, tested helpers. |
| 3 | ✅ DONE | **Destructibles + barrels + environmental kills** (collision/pathing re-query) | Props with HP + explosive barrels existed. **DONE (3ae5447):** barrel chain detonation via pure `computeChainDetonation()` — multi-hop BFS, each chained barrel gets its own explosion + blast damage. |
| 4 | ✅ DONE | **Power-up system** (drop tables, spawn rules, magnet, XP gems) + icons | Runtime drop pools/magnet/XP gems existed. **DONE (c1bf1a8):** `drop-tables.mjs` — parameterized drop tables by tier (grunt/elite/boss) × luck, seeded deterministic picks, + `isPickupPlacementSafe` (never spawn in collision/death clutter). |
| 5 | ✅ DONE | **Gore/blood** (toggle, pooled decals, gibs, density dampening) — cosmetic-only, verified | Gore toggle + blood spurts existed. **DONE (71d5c95):** `gore-system.mjs` — pooled+capped splat decals (FIFO), dismember gibs with impulse, density dampening (50→70 enemies ramps full→15%), 0 when disabled. |
| 6 | ✅ DONE | **L1 refinement pass** with the art/code asset manifest | L1 Crypto Wasteland authored world + runtime shipped. **DONE:** sprite-vs-code asset manifest created at `docs/game-design/hmh-l1-asset-manifest.md` — every asset tagged SPRITE/CODE/HYBRID with acceptance fields (iso-ready, locked anchor, collision footprint, zHeight, biome tag, variants, interactive flags, verify pass). |
| 7 | ✅ DONE | **L2 first district end-to-end** (Litecoin Square hub + one spoke, e.g. DeFi Harbor for water systems) on the shared engine | **DONE (a742a93 + b352059):** L2 POIs wired to runtime, 5 districts with mini-bosses + factions, zkLTC Rail train, win screen, near-impossible difficulty (1.95x HP, 1.6x damage, 2.7x boss HP). |
| 8 | ✅ DONE | **Remaining L2 districts** as content packs; verticality + harbor + parks | **DONE:** 8 total L2 POIs — Litecoin Square, DeFi Harbor, Financial Downtown, MimbleWimble Grove, Hashrate District, Artisan District, Parks & Green Belt, Penthouse Rain (Level 3 seam with Mr. NGMI boss). |
| 9 | ✅ DONE | **Theming + readability + perf pass** across both levels | **DONE:** Gore density dampening wired to runtime (50→70 enemy threshold), drop tables with luck-adjusted weights, environmental force zones, particle/decal/projectile caps (gore-system.mjs GORE_LIMITS), Litecoin-accurate theming in L2 POI data (PoW mining, digital silver, MimbleWimble, fast payments), SEO meta tags + lazy video loading. |

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
