# ART — area-art system (plans, renderer, roads, Woods and Meadows)

2026-09-30. Area-art lane, branch `claude/200-area-art`. Projection-only art
for the ten-area world: it reads the authored world and never writes collision,
navigation, spawning, RNG, progression, evidence or results. No paid asset
generation; every card is a frame on the existing HD Tripo prop pages
(`docs/2.0/slices/ART-PROP-KIT-HD.md`) and every ground material is an existing
terrain tile. **Owner art acceptance is not claimed.**

## What shipped

| Piece | File |
| --- | --- |
| Plan schema, validator, material registry, road recipes, tint rules, placement guard, pure geometry | `apps/hmh-reboot/src/world-v2-area-art-schema.mjs` |
| Generic renderer (`createAreaArt`) and shared texture cache | `apps/hmh-reboot/src/world-v2-area-art.mjs` |
| Real-game binding through `world.artPlans` (lazy chunk) | `apps/hmh-reboot/src/world-v2-area-art-binding.mjs` |
| Plan authoring helpers | `apps/hmh-reboot/src/world-v2-area-plans/plan-support.mjs` |
| Rugpull Woods plan | `apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs` |
| MWEB Meadows plan | `apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs` |
| World roads plan (all 14 authored roads) | `apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs` |
| Hooks in the runtime world | `apps/hmh-reboot/src/world-v2-runtime-world.mjs` (`artPlans.districts[id].artTarget`, `artPlans.roads`, `artPlans.authored`) |
| Private scene wiring (behind `mountGreyboxPlaytest(root, { areaArt })`) | `apps/hmh-reboot/src/dev/world-v2-local-scene.mjs` |

The old `dev/world-v2-woods-art.mjs` (256 px kit, soft camp card) is retired;
the Woods plan replaces it with the 768 px market stall row, signal box lookout
and quonset store cards.

## Plan schema (`hmh-area-art-plan/v1`)

A plan is frozen pure data returned by `createXxxArtPlan(world)` where `world`
is the authored greybox (`createGreyboxWorld()`). `validateAreaArtPlan(plan, kitManifest)`
returns a frozen summary (pages, sources, materials, tiles, counts, budget) or
throws a `TypeError` naming the field. Units are world units (40 per metre;
the nominal human is 72 units). All coordinates are absolute world coordinates.

```js
{
  schema: 'hmh-area-art-plan/v1', areaId, runtimeAuthority: 'projection-only', artAccepted: false,
  bounds: { minX, minY, maxX, maxY },           // every point below must lie inside
  pages: ['tripo-props-hd-plants-00.webp', ...], // kit pages this plan loads (see budget)
  ground: {
    base:   { surfaceId: `${areaId}-floor`, material, tint? },            // whole-area fill
    zones:  [{ id, material, vertices: [{x,y}...], feather = 48, alpha = 1, tint? }],
    trails: [{ id, material, points: [{x,y}...], width ≤ 160, halo = 36 }],
    decals: [{ id, source: 'detail:grass' | 'detail:aggregate', x, y, scale, rotation, alpha, tint, flip }],
  },
  roads:  [{ id, roadId, kind: 'paved'|'gravel'|'dirt', points, width, surfaceIds, cracks: [{x,y,scale,flip}] }],  // world-roads plan only
  props:  [{ id, source: 'b1-04', x, y, height, groundZ = 0, tint?, flip, shadow = true, fade = height > 150 }],
  solids: [{ pieceId, style: 'card'|'hedge'|'stakes'|'crates'|'pickets'|'bank'|'mass', source?, fit: 'width'|'height'|'depth', lift, roof?, tint?, massAlpha?, spacing?, height? }],
}
```

- **Materials**: `grass`, `meadow`, `earth`, `sand`, `rock`, `marsh`, `paving`,
  `boardwalk`, `asphalt`, `gravel`, `dirt`, `forest`. Each maps to one 512 px
  tile under `hmh-terrain-tiles` plus its 512×128 fringe (opaque at v=0,
  transparent at v=128) used to feather zone edges outward by `feather`.
  A flat `base` colour is painted under the tile so dark tiles can read lighter.
- **Sources** are HD kit `assetId`s (`b1-NN`, `b2-NN`). Pickup cards are refused.
  `height` is the painted card height in world units from ground pivot to top;
  width follows the card aspect. `groundZ` lifts a card onto a bank/closed mass.
- **Tint rules** (renderer, automatic): `b1-50`, `b1-54`, `b1-55` (teal fantasy
  trees) are multiplied toward the bible foliage green `#65735A`; `b1-49`'s teal
  sprout is warmed; `b2-52`'s yellow mast is neutralised; `b1-08` poppies and
  `b1-07` thistles are desaturated. Any plan tint with saturation ≥ 0.42 in the
  red/orange, gold or cyan hue bands is rejected (`assertDecorativeTint`).
- **Solids** decorate authored blockers by `pieceId`: `card` (faint mass +
  one HD card, `fit` chooses which footprint edge the card matches), `hedge`
  (a row of cards along the long axis, `spacing`), `stakes` (vector timber
  palisade), `crates` (vector supply boxes), `pickets` (vector chalk fence),
  `bank` (textured cliff faces + `roof` material), `mass` (textured box).
- **Clearance rules** (`createPlacementGuard`): a decoration may not stand
  inside a blocker (inflated by its radius), in water, inside a road corridor,
  within `routeClearance` (64) of an inspection route, within `siteClearance`
  (140) of an objective / arena exit / entrance / secret / height option /
  area site, or inside the protected spawn radius (560). `plan-support.mjs`
  exposes `scatter()` (deterministic ellipse fill through the guard),
  `supportAt()` (bank lookup for `groundZ`) and `stableUnit()` hashing so the
  same plan places identical instances on every machine.
- **Palette hooks**: `ground.base.tint`, zone/prop/solid `tint` values are
  multiplicative; area palettes from `ART-DIRECTION-2.0.md §4` are expressed
  as base materials (`meadow` sage, `forest` moss) plus pale tints.

## Page budget

`AREA_ART_KIT_PAGE_BUDGET = 2` exclusive kit pages per area. The props page
(`tripo-props-hd-props-00.webp`) dresses every road, is resident world-wide and
is counted as shared (`AREA_ART_SHARED_KIT_PAGES`), so an area may reach three
pages total. The `world-roads` plan may load only that shared page. Tiles are
512² RGBA (1,048,576 B) plus a 512×128 fringe (262,144 B) each; the detail page
is 256² (262,144 B).

| Plan | Kit pages (exclusive + shared) | Encoded | Decoded full | Decoded @0.5x | Tiles | Instances |
| --- | --- | ---: | ---: | ---: | --- | --- |
| rugpull-woods | plants-00, structures-01 + props-00 | 6,170,898 | 50,331,648 | 12,582,912 | forest-floor, packed-earth, wet-bank (3,932,160 B) | 385 props, 10 solids, 3 zones, 30 trails |
| mweb-meadows | plants-00, structures-00 + props-00 | 6,582,428 | 50,331,648 | 12,582,912 | forest-floor, packed-earth, crushed-ore + detail page (4,194,304 B) | 84 props, 10 solids, 7 zones, 14 trails, 147 decals |
| world-roads | props-00 | 2,093,182 | 16,777,216 | 4,194,304 | road, crushed-ore, packed-earth (3,932,160 B) | 14 roads, 63 props |

Meadows + Woods + roads together touch four distinct pages; one shared
reference-counted cache decodes each page once. Phones (`resolution: 'half'`)
load the `@0.5x` pages. These are texture bytes before GPU overhead and mips;
physical-phone residency measurement remains open.

## Renderer / hook contract

```js
const art = createAreaArt({ world: authored, areaId, plan, kit?, loadTexture?, unloadTexture?, textureCache?, container?, signal?, resolution: 'full'|'half', fetchImpl? });
await art.ready;                       // fetches the kit manifest (unless `kit` given), validates, loads pages + tiles
art.claimsSurface(surfaceId);          // area floor or a road's segment/join ids
art.paintSurface({ target, surface }); // private scene: paints when the floor / first road segment is walked
art.paintGround(target);               // real game: paints everything the plan owns into `target`
art.createSolid(piece);                // one decorated authored solid, or null
art.mountSolids(pieces);               // real game: creates every plan solid, returns their collision blocker ids
art.mount(depthLayer, groundLayer, { host?, depthKey? }); // props via viewport residency; `host` + RenderLayer.attach for the real game
art.update(camera, view, actor);       // residency + overlap fading; returns visible prop count
art.dispose();                         // releases textures, nodes, residency
```

Real game: `world-v2-runtime-world.mjs` sets
`artPlans.districts['mweb-meadows'|'rugpull-woods'].artTarget = { kind: 'area-art-plan', planId, load }`
and `artPlans.roads` with lazy `import()` loaders, plus `artPlans.authored`.
`main.mjs` adds one lazy `import('./world-v2-area-art-binding.mjs')` on the
ten-area path (`LEVEL_ONE_WORLD.artPlans?.authored`, opt-out `?areaArt=0`).
`bindWorldV2AreaArt` inserts one camera-transformed container below the decal
layer, paints ground, attaches props/solids to the shared depth `RenderLayer`
with `worldDepthKey`, and returns `blockerIds` that the production renderer
skips (so the decorated solids are not drawn twice). It is disposed on
`portal:dispose`. Nothing is on the initial static path; the renderer imports
only symbols the pixi vendor chunk re-exports (fill matrices are plain
`{a,b,c,d,tx,ty}` objects because `Matrix` is not vendored).

Remaining eight areas: author `apps/hmh-reboot/src/world-v2-area-plans/<area>.mjs`
exporting `create<Area>ArtPlan(world)` with `createAreaPlanContext`, add the
hook to `WORLD_V2_AREA_ART_HOOKS`, and add a regression to
`tests/hmh-world-v2-area-plans.test.mjs` (determinism, guard clearance, kit
sources, budget). Undressed districts keep `artTarget: null` and the borrowed
greybox kit.

## Roads

All fourteen authored roads get a mitered ribbon per polyline (no overlapping
segment quads): halo (shoulder material, feathered), shoulder, core, then
wheel tracks (paved/gravel) or tyre ruts (dirt). Paved roads scatter cracked
asphalt patches (`b2-47`, alpha 0.58). Along the paved spine (coast–city,
city–meadows) props stand only on the walkable ribbon outside the central 60 %
clearance: guardrail runs (`b2-48`), jersey barriers at both ends (`b2-49`),
one sign gantry (`b2-51`, on the verge since the card spans screen-x), traffic
masts (`b2-52`, neutral tint) and wrecks (`b2-54/55/56/58/61`); gravel roads get
an occasional wreck. Props never enter blockers, water, another road's
clearance, spawn or site clearance (test-enforced).

## Evidence (private scene, under the heavy lock)

`docs/2.0/receipts/area-art-20260930/`: sixteen captures from the private
loopback world (`dist/hmh-world-v2-local`, headless Chrome, WebGL) at desktop
1280×800 @1x and phone framing 414×896 @3x (the phone tier loads the `@0.5x`
pages), plus `browser-report.json` with positions, plan snapshots and residency
counts. Scenes: `meadows-center`, `meadows-relay-court`, `meadows-garden-lane`,
`meadows-woods-road`, `highway-city-meadows`, `woods-center`, `woods-camp`,
`woods-stores` (`desktop-*.png` / `phone-*.png`). One console 404 (favicon);
no page errors; every plan reports `disposed` with zero owned URLs after Close.

First pass, inspected and rejected: zone fringes rendered as opaque bands
(local texture space rescaled the gradient), trail halos read as broad flat
paths, the two Meadows gravel aprons dominated the green, aggregate detail
decals read as dark blobs and the tent's contact shadow was a heavy pool. The
second pass (commit "feather zone fringes…") fixes all five; the 768 px camp
card is crisp at ~300 px, the human (~70 world units on screen) sits correctly
against 34–52-unit ferns and the 1.75 m hedgerows, guardrails and the traffic
mast read at the right scale along the 600-unit highway, and UI stays
contained at phone framing. Still open from the inspection: the camp court is
sparse (four clutter props), the Meadows porch ramp/deck surfaces keep their
greybox paint (the plan does not claim elevated surfaces), and the cracked
asphalt patch reads as a slab rather than a decal.

Real-child captures (`/hmh-reboot/index.html?mode=free&world=ten-area`) were
not taken in this lane: they need a normal `node build.mjs`, which this lane
does not run; the binding path is covered by the headless binding test and
the private-scene captures above. Owner acceptance is not claimed.

## Tests

- `tests/hmh-world-v2-area-art-schema.test.mjs` — 7 (validator, budgets, cue-colour guard, geometry, placement guard)
- `tests/hmh-world-v2-area-plans.test.mjs` — 5 (determinism, Woods, Meadows, roads, page budgets)
- `tests/hmh-world-v2-area-art-renderer.test.mjs` — 4 (headless renderer, shared cache, half tier, failure paths)
- `tests/hmh-world-v2-area-art-binding.test.mjs` — 3 (real-game binding, RenderLayer attach/detach, main.mjs seam)
- `tests/hmh-world-v2-local-scene.test.mjs` — 19 (scene seams updated)
- `tests/hmh-world-v2-runtime-world.test.mjs` — hooks asserted for the two dressed districts

## Not done / open

Owner acceptance; the other eight area plans; calibration of card heights
against the 72-unit human at gameplay zoom (cards are uniform-scaled 45° Blender
renders on a 1:1 y/z projection); physical-phone residency; `visual:reboot`
and the combined-root release gate; the painted Meadows preview pages
(`hmh-art-target/ground-*-preview.webp`) are not reused as base ground because
they bake legacy relay-clearing shadows and a road band that do not match the
ten-area geometry — only their grass/aggregate detail frames are used.
