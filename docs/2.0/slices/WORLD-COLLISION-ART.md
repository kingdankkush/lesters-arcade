# WORLD — ten-area collision-to-art (2.1)

2026-10-01. Lane COLLISION-ART, branch `claude/201-collision-art` from live
2.0.0 head `f044868ff`. Owner playtest of 2.0.0 (ten-area world): "The
buildings need better wall detection as I was able to walk over some of
them." The ten-area world is about to become Level 1 for Free and Ranked, so
its collision is now authoritative map data. This slice changes authored
geometry data and plan placement only; every geometry change is tabled below
for the verifier lane (RANKED-V8). No version, service-worker, contract or
settlement change.

## Root cause

1. **Seated wrong (every decorated building).** The renderer drew each
   decorated solid's kit card with its anchor, the projected *centre* of the
   model base, on the collider's front edge (`y = bounds.maxY`). Half of every
   painted house, shed, tower and wall stood on open ground in front of its
   collider, so the hero walked "into" the front of the building before
   stopping (a farmhouse by ~110 units, the City market block by ~200).
2. **Walk-through cards (props).** Plans placed cars, trucks, jersey
   barriers, containers, transformers, kiosks, bus shelters, stall rows, big
   rocks, log piles and trees on open walkable ground as projection-only
   cards with no collider: 600+ of them.
3. **Overhangs.** Skyline buildings, roof towers and bank rocks/trees were
   rooted on a support at their anchor only, so wide footprints hung past
   roofs and cliff edges; a few colliders (six low hedge covers, the old oak)
   were larger than their art.

## Rule (40 units per metre, 72-unit human)

`apps/hmh-reboot/src/world-v2-area-plans/card-footprints.mjs` classes every
non-pickup kit item. A card **blocks** when it is a building, structure,
container or vehicle (always; a motorcycle is clutter), a barrier from knee
height (jersey barrier, barricade, sandbag, hedgerow at 30+ units;
the same slab cut to a 18-26-unit headstone or rubble block is walk-over
debris), or a large prop, big rock, tree or pole taller than 48 units
(1.2 m; trees and poles block at the trunk). Grass, flowers, shrubs, ferns,
reeds, crack decals, rails, bridge decks and overhead gantries never block.

A card's footprint is the manifest's `groundFootprintPixels` clipped to its
painted alpha bounds (`cardGroundPixels` in the art schema), at the card's
placement scale; trunks and poles are a 16-32-unit square at the anchor
(stopping where the card stops painting ground). A road guardrail never blocks:
the roads plan stands one only where the corridor's closed land is 24 units
behind it, and that land holds a body (2.1 QA follow-up).

## Audit tool

`node scripts/audit-ten-area-collision-art.mjs [--out DIR] [--no-png]` builds
every area plan, the roads plan and the world-masses plan from the authored
world exactly as the real-game binding does and reports:

| Finding | Meaning |
| --- | --- |
| `walk-over` | a blocking card with < 70% of its footprint on a blocker |
| `overhang` | a blocking card whose footprint reaches > 24 units past the blocker under it |
| `invisible-wall` | a blocker with < 70% of its area under drawn art (a card's silhouette on the ground plane, a drawn mass/bank/stakes/crates/pickets, or the production slab for unclaimed blockers) |
| `blocker-overhang` | a decorated blocker reaching > 24 units past its art |
| `unclassified-source` | a drawn kit item with no collision class |

It writes `audit.json` plus a top-down overlay PNG per area (walkable ground
pale, closed land grey, water blue; blockers blue, walk-over footprints red,
overhangs orange, covered footprints green, invisible walls magenta).
`--write-prop-blockers` regenerates the prop collider module (below).

| | Blocking cards | walk-over | overhang | invisible-wall | blocker-overhang | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before (2.0.0, `receipts/collision-art-20261001/before/`) | 1,563 | 614 | 34 | 7 | 0 | **655** |
| After (`receipts/collision-art-20261001/audit-after.json`) | 1,441 | 0 | 0 | 0 | 0 | **0** |

The before audit ran on an archive of `f044868ff` with the shipped seat
(anchor on the front edge) and the same audit definitions.

## Fixes

### Renderer (projection only)

`seatSolidCardY` (art schema, shared by renderer and audit): a structure's
painted footprint front sits on the collider front edge; a tree's trunk sits
at the collider centre. Hedge segments seat the same way. `mountSolids` also
claims each prop collider whose card its plan places, so no greybox slab is
drawn under a car (an orphaned collider stays unclaimed and visible).

### Authored geometry: resized pieces (15)

Bounds are `minX, minY, maxX, maxY` world units; heights (maxZ) and cover
kinds are unchanged. Grown pieces keep their front edge.

| Piece id | Kind | Area | Before | After | maxZ | Cover | Why |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| `halving-farms-windmill-base` | mass | halving-farms | 15990, 5240, 16210, 5460 | 15835, 5195, 16350, 5460 | 400 | none | watermill card is 515 wide |
| `halving-farms-silo` | mass | halving-farms | 18740, 5290, 18960, 5510 | 18705, 5185, 18990, 5510 | 330 | none | signal-box card footprint |
| `halving-farms-yard-timber` | cover-short | halving-farms | 16760, 6965, 16940, 7035 | 16760, 6925, 16940, 7035 | 48 | short | log pile depth |
| `silver-coast-lighthouse` | mass (octagon) | silver-coast | 1800, 5000, 2100, 5300 | 1750, 4865, 2130, 5300 | 440 | none | octagon chamfer 90 → 30, card footprint |
| `silver-coast-terrace-bench` | cover-short | silver-coast | 3310, 7615, 3490, 7685 | 3310, 7525, 3490, 7685 | 48 | short | sandstone card depth |
| `hashwood-river-capstan-house` | mass | hashwood-river | 7890, 11360, 8070, 11480 | 7890, 11300, 8070, 11480 | 180 | none | card footprint depth |
| `rugpull-woods-lookout-post` | mass | rugpull-woods | 18020, 9840, 18280, 10060 | 18020, 9760, 18280, 10060 | 360 | none | card footprint depth |
| `mweb-meadows-old-oak-placeholder` | mass | mweb-meadows | 11980, 5940, 12240, 6140 | 11980, 5940, 12240, 6040 | 280 | none | trunk-centred oak; front strip had no art |
| `hollow-pines-dead-tree-roots` | mass (polygon) | hollow-pines | 12280, 10050, 12700, 10430 | 12280, 10050, 12700, 10345 | 420 | none | polygon clipped at y 10345 (`[186,-1255],[-196,-1255]` local) |
| `scrypt-bayou-court-low-stack` | cover-short | scrypt-bayou | 1070, 12560, 1330, 12640 | 1070, 12595, 1330, 12640 | 48 | short | painted depth 45 |
| `hashwood-river-court-low-stack` | cover-short | hashwood-river | 5820, 12865, 5980, 12935 | 5820, 12890, 5980, 12935 | 48 | short | painted depth 45 |
| `hollow-pines-low-boundary` | cover-short | hollow-pines | 12090, 11745, 12350, 11815 | 12090, 11770, 12350, 11815 | 48 | short | painted depth 45 |
| `ledger-ridge-landing-barrier` | cover-short | ledger-ridge | 8230, 4160, 8470, 4240 | 8230, 4195, 8470, 4240 | 48 | short | painted depth 45 |
| `fork-fortress-yard-low-barrier` | cover-short | fork-fortress | 11850, 3065, 12150, 3135 | 11850, 3090, 12150, 3135 | 48 | short | painted depth 45 |
| `rugpull-woods-supply-stack` | cover-short | rugpull-woods | 17780, 12255, 18020, 12345 | 17780, 12300, 18020, 12345 | 48 | short | painted depth 45 |

Unchanged: every surface (floors, roads, water, decks, ramps, bridges),
closed mass, world guard, site, road, inspection route and arena. Pieces
635 → 1,068; collision blockers 581 → 1,014 (with the QA follow-up below:
bridge decks, the Ridge cap foot and 31 edge guards).

### Authored geometry: prop colliders (401 new)

`apps/hmh-reboot/src/dev/greybox-prop-blockers.mjs` (generated; do not edit)
adds one `prop-solid` piece per ground-level blocking card a plan draws on
open walkable ground: a rectangle equal to the card's blocking footprint,
`minZ 0`, `maxZ` = painted height, id
`prop-<plan>-<source>-<round x>-<round y>`. Vehicles, containers and hard
barriers (jersey, sandbag, scrap barricade) are combat cover (`short` up to
80 units, `tall` above); hedgerows, trees, rocks and props are not. Prop colliders carry no
`areaId` (area layout budgets are unchanged), and the placement guard,
`supportAt` and the terrain field ignore them, so the plans they were
generated from never move because of them; regeneration is idempotent and
`tests/hmh-ten-area-collision-art.test.mjs` fails if the module is stale.
The full per-collider table is in the appendix.

### Plan placement

| Change | File |
| --- | --- |
| Elevated blocking cards (skyline rows, roof towers, bank rocks and trees) move to the nearest spot where their blocking footprint stands wholly on solids of their own height (edge rows step outward first), else are left out | `plan-support.mjs`, `plan-lines.mjs`, `litecoin-city.mjs` (sign towers) |
| Ground blocking cards keep every inspection route, court centre-to-exit line and court centre-to-cover line clear by 30 units (a body plus margin), stay off the Liquidator's 1,050 x 460 exchange floor and 720 units clear of a district boss court centre | `plan-support.mjs` (`createBlockingCardGuard`), `world-roads.mjs`, `litecoin-city.mjs` |
| Plaza kiosk 1 (LitVMSwap) moves from local (550, 1200) to (400, 1200), off the exchange floor | `city-branding.mjs` |
| City service warehouse card fits its width, not its 800-unit depth | `litecoin-city.mjs` |
| Farms pickup moves from local (-250, 420) to (-250, 560), off the court exit line; the north-south west hedge column (sideways hedge cards) becomes a walk-through shrub line | `halving-farms.mjs` |
| Fortress container moves from local (1850, 400) to (1930, 400), out of the gate-court approach band | `fork-fortress.mjs` |
| Ridge mine entrances set back 10 units into the cap foot; switchback root clumps stay at walk-over height (<= 48) | `ledger-ridge.mjs` |
| Road guardrails stand 12 units inside the road edge (was 30), only where closed land is right behind them | `world-roads.mjs` |
| Hollow Pines pocket debris (root balls, hollow stumps) and Ridge cut-foot timber and stumps drawn at walk-over height (<= 48) | `hollow-pines.mjs`, `ledger-ridge.mjs` |
| Tree trunk colliders at most 32 wide (was 40) | `card-footprints.mjs` |

Visible consequences: drawn cards 3,056 → 3,017. Six City skyline/roof cards
that cannot stand on their support are left out (39 → 33 elevated City
cards; the rest step deeper into the closed land), the six-card Farms west
hedge column becomes a low shrub line, a handful of ground cards that stood on a
walked line or boss floor are left out, and 13 Ridge switchback root clumps
are now walk-over height. Decorated buildings sit back inside their lots by
about half their painted depth.

## Verification

- `tests/hmh-ten-area-collision-art.test.mjs`: every blocking card >= 70%
  covered and <= 24 units overhang; every blocker >= 70% under art; zero
  findings of any kind; the footprint table equals the manifest; the prop
  module is current; the renderer claims each prop collider and seats the
  farmhouse footprint front on its collider front edge; the `at:` evidence
  spawn refuses colliders.
- Greybox world check (`checkGreyboxWorld`): passes. Real enemy nav grid
  walkable fraction 0.4736 → 0.4515 (band 0.45-0.55); every area, cache,
  arena and spawn point reachable and returnable; every road and local route
  sweeps clear both ways; the Fortress (240) and Ridge (300) main-route
  moving bands stay clear; arena exits and cover stand-offs reachable.
- Gameplay: the Liquidator floor points and lock lines, district court
  marks/spawns/thresholds, objectives and POIs stay clear. Authored cover
  stays 31 blockers / 124 faces.
- `tests/hmh-world-v2-*.test.mjs`, `tests/hmh-greybox-*.test.mjs`,
  `tests/hmh-ten-area-*.test.mjs`: 257 pass. `node scripts/syntax-check.mjs`
  passes. Test changes: the area-plan tests' "outside blockers" proof
  ignores prop colliders (by design a card stands on its own); the Farms
  free-hedgerow floor is 5 (was 8) after the west column became shrubs; the
  cover test counts authored and prop cover separately.
- `tests/hmh-*.test.mjs`: the 40 failures are the pre-existing missing legacy
  asset-pack files in this checkout (none touch the ten-area world).

### Real-child wall walk

`scripts/hmh-ten-area-collision-walk.mjs` (built child, headless Chrome,
SwiftShader, 1440 x 900, under the heavy lock; `?evidenceSafe=1&
tenAreaEvidence=at:x,y` stands the hero at a clear stand-off point). For each
of the 30 largest building colliders the hero walks in from a stand-off point
66 units outside each side (clockwise; between sides it walks round the
corner on foot, reloading only when a collider is in the way), and the stop
is compared with the swept-circle contact predicted from its exact start.

| Buildings | Sides walked | Stopped at the predicted wall (<= 3 units on the walking axis) | Slid along a slanted face | Ended inside or closer than the body radius | No clear stand-off with the building first in line |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 30 | 115 | 112 | 3 (two Hollow Pines groves, the dead-tree roots) | **0** | 5 |

Every walked side ended 23.9-24.1 units (the hero radius) from the
building outline; no page errors. Receipt:
`receipts/collision-art-20261001/walk/walk-receipt.json`.

Desktop shots (hero walked into the art, inspected):

| Shot | Spot |
| --- | --- |
| `walk/meadows-farmhouse-south.jpg` | Meadows garden-home farmhouse, south face: the hero stops at the porch and chimney foot |
| `walk/city-market-block-south.jpg` | City market block (corner shop card), south face under the WheelX sign |
| `walk/farms-watermill-south.jpg` | Farms watermill (resized collider), at the door |
| `walk/coast-lighthouse-south.jpg` | Coast lighthouse (resized octagon), at the brick front |
| `walk/city-parked-pickup.jpg` | City parked pickup (prop collider), stopped at the truck bed |
| `walk/fortress-container-west.jpg` | Fortress container stack (prop collider), west face |

## QA follow-up: pins at bridge ends and water banks

QA sweep on integration `5f0c15aca` (merged here first): the hero pinned for
minutes at the west end of the Scrypt Bayou lock bridge near (2700, 12050)
and beside the Hashwood River City bridge near (7262, 11320); 23 enemies
stuck at bridge ends and water edges, some on cells the nav grid marks
unwalkable.

**Cause.** The traversal pass (deep water, a deck's side drop, a ramp's high
side) refuses a whole step and zeroes velocity; it never slides. Only the
swept collision slides. So a body pushed diagonally into a bank or a bridge
side stood still for as long as the input held, at exactly the QA spots: the
inside corners where a ramp, a deck and the bank meet. Two geometry gaps made
the corners worse: every bridge deck overhung 20 units of dry ground past the
water at each end (Bayou deck x 2680..3040 over water 2700..3020; River deck
y 10960..11340 over water 10980..11320), leaving pockets beside the deck ends,
and at Ledger Ridge a 100-unit strip between the north cap and the
maintenance shelf's lip, closed at both ends by the mine entrances, could be
entered only by a 32-drop enemy falling from the shelf and never left.

**Fix (ten-area data only).**

| Change | Pieces | Before | After |
| --- | --- | --- | --- |
| Bridge decks span exactly the channel; ramp feet unchanged, ramps meet the deck at the bank | `scrypt-bayou-{lock,north}-bridge` | x 2680..3040 | x 2700..3020 |
| | `scrypt-bayou-{lock,north}-{west,east}-ramp` | x 2400..2680 / 3040..3320 | x 2400..2700 / 3020..3320 |
| | `hashwood-river-{city,woods}-bridge` | y 10960..11340 | y 10980..11320 |
| | `hashwood-river-{city,woods}-{north,south}-ramp` | y 10700..10960 / 11340..11600 | y 10700..10980 / 11320..11600 |
| Bayou drop marker follows the new deck edge | `scrypt-bayou-drop-intent` | x 3020..3060 | x 3000..3040 |
| Ridge cap foot fills the dead strip (rock, height 160, drawn as a bank) | `ledger-ridge-cap-foot` (new) | none | 7200, 1400, 8110, 1495 |
| Edge guards (`dev/greybox-edge-guards.mjs`, derived): a bank guard 16..28 units inside every deep-water edge with walkable land behind it, cut where a crossing passes (maxZ 8, so shots and sight lines pass over); a rail 12 deep along both sides of every bridge deck and the upper half of each of its ramps (maxZ 40). Never cover, no area id, drawn by the water and deck edges they follow (the binding claims them). | 23 `*-channel-bank-*`, 8 `*-bridge-rail-*` (new) | none | see `audit-after.json` blocker list |

A body now slides along every bank and bridge side, the smallest enemy
(radius 18) still stops 2 units short of the water, and decks and ramps are
entered at their ends. Deck sides elsewhere (porches, gantries, shelves) are
climb/drop ledges with traversal markers and keep the old traversal stop; a
diagonal push into one still halts the body (no slide). Sliding there needs
the traversal pass itself to slide, a runtime change outside this data lane.

**Deep water is invisible in the area-art view.** With area art ready the
whole Bayou channel and River channel paint as marsh/forest grass, not only a
strip: the area ground layer is drawn above the production bake's water
surfaces and the plans paint no water. The surface data is correct (both
channels are `kind: 'water'`, `deepWater: true`, `walkable: false`, polygon
outlines exact), so the WORLD-VISUALS water material can paint them by kind;
this lane changed no material or renderer for it.

**Proofs.** `tests/hmh-ten-area-crossings.test.mjs` (RED with the guards
removed: the north Bayou bridge agent pinned at 2698, 10768):
- the hero walks every bridge end to end and up and down every deck ramp, in
  both directions on three lanes, with no pin (66+ legs);
- 4,000+ diagonal pushes by a hero (r 24) and a small enemy (r 18, the
  conservative nav transitions) around every bridge end and both QA spots:
  no pin;
- every enemy nav cell at a bridge or deck end has a legal edge, is in the
  spawn-reachable and spawn-returnable network, and an agent standing on it
  follows the grid across the crossing without a pin.

Real child (built after the fix, area art ready, headless Chrome 1440 x 900):
the hero held a diagonal toward each QA corner for 3 s
(`receipts/collision-art-20261001/qa-pins/pin-probe.jsonl` and JPGs).

| Probe | Start | End | What happened |
| --- | --- | --- | --- |
| Bayou lock bridge west end, from the north-west (D+S) | 2614, 11993 | 2692, 12034 | walked to the bank, slid 41 south along it, stopped in the bank/rail corner (both colliders) |
| Same, from the south-west (D+W) | 2611, 12504 | 2692, 12466 | slid north along the bank into the far rail corner |
| River City bridge south end, from the south-west (D+W) | 7175, 11400 | 7254, 11328 | slid up the ramp's rail to the bank corner |
| Same, from the south-east (A+W) | 7796, 11399 | 7746, 11328 | slid up the east rail to the bank corner |

Each end position is 24 units (the hero radius) from both guards: a wall
corner, not a traversal pin; with the guards removed the Node proof above
pins at the first bank contact. `area-art-*-paints-as-grass.jpg` show the invisible
channels.

## Receipts

`docs/2.0/receipts/collision-art-20261001/`: `before/audit-before.json` and
`before/overlay-<area>.png` (2.0.0), `audit-after.json` and
`overlay-<area>.png` (this slice), `walk/walk-receipt.json` and six
`walk/*.jpg` desktop shots; `qa-pins/` (QA follow-up probes).

## For the verifier lane (RANKED-V8)

Map data changed: the resized pieces above and in the QA follow-up, the new
`ledger-ridge-cap-foot`, 31 `edge-guard` colliders and 401 new `prop-solid` colliders (all
`minZ 0`, finite `maxZ`, convex rectangles except the two polygon pieces
above). Collision blocker count 581 → 1,014. Roads, routes, sites, arenas,
spawn and bounds are byte-identical to 2.0.0; the only surface changes are the
four bridge decks and their eight ramps (QA follow-up), and the Ranked v8
travel graph re-derived from ground is unchanged (`tests/hmh-ranked-v8-contract.test.mjs`). Any map hash or
geometry version the verifier pins must be taken after this slice. The prop
collider module is generated from the plans, so a later plan edit that moves
a blocking card must regenerate it (the test enforces this).

## Appendix: prop colliders

Per area (by card anchor) and by class, then every collider. "Before" is always
none: the card was drawn without a collider in 2.0.0.

| Area | Prop colliders |
|---|---:|
| fork-fortress | 81 |
| halving-farms | 21 |
| hashwood-river | 84 |
| hollow-pines | 33 |
| ledger-ridge | 25 |
| litecoin-city | 69 |
| mweb-meadows | 18 |
| rugpull-woods | 4 |
| scrypt-bayou | 17 |
| silver-coast | 49 |
| **Total** | **401** |

| Class | Count |
|---|---:|
| barrier | 84 |
| building | 8 |
| container | 6 |
| large-prop | 77 |
| pole | 7 |
| rock | 58 |
| tree | 128 |
| vehicle | 33 |

| Blocker id | Area | Card | Before | After (minX, minY, maxX, maxY) | maxZ | Cover |
|---|---|---|---|---|---:|---|
| `prop-fork-fortress-b1-17-11080-3800` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 11058, 3779, 11102, 3819 | 48 | short |
| `prop-fork-fortress-b1-17-11320-1800` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 11296, 1777, 11344, 1821 | 52 | short |
| `prop-fork-fortress-b1-17-11320-3200` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 11296, 3177, 11344, 3221 | 52 | short |
| `prop-fork-fortress-b1-17-11740-1850` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 11716, 1827, 11764, 1871 | 52 | short |
| `prop-fork-fortress-b1-17-11740-3150` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 11716, 3127, 11764, 3171 | 52 | short |
| `prop-fork-fortress-b1-17-12457-3750` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 12436, 3730, 12478, 3768 | 46 | short |
| `prop-fork-fortress-b1-17-12929-3750` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 12908, 3730, 12950, 3768 | 46 | short |
| `prop-fork-fortress-b1-17-13400-3750` | fork-fortress | b1-17 Sandbag Emplacement | none (walk-through card) | 13379, 3730, 13421, 3768 | 46 | short |
| `prop-fork-fortress-b1-18-11000-2940` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 10937, 2928, 11063, 2951 | 56 | short |
| `prop-fork-fortress-b1-18-11000-3100` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 10935, 3088, 11065, 3111 | 58 | short |
| `prop-fork-fortress-b1-18-11000-3220` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 10937, 3208, 11063, 3231 | 56 | short |
| `prop-fork-fortress-b1-18-11000-3500` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 10937, 3488, 11063, 3511 | 56 | short |
| `prop-fork-fortress-b1-18-11000-3750` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 10935, 3738, 11065, 3761 | 58 | short |
| `prop-fork-fortress-b1-18-11366-1545` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 11305, 1534, 11427, 1556 | 54 | short |
| `prop-fork-fortress-b1-18-11500-3163` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 11446, 3153, 11554, 3173 | 48 | short |
| `prop-fork-fortress-b1-18-11610-4243` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 11556, 4233, 11664, 4253 | 48 | short |
| `prop-fork-fortress-b1-18-11634-1545` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 11573, 1534, 11695, 1556 | 54 | short |
| `prop-fork-fortress-b1-18-11954-1232` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 11900, 1222, 12008, 1241 | 48 | short |
| `prop-fork-fortress-b1-18-12300-3800` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 12235, 3788, 12365, 3811 | 58 | short |
| `prop-fork-fortress-b1-18-12423-1313` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 12369, 1302, 12477, 1322 | 48 | short |
| `prop-fork-fortress-b1-18-12440-657` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 12386, 647, 12494, 667 | 48 | short |
| `prop-fork-fortress-b1-18-12878-1323` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 12824, 1313, 12932, 1333 | 48 | short |
| `prop-fork-fortress-b1-18-12920-650` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 12866, 640, 12974, 660 | 48 | short |
| `prop-fork-fortress-b1-18-13100-3850` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 13035, 3838, 13165, 3861 | 58 | short |
| `prop-fork-fortress-b1-18-13328-990` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 13274, 980, 13382, 1000 | 48 | short |
| `prop-fork-fortress-b1-18-13734-1595` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 13673, 1584, 13795, 1606 | 54 | short |
| `prop-fork-fortress-b1-18-14350-4000` | fork-fortress | b1-18 Scrap Barricade | none (walk-through card) | 14285, 3988, 14415, 4011 | 58 | short |
| `prop-fork-fortress-b1-19-11120-4320` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 11103, 4297, 11137, 4340 | 70 | none |
| `prop-fork-fortress-b1-19-11680-1400` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 11663, 1376, 11698, 1420 | 72 | none |
| `prop-fork-fortress-b1-19-11680-1627` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 11663, 1603, 11698, 1647 | 72 | none |
| `prop-fork-fortress-b1-19-12053-1330` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 12035, 1306, 12071, 1351 | 74 | none |
| `prop-fork-fortress-b1-19-12273-1330` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 12255, 1306, 12291, 1351 | 74 | none |
| `prop-fork-fortress-b1-19-12837-1330` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 12818, 1306, 12855, 1351 | 74 | none |
| `prop-fork-fortress-b1-19-13067-1330` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 13048, 1306, 13085, 1351 | 74 | none |
| `prop-fork-fortress-b1-19-13430-1524` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 13413, 1500, 13448, 1544 | 72 | none |
| `prop-fork-fortress-b1-19-13430-1732` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 13412, 1708, 13447, 1752 | 72 | none |
| `prop-fork-fortress-b1-19-13430-1940` | fork-fortress | b1-19 Power Transformer Unit | none (walk-through card) | 13413, 1916, 13448, 1960 | 72 | none |
| `prop-fork-fortress-b1-41-11680-1513` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 11656, 1501, 11704, 1523 | 78 | none |
| `prop-fork-fortress-b1-41-11680-1740` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 11656, 1728, 11704, 1749 | 78 | none |
| `prop-fork-fortress-b1-41-11980-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 11955, 1318, 12005, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12127-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12102, 1318, 12151, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12200-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12175, 1318, 12225, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12347-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12322, 1318, 12371, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12420-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12395, 1318, 12445, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12760-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12735, 1318, 12785, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12913-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12889, 1318, 12938, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-12990-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 12965, 1318, 13015, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-13143-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 13119, 1318, 13168, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-13220-1330` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 13195, 1318, 13245, 1340 | 80 | none |
| `prop-fork-fortress-b1-41-13430-1420` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 13406, 1408, 13454, 1429 | 78 | none |
| `prop-fork-fortress-b1-41-13430-1836` | fork-fortress | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 13406, 1824, 13454, 1845 | 78 | none |
| `prop-fork-fortress-b1-43-10950-1550` | fork-fortress | b1-43 Weathered Stacked Shipping Containers | none (walk-through card) | 10866, 1518, 11033, 1582 | 170 | tall |
| `prop-fork-fortress-b1-43-11740-1200` | fork-fortress | b1-43 Weathered Stacked Shipping Containers | none (walk-through card) | 11656, 1168, 11823, 1232 | 170 | tall |
| `prop-fork-fortress-b1-43-13380-1200` | fork-fortress | b1-43 Weathered Stacked Shipping Containers | none (walk-through card) | 13297, 1168, 13464, 1232 | 170 | tall |
| `prop-fork-fortress-b1-43-13900-4000` | fork-fortress | b1-43 Weathered Stacked Shipping Containers | none (walk-through card) | 13817, 3968, 13984, 4032 | 170 | tall |
| `prop-fork-fortress-b1-43-13900-900` | fork-fortress | b1-43 Weathered Stacked Shipping Containers | none (walk-through card) | 13817, 868, 13984, 932 | 170 | tall |
| `prop-fork-fortress-b1-43-14430-2900` | fork-fortress | b1-43 Weathered Stacked Shipping Containers | none (walk-through card) | 14346, 2868, 14513, 2932 | 170 | tall |
| `prop-fork-fortress-b2-49-11000-2800` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 10958, 2791, 11042, 2808 | 32 | short |
| `prop-fork-fortress-b2-49-11000-3080` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 10958, 3071, 11042, 3088 | 32 | short |
| `prop-fork-fortress-b2-49-11000-3360` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 10958, 3351, 11042, 3368 | 32 | short |
| `prop-fork-fortress-b2-49-11366-1165` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11324, 1156, 11408, 1173 | 32 | short |
| `prop-fork-fortress-b2-49-11366-1355` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11324, 1346, 11408, 1363 | 32 | short |
| `prop-fork-fortress-b2-49-11366-1735` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11324, 1726, 11408, 1743 | 32 | short |
| `prop-fork-fortress-b2-49-11500-1056` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11458, 1047, 11542, 1064 | 32 | short |
| `prop-fork-fortress-b2-49-11500-1844` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11458, 1835, 11542, 1852 | 32 | short |
| `prop-fork-fortress-b2-49-11634-1165` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11592, 1156, 11676, 1173 | 32 | short |
| `prop-fork-fortress-b2-49-11634-1355` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11592, 1346, 11676, 1363 | 32 | short |
| `prop-fork-fortress-b2-49-11634-1735` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11592, 1726, 11676, 1743 | 32 | short |
| `prop-fork-fortress-b2-49-12300-3750` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 12260, 3742, 12339, 3758 | 30 | short |
| `prop-fork-fortress-b2-49-12614-3750` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 12575, 3742, 12653, 3758 | 30 | short |
| `prop-fork-fortress-b2-49-13086-3750` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13046, 3742, 13125, 3758 | 30 | short |
| `prop-fork-fortress-b2-49-13243-3750` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13204, 3742, 13282, 3758 | 30 | short |
| `prop-fork-fortress-b2-49-13466-1215` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13424, 1206, 13508, 1223 | 32 | short |
| `prop-fork-fortress-b2-49-13466-1405` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13424, 1396, 13508, 1413 | 32 | short |
| `prop-fork-fortress-b2-49-13466-1785` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13424, 1776, 13508, 1793 | 32 | short |
| `prop-fork-fortress-b2-49-13600-1106` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13558, 1097, 13642, 1114 | 32 | short |
| `prop-fork-fortress-b2-49-13600-1894` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13558, 1885, 13642, 1902 | 32 | short |
| `prop-fork-fortress-b2-49-13734-1215` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13692, 1206, 13776, 1223 | 32 | short |
| `prop-fork-fortress-b2-49-13734-1405` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13692, 1396, 13776, 1413 | 32 | short |
| `prop-fork-fortress-b2-49-13734-1785` | fork-fortress | b2-49 Concrete Jersey Barrier | none (walk-through card) | 13692, 1776, 13776, 1793 | 32 | short |
| `prop-fork-fortress-b2-66-12240-1288` | fork-fortress | b2-66 Concrete Bunker Entrance | none (walk-through card) | 12101, 1210, 12378, 1363 | 210 | none |
| `prop-halving-farms-b1-03-15700-7950` | halving-farms | b1-03 Birch Cluster | none (walk-through card) | 15685, 7935, 15715, 7965 | 356 | none |
| `prop-halving-farms-b1-03-19250-4950` | halving-farms | b1-03 Birch Cluster | none (walk-through card) | 19234, 4934, 19266, 4966 | 392 | none |
| `prop-halving-farms-b1-03-19350-6150` | halving-farms | b1-03 Birch Cluster | none (walk-through card) | 19337, 6137, 19363, 6163 | 320 | none |
| `prop-halving-farms-b1-18-16600-5000` | halving-farms | b1-18 Scrap Barricade | none (walk-through card) | 16533, 4987, 16667, 5012 | 60 | short |
| `prop-halving-farms-b2-54-17250-7260` | halving-farms | b2-54 Rusted Pickup Truck | none (walk-through card) | 17186, 7236, 17314, 7280 | 74 | short |
| `prop-halving-farms-b2-57-18750-5020` | halving-farms | b2-57 Flatbed Semi Trailer | none (walk-through card) | 18655, 5000, 18844, 5037 | 60 | short |
| `prop-halving-farms-b2-70-19350-7850` | halving-farms | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 19340, 7840, 19360, 7860 | 221 | none |
| `prop-halving-farms-b2-71-15750-5050` | halving-farms | b2-71 Weeping Willow | none (walk-through card) | 15737, 5037, 15763, 5063 | 323 | none |
| `prop-halving-farms-b2-71-15850-5550` | halving-farms | b2-71 Weeping Willow | none (walk-through card) | 15836, 5536, 15864, 5564 | 340 | none |
| `prop-halving-farms-b2-71-18100-8400` | halving-farms | b2-71 Weeping Willow | none (walk-through card) | 18087, 8387, 18113, 8413 | 301 | none |
| `prop-halving-farms-b2-75-16350-5980` | halving-farms | b2-75 Hedgerow Section | none (walk-through card) | 16275, 5966, 16425, 5991 | 66 | none |
| `prop-halving-farms-b2-75-16550-5980` | halving-farms | b2-75 Hedgerow Section | none (walk-through card) | 16475, 5966, 16625, 5991 | 66 | none |
| `prop-halving-farms-b2-75-16750-5980` | halving-farms | b2-75 Hedgerow Section | none (walk-through card) | 16675, 5966, 16825, 5991 | 66 | none |
| `prop-halving-farms-b2-75-17150-5980` | halving-farms | b2-75 Hedgerow Section | none (walk-through card) | 17075, 5966, 17225, 5991 | 66 | none |
| `prop-halving-farms-b2-75-18925-7630` | halving-farms | b2-75 Hedgerow Section | none (walk-through card) | 18850, 7616, 19000, 7641 | 66 | none |
| `prop-halving-farms-b2-79-16350-8260` | halving-farms | b2-79 Stacked Log Pile | none (walk-through card) | 16311, 8236, 16389, 8283 | 62 | none |
| `prop-halving-farms-b2-79-16980-8220` | halving-farms | b2-79 Stacked Log Pile | none (walk-through card) | 16945, 8198, 17015, 8241 | 56 | none |
| `prop-halving-farms-b2-79-18200-5000` | halving-farms | b2-79 Stacked Log Pile | none (walk-through card) | 18163, 4978, 18236, 5021 | 58 | none |
| `prop-halving-farms-b2-79-18650-8400` | halving-farms | b2-79 Stacked Log Pile | none (walk-through card) | 18612, 8377, 18688, 8422 | 60 | none |
| `prop-halving-farms-b2-80-17400-6400` | halving-farms | b2-80 Stone Well With Winch | none (walk-through card) | 17370, 6375, 17429, 6425 | 92 | none |
| `prop-hashwood-river-b1-42-5600-10800` | hashwood-river | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 5573, 10776, 5626, 10823 | 60 | none |
| `prop-hashwood-river-b1-42-5880-10830` | hashwood-river | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 5843, 10797, 5917, 10862 | 84 | none |
| `prop-hashwood-river-b1-42-6200-10855` | hashwood-river | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6169, 10827, 6231, 10882 | 70 | none |
| `prop-hashwood-river-b1-50-5641-12314` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 5629, 12302, 5653, 12325 | 280 | none |
| `prop-hashwood-river-b1-50-5644-12183` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 5633, 12172, 5655, 12194 | 266 | none |
| `prop-hashwood-river-b1-50-5764-13467` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 5753, 13455, 5776, 13478 | 275 | none |
| `prop-hashwood-river-b1-50-5778-12274` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 5764, 12260, 5792, 12288 | 339 | none |
| `prop-hashwood-river-b1-50-5844-13388` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 5830, 13374, 5859, 13403 | 348 | none |
| `prop-hashwood-river-b1-50-6782-10074` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 6770, 10062, 6793, 10085 | 275 | none |
| `prop-hashwood-river-b1-50-6825-9972` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 6814, 9961, 6836, 9983 | 268 | none |
| `prop-hashwood-river-b1-50-7259-13321` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7245, 13307, 7273, 13335 | 340 | none |
| `prop-hashwood-river-b1-50-7446-13332` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7431, 13318, 7460, 13347 | 343 | none |
| `prop-hashwood-river-b1-50-7666-13016` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7654, 13004, 7677, 13027 | 273 | none |
| `prop-hashwood-river-b1-50-7852-10201` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7840, 10190, 7863, 10213 | 273 | none |
| `prop-hashwood-river-b1-50-7878-13054` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7866, 13041, 7891, 13067 | 306 | none |
| `prop-hashwood-river-b1-50-7993-12976` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7978, 12961, 8008, 12991 | 359 | none |
| `prop-hashwood-river-b1-50-8007-10196` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 7993, 10182, 8021, 10211 | 342 | none |
| `prop-hashwood-river-b1-50-8122-10284` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8110, 10272, 8134, 10296 | 286 | none |
| `prop-hashwood-river-b1-50-8307-10043` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8295, 10031, 8320, 10056 | 299 | none |
| `prop-hashwood-river-b1-50-8320-12159` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8308, 12147, 8333, 12171 | 296 | none |
| `prop-hashwood-river-b1-50-8321-11995` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8309, 11982, 8334, 12008 | 302 | none |
| `prop-hashwood-river-b1-50-8436-9959` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8424, 9947, 8448, 9971 | 286 | none |
| `prop-hashwood-river-b1-50-8532-12793` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8518, 12779, 8546, 12807 | 337 | none |
| `prop-hashwood-river-b1-50-8594-12916` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8580, 12903, 8607, 12930 | 332 | none |
| `prop-hashwood-river-b1-50-8788-12837` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8775, 12824, 8802, 12850 | 323 | none |
| `prop-hashwood-river-b1-50-8900-12290` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8886, 12276, 8913, 12303 | 322 | none |
| `prop-hashwood-river-b1-50-8913-12145` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 8902, 12134, 8925, 12157 | 272 | none |
| `prop-hashwood-river-b1-50-9020-12246` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 9006, 12232, 9035, 12261 | 347 | none |
| `prop-hashwood-river-b1-50-9260-10266` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 9247, 10253, 9274, 10280 | 329 | none |
| `prop-hashwood-river-b1-50-9282-10013` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 9269, 10000, 9295, 10026 | 311 | none |
| `prop-hashwood-river-b1-50-9326-13076` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 9312, 13062, 9340, 13090 | 348 | none |
| `prop-hashwood-river-b1-50-9342-13201` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 9327, 13187, 9356, 13216 | 352 | none |
| `prop-hashwood-river-b1-50-9368-10192` | hashwood-river | b1-50 Stylized Layered Evergreen Tree | none (walk-through card) | 9354, 10178, 9382, 10206 | 338 | none |
| `prop-hashwood-river-b2-72-5553-12239` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5537, 12222, 5569, 12255 | 396 | none |
| `prop-hashwood-river-b2-72-5651-12080` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5635, 12064, 5666, 12095 | 374 | none |
| `prop-hashwood-river-b2-72-5674-13346` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5657, 13329, 5690, 13362 | 418 | none |
| `prop-hashwood-river-b2-72-5678-13484` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5663, 13469, 5694, 13499 | 369 | none |
| `prop-hashwood-river-b2-72-5744-12164` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5730, 12150, 5758, 12178 | 332 | none |
| `prop-hashwood-river-b2-72-5746-13272` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5729, 13256, 5762, 13289 | 405 | none |
| `prop-hashwood-river-b2-72-5769-13368` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 5754, 13352, 5784, 13383 | 366 | none |
| `prop-hashwood-river-b2-72-6819-10194` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 6805, 10180, 6833, 10208 | 330 | none |
| `prop-hashwood-river-b2-72-6907-10137` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 6891, 10122, 6922, 10153 | 371 | none |
| `prop-hashwood-river-b2-72-7011-10061` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 6995, 10046, 7026, 10076 | 364 | none |
| `prop-hashwood-river-b2-72-7031-10164` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7015, 10148, 7047, 10180 | 386 | none |
| `prop-hashwood-river-b2-72-7176-10025` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7162, 10010, 7191, 10039 | 350 | none |
| `prop-hashwood-river-b2-72-7179-9925` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7164, 9910, 7193, 9939 | 350 | none |
| `prop-hashwood-river-b2-72-7292-13414` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7276, 13398, 7308, 13430 | 388 | none |
| `prop-hashwood-river-b2-72-7394-13494` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7380, 13479, 7409, 13508 | 349 | none |
| `prop-hashwood-river-b2-72-7427-13421` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7410, 13404, 7443, 13437 | 404 | none |
| `prop-hashwood-river-b2-72-7549-13397` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7535, 13383, 7562, 13410 | 327 | none |
| `prop-hashwood-river-b2-72-7775-13147` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7762, 13134, 7789, 13161 | 326 | none |
| `prop-hashwood-river-b2-72-7944-10085` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7931, 10071, 7958, 10099 | 326 | none |
| `prop-hashwood-river-b2-72-8009-13254` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 7994, 13239, 8024, 13268 | 357 | none |
| `prop-hashwood-river-b2-72-8043-12018` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8029, 12004, 8057, 12032 | 340 | none |
| `prop-hashwood-river-b2-72-8060-13127` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8046, 13113, 8074, 13142 | 343 | none |
| `prop-hashwood-river-b2-72-8087-12149` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8072, 12134, 8101, 12163 | 346 | none |
| `prop-hashwood-river-b2-72-8100-10020` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8083, 10003, 8116, 10036 | 403 | none |
| `prop-hashwood-river-b2-72-8184-10173` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8171, 10160, 8198, 10187 | 332 | none |
| `prop-hashwood-river-b2-72-8196-12071` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8181, 12056, 8211, 12086 | 359 | none |
| `prop-hashwood-river-b2-72-8258-12277` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8244, 12263, 8273, 12292 | 344 | none |
| `prop-hashwood-river-b2-72-8401-10088` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8387, 10075, 8414, 10102 | 325 | none |
| `prop-hashwood-river-b2-72-8506-10032` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8491, 10017, 8520, 10046 | 346 | none |
| `prop-hashwood-river-b2-72-8540-12698` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8524, 12682, 8555, 12714 | 380 | none |
| `prop-hashwood-river-b2-72-8559-10106` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8544, 10090, 8575, 10121 | 380 | none |
| `prop-hashwood-river-b2-72-8569-9959` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8556, 9946, 8582, 9972 | 315 | none |
| `prop-hashwood-river-b2-72-8653-12829` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8637, 12813, 8669, 12845 | 381 | none |
| `prop-hashwood-river-b2-72-8716-12742` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8699, 12725, 8732, 12758 | 409 | none |
| `prop-hashwood-river-b2-72-8989-12456` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 8975, 12442, 9003, 12469 | 333 | none |
| `prop-hashwood-river-b2-72-9017-13110` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9001, 13094, 9032, 13125 | 375 | none |
| `prop-hashwood-river-b2-72-9092-12372` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9077, 12357, 9106, 12387 | 354 | none |
| `prop-hashwood-river-b2-72-9139-12218` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9123, 12201, 9156, 12234 | 396 | none |
| `prop-hashwood-river-b2-72-9145-13208` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9129, 13192, 9162, 13225 | 417 | none |
| `prop-hashwood-river-b2-72-9165-10278` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9151, 10263, 9180, 10292 | 350 | none |
| `prop-hashwood-river-b2-72-9173-13073` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9158, 13058, 9188, 13088 | 366 | none |
| `prop-hashwood-river-b2-72-9195-10087` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9181, 10073, 9209, 10100 | 334 | none |
| `prop-hashwood-river-b2-72-9200-12952` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9186, 12938, 9214, 12966 | 338 | none |
| `prop-hashwood-river-b2-72-9286-10141` | hashwood-river | b2-72 Tall Conifer Trio | none (walk-through card) | 9270, 10125, 9302, 10157 | 389 | none |
| `prop-hashwood-river-b2-73-5650-13500` | hashwood-river | b2-73 Hollow Stump Shelf Fungus | none (walk-through card) | 5610, 13472, 5690, 13528 | 70 | none |
| `prop-hashwood-river-b2-73-7800-10300` | hashwood-river | b2-73 Hollow Stump Shelf Fungus | none (walk-through card) | 7765, 10275, 7836, 10325 | 62 | none |
| `prop-hashwood-river-b2-74-5600-11920` | hashwood-river | b2-74 Uprooted Root Ball | none (walk-through card) | 5548, 11879, 5653, 11937 | 110 | none |
| `prop-hashwood-river-b2-74-9360-9740` | hashwood-river | b2-74 Uprooted Root Ball | none (walk-through card) | 9304, 9697, 9415, 9758 | 116 | none |
| `prop-hashwood-river-b2-74-9400-13500` | hashwood-river | b2-74 Uprooted Root Ball | none (walk-through card) | 9342, 13455, 9457, 13518 | 120 | none |
| `prop-hashwood-river-b2-79-6980-13360` | hashwood-river | b2-79 Stacked Log Pile | none (walk-through card) | 6945, 13338, 7015, 13381 | 56 | none |
| `prop-hollow-pines-b1-53-10709-9936` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 10698, 9925, 10719, 9946 | 216 | none |
| `prop-hollow-pines-b1-53-11224-10933` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 11214, 10922, 11235, 10943 | 199 | none |
| `prop-hollow-pines-b1-53-11350-12088` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 11339, 12077, 11360, 12098 | 191 | none |
| `prop-hollow-pines-b1-53-11782-13056` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 11772, 13045, 11793, 13066 | 225 | none |
| `prop-hollow-pines-b1-53-11895-10291` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 11884, 10281, 11905, 10302 | 217 | none |
| `prop-hollow-pines-b1-53-12167-13371` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 12157, 13361, 12178, 13382 | 215 | none |
| `prop-hollow-pines-b1-53-13000-13211` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 12989, 13201, 13010, 13222 | 235 | none |
| `prop-hollow-pines-b1-53-13135-10374` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 13124, 10363, 13145, 10384 | 240 | none |
| `prop-hollow-pines-b1-53-13751-11304` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 13740, 11293, 13761, 11314 | 193 | none |
| `prop-hollow-pines-b1-53-14026-11979` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 14015, 11969, 14036, 11990 | 218 | none |
| `prop-hollow-pines-b1-53-14217-13069` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 14206, 13059, 14227, 13080 | 237 | none |
| `prop-hollow-pines-b1-53-14300-11225` | hollow-pines | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 14290, 11214, 14311, 11235 | 227 | none |
| `prop-hollow-pines-b2-70-10778-9855` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 10768, 9845, 10789, 9866 | 199 | none |
| `prop-hollow-pines-b2-70-11219-11120` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 11209, 11109, 11230, 11130 | 237 | none |
| `prop-hollow-pines-b2-70-11323-12209` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 11312, 12198, 11334, 12220 | 263 | none |
| `prop-hollow-pines-b2-70-11779-10331` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 11768, 10320, 11790, 10342 | 261 | none |
| `prop-hollow-pines-b2-70-12020-13088` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 12010, 13077, 12031, 13098 | 232 | none |
| `prop-hollow-pines-b2-70-12317-13368` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 12307, 13357, 12328, 13378 | 221 | none |
| `prop-hollow-pines-b2-70-13069-10279` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 13058, 10269, 13079, 10290 | 200 | none |
| `prop-hollow-pines-b2-70-13154-13106` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 13143, 13096, 13164, 13117 | 225 | none |
| `prop-hollow-pines-b2-70-13790-11138` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 13780, 11127, 13801, 11148 | 247 | none |
| `prop-hollow-pines-b2-70-13962-11868` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 13951, 11858, 13972, 11879 | 223 | none |
| `prop-hollow-pines-b2-70-14117-13191` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 14106, 13180, 14128, 13202 | 262 | none |
| `prop-hollow-pines-b2-70-14267-11075` | hollow-pines | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 14257, 11065, 14278, 11086 | 244 | none |
| `prop-hollow-pines-b2-73-13380-12040` | hollow-pines | b2-73 Hollow Stump Shelf Fungus | none (walk-through card) | 13350, 12019, 13410, 12061 | 52 | none |
| `prop-hollow-pines-b2-79-13920-12070` | hollow-pines | b2-79 Stacked Log Pile | none (walk-through card) | 13885, 12048, 13955, 12091 | 56 | none |
| `prop-hollow-pines-b2-79-13930-12300` | hollow-pines | b2-79 Stacked Log Pile | none (walk-through card) | 13897, 12280, 13963, 12319 | 52 | none |
| `prop-hollow-pines-b2-80-11800-10960` | hollow-pines | b2-80 Stone Well With Winch | none (walk-through card) | 11779, 10942, 11821, 10977 | 64 | none |
| `prop-hollow-pines-b2-80-11800-12200` | hollow-pines | b2-80 Stone Well With Winch | none (walk-through card) | 11779, 12182, 11821, 12217 | 64 | none |
| `prop-hollow-pines-b2-80-12320-12210` | hollow-pines | b2-80 Stone Well With Winch | none (walk-through card) | 12299, 12192, 12341, 12227 | 64 | none |
| `prop-hollow-pines-b2-80-12680-12210` | hollow-pines | b2-80 Stone Well With Winch | none (walk-through card) | 12659, 12192, 12701, 12227 | 64 | none |
| `prop-hollow-pines-b2-80-13200-10960` | hollow-pines | b2-80 Stone Well With Winch | none (walk-through card) | 13179, 10942, 13221, 10977 | 64 | none |
| `prop-hollow-pines-b2-80-13200-12200` | hollow-pines | b2-80 Stone Well With Winch | none (walk-through card) | 13179, 12182, 13221, 12217 | 64 | none |
| `prop-ledger-ridge-b1-16-6210-1420` | ledger-ridge | b1-16 Ore Cart | none (walk-through card) | 6193, 1401, 6228, 1433 | 52 | short |
| `prop-ledger-ridge-b1-16-6860-1440` | ledger-ridge | b1-16 Ore Cart | none (walk-through card) | 6841, 1420, 6879, 1454 | 56 | short |
| `prop-ledger-ridge-b1-16-8380-1450` | ledger-ridge | b1-16 Ore Cart | none (walk-through card) | 8361, 1430, 8399, 1464 | 56 | short |
| `prop-ledger-ridge-b1-16-8580-1440` | ledger-ridge | b1-16 Ore Cart | none (walk-through card) | 8561, 1420, 8599, 1454 | 56 | short |
| `prop-ledger-ridge-b1-42-5565-3381` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 5523, 3342, 5607, 3418 | 96 | none |
| `prop-ledger-ridge-b1-42-5586-3889` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 5544, 3850, 5628, 3926 | 96 | none |
| `prop-ledger-ridge-b1-42-5654-2032` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 5613, 1993, 5697, 2069 | 96 | none |
| `prop-ledger-ridge-b1-42-6219-4155` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6176, 4117, 6260, 4192 | 96 | none |
| `prop-ledger-ridge-b1-42-6310-2175` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6267, 2137, 6351, 2212 | 96 | none |
| `prop-ledger-ridge-b1-42-6318-2680` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6276, 2641, 6360, 2717 | 96 | none |
| `prop-ledger-ridge-b1-42-6925-2651` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6883, 2613, 6967, 2689 | 96 | none |
| `prop-ledger-ridge-b1-42-6944-1944` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6902, 1906, 6987, 1981 | 96 | none |
| `prop-ledger-ridge-b1-42-6975-2328` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 6933, 2290, 7017, 2365 | 96 | none |
| `prop-ledger-ridge-b1-42-7465-1870` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 7423, 1832, 7507, 1907 | 96 | none |
| `prop-ledger-ridge-b1-42-7661-2641` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 7619, 2602, 7703, 2678 | 96 | none |
| `prop-ledger-ridge-b1-42-7975-1860` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 7933, 1822, 8017, 1897 | 96 | none |
| `prop-ledger-ridge-b1-42-8097-2975` | ledger-ridge | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 8055, 2937, 8140, 3012 | 96 | none |
| `prop-ledger-ridge-b2-59-9200-3850` | ledger-ridge | b2-59 Tracked Excavator | none (walk-through card) | 9091, 3815, 9309, 3885 | 120 | tall |
| `prop-ledger-ridge-b2-60-6800-4000` | ledger-ridge | b2-60 Mining Haul Truck | none (walk-through card) | 6710, 3961, 6889, 4037 | 140 | tall |
| `prop-ledger-ridge-b2-60-7950-4320` | ledger-ridge | b2-60 Mining Haul Truck | none (walk-through card) | 7861, 4281, 8040, 4357 | 140 | tall |
| `prop-ledger-ridge-b2-60-9050-4320` | ledger-ridge | b2-60 Mining Haul Truck | none (walk-through card) | 8954, 4279, 9146, 4359 | 150 | tall |
| `prop-ledger-ridge-b2-77-7120-1440` | ledger-ridge | b2-77 Collapsed Mine Entrance | none (walk-through card) | 7032, 1364, 7207, 1497 | 230 | none |
| `prop-ledger-ridge-b2-77-8200-1440` | ledger-ridge | b2-77 Collapsed Mine Entrance | none (walk-through card) | 8113, 1364, 8288, 1497 | 230 | none |
| `prop-ledger-ridge-b2-79-5740-1600` | ledger-ridge | b2-79 Stacked Log Pile | none (walk-through card) | 5709, 1581, 5772, 1619 | 50 | none |
| `prop-ledger-ridge-b2-79-5770-1420` | ledger-ridge | b2-79 Stacked Log Pile | none (walk-through card) | 5736, 1399, 5804, 1440 | 54 | none |
| `prop-litecoin-city-b1-13-7240-6960` | litecoin-city | b1-13 Covered Market Stall Row | none (walk-through card) | 7112, 6934, 7368, 6984 | 120 | none |
| `prop-litecoin-city-b1-13-7940-8280` | litecoin-city | b1-13 Covered Market Stall Row | none (walk-through card) | 7823, 8256, 8057, 8302 | 110 | none |
| `prop-litecoin-city-b1-18-5800-8150` | litecoin-city | b1-18 Scrap Barricade | none (walk-through card) | 5737, 8138, 5863, 8161 | 56 | short |
| `prop-litecoin-city-b1-19-5620-4800` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 4774, 5639, 4822 | 78 | none |
| `prop-litecoin-city-b1-19-5620-5000` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 4974, 5639, 5022 | 78 | none |
| `prop-litecoin-city-b1-19-5620-5200` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 5174, 5639, 5222 | 78 | none |
| `prop-litecoin-city-b1-19-5620-5400` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 5374, 5639, 5422 | 78 | none |
| `prop-litecoin-city-b1-19-5620-5600` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 5574, 5639, 5622 | 78 | none |
| `prop-litecoin-city-b1-19-5620-5800` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 5774, 5639, 5822 | 78 | none |
| `prop-litecoin-city-b1-19-5620-6000` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 5974, 5639, 6022 | 78 | none |
| `prop-litecoin-city-b1-19-5620-6200` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 6174, 5639, 6222 | 78 | none |
| `prop-litecoin-city-b1-19-5620-7150` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 7125, 5638, 7172 | 76 | none |
| `prop-litecoin-city-b1-19-5620-7350` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5602, 7325, 5639, 7372 | 76 | none |
| `prop-litecoin-city-b1-19-5620-7550` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 7525, 5638, 7572 | 76 | none |
| `prop-litecoin-city-b1-19-5620-7750` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5602, 7725, 5639, 7772 | 76 | none |
| `prop-litecoin-city-b1-19-5620-7950` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5601, 7925, 5638, 7972 | 76 | none |
| `prop-litecoin-city-b1-19-5620-8150` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 5602, 8125, 5639, 8172 | 76 | none |
| `prop-litecoin-city-b1-19-6220-8400` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 6199, 8372, 6240, 8424 | 84 | none |
| `prop-litecoin-city-b1-19-6220-8520` | litecoin-city | b1-19 Power Transformer Unit | none (walk-through card) | 6201, 8494, 6240, 8543 | 80 | none |
| `prop-litecoin-city-b1-20-7800-8000` | litecoin-city | b1-20 Busted Payment Kiosk | none (walk-through card) | 7777, 7987, 7823, 8011 | 90 | none |
| `prop-litecoin-city-b1-20-7900-7900` | litecoin-city | b1-20 Busted Payment Kiosk | none (walk-through card) | 7877, 7887, 7923, 7911 | 90 | none |
| `prop-litecoin-city-b1-20-8060-8160` | litecoin-city | b1-20 Busted Payment Kiosk | none (walk-through card) | 8037, 8147, 8083, 8171 | 90 | none |
| `prop-litecoin-city-b1-20-8960-8200` | litecoin-city | b1-20 Busted Payment Kiosk | none (walk-through card) | 8937, 8187, 8983, 8211 | 90 | none |
| `prop-litecoin-city-b1-20-9000-7400` | litecoin-city | b1-20 Busted Payment Kiosk | none (walk-through card) | 8977, 7387, 9023, 7411 | 90 | none |
| `prop-litecoin-city-b1-41-6250-5080` | litecoin-city | b1-41 Weathered Industrial Mining Server Rack | none (walk-through card) | 6228, 5069, 6272, 5088 | 70 | none |
| `prop-litecoin-city-b1-44-9200-8180` | litecoin-city | b1-44 Weathered Vintage Gas Pump | none (walk-through card) | 9180, 8170, 9220, 8189 | 64 | none |
| `prop-litecoin-city-b1-45-6045-7660` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 5995, 7644, 6096, 7674 | 46 | short |
| `prop-litecoin-city-b1-45-6051-7120` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 6003, 7104, 6099, 7134 | 44 | short |
| `prop-litecoin-city-b1-45-6895-6447` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 6844, 6431, 6946, 6462 | 46 | short |
| `prop-litecoin-city-b1-45-7204-8325` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 7154, 8309, 7255, 8339 | 46 | short |
| `prop-litecoin-city-b1-45-7675-5980` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 7624, 5964, 7726, 5994 | 46 | short |
| `prop-litecoin-city-b1-45-7744-6080` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 7698, 6065, 7791, 6093 | 42 | short |
| `prop-litecoin-city-b1-45-8137-6964` | litecoin-city | b1-45 Heavily Rusted Abandoned Sedan | none (walk-through card) | 8086, 6948, 8187, 6979 | 46 | short |
| `prop-litecoin-city-b2-49-6230-6050` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 6186, 6041, 6275, 6059 | 34 | short |
| `prop-litecoin-city-b2-49-6940-5100` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 6895, 5091, 6984, 5109 | 34 | short |
| `prop-litecoin-city-b2-49-7830-7325` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 7788, 7316, 7872, 7333 | 32 | short |
| `prop-litecoin-city-b2-49-7830-7735` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 7788, 7726, 7872, 7743 | 32 | short |
| `prop-litecoin-city-b2-49-7830-7940` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 7788, 7931, 7872, 7948 | 32 | short |
| `prop-litecoin-city-b2-49-7920-7040` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 7878, 7031, 7962, 7048 | 32 | short |
| `prop-litecoin-city-b2-49-8128-7040` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 8086, 7031, 8170, 7048 | 32 | short |
| `prop-litecoin-city-b2-49-8335-7040` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 8293, 7031, 8377, 7048 | 32 | short |
| `prop-litecoin-city-b2-49-8543-7040` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 8501, 7031, 8585, 7048 | 32 | short |
| `prop-litecoin-city-b2-49-8750-7040` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 8708, 7031, 8792, 7048 | 32 | short |
| `prop-litecoin-city-b2-52-7310-6510` | litecoin-city | b2-52 Traffic Light Mast | none (walk-through card) | 7302, 6502, 7318, 6511 | 150 | none |
| `prop-litecoin-city-b2-52-7310-6890` | litecoin-city | b2-52 Traffic Light Mast | none (walk-through card) | 7302, 6882, 7318, 6891 | 150 | none |
| `prop-litecoin-city-b2-52-7690-6510` | litecoin-city | b2-52 Traffic Light Mast | none (walk-through card) | 7682, 6502, 7698, 6511 | 150 | none |
| `prop-litecoin-city-b2-52-7690-6890` | litecoin-city | b2-52 Traffic Light Mast | none (walk-through card) | 7682, 6882, 7698, 6891 | 150 | none |
| `prop-litecoin-city-b2-53-7040-6870` | litecoin-city | b2-53 Bus Shelter | none (walk-through card) | 7002, 6825, 7079, 6874 | 110 | none |
| `prop-litecoin-city-b2-53-7330-7260` | litecoin-city | b2-53 Bus Shelter | none (walk-through card) | 7292, 7215, 7369, 7264 | 110 | none |
| `prop-litecoin-city-b2-53-8060-6520` | litecoin-city | b2-53 Bus Shelter | none (walk-through card) | 8021, 6475, 8098, 6524 | 110 | none |
| `prop-litecoin-city-b2-54-6055-7930` | litecoin-city | b2-54 Rusted Pickup Truck | none (walk-through card) | 5994, 7908, 6115, 7949 | 70 | short |
| `prop-litecoin-city-b2-54-6817-4994` | litecoin-city | b2-54 Rusted Pickup Truck | none (walk-through card) | 6756, 4972, 6877, 5013 | 70 | short |
| `prop-litecoin-city-b2-54-7170-6447` | litecoin-city | b2-54 Rusted Pickup Truck | none (walk-through card) | 7109, 6425, 7230, 6466 | 70 | short |
| `prop-litecoin-city-b2-54-7197-8650` | litecoin-city | b2-54 Rusted Pickup Truck | none (walk-through card) | 7136, 8628, 7257, 8669 | 70 | short |
| `prop-litecoin-city-b2-56-6051-8200` | litecoin-city | b2-56 Armored Transport Van | none (walk-through card) | 5979, 8174, 6123, 8221 | 84 | tall |
| `prop-litecoin-city-b2-56-7083-5004` | litecoin-city | b2-56 Armored Transport Van | none (walk-through card) | 7012, 4979, 7156, 5025 | 84 | tall |
| `prop-litecoin-city-b2-58-6043-7390` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 5993, 7372, 6094, 7408 | 58 | short |
| `prop-litecoin-city-b2-58-7194-8000` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 7143, 7982, 7244, 8018 | 58 | short |
| `prop-litecoin-city-b2-58-7200-6525` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 7146, 6506, 7254, 6544 | 62 | short |
| `prop-litecoin-city-b2-58-7325-6000` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 7272, 5981, 7377, 6018 | 60 | short |
| `prop-litecoin-city-b2-58-7830-6442` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 7780, 6424, 7881, 6460 | 58 | short |
| `prop-mweb-meadows-b1-03-12170-5140` | mweb-meadows | b1-03 Birch Cluster | none (walk-through card) | 12155, 5125, 12185, 5155 | 357 | none |
| `prop-mweb-meadows-b1-03-13020-8200` | mweb-meadows | b1-03 Birch Cluster | none (walk-through card) | 13004, 8184, 13036, 8216 | 386 | none |
| `prop-mweb-meadows-b1-03-14280-4950` | mweb-meadows | b1-03 Birch Cluster | none (walk-through card) | 14266, 4936, 14294, 4964 | 350 | none |
| `prop-mweb-meadows-b2-70-10950-5050` | mweb-meadows | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 10940, 5040, 10960, 5060 | 246 | none |
| `prop-mweb-meadows-b2-71-11000-8320` | mweb-meadows | b2-71 Weeping Willow | none (walk-through card) | 10987, 8307, 11013, 8333 | 312 | none |
| `prop-mweb-meadows-b2-71-11740-5980` | mweb-meadows | b2-71 Weeping Willow | none (walk-through card) | 11726, 5966, 11754, 5994 | 334 | none |
| `prop-mweb-meadows-b2-71-13620-7320` | mweb-meadows | b2-71 Weeping Willow | none (walk-through card) | 13605, 7305, 13635, 7335 | 360 | none |
| `prop-mweb-meadows-b2-71-14060-8200` | mweb-meadows | b2-71 Weeping Willow | none (walk-through card) | 14046, 8186, 14074, 8214 | 341 | none |
| `prop-mweb-meadows-b2-75-11680-5440` | mweb-meadows | b2-75 Hedgerow Section | none (walk-through card) | 11605, 5426, 11755, 5451 | 66 | none |
| `prop-mweb-meadows-b2-75-11860-7880` | mweb-meadows | b2-75 Hedgerow Section | none (walk-through card) | 11785, 7866, 11935, 7891 | 66 | none |
| `prop-mweb-meadows-b2-75-13320-7680` | mweb-meadows | b2-75 Hedgerow Section | none (walk-through card) | 13245, 7666, 13395, 7691 | 66 | none |
| `prop-mweb-meadows-b2-75-13420-5700` | mweb-meadows | b2-75 Hedgerow Section | none (walk-through card) | 13345, 5686, 13495, 5711 | 66 | none |
| `prop-mweb-meadows-b2-79-11200-7260` | mweb-meadows | b2-79 Stacked Log Pile | none (walk-through card) | 11164, 7238, 11237, 7281 | 58 | none |
| `prop-mweb-meadows-b2-79-11640-7640` | mweb-meadows | b2-79 Stacked Log Pile | none (walk-through card) | 11601, 7616, 11679, 7663 | 62 | none |
| `prop-mweb-meadows-b2-80-14060-6100` | mweb-meadows | b2-80 Stone Well With Winch | none (walk-through card) | 14031, 6075, 14089, 6124 | 90 | none |
| `prop-rugpull-woods-b1-17-18060-12160` | rugpull-woods | b1-17 Sandbag Emplacement | none (walk-through card) | 18040, 12141, 18080, 12178 | 44 | short |
| `prop-rugpull-woods-b1-17-18720-11080` | rugpull-woods | b1-17 Sandbag Emplacement | none (walk-through card) | 18699, 11060, 18741, 11098 | 46 | short |
| `prop-rugpull-woods-b1-18-18760-11520` | rugpull-woods | b1-18 Scrap Barricade | none (walk-through card) | 18695, 11508, 18825, 11531 | 58 | short |
| `prop-rugpull-woods-b1-18-18800-12020` | rugpull-woods | b1-18 Scrap Barricade | none (walk-through card) | 18730, 12007, 18870, 12032 | 62 | short |
| `prop-scrypt-bayou-b1-18-4050-12880` | scrypt-bayou | b1-18 Scrap Barricade | none (walk-through card) | 3992, 12869, 4108, 12890 | 52 | short |
| `prop-scrypt-bayou-b1-53-1700-10400` | scrypt-bayou | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 1690, 10390, 1710, 10410 | 238 | none |
| `prop-scrypt-bayou-b2-70-1350-9950` | scrypt-bayou | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 1340, 9940, 1360, 9960 | 247 | none |
| `prop-scrypt-bayou-b2-70-4250-10500` | scrypt-bayou | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 4240, 10490, 4260, 10510 | 247 | none |
| `prop-scrypt-bayou-b2-70-4300-13450` | scrypt-bayou | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 4290, 13440, 4310, 13460 | 247 | none |
| `prop-scrypt-bayou-b2-70-700-12200` | scrypt-bayou | b2-70 Dead Oak Broken Limbs | none (walk-through card) | 690, 12190, 710, 12210 | 247 | none |
| `prop-scrypt-bayou-b2-71-1300-13400` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 1287, 13387, 1313, 13413 | 323 | none |
| `prop-scrypt-bayou-b2-71-2000-13400` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 1987, 13387, 2013, 13413 | 323 | none |
| `prop-scrypt-bayou-b2-71-2200-9900` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 2187, 9887, 2213, 9913 | 323 | none |
| `prop-scrypt-bayou-b2-71-3600-9950` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 3587, 9937, 3613, 9963 | 323 | none |
| `prop-scrypt-bayou-b2-71-4000-11300` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 3987, 11287, 4013, 11313 | 323 | none |
| `prop-scrypt-bayou-b2-71-4300-12200` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 4287, 12187, 4313, 12213 | 323 | none |
| `prop-scrypt-bayou-b2-71-800-10800` | scrypt-bayou | b2-71 Weeping Willow | none (walk-through card) | 787, 10787, 813, 10813 | 323 | none |
| `prop-scrypt-bayou-b2-73-1000-10500` | scrypt-bayou | b2-73 Hollow Stump Shelf Fungus | none (walk-through card) | 962, 10473, 1037, 10527 | 66 | none |
| `prop-scrypt-bayou-b2-73-4150-10900` | scrypt-bayou | b2-73 Hollow Stump Shelf Fungus | none (walk-through card) | 4116, 10876, 4184, 10924 | 60 | none |
| `prop-scrypt-bayou-b2-74-2600-12900` | scrypt-bayou | b2-74 Uprooted Root Ball | none (walk-through card) | 2554, 12864, 2646, 12915 | 96 | none |
| `prop-scrypt-bayou-b2-79-3880-12850` | scrypt-bayou | b2-79 Stacked Log Pile | none (walk-through card) | 3843, 12828, 3916, 12871 | 58 | none |
| `prop-silver-coast-b1-19-3760-7080` | silver-coast | b1-19 Power Transformer Unit | none (walk-through card) | 3740, 7054, 3779, 7103 | 80 | none |
| `prop-silver-coast-b1-42-1033-8072` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1000, 8041, 1067, 8101 | 76 | none |
| `prop-silver-coast-b1-42-1063-6069` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1032, 6041, 1095, 6097 | 71 | none |
| `prop-silver-coast-b1-42-1072-6434` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1043, 6408, 1102, 6460 | 67 | none |
| `prop-silver-coast-b1-42-1095-4754` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1073, 4734, 1117, 4773 | 50 | none |
| `prop-silver-coast-b1-42-1139-6580` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1110, 6553, 1169, 6606 | 67 | none |
| `prop-silver-coast-b1-42-1157-7827` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1129, 7801, 1185, 7851 | 63 | none |
| `prop-silver-coast-b1-42-1169-5982` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1134, 5950, 1205, 6014 | 81 | none |
| `prop-silver-coast-b1-42-1192-7696` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1167, 7673, 1217, 7717 | 56 | none |
| `prop-silver-coast-b1-42-1240-4760` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1209, 4732, 1271, 4787 | 70 | none |
| `prop-silver-coast-b1-42-1247-7429` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1220, 7405, 1272, 7452 | 59 | none |
| `prop-silver-coast-b1-42-1249-6882` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1222, 6858, 1276, 6906 | 61 | none |
| `prop-silver-coast-b1-42-1283-7298` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1250, 7269, 1316, 7327 | 74 | none |
| `prop-silver-coast-b1-42-1322-7025` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1288, 6994, 1356, 7055 | 78 | none |
| `prop-silver-coast-b1-42-1360-5780` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1324, 5748, 1396, 5812 | 81 | none |
| `prop-silver-coast-b1-42-1435-4957` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1404, 4929, 1466, 4985 | 71 | none |
| `prop-silver-coast-b1-42-1449-5673` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1421, 5648, 1476, 5698 | 63 | none |
| `prop-silver-coast-b1-42-1523-5072` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1498, 5050, 1547, 5094 | 55 | none |
| `prop-silver-coast-b1-42-1647-5479` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1619, 5453, 1675, 5504 | 64 | none |
| `prop-silver-coast-b1-42-1669-5319` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 1643, 5295, 1695, 5342 | 59 | none |
| `prop-silver-coast-b1-42-543-4988` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 510, 4958, 576, 5017 | 75 | none |
| `prop-silver-coast-b1-42-543-6919` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 516, 6894, 570, 6942 | 62 | none |
| `prop-silver-coast-b1-42-543-7694` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 521, 7674, 564, 7713 | 49 | none |
| `prop-silver-coast-b1-42-544-7952` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 516, 7927, 572, 7977 | 64 | none |
| `prop-silver-coast-b1-42-546-6140` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 512, 6110, 580, 6170 | 76 | none |
| `prop-silver-coast-b1-42-549-5372` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 520, 5346, 577, 5397 | 64 | none |
| `prop-silver-coast-b1-42-550-5116` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 525, 5094, 574, 5138 | 55 | none |
| `prop-silver-coast-b1-42-553-5756` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 531, 5736, 574, 5775 | 49 | none |
| `prop-silver-coast-b1-42-553-5884` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 522, 5856, 584, 5912 | 71 | none |
| `prop-silver-coast-b1-42-554-7177` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 531, 7156, 576, 7197 | 52 | none |
| `prop-silver-coast-b1-42-560-5500` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 530, 5473, 589, 5526 | 67 | none |
| `prop-silver-coast-b1-42-561-8340` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 525, 8307, 597, 8372 | 82 | none |
| `prop-silver-coast-b1-42-562-6789` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 530, 6760, 595, 6818 | 73 | none |
| `prop-silver-coast-b1-42-563-7565` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 534, 7539, 591, 7590 | 64 | none |
| `prop-silver-coast-b1-42-565-7306` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 537, 7281, 592, 7331 | 63 | none |
| `prop-silver-coast-b1-42-566-8082` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 540, 8059, 591, 8104 | 57 | none |
| `prop-silver-coast-b1-42-629-6524` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 601, 6499, 657, 6549 | 63 | none |
| `prop-silver-coast-b1-42-660-4759` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 638, 4739, 682, 4778 | 50 | none |
| `prop-silver-coast-b1-42-674-6223` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 648, 6199, 699, 6245 | 58 | none |
| `prop-silver-coast-b1-42-680-8400` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 648, 8371, 712, 8428 | 73 | none |
| `prop-silver-coast-b1-42-775-6450` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 750, 6428, 799, 6471 | 55 | none |
| `prop-silver-coast-b1-42-805-4747` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 779, 4723, 831, 4769 | 58 | none |
| `prop-silver-coast-b1-42-923-8189` | silver-coast | b1-42 Stylized Layered Sandstone Rock Formation | none (walk-through card) | 896, 8165, 949, 8212 | 59 | none |
| `prop-silver-coast-b1-53-4350-7300` | silver-coast | b1-53 Twisted Bleached Tree Relic | none (walk-through card) | 4340, 7290, 4360, 7310 | 220 | none |
| `prop-silver-coast-b2-49-3760-7520` | silver-coast | b2-49 Concrete Jersey Barrier | none (walk-through card) | 3718, 7511, 3802, 7528 | 32 | short |
| `prop-silver-coast-b2-71-2800-5100` | silver-coast | b2-71 Weeping Willow | none (walk-through card) | 2788, 5088, 2812, 5112 | 300 | none |
| `prop-silver-coast-b2-71-4350-5100` | silver-coast | b2-71 Weeping Willow | none (walk-through card) | 4337, 5087, 4363, 5113 | 320 | none |
| `prop-silver-coast-b2-75-3060-6500` | silver-coast | b2-75 Hedgerow Section | none (walk-through card) | 2992, 6487, 3128, 6510 | 60 | none |
| `prop-world-roads-b2-49-11270-6460` | mweb-meadows | b2-49 Concrete Jersey Barrier | none (walk-through card) | 11225, 6451, 11314, 6469 | 34 | short |
| `prop-world-roads-b2-49-3730-6940` | silver-coast | b2-49 Concrete Jersey Barrier | none (walk-through card) | 3686, 6931, 3775, 6949 | 34 | short |
| `prop-world-roads-b2-49-6270-6460` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 6225, 6451, 6314, 6469 | 34 | short |
| `prop-world-roads-b2-49-6450-6940` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 6406, 6931, 6495, 6949 | 34 | short |
| `prop-world-roads-b2-49-8550-6460` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 8505, 6451, 8594, 6469 | 34 | short |
| `prop-world-roads-b2-49-8730-6940` | litecoin-city | b2-49 Concrete Jersey Barrier | none (walk-through card) | 8686, 6931, 8775, 6949 | 34 | short |
| `prop-world-roads-b2-52-10960-6960` | mweb-meadows | b2-52 Traffic Light Mast | none (walk-through card) | 10952, 6952, 10968, 6961 | 150 | none |
| `prop-world-roads-b2-52-5960-6960` | litecoin-city | b2-52 Traffic Light Mast | none (walk-through card) | 5952, 6952, 5968, 6961 | 150 | none |
| `prop-world-roads-b2-52-9040-6440` | litecoin-city | b2-52 Traffic Light Mast | none (walk-through card) | 9032, 6432, 9048, 6441 | 150 | none |
| `prop-world-roads-b2-54-14100-6503` | mweb-meadows | b2-54 Rusted Pickup Truck | none (walk-through card) | 14037, 6480, 14162, 6523 | 72 | short |
| `prop-world-roads-b2-54-15600-6897` | halving-farms | b2-54 Rusted Pickup Truck | none (walk-through card) | 15536, 6873, 15664, 6917 | 74 | short |
| `prop-world-roads-b2-55-7303-9800` | hashwood-river | b2-55 Overturned School Bus | none (walk-through card) | 7193, 9769, 7414, 9827 | 96 | tall |
| `prop-world-roads-b2-58-5740-6496` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 5687, 6477, 5792, 6514 | 60 | short |
| `prop-world-roads-b2-58-8920-6496` | litecoin-city | b2-58 Burnt Out Hatchback | none (walk-through card) | 8868, 6477, 8973, 6514 | 60 | short |
