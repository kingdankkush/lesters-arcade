# Hard Money Heroes Level 1 PixelLab Asset QA

**Status:** candidate-art QA after the first pushed Level 1 PixelLab pass.  
**Scope:** P0 terrain/path/water, regenerated weak terrain, and P1 object batches for buildings/walls, trees/rocks/boulders, bridges/tunnels/cliffs-adjacent blockers, and combat-readable props.

## Production files

Candidate assets live under:

```text
apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates/
```

Primary manifest:

```text
apps/portal/assets/generated/hmh-coherent-world/level1-reference-style/candidates/level1-pixellab-candidates.manifest.json
```

Contact sheets:

```text
level1-p0-terrain-contact-sheet.png
level1-regenerated-terrain-contact-sheet.png
level1-p1-object-candidates-contact-sheet.png
```

## Collection status

- P0 terrain/path/water candidates: **16 collected**.
- P1 object candidates: **18 collected**.
- Weak-candidate regeneration: **5 collected**.
- Original queued `bridge-planks` and `extraction-flare-road` jobs remain processing in PixelLab, but regenerated replacements are available.

## Terrain/path/water QA

Promising candidates:

- `ground-textures__dusty-sand`
- `ground-textures__packed-dirt`
- `ground-textures__cracked-asphalt`
- `ground-textures__mossy-cobble`
- `roads-and-paths__broken-highway-lane`
- `roads-and-paths__ghost-town-main-street-cobble-dirt-blend`
- `water-and-shorelines__animated-river-strip`
- `water-and-shorelines__rocky-bank`
- `water-and-shorelines__wash-crossing-water`

Regenerated improvements:

- `regenerated-terrain/bridge-planks-regenerated` is a better bridge/deck tile than waiting on the stuck original job.
- `regenerated-terrain/extraction-flare-road-regenerated` is usable as a quiet flare-road candidate.
- `regenerated-terrain/worn-grass-clean-regenerated` is cleaner and flatter than the first worn-grass candidate.
- `regenerated-terrain/dock-support-clean-regenerated` is a better deck-support tile than the original dock-support, though it still needs an in-game collision/readability pass.

Needs another pass:

- `regenerated-terrain/boss-yard-scorched-clean-regenerated` is cleaner but too pale/flat and still lacks strong boss-yard material identity.
- Some water/shoreline tiles read more like single decorative blocks than seamless terrain. Keep as candidates until tiled in-context.

## P1 object QA

Promising as candidate objects/setpieces:

- `buildings-and-walls__gas-station-canopy`
- `buildings-and-walls__stone-brick-wall-segments`
- `trees-rocks-and-natural-blockers__cactus-walls`
- `trees-rocks-and-natural-blockers__mesa-boulders`
- `trees-rocks-and-natural-blockers__pine-oak-clusters`
- `combat-readable-props__cache-crate`
- `combat-readable-props__boss-gate-markers`

Needs regeneration or decomposition:

- Several building/prop outputs are mini-scenes instead of clean single objects. They are useful style candidates, but final runtime integration should split them into individual buildings, wall segments, or props.
- Some signs contain text-like markings. Regenerate any asset with readable fake text/logos before final use.
- `crystal-ore-like-litecoin-blockers` is too small/unclear as a blocker; regenerate as larger standalone crystal/ore chunks.
- `destructible-barrel` and `gas-pump-explosive` read as small setpieces rather than isolated interactable objects; regenerate as single-object sprites for collision/health metadata.

## Integration rule

These assets are **not final integrated runtime art** yet. Treat them as candidate source material. Before runtime integration:

1. split scene-like images into atomic objects when needed
2. clean alpha and remove text-like markings
3. normalize outlines/palette
4. assign render role + collision radius + anchor point
5. atlas-pack and update tests
6. smoke-test in the Level 1 canvas
