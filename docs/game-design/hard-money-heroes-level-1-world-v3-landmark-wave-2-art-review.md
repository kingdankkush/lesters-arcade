# Hard Money Heroes Level 1 World v3 Landmark Wave 2 Art Review

Status: **release-certified**

## Scope

This wave replaces legacy placeholder compositions at five World v3 route locations with original, repo-owned 2:1 isometric pixel-art landmarks:

| Location | Runtime key | Integrated art |
| --- | --- | --- |
| Ghost Saloon Square | `world-v3-landmark/ghost-saloon-square` | `landmarks/ghost-saloon-square.png` |
| Dry Forest Cave | `world-v3-landmark/dry-forest-cave-mouth` | `landmarks/dry-forest-cave-mouth.png` |
| Mesa Overlook | `world-v3-landmark/mesa-overlook-outcrop` | `landmarks/mesa-overlook-outcrop.png` |
| Frontier Town Square | `world-v3-landmark/frontier-town-exchange-hall` | `landmarks/frontier-town-exchange-hall.png` |
| Litecoin City Threshold | `world-v3-landmark/litecoin-city-threshold-gate` | `landmarks/litecoin-city-threshold-gate.png` |

The relative paths above are rooted at `apps/portal/assets/generated/hmh-level-one-world-v3/`.

## Production treatment

- Original 1024px source generations remain outside the repository as working masters.
- Runtime assets are 256×256 transparent PNGs.
- Magenta generation backgrounds and generated contact shadows were removed before integration.
- Runtime images use nearest-neighbor normalization and a limited 64-color palette.
- Sprites are bottom-center anchored for the Canvas 2D isometric renderer.
- Fake sign lettering and incorrect coin logos were removed during source review.
- The repository contact sheet is `hmh-level-one-world-v3-landmarks-contact-sheet.png`.

## Immutable source provenance

Each runtime manifest entry records provider `fal.ai`, model `flux-2-klein-9b`, a path-free source artifact name, the working master's SHA-256, and its runtime processing policy. Source masters remain outside the repository; the hashes below let a future audit verify an external master without exposing a private filesystem path.

| Runtime key | Source artifact | Source SHA-256 |
| --- | --- | --- |
| `world-v3-landmark/wrecked-litecoin-lighthouse` | `wrecked-litecoin-lighthouse-source.png` | `4122e866868e13166bc8eeca919fbdefabbb8eccdbc5993e27857056bf05a079` |
| `world-v3-landmark/ghost-saloon-square` | `ghost-saloon-square-source.png` | `a0a135121e981efb616f3535d8aee4c7e8a54e199174a4760b70cdefe465b347` |
| `world-v3-landmark/dry-forest-cave-mouth` | `dry-forest-cave-mouth-source.png` | `10594e793d0f6a0b4e0d87eee71c2373fb847e424173c3c1da98d2deb18ba2fd` |
| `world-v3-landmark/mesa-overlook-outcrop` | `mesa-overlook-outcrop-source.png` | `74a17540a6c0c40d67a70f1c88ad7981b4a6ffd3f0ebd9ecb2b6aa24bc2de222` |
| `world-v3-landmark/frontier-town-exchange-hall` | `frontier-town-exchange-hall-source.png` | `1f5c4db862d47607c4962b4788e16d72cf2b2d569ef1122b912d74f14a6cb128` |
| `world-v3-landmark/litecoin-city-threshold-gate` | `litecoin-city-threshold-gate-source.png` | `41580734cd4e271c99ae845b4e1b8a9afc19c9a0fb698cea0e4652a7d45e4925` |

## Runtime and gameplay policy

Rendered alpha does not define collision. World v3 metadata remains authoritative for movement, projectiles, line of sight, depth sorting, and interaction.

- Saloon, cave, mesa, and exchange hall use explicit solid rectangular footprints outside their arena-clearance radii.
- The extraction gate is a non-solid overhang composition so its open roadway remains traversable.
- Existing semantic boundaries continue to control the Litecoin City threshold.
- Critical and optional route reachability is tested after placement.

## Retired placeholders

The following legacy stamps no longer provide the focal art at their former locations:

- `ghost-town-facade-row-pocket`
- `wo104-forest-canopy-cliff-checkpoint`
- `compact-northwest-desert-outcrop`
- `wo105-second-town-road-checkpoint`
- `litecoin-extraction-beacon-pad`
- `wo104-lakeside-firefly-bank-checkpoint`

Dry Forest's duplicate cave-rock and pine-wall encounter props and Mesa's geometric cliff-switchback prop were also removed. Lightweight encounter cues, terrain pressure, encounter templates, torches, gates, rails, and glint markers remain active.

## Visual acceptance

Seed `1337` captures were reviewed for:

- alpha edges and magenta-halo cleanup;
- bottom grounding and scale;
- 2:1 isometric perspective;
- palette and pixel-density consistency;
- combat-space clearance;
- route readability;
- depth sorting;
- duplicate placeholder removal;
- water and bridge presentation;
- HUD and minimap continuity.

Accepted views include Ghost Town, Dry Forest, Mesa Overlook, Oasis Lakeside, Frontier Town, boss yard, extraction, and the west boundary. The intentional render-anchor update was accepted and then reproduced with an exact pixel match.

## Verification evidence

- Landmark manifest and resolver coverage passed.
- World v3 object placement and route-reachability tests passed.
- Encounter visual tests passed after duplicate retirement.
- Every integrated landmark decoded in the browser tour.
- The Ghost Saloon collision probe stopped movement at its authored footprint.
- Oasis rendered authored water-flow presentation.
- The finite west boundary remained clamped.
- The visual regression harness passed after acceptance.
- The sampled ground pass remained within the established render budget.

No raw generation dump, prompt log, private local path, or ignored source-kit asset is part of the runtime release.
