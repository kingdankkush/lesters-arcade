# HMH Gameworld Art Direction — Crypto Wasteland, Neon-Noir

Owner brief (2026-08-01): a high-quality, visually creative gameworld to
explore while shooting enemies. Strong creative direction, studied from
reference games, applied through the deterministic pipeline. This document
is the standing creative authority for world art; the technical authority
remains the world contract and the projection-only rules.

## Reference study → applied rules

**Hades (Supergiant)** — the stated quality bar. What actually makes Hades
read at speed: (1) hand-painted surfaces with *broad confident color* and
value structure, never photo-texture noise; (2) hard rim/edge separation
between actors and ground (actors always the brightest saturated thing);
(3) environment saturation is rich but *value-compressed* so the play space
never competes with characters; (4) every room has one memorable set-piece.
Applied: painted-style terrain (shipped in the v2 bake), prop palettes
value-compressed toward their biome's band, one landmark set-piece per
district, actors keep the highest local contrast.

**Nuclear Throne (Vlambeer)** — wasteland density and grit. Junk clusters
sell a wasteland better than large emptiness: debris in patches of 3-7 small
props around a large anchor prop. Applied: dressing composes clusters
(anchor + satellites), never lone props on empty bands.

**Enter the Gungeon (Dodge Roll)** — prop language: every prop silhouette is
readable at 100% zoom in one glance, props never occlude bullets' read.
Applied: props keep clean top-down plan silhouettes; tall props stay off
route corridors (already enforced by corridor tests); cover props read as
cover (blocky, waist-high massing).

**Vampire Survivors / Brotato** — swarm readability under pressure: the
ground must stay *quieter* than the swarm. Applied: terrain value banding
stays within a narrow band per biome; high-frequency contrast is reserved
for actors, pickups, and VFX.

**Death's Door / Tunic** — isometric-ish worlds that feel authored: strong
diagonal composition lines and deliberate negative space near landmarks.
Applied: landmark clearings — dressing density drops in a ring around each
landmark so set-pieces breathe.

## Biome palettes and identity (Litecoin neon-noir accents)

| District | Ground band | Prop palette | Accent (used sparingly) | Set-piece |
| --- | --- | --- | --- | --- |
| Frontier Relay | teal-green earth | weathered wood, gunmetal | relay-cyan `#35d0ff` | signal tower |
| Rugpull Ravine | rust red-rock | dark basalt, dry scrub | warning-amber `#f0ae4c` | forked spire |
| Liquidity Crossing | wet blue-teal banks | reeds, driftwood, rope | litecoin-silver `#bfd3e6` | proof-of-work bridge |
| Hashwood | deep forest green | pine bark, moss stone | shrine-mint `#7ef0c1` | beacon tree |
| Mining Camp | crushed-ore grey | rusted steel, timber | ore-gold `#f0ae4c` | headframe |
| Liquidation Yard | asphalt maroon | containers, wrecks, neon signage | liquidation-pink `#ff527e` | extraction tower |

Rules:
- Props sit within ±2 value steps of their biome ground; accents are ≤8% of
  a prop's pixels.
- Neon accents glow only on powered/interactive things (consoles, beacons,
  terminals) — the wasteland is dead metal and wood; electricity means
  something.
- Water is the only high-specular surface; everything else stays matte so
  the river reads instantly.

## Density targets (per district, gameplay zoom)

- 1 landmark set-piece + breathing ring (dressing-free radius ~300).
- 3-5 anchor props (buildings/machines/large rocks) beyond the blockers.
- 8-16 satellite props in clusters around anchors, never on route clearance.
- Forest override: hashwood stays the densest (tree count leads the map).

## Minimap direction (slice 4)

Neon-noir instrument panel: near-black glass ground, districts as dim tinted
plates, routes as thin lit filaments, water as the one saturated fill.
Explored keeps geometry visible; unexplored is void. Live enemies are hot
red pips only inside current visibility; POIs appear after discovery as
mint diamonds; the player is always the brightest cyan chevron. Everything
on the minimap is an emissive light on glass, not a paper map.

## Non-negotiables carried forward

Deterministic pipelines only (Blender source → rendered atlases; no
hand-painted shipped pixels), projection-only authority, actors read above
environment, corridor clearance tests stay green, bundle and frame budgets
hold.
