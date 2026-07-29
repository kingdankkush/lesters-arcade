# HMH AAA Continuous Improvement Cycle 032

Status: `LOCAL CERTIFIED · EXACT-INDEX REVIEW PENDING · PRODUCTION UNTOUCHED`
Date: 2026-07-29 PDT
Branch: `reboot/hmh-aaa-continuous`
Baseline: `0c5d71164f11c32e6acc972735bb78de4f8f0134`

## Objective

Correct the measured projection-only size mismatch between the four production heroes and ordinary authored zombie enemies without changing collision, hurtboxes, AI, routes, attack reach, damage, deterministic simulation, or parent authority.

The production heroes were visibly close to twice the height of ordinary enemies even though the active actor canon requires ordinary enemies to remain at comparable human scale.

## Scope

Changed:

- ordinary authored enemy projection scale;
- boss scale authority location;
- generated-atlas measurement contract;
- stale Cycle 027 scale assertion.

Unchanged:

- hero projection scale;
- boss projection scale;
- gameplay body profiles;
- collision radius and hurt capsules;
- movement and attack ranges;
- AI, spawn, encounter, and progression logic;
- atlas pixels, metadata, and Blender sources;
- fixed-step simulation and replay authority;
- parent portal and Web3 authority.

## Baseline measurement

The measurement uses committed trimmed atlas rectangles and pivots:

- hero body height is the union of `lower-body/idle/0` and `torso-head/aim/0` for all eight directions;
- ordinary enemy height uses `idle/0` for all eight directions;
- each actor contributes its directional median;
- actor-family parity uses the median of those actor medians;
- hero and enemy values are multiplied by the exact runtime projection scales.

Before Cycle 032:

- hero runtime scale: `0.58`;
- ordinary enemy runtime scale: `0.50`;
- boss runtime scale: `0.86`;
- median hero screen-space body height: `70.76 px` at camera zoom `1`;
- median ordinary-enemy screen-space body height: `39.25 px`;
- ordinary enemy / hero ratio: `0.555`;
- boss / hero ratio: `1.051` using the already distinct `0.86` boss scale.

The ordinary roster was therefore only about 55% of hero height. That violated comparable human/zombie scale and weakened threat readability.

## RED

A fail-closed generated-art contract was added to:

- `tests/hmh-reboot-enemy-roster-atlas.test.mjs`

It requires:

- ordinary enemy / hero median height ratio between `0.80` and `0.90`;
- boss / hero median height ratio between `1.00` and `1.15`;
- measurements from all four shipped heroes, all six ordinary enemies, the boss, all eight directions, and the actual runtime scales.

Observed RED:

```text
SyntaxError: enemy-roster-atlas.mjs does not provide BOSS_ROSTER_RUNTIME_SCALE
exit code: 1
```

The missing shared boss-scale authority and the old ordinary scale prevented the contract from loading or passing.

## GREEN

Implemented in `apps/hmh-reboot/src/enemy-roster-atlas.mjs`:

```js
export const ENEMY_ROSTER_RUNTIME_SCALE = 0.75;
export const BOSS_ROSTER_RUNTIME_SCALE = 0.86;
```

`apps/hmh-reboot/src/main.mjs` now imports the shared boss scale rather than declaring a private duplicate.

After Cycle 032:

- median ordinary-enemy screen-space body height: `58.875 px`;
- ordinary enemy / hero ratio: `0.832`;
- boss / hero ratio: `1.051`;
- ordinary enemies remain slightly smaller than heroes;
- the boss remains distinctly larger than ordinary enemies and slightly larger than heroes.

Focused GREEN:

```text
15 tests
15 pass
0 fail
```

## Projection-only boundary

The runtime continues to apply atlas scale only while rendering:

```js
enemyMarker.scale.set((enemyMarker.rosterScale ?? 1) * camera.zoom);
```

No simulation entity reads sprite dimensions. No collision, hit, damage, attack, movement, spawn, RNG, route, save, replay, wallet, settlement, or authority value changed.

## Visual review

Evidence-safe roster preview instantiated all six ordinary enemy families beside the production hero on desktop and mobile.

Desktop review:

- enemies read as human-scale zombies rather than miniature figures;
- hero remains legible as the player-controlled focal point;
- no excessive actor overlap;
- no clipping through world geometry;
- no broken foot grounding;
- no HUD or minimap obstruction;
- all six silhouettes remain distinguishable.

Mobile review:

- human-scale parity remains readable at portrait zoom;
- enlarged enemies do not obstruct Move, Aim, Power, or Pause controls;
- status card, run rail, minimap, and touch controls retain clearance;
- no blocking crowd overlap or viewport clipping was observed.

Evidence files are local QA artifacts under `.hermes/evidence/` and are not release payload:

- `hmh-cycle-032-enemy-scale-desktop.png`;
- `hmh-cycle-032-enemy-scale-mobile.png`.

## Verification

Focused and visual:

- enemy scale/detail suites: `15/15`;
- enemy-detail browser smoke: desktop and mobile PASS;
- visual regression: `8/8` unchanged;
- performance smoke:
  - desktop p95 `7.1 ms`;
  - mobile p95 `7.0 ms`;
- mobile controls: four devices PASS.

Full release:

- syntax: `332` JavaScript modules + `49` Python scripts;
- release ledger: `1,781 total / 1,729 passing / 52 accepted legacy / 0 unexpected`;
- build: PASS;
- HMH bundle: `1,021,348 / 1,050,000 bytes`;
- production asset QA: PASS;
- hero atlases: `12,220,253 / 12,582,912 bytes`;
- roster atlases: `6,448,834 / 10,485,760 bytes`;
- security: `5/5`, zero findings;
- third-party sandbox: `3/3`;
- Web3 audit: `9/9`;
- Web3 live readiness: honestly `PARTIAL 3/4`;
- repository health: PASS;
- CDN gate: PASS;
- documentation links: PASS;
- diff checks: PASS.

Browser/game:

- five-profile release certification: PASS;
- deterministic anchor pairs: zero or sub-threshold pixel deltas;
- combat desktop/mobile/bridge: PASS;
- cockpit desktop/tablet/mobile/landscape: PASS;
- portal E2E implemented flows: PASS;
- mobile-control ownership: PASS on four devices;
- network audit: four scenarios, zero HTTP/request/console/page failures.

## Release boundaries

At cycle certification time:

- production remains untouched;
- no contract was deployed;
- no wallet signature or transaction occurred;
- no settlement action occurred;
- `SETTLEMENT_LIVE=false` remains required;
- deployment requires exact-index review and the user's explicit production authorization.

## Next bounded gameplay slice

After production verification, prioritize forgiving deterministic zombie hurt capsules:

1. measure current seeded shot-contact rates by direction and enemy family;
2. define a bounded generosity band without changing visual scale;
3. add RED contact-rate and 60/30/20 render-schedule equivalence contracts;
4. change only hurt-capsule geometry or contact tolerance;
5. keep damage, AI, attack ranges, spawn pacing, and visuals unchanged;
6. repeat full browser, performance, release, and exact-index certification.
