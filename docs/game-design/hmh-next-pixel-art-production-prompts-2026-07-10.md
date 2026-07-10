# Hard Money Heroes: Next Pixel-Art Production Prompts

Date: 2026-07-10

## Current art ruling

The canonical runtime roster already has certified 8-direction core animation coverage for Lester, Lilly, Lit Commando, and Lit Valkyrie. Do not regenerate their core identity or replace approved hero art with a lookalike.

The highest-value new work is:

1. Traversal art that makes bridges, shallows, beaches, road links, and forest openings unmistakable.
2. Native animation completion for the four partial roster actors.
3. Additive hero actions and Sprite QA replacement sheets for rare states.
4. Large town and industrial structures with explicit collision footprints.

Normal bullets, shotgun pellets, and machine-gun rounds remain coded runtime VFX. Do not create bullet sprite sheets.

## Shared environment style lock

Append this block to every terrain, prop, and structure prompt:

> Original Hard Money Heroes isometric pixel art for the Crypto Wasteland, a retro 16-bit arcade run-and-gun roguelite. Fixed 2:1 isometric camera, top-left key light, compact lower-right cast shadows, crisp one-pixel edge decisions, controlled SNES/Neo Geo palette, dusty desert neutrals with restrained Litecoin blue and amber accents, readable at gameplay zoom, no photorealism, no painterly blur. Transparent background for objects and structures. No text, letters, numbers, logos, signs with writing, borders, labels, watermarks, UI, characters, checkerboards, white matte, magenta matte, or cropped silhouettes. Keep every object fully inside its cell with generous transparent margins.

## Shared terrain-sheet template

> Create one square PNG containing a clean 4-column by 4-row grid of sixteen separate isometric terrain cells. Every cell uses the same exact 2:1 diamond footprint and camera angle, approximately 64 by 32 gameplay pixels before upscale. Keep cells evenly spaced and uncropped. Terrain fills the complete diamond. Transparent space may surround each diamond, but there must be no baked checkerboard or white background. Neighboring variants must tile coherently. Do not include buildings, trees, vehicles, characters, labels, or decorative objects unless the requested tile is specifically a crossing structure.

## Shared prop-sheet template

> Create one square PNG containing a clean 4-column by 4-row grid of sixteen separate isometric environment objects. One isolated object or compact cluster per cell. Use identical camera, ground contact, scale, palette, and top-left lighting across all cells. Preserve transparent separation between cells. Include compact contact shadows directly beneath each object, never a large floating oval.

For large objects, replace the grid instruction with:

> Create one square transparent PNG with a clean 2-column by 2-row grid. One large structure per cell. Each structure should occupy roughly 70 percent of its cell, remain fully uncropped, and expose a clear rectangular or polygonal ground footprint for collision authoring.

For a hero building or landmark, request a single large render instead of a sheet.

## Environment asset priority list

### P0 traversal and collision readability

#### 1. Three-scale bridge kit

**Purpose:** Make every legal river crossing visually obvious and provide bridge widths for roads, dirt paths, and narrow creeks.

**Format:** 4x4 terrain/object hybrid sheet.

**Prompt subject:**

> Sixteen modular isometric bridge pieces: two full-width asphalt road bridges, two cracked rural road bridges, two narrow wood-plank trail bridges, two improvised scrap-metal footbridges, four matching approach ramps, two damaged bridge-end caps, and two bridge support or guardrail pieces. All decks align to the same 2:1 terrain lattice. Show safe walkable deck area clearly. Water is not baked into the pieces. Keep rails low enough not to hide combatants.

#### 2. Shallow creek and ford crossing tiles

**Purpose:** Distinguish crossable shallows from blocked deep water.

**Format:** 4x4 terrain sheet.

**Prompt subject:**

> Sixteen isometric shallow-creek and ford tiles: pale ankle-deep water over visible stones, gravel ford, tire-rutted ford, stepping-stone crossing, mud-to-shallow transitions, shallow-to-deep warning transitions, two narrow creek bends, two creek junctions, and foam-free calm edge variants. Crossable cells must visibly expose the creek bed. Deep-water edges must become darker and visually impassable.

#### 3. Complete beach and shoreline transition atlas

**Purpose:** Remove square water edges and support lakes, rivers, ponds, and beaches.

**Format:** 4x4 terrain sheet, followed by a second 4x4 sheet if needed.

**Prompt subject:**

> Complete isometric shoreline transition atlas with straight north-east, north-west, south-east, and south-west banks; four outside corners; four inside corners; narrow sand beach; muddy bank; rocky bank; reed bank; and one eroded cut bank. Water and shore meet cleanly with restrained foam only where current would strike. No props or structures.

#### 4. Road, dirt-path, and town-street junction atlas

**Purpose:** Connect towns and biome routes without disconnected painted strips.

**Format:** 4x4 terrain sheet.

**Prompt subject:**

> Sixteen modular isometric route tiles: asphalt straight, asphalt corner, T junction, four-way junction, asphalt-to-dirt transition, dirt straight, dirt corner, dirt T junction, narrow forest trail, trail fork, trail-to-road shoulder, town-street-to-plaza transition, cracked culvert crossing, roadside drainage edge, worn tire track, and pedestrian cut-through. Match the exact 2:1 gameplay lattice and keep all travel lanes visually open.

#### 5. Forest boundary and passable opening kit

**Purpose:** Author readable forest walls without turning every tree into random scatter.

**Format:** 4x4 prop sheet.

**Prompt subject:**

> Sixteen isometric forest-boundary clusters: four dense tree-wall sections, four curved forest corners, two clearly open trail entrances, two sparse edge transitions, one fallen-log choke point with a visible gap, one bramble boundary, one stump-and-rock boundary, and one small clearing frame. Tree canopies stay above the ground contact and must not hide the full playable lane. Dense boundaries read solid; trail entrances read passable.

#### 6. Town collision blocker kit

**Purpose:** Provide coherent walls, fences, alleys, and building-edge blockers.

**Format:** 4x4 prop sheet.

**Prompt subject:**

> Sixteen modular isometric town blockers: low brick wall straights and corners, chain-link fence straights and corners, broken wood fence with passable opening, concrete jersey barriers, dumpster cluster, utility-box cluster, alley gate closed, alley gate open, loading-dock edge, porch rail, ruined wall end cap, and narrow bollard line. Keep collision silhouettes close to the visible base and preserve combat sightlines.

#### 7. Vehicle rotation and wreck-cover pack

**Purpose:** Add correctly oriented cars and ensure their collision footprint matches their visual body.

**Format:** 4x4 prop sheet.

**Prompt subject:**

> Sixteen isometric abandoned vehicle sprites: compact sedan, pickup, delivery van, armored cash van, station wagon, and off-road truck, each represented in useful north-east/south-west or north-west/south-east road orientations; plus four wrecked or burned variants. No occupants. Vehicles have clear tire contact points, compact shadows, readable full-body silhouettes, and no floating perspective.

### P1 water, town, and landmark depth

#### 8. River and lake obstacle pack

**Format:** 4x4 prop sheet.

> Waterlogged logs, partially submerged boulders, broken concrete slab, snagged shopping cart, reed island, dead tree snag, small sandbar, collapsed dock segment, culvert debris, warning buoy without writing, lily/reed patch, and four restrained water-current accent strips. Separate solid blockers from non-solid ambient accents by row.

#### 9. Dock, pier, and culvert construction kit

**Format:** 2x2 large-object sheet.

> Four large isometric water structures: old timber fishing pier, industrial loading dock, concrete storm culvert mouth, and collapsed canal spillway. Each has an obvious walkable deck or blocked opening, complete support geometry, and a clearly readable collision footprint.

#### 10. Second-town civic structures

**Format:** 2x2 large-building sheet.

> Four original boarded Crypto Wasteland town buildings: two-story town hall, roadside motel office, abandoned clinic, and fire-station garage. No readable signs or fake lettering. Every building has a strong front silhouette, visible foundation footprint, boarded windows, and a safe uncropped margin.

#### 11. Industrial extraction structures

**Format:** 2x2 large-structure sheet.

> Four large isometric industrial landmarks: ore crusher and conveyor, open-air mining rig platform, transformer substation, and derelict weigh station. Restrained blue energy accents, no text or logos. Provide large solid bases that can be converted into collision polygons while leaving surrounding combat lanes clear.

#### 12. Biome transition clutter

**Format:** 4x4 prop sheet.

> Sixteen compact transition clusters: grass-to-desert weeds, desert-to-rock scrub, forest-to-grass stump line, beach-to-grass dune plants, town-to-forest dumping edge, road shoulder trash, creek-bank reeds, mud puddle edge, burned grass patch, loose gravel fan, eroded rut, and four sparse edge-breakup clusters. These are non-blocking or small-footprint props, not walls.

#### 13. Cave, tunnel, and drainage entrances

**Format:** 2x2 large-object sheet.

> Four isometric entrances: rocky mine adit, concrete highway underpass, storm-drain tunnel, and collapsed rail tunnel. Dark openings must read clearly but not become pure black rectangles. Include surrounding ground contact and a collision-ready outer footprint.

#### 14. Bridge and road signage without text

**Format:** 4x4 prop sheet.

> Sixteen text-free route indicators: striped hazard posts, amber lamps, cyan extraction beacons, reflector stakes, broken guardrails, stone cairns, trail ribbons without lettering, and bridge-end warning pylons. Keep all silhouettes narrow and avoid unreadable pseudo-text.

#### 15. Destructible cover states

**Format:** Three matching 4x4 prop sheets named intact, damaged, and destroyed.

> Matching state sets for wood crates, metal crates, barrels, barricades, concrete chunks, small generators, fence sections, and roadside junk. Object scale, camera, pivot, and footprint must be identical across intact, damaged, and destroyed sheets so runtime state changes do not jump.

## Character animation sheet contract

Generate one animation state at a time. Never combine idle, run, attack, hurt, and death on one sheet.

Each state requires two matching sheets:

- **Sheet A rows:** south, south-east, east, north-east.
- **Sheet B rows:** north, north-west, west, south-west.
- **Columns:** animation frames in chronological order, normally six. Use eight for run, death, victory, or complex attacks.
- **Canvas:** square transparent PNG with a clean 6x4 or 8x4 internal grid.
- **Anchor:** identical foot or hover pivot in every frame.
- **Scale:** actor fills roughly 65 percent of each cell, with safe room for weapons and effects.
- **Output:** no grid lines, direction labels, frame numbers, text, logos, borders, checkerboards, or matte backgrounds.

### Character master prompt template

> Using the attached approved character reference as the exact identity source, create an isometric pixel-art animation sprite sheet for **[ACTOR]** performing **[STATE]**. Do not redesign the face, body proportions, clothing, armor, weapon, palette, or silhouette. Hard Money Heroes retro 16-bit arcade roguelite style, fixed 2:1 isometric camera, crisp silhouette, top-left lighting, compact contact shadow, transparent background.
>
> This is **Sheet [A/B]**. Arrange a clean **[6/8]-column by 4-row** grid. Row order is **[S, SE, E, NE]** for Sheet A or **[N, NW, W, SW]** for Sheet B. Columns are chronological animation frames. The action must loop or resolve cleanly as described: **[FRAME-BY-FRAME ACTION]**. Keep the same foot or hover anchor in every frame and keep body scale identical between both sheets. No labels, text, logos, grid lines, borders, watermark, checkerboard, white background, color matte, motion blur, duplicated limbs, missing weapons, cropped effects, or extra characters.

### Recommended six-frame timing descriptions

- **Idle:** settle, breathe, slight weight shift, center, recover, loop.
- **Walk:** contact, down, passing, up, opposite contact, opposite passing.
- **Run:** drive, contact, compression, flight, opposite contact, recovery.
- **Attack tell:** detect target, raise weapon, brace, hold readable anticipation, peak warning, release-ready.
- **Attack:** wind-up, launch, impact, follow-through, recoil, recover.
- **Hit:** contact recoil, compression, knockback, hold, regain footing, recover.
- **Death:** lethal impact, buckle, fall, ground impact, settle, final still.
- **Reload:** eject/open, reach, insert, seat/close, chamber, ready.
- **Dash:** compression, launch, two travel poses, brake, recover.

## Enemy production priorities

The canonical roster has four partial actors. Produce native sheets for these before inventing more enemies.

### 1. Bitcoin Maximalist Riot Cop

**Identity:** Heavy human riot officer in black and orange improvised armor, cracked face shield, block-shaped shield, baton, authoritarian silhouette. No real-world police insignia, Bitcoin logo, or readable text.

**Needed state sheets:** idle, walk, run, hit, death, spawn-in. Attack and attack-tell already exist, but a matching replacement can be supplied if the new identity sheet changes proportions.

**Special action notes:** Shield stays attached to the same arm in all directions. Run is a shield-led charge. Hit should show shield impact. Death ends with shield and baton still readable.

### 2. Influencer Camera Drone

**Identity:** Small hovering camera drone with ring light, gimbal lens, battery pods, teal and magenta status lamps, satirical influencer aesthetic without logos or text.

**Needed state sheets:** hover-idle, fly, attack-tell, attack, hit, death, spawn-in. Existing death coverage is incomplete and should be replaced.

**Special action notes:** Use a stable hover pivot. Attack tell uses a bright ring-light charge. Attack fires coded projectiles, so the sheet shows recoil and flash only, not a projectile trail. Death breaks into two or three readable pieces without excessive debris.

### 3. NFT Valet

**Identity:** Smug ruined-casino valet in a faded vest and gloves, carrying a holographic key fob and parking-ticket scanner, dust-covered formalwear, no readable NFT art or logos.

**Needed state sheets:** idle, walk, run, native attack-tell, hit, death, spawn-in. Existing attack can be retained if visual identity matches.

**Special action notes:** Attack tell raises the scanner and flashes a warning color. Hit drops posture without changing body scale. Death ends with the key fob separated but close to the body.

### 4. Stablecoin Socialite

**Identity:** Wealthy wasteland socialite in pristine-but-fraying white and silver clothing, reinforced parasol or handbag weapon, cool blue stable-energy accents, satirical but combat-readable.

**Needed state sheets:** walk, run, attack-tell, attack, hit, death, spawn-in. Idle already exists but should be used as the exact identity reference.

**Special action notes:** Attack tell opens or raises the weapon. Attack animation contains pose and recoil only; coded VFX carries the projectile or energy effect. Death must preserve the pale silhouette against light terrain with a dark selective outline.

## Optional new Level 1 enemy concepts after the partial roster is complete

1. **Bridge Toll Scavenger:** light melee blocker who guards crossings; idle, run, attack-tell, attack, hit, death.
2. **Creek Mudlurker:** low amphibious ambusher limited to shallow water and banks; burrow, emerge, scuttle, attack, hit, death.
3. **Roadside Scrap Sniper:** ranged human using vehicle cover; idle, strafe, aim-tell, shoot, reload, hit, death.
4. **Forest Hash Hermit:** support enemy who buffs nearby wildlife; idle, walk, cast-tell, cast, hit, death.
5. **Extraction Yard Loader Bot:** slow industrial tank with a telegraphed charge; idle, walk, charge-tell, charge, slam, hit, death.

Do not generate these optional actors until the four partial canonical actors are complete and accepted.

## Hero additive animation priorities

All hero work must use the approved canonical hero reference sheets. These are additions or quality replacements, not redesigns.

### P0 hero sheets

1. **Weapon-specific reload:** pistol, shotgun, and automatic/heavy weapon, six frames per direction.
2. **Crouch and crouch-idle:** four to six frames per direction for cover and future interaction states.
3. **Fall and landing:** six frames per direction, ending in a stable ground contact.
4. **Interaction/use:** six frames per direction for terminals, chests, extraction pads, and doors.
5. **Level-up celebration:** eight frames per direction for Lester, Lilly, and Lit Valkyrie to match Lit Commando's special coverage.

### P1 hero quality replacements

6. **Dash replacement:** six frames per direction with stable pivot and clean alpha. Current rare-state sheets are runtime-complete but Sprite QA flags palette, halo, or pivot issues on the hero set.
7. **Victory polish:** eight frames per direction, identity-preserving and restrained enough not to obscure the HUD.
8. **Aim-walk or strafe-fire:** eight frames per direction, weapon held on target while feet move. Keep projectile VFX outside the sprite sheet.
9. **Crypto Bomb throw:** six frames per direction with a strong anticipation and clean release point. The bomb itself may appear only in the hand and release frame.
10. **Revive or recover:** six frames per direction for future co-op/downed-state support. Defer until gameplay uses it.

## Hero-specific identity locks

- **Lester:** Use the approved canonical Lester reference. Preserve his exact blue spherical head and established face treatment. Do not reinterpret him as a generic armored human.
- **Lilly:** Use the approved canonical Lilly model and facial/hair identity. Do not substitute Lit Valkyrie.
- **Lit Commando:** Preserve the accepted silver/black armored silhouette and weapon proportions.
- **Lit Valkyrie:** Preserve teal hair, glasses, armor silhouette, and the accepted relationship to Lilly without making them identical.

## File naming and handoff

Use these names before delivery:

- Terrain: `hmh-l1-[subject]-terrain-r1.png`
- Props: `hmh-l1-[subject]-props-r1.png`
- Large structures: `hmh-l1-[subject]-large-r1.png`
- Characters: `hmh-[actor]-[state]-sheet-a-r1.png` and `hmh-[actor]-[state]-sheet-b-r1.png`

For every delivered sheet, include a one-line note with:

1. Grid columns and rows.
2. Direction row order if animated.
3. Frame count.
4. Intended collision role: solid, passable, shallow, bridge, ambient, or destructible.
5. Whether any cell should be rejected.

## Acceptance checklist

- Exact 2:1 isometric camera and consistent actor/object scale.
- Clean alpha verified numerically, not just visually.
- No baked checkerboard, matte, pseudo-text, logo, or watermark.
- No cropped silhouettes or cross-cell overlap.
- Identical pivots across character frames and directions.
- Buildings and vehicles expose clear ground footprints.
- Deep water reads blocked; shallows and bridge decks read passable.
- Forest walls read solid; trail entrances read open.
- New hero art matches the approved identity reference exactly.
- Actor sheets are one state per sheet pair and follow the runtime direction order.
- Contact sheet review passes before slicing or runtime integration.
