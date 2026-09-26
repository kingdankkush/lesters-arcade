# Runtime performance and payload budgets

`reboot-17` reduces projection and allocation work without changing deterministic simulation, collision, damage, AI safety, spawning, scoring, bridge, persistence, or wallet authority.

## Runtime profiles

`apps/hmh-reboot/src/runtime-performance.mjs` selects one immutable profile at boot.

| Profile | Trigger | Resolution cap | Antialias | Particles / visible hazard | World margin | Enemy margin | Animated enemy cap | Blood marks drawn | Texture pages |
|---|---|---:|---|---:|---:|---:|---:|---:|---|
| desktop | width > 700 and fine pointer | 2.0 | on | 10 | 192 px | 224 px | 96 | 48 | full |
| mobile | width ≤ 700 or coarse pointer | 1.0 (adaptive up to 1.5) | off | 4 | 128 px | 160 px | 24 | 16 | half (`@0.5x`) |
| reduced motion | OS/browser preference | 1.0 | off | 0 | 96 px | 128 px | 48 | 48 | full |

The profile affects only rendering and effect projection. Fixed-step gameplay continues at 60 Hz with at most four catch-up steps. The mobile row's animated-enemy cap, blood-mark cap, halved atmosphere budget, un-multisampled baked textures and half-resolution texture pages come from perf step 6 (below).

## Culling and allocations

The world renderer now skips offscreen:

- district material strips;
- routes and authored surfaces;
- visible blockers;
- destructible and explosive props;
- landmarks and POIs;
- hazards and their particle fields.

Bounds use inclusive viewport margins and preserve geometry crossing the viewport even when all endpoints sit outside it.

Since perf step 2, the static ground (terrain, roads, surfaces, strips, blockers, destructibles, depth fallbacks and decals) is culled against the bake view (the view plus a 320 px margin) and drawn only when it re-bakes. The animated pass (water shimmer, landmarks, POIs, hazards and their particles) is still culled against the view every frame.

The actor renderer:

- hides offscreen enemy displays and avoids pose recomposition;
- keeps locked tell geometry independent from marker culling;
- caps animated enemy projection by profile;
- hides offscreen death projections;
- skips offscreen projectile trails and combat effects;
- compacts expired combat visual events in place and in stable order.

No enemy is removed from simulation. AI collision, terrain rejection, token release, target planning cadence, damage, and retirement continue unchanged.

## Existing hard caps retained

- active enemy bodies: 128;
- separation neighbors: 8;
- projectiles: 128;
- grenades: 16;
- combat visual events: 64;
- fixed-step catch-up: 4;
- combat audio voices: fixed allocator cap;
- world particles: 50 authored maximum before profile and viewport culling.

## Browser performance gate

`npm run smoke:hmh:performance` uses installed Chrome with GPU/WebGL enabled and measures both `1440×900` desktop and `390×844 @ 3× DPR` mobile for four active seconds after warmup.

Gates:

- child bundle ≤ 1,050,000 bytes;
- profile and real canvas resolution match;
- active enemies are nonzero and offscreen animation culling reduces projection work;
- visible hazard particles are nonzero and within profile limits;
- at least 180 measured frames;
- p95 frame interval ≤ 34 ms;
- p99 frame interval ≤ 70 ms;
- at most two >100 ms long tasks;
- heap drift < 24 MiB;
- zero page or console errors.

Measured on 2026-07-23:

| Metric | Desktop | Mobile |
|---|---:|---:|
| Bundle | 961,046 bytes | same |
| Resolution | 1.0 | 1.25 |
| Active / animated enemies at hazard tour | 9 / 0 | 9 / 0 |
| Rendered hazard particles | 10 | 6 |
| p95 frame interval | 7.0 ms | 7.0 ms |
| p99 frame interval | 7.1 ms | 7.1 ms |
| Heap drift | 2.7 MiB | 9.8 MiB |
| Browser errors | 0 | 0 |

## Deterministic soak evidence

All existing soaks remain green. The 128-enemy, 3,600-tick soak produced equal hashes at 60/30/20 FPS partitions, only `558,256` bytes heap drift after GC, and average fixed-tick costs of approximately `1.00–1.03 ms`. Combat, projectile, Dash, Level 1 world, encounter director, and boss soaks also passed.

## Crowded-combat bench and same-seed digests (2026-09-25 baseline, release 1.8.1)

Tools:

- `scripts/hmh-perf-crowd-bench.mjs` loads the real child inside a same-origin parent page that speaks `hmh-bridge/v1` (a portal Free session with the portal default `gore: true`). The crowd is the existing evidence-only `?evidenceSafe=1&endurancePressurePilot=1` scene: 128 endurance-band enemies around an invulnerable, auto-firing hero at tick 0, with no respawns. The portal host strips every runtime flag except `evidenceSafe`/`terminalPilot`, so none of this can reach a portal-hosted (ranked-capable) session. `tests/hmh-perf-crowd-bench.test.mjs` guards that.
- Passes run one browser at a time. **timing** records rAF intervals over 20 active seconds, starting at tick 240, with no profiler and no telemetry. **profile** records the same window with a CDP CPU profile, resolved to source lines through `node build.mjs --sourcemap` maps. **alloc** (added in perf step 4) records the same window with the CDP sampling heap profiler, collected objects included, and reports bytes per second, bytes per frame and the top allocating functions. **census** runs `telemetry=1` on a fixed virtual clock (4 ticks per frame) to tick 1800. It records scene load per tick, WebGL texture and renderbuffer allocations, and a trace digest of the simulation fields.
- The bench serves `apps/portal` itself: HTTP/1.1, ETag, `max-age`, byte ranges. Under SFX load, python's HTTP/1.0 server dropped requests. One dropped native-prop request left the child waiting on "Play with basic graphics".
- On this hybrid P/E-core Windows host, pass `--affinity=0xFFFF`. Windowless headless renderers were observed drifting onto slow cores, which moved the 4x mean from ~33 ms to ~230 ms with no code change. The flag pins only the bench's own Chrome processes. A window where the rest of the host is busier than 30% is flagged and re-measured (`--retries`).
- `scripts/hmh-sim-digest.mjs` is the headless same-seed digest. It drives the real simulation modules against the real Level 1 world, collision set and nav grid, in main-tick order, for 36,000 ticks. It covers a crowd scenario and a director-from-tick-0 scenario. It hashes the exact float bits of every enemy, projectile and the hero each tick, plus the finalized run-summary evidence. The existing 128-body endurance soak digest is included.

Commands (from the repo root):

```bash
node build.mjs --sourcemap
node scripts/hmh-perf-crowd-bench.mjs --suite --record --affinity=0xFFFF   # writes docs/testing/hmh-perf-crowd-baseline.json
node scripts/hmh-perf-crowd-bench.mjs --mode=timing --profile=mobile --cpu=4 --affinity=0xFFFF
node scripts/hmh-perf-crowd-bench.mjs --mode=census --profile=desktop     # real-runtime trace digest
node scripts/hmh-sim-digest.mjs                                           # headless 36,000-tick digest
```

Baseline, recorded in `docs/testing/hmh-perf-crowd-baseline.json`. These are Chrome CPU-throttle proxies for an iPhone XS Max: GPU work is not throttled, so they are not physical-device evidence.

| Pass (20 s window) | Viewport | Frames | Mean | p50 | p95 | p99 | Worst | > 33.3 ms | Sim speed |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mobile, 4x CPU | 414×896 @3, profile `mobile`, canvas 414×896 | 599 | 33.44 ms | 27.9 | 48.6 | 96.9 | 139.0 | 49.1% | 0.975 |
| mobile, 6x CPU | same | 261 | 77.54 ms | 76.4 | 97.3 | 165.8 | 208.4 | 100% | 0.822 |
| desktop, 1x | 1440×900 @1 | 2,855 | 7.04 ms | 6.9 | 7.0 | 7.9 | 27.5 | 0% | 1.000 |

Scene inside the mobile 4x window (ticks 245–1461):

- 96–128 live enemies (mean 114.6), 32 of them animated;
- up to 7 corpses, 30 gore marks and 15 silver drops;
- up to 23 combat visual events;
- about 92 contact shadows.

The same-seed trace digest `449616fb1225777b…` is identical for the mobile census, the desktop census and a repeated desktop census. The simulation is therefore reproducible in the real runtime, and independent of the performance profile.

Hotspots in the mobile 4x profile, as a share of busy main-thread time (the main thread was 99% busy):

| Function | Location | Self | Total |
|---|---|---:|---:|
| Fixed-step simulation tick | `main.mjs:3260` | 2.3% | 32.0% |
| `stepEnemyPopulation` | `enemy-simulation.mjs:541` | 2.2% | 19.5% |
| `renderWorld` | `main.mjs:1536` | 3.0% | 18.6% |
| Pixi render | — | — | 21.2% |
| (program), native/non-JS | — | 21.3% | 21.3% |

- The Pixi render share includes `Graphics` geometry rebuilt every frame: `updateGpuContext` 8.1%.
- `freezeDeep` takes 4.0% self. Most of it is `elevation.mjs` `sampleSurface` deep-freezing every ground-query result.
- `computeEnemySeparation` takes 3.9% self (4.3% total), and `sampleSurface` 3.6% self (5.5% total).
- The terrain renderer (`world-production-art.mjs:1088`) re-queries ground for every static route node and surface vertex each frame.

At 6x the fixed-step catch-up saturates: 244 four-step frames. The simulation's share rises to 43% of busy time.

GPU texture residency at tick 1800:

- mobile: 125,351,692 B in 22 textures, plus 1,760,256 B of multisampled renderbuffers and a 414×896 canvas;
- desktop: 169,834,252 B in 25 textures.

2048-class atlases hold most of it: nine hold 93.8% on mobile, and twelve hold 97.6% on desktop. The hero motion, prop, roster and native-roster pages are single-level, uncompressed RGBA.

Initial JS at this base: 1,046,713 / 1,048,576 B (entry + shared chunks + vendor).

## Perf step 1: enemy and corpse display pool (2026-09-25)

Change: `apps/hmh-reboot/src/enemy-display-pool.mjs`, a lazy chunk fetched beside `app.init`. Before it, every enemy insert or retirement ran `resetEnemyMarkers`. That destroyed and rebuilt every live enemy display (about 100–128 containers, each with a body sprite, a rim sprite, a crown `Graphics` and its own frame textures), and its container-only `destroy()` left the child sprites and crown `Graphics` undestroyed. Every corpse was also built per kill and destroyed on expiry. Now:

- Displays live in per-key pools: the roster index per archetype, or archetype plus elite flag for the vector fallback, which bakes its elite default. A reused display is reset to exactly what the factory returns: origin, build scale, upright, opaque, shown, `zIndex` 0, no pose memo, idle pose with the body's elite flag.
- Markers sync incrementally by enemy id, and corpses use the same pools. An arriving roster atlas still rebuilds every live body, as before. Displays whose kind went stale are destroyed. At most 96 idle displays are kept per key.
- Every display cut from one roster atlas shares one frame-texture cache (source, then frame record, then `Texture`).

Visual parity with the old rebuild is exact. A kept marker drops its `zIndex` and pose memo, because a new display has neither, so budget-frozen bodies re-pose on the same frames as before. Every live marker is re-attached to the depth `RenderLayer` in population order, so the layer's stable sort breaks exact depth ties the same way. `tests/hmh-enemy-display-pool.test.mjs` replays a seeded crowd (spawns, kills, corpses, two atlas arrivals, depth ties on a 25 px grid) through the old wiring and the pool. It requires the same drawn layer order, poses, transforms and elite telemetry on all 400 frames. Removing any of the parity steps fails it.

Evidence: `docs/testing/hmh-perf-step1-enemy-display-pool.json`.

- Headless digest `2488a609…` and browser census trace `449616fb…` are both unchanged.
- Initial JS is 1,046,732 B (+19 B).
- In the mobile census, the pool built 3 displays during the measured window (256 → 259) and reused one for every corpse. The old code rebuilt about 100–128 displays per kill. At boot, the five atlas-arrival rebuilds reused 640 displays.
- CPU profile, mobile 4x, 20 s window: roster display construction fell from 88–99 ms to 3.3 ms; frame-texture creation from 103–121 ms to 36–43 ms; Pixi destroy, `removeChildren` and render-group add/remove from about 25 ms to at most 2 ms; GC from 1.6–1.9% to 1.5% of busy time. At 6x, construction fell from 134 ms to 6 ms. The total is roughly 1% of main-thread busy time.
- Frame times: the host carried 28–46% unrelated load throughout, so an interleaved A/B was used instead of the recorded baseline. Mean of three means: 4x base 35.13 ms vs step 1 35.32 ms; 6x base 85.19 ms vs step 1 82.33 ms. Both differences are within run-to-run noise (±3 ms at 4x, ±8 ms at 6x), so this step does not move mean frame time measurably. Desktop 1x stayed at 7.00 ms.

## Perf step 2: static world bake (2026-09-25)

Change: `renderWorldProductionArt` re-projected every route node, surface vertex and blocker, cleared and re-tessellated every ground `Graphics` (including the road, path and ramp stencil masks) and re-placed every tile and strip sprite on every frame. The ground only ever moves with the camera. Now:

- `renderWorldProductionArt` takes an optional `pass`. `'static'` draws the ground: terrain, roads, surfaces, strips, masks, blockers and depth fallbacks. `'dynamic'` draws only what animates: water shimmer, landmarks, interactions, particles, lighting and the vignette. With `pass` omitted it draws both, exactly as before. Surface cues are static except the water shimmer. With `cues`/`shimmers`, each water surface gets its own shimmer target between two static cue targets, so the cue draw order is unchanged.
- `apps/hmh-reboot/src/world-static-bake.mjs` is a lazy chunk fetched beside `app.init`. It regroups the static layers into two Pixi render groups, draws the static pass around the camera into the view plus a 320 px margin, and afterwards only translates them. It also translates the extra cue segments, the depth-sorted fallback features and the decal layer. Moving a render group is one matrix on the GPU: no geometry, and the stage's per-frame instruction rebuild skips the grouped layers.
- A re-bake happens when the camera leaves the margin, or when the zoom, view, terrain textures (the registry now has a `version`), fallback-blocker set, town-fallback visibility or decal set change. While the zoom animates, the bake has no margin, so an animating zoom costs what every frame used to.
- `worldToScreen` lifts geometry by `camera.groundZ`, but the camera-anchored tile pattern ignores it. The bake corrects the tile phase when the camera changes height.
- The screen-space vignette and backdrop redraw only when the view changes. Empty overlay `Graphics` are no longer cleared: a clear marks them dirty, which rebuilds their GPU data and the stage's instruction set for nothing.

Exactness:

- `tests/hmh-world-static-bake.test.mjs` proves that the static and dynamic passes together reproduce the full render draw for draw in ten scenes, and that each pass leaves the other's layers alone.
- It proves that grouping keeps the draw order.
- Along walked camera paths, including height changes, it proves that a translated bake puts every on-screen shape and tile phase where the per-frame renderer drew it.
- It pins the re-bake policy.

In the browser, paused frames were rendered twice in the same page, once through the bake and once through the direct renderer, with the camera away from the bake camera. The ground differs only by isolated 1–2 level texel or edge rounding, because the render-group transform is applied in float32 in the shader. The visual gate passed all 12 scenes, with pixel differences from the step-1 screenshots at the level of run-to-run noise.

One visible difference is deliberate: decals were culled per frame by their centre with 160 px padding, so long tire ruts popped in at the screen edge. Against the bake view they are already there.

Evidence: `docs/testing/hmh-perf-step2-static-world-bake.json`.

- Headless digest `2488a609…` and browser census trace `449616fb…` (mobile and desktop) are unchanged.
- Initial JS is 1,047,594 B (+862 B; 982 B of headroom). The bake chunk (2,522 B) is lazy.
- The bench gained `--walk`: the hero walks a square through the window, so the crowd follows and the camera scrolls.
- The host carried 28–48% unrelated load, so the step-1 and step-2 builds were alternated under the same conditions:

| Mobile crowd, mean of runs | Step 1 | Step 2 |
|---|---:|---:|
| 4x, static camera (3 runs each): mean / p95 / p99 | 35.47 / 50.9 / 64.9 ms | 30.40 / 44.0 / 67.1 ms |
| 4x, frames over 33.3 ms | 65.3% | 35.9% |
| 6x, static camera (3 runs each): mean / p95 / p99 | 94.42 / 127.4 / 185.3 ms | 86.46 / 115.7 / 155.1 ms |
| 4x, walking (2 runs each): mean / p95 | 50.39 / 79.9 ms | 44.06 / 76.5 ms |
| Desktop 1x (1 run each) | 7.04 ms | 7.11 ms |

- An instrumented build measured per-frame main-thread work at mobile 4x in the static crowd. The world renderer's JS fell from 2.6–2.7 ms to 0.33 ms. Pixi `render` fell from 10.2–11.8 ms to 7.1–7.6 ms, including instruction rebuilds from 6.4–7.5 ms to 4.5–4.7 ms. World-art tessellation fell from 0.4 ms to 0.02 ms.
- Walking the crowd triggers about 0.7 re-bakes per second. Each costs 6.6–11.3 ms of JS at 4x, the same range as the step-1 renderer's per-frame maximum. Amortized world JS is 0.5–0.8 ms per frame against 2.7–3.2 ms.
- rAF intervals are vsync-quantised, and the 6x third run of step 2 landed in a heavier host window (103 ms, sim speed 0.63). The per-frame work figures are the more direct measure.

## Perf step 3: simulation hot path (2026-09-25)

Change (`c31b5990`, `948bef42`): cut per-tick simulation work without changing a single result. Arithmetic, iteration order and tie breaking are the release ones; only redundant work goes.

- **Shared guards.** `positive`, `nonNegative`, `nonNegativeInteger`, `positiveInteger`, `validSeed`, `point2`/`point3` and the `lexical` id comparator were copied into up to twelve simulation modules. They now live once in `value-guards.mjs` with identical bodies and messages. `value-guards` also gains `cellKey`, a collision-free packed integer key for grid cells within ±8191 (an `"x,y"` string beyond that).
- **Ground queries.** `sampleSurface` builds its sample frozen, with a shared flat up-normal, instead of deep-walking it with `freezeDeep`. `createAuthoredGroundQuery` looks up a 256-unit cell list of the surfaces whose padded box touches the cell, in priority order, so the first listed match is the old first match. It falls back to the full scan unless every surface is frozen geometry. Swept traversal results freeze field by field.
- **Crowd separation.** Packed integer cell keys, one neighbourhood list per occupied cell, scratch arrays instead of one object per candidate, and a k-smallest cut instead of sorting every candidate. The neighbour rule is unchanged: rank by squared distance, keep the rounding neighbourhood at the cut, take the exact `Math.hypot` distance, order by (distance, id), truncate. `stepEnemyPopulation` reads deltas by index (with an id-keyed fallback for repeated ids), skips the formation map's id re-sort, memoizes `stableHash`, and freezes intents and step results shallowly where every nested value is already frozen.
- **Blocker index.** Buckets merge with a per-index stamp and packed keys instead of a `Set`, string keys and a sort. `querySourceOrder` returns the candidates in the caller's array order.
- **Projectiles.** Cover is narrow-phased only when the immutable blocker index and a padded box test say the segment can reach it, visited in the caller's order; a skipped blocker could only have returned no hit. `resolveProjectileBatch` validates ids, builds the id map and sorts the targets once per batch instead of once per shot. The hurtbox grid uses packed keys without a per-bucket sort (queries sort what they collect). Frozen hurtbox profile shapes are validated once.
- **Melee.** `createMeleeTarget` freezes shallowly: both grounds are frozen points.

Exactness:

- `tests/hmh-sim-hot-path.test.mjs` (13 tests) runs every changed function beside a verbatim copy of its 1.8.1 module in `tests/fixtures/hmh-sim-reference/`. Only the header comment and import paths differ from `60ea173a`. It compares float bits (`Object.is`), key order, Map/Set order and frozen state at every node. It covers Level 1 ground queries, traversal, collision and line of sight, the blocker index, dense/sparse/off-origin/duplicate-id crowds, a 900-tick 128-body Level 1 crowd stepped in lockstep with the release modules, intents, every projectile policy with and without the hurtbox grid, the release validation errors, and melee.
- The headless digest is `2488a609…` on five runs of step 3 and four of step 2. The browser census trace is `449616fb…` on mobile and desktop, measured on the plain build of `948bef42`.
- The determinism suites pass 39/39: hot path, digest, deterministic hash, run summary, endurance soak. Every test file that imports a module changed since step 2 passes: 106 files, 923 tests. The full `node --test` run shows the same 51 pre-existing art-asset-presence failures as steps 1 and 2.
- Left unchanged on purpose: the projectile hurtbox-grid threshold (`PROJECTILE_GRID_THRESHOLD`, 64 targets). `UniformHurtboxGrid.query` orders candidates by code-unit `sort()`, but the no-grid path orders by `localeCompare`. Moving the threshold could therefore reorder simultaneous hits for some id sets, so it is not a proven no-op.

Evidence: `docs/testing/hmh-perf-step3-sim-hot-path.json`.

- Initial JS is 1,047,622 B: +28 B over step 2, 954 B of headroom. The guard refactor freed 1,695 B, which paid for the hot-path code.
- Headless simulation cost (`hmh-sim-digest`, pinned to the P-cores at High priority, builds alternated):
  - crowd: 0.684–0.687 → 0.383–0.413 ms per tick (−42%);
  - director: 0.241–0.252 → 0.139–0.147 ms per tick (−41%).
- CPU profiles give the in-browser cost per fixed tick. Each A/B round has one profile pair per scenario:

| Per fixed tick, from the CPU profile | Step 2 | Step 3 |
|---|---:|---:|
| Mobile 4x: simulation `update` | 6.71 / 6.22 ms | 4.01 / 4.13 ms |
| Mobile 4x: `stepEnemyPopulation` | 4.00 / 3.70 ms | 1.98 / 2.01 ms |
| Mobile 6x: simulation `update` | 13.28 / 11.31 ms | 6.63 / 6.05 ms |
| Mobile 6x: `stepEnemyPopulation` | 7.83 / 6.88 ms | 3.17 / 3.07 ms |
| Desktop 1x: simulation `update` | 1.85 / 1.40 ms | 1.12 / 1.11 ms |

  Over a 20 s mobile window, the functions this step targeted fell as follows:
  - `sampleSurface`: from 781–963 ms to 99–139 ms;
  - `freezeDeep`: from 765–903 ms to 249–291 ms;
  - swept traversal: from 911–1,137 ms to 203–336 ms;
  - separation: from 0.84–1.72 ms to 0.45–0.69 ms per tick.
- Frame timing. Other sessions kept the host 22–66% busy, so the two builds were alternated in two rounds. Round 1 used `--retries=2` with `--sourcemap` builds; round 2 used `--retries=1`, plain builds for timing passes and `--sourcemap` builds for profile passes.

| Mobile crowd, mean of runs | Step 2 | Step 3 |
|---|---:|---:|
| 4x, static camera (6 runs each): mean / p95 / p99 | 35.76 / 52.1 / 70.7 ms | 31.65 / 52.1 / 77.6 ms |
| 4x, frames over 33.3 ms | 59.3% | 35.8% |
| 6x, static camera (6 runs each): mean / p95 / p99 | 93.77 / 133.2 / 173.7 ms | 68.00 / 101.9 / 125.1 ms |
| 6x, fps / sim speed | 10.8 / 0.70 | 15.3 / 0.85 |
| 4x, walking (2 runs each): mean / p95 | 54.94 / 90.3 ms | 46.28 / 79.9 ms |
| Desktop 1x (6 runs each) | 7.20 ms | 7.65 ms |

- The 6x crowd is simulation-bound, and it gains most: 27% lower mean frame time, and the simulation falls behind real time less (sim speed 0.70 → 0.85). One step-3 6x run landed in a heavy host window (98.7 ms, 38% other load). Its paired step-2 run was just as slow (102.4 ms).
- At 4x, the mean and the share of frames over 33.3 ms improve, but the tail does not. In round 2 (quieter host) the p99 is equal (67.2 ms both). Round 1 had step 3's p99 worse, with the host 42–47% busy. After this step, the remaining 4x frame cost is mostly rendering and native work.
- Desktop 1x is vsync-bound at 144 Hz (6.94 ms). In the first four timing pairs, the step-3 pass drew the busier host window each time, and its missed-vsync frames rose with it. The last two pairs ran at 26–33% host load and measured 7.02 and 7.03 ms against 7.10 and 6.98 ms. The desktop profile pairs show lower simulation cost and 4.74–5.29 ms of main-thread busy time per frame, against 4.59–6.25 ms for step 2.
- Still open after this step:
  - the hurtbox grid is rebuilt on every tick with a projectile in flight;
  - `freezeDeep` still costs 112–291 ms per window: combat-hit and snapshot results, plus the `main.mjs` tick glue;
  - the `main.mjs` glue still allocates its target lists every tick.

## Perf step 4: render-path allocations (2026-09-25)

Change (`4d5fc4eb`, `c85b2d89`; tooling `24c12255`): the per-frame render path stops allocating per enemy and stops rebuilding data it already had.

- **Enemy body pass.** The enemy loop moved out of `renderWorld` into `apps/hmh-reboot/src/enemy-render-pass.mjs`, a lazy chunk (5,960 B) with every dependency injected. The 1.8.1 loop copied every enemy twice (`{ ...enemy }`) to project it, built a candidate object per enemy, filtered, mapped and fully sorted the visible crowd to fill the animation budget, resolved the same visual state up to three times, hashed each id twice and pushed a pip object per body. The pass projects each enemy once into scratch arrays and keeps the budget winners in a bounded max-heap: O(n log cap), no sort, in exactly the (priority, distance, id, row) order of `selectAnimatedEnemyIds`. It reuses the six-state result, caches the elite flag and locomotion phase on each display by id, and reuses one pose and one shadow object; pips live in typed arrays.
- **Helpers.** `worldToScreenInto` writes into a caller's point, and `worldToScreen` no longer copies the viewport on every call. `isScreenPointVisible` and the enemy pose memo no longer build an array and a closure per call. Roster clips are found through a nested phase/state/direction table instead of four template-string keys per pose, and an unchanged body tint skips the sprite setter. `selectEnemyRosterPose` and `creatureAnimationTick` accept inputs the caller already has.
- **Leak.** `enemyVisualFacing` gained one entry per enemy ever drawn: a defeated enemy retires in the tick that kills it, so the render never saw it inactive and never deleted its entry. Marker syncs now prune it.
- **Other per-frame garbage.** Gore walks its pools directly instead of building `frame()`'s copies every frame, prunes them in place, projects through one reused point, hashes a kill mark's fragment seeds once and no longer clears an empty layer. Contact-shadow placements write into one object. The static bake fills its key into one reused array; `main.mjs` keeps the native-blocker Set and its joined key until the ids change, so ~100 ids are no longer joined every frame. Focus points reuse their array and points. The HUD reads the run's ranks directly instead of a deep-frozen progression snapshot every frame, and counts enemies in one loop.

Exactness:

- `tests/hmh-enemy-render-pass.test.mjs` replays seeded mobile, desktop, reduced-motion and no-simulation crowds (spawns, retirements, display reuse, hit reactions, tells, telemetry) through the pass and a verbatim copy of the 1.8.1 loop (`tests/fixtures/hmh-render-reference/enemy-body-pass.mjs`). It requires identical calls and arguments in order, display state, facing memory, telemetry and pips on every frame, and checks 1,500 randomized budget selections against `selectAnimatedEnemyIds`. It caught 16 of 17 deliberate breakages; the survivor only differs when two enemies share an id, which the population rejects.
- `tests/hmh-render-alloc.test.mjs` checks each rewritten helper against its verbatim 1.8.1 copy: bit-identical projections and identical errors, the same roster frame records for every actor, phase, state, direction and index, the same display frames, tints and elite layers, and the same gore draw calls, pools and counts (12 of 12 breakages caught) and shadow placements. The bake test proves a caller-joined blocker key re-bakes exactly when the Set would. Source-pinned tests read the pass where the loop moved.
- Headless digest `2488a609…` after each commit; browser census trace `449616fb…` on mobile and desktop. The 104 test files that touch a changed module pass (1,153 tests). The visual gate reports 12/12 scenes and the enemy crops unchanged.

Evidence: `docs/testing/hmh-perf-step4-render-alloc.json`.

- Initial JS is 1,044,848 B, 2,774 B less than step 3 (3,728 B of headroom): the loop left the entry for a lazy chunk.
- Allocation (new `--mode=alloc`: the CDP sampling heap profiler over the timing window, collected objects included, bytes split by call stack), mobile 4x crowd:

| Sampled bytes | Step 3 | Step 4 |
|---|---:|---:|
| `renderWorld` JS, per frame | 532.5 KB | 317.7 KB |
| Pixi `render`, per frame | 2,255 KB | 2,254 KB |
| Simulation, per tick | 653.6 KB | 653.4 KB |

- CPU profiles, `renderWorld` per frame at matched host load (26–29% other): 4x 4.91 / 5.73 ms → 3.75 / 3.87 ms; 6x 8.41 → 7.13 ms. The enemy pass itself is about 1.5 ms per frame at 4x. Pixi `render` (7.3–13 ms) and the simulation per tick are unchanged.
- `scripts/hmh-enemy-pass-bench.mjs` runs the same 128-body crowd on real Pixi containers and roster displays through both loops, pinned: 0.132 → 0.058 ms per frame at 1x (−56%), and 9.2 → 3.8 garbage collections per 1,000 frames.
- Frame timing, one alternated round (step-3 build against the final build, `--retries=2`). The host carried 16–58% unrelated load, and at 4x the mean follows the load window: the one 4x pair at matched load (46%) is 25.26 vs 25.29 ms, while the two final runs that drew 52% and 58% windows were slower. At 6x the final build was faster in all three pairs: 99.96 → 72.47 ms (both ~50% load), 90.73 → 47.35 ms and 54.73 → 48.72 ms (20–25% load). Desktop 1x is vsync-bound at 6.98–7.00 ms for both. Walking at 4x: 20.02 vs 21.81 ms (19.5% vs 23.2% load).
- Restart and hero switch (`scripts/hmh-restart-leak-probe.mjs`, retained heap after forced GC): five `portal:restart` rounds and five re-mounts with a different hero each hold 21–27 MB, documents stay at 2 (a disposed child document is collected), and DOM nodes and listeners are stable. The portal re-mounts the child for Play Again and a hero change, so nothing accumulates across runs. Within one 21,600-tick run, retained heap grows 15.8 → 18.1 MB on step 3 and 15.8 → 17.5 MB here. The soak's 314% is raw heap, garbage and art loading included, measured from 49 MB at boot.
- Still open after this step:
  - Pixi `Graphics` tessellation is the largest allocator, about 2.25 MB per frame: `buildLine`, circle and rounded-rectangle triangulation and `buildContextBatches` are about half of all sampled bytes. They come from the immediate-mode layers redrawn every frame (health pips, elite rings, tells, gore, combat effects, world life, reticle), which need pooled sprites or retained geometry;
  - renderer private memory grows 50–65 MB over the long run in both builds while the JS heap grows 2 MB, so it is outside the JS heap (per-cue `HTMLAudioElement` players and decoded images are the candidates);
  - the hero atlas still builds string keys and a joined frame-id string every frame, and world life queries the ground for every site every frame.

## Perf step 5: Web Audio SFX engine (2026-09-25)

Change (`8a2795a2`; tooling `17728eb0`): every SFX cue used to construct a new `HTMLAudioElement(url)`, which meant a media element, a media pipeline, a revalidation of a `max-age=0` asset and a decoder start, up to 16 voices deep in a crowded fight. iOS also ignores element `volume`, so the SFX and UI sliders did nothing on an iPhone.

- **Engine.** `apps/hmh-reboot/src/combat-audio.mjs` creates one `AudioContext` in the first gesture. It fetches and decodes each sample a cue can reach in the current mode once, four at a time, into an `AudioBuffer`. A cue is an `AudioBufferSourceNode` into a per-voice `GainNode` (cue plan volume × boss duck), then the SFX or UI bus `GainNode` (slider level × dynamic range), then the destination. The registry gate, cooldowns, the 16-voice cap, priority stealing, 4 s reaping, the 600 ms boss duck (×0.7; boss, damage and UI exempt), the pause allow-list and reduce-motion attenuation are unchanged. Standalone music is still a media element; embedded HMH music stays with the parent's player. Audio remains projection-only.
- **Gestures and lifecycle.** `pointerdown`, `pointerup`, `touchend` and `keydown` listeners stay attached. The first one unlocks: `resume()` and a one-sample buffer started inside the gesture, as iOS requires. A touch `pointerdown` is not a user activation, which is why the old once-only `pointerdown`/`keydown` unlock never fired on an iOS tap. Later gestures resume a context that iOS interrupted (a call, Siri or another app). A hidden page suspends the context and a visible page resumes it. `destroy()` closes the context and removes every listener. `main.mjs` now only passes `gestureTarget: window` and `visibilityTarget: document`.
- **Dropped, not late.** A cue is refused while the context is locked or suspended, or while its sample is still decoding. A requested sample moves to the front of the decode queue. A failed fetch or decode leaves that cue silent without leaking a voice.
- **Owner decision: no footsteps and no voice lines.** `footstep-dirt` and `footstep-road` are refused in every mode (`cue-retired`) and never fetched, and the unused `worldDesignFootstep` selector is gone. The child has no voice-line cues. The footstep WAVs, their manifest and registry entries and their generator recipe are portal-owned or shared, so they are on the cleanup list in the evidence file rather than deleted here.
- **Tooling.** Telemetry adds `audioContext`, `audioSamplesReady` and `audioSamplesFailed`. The crowd bench counts media-element plays, buffer-source starts and SFX requests inside each window, so an A/B can prove both builds played the same cue stream. The leak probe gives each mounted child one trusted key press. The weapon-SFX smoke presses Shift and asserts a running context and zero failed samples.

Exactness:

- `scripts/hmh-action-audio-audit.mjs`, run through the old engine and through this one, gives bit-identical routed gains for all 35 live manifest cues. The 154-event dense-mix WAV and the audition WAV are byte-identical.
- `tests/hmh-reboot-combat-audio-webaudio.test.mjs` has 17 tests, 16 of them red before the change. The four suites that drove an `HTMLAudioElement` fake now drive `tests/helpers/fake-web-audio.mjs` with the same assertions, made on source buffers and graph gain.
- The headless digest matches (`2488a609…`), and the browser census trace at tick 1800 is `449616fb…` on mobile and desktop. `scripts/hmh-weapon-sfx-browser-smoke.mjs` passes in Chrome with a running context, 0 failed samples, 0 registry refusals and at most 2 voices.

Evidence: `docs/testing/hmh-perf-step5-audio-webaudio.json`.

- Initial JS is 1,044,564 B, 284 B less than step 4 (4,012 B of headroom). The lazy `combat-audio` chunk grows by about 1.9 KB.
- Both builds start 344–366 cue voices per 20 s window. Step 4 does it with media-element plays; this build does it with buffer sources, fetches 35 samples once at unlock and makes no SFX requests inside the window.
- Frame timing: step-4 and step-5 builds alternated over two rounds. The table uses only pairs whose host-load windows matched (the host carried 25–60% unrelated load; mismatched runs are kept in the evidence file).

| Mobile crowd | Step 4 | Step 5 |
|---|---:|---:|
| 4x mean (3 pairs, 26–27% load) | 23.59 ms | 20.69 ms (−12.3%) |
| 4x p95 / p99 | 34.7–41.7 / 41.7–62.5 ms | 27.8–27.9 / 34.7–41.7 ms |
| 4x frames over 33.3 ms | 5.4–13.3% | 1.7–4.7% |
| 6x mean (2 pairs) | 57.65 ms | 48.49 ms (−15.9%) |
| 6x p99 | 118.1 / 125.1 ms | 90.4 / 90.3 ms |
| 6x sim speed | 0.917 / 0.910 | 0.961 / 0.948 |

- CPU profiles at matched load: busy time per frame at 4x is 28.99 and 27.93 ms → 26.75 and 24.31 ms, and at 6x 58.31 → 49.60 ms. The whole drop is native main-thread work, the `(program)` bucket: 7.72 and 7.53 → 4.98 and 4.49 ms per frame at 4x (27% → 18.5% of busy time), and 16.92 → 8.53 ms at 6x. The JS side of `play()` costs about the same in both engines. Desktop 1x stays vsync-bound (7.03 vs 6.99 ms).
- Long run (21,600 ticks, leak probe `--long`): renderer private memory grows about the same with either engine (+63.8 MB on step 4, +65.8 MB here), and the retained JS heap stays at 16–18 MB. So per-cue media elements were not the source of that growth; decoded images and GPU-side resources remain. The decoded SFX buffers take about 3.5 MB.
- Not verified on an iPhone: the unlock on the Enter tap, recovery after an interruption, and the ring/silent switch. With `navigator.audioSession` left at its default, WebKit may treat Web Audio as ambient and mute SFX with the silent switch while the parent's music keeps playing. Setting `navigator.audioSession.type = 'playback'` would change that; it is an owner decision.
- Owner target: at 4x the crowd now averages about 48 fps, with 1.7–4.7% of frames slower than 30 fps. At 6x it is about 20–21 fps.
