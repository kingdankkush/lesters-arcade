# Hard Money Heroes Level 1 World Blueprint v3 Implementation Plan

Status: completed and release-certified on 2026-07-12.

> Historical implementation plan retained as the delivery record for the approved World v3 replacement.

**Goal:** Replace the current coarse 263 by 225 Level 1 world with the approved 100 by 100 authored Blueprint v3 while preserving deterministic gameplay, campaign IDs, and runtime stability.

**Architecture:** Keep Blueprint v3 as immutable repo-owned source data. Add pure loading, coordinate, navigation, and render-selection helpers before changing the monolithic gameplay runtime. Integrate one terrain-and-landmark vertical slice first, then migrate the remaining biomes behind tests and exact visual regression.

**Tech Stack:** JavaScript ES modules, Canvas 2D, Node test runner, Python/Pillow build tooling, PNG atlases, JSON/MJS manifests, Playwright/CDP visual-regression harness.

---

## Approval gate

Do not begin live runtime replacement until the user approves:

- map topology
- hydrology
- biome distribution
- terrain pixel scale
- material palette
- lighting direction
- edge-connectivity quality
- Ghost Saloon arena style

## Task 1: Lock Blueprint v3 source contract

**Files:**

- Keep: `docs/game-design/data/hmh-level-1-world-blueprint-v3.json`
- Keep: `docs/game-design/data/hmh-level-1-world-blueprint-v3-tile-contexts.csv`
- Modify: `tests/hmh-level-one-world-blueprint-v3.test.mjs`

**Steps:**

1. Add approved art-style ID and map revision hash to the blueprint.
2. Add test assertions for the approved IDs.
3. Rebuild with `python scripts/build-hmh-level-one-world-blueprint-v3.py`.
4. Run `node --test tests/hmh-level-one-world-blueprint-v3.test.mjs`.

### Existing integration seams to preserve

Blueprint v3 must replace data contracts incrementally rather than bypassing current systems:

- `apps/portal/src/hmh-campaign-levels.mjs`: attach Blueprint v3 alongside `sketchMapPlan`, `curatedWorldContract`, `authoredSetpieceSystem`, `districtPlan`, and `environmentAssetLibrary` before retiring old fields.
- `apps/portal/src/hmh-level-one-sketch-layout.mjs`: adapt or supersede sketch regions, perimeter, waterways, road network, towns/farms, POIs, and asset requests through one compatibility layer.
- `apps/portal/src/hmh-level-one-curated-world-contract.mjs`: preserve stable critical-path and POI lookup behavior, including `curatedLevelOneCriticalPath()`, `curatedLevelOnePoiById()`, and `validateCuratedLevelOneWorldContract()` until equivalent Blueprint v3 APIs pass migration tests.
- `apps/portal/src/hmh-level-one-ground.mjs`: migrate surface selection and PixelLab/final-paint fallback rules to terrain-family and adjacency-mask lookup.
- `apps/portal/src/hmh-level-one-traversal.mjs`: route Blueprint v3 navigation through the current collision-biome seam, including `createLevelOneCollisionBiomeResolver()`, before removing legacy ground-plan assumptions.
- `apps/portal/src/biome-model.mjs` and `apps/portal/src/authored-world-layout.mjs`: reuse deterministic biome/layout primitives where they do not conflict with the authored 100 by 100 contract.
- `apps/portal/src/scene-templates.mjs`: consume Blueprint v3 prop sockets and landmark membership rather than creating independent scatter authority.
- `docs/testing/VISUAL_BASELINES/current/hmh-level-1/`: preserve the old baseline until the approved runtime vertical slice passes source tests and exact visual regression.

Migration tests must prove that `level-1-crypto-wasteland`, campaign progression, boss metadata, extraction metadata, and persisted IDs remain stable.

## Task 2: Build terrain-family source masters

**Files:**

- Raw staging: `~/lesters-arcade-vault/level-1-world-blueprint-v3/`
- Create normalized assets: `apps/portal/assets/generated/hmh-level-one-world-v3/terrain/`
- Create manifest: `apps/portal/assets/generated/hmh-level-one-world-v3/hmh-level-one-world-v3-manifest.mjs`
- Create contact sheets: `docs/game-design/assets/hmh-level-1-world-blueprint-v3/generated/`

**Steps:**

1. Generate one approved family at a time.
2. Normalize to the 64 by 32 footprint.
3. Remove fake backgrounds only where transparency is required.
4. Generate only adjacency combinations present in the CSV.
5. Build a contact sheet and seam test.
6. Add manifest tests before runtime use.

## Task 3: Add pure blueprint loader

**Files:**

- Create: `apps/portal/src/hmh-level-one-world-v3.mjs`
- Create: `tests/hmh-level-one-world-v3.test.mjs`

**Steps:**

1. Write failing tests for dimensions, layer decoding, terrain lookup, and centered coordinate conversion.
2. Implement immutable layer decoding.
3. Implement `authoredToWorld()` and `worldToAuthored()`.
4. Implement cell, neighbor-mask, biome, route, encounter, and elevation lookup.
5. Run targeted tests.

## Task 4: Add navigation and collision adapter

**Files:**

- Create: `apps/portal/src/hmh-level-one-world-v3-navigation.mjs`
- Create: `tests/hmh-level-one-world-v3-navigation.test.mjs`

**Steps:**

1. Test ground, slow, blocked-water, bridge, ford, cliff, and air movement policies.
2. Test perimeter blocking.
3. Test spawn-to-boss and optional-POI connectivity.
4. Implement world-space occupancy and movement-cost lookup.
5. Keep collision independent from image opacity.

## Task 5: Add terrain render selector

**Files:**

- Create: `apps/portal/src/hmh-level-one-world-v3-render.mjs`
- Create: `tests/hmh-level-one-world-v3-render.test.mjs`

**Steps:**

1. Test terrain-family and four-neighbor mask selection.
2. Test deterministic cosmetic variant choice.
3. Test bridge-over-water ordering.
4. Test cliff face and elevation ordering.
5. Implement atlas-frame lookup without touching the live loop.

## Task 6: Integrate the first runtime vertical slice

**Scope:** Broken Road Spawn to Ghost Saloon Square.

**Files:**

- Modify: `apps/portal/main.js`
- Modify: `apps/portal/src/hmh-level-one-visible-runtime.mjs`
- Modify: visual-regression tests and harness

**Steps:**

1. Add a source test that the live runtime imports Blueprint v3 helpers.
2. Render only the approved desert-road-ghost-town slice behind a development flag.
3. Route collision and navigation through Blueprint v3 for that slice.
4. Verify player grounding, enemy grounding, projectile world math, and depth sorting.
5. Capture deterministic seed `1337`.
6. Do not accept a baseline until source tests pass.

## Task 7: Integrate hydrology and bridges

**Steps:**

1. Add deep-water and ford navigation tests.
2. Add bridge-deck depth-sort tests.
3. Add water animation independent of simulation RNG.
4. Verify bridge shadows and no floating actors.
5. Verify air enemies cross water while ground enemies route to bridges.

## Task 8: Integrate the remaining biome loops

Order:

1. Northern forest and mountain loop
2. Central lake and crossroads
3. Southern desert and farm loop
4. Coast and lighthouse
5. Frontier town
6. Rugpull boss yard and extraction

Each biome requires targeted tests, one visual capture, and a contact-sheet review before continuing.

## Task 9: Rebuild encounter activation

**Steps:**

1. Keep every arena physically present.
2. Deterministically promote one optional mini-boss route per run.
3. Assign elite, event, rest, shop, or treasure alternatives to remaining arenas.
4. Test safe spawn rings and arena exits.
5. Test boss and level-up pause behavior.

## Task 10: Performance and visual acceptance

Run:

```bash
npm test
npm run check
npm run contracts:check
npm run build
npm run visual:regression
```

Acceptance:

- no missing atlas frames
- no seam gaps
- no water traversal leaks
- no unreachable critical anchor
- no off-map spawn
- no actor floating or pivot drift caused by terrain elevation
- stable deterministic capture
- mobile and desktop frame budgets remain within existing caps
- zero browser-console errors

## Task 11: Release

1. Independent pre-commit review.
2. Bump release and service-worker markers.
3. Commit explicit files.
4. Push `main` only after approval.
5. Monitor Vercel to `Ready`.
6. Verify production markers, live gameplay, representative assets, and console.
