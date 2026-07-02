# Lester's Arcade Art Bible

**Style lock:** `litecoin-city-after-dark-neon-noir-deco-v1`  
**Scope:** Lester's Arcade portal shell, Hard Money Heroes, Chikun's Escape, cabinet art, UI, VFX, marketing key art, and future first-party cabinets.  
**Status:** Global standard promoted from the Level 1 Artistic World + Asset Production Plan. Level-specific docs may add local palettes/props, but should not contradict this bible.

---

## 1. Theme statement

Lester's Arcade is a neon arcade portal built around hard-money heroism. Hard Money Heroes is the flagship cabinet: a rain-slicked, neon-lit financial district and its surrounding wastelands at night, where Art Deco bank architecture, marble, brass, vault doors, and clean Litecoin light are being invaded by noisy fiat-world corruption: evil bankers, gas beasts, printer swarms, rug-pull bandits, scam cultists, glitch signage, and toxic liquidity.

Every asset should answer one visual question:

> Is this **hard money** or **fiat corruption**?

- **Hard money / hero language:** cool metallics, Litecoin blue, silver ramps, clean geometry, warm brass accents, crisp readable UI, deliberate silhouettes.
- **Fiat corruption / enemy language:** toxic green, magenta glitch, sickly gold, noise, jagged shapes, melted forms, broken LED artifacts, unstable outlines.

This contrast is the unifying visual DNA across levels, enemies, bosses, portal UI, cabinet attract screens, profile badges, and future cabinets.

---

## 2. Master palette

Use the global palette as the first quantization target for all generated or ingested pixel art. Level docs may define limited local ramps, but they should map back to these families.

| Family | Hexes | Use |
| --- | --- | --- |
| Night city base | `#0B0E1A`, `#10162A`, `#1A2138`, `#2B3A5C` | backgrounds, shadowed streets, UI backplates |
| Litecoin blue | `#173B72`, `#345D9D`, `#4E82D8`, `#8CB7FF` | hero rim light, helpful pickups, wallet/profile accents |
| Silver ramp | `#E8ECF2`, `#C9D2DE`, `#A8B4C4`, `#5C6B80`, `#2E3A4D` | armor, Litecoin coins, hard-money surfaces |
| Brass/gold | `#F1D37A`, `#C9A34E`, `#8C6724`, `#4A3514` | vault trim, rewards, coin-slot UI |
| Fiat toxic | `#C9FF6A`, `#7FE84A`, `#3FAE3B`, `#1F5C2E` | poison, scam slime, enemy weak-point glows |
| Magenta glitch | `#FF78D1`, `#E040A0`, `#992B78`, `#4B1844` | corrupted screens, rug-pull magic, Sybil effects |
| Sickly fiat gold | `#F0E66A`, `#D4B830`, `#9C7D16`, `#4B3A0B` | enemy wealth/greed accents, counterfeit glow |
| Damage/fire | `#FFE29A`, `#FF9B3D`, `#E34A2E`, `#7A1414` | explosions, hit sparks, danger telegraphs |
| Blood/oil | `#A01828`, `#5A0B16`, `#151515`, `#3A342F` | faction-specific gore/debris |
| UI white/ink | `#F8FBFF`, `#C7D0E0`, `#6F7B91`, `#11151F` | text, icons, cards, contrast-safe outlines |

**Pipeline rule:** generated art should run through nearest-color quantization to the project palette, then an outline/alpha cleanup pass, then atlas packing. If an asset only works outside the palette, it needs art direction review before it becomes runtime art.

---

## 3. Rendering rules

1. **Light direction:** top-left key light. Scene-local neon rim light may tint the shadow edge, but the key direction stays consistent.
2. **Outlines:** 1px selective dark-color outline on actors, pickups, hazards, interactives, and important props. Avoid pure black unless the object is explicitly UI/ink. Environmental background props may use softer dark-purple/navy outlines.
3. **Dithering:** sparse 2x2 or ordered texture only in broad gradients. No noisy full-surface dithering on gameplay-critical sprites.
4. **Shadows:** soft oval/contact shadows for actors; iso footprint shadows for props/buildings. Collision footprint metadata must match the shadow/ground contact, not the transparent canvas.
5. **Readability above detail:** a sprite that reads in silhouette at gameplay zoom beats a detailed sprite that muddies the action.
6. **No style mixing:** do not mix top-down, side-view, 3/4, and isometric assets in the same runtime layer unless the asset has been redrawn or filtered into the same camera grammar.

---

## 4. Canonical scale and canvases

| Asset class | Canvas / footprint | Runtime notes |
| --- | --- | --- |
| Base iso ground | 128x64 visual diamond for current Level 1+ authored terrain; 64x32 legacy iso tiles only as fallback | Ground-layer only, never obstacle props |
| Small prop | 1 tile or 1x2 tiles | Must include collision + shadow metadata |
| Medium prop/building | 2x2 to 3x3 tiles | Keep outside clear combat lanes unless designed as cover |
| Landmark | 4x3 to 6x4 tiles | Navigation anchor, placed outside negative-space lane |
| Heroes / humanoid enemies | 64x64 canvas, roughly 48px readable body height | 8-direction where possible |
| Large enemies / elites | 96x96 canvas | Must still fit collision silhouette |
| Bosses | 160x160 to 256x256 canvas | Phase variants + telegraph anchors required |
| UI icons / power-ups | 32x32 or 64x64 | Strong outer shape, high contrast, no tiny details |

---

## 5. Shape language

- **Hard-money heroes:** clean circles/triangles, coin halos, silver/blue armor breaks, confident upright posture. Lester's sphere/helmet and Lilly's hair/wing shape must remain readable as black silhouettes.
- **Bankers / fiat elites:** tall, angular, vertical silhouettes; long coats, ties, briefcases, sharp shoulders, counterfeit gold accents.
- **Degens / rug-pull enemies:** hunched, asymmetrical, round backpacks/bags, twitchy magenta-green corruption.
- **Gas / fee monsters:** bulky, inflated, pressure-tank shapes, smoke stacks, orange/toxic vents.
- **Machines / printer swarms:** boxy, repeating rectangular teeth/paper forms, LED eyes, glitch trails.
- **Bosses:** one dominant silhouette read plus one phase-specific alteration: larger weapon, broken armor, exposed core, corrupted aura, or new projectile rig.

---

## 6. Animation matrix

The final AAA target is full animation coverage for all combat actors. Production can land in layers, but manifests should name gaps explicitly instead of pretending coverage exists.

| State | Frames | Directions | Required metadata |
| --- | ---: | ---: | --- |
| Idle | 6-8 | 8 | pivot, breathing cadence, optional fidget tag |
| Walk | 8 | 8 | pivot, `footstep@frame` events |
| Run | 8 | 8 | pivot, dust spawn anchors |
| Shoot | 4-6 | 8 | muzzle anchor per frame, recoil event |
| Melee | 6 | 8 | hit arc, active frames, SFX tags |
| Throw | 6 | 8 | release anchor/frame |
| Dash / roll | 6 | 8 | i-frame window, dust anchors |
| Hurt | 3-4 | 8 | flash/tint allowance, knockback pose |
| Death | 8-12 | 4 minimum | corpse/decal final frame |
| Spawn / revive | 6 | 1 minimum | beam/aura color by faction |

**Directions:** prefer true 8-direction. Rendering 5 and mirroring E/W is acceptable only when the character is symmetrical enough that weapon-hand swaps do not look wrong.

---

## 7. Reference style targets

All third-party/reference files are **reference-only**. They guide composition, density, readability, and material handling; they are not runtime art sources.

For Hard Money Heroes Level 1, the active target is documented in `docs/art/HMH_LEVEL_1_REFERENCE_STYLE_TARGET.md` and encoded in `apps/portal/src/hmh-level-one-quality.mjs`:

- **Age of Empires II: DE references:** dense authored isometric worldbuilding, clear roads/bridges/walls/farms/water edges, repeated-but-varied town modules.
- **Hades / Hades II references:** combat-readable hand-painted diorama contrast, color-keyed telegraphs, bold silhouettes, ornate edges with quiet fight centers.
- **Deep Rock Survivor references:** swarm readability, chunky blockers, resource glows, enemy-mass separation, visible escape lanes under pressure.
- **Provided level video:** soft grass/cobble transitions, timber/stone town density, bridges, docks, ruins, lamp posts, layered roofs, lived-in environmental props.

The HMH translation remains original: Crypto Wasteland / hard-money arcade noir, not medieval fantasy or direct homage. Use the references to define **quality bar and layout grammar**, then generate original assets in the Litecoin/fiat-corruption visual language.

---

## 8. Level identity rules

Global identity stays consistent, but each level should get a local weather/color-grade/terrain kit.

- **Level 1, Crypto Wasteland:** dusty ghost-town highway, farms, river/lake edge, desert boulder roads, teal/Litecoin accents against tan/ochre ground. Use the detailed execution plan in `docs/plans/2026-07-01-level-1-artistic-world-and-asset-plan.md` and the reference-style target in `docs/art/HMH_LEVEL_1_REFERENCE_STYLE_TARGET.md`.
- **Level 2, Litecoin City:** neon financial district, wet asphalt, Art Deco banks, harbor, high-rise silhouettes, denser blue/silver city light, more rain/fog.
- **Level 3, The Getaway:** rooftop/train/skybridge motion language, storm runoff, speed lines, glass bridges, extraction lights.
- **Future cabinets:** should inherit hard-money vs fiat-corruption color logic, outline discipline, cabinet/pixel-art readability, and metadata requirements even if their genre differs.

---

## 9. Asset acceptance gate

An asset is runtime-ready only when all are true:

1. It fits the palette and outline rules or has an explicit exception.
2. It has the correct camera/iso grammar for its layer.
3. It has transparent alpha cleaned and no matte/fringe.
4. It has metadata: pivot, collision footprint, shadow footprint, frame timing, and event anchors where relevant.
5. It is packed into a manifest/atlas or an approved small runtime path.
6. A contact sheet exists for human review.
7. Raw generation files stay outside the deploy repo; only integrated atlases/metadata land in git.

---

## 10. Prompt language for generated art

Every PixelLab or equivalent prompt for runtime art should include the lock phrase:

> `Hard Money Heroes / Lester's Arcade pixel art, litecoin-city-after-dark-neon-noir-deco-v1, top-left key light, selective 1px dark navy outline, Litecoin blue/silver/brass hard-money palette vs toxic green/magenta fiat-corruption accents, transparent background, readable silhouette at gameplay zoom, no pure black outline, no painterly blur, no side-view camera unless requested.`

Add level-specific words after the lock phrase, not instead of it.

For Level 1 environment assets, generate prompts through or mirror `buildLevelOneEnvironmentAssetPromptBrief(...)` so PixelLab receives the Age-of-Empires-style world-density target, Hades-style combat-readability target, and Deep-Rock-style swarm-readability target while preserving original HMH silhouettes and palette.

---

## 11. Cross-references

- Level 1 reference target: `docs/art/HMH_LEVEL_1_REFERENCE_STYLE_TARGET.md`
- Level 1 execution: `docs/plans/2026-07-01-level-1-artistic-world-and-asset-plan.md`
- AAA roguelike handoff: `docs/plans/2026-07-01-hard-money-heroes-aaa-roguelike-high-end-llm-handoff.md`
- PixelLab production queue: `docs/PIXELLAB_2500_IMAGE_PLAN.md`
- Current design canon: `docs/game-design/hard-money-heroes-design-bible-v2.md`
- Runtime asset inventory: `docs/game-design/hard-money-heroes-pixel-art-asset-inventory.md`
