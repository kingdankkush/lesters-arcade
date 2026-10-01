# HMH bundle diet (2.0)

Lane: `claude/200-bundle-diet`, based on integration `8cc3c9e3f`.
Goal: free initial-path bytes in the Hard Money Heroes child so the ten-area
preview gameplay features (cover/traversal wiring, district boss stepping,
the six new enemies) can be wired into `apps/hmh-reboot/src/main.mjs`,
with zero behaviour change on the legacy Ranked path and zero simulation
change.

## Bytes

`node build.mjs` line `HMH initial JS + shared` (entry + vendor + every
chunk `game.js` imports statically; cap `1,048,576` B):

| Step | Initial JS + shared | Headroom | Delta |
| --- | ---: | ---: | ---: |
| Base `8cc3c9e3f` | 1,047,913 B | 663 B | |
| Step 1 `7ce1aabca` | 993,366 B | 55,210 B | -54,547 B |

Entry `game.js` and the Pixi vendor are unchanged by the diet; the whole
saving comes out of the hoisted static chunks.

## Modules made lazy (step 1)

Both join the existing S0.2 `loadLazyRuntimeModules()` `Promise.all` in
`main.mjs` and are destructured into module-level `let` bindings with the
same names every call site already used.

| Module | Bytes left the initial path | Why it is safe |
| --- | ---: | --- |
| `world-production-art.mjs` (+ `world-design-water.mjs`, `road-presentation.mjs`) | 35,731 B chunk | Projection only. First reference is `createWorldProductionLayers(...)` at world construction, after `await lazyRuntimeModules`; `renderWorldProductionArt` is only passed into the static bake / render pass later. Stays its own cacheable entry `hmh-reboot/world-art.js`; the dynamic import resolves to that output. |
| `authored-prop-layout.mjs` | 20,516 B | Placement tables and builders for the legacy map dressing (world props, district landmarks, camps, enclosures, towns, points of interest, prop atlas index/URLs). Every reference is after the await: dressing in boot, and `authoredPropItemUrl` inside the pause-menu `propIconUrl` resolver. Its own imports (`level-one-world`, `world-design-encounters`, `value-guards`, `deterministic-hash`) stay static. |

Nothing in `simulation.mjs`, `enemy-simulation.mjs`,
`combat-lifecycle.mjs`, `run-summary-v7.mjs`, `collision.mjs`,
`movement.mjs`, the SDK, server files or the Pixi vendor trim changed.
`level-one-world.mjs`, `weapon-system.mjs`, `run-progression.mjs` and
`simulation.mjs` remain static, as `tests/hmh-reboot-bundle-offsets.test.mjs`
pins.

## Load order guarantees

Unchanged from S0.2, now covering the two new modules:

1. `boot()` calls `loadLazyRuntimeModules()` before `await app.init(...)`,
   so the chunks download while the renderer initialises.
2. `await lazyRuntimeModules` happens right after `app.init()` and before
   the world container, world production layers, dressing, bridge
   activation or the standalone session exist. A download failure still
   releases the renderer and early bridge and rethrows, as before.
3. The startup art gate (`startupGate.check`) still waits for the same
   statuses (production hero, terrain tiles, enemy roster, world states);
   the gate is created and checked only after the await, so no tick order
   or readiness condition moved.
4. No lazily bound name is called at module scope (the offsets test walks
   the AST for this).

## Pins changed

- `tests/hmh-reboot-bundle-offsets.test.mjs`: `LAZY_RUNTIME_MODULES` gains
  `'world-production-art.mjs'` and `'authored-prop-layout.mjs'`
  (additive). The loader, await-before-use and module-scope assertions
  apply to them unchanged.

## Verification run (step 1)

- `node scripts/syntax-check.mjs`: passed (1380 JS modules + 167 Python
  scripts).
- `node --test tests/hmh-reboot-*.test.mjs tests/hmh-world-*.test.mjs
  tests/hmh-actor-*.test.mjs`: 1954 tests, 1953 pass, 1 fail.
  The failure, `tests/hmh-world-v2-verifier-freeze.test.mjs` "the portal
  never forwards a world parameter to the embedded child", asserts on
  `apps/portal/src/hmh-reboot-host.mjs` and fails identically on the
  untouched base `8cc3c9e3f` (verified with the lane's edits stashed).
  It is not caused by this lane.

## What root must verify in the browser

No browser smokes ran in this lane. Before promotion:

1. Legacy world boot to "Standalone session ready" (and a bridged portal
   session) with the production world art visible and the authored
   dressing (town, camps, enclosures, landmarks, props) placed as before.
2. Ten-area boot (`?mode=free&world=ten-area`), which never reads the
   authored placement builders but still awaits the chunk.
3. Pause menu, including prop icons (`propIconUrl` -> `authoredPropItemUrl`).
4. Upgrade panel and weapon wheel (unchanged lazy pieces, regression only).
5. `npm run visual:reboot` metrics for the legacy world: the render path
   is byte-identical in behaviour but now resident one chunk later.

## Ceiling and next candidates (not done)

The reference map built for this lane (every `main.mjs` import vs. first
use relative to `await lazyRuntimeModules`) shows further projection-only
modules that are first referenced after the await and have no other
static importer: `enemy-production-art.mjs` (10,283 B),
`enemy-roster-atlas.mjs` (7,008 B), `hud.mjs` (8,505 B),
`tripo-prop-appearance.mjs` (5,090 B), `prototype-actor-art.mjs`
(3,007 B), `contact-shadows.mjs` (2,280 B), `world-decals.mjs` (1,802 B).
`weapon-vfx.mjs` / `world-atmosphere.mjs` / `terrain-tile-atlas.mjs` are
entangled (`WEAPON_VFX_COLORS` is read at module scope; `weapon-vfx`
imports `terrain-tile-atlas`). Those were left for a later slice under
the release cut-off; roughly 35-40 KB more is available on the same
pattern without touching simulation modules.
