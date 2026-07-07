# HMH WO-96 — Level 1 Six-Biome Macro Map Plan

Status: **plan complete, approval required before WO-97 asset generation or runtime map replacement**.

This is a finite, authored Level 1 macro plan. It is intentionally **not** an art-generation approval. Every POI below is `plan-only` until Justin approves the layout/contact-sheet direction.

## Macro grid

- Size: 12 × 7 macro cells
- Acceptance seed for future tour: `1337`
- Critical path: west → east, with optional loops but no random scatter

```text
Y0  .... C C C .....
Y1  .. I I I C F F F ...
Y2  N N I I I C F F F . E E
Y3  N N I I I . F F F . E E
Y4  N N I I I . F F F F E E
Y5  ....... F F F ...
Y6  ................

N = Neon City Core
I = Industrial Yard
C = Old Canal & Riverfront
F = Lakeside Park / Farmstead seam
E = Extraction Plaza
```

## Biomes and route purpose

1. **Neon City Core**
   - Route beats: spawn, first arena
   - Connectors: road to Industrial Yard, water route to Canal
   - Planned POIs: LTC bus stop, animated neon fountain/sign, market alley cache

2. **Industrial Yard**
   - Route beats: arena, pressure
   - Connectors: road to Neon and Canal, trail to Farmstead
   - Planned POIs: dock crane yard, container maze, breaker substation

3. **Old Canal & Riverfront**
   - Route beats: chokepoint
   - Connectors: water from Neon to Lake/Park, road from Industrial
   - Planned POIs: lock bridge, boathouse dock, animated canal sluice gate

4. **Lakeside Park & Old-Growth Forest**
   - Route beats: loop, breather
   - Connectors: water to Canal, trails to Farmstead and Extraction Plaza
   - Planned POIs: lookout tower, ranger cabin, moonlit lake band

5. **Farmstead Outskirts**
   - Route beats: loop, pressure
   - Connectors: trails from Industrial/Park, road to Extraction Plaza
   - Planned POIs: windmill field, barn/silo loop, irrigation ditch

6. **Extraction Plaza**
   - Route beats: boss, extract
   - Connectors: road from Farmstead, trail from Park
   - Planned POIs: extraction arch, boss gate roundabout, LTC beacon pad

## Connectivity rules

- Every biome has at least two connectors, except Extraction Plaza which intentionally has two inbound/readable exit connectors.
- Road, trail, and water connectors are all represented.
- Critical path covers all six biomes in order.
- Water creates a readable canal/lake band instead of decorative puddle scatter.
- Trails provide optional loop routing without breaking the authored west-to-east pressure curve.

## Approval gate

Do not run WO-97 world asset production until Justin approves this macro plan. The next step after approval is contact sheets for each asset family: ground, water, vegetation, buildings, vehicles, critters, animated POIs.
