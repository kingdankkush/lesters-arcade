# Hard Money Heroes — Production Art Pass

Generated: 2026-06-11T20:06:29.980310+00:00

## Scope

This generated pack promotes the PixelLab isometric source art into runtime-ready assets: high-frame-rate character loops, enemy/boss loops, level tiles/props, pickups, weapons, VFX, UI frames, mobile controls, and an animated cabinet.

## Counts

- Characters with derived animation loops: 10
- Level tile sprites: 12
- Prop sprites: 13
- Rotating prop sets: 1
- Pickup sprites: 4
- Weapon sprites: 3
- VFX animations: 5
- UI sprites: 8
- Cabinet rotation frames: 8
- Cabinet source: object8:hard-money-heroes-arcade-cabinet-8dir

## Runtime manifest

`apps/portal/assets/generated/hmh-production-art-pass/hmh-production-art-pass.mjs`

## QA notes

- The remote PixelLab job cap is not a blocker for UI/cabinet/VFX because those are generated locally from deterministic design primitives.
- Character/enemy/boss animation frames are derivative runtime loops from checked-in PixelLab source sprites.
- No secret, credential, or local absolute source path is written to the public manifest.
