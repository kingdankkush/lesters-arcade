# WO-102 Mega-Prop Proof Capture

Seed: `1337`  
Capture date: 2026-07-07  
Runtime path: Level 1 curated visible runtime -> `currentObstacles()` -> canvas draw pass.

## Accepted PixelLab winners

| Slot | Candidate | Runtime key | Capture |
| --- | --- | --- | --- |
| Noodle storefront block | `wo102-noodle-bar-storefront/candidate-01` | `wo102-megaprop/noodle-bar-storefront` | `01-noodle-storefront.png` |
| Forest rock/cliff outcrop | `wo102-forest-rock-outcrop/candidate-09` | `wo102-megaprop/forest-rock-outcrop` | `02-forest-rock-outcrop.png` |
| Farm barn+silo cluster | `wo102-farm-barn-silo-cluster/candidate-09` | `wo102-megaprop/farm-barn-silo-cluster` | `03-farm-barn-silo.png` |

## R1 observations

- At seed `1337`, player near grid `40,8`: noodle storefront mega-prop is visible in the authored town/frontage draw set.
- At seed `1337`, player near grid `57,8`: forest rock/cliff mega-prop is visible on the nature/river route draw set.
- At seed `1337`, player near grid `76,7`: farm barn+silo mega-prop is visible in the residential/farm route draw set.

## Integration notes

- Assets are alpha-cleaned PixelLab outputs, not script-drawn placeholder art.
- Runtime metadata includes `footprintTiles`, `groundContactY`, `collisionPolygons`, and `overSlice` for each accepted mega-prop.
- The proof screenshots also showed the larger art problem clearly: broad ground still read as checkerboard/prototype terrain. WO-103 expands PixelLab ground/water surface coverage to address that immediately.
