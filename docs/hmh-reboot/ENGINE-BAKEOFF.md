# HMH Renderer Engine Bakeoff

**Decision:** Adopt **PixiJS 8.19.0** for the Hard Money Heroes reboot.

## Method

Both engines render the same deterministic simulation, object counts, colors, dimensions, viewport profiles, warmup, sample duration, and CPU-throttling configuration. Three repeats were collected for each engine/profile from the exact tracked harness. Representative desktop-normal and mobile-stress screenshots were visually inspected; both engines rendered equivalent complete scenes. Console errors were zero in the final 24-run pass.

Unlocked FPS is throughput evidence, not the game frame-rate target. The production runtime remains capped at 60 FPS desktop and 30 FPS mobile.

## Median results

| Profile | Objects | Pixi FPS | Phaser FPS | Pixi p95 | Phaser p95 |
|---|---:|---:|---:|---:|---:|
| Desktop normal | 2,450 | 2122.5 | 1567.3 | 0.70 ms | 0.90 ms |
| Desktop stress | 9,800 | 1693.5 | 538.5 | 1.00 ms | 2.70 ms |
| Mobile proxy normal | 2,450 | 932.9 | 330.2 | 1.90 ms | 4.90 ms |
| Mobile proxy stress | 9,800 | 205.4 | 114.7 | 8.50 ms | 11.80 ms |

## Payload and memory

| Metric | PixiJS | Phaser | Result |
|---|---:|---:|---:|
| Minified bundle | 734,967 B | 1,392,979 B | Pixi 47.2% smaller |
| Gzip bundle | 208,396 B | 372,003 B | Pixi 44.0% smaller |
| Desktop-normal heap | 10.88 MiB | 19.11 MiB | Pixi 43.1% lower |
| Mobile-normal heap | 11.84 MiB | 21.27 MiB | Pixi 44.4% lower |

Pixi delivered 3.14× desktop-stress throughput and 1.79× mobile-stress throughput. Phaser had slightly faster median startup in the mobile-stress profile and lower heap in the desktop-stress profile, but those isolated advantages do not offset Pixi's payload, normal-memory, and sustained rendering results.

## Architecture decision

Pixi aligns with the planned deterministic, data-oriented simulation because it supplies a focused renderer without imposing another physics, scene, timing, or object model. That keeps authoritative collision, elevation, AI, replay, and fixed-step behavior under HMH control. Phaser's broader framework is useful for conventional games, but those extra systems duplicate the reboot architecture and account for avoidable payload and memory.

## Environment and limitations

- Windows 10 build 26200
- Intel Core i9-12900K
- NVIDIA RTX 3080 Ti, driver 32.0.16.1074
- 32 GB RAM
- Chrome 150.0.7871.181
- Mobile profile is Chrome DevTools 4× CPU throttling, not a physical phone
- Headless renderer identification was generic, so Phase 17/18 still requires real desktop and phone certification

Raw evidence: `docs/hmh-reboot/ENGINE-BAKEOFF.json`.
Reproducible harness: `benchmarks/hmh-engine-bakeoff/`.
