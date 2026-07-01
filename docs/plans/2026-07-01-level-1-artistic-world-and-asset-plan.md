# Level 1 Artistic World + Asset Production Plan

> **For Hermes:** Use `hard-money-heroes-level-production`, `authored-level-design-integration`, `procedural-to-authored-level-design`, and `subagent-driven-development` before implementing this plan task-by-task.

**Goal:** Replace the current Level 1 Crypto Wasteland look with a coherent authored isometric roguelike world: readable roads, intentional arenas, memorable landmarks, cohesive ground/prop kits, and enemy sprites/animations that match the playable heroes' quality bar.

**Architecture:** Use an authored-hybrid roguelike model: fixed macro route, authored room/arena chunks, controlled variation inside chunks, and deterministic runtime selection. Do not keep trying to make random scatter look good. Build a complete art grammar first, then generate/import runtime-ready assets, then wire the renderer to consume those assets in strict authored layers.

**Tech Stack:** Hard Money Heroes web runtime (`apps/portal/main.js`), ESM design/runtime modules under `apps/portal/src/`, generated manifests under `apps/portal/assets/generated/`, authored/game-design docs under `docs/game-design/`, Node tests under `tests/`.

---

## 1. Research-backed design principles

### 1.1 Procedural generation is not the art direction

Research takeaway: procedural generation is useful for replayability and content volume, but by itself it creates repetitive, boring, or chaotic worlds when not bounded by authored structure. Game Developer's procedural-generation overview explicitly calls out the tradeoff: procedural environments expand content but can produce repetitive gameplay and boring worlds if used as the primary design layer.

**HMH rule:** Level 1 should not be “procedural with props sprinkled in.” It should be an authored route graph with procedural variation only inside approved chunks.

Source: Game Developer, “Going Rogue-like: When to use Procedurally Generated Environments in Games”  
https://www.gamedeveloper.com/design/going-rogue-like-when-to-use-procedurally-generated-environments-in-games

### 1.2 Use a hybrid model: hand-authored chunks stitched by rules

Research takeaway: Spelunky and Dead Cells are relevant because they use constrained generation from authored pieces, not unconstrained noise. The Dead Cells team describes full procedural generation as chaotic and immersion-breaking, then settles on a restrained hybrid approach: handmade level chunks plus algorithmic selection/ordering.

**HMH rule:** Make Level 1 out of authored chunks: spawn road, gas station arena, ghost town main street, farm loop, river bridge, desert boulder road, lake/beach pocket, boss extraction yard. Each chunk gets a kit, collision rules, enemy set, and reward logic.

Sources:
- Game Developer, “Building the Level Design of a procedurally generated Metroidvania: a hybrid approach”  
  https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-
- Game Developer, “Video: Understanding the technique behind Spelunky's level design”  
  https://www.gamedeveloper.com/design/video-understanding-the-technique-behind-i-spelunky-i-s-level-design

### 1.3 Level spaces need positive/negative composition, not equal-density clutter

Research takeaway: Epic's level-design fundamentals frame level design around possibility space, player verbs, utility/denial, positive space, and negative space. Negative space gives the player readable movement/combat lanes; positive space creates identity, cover, obstacles, and areas of interest.

**HMH rule:** Every screen should have:
- a clear movement/combat lane,
- boundary mass that shapes the lane,
- one or two landmarks,
- limited set dressing,
- enemy telegraph space.

No more “fill every tile with something.”

Source: Epic Developer Community, “Level Design Fundamentals”  
https://dev.epicgames.com/community/learning/tutorials/3VKJ/unreal-engine-fortnite-level-design-fundamentals

### 1.4 Landmarks, roads, fences, lights, and artificial objects guide the player

Research takeaway: World of Level Design's Alan Wake breakdown emphasizes environmental guidance through landmarks, artificial objects, roads/paths, fences, framing/composition, lighting, sound, and focus cues.

**HMH rule:** Level 1 needs visible orientation anchors: gas station, saloon, bridge, farm silo/barn, lake pier, cliff wall, boss gate. Roads and fences should lead players, not just decorate terrain.

Source: World of Level Design, “7 Ways to Effortlessly Guide the Player with Level Design As Seen in Alan Wake”  
https://www.worldofleveldesign.com/categories/level_design_tutorials/alan-wake-guide-the-player.php

### 1.5 Isometric pixel art must obey the 2:1 grid and draw-order rules

Research takeaway: Unity's isometric tilemap guide highlights correct sorting and tile setup; Slynyrd's isometric pixel art guide emphasizes 2:1 line discipline, seamless tile surfaces, consistent cube/plane styles, and geometric construction for props.

**HMH rule:** Do not mix random top-down, side-view, 3/4, and iso-ish assets. Everything in Level 1 needs to be rebuilt or filtered to one isometric grammar:
- terrain: 2:1 diamond or matching flat iso sheets,
- props: consistent footprint and shadow direction,
- buildings: same camera angle and height scale,
- characters/enemies: same directional projection as heroes.

Sources:
- Unity, “Isometric 2D environments with Tilemap”  
  https://unity.com/blog/engine-platform/isometric-2d-environments-with-tilemap
- Slynyrd, “Pixelblog - 41 - Isometric Pixel art”  
  https://www.slynyrd.com/blog/2022/11/28/pixelblog-41-isometric-pixel-art

### 1.6 Enemy animation quality is readability first, art detail second

Research takeaway: Sprite animation guidance consistently emphasizes timing, anticipation, staging, silhouette, impact holds, and recovery. Pixel-art attacks need anticipation/telegraph frames and held impact frames; a sprite can be detailed but still feel bad if motion reads wrong.

**HMH rule:** Every enemy must have a readable silhouette, distinct color language, clear wind-up, attack, hit, recovery, and death. The enemy roster needs fewer better enemies, not many ugly proxy enemies.

Source: Sprite-AI, “The 12 animation principles adapted for pixel art sprites”  
https://www.sprite-ai.art/guides/animation-principles

---

## 2. Current HMH asset reality check

### 2.1 What exists

Current curated manifest rough inventory:

- `curated-ground`: ~1,797 entries
- `curated-prop`: ~1,018 entries
- `level-1-crypto-wasteland`: ~435 entries
- `level-1/prop`: ~155 entries
- `level-1/water-seabed`: ~120 entries
- `level-1/flora`: ~104 entries
- `universal/enemy`: ~45 entries
- `level-1/building`: ~27 entries
- `level-1/road`: ~15 entries
- `level-1/water`: ~12 entries
- `level-1/ground`: 2 entries

This means the repo has a lot of image files, but not a cohesive Level 1 gameworld. Many assets are not guaranteed to share camera angle, palette, scale, outline, shadow direction, or animation quality.

### 2.2 What is still broken

1. **Art direction is missing.** Assets exist but are not unified by a style bible.
2. **Ground kit is weak.** Two Level 1 ground entries plus a lot of sliced/proxy ground is not enough for a rich isometric world.
3. **Road kit is too small.** Fifteen road entries are not enough for curves, forks, shoulder transitions, cracked roads, painted lines, intersections, ramps, bridges, and combat arenas.
4. **Buildings are not a complete modular kit.** A handful of storefronts does not make a believable ghost town/main street/farm/gas station route.
5. **Enemy roster quality is inconsistent.** The playable heroes read better than many enemies. That means enemies need to be redesigned around silhouette, animation states, and faction identity.
6. **Runtime integration has been ahead of art production.** We have been wiring contracts and fallbacks faster than producing a cohesive final visual layer.

---

## 3. Target art direction for Level 1

### 3.1 Style target

**Working style ID:** `level1-isometric-metal-slug-crypto-wasteland-v1`

Visual keywords:

- 16/32-bit arcade pixel art
- Metal Slug object density, but Hades/Bastion-like isometric clarity
- dusty crypto ghost town + desert highway + river/lake edge + busted farmstead
- chunky readable silhouettes
- strong black/dark outline discipline on actors and interactives
- warm dusty ground palette with teal/Litecoin/cyan accents for readable gameplay objects
- environmental animation only where it improves life/readability: water, signs, lights, flags, dust, fire, coin glints

### 3.2 Palette rules

Level 1 should not use every color in every asset. Define these palettes:

1. **Ground base:** dusty tan, cracked ochre, dry grass olive, faded asphalt grey.
2. **Route/readability:** desaturated road grey, pale lane paint, lighter path edges.
3. **Hazard:** orange-red sparks/fire, purple scam energy, acid green for toxic crypto slime.
4. **Player/helpful:** teal/cyan/Litecoin silver/gold.
5. **Enemies:** each family gets a readable accent color, not random colors.
6. **Boss/extraction:** gold/black/teal, with high-contrast animated cues.

### 3.3 Scale rules

- Base iso tile: **128x64** visual diamond for ground/roads.
- Small prop footprint: 1 tile or 1x2 tiles.
- Medium prop/building footprint: 2x2 to 3x3 tiles.
- Landmark footprint: 4x3 to 6x4 tiles, but placed outside the clear lane.
- Hero/enemy sprite height should remain readable against a tile: enemies should be roughly 80-130% of hero height depending on class, bosses 180-260%.
- All props need shadow metadata and collision footprint metadata.

---

## 4. Level 1 macro layout

Level 1 should become a handcrafted route with roguelike variation, not a wide random field.

### 4.1 Critical path

1. **Spawn: Broken Highway / Litecoin Bus Stop**
   - Teach movement/shooting.
   - Open road lane with visible boundaries.
   - One gas station landmark in the distance.

2. **Gas Station Forecourt Arena**
   - First real combat bowl.
   - Pumps, canopy, wrecked car blockers, exploding barrel/destructible signage.
   - Enemy family: weak rushers + one ranged scammer.

3. **Ghost Town Main Street**
   - Linear-but-wide road spine with side alleys.
   - Storefronts/saloon/bank/front porches form hard edges.
   - Enemy family: claim jumpers, bank shooters, shield/tank variant.

4. **Farmstead Side Loop**
   - Optional risk/reward loop.
   - Crops/fences/barn/silo create maze-like but readable cover.
   - Reward: upgrade chest / Litecoin cache / grenade refill.

5. **River Bridge / Wash Crossing**
   - Narrower traversal test.
   - Bridge blockers, broken rails, animated water, shoreline hazards.
   - Enemy family: buzzards/ranged pressure; do not overload with melee.

6. **Desert Boulder Road / Mesa Cut**
   - Wider survival swarm zone.
   - Rocks, cliffs, cactus lines, dead vehicles create lanes.
   - Enemy family: coyotes, boars, runners, dust ambushes.

7. **Second Town / Extraction Yard**
   - Final readable arena.
   - Boss gate, boarded buildings, barricades, extraction beacon.
   - Boss: temporary/final Level 1 boss with bespoke animated kit.

### 4.2 Roguelike variation model

Use fixed macro order, variable chunks.

Each zone should have:

- 3-5 authored room/chunk variants
- fixed entrances/exits
- fixed minimum lane clearances
- alternate blocker layouts
- alternate reward placements
- encounter spawn slots authored per chunk
- prop dressing chosen from a small whitelist, not global random scatter

This gives replayability without looking procedurally generated.

---

## 5. Asset production backlog

### 5.1 Ground texture kit — P0

Need a complete Level 1 final ground set. These are not props; they are ground renderer assets.

**Base terrain roles:**

1. `l1-ground-dust-flat-01..06`
   - dusty neutral open ground
   - low contrast; should not fight sprites

2. `l1-ground-dust-pebbles-01..06`
   - sparse texture variation
   - used outside clear roads

3. `l1-ground-dry-grass-01..06`
   - farm/shoulder/soft edge

4. `l1-ground-dead-grass-transition-n/s/e/w/corners`
   - blends dirt to grass

5. `l1-ground-rocky-shoulder-01..06`
   - mesa/cliff edges and boulder road shoulders

6. `l1-ground-scorched-crypto-ash-01..04`
   - boss/extraction corruption patches

7. `l1-ground-town-dust-01..04`
   - under buildings/boardwalks/ghost town lots

**Acceptance:**

- All ground tiles are 2:1 iso, seamless enough in 3x3 contact sheet.
- No high-frequency checkerboarding.
- Road/grass/rock transitions exist.
- Runtime selector can pick by authored zone role.

### 5.2 Road and path kit — P0

The current road kit is not enough. Need a full authored path language.

**Road tiles:**

1. Straight asphalt: NE/SW and NW/SE orientation.
2. Dirt road straight: two orientations.
3. Curves: four corners.
4. T-junctions: four directions.
5. Crossroads.
6. Road-to-dirt transition.
7. Road-to-town-plaza transition.
8. Cracked road variants.
9. Painted center line variants.
10. Broken lane paint variants.
11. Road shoulder left/right/top/bottom.
12. Pothole/debris non-blocking decals.
13. Combat arena road plaza center.
14. Gas station forecourt concrete slab.
15. Boss yard cracked blacktop.

**Acceptance:**

- Player can always tell where the main path is.
- Road visuals create direction from spawn through town/desert/extraction.
- Road assets are ground-layer only, not obstacle props.

### 5.3 Water, shoreline, and bridge kit — P0/P1

Level 1 needs water to break up the desert and create memorable geography.

**Water/shore assets:**

1. Animated river water strip, 4-8 frames.
2. Animated lake water tile, 4-8 frames.
3. Shallow ford tile.
4. Muddy shoreline transitions: N/S/E/W/corners.
5. Sand beach transition.
6. Rocks-in-water variants.
7. Water foam/current highlight.
8. Toxic crypto runoff variant for boss area.

**Bridge assets:**

1. Wooden bridge center.
2. Wooden bridge entrance/exit caps.
3. Broken bridge rail left/right.
4. Metal highway bridge center.
5. Bridge shadow underpass.
6. Bridge barricade/destructible rail.

**Acceptance:**

- Water animates subtly.
- Bridge is a readable choke point with clear boundaries.
- Shoreline does not look like a rectangular cutout.

### 5.4 Elevation, cliffs, boulders, and boundaries — P0

The map needs real edges, not invisible bounds or random rocks.

**Assets:**

1. Mesa cliff wall segments: straight, inner/outer corners.
2. Low dirt embankment segments.
3. Boulder wall large/medium/small.
4. Cactus barrier line variants.
5. Broken fence line variants.
6. Guardrail / road barrier variants.
7. Building-wall boundary row.
8. Junk barricade / tires / wrecked car blocker.
9. Riverbank cliff edge.
10. Extraction-yard fence/gate.

**Acceptance:**

- Boundaries are diegetic and readable.
- Collision footprint matches art footprint.
- Boundaries guide routes and arenas instead of scattering randomly.

### 5.5 Landmark kit — P0

Landmarks are the main cure for the “procedural shit” feel.

**Required landmarks:**

1. `l1-landmark-gas-station-canopy`
2. `l1-landmark-gas-pump-cluster`
3. `l1-landmark-saloon-front`
4. `l1-landmark-boarded-bank`
5. `l1-landmark-general-store`
6. `l1-landmark-farmhouse`
7. `l1-landmark-barn`
8. `l1-landmark-silo`
9. `l1-landmark-river-bridge`
10. `l1-landmark-mesa-cliff-gate`
11. `l1-landmark-boss-yard-gate`
12. `l1-landmark-extraction-beacon`

**Acceptance:**

- Each landmark has a unique silhouette at gameplay camera scale.
- Each landmark has at least one damaged/variant state if used in combat.
- Landmarks sit outside clear lanes unless explicitly used as cover.

### 5.6 Modular town/farm building kit — P0/P1

The current Level 1 buildings do not form a complete town.

**Ghost town kit:**

1. Storefront wall segments.
2. Porch/floor boardwalk ground tiles.
3. Saloon front modular pieces.
4. Bank front modular pieces.
5. Boarded windows/doors.
6. Corner building pieces.
7. Alley wall pieces.
8. Roof edge/shadow pieces.
9. Signage: SALOON, BANK, LITE MART, CLOSED, RUGPULL REALTY.

**Farmstead kit:**

1. Farmhouse.
2. Barn front/side.
3. Silo.
4. Crop rows: corn/wheat/dead crop.
5. Fence straight/corner/gate/broken.
6. Hay bales.
7. Trough/well/water tank.
8. Tractor/wrecked farm truck.
9. Farm dirt driveway tiles.

**Acceptance:**

- Buildings align to iso grid.
- Building base/shadow integrates with ground.
- Buildings form hard route edges and arena walls.

### 5.7 Small prop and set dressing kit — P1

These are support, not the level design.

**Props:**

1. Barrels: normal/explosive/destroyed.
2. Crates: intact/damaged/broken.
3. Road signs: route arrow, warning, Litecoin, boss warning.
4. Tires, cones, barricades.
5. Trash piles, but stylized and limited.
6. Dead shrubs, cactus clusters, tumbleweed loop.
7. Benches, bus stop sign, mailbox.
8. Wanted posters / crypto scam signs.
9. Coin cache / Litecoin crate.
10. Upgrade shrine / vending machine / arcade cabinet, scaled properly.

**Acceptance:**

- Prop density caps per screen.
- Props have role metadata: blocker, cover, reward, hazard, dressing.
- Dressing props never obstruct the clear combat lane unless intentionally authored.

### 5.8 Interactive/destructible kit — P1

These make the map feel alive and support roguelike combat.

**Assets:**

1. Explosive barrel: idle, fuse, explode, debris.
2. Gas pump: idle, damaged, leak, explosion.
3. Road flare: idle, glow loop.
4. Barricade: intact, cracked, destroyed.
5. Bridge rail: intact, broken.
6. Boss gate: closed, damaged, open.
7. Loot cache: closed, open, empty.
8. Upgrade shrine: inactive, active, spent.
9. Water hazard warning sign: idle, flicker.
10. Crypto terminal: active, hacked, destroyed.

**Acceptance:**

- Every interactive has state art.
- Every interactive has collision + HP metadata.
- Damage state remains visible after destruction.

### 5.9 Ambient animation kit — P1/P2

Use sparingly.

**Assets:**

1. Animated water.
2. Flickering neon sign.
3. Wind-blown sign.
4. Dust devil small loop.
5. Tumbleweed loop.
6. Fire/smoke loop.
7. Spark/shorting crypto terminal.
8. Coin glint loop.
9. Boss beacon pulse.
10. Liteforge extraction glow.

**Acceptance:**

- Ambient animation capped by performance budget.
- Loops do not distract from bullets/enemies.

### 5.10 Combat VFX kit — P1

The game cannot look AAA-ish if hits, blood, grenades, and muzzle flashes feel placeholder.

**Assets/VFX:**

1. Small muzzle flash per hero weapon.
2. Bullet tracer variants.
3. Enemy hit spark.
4. Armor hit spark.
5. Blood burst small/medium.
6. Death poof/debris.
7. Grenade explosion: windup, blast, smoke.
8. Barrel explosion.
9. Shockwave ring.
10. Pickup glint.
11. Boss telegraph marker.
12. Extraction beam.

**Acceptance:**

- VFX support readability, not screen spam.
- Player shots, enemy shots, hazards, pickups have different color language.

---

## 6. Enemy art production plan

### 6.1 Enemy quality bar

Current issue: playable heroes look semi-decent; many enemies look cheap, mismatched, or badly animated.

New rule: ship fewer enemy families, but make each one readable and complete.

Every enemy needs:

- 8-direction idle
- 8-direction walk/run
- 8-direction attack-tell / wind-up
- 8-direction attack
- 8-direction hit/stagger
- 8-direction death
- optional special/elite tell
- strong silhouette from gameplay camera
- unique palette accent
- collision/hitbox tuned to sprite size

Recommended timing:

- idle: 2-4 frames, 300-500ms/frame
- walk: 4-6 frames, 100-150ms/frame
- run: 6-8 frames, 60-100ms/frame
- attack tell: 1-2 frames, held enough to read
- attack impact: 1-2 frames, 120-200ms hold
- recovery: 1-2 frames
- death: 4-8 frames or sprite + VFX burst

### 6.2 Cut the Level 1 enemy roster to readable families first

Do not try to polish 30 enemies at once. Level 1 should start with 8 excellent enemies and 2 bosses/minibosses.

#### P0 Level 1 enemy families

1. **FUD Goblin / Scam Gremlin**
   - Small rusher.
   - Silhouette: hunched, big head, claw/device.
   - Color: sickly green/purple accent.
   - Attack: short lunge with clear crouch anticipation.

2. **Crypto Bro Rusher**
   - Human melee/rush enemy.
   - Silhouette: varsity jacket, phone/diamond hands.
   - Color: orange/pink meme accent.
   - Attack: shoulder charge or punch wind-up.

3. **Claim Jumper Bandit**
   - Mid-range shooter.
   - Silhouette: cowboy/raider hat, rifle/shotgun.
   - Color: dusty red accent.
   - Attack: clear aim tell, muzzle flash.

4. **Evil Banker / Repo Shooter**
   - Ranged pressure.
   - Silhouette: suit, money bag/tablet, pistol.
   - Color: black/gold/white.
   - Attack: ledger/contract tell before projectile.

5. **Coyote Pack Runner**
   - Fast animal/melee pressure.
   - Silhouette: low body, high tail, dust streak.
   - Color: tan with red eye accent.
   - Attack: pounce tell.

6. **Wild Boar Tank**
   - Heavy charger.
   - Silhouette: large body, tusks.
   - Color: brown/grey.
   - Attack: paw scrape, charge lane telegraph.

7. **Buzzard / Vulture**
   - Flying harasser.
   - Silhouette: wide wings.
   - Color: dark brown/purple.
   - Attack: swoop tell with shadow.

8. **Rattlesnake / Rugpull Serpent**
   - Area denial.
   - Silhouette: coiled snake, raised head.
   - Color: yellow/green hazard accent.
   - Attack: coil shake, spit/projectile or lunge.

#### P0 bosses/minibosses

1. **Gas Station Mini-Boss: Rugpull Pump Brute**
   - Big gas-station mutant/scammer with pump hose/flame hazard.
   - Needs intro, idle, walk, attack-tell, attack-slam, attack-ranged/leak, hit, death.

2. **Level 1 Boss: Chain Reaper / Repo Baron**
   - Final extraction-yard boss.
   - Needs full bespoke animation and multi-phase telegraph language.

### 6.3 Enemy rejection criteria

Any enemy sprite should be rejected if:

- it is front-view/top-down/side-view while heroes are iso,
- it has no readable silhouette at gameplay size,
- it lacks attack anticipation,
- it uses muddy colors that disappear into ground,
- it is visually lower quality than the hero sprites,
- it only has one direction unless used as temporary prototype art,
- it resembles the old goblin/zombie garbage art we are trying to remove.

---

## 7. Chunk/room asset plan

### 7.1 Each authored chunk needs these layers

1. Ground role map.
2. Road/path map.
3. Hard boundary objects.
4. Soft dressing objects.
5. Landmark object(s).
6. Enemy spawn slots.
7. Reward slots.
8. Hazard/interactable slots.
9. Camera/readability safe zone.
10. Transition exits.

### 7.2 P0 chunks to build

#### Chunk A: Spawn Broken Highway

Assets needed:
- broken road straight/fork tiles
- bus stop sign
- road shoulder rocks
- cactus/fence boundary
- distant gas station landmark
- neutral training enemies only

#### Chunk B: Gas Station Arena

Assets needed:
- forecourt concrete
- canopy landmark
- pumps
- wrecked cars
- tire stacks
- explosive barrels/gas pump states
- convenience-store facade

#### Chunk C: Ghost Town Main Street

Assets needed:
- saloon/bank/general store modular fronts
- boardwalk tiles
- alley blockers
- signs/posters
- balcony/porch props
- road center lane

#### Chunk D: Farmstead Side Loop

Assets needed:
- farmhouse/barn/silo
- crop rows
- fences/gates
- hay bales
- tractor/wrecked truck
- dirt driveway

#### Chunk E: River Bridge

Assets needed:
- animated river tiles
- bridge tiles/rails
- shore transitions
- water rocks
- narrow combat slot boundaries

#### Chunk F: Desert Boulder Road

Assets needed:
- mesa cliff walls
- boulder clusters
- cactus barriers
- dust/tumbleweed loops
- open swarm lanes

#### Chunk G: Extraction Yard / Boss Arena

Assets needed:
- boss gate
- barricades
- cracked blacktop
- extraction beacon
- boss-specific hazard decals
- damaged/final-state props

---

## 8. Implementation phases

### Phase 0: Stop the bleeding

Objective: prevent bad art from continuing to appear.

Tasks:

1. Add an explicit Level 1 art allowlist.
2. Add an enemy allowlist for Level 1 runtime.
3. Disable every old proxy enemy fallback in Level 1.
4. Add tests that fail if old goblin/zombie/loading-keyart/enemy-wave art enters Level 1.
5. Add a browser-smoke screenshot checklist.

### Phase 1: Build the Level 1 art bible

Files:

- Create: `docs/game-design/hard-money-heroes-level-1-art-bible.md`
- Create: `apps/portal/src/hmh-level-one-art-direction.mjs`
- Test: `tests/hmh-level-one-art-direction.test.mjs`

Contents:

- style ID
- palette IDs
- asset dimensions
- scale rules
- allowed enemy families
- ground/path/landmark rules
- rejection criteria

### Phase 2: Generate/import final ground + road kit

Files:

- Create generated assets under `apps/portal/assets/generated/hmh-level-one-final-ground/`
- Create manifest: `hmh-level-one-final-ground.mjs`
- Modify selector: `apps/portal/src/hmh-ground-selection.mjs`
- Test: `tests/hmh-level-one-ground.test.mjs`

Acceptance:

- road/plaza/dust/grass/rock/water transition roles exist
- selector returns final Level 1 assets before fallback assets
- 3x3 contact sheet passes visual inspection

### Phase 3: Build authored chunk contracts

Files:

- Create: `apps/portal/src/hmh-level-one-authored-chunks.mjs`
- Test: `tests/hmh-level-one-authored-chunks.test.mjs`

Each chunk contract must include:

- id
- zone role
- entry/exit anchors
- ground role map
- landmark IDs
- boundary IDs
- spawn slots
- reward slots
- interactives
- required asset keys

### Phase 4: Landmark + boundary production

Files:

- Generate/import under `apps/portal/assets/generated/hmh-level-one-landmarks/`
- Manifest: `hmh-level-one-landmarks.mjs`
- Contact sheet: `docs/game-design/contact-sheets/hmh-level-one-landmarks.png`

Acceptance:

- gas station, saloon, bank, farm, bridge, boss gate are present
- all have footprint/collision metadata
- no landmark blocks the clear lane unless intentional

### Phase 5: Enemy redesign P0 roster

Files:

- Generate/import under `apps/portal/assets/generated/hmh-level-one-enemies-final/`
- Manifest: `hmh-level-one-enemies-final.mjs`
- Modify: `apps/portal/src/hmh-encounter-visuals.mjs`
- Tests: enemy manifest coverage + runtime mapping tests

P0 enemy assets:

- fud goblin/scam gremlin
- crypto bro rusher
- claim jumper bandit
- evil banker/repo shooter
- coyote runner
- wild boar tank
- buzzard/vulture
- rattlesnake/rugpull serpent
- Rugpull Pump Brute mini-boss
- Chain Reaper/Repo Baron boss

Acceptance:

- every P0 enemy has idle/walk-or-run/attack-tell/attack/hit/death
- 8 directions for all grounded enemies
- flying enemy at least 4 or 8 directions with shadow/swoop tell
- attack tell frames are visually distinct
- no old bad enemy art remains in Level 1

### Phase 6: Runtime integration

Files:

- Modify: `apps/portal/main.js`
- Modify: `apps/portal/src/hmh-level-one-visible-runtime.mjs`
- Modify: `apps/portal/src/hmh-campaign-runtime.mjs`
- Modify: `apps/portal/src/scene-templates.mjs`

Integration rules:

1. Ground from final ground selector.
2. Chunks from authored chunk contracts.
3. Props only from chunk allowlists.
4. Enemy spawns from chunk spawn slots + pressure director.
5. Interactives from chunk interactives.
6. Old procedural scatter only allowed outside authored Level 1 chunks and only after art-direction filters.

### Phase 7: Browser QA and art review gate

Required checks:

1. Local browser flow: splash → HMH → Free Mode → Lit Commando → Begin Level 1.
2. READY overlay screenshot.
3. Active gameplay screenshot after 30 seconds.
4. Gas station screenshot.
5. Ghost town screenshot.
6. Bridge screenshot.
7. Boss yard screenshot.
8. Console errors = 0.
9. Visual review: no old enemy/key art, no placeholder rectangles, no random prop soup.

---

## 9. Asset manifest schema

Every final Level 1 asset should carry this metadata:

```js
{
  key: 'level1-final/road/cracked-straight-ne-sw-01',
  src: './assets/generated/hmh-level-one-final-ground/road/cracked-straight-ne-sw-01.png',
  category: 'ground' | 'road' | 'landmark' | 'boundary' | 'prop' | 'interactive' | 'enemy' | 'vfx',
  role: 'main-route' | 'soft-edge' | 'hard-blocker' | 'cover' | 'reward' | 'hazard' | 'dressing',
  biome: 'dust' | 'town' | 'farm' | 'river' | 'desert' | 'boss-yard',
  width: 128,
  height: 64,
  frameWidth: 128,
  frameHeight: 64,
  frames: 1,
  animated: false,
  footprint: { w: 1, h: 1 },
  collision: { type: 'none' | 'soft' | 'solid' | 'hazard', radius: 0 },
  palette: 'level1-dust-v1',
  sourcePolicy: 'repo-owned-final-art',
}
```

Enemy manifests need:

```js
{
  key: 'level1-final/enemy/claim-jumper-bandit',
  actorId: 'claim-jumper-bandit',
  family: 'bandit-ranged',
  silhouetteClass: 'humanoid-hat-rifle',
  accentColor: 'dust-red',
  states: ['idle', 'run', 'attack-tell', 'attack', 'hit', 'death'],
  directions: ['s','se','e','ne','n','nw','w','sw'],
  frameMsByState: {
    idle: 360,
    run: 90,
    'attack-tell': 160,
    attack: 120,
    hit: 90,
    death: 110,
  },
  hitbox: { radius: 0.55 },
  hurtbox: { radius: 0.6 },
  sourcePolicy: 'repo-owned-final-art',
}
```

---

## 10. Success criteria

Level 1 is acceptable only when:

1. A screenshot reads as an intentional isometric game level without needing explanation.
2. The player can see the route from ground/road/boundary language alone.
3. Every screen has a landmark or recognizable authored feature.
4. Prop density is controlled and never looks like scatter.
5. Ground tiles are cohesive and do not checkerboard.
6. Enemy silhouettes are readable at gameplay scale.
7. Enemy attack tells are readable before damage.
8. No old goblin/zombie/placeholder/rectangle enemy art appears.
9. No key art/loading art contradicts the curated art direction.
10. Browser screenshots for spawn, gas station, town, farm/bridge, desert, and boss yard pass human visual review.

---

## 11. Immediate next tasks

### Task 1: Create Level 1 art-direction contract

**Objective:** Encode this plan into source/test contracts so runtime work has a hard target.

**Files:**
- Create: `apps/portal/src/hmh-level-one-art-direction.mjs`
- Create: `tests/hmh-level-one-art-direction.test.mjs`
- Modify: `package.json`

**Test first:** assert the style ID, required asset categories, required P0 enemy roster, and rejection criteria.

### Task 2: Create final ground/road asset manifest skeleton

**Objective:** Establish the complete target manifest before generating art.

**Files:**
- Create: `apps/portal/src/hmh-level-one-final-asset-requirements.mjs`
- Create: `tests/hmh-level-one-final-asset-requirements.test.mjs`

**Test first:** assert all P0 ground/road/water/boundary/landmark requirements exist.

### Task 3: Generate contact-sheet prompts / production specs

**Objective:** Produce exact art-generation specs for each required kit.

**Files:**
- Create: `docs/game-design/hard-money-heroes-level-1-asset-production-spec.md`

**Acceptance:** every asset has prompt language, dimensions, palette, usage role, and rejection criteria.

### Task 4: Build P0 ground/road kit

**Objective:** Replace the ugly/noisy ground first because every screenshot depends on it.

**Acceptance:** local contact sheet and browser spawn screenshot look cohesive before any more enemy work.

### Task 5: Rebuild P0 enemies

**Objective:** Replace bad enemies with a smaller, better Level 1 roster.

**Acceptance:** contact sheet + runtime screenshot shows enemies that match hero quality and have readable attack tells.

---

## 12. Notes for implementation

- Do not push runtime changes live until screenshots are reviewed.
- Do not claim “AAA” from tests only. This is visual work; browser screenshots are mandatory.
- Do not use reference images directly unless Justin explicitly says to use them as assets.
- Do not let broad generated manifests bypass the Level 1 allowlist.
- Better to ship one excellent gas-station arena than six half-random zones.
- Asset production must proceed from ground → boundaries/landmarks → chunks → enemies → VFX, because enemy art will still look bad if the world behind it is visually noisy.
