# W4a — the ten-area world inside the real HMH game (unranked Free)

2026-09-30. Source checkpoint on `claude/200-world-runtime`. The authored
20,000 × 14,000 ten-area world now runs inside the actual Hard Money Heroes
runtime (movement, collision, navigation, encounter director, enemies, weapons,
HUD, pickups, mission rings, the Liquidator) as an explicitly unranked Free world
selection, so area art can be reviewed in the real game. The legacy
`forked-frontier` v1 world stays the default for everything, and the Ranked
verifier is untouched. No browser smoke, `visual:reboot`, release gate, version
bump or deployment ran here; the root owns those.

## Try it

Serve from `apps/portal` after a normal build, then open, in its own tab:

```
http://127.0.0.1:8791/hmh-reboot/index.html?mode=free&world=ten-area&evidenceSafe=1
```

`evidenceSafe=1` is optional: outside Ranked it keeps the existing evidence
behaviour (invulnerable hero, evidence spawn only with `worldTour=`). Without it
the run is an ordinary standalone Free run on the new map. `debugHud=1` shows
the telemetry strip; `dataset.worldId` / `worldOfficial` / `worldSelection` on
the stage element report the adopted world.

## Selection rule

`apps/hmh-reboot/src/world-context.mjs` resolves the world once, at the top of
`boot()`, before the bridge, the renderer or any session exists:

- Default: `LEVEL_ONE_WORLD` (`forked-frontier`, version 1), official, Ranked-eligible.
- Ten-area (`ten-area-frontier`, version 2, `officialRun:false`,
  `rankedEligible:false`): only when the page URL carries exactly one
  `world=ten-area` **and** exactly one `mode=free`. Any other value, a duplicate,
  a missing mode or any Ranked hint resolves to the legacy world.
- The session payload is re-checked: an unofficial world refuses any session
  that is not `mode:'free'` with `session.rankedEligible === false` (status line
  plus `game:error unofficial-world-session`); the standalone developer payload
  is exactly that shape.
- The portal host forwards only `evidenceSafe` and `terminalPilot` into the
  child frame, so an embedded (Ranked-capable) frame can never select the
  ten-area world. The intended playtest path is the top-level standalone page.
- On an unofficial world every SDK run-summary recorder is a no-op, no
  accumulator exists, and the death camera holds no result: nothing is sent as
  `game:run-summary` / `game:score-result` / `game:game-over`.

The ten-area world is a dynamic import (`world-v2-runtime-context.mjs`); it is
not on main's initial static path.

## Contract mapping (legacy key → ten-area source)

| Legacy key | Ten-area source (`world-v2-runtime-world.mjs`) |
| --- | --- |
| `id` / `displayName` / `version` | `ten-area-frontier`, "Crypto Wasteland: Ten-Area Frontier", `2` |
| `bounds` | W3b geometry bounds 0..20000 × 0..14000, `visibleBoundaryId: ten-area-frontier-perimeter` |
| `traversalTargetSeconds` | 10–25 s (the briefs' road target) |
| `player` | speed 240, radius 24, spawn = authored MWEB Meadows inspection start (12500, 6700), protected radius 560 |
| `routeClearance` | same values as legacy |
| `districts` | the ten areas as 2D rectangles, plus `materialId` (borrowed production kit), `tier`, `center`; colours from the briefs |
| `seams` | one per regional road (midpoint, both district ids, road width) |
| `routeGraph` / `routes` | fourteen roads (`paved→main`, `gravel→street`, `path→loop`) plus every authored local inspection path (`local:true`, width 160); nodes deduplicated by coordinate |
| `baseSurface` / `surfaces` | the W3b geometry: non-walkable closed-mass base, area floors, road segments and joins, water, bridges, ramps, decks |
| `blockers` | every collision blocker with `anchor`, `visualKind` (mass→building, cliff→cliff, cover-tall→containers, cover-short→fence), `shape`, `maxZ`, `districtId` (null for closed masses) |
| `collisionBlockers` / `visibleBarriers` | geometry blockers (581) and one hard barrier per blocker |
| `perimeter` | four sides, cause `closed-mass-and-guards` |
| `crossings` / `legalAscents` | authored bridge and ramp pieces |
| `landmarks` | one per area at its `landmark-view` site, placeholder glyph from an existing landmark kit |
| `pointsOfInterest` | one cache per area at its authored `secret` site; hooks are existing interaction glyphs |
| `encounterArenas` | all ten authored courts (radius 600); four carry `bossId` (Liquidator/City, Rug Pull Baron/River, Lockkeeper/Bayou, 51% Foreman/Fortress) |
| `interactions` | `{ destructibles: [], hazards: [], explosiveZones: [] }` |
| `spawnPoints` | the 28 road entrances (`<entrance>-spawn`, region `<area>-perimeter`), audited walkable, clear and outside the protected disc |
| `reveal` | cell 240, radius 420 (84 × 59 cells) |
| extras | `groundPaths: []` (no legacy ground paths drawn), `artPlans` (below), `sourceMapId` |

`auditWorldV2()` mirrors `auditLevelOneWorld()`: road-network connectivity from
the spawn node, bounds, district overlap, collision audit, unique feature ids,
spawn/POI clearance and district membership. Five authored local paths in the
Bayou and Coast share no node with the road network; they are reported as
`detachedRouteIds`, not failures, because physical reachability is proven by the
real nav-grid checker in the tests.

## Consumer audit (main.mjs and modules)

In `main.mjs`, `LEVEL_ONE_WORLD` is now the runtime binding for the map this
page runs as Level 1 (the legacy import is `LEGACY_LEVEL_ONE_WORLD`); it is set
once by `adoptWorldContext` together with `HMH_WORLD_CONTEXT`, the derived
bounds/blocker/ground/reveal tables and the run-summary switch. Every existing
call site keeps reading that one name, so the verifier-parity and runtime
wiring pins on `main.mjs` hold byte for byte, while legacy-only art placements
are gated on `HMH_WORLD_CONTEXT.legacy`. Keys actually read by consumers:

- main: `bounds`, `collisionBlockers`, `blockers` (visualKind map), `interactions.hazards`, `player.{spawn,maxSpeed,radius}`, `spawnPoints`, `pointsOfInterest`, `encounterArenas`, `districts`, `id`
- world-production-art / static bake: `districts` (id, area, and now `materialId`), `surfaces`, `routes` + `routeGraph.nodes`, `blockers`, `landmarks`, `pointsOfInterest`, `interactions.*`, `groundPaths`
- world-atmosphere: `districts` (id, area); unknown ids fall through safely
- enemy-navgrid: `bounds`, `collisionBlockers`
- world-design-field-map: `bounds`, `routeGraph.nodes`, `routes`, `surfaces`
- terrain-area-streaming (legacy-only flag): `districts`, `surfaces`, `blockers`
- authored-prop-layout (legacy-only): `spawnPoints`, `routeGraph`, `surfaces`, `bounds`, `collisionBlockers`, `encounterArenas`, `pointsOfInterest`
- level-entry / level-briefing / mission-objectives / boss-arenas / encounter-director: legacy tables keyed by legacy ids, now paired with world-keyed tables

World-keyed tables (`world-v2-gameplay.mjs`) reach the existing seams without
changing the legacy tables: `createMissionState(seed, { objectives, bossZones })`,
`createBossSlots({ seed, definitions })`, `stepEncounterDirector({ roleGates })`,
`resolveLevelBriefing({ briefing })`, and a `selectLevelEntry` wrapper. Legacy
calls stay byte-identical (the verifier parity pins on `main.mjs` still hold).

## What is playable

- Walk, dodge, shoot, melee, grenades, weapon pickups, level-ups, HUD, field map and reveal on the full ten-area map with the real nav grid (334 × 234 cells).
- Enemies spawn from the road entrances of the current area with a conservative role gate per area tier (Meadows: rusher/flanker … Fortress: all six roles).
- Two mission rings: the Meadows relay (quick press, +30 health) and a Rugpull Woods supply winch (channel crank under camp pressure, ammo refill) as a stand-in for a real camp-clear rule.
- The Liquidator: the Closing Bell ring in the Litecoin City exchange court (ready at the contract's 36,000 ticks) starts him on a 1,050 × 460 lock floor with the legacy podium/chart layout, retreat ring included.
- Ten caches (one per area): bonus lives, Shotgun, Grenade Launcher, Machine Gun, Speed Boost, Double Damage, Hash Rail core, nuke.

## What is stubbed or deferred

- Rug Pull Baron, Lockkeeper and 51% Foreman: encounter sites only, no boss, trigger or locks.
- Most objectives: only the two rings above; no gates, secrets, seals, items, prisoners, destructibles, hazards or explosive zones on this map.
- Rare biome events (Ledger/Burner/Standard) use the ten caches as candidate sites under a borrowed legacy district id.
- Art: `world.artPlans` is the hook. Mode `greybox-fallback`; per district `{ materialId, palette, board, artTarget: null }`. The production renderer draws each area with the borrowed material kit, blockers as building/cliff/containers/fence kits and landmarks as placeholder glyphs. Meadows art target (`artTarget=meadows-v1`), area streaming, world-design placements, native barriers, town, camps and enclosures stay legacy-only until the art lanes bind them per area (fill `artPlans.districts[id].artTarget` and teach the loaders the ten-area ids).
- Run summary, score, achievements, Ranked: none. The verifier map contexts remain schema 6/7 → `forked-frontier` v1 only (`hmh-world-v2-verifier-freeze.test.mjs`).
- No browser evidence in this slice; owner playtest notes come after the root smokes it.

## Browser follow-up (same day): nav-grid boot cliff, route palette, native barriers

The root's real-child run of the URL above reached "Preparing tactical
navigation…" and `createEnemyNavGridChunked` took ~127 s (`navGridReady` at
t≈127,700 ms), then threw `Cannot read properties of undefined (reading
'routeColor')`, and `nativeBarrierStatus` stayed `loading`.

Node reproduction (`createEnemyNavGrid`, synchronous): legacy 16,000 cells /
117 blockers / 12 surfaces in ~70–100 ms; ten-area 78,156 cells / 581 blockers /
84 surfaces in ~230–315 ms, 780,968 `queryGround` calls at ~0.1 µs each (the
authored ground query already has a 256-unit surface cell index, so it is
O(local)). The walkable pass spent its time on 45.4 M blocker bounding-box
checks (every cell × every blocker) that produced only 75,702 narrow-phase
candidates; the edge pass is ~150 k swept traversals. The compute is not the
cliff: the chunked builder's idle slices (4 ms budget shortened to the idle
deadline's remaining time, then a requestIdleCallback wait) amplified ~300 ms of
work into minutes on a boot thread busy decoding art.

Fix, all inside the lazy ten-area chunk plus two exports and one guard:

- `world-v2-navgrid.mjs` builds the grid with a uniform bucket index (4 × 4
  cells per bucket) over `navBlockerBounds`; each cell tests only its bucket's
  blockers with the shared `pointInsideInflatedShape`, the same sample lattice,
  edge rules (`CONSERVATIVE_TRANSITION`) and cell order. Node: legacy 34 ms,
  ten-area 139 ms; the whole ten-area context (world + audit + gameplay + grid)
  loads in ~177 ms at the top of `boot()`.
- `world-v2-runtime-context.mjs` attaches it as `world.navGrid`;
  `createEnemyNavGridChunked` adopts a world's precomputed grid when its cell
  size, dimensions, origin and array lengths match, so the unchanged runtime
  call returns in under a millisecond with zero idle yields for this world.
  The legacy world carries no grid and slices exactly as before.
- `tests/hmh-world-v2-navgrid.test.mjs` pins the indexed walkable/edges arrays
  byte-identical to `createEnemyNavGrid` on both worlds (legacy digest
  `403a19d2…` unchanged), the adoption path, the stale-grid rejection, and the
  legacy slicing.
- `routeColor`: the road pass looked its kit up by `districtAt(x).id`; it now
  resolves through `materialKey(districtAt(x, y))` like the other district reads.
  The new test resolves every district, route start node, surface vertex,
  blocker, landmark and interaction palette for both worlds and forbids any raw
  `DISTRICT_PRODUCTION_MATERIALS[...]` read that bypasses the material key.
- Native barriers are legacy art: an unofficial world sets
  `nativeBarrierStatus = 'skipped'` and never imports the module.

Expected desktop nav-grid boot for the ten-area world is now the adoption
cost (~1 ms; `navGridBootMs` measures it), with the ~140–180 ms build having
moved to the world-context load before the renderer starts. The root re-verifies
in the browser; no browser run happened here.

## Checks

- New tests: `hmh-world-v2-runtime-world`, `hmh-world-v2-gameplay`, `hmh-world-context`, `hmh-world-v2-verifier-freeze` — 20/20.
- Affected existing suites (bundle offsets, shell, prisoners, camp props, enclosures, mission combat, boss slots, director, level-one world, secrets, boss/mission determinism, production art, genesis seal, briefing, entry, mission objectives, verifier plausibility and map context) pass unchanged, except the pre-existing `built child bundle exists` case that needs a build.
- `node scripts/syntax-check.mjs`: passes with the eight new entries.
- Full `npm test`: 6431 tests, 6357 pass, 74 fail; the identical 74 failures (missing generated asset/LFS files, dist-dependent vendor checks, pre-existing pinned-source drifts) fail on the untouched base commit 7ddfb0ea5 (6411/6337/74). This slice adds 20 passing tests and no failure.
- After the nav follow-up: `hmh-world-v2-navgrid` 4/4; the affected suites (enemy navgrid, boot responsive, world size diagnostics, production art, shell, bundle offsets, hazards, design interactions, terrain strips and the four W4a tests) 124/124; syntax check passes. Build after the follow-up: HMH initial + shared 1,047,161 B (1,415 B under the cap; the integration head sat at about 1.7 KB, so the two exports, the precomputed-grid adoption guard and the barrier skip cost roughly 300 B of shared code; the index itself lives in the lazy chunk).
- Normal build (`node build.mjs`, before the nav follow-up) resolves; the ten-area world is one lazy chunk (`world-v2-runtime-context-*.js`) imported only dynamically from `game.js`. HMH initial + shared JavaScript 1,046,146 B (2,430 B under the 1,048,576 B cap); STACKED 581,120 B.
