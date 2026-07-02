# Hard Money Heroes Level 1 Reference Style Target

**Status:** reference-only art-direction input for Level 1 environment asset production.  
**Source set:** Justin-provided Age of Empires II: Definitive Edition screenshots, Hades/Hades II screenshots, Deep Rock Galactic: Survivor screenshots, and the provided `level.mp4` town/forest/water clip.  
**Policy:** these files are inspiration only. Do not copy, trace, ship, or train from the reference files. Translate their composition/readability/material lessons into original Lester's Arcade / Hard Money Heroes assets.

---

## 1. Target summary

Level 1 should aim for **hand-authored isometric world density with action-game clarity**:

- **Age of Empires II: DE** contributes the density target: readable roads, bridges, walls, farms, water edges, rocks, trees, and clustered buildings that feel handcrafted instead of randomly scattered.
- **Hades / Hades II** contributes the combat-readability target: bold silhouettes, dark-to-bright value staging, color-keyed telegraphs, ornate floors that still leave clean fight lanes, and props that frame arenas instead of cluttering them.
- **Deep Rock Survivor** contributes the swarm-readability target: large blockers and resource glows stay legible while many enemies are on screen; escape lanes remain visible even in dense combat.
- **The level video** contributes the local material target: soft grass-to-cobble transitions, timber/stone town assets, bridges/docks, ruins, lamp posts, rooftops, and lived-in environmental dressing.

The HMH translation is not medieval/fantasy. It is **Crypto Wasteland / hard-money arcade noir**: dusty roads, ghost-town timber, farms, rivers, boulder/mesa cuts, gas station concrete, saloon fronts, Litecoin cyan/gold extraction lights, and fiat-corruption green/magenta/orange hazard accents.

---

## 2. What to translate into original assets

### Ground and terrain

- Packed dirt, dusty sand, worn grass, mossy cobble, cracked asphalt, scorched boss-yard ground.
- Roads should have readable center lanes with broken-edge variants and softer shoulder transitions.
- Avoid noisy ground in fight centers. Put texture at the edges, corners, and lane seams.
- Use Hades-style value control: center lanes are calmer, borders and interactives carry the ornamental detail.

### Roads, paths, and bridges

- Broken highway lane for spawn.
- Gas-station forecourt concrete with oil cracks and pump footprint marks.
- Ghost-town main-street cobble/dirt blend.
- Farm road spur with crop/fence lane boundaries.
- River/wash bridge planks, rails, shore stones, reeds, and mud banks.
- Extraction flare road with Litecoin cyan/gold directional accents.

### Buildings and walls

- Gas-station canopy, pumps, kiosk, broken signage.
- Saloon false front, boarded storefronts, porch posts, awnings, alley markers.
- Farm barn, silo, fences, crop rows, hay/wood clutter.
- Stone/brick wall segments, gate posts, barricades, bridge-side blockers.
- Boss-yard gate and extraction arch. These should frame combat lanes, not fill them.

### Trees, rocks, and natural blockers

- Pine/oak clusters, dead trees, cactus walls, mesa boulders, river rocks, reeds.
- Natural blockers must have strong silhouette and visible base footprint so collision is obvious.
- Variants should form readable boundaries in authored loops, not random prop soup.

### Combat-readable props

- Destructible barrels, gas-pump explosives, cache crates, boss warning signs, gate markers, pickup/resource glow decals.
- Every interactive prop needs intact/broken/used state planning, collision footprint, and color-keyed role: cyan/gold = reward or extraction, green/magenta/orange = hazard/corruption.

---

## 3. PixelLab verdict

PixelLab is a strong tool for **scale**: environment props, tile variants, buildings, blockers, VFX elements, and 8-direction actor animation drafts. It is probably the best available production accelerator for generating many original pixel-art candidates quickly.

PixelLab is **not** a one-click AAA solution. The AAA result comes from the pipeline around it:

1. Art-bible-constrained prompts.
2. Reference-target prompt briefs from `hmh-level-one-quality.mjs`.
3. Palette quantization to Lester's Arcade ramps.
4. Selective outline normalization.
5. Alpha cleanup.
6. Atlas packing and metadata: pivot, collision footprint, shadow footprint, frame timing, event anchors.
7. Contact-sheet review and human curation.
8. Runtime tests that prove generated assets are actually wired into the authored level path.

Best use: **PixelLab for high-volume first-pass original assets, then post-process and curate.** For final hero/boss animation and signature landmarks, expect extra human paint/QC or a second pass after PixelLab.

---

## 4. First production batch recommendation

Generate a small P0 environment batch before another giant queue:

1. **Ground-texture kit**: packed dirt, dusty sand, worn grass, cobble, cracked asphalt, scorched boss ground.
2. **Path kit**: broken highway, gas-station concrete, ghost-town road, farm spur, bridge planks, extraction flare road.
3. **Water/shore kit**: river strip, wash crossing, reeds, lake edge, rocky bank, bridge support.
4. **Natural blockers**: cactus wall, mesa boulder, river rocks, dead tree, pine/oak clump, Litecoin ore/crystal blocker.
5. **Signature structures**: gas-station canopy, saloon front, farm barn/silo, boss gate, extraction arch.

Each generated asset should be treated as a candidate until it passes the global art bible and this reference-style target.

---

## 5. Runtime hook

The source-of-truth runtime/data contract is:

- `apps/portal/src/hmh-level-one-quality.mjs`
  - `HMH_LEVEL_ONE_REFERENCE_STYLE_TARGETS`
  - `HMH_LEVEL_ONE_ENVIRONMENT_ASSET_GENERATION_PLAN`
  - `buildLevelOneEnvironmentAssetPromptBrief(...)`

Those exports keep the reference analysis connected to district-generation context and tests instead of living only as prose.
