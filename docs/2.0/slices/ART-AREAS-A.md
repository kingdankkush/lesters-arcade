# ART — area plans lane A (Farms, City, Coast, Bayou)

2026-09-30 / 10-01. Lane A, branch `claude/200-areas-a` (merged with
`codex/visual-overhaul-200-20260929` at 7d26c1880). Four production dressing
plans on the existing `hmh-area-art-plan/v1` schema
([ART-AREA-SYSTEM.md](ART-AREA-SYSTEM.md)), each with the district terrain
pair (`plan.ground.terrain = { ...DISTRICT_TERRAIN[area.id] }`). The renderer,
schema, binding, `plan-support.mjs` and `main.mjs` are untouched (terrain lane).
Projection-only: no blocker, surface, water, objective, rule or RNG change.
No paid generation; every card is a frame on the HD Tripo prop pages.
**Owner art acceptance is not claimed.**

## Files

| Piece | File |
| --- | --- |
| Halving Farms plan | `apps/hmh-reboot/src/world-v2-area-plans/halving-farms.mjs` |
| Litecoin City plan | `apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs` |
| City slot → brand data | `apps/hmh-reboot/src/world-v2-area-plans/city-branding.mjs` |
| Silver Coast plan | `apps/hmh-reboot/src/world-v2-area-plans/silver-coast.mjs` |
| Scrypt Bayou plan | `apps/hmh-reboot/src/world-v2-area-plans/scrypt-bayou.mjs` |
| Line / bank / edge-woodland / polygon-edge placement helpers | `apps/hmh-reboot/src/world-v2-area-plans/plan-lines.mjs` |
| Hooks | `WORLD_V2_AREA_ART_HOOKS` in `world-v2-runtime-world.mjs`; private scene list in `dev/world-v2-local-scene.mjs` |
| Regression tests | `tests/hmh-world-v2-area-plans.test.mjs` (one test per area plus the shared `assertAreaPlacements` proof) |

## Per-area summary

| Area | Exclusive pages (+ shared props-00) | Encoded | Decoded full / @0.5x | Ground tiles (bytes) | Props (low / tall) | Solids | Zones | Trails | Decals |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| halving-farms | plants-00, structures-01 | 6,170,898 | 50,331,648 / 12,582,912 | crushed-ore, forest-floor, ledge-top, packed-earth (6,553,600) | 343 (250 / 93) | 11 | 7 | 30 | 68 |
| litecoin-city | structures-00, structures-01 | 7,306,480 | 50,331,648 / 12,582,912 | crushed-ore, industrial-slab, ledge-top, road (6,553,600) | 104 (59 / 45) | 8 | 5 | 14 | 0 |
| silver-coast | plants-00, structures-01 | 6,170,898 | 50,331,648 / 12,582,912 | crushed-ore, industrial-slab, ledge-top, packed-earth, shallow-water (7,864,320) | 292 (217 / 38) | 12 | 6 | 22 | 0 |
| scrypt-bayou | plants-00, structures-00 | 6,582,428 | 50,331,648 / 12,582,912 | bridge-deck, forest-floor, ledge-top, wet-bank (6,553,600) | 429 (304 / 125) | 7 | 5 | 22 | 0 |

Ground bytes include the splat noise page and the shared rock-face overlay.
Every plan stays within two exclusive kit pages, five ground tiles and 8 MB of
ground pages. The four plans together touch the same four kit pages as
Meadows/Woods/River (plants-00, props-00, structures-00, structures-01).

## What each area reads as

- **Halving Farms (brief 03).** Four tilled fields with dirt furrows every 115
  units (each clipped to its longest run clear of the inspection routes) and
  iris/thistle crop rows in the lanes; hedgerow (b2-75) and picket boundaries;
  b2-63 brick warehouse as the barn, b2-68 quonset and b2-63 as stores, the
  b2-67 timber tower as the silo, and the **b2-69 stone watermill (fit height)
  as the windmill-yard landmark**; a gravel apron off the farm road and a
  rutted dirt track ending at the barn door; fallow straw meadows; well, log
  piles, pickup and trailer; woodland on the closed land beyond the edges.
  The clapboard farmhouse (b2-62) and ore silo (b1-14) are on structures-00,
  a third exclusive page next to the watermill, so they are not used.
- **Litecoin City (brief 02).** Asphalt High Street and River Street, a
  masonry exchange plaza with a paved approach axis to the Closing Bell, a
  gravel service lane with barriers, server racks and transformers, the b1-51
  corner shop on the market block, masonry/slate blocks, and the **skyline: a
  cluster of b1-12/b1-52/b1-56 towers on the north commercial roof** (tallest
  card tops in the plan, ~950–1,000 units) plus building rows on the closed
  land west, east and north (never south, where they would rise over the
  exchange). Kerbs carry traffic masts, two sign gantries, three bus
  shelters, kiosks, two market stall rows and parked wrecks. The Liquidator
  plaza centre stays empty (test-enforced). No foliage page, so no street trees.
- **Silver Coast (brief 04).** Chalk banks with layered b1-42 sandstone and
  b1-53 driftwood trees; the **b2-76 rock arch on the headland top** as the
  distance landmark beside the b2-67 lighthouse card; rubble and grass at the
  cliff feet; wet sand along the shore and on the shoreline detour; a paved
  cliff road, terrace court and mansion interior; pale masonry mansion walls;
  three beached b2-46 jetty sections; b2-64 villas and willows on the closed
  land north and east. Shelf planting stays low; nothing tall stands within
  700 units of the lighthouse view. No water is painted on walkable ground.
- **Scrypt Bayou (brief 05).** Moss shoulders and two reed rows along both
  channel banks, cypress/dead oak on the root banks and beyond every edge,
  `boardwalk` planking on both crossings and the side plank route, a timber
  lock apron at the b2-45 lock house and the b1-47 water tower (wheel tower),
  and the **b1-15 stilted guard tower raised to 420 units as the stilt store
  and landmark**. The Lockkeeper court centre stays calm (test-enforced). The
  collapsed mine (b2-77) is on structures-01, a third exclusive page, so the
  culvert stands in for the lock house.

## City branding (names only)

`city-branding.mjs` is the single slot → brand file the brief asks for:
nineteen slots for WheelX, MidasPredict, LitVMSwap, Drunken Cats, Dappit,
Lester Labs, Arkada, OmniHub, Lit Clinic, OnChainGM, Lite Strategy, Luxxfolio,
Canary Capital, Grayscale, Litescribe, Litecoin, LitVM, LiteForge and Lester's
Arcade. No logos, marks, rankings or partnership claims. Seventeen slots name a
placed carrier prop (`litecoin-city-sign-<slot>`: six roof towers, two
gantries, three shelters, one stall row, five kiosks); two name facades
(`litecoin-city-exchange` → Litecoin, `litecoin-city-market-block` →
Lester's Arcade). **The schema has no text primitive** (decals accept only the
ground detail frames), so the carriers stand in the world now and the
lettering is an open renderer hook: `signForProp(propId)` /
`signForPiece(pieceId)` return `{ slot, text, style }` with a slate panel and
chalk text (`CITY_SIGN_STYLE`, cue-colour safe, `logos: false`).

## Tests

- `tests/hmh-world-v2-area-plans.test.mjs` — one regression per area
  (determinism, kit sources, page/ground budget, every ground prop inside the
  area and outside blockers, water, inspection routes, roads, sites and
  spawn; every lifted prop on a support of matching height; area-specific
  landmark, density and brief checks) plus the shared validation loop.
- Hook assertions updated in `hmh-world-v2-runtime-world.test.mjs`,
  `hmh-world-v2-local-scene.test.mjs` and `hmh-world-v2-area-art-binding.test.mjs`.

## Evidence (private scene, under the heavy lock)

`docs/2.0/receipts/area-plans-a-20260930/`: nine desktop captures at
1280×800 @1x from the private loopback world
(`/dist/hmh-world-v2-local/index.html?mode=free&world=world-v2-local`, built
with `node scripts/build-hmh-world-v2-local.mjs`, headless Chrome WebGL),
taken with `capture-areas.mjs` (inspection jump, Begin, then keyboard walking
along inspection-route waypoints). `browser-report.json` records positions and
plan snapshots; `browser-report-coast-landmark.json` is the final Coast
landmark re-capture. One console 404 (favicon); no page errors.

| Scene | File | Actor at |
| --- | --- | --- |
| Farms centre (working yard) | `desktop-farms-center.png` | 17500, 6700 |
| Farms landmark (watermill, crop rows) | `desktop-farms-landmark.png` | 16261, 5709 |
| City centre (junction) | `desktop-city-center.png` | 7500, 6700 |
| City plaza (Liquidator court) | `desktop-city-plaza.png` | 8499, 7469 |
| City skyline (north roof towers) | `desktop-city-skyline.png` | 7980, 4947 |
| Coast centre (terrace court) | `desktop-coast-center.png` | 2500, 6700 |
| Coast landmark (lighthouse view, rock arch) | `desktop-coast-landmark.png` | 2198, 5258 |
| Bayou centre (lock house, water tower, reeds) | `desktop-bayou-center.png` | 2500, 11600 |
| Bayou landmark (stilted guard tower) | `desktop-bayou-landmark.png` | 3547, 12882 |

First pass, inspected and changed: the warm sandstone cards (b1-42 rubble,
the b2-76 arch) and the rusted b1-47 tank read close to the reserved orange cue
band at gameplay zoom, so Coast stone now uses a cool grey tint (`0x98aab4`)
and the water tower `0x9ea29a`; the rock arch sat off-screen north of the
lighthouse view, so it moved to the headland's inland lip beside the
lighthouse; the City skyline capture had stalled against the block's west
face and was re-walked from the north side. Second pass: crop rows, furrows
and the watermill read at the right scale against the 72-unit human; the
junction, kerb wrecks and traffic masts read as streets; the guard tower and
plank walks read clearly; the arch and rubble are muted.

Still visible in the captures: the arena centres (Farms yard, City plaza,
Coast terrace) are deliberately open and read sparse; the b2-67 signal-box
card reads as a house rather than a lighthouse; the masonry `mass` blocks are
flat slate roofs with no facade detail; brand carriers show no lettering yet;
elevated decks and ramps keep greybox paint (white).

## Open / weak spots

- Owner art acceptance; real-child (`?world=ten-area`) captures need a full
  `node build.mjs`, which this lane did not run.
- No text rendering for brand signs and no fog cards: both need renderer work
  owned by the terrain lane.
- City has no planted pockets (two-page budget spent on structures).
- Stand-ins: watermill for the windmill, timber tower for the silo, culvert
  for the lock house, water tower for the wheel tower, canopy shell for villas.
- Card heights are not yet calibrated against the 72-unit human at gameplay
  zoom beyond the inspection below; elevated decks/bridges keep greybox paint.
