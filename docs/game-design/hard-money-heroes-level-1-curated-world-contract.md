# Hard Money Heroes Level 1 Curated World Contract

Date: 2026-06-30

## Purpose

This document describes the authored Level 1 world contract implemented in:

```text
apps/portal/src/hmh-level-one-curated-world-contract.mjs
```

It uses only the Justin-curated asset kit manifest:

```text
apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs
```

The old 17k sprite-library editor is not the source of truth for this world pass.

## Quality bar

Level 1 should read like a AAA-quality isometric roguelike shooter world:

- visible diegetic boundaries instead of invisible walls
- authored road spine instead of random wandering
- clear setpieces and points of interest
- open negative-space arenas for combat readability
- mini-boss arenas before the final boss yard
- extraction zone that reads instantly after boss clear
- curated assets first, gap generation only after layout lock

## Macro route

```text
Broken Road Spawn
  -> Ghost Saloon Main Street
  -> Dead Forest Mushroom Grove
  -> Shoreline Ford Crossing
  -> Desert Bone Camp
  -> Warehouse / Gas Station Yard
  -> Rugpull Gulch Boss Yard
  -> Litecoin Road Extraction
```

## Boundary language

The map edges are authored as gameplay-readable blockers:

```text
west: dense tree + water wall
north: rock/ruin ridge
 east: town/warehouse building wall
south: bone/desert/waterline badlands
```

Every boundary owns curated asset refs and a gameplay read. Boundaries should guide movement and composition, not decorate a rectangle.

## Arena language

The contract encodes:

- `ghost-saloon-mainstreet`: first mini-boss street arena, saloon/storefront landmarks
- `dead-forest-mushroom-grove`: optional forest mini-boss pocket with tree-wall boundaries
- `shoreline-ford`: water chokepoint / slow-zone read
- `desert-bone-camp`: large open arena with bones, cactus, and rocks
- `warehouse-gas-station-yard`: second landmark yard for ranged/tank pressure
- `rugpull-gulch-boss-yard`: final boss arena with ruins, bones, storefront/billboard backdrop
- `ltc-road-extraction`: clean post-boss extraction road and Level 2 seam cue

## Missing tie-together assets

The contract intentionally does not request a new giant sprite library. It records only specific gap assets:

- road-to-town transition corners
- shoreline ford edge set
- boss-yard boundary caps
- saloon cover prop set
- desert camp connective props
- extraction pad readability kit

These should be generated only after the layout contract is locked.

## Runtime rule

Future runtime work should consume this contract as data, not duplicate it in ad-hoc renderer conditionals. Use helper exports:

```js
curatedLevelOneCriticalPath()
curatedLevelOnePoiById(id)
curatedLevelOneAssetRefsForZone(zoneId, filters)
validateCuratedLevelOneWorldContract()
```

## Verification

The contract is locked by:

```text
tests/hmh-level-one-curated-world-contract.test.mjs
```

The tests assert:

- campaign metadata attaches the contract
- boundaries exist on all four sides
- critical path covers spawn, arenas, boss, extraction
- every referenced asset key resolves through the curated manifest
- referenced files exist on disk
- missing asset requests stay specific and layout-driven
