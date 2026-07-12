# Hard Money Heroes Level 1 World Blueprint v3 - Initial Art Review

Date: 2026-07-11
Status: historical concept review; superseded by the certified World v3 material and landmark manifests
Scope: two visual benchmarks only; these source images are not runtime assets

## Samples

### A. Terrain, River, Road, and Bridges v2

Source URL: <https://v3b.fal.media/files/b/0aa1ec19/Xutr2iEf7NBUFe5tX7OZY_diWlU9yg.png>

The raw generation is retained in the private project vault outside the repository.

### B. Ghost Saloon Square Arena v2

Source URL: <https://v3b.fal.media/files/b/0aa1ec1a/5aC1ZEu8fAV71ngNeb0KS_OFFeTVG7.png>

The raw generation is retained in the private project vault outside the repository.

Combined contact sheet:

`docs/game-design/assets/hmh-level-1-world-blueprint-v3/approval-samples.png`

## Revision history

The first generations established projection and rendering quality but violated the source prompts:

- terrain sample included a small actor and fantasy snow caps
- saloon sample included readable signs and a large actor crowd
- ghost-town center was too cluttered for gameplay
- both needed stronger shared Crypto Wasteland art direction

Image-to-image revision v2:

- removed every actor
- removed readable text
- replaced snowy fantasy cues with dry slate, rust, mining debris, and industrial remnants
- shifted both images toward dusty silver-blue, gunmetal, desaturated earth, muted teal, and restrained amber
- cleared the Ghost Saloon central dodge oval
- kept detail and cover near the perimeter

## Approval matrix

| Criterion | Sample A | Sample B | Direction |
| --- | --- | --- | --- |
| 2:1 isometric read | Approve | Approve | Lock camera and projection |
| Pixel density | Approve | Approve | Lock as concept-detail target |
| Actor-free source | Pass | Pass | Mandatory for environment masters |
| Readable-text-free source | Pass | Pass | Mandatory for environment masters |
| Northwest lighting | Pass | Pass | Lock direction, vary temperature by biome |
| Grounded structures | Pass | Pass | Preserve contact shadows and foundations |
| Combat-readable center | Pass | Pass after v2 | Keep high detail on arena rims |
| Crypto Wasteland identity | Pass after v2 | Pass after v2 | Keep cues subtle, physical, and original |
| Reusable tile readiness | Concept only | Landmark concept only | Normalize and rebuild before runtime |
| Shared game identity | Pass | Pass | Lock core art direction |

## Proposed style lock

Approve:

- high-detail 16-bit arcade pixel art
- crisp clusters rather than blurred generated pixels
- 2:1 isometric world geometry
- desaturated natural material palette
- silver-blue and muted teal environmental accents
- restrained warm amber practical lights
- detailed rim composition with quieter play centers
- natural wear, rust, mining fragments, and frontier infrastructure
- controlled lighting differences between biomes

Reject:

- generic fantasy snow mountains
- glowing cyberpunk overload
- readable generated signage
- generated actors baked into environments
- random clutter inside combat centers
- full-screen ambient effects baked into tiles
- inferred collision from image pixels

## Material hierarchy to lock

### Natural stone

- irregular silhouettes
- cool slate and weathered brown
- rough value grouping
- limited dark outline at the ground edge

### Cut stone and cobble

- more regular shapes
- dusty mortar
- smaller value range
- intentional wagon wear

### Wood

- clear plank direction
- desaturated brown and grey
- rusted fasteners
- contact-darkened bases

### Metal

- gunmetal and oxidized rust
- silver-blue highlights
- no mirror-like 3D sheen

### Water

- restrained directional bands
- deep-water center darker than banks
- foam only at authored transitions
- no neon glow except a specific gameplay hazard

## Production corrections required after approval

1. Rebuild source masters on an exact 64 by 32 logical grid.
2. Establish one pixels-per-world-unit scale.
3. Normalize common prop scale across scenes.
4. Standardize outline weight.
5. Reduce shadow opacity in movement lanes.
6. Generate only adjacency masks present in the tile-context CSV.
7. Run seam tests for all terrain families.
8. Separate ground, tall props, shadows, water, and occluders into runtime layers.
9. Author collision, navigation, and occlusion metadata separately.
10. Certify one live vertical slice before further generation.

## User approval questions

1. Do you approve the overall pixel-art rendering style?
2. Do you approve the dusty silver-blue, muted teal, rust, and amber palette?
3. Do you approve daylight wilderness plus dusk ghost-town mood variation?
4. Does Sample A feel sufficiently like Hard Money Heroes rather than generic fantasy?
5. Does Sample B feel like the correct Ghost Saloon Square landmark and arena?
6. Should the world lean grittier and darker, brighter and more arcade-like, or remain at this balance?

## Seam follow-up samples

### C. Connected Road and River Neighborhood v2

Source URL: <https://v3b.fal.media/files/b/0aa1ec61/cxqEalT71FAii8XPgP4PQ_rwxcmY6S.png>

Demonstrates:

- constant visual road direction through a connected neighborhood
- river and bank continuation
- bridge deck above water
- restrained low-detail connector areas
- compatible wilderness palette and material language

### D. Cliff, Forest, and Switchback Supertile v2

Source URL: <https://v3b.fal.media/files/b/0aa1ec62/p5ElU0jdo_YgCSh2vFaIW_RqdNpSoL.png>

Demonstrates:

- coherent plateau and cliff-height language
- path continuation through an elevation composition
- separated cliff, cave, water, path, tree, and overhang reads
- compatibility with the same wilderness kit

Combined contact sheet:

`docs/game-design/assets/hmh-level-1-world-blueprint-v3/seam-followup-samples.png`

### Strict verdict

Both are approved as composition references only. Neither raw image is a seam-certified runtime asset.

Remaining raw-generation violations:

- some trees still sit too close to lower and left crop boundaries
- generated features are not guaranteed to align to exact 64 by 32 diamonds
- road and river widths need canonical mask reconstruction
- white backgrounds require controlled layer extraction
- cliff faces, ground, shadows, structures, and overhangs are not yet separate files

Production response:

- do not slice either raw image blindly
- use the images as material and composition references
- reconstruct final terrain through NESW, 47-blob, and Wang masks
- keep buildings, peaks, caves, bridges, and trees as anchored multi-cell structures or overhangs
- certify repeated and randomized neighborhoods before runtime integration
