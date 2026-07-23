# Hard Money Heroes Reboot: Level 1 World Contract

Status: Phase 17 candidate, pending exact-index independent certification

## Scope

`apps/hmh-reboot/src/level-one-world.mjs` is the repo-owned source of truth for the seamless Level 1 graybox, **The Forked Frontier**. Runtime rendering, collision, elevation, traversal, encounter districts, spawn placement, POI rest windows, minimap geometry, and fog reveal derive from this module.

The phase deliberately keeps prototype geometry and neutral human graybox actors. Every player, enemy, and boss marker now has an explicit head, torso, two arms, and two legs; archetype color remains a role cue without using animals, machines, robots, or abstract polygons as actor proxies. Production terrain materials, props, actor sheets, particles, lighting, and shaders remain gated to later art phases. No generated or paid asset was added.

## Authored dimensions and pacing

- Bounds: `12,000 × 4,800` world units.
- Player speed: `240` world units per second.
- Main route: `12,083.609273` world units.
- Unopposed main-route traversal: about `50.35` seconds.
- Protected spawn: `(800, 2400)`, radius `560`.
- Six ordered districts:
  1. Frontier Relay
  2. Rugpull Ravine
  3. Liquidity Crossing
  4. Hashwood
  5. Mining Camp
  6. Liquidation Yard

## One audited geometry source

The world contract owns:

- ordered district bounds and seam metadata;
- main route plus six convergent optional loops;
- route nodes, widths, bridge crossing, and authored ramps;
- deep water, shallows, bridge deck, ledges, one-way drops, and ground-height metadata;
- visible collision blockers and matching visible barrier IDs;
- visible perimeter causes for every hard world edge;
- landmarks, reward POIs, encounter arenas, deterministic spawn points;
- destructible clusters, hazards, and explosive zones;
- normalized minimap geometry and deterministic reveal-grid metadata.

`createLevelOneGroundQuery()` uses the certified elevation module. Collision blockers use the certified collision constructors. The runtime imports these results rather than maintaining inline graybox arrays.

## Checklist mapping

| Phase requirement | Implementation | Behavioral verification | Browser/visible evidence |
|---|---|---|---|
| Dimensions and traversal-time target | `level-one-world.mjs` bounds, player speed, main route | route length and 40–70 second target test | world telemetry in desktop/mobile/bridge smokes |
| District progression and seams | ordered `districts`, `getLevelOneDistrictAt()` | complete coverage and deterministic seam tests | district telemetry; bridge tour enters Liquidity Crossing |
| Main route, loops, shortcuts | `routeGraph`, seven authored routes | graph reachability, loop convergence, full canonical route sweep | route/minimap visible in screenshots |
| Spawn protection | player spawn, protected radius, feature anchors | solids, hazards, landmarks, arenas excluded from radius | unobstructed opening screenshot |
| Clearance and bridge crossing | route widths, bridge width, canonical blockers | radius-aware collision sweep and complete traversal test | `bridge-world.png` |
| Water, banks, bridge, ramps, ledges | elevation surfaces and visible seam metadata | deep-water rejection; bridge/ravine/mining legal traversal | bridge deck, rails, water, and ramps visibly align |
| Landmarks and reward POIs | `landmarks`, `pois`, `encounterArenas` | unique IDs, ownership, in-bounds audit | minimap landmark geometry |
| Destructibles and hazards | deterministic interaction records | unique IDs, district ownership, spawn exclusion | visible graybox silhouettes/zones |
| Visible perimeter | `perimeter` plus visible barrier metadata | continuous side coverage and collision audit | finite camera/world boundaries |
| Repo-owned world data | frozen pure module | immutability, no random/time source, stable audit | source-backed datasets |
| Editor/tool decision | no editor dependency for graybox | dependency/package guard | N/A |
| Minimap and fog/reveal | normalized geometry + bounded 50×20 grid | identity parity, deterministic monotonic reveal, bounds | desktop/mobile/bridge screenshots and finite minimap telemetry |

## Deterministic world soak

`scripts/hmh-reboot-level-one-world-soak.mjs` walks the complete main route through the canonical collision and elevation APIs at fixed 60 Hz under 60, 30, and 20 FPS render partitions.

Latest candidate result:

- target ticks: `3,050`;
- final position: `(11000, 2400, z=0)`;
- all six districts visited in order;
- all ramp, ledge, bridge, and ground transitions visited;
- collision contacts: `0`;
- traversal blocks: `0`;
- timing loss: `0 ms` at all partitions;
- deterministic hash: `ba2cb20b51b956b6190026d4e9cb74caf7b8724b53adc349df17aa6c899b42db`;
- 60 Hz repeat hash: identical;
- measured fixed-step cost: `0.005–0.009 ms/tick` in the local Node harness;
- measured heap delta for four full traversals: `401,472` bytes.

Raw report: `.tmp/hmh-reboot-phase17-world-soak.json`.

## Browser and visual evidence

Harness: `scripts/hmh-reboot-combat-browser-smoke.mjs`.

Embedded harness: `scripts/hmh-reboot-embedded-browser-smoke.mjs`.

Evidence directory: `.hermes/evidence/hmh-reboot-phase8-combat/`.

- `desktop-combat.png`: desktop gameplay, route, fog/minimap, role silhouettes, boss tells, HUD.
- `mobile-combat.png`: portrait touch controls, safe labels, relocated unobstructed minimap.
- `bridge-world.png`: Liquidity Crossing bridge deck, rails, ramps, water, route, elevation, minimap.
- `report.json`: machine-readable desktop/mobile/bridge state and zero-error assertions.
- `../hmh-reboot-phase17-world/embedded-desktop.png`: real same-origin host iframe, sandbox, INIT/READY, state callbacks, and pause/resume lifecycle.

The guarded `evidenceSafe=1` mode prevents test death only for browser evidence. `worldTour=bridge` is honored only with evidence-safe mode. Normal gameplay spawn, damage, authority, and persistence behavior are unchanged.

`prototype-actor-art.mjs` is render-only. Its immutable descriptors supply human anatomy geometry to Pixi `Graphics`; they do not alter collision radii, hurtboxes, movement, AI, damage, scoring, encounter state, or parent authority. The neutral grayboxes are evidence-safe placeholders for the later Blender actor pipeline, not production character art.

The production startup graph is `941,789` bytes raw / `270,049` bytes gzip across the reboot entry, its two recursively imported chunks, child HTML, and child CSS. No new asset or runtime dependency was added.

## Authority and compatibility

This phase does not alter:

- PixiJS `8.19.0`;
- deterministic `60 Hz` simulation or four-step catch-up cap;
- `GAME_ID="hmh"`, `CABINET_ID="wo71"` portal identity;
- persistence key `lesters-arcade-save-v1` or schema `2`;
- `hmh-bridge/v1` protocol and 64 KiB payload cap;
- parent authority for wallets, signing, contracts, settlement, persistence, profiles, achievements, scores, economy, analytics, or Web3.

The child emits no authoritative grant, score, settlement, wallet, or persistence operation.

## Discovered runtime correction

Browser certification exposed a pre-existing shotgun integration failure: pellet hits shared an attack ID and could produce duplicate combat-hit IDs. Runtime hit-intent IDs now derive from each stable projectile ID. Damage and scoring semantics are unchanged; the correction only restores unique deterministic event identity.

Embedded certification also exposed stale accessible pause copy. Pause and resume now update the visible status alongside simulation and audio lifecycle changes; bridge messages and authority remain unchanged.
