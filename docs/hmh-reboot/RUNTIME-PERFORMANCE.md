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
