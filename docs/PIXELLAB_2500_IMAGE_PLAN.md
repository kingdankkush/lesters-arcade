# Hard Money Heroes - PixelLab 2,500 Image Generation Plan

## Budget & Scope
- Total budget: 2,500 generations
- Goal: Complete visual identity for isometric roguelike with district distinction, smooth 8-dir animations, animated props, and varying scale assets.

## Generation Strategy
1. **Harvest first** — Run `list_characters` and existing manifests before generating anything new.
2. **Batch by category** — Characters → Animated Props → Tilesets → Large Buildings → Tiny Details.
3. **Use ledger** for resumable queue/collect (see `pixellab-scaled-asset-generation` skill).
4. **Prioritize 8-dir + animation** only where it delivers the most impact.

## Detailed Asset List (≈2,500 generations)

### 1. Character Animations (≈800 generations)
- **Lit Commando (Lester)**: 8 directions × 9 actions (idle, walk, run, shoot-pistol, shoot-shotgun, melee-knife, hurt, death, dash) = 72 animations
- **Lit Valkyrie (Lilly)**: Same 72 animations
- **3-4 New Enemies** (Industrial Drone, Park Harasser, Factory Foreman, Wilderness Beast): 4 enemies × 6 actions × 8 dirs = 192 animations
- **2 Mini-Bosses**: 2 × 8 actions × 8 dirs = 128 animations
- **Total**: ~464 animations (some can be template-based or harvested)

**PixelLab Calls**:
- `create_character` (body_type: humanoid, n_directions: 8, view: low top-down)
- `animate_character` (mode: v3, directions: all 8, frame_count: 6-12, action_description per state)

### 2. Animated Props & Tilesets (≈700 generations)
- **Trees** (Oak, Pine, Palm, Dead): 4 types × 4 frames × 4 variants = 64
- **Flowers & Plants** (various): 20 types × 3 frames = 60
- **Water & Effects** (ripples, toxic pools, smoke vents): 8 × 4 frames = 32
- **Ground Tiles** (pavement variants, grass variants, sand, road): 12 base × 2 variants = 24
- **Road & Curb Details**: 10 × 2 = 20

### 3. Large Scale Buildings & Landmarks (≈600 generations)
- **Downtown**: Skyscraper, City Hall, Police Station (3 large + details)
- **Industrial**: Factory, Warehouse, Smokestack, Conveyor (4)
- **Commercial**: Mall, Theater, Diner, Office Tower (4)
- **Residential**: House, Apartment Block, School, Mansion (4)
- **Special Landmarks**: Observatory, Lighthouse, Ruins, Data Hub (4)
- Each with 2-3 variants + base + damaged state

### 4. Small Props & Scatter (≈400 generations)
- Benches, lamps, trash cans, fire hydrants, crates, boxes, fences, gates, signs, telescopes, conveyor segments, etc.
- 50+ unique props × 2-3 variants each

### 5. Weapon & VFX (≈300 generations)
- Knife, Pistol, Shotgun, Machine Gun sprites + muzzle flashes, bullet trails, impact effects, shell casings
- Power-up icons (8 types × 4 frames + glow variants)
- Hit reactions, bloodless gore, sparks, explosions

### 6. UI & Misc (≈200 generations)
- Achievement badges, level-up cards, district icons, minimap elements

## Execution Workflow
1. Create `scripts/pixellab-hmh-2500-plan.json` ledger
2. Queue in multiple background passes (respect slot limits)
3. Collect + download with Pillow transparency verification
4. Build runtime manifests (`hmh-animated-roster`, `hmh-environment`, `hmh-fx`)
5. Wire into `combat-sprite-bridge` and `scene-templates`

## District Identity Rules
- Each district gets its own limited color palette + theme color overlay.
- Props must match district (no TV in forest, no trees on pavement unless intentional).

## Quality Gates
- Every asset must pass:
  - Clean transparency (alpha == 0 in corners)
  - Consistent lighting direction
  - Readable silhouette at game scale
  - No text/watermarks

This plan will give Hard Money Heroes a cohesive, professional isometric look with excellent readability and replayability.