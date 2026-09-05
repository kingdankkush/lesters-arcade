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

### Atmosphere (W-13, projection-only)

One weather note per district, drawn above the bodies and below the HUD,
keyed only on the simulation tick and a world lattice (never wall clock or
RNG), and capped inside the world particle tier (desktop 10 fog + 30 motes of
50; mobile 6 + 18 of 30; reduced motion 0, with the static grade kept):

| District | Fog bank | Motes | Grade (alpha) |
| --- | --- | --- | --- |
| Frontier Relay | thin teal-grey ground fog | none | relay-cyan toward ground (0.030) |
| Rugpull Ravine | none | warm dust drifting east | warning-amber toward red-rock (0.035) |
| Liquidity Crossing | silver mist on the river only, drifting with the flow | none | litecoin-silver toward wet bank (0.030) |
| Hashwood | faint green haze | mint-yellow pollen, slow fall and sway | shrine-mint toward forest floor (0.030) |
| Mining Camp | low grey dust banks | grey dust drifting east | ore-gold toward crushed ore (0.025) |
| Liquidation Yard | maroon smoke, lifted | rising embers cooling orange to pink | liquidation-pink toward asphalt (0.035) |

Ceilings: fog sprite alpha never exceeds 0.14 (mist) or 0.12 (everything else)
and fog colour stays within the district ground band, so actors remain the
brightest saturated thing under it; motes stay at or under 3 px at zoom 1 and
0.6 additive alpha; the grade never exceeds 0.05 and blends linearly across a
600-unit window centred on every district boundary so it never pops.

## Density targets (per district, gameplay zoom)

Amended Cycle 073 (W-7/W-8). The earlier 3-5 anchors and 8-16 satellites were
met by Cycle 050 and read thin on a 1440x900 window; the pass that raised them
also taught the generator what ground is off limits, so density and clearance
move together.

- 1 landmark set-piece + breathing ring (dressing-free radius 300, enforced).
  Amended Cycle 074 (W-6): the ring is dressing-free, not landmark-free. A
  set-piece is composed — the anchor plus 4-7 satellites at reach 100-270
  INSIDE the ring (hero scale 1.4-1.9, at least two animated signal-kit
  props), on a worn ground ring (decal radius 180). Every anchor and
  satellite clears blockers by 24, route edges by 48, and every arena, camp
  disc, pickup and town stack; anchors stand on the contract landmark where
  that ground is open (ravine, mining, yard) and otherwise on the nearest
  open ground that keeps the district scene floors (relay as a backdrop
  north of the spawn, crossing at the east bridgehead, hashwood on the north
  shoulder).
- Roofless enclosures (W-10, Cycle 074): two or three fence/wall yards per
  level, each wrapping a collision blocker the contract already has so one
  side of the illusion is backed by real collision. Walls run east-west at
  sprite pitch (chain-fence 92, ruined-wall 112); north-south runs are posts
  at <= 72 because the display cannot rotate a sprite; one entrance per yard
  (96-140 wide) flanked by two tall gateposts. Dressing keeps 40 off the rect.
- Ford edges (W-4, Cycle 074): a shallows crossing's long edges are mid-river
  deep-to-shallow transitions, not shorelines. They carry the submerged
  `shallows-band` slope inside the shallows (56 deep, deep tone at the
  boundary dissolving into the bed) and never a foam crest, lit shoreline or
  mid-channel depth band; wear and rut decals never centre on water.
- 10-14 cluster anchors per district, at least 220 apart so clusters stay
  distinct groups, sampled along the playable edge of each shoulder band (the
  camera on the route sees y ~1,000-1,650 and ~3,150-3,800; ground beyond the
  perimeter cliffs, tree lines and machinery is scenery nobody reaches).
- 18-28 satellites in Nuclear Throne debris patches (1-3 per anchor, reach
  40-320), never within 24 units of a collision blocker or a route edge, never
  in deep water, never on an arena floor, never on a pickup. District totals
  32 / 32 / 30 / 40 / 34 / 32 = 200.
- One encampment per spawn point (12) in addition to the five arena camps:
  a ring of 5-6 camp-kit props (fire, bedrolls, one tall element, the
  district's junk) around the point the enemies emerge from, radius 170-200,
  centre within 260 of the spawn point, jittered so no two camps share a
  silhouette. Dressing keeps 60 units off every camp disc.
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
