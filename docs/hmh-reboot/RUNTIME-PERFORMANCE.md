# Runtime performance and payload budgets

`reboot-17` reduces projection and allocation work without changing deterministic simulation, collision, damage, AI safety, spawning, scoring, bridge, persistence, or wallet authority.

## Runtime profiles

`apps/hmh-reboot/src/runtime-performance.mjs` selects one immutable profile at boot.

| Profile | Trigger | Resolution cap | Antialias | Particles / visible hazard | World margin | Enemy margin | Animated enemy cap |
|---|---|---:|---|---:|---:|---:|---:|
| desktop | width > 700 and fine pointer | 2.0 | on | 10 | 192 px | 224 px | 96 |
| mobile | width ≤ 700 or coarse pointer | 1.25 | off | 6 | 128 px | 160 px | 64 |
| reduced motion | OS/browser preference | 1.0 | off | 0 | 96 px | 128 px | 48 |

The profile affects only rendering and effect projection. Fixed-step gameplay continues at 60 Hz with at most four catch-up steps.

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
- Passes run one browser at a time. **timing** records rAF intervals over 20 active seconds, starting at tick 240, with no profiler and no telemetry. **profile** records the same window with a CDP CPU profile, resolved to source lines through `node build.mjs --sourcemap` maps. **census** runs `telemetry=1` on a fixed virtual clock (4 ticks per frame) to tick 1800. It records scene load per tick, WebGL texture and renderbuffer allocations, and a trace digest of the simulation fields.
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
