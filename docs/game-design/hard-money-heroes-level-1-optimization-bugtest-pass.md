# Hard Money Heroes Level 1 Optimization + Bug Test Pass

Date: 2026-06-30

## Goal

Improve the Level 1 8-minute swarm curve after the first balance pass, then bug-test the runtime seams that can fail when the screen is dense with enemies, XP gems, power-ups, floating text, and VFX.

## Bugs found

### Liquidation Nuke could bypass the final boss extraction gate

The `screenNuke` power-up killed enemies through a separate code path:

- marked enemies dead
- called `killEnemy(enemy)` directly
- manually added a tiny XP gem
- wiped `combat.enemies = []`

That bypassed the new Level 1 final-boss proxy side effects. If the nuke killed the temporary boss proxy, the game could leave:

```text
combat.bossDefeated === false
combat.scriptedBossTriggered === true
```

That means extraction could stay blocked after the boss was dead.

## Fix

Added a shared roguelike death resolver in:

```text
apps/portal/main.js
```

```js
resolveRoguelikeEnemyDeath(enemy, options)
```

Now normal combat kills and screen-nuke kills both:

- call `killEnemy(enemy)`
- award XP through `calculateRoguelikeKillXp(...)`
- track kills by enemy type
- trigger rare/normal drops when allowed
- detect `enemy.finalBossProxy`
- set `combat.bossDefeated = true`
- release the boss scroll lock
- allow extraction to spawn

The nuke no longer wipes the enemy array directly before boss-gate side effects run.

## Optimization model added

Added Level 1-specific helpers in:

```text
apps/portal/src/arcade-core.mjs
```

```js
levelOneRoguelikePickupAssistAt({ elapsedSeconds, activeEnemies })
levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds, activeEnemies, reduceMotion })
```

### Pickup assist

Late-game swarms require players to kite in circles. XP and drops now become easier to collect as the 8-minute wall approaches:

- XP attraction radius scales up
- XP attraction speed scales up
- XP TTL scales from `900` to `1260` frames
- power-up TTL scales from `720` to `900` frames
- loose XP gems cap at `180`
- loose power-ups cap at `42`

This keeps the fight-swarms loop rewarding without letting reward arrays grow forever.

### VFX/readability budget

The 8-minute wall can allow about 100 enemies, so visual spam is now capped:

- particle budget scales from `210` opening to `150` at wall
- floating text budget scales from `84` opening to `64` at wall
- hit sparks sample every third hit at the wall instead of every hit
- death bursts shrink to `0.62x` at the wall
- reduce-motion mode applies an additional `0.58x` visual budget

This is cosmetic-only and does not reduce damage, XP, coins, or enemy pressure.

## Runtime wiring

Updated:

```text
apps/portal/main.js
```

Wired the new helpers into:

- `updateParticles(...)`
- `updateFloatingTexts(...)`
- `damageEnemy(...)`
- `killEnemy(...)`
- `updateRoguelikeXpGems(...)`
- `spawnRoguelikePowerUp(...)`
- `updateRoguelikePowerUps(...)`
- `applyRoguelikePowerUp(...)` screen-nuke path

## Regression tests

Updated:

```text
tests/arcade-core.test.mjs
```

New tests assert:

- late-swarm pickup assist makes rewards more collectible
- loose XP/power-up caps prevent unbounded arrays
- late-swarm particle/text budgets cap visual spam
- reduce-motion lowers particle budgets further
- `main.js` contains a centralized death resolver
- screen nuke uses that resolver instead of directly wiping `combat.enemies`

## Remaining risks

- Still needs a hands-on feel pass for whether `150` particles and `64` texts are the right visual caps.
- The final boss proxy still uses enemy AI plus scaled stats; bespoke boss phases are still future work.
- Browser smoke catches startup/click/runtime errors, but not long-duration human combat feel.


---

# Layout v4 and late-run optimization implementation


Date: 2026-07-14
Level: `level-1-crypto-wasteland`
Deterministic seed: `1337`

## Release intent

This pass improves Level 1 without replacing the certified 100×100 World v3 terrain/navigation grid. The new layout is an authored encounter and art-composition layer over the existing collision-backed map.

The guiding rule is simple: use more deliberate spaces and better threat composition, not more simulation noise.

## Audit findings

| System | Previous condition | Risk |
| --- | --- | --- |
| Macro layout | The terrain graph was complete, but runtime prefab composition used only three far-field stamps. | Large districts could feel sparse or visually disconnected from their POI identity. |
| Boundaries | Collision strips were continuous, but visible asset selection lived in a separate hardcoded function. | Art and collision could drift during later edits. |
| Spawning | The late director approached 140 active enemies with a 0.34 second interval. | Excessive AI, collision, animation, sorting, projectile, and reward-array pressure. |
| Separation steering | Every enemy used a full-list scan, but stopped after ten nearby matches. | At 140 bodies the broad scan was excessive; at the new 64-body cap it needed measurement before adding indexing overhead. |
| AI movement | Every enemy resolved obstacle/water movement every step regardless of distance. | Offscreen enemies consumed the same pathing budget as immediate threats. |
| Attacks | Individual timers could align across the swarm. | Unreadable simultaneous melee and ranged attacks, plus hostile projectile soup. |
| Rendering | Every enemy entered animation priority and draw-list work even when outside the viewport. | Avoidable sort, animation lookup, and canvas draw overhead. |
| Ground art | World v3 already used one authoritative terrain-family map with material-backed transitions. | Replacing it with another tile system would add inconsistency instead of fixing it. |

## Layout v4: dual-loop pressure map

The new contract is `level-1-crypto-wasteland-layout-v4` in `apps/portal/src/hmh-level-one-world-v3-gameplay.mjs`.

### Route structure

1. **Broken Road Salvage Run**
   - Safe movement read and first packs.
   - Open road center with roadside cover.
2. **Ghost Town Main Street**
   - Cover duel and first mini-boss language.
3. **North Risk Loop**
   - Dry Forest Ridge → Mesa Overlook → Crossroads.
   - Ambush reads, tree-wall gaps, logs, mushrooms, and stronger elite pressure.
4. **South Reward Loop**
   - Old Hashrate Camp → Silver Wallet Lakeside → Crossroads.
   - Open salvage arena, cache pressure, shoreline recovery, and ford play.
5. **Crossroads Convergence**
   - Both loops reconnect through four readable lanes.
6. **Frontier Town Pressure Ring**
   - Late-run cross-shaped movement lanes with perimeter buildings.
7. **Rugpull Gulch Final Ring**
   - Clear telegraph core, edge cover, boss gate, rematches, and extraction reveal.

Both optional loops end at `crossroads-trading-post`; the final approach ends at `extraction`. Combat-zone centers remain passable World v3 cells and retain at least five tiles of negative space.

## Asset and tile-art improvements

The live World v3 object layer now consumes 20 curated v4 prefab placements instead of three. The composition uses shipped production stamps only; stamps explicitly retired by the existing asset tests remain retired.

Key art clusters include:

- Desert salvage wall and roadside arcade cache at spawn.
- Ghost-town frontage, bank plaza, and civic pocket.
- Forest cliff, log arena, and mushroom ring.
- Hashrate bone yard.
- Canal/ford and waterfront scenes around the lakeside loop.
- Roadside vehicle micro-scenes at the convergence.
- Farmstead and neighborhood composition at Frontier Town.
- Route-town, rock-camp, and container-yard silhouettes around Rugpull Gulch.
- Glow bank and extraction-yard compositions on the final route.

Ground art remains controlled by World v3 terrain families and their `world-v3-material/*` keys. This is intentional. World v3 already provides:

- One material truth per authored terrain family.
- Explicit bridge and water roles.
- Adjacent-cell transition metadata.
- No procedural checkerboard selection in curated Level 1.
- A packed-dirt raster fallback when a requested curated texture is unavailable.

The visual upgrade therefore comes from coherent district staging and boundary families rather than introducing another competing tile resolver.

## Borders, boundaries, collision, and wall detection

The v4 layout owns side-specific visible boundary palettes:

- **North:** forest rock outcrops and canyon ridge pieces.
- **South:** dragon bones, grounded rocks, and brown ruin caps.
- **West:** one coherent canyon straight/bend/buttress kit.
- **East:** container lines and blue/brown ruin walls.

`buildLevelOneBoundaryObstaclesNear` now consumes that same palette contract. Collision remains side-oriented overlapping polygons:

- North/south strips follow the horizontal visible edge.
- East/west strips follow the vertical visible edge.
- Adjacent strips overlap by 0.15 tiles to prevent pass-through seams.
- Visible asset, footprint, scene role, side, and collision polygon ship in one obstacle record.

The expanded solid object layer still passes route reachability to every critical and optional World v3 anchor. POI arena cores and the spawn lane stay clear.

## Pathing and AI behavior

### Measured capped separation

A deterministic 1.2-tile spatial hash was implemented and benchmarked against the existing ten-neighbor early-exit scan. In Node/V8, Map-backed bucket traversal was 4.21× slower at 64 enemies and 2.79× slower at 140 enemies because string-key lookup and bucket traversal cost more than the capped scan.

The shipping runtime therefore keeps the allocation-free ten-neighbor scan at the new 64-body ceiling. Distance-based AI cadence below reduces how often mid/far enemies invoke it. The spatial helper remains covered as a deterministic stress-tool option, but it is intentionally not used in the live 64-body loop.

### Distance-based movement cadence

Only steering-direction and separation refreshes are throttled:

- 0–12 tiles: every step.
- 12–24 tiles: every second step.
- Beyond 24 tiles: every third step.
- Bosses and mini-bosses: every step at every distance.

Cached velocity is applied through bounded obstacle/water collision every simulation step, with movement `dt` capped at 50 ms. This preserves average movement speed without letting distant enemies stride through narrow walls or terrain seams. Attack timers, telegraphs, damage windows, and projected screen positions remain full-rate.

### Authored spawn lanes

Generic Level 1 spawns now choose deterministic lane angles from the nearest v4 combat zone. The existing finite-map resolver still performs the final safety pass for:

- Minimum player distance.
- Water rejection.
- World bounds.
- Dry fallback arcs.

Scripted POI and boss spawns retain their authored encounter slots.

Generic spawn burst count and spawn-timer advancement now occur only after the exact selected archetype passes its weighted budget check and is inserted. A budget-rejected candidate breaks the burst without consuming the pending spawn tick, allowing the director to retry safely on the next frame.

## Late-run spawning and balance

The old 140-enemy ceiling is replaced with quality-over-quantity pressure.

| Director control | Opening | Late cap |
| --- | ---: | ---: |
| Active enemy ceiling | 14 | 64 |
| Weighted threat budget | 16 | 60 |
| Simultaneous attack tokens | 2 | 5 |
| Hostile projectile ceiling | 20 | 72 |
| Catch-up spawn burst per update | 1 | 3 |
| Health multiplier | 1× | 2× |
| Damage multiplier | 1× | 1.35× |
| Animated enemy budget | 56 | 36 under pressure |

Threat costs are weighted:

- Basic melee: 1.0.
- Basic ranged: 1.35.
- Elite: +1.4 before affixes.
- Mini-boss: 6.
- Boss: 12.

Late difficulty continues to scale through elite share, archetype mix, pack cohesion, pattern density, threat beats, boss rematches, and a 2× health ceiling. It does not rely on unbounded body count or additional HP inflation.

### Attack-token behavior

- Normal enemies acquire a token only inside a real engagement gate.
- Melee enemies cannot reserve tokens from across the map.
- Bosses and mini-bosses have token priority.
- A token covers wind-up through attack and is released on attack, recovery, or leaving engagement range.
- Ranged attacks wait eight frames when the hostile projectile budget is saturated.

### Render optimization

Enemies outside a 180-pixel viewport margin remain simulated and visible to minimap logic, but are excluded from:

- Animation-priority sorting.
- Per-enemy draw-list insertion.
- Sprite-frame lookup and canvas draw calls.

## Deterministic verification contract

New tests cover:

- Dual-loop route graph and convergence.
- World v3 anchor validity.
- Passable combat-zone centers and negative-space radii.
- Production prefab resolution and retired-stamp exclusion.
- Deterministic authored spawn lanes.
- Side-specific boundary palettes.
- Fully passable 5×5 bridge decks.
- Weighted threat costs and late-run caps.
- Spawn-budget saturation.
- Separation determinism plus a runtime guard against the measured-slower spatial path at the 64-body cap.
- AI steering cadence, boss priority, and repeated low-FPS collision steps against narrow walls and water banks.
- Runtime consumption of burst, attack, projectile, steering, and budget controls.

Existing tests continue to cover:

- Full seed-1337 POI reachability.
- Route-preserving solid footprints.
- Boundary collision continuity.
- Finite-map spawn safety.
- Water, road, bridge, and ford traversal.
- Wall and projectile collision.
- Open-ended survival and boss rematches.

## Deferred visual opportunities

These are art improvements, not collision/pathing blockers:

1. Road-to-town transition corner tiles.
2. Shoreline and ford edge variants.
3. Boss-yard boundary cap variants.
4. Saloon-specific cover props.
5. Desert-camp connective prop kit.
6. Extraction-pad readability kit.

They should be produced only after the v4 layout receives a complete human playthrough and layout-lock approval.
