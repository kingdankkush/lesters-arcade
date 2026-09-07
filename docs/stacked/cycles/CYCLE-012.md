# STACKED Cycle S-12 — actual board renderer

Date: 2026-09-06 PDT  
Branch/base: `feature/stacked-renderer` / `a9100b37a58ade116fca420e57565c59bad38922`  
Scope: responsive Pixi board projection, two-board geometry seam, render-only shell fixture,
strict-CSP browser correction, and first measured STACKED budgets. No simulation, bridge, gameplay
claim, deployment or commit.

## Outcome

`dist/stacked/game.js` now contains the actual renderer: the six-layer root, two pre-created board
slots, seven per-board layers, fixed logical root fit, pure safe-area-aware layout, y-up 10×24 board
projection with four clipped buffer rows, pooled locked/active/ghost/preview/trail visuals, HUD,
frame-release callbacks, reset and disposal. Slot 1 remains empty and hidden in Phase 1.

The standalone shell presents a frozen fixture labelled `render-only`; it cannot accept input or
write results, evidence, Ranked state, profiles or settlement. Status copy says it is awaiting the
parent runtime. No fake simulation was added and render modules do not import the absent canonical
simulation.

The strict-CSP failure found by the serialized parent browser pass is corrected without changing
policy. STACKED's dedicated Pixi vendor imports `pixi.js/unsafe-eval` before exporting Pixi classes;
Pixi 8.19.0's compatibility subpath provides no-eval shader, uniform and particle implementations.
The HMH vendor source and emitted HMH graph remain unchanged. Shell title, stage/canvas ARIA, loading,
success and failure copy now brand the cabinet as `STACKED`; `HALVING` remains reserved for the
four-line-clear callout.

## RED / GREEN

RED: `node --test tests/stacked-layout.test.mjs tests/stacked-root-fit.test.mjs tests/stacked-render-tree.test.mjs`
failed 3/3 at module resolution because the required implementation files did not exist.

GREEN: the same command passed 9/9. Final focused S11/S12/contract coverage passed 59/59 with no
skip/todo. `npm run check` passed
417 JavaScript modules and 56 Python scripts.

Correction RED: `node --test tests/stacked-shell.test.mjs` failed 2/5: the shell still branded the
whole game `HALVING`, and the dedicated vendor lacked the no-eval compatibility import. The asserted
browser command `node scripts/stacked-browser-audit.mjs --output-dir=.tmp/S12-browser/red` completed
desktop then mobile and exited 1; both profiles had zero canvases, no `assetsReady`, and the Pixi
unsafe-eval page error under the real strict header.

Correction GREEN: focused shell/budget/contract coverage passed 51/51. After the final build,
`node scripts/stacked-browser-audit.mjs --output-dir=.tmp/S12-browser/green` completed desktop then
mobile and exited 0. Both responses were HTTP 200 under `script-src 'self'` with no `unsafe-eval` or
`unsafe-inline`; both had exactly one canvas, `assetsReady=true`, `fixture=render-only`, no overflow,
zero page errors and zero recorded network errors. The desktop run retained one dev-preview 404
console message; mobile was console-clean. This is CSP boot proof, not a gameplay or visual pass.

## First measured STACKED-only budgets

Final `npm run build` passed after the CSP compatibility import. Exact byte counts from emitted
files follow. Gzip values use Node.js `zlib.gzipSync` at level 9; they are not Python-zlib claims.

| Artifact | Raw | gzip -9 |
| --- | ---: | ---: |
| `dist/stacked/game.js` | 11,485 | 4,889 |
| static imported chunk | 655 | 385 |
| `dist/stacked/stacked-pixi-v1.js` | 496,615 | 146,890 |
| complete initial graph | 508,755 | 152,164 |

Caps use the worker-mandated 8% margin rounded upward to 4,096-byte units:

- entry: programmatic `ceil(11,485 × 1.08 / 4,096) × 4,096 = 16,384`
- initial graph: programmatic `ceil(508,755 × 1.08 / 4,096) × 4,096 = 552,960`

This is the documented first-baseline exception. Future unfinished growth requires an explicit,
measured development-baseline revision; the limits must not move silently. `contracts.json` was
regenerated. HMH remained exactly at the S11 baseline: 927,616 bytes entry + vendor and 994,069 bytes
including its 66,453-byte static graph. Its Pixi source and caps were untouched.

## Second correction: compositor pixels and canonical geometry

The earlier boot-only browser result above was insufficient: its full-resolution screenshots were
uniform `#05070f` even though the DOM reported one canvas and `renderedCells=22`. A permanent PNG
decoder and compositor-pixel gate was added only to `scripts/stacked-browser-audit.mjs` (never
`npm test` or `vercel:build`). The exact RED command was:

`node scripts/stacked-browser-audit.mjs --output-dir=.tmp/S12-geometry-fix/red-browser`

It completed desktop then mobile and failed on the exact symptom. Both decoded screenshots had one
distinct colour bucket and `0` colourful, `0` bright and `0` cyan pixels. The cause was the stopped
Pixi ticker combined with no explicit application render after presentation/resizing; counters were
updated in the scene graph while the WebGL compositor buffer remained cleared. The ticker remains
stopped and `preserveDrawingBuffer` remains false. `present()` now draws on demand, and every later
renderer resize redraws the last presented scene.

Canonical geometry is passed from the allowed main-entry seam into the projection-only renderer.
`board-view.mjs` contains no duplicate piece table and still does not import `stacked-sim.mjs`.
Active pieces, collision-derived ghosts, hold and queue previews all consume the imported S-02
`PIECE_CELLS` / `cellsFor` authority; ghost descent consumes the same S-02 `collides`. The real
`createStackedRuntime(...).snapshot()` shape (no pre-shaped `cells` or `ghost`) is exercised directly.
All seven kinds across all four rotations are checked for active, ghost, hold and queue footprints,
identity and colour, while locked ids are pinned to `1..7 = I,J,L,O,S,T,Z`, `8 = garbage`, `0 = empty`.
The render-only fixture remains static and does not construct or step a simulation.

Geometry RED: `node --test tests/stacked-render-tree.test.mjs` passed 4 and failed 3 before the fix.
Final targeted GREEN: the six-file STACKED packet completed **63 passed / 0 failed / 0 skipped**.
`npm run check` passed **418 JavaScript modules + 56 Python scripts**.

Final browser command:

`node scripts/stacked-browser-audit.mjs --output-dir=.tmp/S12-geometry-fix/certified-green`

Both strict-CSP profiles returned HTTP 200 with one full-viewport canvas, `assetsReady=true`,
`fixture=render-only`, no overflow, `preserveDrawingBuffer=false`, and zero console, page, HTTP or
request errors. Exact decoded compositor metrics:

| Profile | Distinct 4-bit RGB buckets | Colourful board-region pixels | Bright title/HUD pixels | Cyan well/grid pixels |
| --- | ---: | ---: | ---: | ---: |
| desktop 1440x900 | 226 | 19,592 | 1,778 | 5,734 |
| mobile 390x844 | 232 | 15,722 | 1,504 | 3,015 |

The full-resolution screenshots were inspected. Both visibly contain the STACKED render-only title,
20-row grid, locked cells including grey garbage, rotated active T, collision-derived ghost, score /
level / lines HUD, hold and queue. The mobile board switches to the tall authored frame; its title,
HUD and previews are contained and no longer overlap. The shell now uses the existing portal favicon,
closing the prior development-preview 404.

## Final measured STACKED-only budgets

`npm run build:meta` followed by the repository's transitive static-import walker measured the exact
final graph. Both static chunks are counted, not only the direct one:

| Artifact / graph member | Raw bytes |
| --- | ---: |
| `dist/stacked/game.js` | 14,322 |
| `dist/chunks/chunk-2WGYLO4P.js` | 655 |
| `dist/chunks/chunk-7MD6BTQT.js` | 1,346 |
| both static chunks | 2,001 |
| `dist/stacked/stacked-pixi-v1.js` | 496,615 |
| complete initial graph | 512,938 |

Programmatic caps use the documented 8% margin rounded upward to 4,096-byte units:

- entry: `ceil(14,322 × 1.08 / 4,096) × 4,096 = 16,384`
- initial graph: `ceil(512,938 × 1.08 / 4,096) × 4,096 = 557,056`

`docs/stacked/contracts.json` was regenerated. The HMH cap remains `1,050,000`; its final emitted
entry + vendor was `927,616`, and its full static initial graph was `994,069` including 66,453 bytes
across both shared chunks. That comparison is against the imported main S-02 dependency baseline,
which legitimately includes the additive seeded-RNG source, not the older S-01 source tree.

The exact imported dependency snapshots from `2300428b` remain read-only and are not Renderer-owned:
`apps/portal/src/stacked-sim.mjs` and `apps/portal/src/seeded-rng.mjs`. Exclude both from every Renderer
patch/export; canonical main wins during integration.

## Honest remaining boundary

S-12's renderer/compositor and geometry blockers are closed, but the fixture is still deliberately
`render-only`. No input, gameplay interaction, bridge, replay verification, Ranked write, profile
write, settlement, physical-device test or playtest ran, so this evidence makes no playable or AAA
claim. Future core integration must supply canonical snapshots through the same geometry seam.
