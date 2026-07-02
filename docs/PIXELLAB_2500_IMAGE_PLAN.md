# Pixellab 2,500-Image Generation Plan

This document specifies the complete Pixellab image generation plan for Hard Money Heroes.
The `pixellab-hmh-2500-queue.json` contains every prompt; `pixellab-hmh-2500-collect.mjs`
runs collection when Pixellab API is wired in.

## Budget Allocation (2,500 images total)

| Category                  | Count | %     | Priority | Use                                        |
|---------------------------|-------|-------|----------|--------------------------------------------|
| 8-dir character animations| 648   | 25.9% | P0       | Hero/enemies/bosses with full 8-way motion |
| Animated tilesets         | 384   | 15.4% | P0       | Floor tiles per biome (sand/grass/water/…) |
| Animated props (trees/…)  | 512   | 20.5% | P1       | Environmental animation (sway, ripple)     |
| Buildings / landmarks     | 256   | 10.2% | P1       | Isometric buildings per district           |
| Small props (flowers,…)   | 320   | 12.8% | P2       | Detail props for level design              |
| Weapons / VFX             | 192   |  7.7% | P1       | Weapon sprites + muzzle/impact/particle FX |
| XP coin rotation          |  96   |  3.8% | P2       | Litecoin coin 360° shimmer animation       |
| Boss sprites              |  92   |  3.7% | P0       | 10 bosses × phase variants                 |
| **Total**                 | 2500  | 100%  |          |                                            |

## Category Details

### 1. 8-Direction Character Animations (648 images)

**Lit Commando (hero)** — Lester's flagship hero. 6 states × 8 dirs × ~8 frames = 384 frames.
- `idle` (8 frames × 8 dirs = 64)
- `walk` (8 frames × 8 dirs = 64)
- `run` (8 frames × 8 dirs = 64)
- `shoot` (6 frames × 8 dirs = 48)
- `melee` (6 frames × 8 dirs = 48)
- `hurt` (4 frames × 8 dirs = 32)
- `death` (8 frames × 4 dirs = 32; death doesn't need full 8-way)
- `jump` (4 frames × 4 dirs = 16)
- `throw` (4 frames × 8 dirs = 32)

**Lit Valkyrie** — Lilly, the unlockable second hero. Same states, different palette (teal/white
instead of silver/blue). 648 - 16 (death doesn't need full coverage) = ~288 frames.

**Enemies (10 canonical + 5 bonus)** — Each enemy has `idle`, `walk`, `attack`, `hit`, `death`.
Most enemies only need 4 directions (they face the player). ~240 frames.

### 2. Animated Tilesets (384 images)

**6 biomes × 8 variants × 8 frames (for animated variants):**
- Sand (desert biome) — 8 tile variants with dune-shimmer animation
- Grass (forest/town biomes) — 8 variants with wind-sway frames
- Water — 8 variants with ripple animation (most visible motion)
- Pavement (road/downtown) — 8 variants cracked/worn
- Snow — 8 variants with occasional sparkle
- Lava — 8 variants with flow animation

Tile size: 64×64 pixels. Iso-style with 4 visible faces per tile (top, NE, SE, SW).

### 3. Animated Props (512 images)

**Trees (8 types)**: oak, palm, pine, dead tree, neon city tree, rock formation, cactus, bush.
Each has 4-frame sway animation and 4 size variants. 8 × 4 × 4 = 128 frames.

**Environmental**: traffic lights (3 frames), neon signs (4 frames × 6 types), puddles
(ripple, 4 frames), trash piles (3 frames), flickering street lamp (4 frames × 4 styles).
~192 frames total.

**District identity props**: each of the 5 districts (downtown, industrial, park, suburban,
wilderness) has 4 signature props with subtle animation. 5 × 4 × 8 = 160 frames.

**VFX ambient**: smoke/fog puffs (4-frame loop × 8 types), fire (4 frames × 4 types),
water splash (4 frames × 2 types). 52 frames.

### 4. Buildings & Landmarks (256 images)

**Downtown skyscrapers (4 sizes × 6 styles = 24)**: neon-lit office towers in the Litecoin
City After Dark style. Each building has a "lit" and "dark" variant (windows on/off).

**Industrial (4 sizes × 6 styles = 24)**: warehouses, foundries, container stacks.

**Suburban (3 sizes × 5 styles = 15)**: apartment buildings, houses.

**Park/Wilderness (2 sizes × 4 styles = 8)**: kiosks, pavilions, ruins, natural formations.

**Landmarks** (one-shot each, 18 total): Lester statue, The Whalescraper (whale-shaped
tower), The Blockchain Bridge (suspension bridge with moving data streams), Litecoin City Hall,
The Hash Rate Reactor (power plant), The FUD Tower, and 12 other named landmarks from
the world design doc.

**Rotating variants** where applicable (4 frames): ~165 frames across all categories.

### 5. Small Props (320 images)

**Flowers (32 types × 3 animation frames = 96)**: varied per biome.
**Grass tufts (16 types × 2 frames = 32)**: wind-swaying ground cover.
**Debris / litter (24 types × 1 = 24)**: scattered paper, bottles, cans.
**Street furniture (16 types × 1 = 16)**: mailboxes, benches, fire hydrants.
**Power-ups (8 types × 4 frames = 32)**: magnet, slow-time, berserk, shield, speed, etc.
**Pickups (10 types × 2 frames = 20)**: ammo packs, health packs, grenades, coins.
**Weapon crates (4 types × 4 frames = 16)**: the crates that drop weapons.
**Environmental decals (8 types × 10 variants = 80)**: ground stains, oil, graffiti.
**Misc detail (4)**: manhole covers, drain grates, etc.

### 6. Weapons & VFX (192 images)

**Weapons (5 weapons × 4 directions × 2 frames = 40)**: pistol, shotgun, machine gun,
throwing knife, throwing axe. Each with in-hand sprite + world-drop sprite.

**Muzzle flashes (5 weapons × 3 frames × 4 directions = 60)**: burst effect.

**Impact VFX (6 types × 4 frames = 24)**: bullet, explosion, electric, fire, ice, blade.

**Bullet sprites (6 weapons × 6 directions × 1 = 36)**: tiny projectiles.

**Shells / casings (4 types × 4 frames × 4 directions = 64)**: eject animation per weapon.

**Particles (32 total)**: spark, smoke, blood-splash, debris chunks.

### 7. XP Litecoin Coin Rotation (96 images)

**360° rotation × 4 size variants × glow variants:**
- 32 frames for 11.25° per step × 4 sizes (small/medium/large/xlarge)
- Each frame has silver gradient + Ł symbol + shimmer highlight
- 64 frames for the 360° spin + 32 frames for the glow pulse

Note: the in-game canvas-rendered coin (drawLitecoinXP) is already in place as fallback.
The Pixellab-generated frames will become the "hero" version used when zoomed in /
highlighted (e.g., level-up screen shows coin spinning in detail).

### 8. Boss Sprites (92 images)

**10 canonical bosses × multi-phase art:**
| Boss                        | Frames    | Notes                                    |
|-----------------------------|-----------|------------------------------------------|
| The Rug Pull Baron          | 12        | Phase 1/2/3 + directional variants       |
| Mt. Goxzilla                | 12        | Kaiju-style, 3 phases                    |
| The Whale                   | 10        | Market-dump pressure waves               |
| Sir FUD, The Bear King      | 10        | Knight with red-candlestick warhammer    |
| The 51% Hydra               | 10        | Multiple heads                           |
| Tetherra, The Stable Queen  | 8         | Depeg panic fire                         |
| The Maximalist              | 8         | Mirror of player art                     |
| Gas Titan                   | 8         | Fee-spike floor hazards                  |
| Mr. NGMI                    | 8         | Influencer boss w/ Sybil shield          |
| The Quantum Hacker          | 6         | Final boss                               |
| **Total**                   | **92**    |                                          |

## File Naming Convention

All generated images use the canonical path:
```
apps/portal/assets/generated/pixellab/<category>/<subcategory>/<filename>.png
```

Example:
```
apps/portal/assets/generated/pixellab/characters/lit-commando/idle/east/00.png
apps/portal/assets/generated/pixellab/tiles/sand/00-animated/00.png
```

## Manifest Assembly

After collection, the harvest script (`scripts/pixellab-compile-manifests.mjs`) walks the
generated tree and produces the following manifests:

- `pixellab-hmh-characters.mjs` — exports all 8-dir character animations with direction-keyed frame maps.
- `pixellab-hmh-tiles.mjs` — exports tile slugs per biome with per-variant frame lists.
- `pixellab-hmh-props.mjs` — exports small/medium/large props per district with animation variants.
- `pixellab-hmh-buildings.mjs` — exports buildings per district type with size variants.
- `pixellab-hmh-vfx.mjs` — exports all effect sequences.
- `pixellab-hmh-xp-coin.mjs` — exports the 96-frame coin rotation.

Each manifest imports the existing sprite-pipeline.mjs SpriteActor / directionFromVector
helpers so the integration is a drop-in replacement for the hand-made Lester/Lilly manifests.

## Quality Gates

Every harvested image is validated against the global art bible (`docs/art/ART_BIBLE.md`):
- PNG-24 with alpha channel (transparent background)
- Nearest-color quantized to the Lester's Arcade master palette unless explicitly waived
- Selective 1px dark-navy outline normalization for actors, pickups, hazards, and interactives
- Alpha-cleaned with no matte/fringe, watermarks, text artifacts, or off-canvas pixels
- Frame consistency across animation sequences (all frames same dimensions)
- Direction consistency (8-dir sets must be exactly 8 directions per state)
- Runtime metadata exists for pivot, collision/shadow footprint, frame timing, muzzle/hit anchors, and event tags where applicable
- Accepted sequences are atlas-packed and manifest-backed; raw generations stay outside the deploy repo

Rejected frames fall back to the existing hand-made art until regenerated.

## Level 1 reference-style prompt overlay

For Level 1 environment production, every ground/terrain/path/building/wall/tree/rock/prop prompt should also follow `docs/art/HMH_LEVEL_1_REFERENCE_STYLE_TARGET.md` and the prompt brief generated by `buildLevelOneEnvironmentAssetPromptBrief(...)` in `apps/portal/src/hmh-level-one-quality.mjs`.

The overlay is:

- **Age of Empires II-inspired authored world density:** clear roads, bridges, farms, walls, water edges, and modular town pieces.
- **Hades-inspired combat readability:** bold silhouettes, quiet fight centers, ornate borders, color-keyed telegraphs, and strong light/dark separation.
- **Deep Rock Survivor-inspired swarm readability:** chunky blockers, resource glows, visible escape lanes, and readable enemy/resource separation under pressure.
- **Provided level-video material language:** soft grass/cobble transitions, timber/stone buildings, bridges/docks, ruins, lamps, barrels, wagons, and layered rooftops.

PixelLab is the preferred high-volume generator for first-pass original candidates, but no image is accepted as AAA runtime art until the post-process stack runs: palette quantize → selective outline normalize → alpha clean → atlas/metadata pack → contact-sheet QC. Signature bosses, heroes, and landmarks may still need a human paint/QC pass after PixelLab.

## Execution Order (recommended)

1. **Characters first** (P0) — hero animations are the most visible improvement
2. **Tiles second** (P0) — biome ground texture variety transforms level design
3. **Bosses third** (P0) — each boss becomes visually distinct per phase
4. **Weapons/VFX fourth** (P1) — weapon feedback improvement
5. **Animated props fifth** (P1) — environmental motion sells the world
6. **Buildings sixth** (P1) — district visual identity
7. **Small props seventh** (P2) — fill-in detail
8. **XP coin rotation last** (P2) — detail refinement (canvas fallback already in place)

## API Integration

When Pixellab API is connected, run:
```bash
node scripts/pixellab-hmh-2500-collect.mjs --queue=pixellab-hmh-2500-queue.json
```

The collect script:
- Queues up to 50 images per batch (respecting rate limits)
- Polls for completion
- Downloads finished images to the canonical path structure
- Runs quality validation
- Updates the manifest assembly files

Estimated runtime: 2-4 hours for the full 2,500-image generation at typical rate limits.

## Integration with Existing Codebase

The generated assets integrate through the existing sprite-pipeline.mjs + combat-sprite-bridge.mjs
paths already wired into main.js. When a Pixellab manifest exists for a character, the bridge
prefers it over the hand-made art; otherwise falls back to the existing Lester/Lilly manifests.

This means the 2,500-image roll-out can happen incrementally — each completed batch of frames
immediately appears in-game without further code changes.
