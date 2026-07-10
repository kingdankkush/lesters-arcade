# Hard Money Heroes July 9 compact-world asset wave

Date integrated: 2026-07-10

## Scope

This wave ingests 13 user-supplied ChatGPT Image PNG sheets, preserves the raw originals outside the runtime asset tree, slices accepted cells deterministically, removes baked white/checkerboard mattes only from the new sources, and records the resulting runtime art in `hmh-curated-level-art`.

Level 1 is reduced from 525x450 to 263x225 tiles. Broad authored terrain districts now cover the complete finite world. Nine new authored POI stamps distribute the accepted props across northwest desert, north forest, north riverfront, northeast neighborhood, west town, east extraction, southwest rock camp, south forest waterfront, and southeast glow-bank regions.

The protected untracked `apps/portal/assets/hmh-curated-level-kit/` directory was not used as a source and was not modified by this ingestion.

## Source inventory

| Source file | Dimensions and mode | Grid | Runtime role | SHA-256 |
|---|---:|---:|---|---|
| `ChatGPT Image Jul 9, 2026, 10_29_22 PM.png` | 1024x1024 RGBA | 2x2 | Extraction monuments and gates | `59b6749f700bcdc792cd136d170b6fc2a40fc78dc22c073f58b183a625ebe4c3` |
| `ChatGPT Image Jul 9, 2026, 10_29_39 PM.png` | 1254x1254 RGB | 4x4 | Extraction plaza terrain | `9b5e9cbba49c5e76d89a1b4c5ca30542aa3ab8ae5923a072d73e417430b3525c` |
| `ChatGPT Image Jul 9, 2026, 10_29_55 PM.png` | 887x1774 RGB | 6x3 | Juniper, dead-tree, and cottonwood idle frames | `18de39a9b5102271694cbaa201d8d4d8155d6fcd4a513ca340f17c252bc8c09a` |
| `ChatGPT Image Jul 9, 2026, 10_30_16 PM.png` | 1254x1254 RGB | 2x2 | Neighborhood props | `c307db0db956ce90ca1aebf2f6fbd615aa508f365cab61504b04c1a2f64eabce` |
| `ChatGPT Image Jul 9, 2026, 10_30_24 PM.png` | 1254x1254 RGB | 2x2 | Forest obstacles | `916d363bf76bf0f1d62aa9a72f33ff49abb6f521ccda30d2c949074e9ecd3091` |
| `ChatGPT Image Jul 9, 2026, 10_32_40 PM.png` | 1024x1024 RGBA | 4x2 | River obstacles and rapid strips | `1f14aaaa322ece32b8f896f0be47a88a293c342237a4179eb8e75230e6d73482` |
| `ChatGPT Image Jul 9, 2026, 10_32_47 PM.png` | 1024x1536 RGBA | 6x3 | Acacia, mesquite, and Joshua-tree idle frames | `cb836f6fe447eae510727e8303204bb909c6d389bd50094552ae082638f0eefb` |
| `ChatGPT Image Jul 9, 2026, 10_32_52 PM.png` | 1024x1536 RGBA | 6x4 | Route signs, lamps, beacons, and floor markers | `a5d6753053300197b559868a9eb863a1c38535bd5c3dd31519dc182baa398aab` |
| `ChatGPT Image Jul 9, 2026, 10_33_09 PM.png` | 1024x1024 RGBA | 2x2 | Desert props | `ce317f0e4ff1195a5a37791e523501e86269c7cf0d661bf623deb9e0d6e4b9d2` |
| `ChatGPT Image Jul 9, 2026, 10_33_15 PM.png` | 1024x1024 RGBA | 6x4 | Riverbank and shoreline terrain | `37722daf09fc924f6315b1ea9e6af93fe250c30bedfe8bad211a8b9827d7c17a` |
| `ChatGPT Image Jul 9, 2026, 10_49_43 PM.png` | 1024x1536 RGBA | 3x2 | Desert rock formations | `b95322772c88d154cbd3c8f1fbcb9ee5c6879c83736792794bbc0d21e9685134` |
| `ChatGPT Image Jul 9, 2026, 10_49_53 PM.png` | 1024x1024 RGBA | 4x4 | Firefly, moss-glow, water-glint, and water-spark effects | `02fc746da7d33beab792850722ecadbeb2cd8f7d4e3eab72d5f1fc7c1d84c872` |
| `ChatGPT Image Jul 9, 2026, 10_49_58 PM.png` | 1024x1024 RGBA | 6x4 | Rapid-water terrain | `74908fbbc03145eb2b58e49caa98d37ea07424a658107d8ca74b050fe1e7b4e5` |

## Generated runtime inventory

- 54 tree idle frames across nine animations
- 32 pre-existing forest-boundary props retained
- 451 environment props, including 70 accepted props/effects from this source wave
- 689 isometric ground tiles
- 689 opaque terrain textures
- 264 approved July 9 terrain textures actively represented in the Level 1 ground plan

## Runtime and performance policy

- Ground textures use deterministic multi-tile patches, not random per-tile scatter.
- Every accepted July 9 terrain texture is reachable through an authored macro district.
- Startup prewarming is limited to terrain keys and props within the spawn neighborhood. Full-map assets decode on demand as the camera approaches them.
- The compact world is 263x225 tiles, down from 525x450.
- Existing spawn and east-corridor scenes remain, while nine new stamps provide authored coverage in the other map quadrants.
- Deterministic gameplay and visual verification continue to use seed `1337`.
