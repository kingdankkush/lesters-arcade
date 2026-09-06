# STACKED — Visuals: render architecture, audio reactivity, particles, zones

> Precedence: `../STACKED-CONTRACTS.md` overrides this specification wherever they disagree.

**Scope.** This document owns the PixiJS render architecture for the STACKED cabinet (layer tree, board view, frame loop, bloom, backdrop), the live audio-analysis pipeline that drives it, the particle system and its emitter presets, the six visual zones and their data model, the three quality tiers and the frame-budget guard, the projection-only firewall that keeps all of the above out of the simulation, and the photosensitivity / reduced-motion accessibility floor. It does not own the simulation, the input model, the bridge lifecycle, the portal integration, the plausibility gate, the mobile cell-size solver, or CI gate registration; where those appear it is as a cross-reference to `mechanics.md`, `mobile.md`, `integrity.md`, `portal.md`, `versus.md` or `gates.md`. `docs/stacked/STACKED-CONTRACTS.md` is authoritative; every name, id and constant below is reconciled against it.

**Contents.** §0 projection rule and contract deltas · §1 render architecture · §2 audio pipeline · §3 zones · §4 particle system · §5 quality tiers, bloom, frame-budget guard · §6 projection firewall · §7 accessibility · §8 visual regression · §9 files.

---

## 0. The one rule, and the deltas

**Everything here is PROJECTION-ONLY.** Audio analysis, particles, shaders, bloom, zones, shake, quality tier and the frame-budget guard may never change collision, RNG, spawning, gravity, lock delay, scoring, evidence, or results (`AGENTS.md:99`). §6 specifies the structural firewall and the tests that pin it; read it before writing renderer code.

### 0.1 Contract deltas applied to this document

| Was (draft) | Now (contract) |
| --- | --- |
| `apps/stacked/src/sim/**` as the sim home | `apps/portal/src/stacked-sim.mjs` — one parent-side, DOM-free module (§2.10) |
| `layoutBoards()` in `apps/stacked/src/render/board-layout.mjs` | `layoutMatch()` in `apps/portal/src/stacked-layout.mjs` (§2.8) |
| `createBoardView()` | `createStackedBoardView()`, seven named sub-layers (§2.8) |
| board authored at 1 cell = 1.0 unit | `CELL_PX = 32`; frames `'wide'` 512×640, `'tall'` 320×800 (§2.8) |
| `resultHash` = own FNV-1a 64-hex copy | `sha256Hex(canonicalSessionJson(tuple))`, 66 chars, `session-integrity.mjs:43` (§4.3) |
| event `seq` | `sequence` (the field name `game:run-event` already validates) |
| `MAX_CATCH_UP_STEPS` | `STACKED_MAX_CATCH_UP_STEPS = 4` (§2.1) |
| CSP `'unsafe-eval'` asserted mandatory | owner gate **G-6**: author strict, add only on a recorded violation (§3) |
| shell stylesheet `styles.css` | `apps/portal/stacked/game.css` (§3) |
| "rename the `quadClear` preset once the display name lands" | **Void.** `HALVING` (display) is decoupled from `quad` (ids); `quadClear` is permanent (§1.1) |
| tier / zone / bundle caps declared in their own modules | declared in `apps/portal/src/stacked-contracts.mjs`, imported (§2) |

Terminology (contract §1.2): **HALVING** display / `quad` ids for the four-line clear; **REORG** / the rising ledger for garbage; **MEMPOOL** combo; **CHAIN** back-to-back; **GENESIS** perfect clear; **FORK** / **MINI FORK** spin clears; **EPOCH** zone milestone. Simulation time is **ticks**, never frames; where this document says "frame" it means a presented render frame or an analyser sample, and says which.

---

## 1. Pixi render architecture

### 1.1 Vendor chunk and the build

Pixi is pinned at exactly `8.19.0` (`package.json:167`, no caret), bundled by esbuild, never CDN-loaded.

`createHmhPixiPlugin({ externalizeRuntimeImports })` (`build.mjs:70`) externalises `pixi.js` to `'../chunks/hmh-pixi.js'` only when `importer.includes('/apps/hmh-reboot/src/')` (`build.mjs:76`). STACKED source would not match and would inline the whole 575,891-byte engine.

1. Widen the importer test:
   ```js
   const SHARED_PIXI_IMPORTERS = /\/apps\/(hmh-reboot|stacked)\/src\//;
   if (externalizeRuntimeImports && SHARED_PIXI_IMPORTERS.test(importer)) {
     return { path: '../chunks/hmh-pixi.js', external: true };
   }
   ```
   `dist/stacked/game.js` sits at the same depth as `dist/hmh-reboot/game.js`, so the relative external resolves unchanged.
2. **Keep the chunk filename `hmh-pixi.js`** — it is referenced by `apps/portal/sw.js` `PRECACHE_URLS`, the `modulepreload` at `apps/portal/hmh-reboot/index.html:10`, the `/dist/chunks/(.*)` immutable cache header in `vercel.json`, and `scripts/hmh-reboot-bundle-budget.mjs`. Comment `apps/hmh-reboot/src/pixi-vendor.mjs` to record shared arcade ownership.
3. Add `<link rel="modulepreload" href="../dist/chunks/hmh-pixi.js">` to `apps/portal/stacked/index.html`.

### 1.2 Pixi symbols STACKED needs — the G-5 proposal, not an instruction

> **Blocked on owner gate G-5. Do not edit `apps/hmh-reboot/src/pixi-vendor.mjs`.** Contract §2.7 rules
> that the shared chunk stays at nine exports until the owner rules, and `gates.md` §6.2 carries the
> same sentence. What follows is the priced option (a) — grow the shared chunk — held here so the gate
> can be answered from real numbers. Options (b) *rename to `arcade-pixi-v1.js` carrying all sixteen*
> and (c) *give STACKED its own vendor entry* consume the same symbol list and the same measurement.
> S-11 ships the `build.mjs` externaliser widening (which is free and unrelated) and nothing else here.

`apps/hmh-reboot/src/pixi-vendor.mjs` re-exports exactly nine symbols today: `Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite`. Seven more are needed, all confirmed real exports of the installed `pixi.js@8.19.0`. `BLEND_MODES` is **not** exported in Pixi 8 — blend modes are plain strings on `blendMode`, which is what §4.3's presets use.

| Symbol | Used for |
| --- | --- |
| `ParticleContainer` | GPU-batched particle layers |
| `Particle` | per-particle view object inside a `ParticleContainer` |
| `Filter` | threshold + separable-blur bloom passes, board glow |
| `GlProgram` | shader sources for those filters and the backdrop mesh |
| `RenderTexture` | quarter-res bloom ping-pong targets |
| `Mesh` + `Geometry` | full-viewport backdrop quad driven by a custom fragment shader |

9 + 7 = **16 exports**. `Matrix` is deliberately excluded: §5.1's passes are handed the container's live `worldTransform`, which is already a `Matrix`, so nothing constructs one (add it later at +5 bytes rather than reaching for `new Matrix()`). `TextureSource` is not exported and not needed — cells are `new Texture({ source: atlas.source, frame: new Rectangle(...) })`.

**These are measurements, not commitments** — the one place in this document set where that is true, and `STACKED-MASTER-PLAN.md`'s STATUS block carves them out explicitly. Provenance: the four `dist/` figures are `stat()` of `apps/portal/dist/` as committed at `ff2934db`; the expanded figure is an **actual esbuild run on 2026-09-04** of a 16-export `pixi-vendor.mjs` entry against `pixi.js@8.19.0` under `build.mjs`'s own vendor settings — `bundle, minify, treeShaking, splitting:false, format esm, target es2020`. Re-run it the same way to reproduce.

| Artifact | Bytes |
| --- | --- |
| `dist/chunks/hmh-pixi.js` today (9 exports) | 575,891 |
| same entry with the 7 added exports | **597,360** (+21,469, +3.73%) |
| (reference: same entry plus `Matrix`) | 597,365 |
| `dist/hmh-reboot/game.js` today | 398,971 |
| `dist/chunks/chunk-22O5W2QY.js` (statically imported by the HMH entry) | 63,871 |
| `dist/chunks/chunk-2WGYLO4P.js` (same) | 655 |

`build.mjs` asserts `assertHmhInitialJsBudget({ entryBytes, vendorBytes, cap })` with `DEFAULT_HMH_INITIAL_JS_CAP = 1_050_000` (`scripts/hmh-reboot-bundle-budget.mjs:1`). It sees only entry + vendor: 974,862 today (75,138 apparently spare), 996,331 after the seven exports (53,669 apparently spare), so **the build does not break either way**.

**That number is not the truth, and this is why G-5 is a gate.** The two shared chunks above are part of HMH's initial JS and the budget never sees them. Real HMH initial JS is `398,971 + 575,891 + 63,871 + 655 =` **1,039,388 bytes — 10,612 under the cap.** Adding the seven exports makes it **1,060,857 — 10,857 over.** `gates.md` §6.2's stop rule applies verbatim: *if HMH's true initial JS crosses 1,050,000 that is a stop, not a cap bump.* So option (a) needs the owner to accept the crossing **and** a cache-busting plan, because `/dist/chunks/(.*)` is served `immutable` for a year and `hmh-pixi.js` carries no content hash. Whichever option the owner picks, this section and `gates.md` §6.2 move to the same sentence in the same commit.

Per-artifact caps, meaningful under options (a) and (b) (measured × 1.08, rounded up to the nearest 1,000):

```js
export const ARCADE_PIXI_VENDOR_CAP = 646_000;   // dist/chunks/hmh-pixi.js alone (597,360 × 1.08 = 645,149)
export const HMH_ENTRY_JS_CAP       = 431_000;   // dist/hmh-reboot/game.js alone (398,971 × 1.08 = 430,889)
```

`STACKED_ENTRY_JS_CAP` and `STACKED_INITIAL_JS_CAP` are `null` per contract §2.7 and hard-fail readably until S-11's first clean build. **`HMH_INITIAL_JS_CAP` stays `1_050_000`** and must not be retargeted at the sum of the split caps (1,077,000 — 27,000 bytes *looser*). `scripts/hmh-reboot-performance-browser-smoke.mjs:8` declares its own `BUNDLE_MAX_BYTES = 1_050_000` asserted against `dist/hmh-reboot/game.js` **alone** — point it at `HMH_ENTRY_JS_CAP`. Enforcement and CI registration belong to `gates.md`.

### 1.3 Application init

Mirror `apps/hmh-reboot/src/main.mjs:387-395` exactly except background and label; those options are already proven against this Pixi version and this CSP.

```js
const app = new Application();
await app.init({
  resizeTo: stageElement,          // #stackedStage
  background: '#05070f',           // zone 0 base; the backdrop mesh covers it anyway
  antialias: tier.antialias,
  autoDensity: true,
  resolution: tier.resolution,     // §5: min(resolutionCap, dpr), then the maxPixelArea clamp
  preference: 'webgl',
  powerPreference: 'high-performance',
});
app.ticker.stop();                 // the loop is driven manually, exactly as HMH does
app.canvas.tabIndex = 0;
app.canvas.setAttribute('aria-label', 'STACKED gameplay canvas');
stageElement.replaceChildren(app.canvas);
```

`preference: 'webgl'` is a decision: every shader is a `GlProgram` with GLSL only, no WGSL variant to maintain.

**CSP.** The `/stacked/(.*)` bucket, the catch-all lookahead widening and the Cache-Control extension are contract §3, owned by `portal.md`. Three facts this document supplies:

- `media-src 'self' blob:` is already in every bucket, which is what a same-origin `<audio>` needs, and **no CSP directive governs Web Audio graph construction**. The analyser needs no CSP change.
- `'unsafe-eval'` is owner gate **G-6** — author strict, run the smoke, add only on a recorded violation with the Pixi call site quoted in the ledger. Expect it to be needed: `docs/hmh-reboot/RELEASE-CERTIFICATION-REBOOT-19.md` and `docs/hmh-reboot/RED-EVIDENCE-REBOOT-19.md` record the first custom-domain cutover failing closed with *"Renderer initialization failed"* and Pixi reporting the environment disallowed `unsafe-eval`. Pixi's `unsafe-eval`-free adapter was rejected because this repo aliases Pixi to its prebundled single-file distribution. Chikun's bucket can say `script-src 'self'` only because `apps/portal/src/chikun-cabinet.mjs` has no Pixi import. `preference: 'webgl'` does not help — the blocker is runtime program generation, not GLSL compilation.
- `tests/hmh-reboot-shell.test.mjs:194` picks "the parent policy" as the **first** header rule whose CSP contains `frame-ancestors 'none'` and asserts it lacks `'unsafe-eval'`. A `/stacked/(.*)` bucket carrying both, placed before the catch-all, would be selected and fail with a misleading message. The contract's bucket uses `frame-ancestors 'self'` and cannot be selected — do not change that clause without reading line 194.

### 1.4 Layer / container hierarchy

Six root layers, fixed order, built once by `createLayerStack()` in `apps/stacked/src/render/layers.mjs` (contract §2.8):

```
app.stage
└─ stackedRoot                      Container   (global shake applies HERE)
   ├─ layerBackdrop      z=0        Container   zone shader Mesh + parallax TilingSprites
   ├─ layerParticleFar   z=10       ParticleContainer   ambient zone motes, behind the wells
   ├─ boardRoot          z=20       Container
   │    ├─ boardSlot[0]             Container   <- BoardView 0 (per-board shake applies HERE)
   │    └─ boardSlot[1]             Container   <- created, empty, visible = false in Phase 1
   ├─ layerParticleNear  z=30       ParticleContainer   lock/clear/combo bursts, in front of the wells
   ├─ layerPost          z=40       Container   bloom composite Sprite (blendMode 'add')
   └─ layerHud           z=50       Container   score, next, hold, EPOCH card, warnings
```

**`stackedRoot` is a fixed-height logical space, not the viewport.**

```js
// apps/stacked/src/render/root-fit.mjs — pure, node-testable, no Pixi import.
export const ROOT_LOGICAL_HEIGHT = 1000;              // logical units (lu)
export function fitRootToViewport({ widthPx, heightPx }) {
  const scale = heightPx / ROOT_LOGICAL_HEIGHT;       // uniform
  return Object.freeze({
    scale,
    logicalHeight: ROOT_LOGICAL_HEIGHT,
    logicalWidth: ROOT_LOGICAL_HEIGHT * (widthPx / heightPx),  // 1778 lu at 16:9, 462 lu at 390×844
    originPx: Object.freeze({ x: widthPx / 2, y: heightPx / 2 }),   // root origin is the viewport CENTRE
  });
}
```

Height is always 1000 lu, **width follows the aspect ratio**, origin at the viewport centre. A fixed 1000×1000 square would letterbox — `layerBackdrop` holds a full-bleed shader quad, and a square leaves 560 px unpainted at 1280×720. Fixed-height rather than pixel-space because live particle state is stored in root lu (§1.5 rule 3): in pixel space a mid-run resize strands every in-flight particle at a stale offset; here a resize changes only `stackedRoot.scale` and moves particles, board and backdrop together. (Same correction Cycle 072 made for the HMH encounter director view.)

**Units**, four, each named at its point of use:

- **lu** — logical units in `stackedRoot`. 1 lu = `fit.scale` CSS px. Root positions, board-slot positions, backdrop parallax, board shake and *live particle state*.
- **au** — authored board units inside a `boardSlot`. `CELL_PX = 32` au per cell; frames `'wide'` 512×640, `'tall'` 320×800 (contract §2.8).
- **cu** — cell units, the emitter-preset authoring unit. 1 cu = one cell = `CELL_PX` au.
- CSS px, only where a browser API demands them.

`cellLu = CELL_PX × slot.scale`. Phase 1 solo resolves `slot.scale = 1`, so `cellLu = 32 lu` and the on-screen cell is `32 × fit.scale` CSS px — 23 px at 1280×720, 27 px at 390×844, both inside `mobile.md`'s 14–44 CSS px band. Where the solved on-screen cell needs a non-integer factor the adjustment lands on `fit.scale`, never on `slot.scale`, which the contract requires to be an integer.

Rules:

- **`layerHud` is never bloomed, never shaken, never tinted by audio.** Text legibility is a competitive-integrity concern. §5.1's bloom source render is `boardRoot` and `layerParticleNear` only.
- **`layerParticleFar` and `layerParticleNear` are the only two `ParticleContainer`s** — two containers, one shared atlas, two draw calls for the whole particle system regardless of count.
- Each `boardSlot[i]` owns its sub-tree and its own shake offset, so in two-player one board can shake on a lock while the other does not.
- **`boardRoot` keeps an identity local transform forever.** Position, scale and shake live on `boardSlot[i]`. §5.1 renders `boardRoot` at its own `worldTransform`, correct only if the layer node contributes nothing that transform would double-count; an offset here is the easiest way to make the bloom slide off the board.
- `app.stage.sortableChildren` is **not** used. Child order is set once at construction; the z values above document that order, they are not runtime `zIndex` writes.
- `app.stage.addChild` is called **exactly once**, with `stackedRoot` as its only argument, and no module below `boardSlot[n]` may read `app.screen`, `window.innerWidth` or `devicePixelRatio` (contract §2.8 rules 1–2; `tests/stacked-render-tree.test.mjs` asserts both against stub constructors under `node --test`).

### 1.5 BoardView: the two-board-ready unit

`apps/stacked/src/render/board-view.mjs` exports `createStackedBoardView({ index, cells, rows, frame, atlas, rng })` → frozen `{ root, layers, setModel, setZone, applyShake, resize, destroy }`. Everything hangs off `root`; **no module-level singletons, no module-level Pixi objects, no `boardIndex === 0` special cases anywhere in the render tree.** Seven contract-named sub-layers:

```
boardSlot[i] (root)
 ├─ wellFrame          well border, grid lines, and the opaque zone.palette.deep plate (§7.3)
 ├─ stackLayer         locked minos (one Sprite per occupied cell, pooled)
 ├─ garbageWarnLayer   REORG rise warning bar, danger vignette, top-out strobe
 ├─ ghostLayer         ghost piece, alpha-only
 ├─ activeLayer        active piece
 ├─ effectLayer        line-clear row bands, rip wipes
 └─ hudLayer           per-board readouts
```

1. **Board-local coordinates.** All geometry inside `boardSlot[i]` is authored in au at `CELL_PX = 32`. `boardSlot[i].scale` and `.position` come from the layout function and are the only place lu appear inside the board sub-tree. The frame choice is presentation-only and decided by `layoutMatch()`, never by the view.
2. **`layoutMatch()` in `apps/portal/src/stacked-layout.mjs`** is the single layout authority (contract §2.8) — pure, parent-side, no Pixi, node-testable:
   ```js
   export function layoutMatch({ viewportWidth, viewportHeight, boardCount, opponentMini })
     -> Object.freeze([{ slot, frame, x, y, scale, visible }, ...])
   ```
   `x`/`y` position the slot container's origin and **that origin is the TOP-LEFT of the authored box**, not its centre. `scale` is uniform. All four are integers. The array is in ascending `slot` order and always has `boardCount` entries, hidden ones included. STACKED passes the **root logical rect** (`viewportWidth = fit.logicalWidth`, `viewportHeight = ROOT_LOGICAL_HEIGHT`), so the returned integers are root logical units. `mobile.md`'s cell-size solver resolves the on-screen CSS cell and feeds `scale`; it is not a competing layout function. This is the single function that changes for two-player — write and test it now (`tests/stacked-layout.test.mjs`).
3. **Particles are converted to root space once, at emit.** `emit(presetId, ctx)` takes `ctx.boardIndex`, `ctx.toRoot` (a 6-float affine from board-local au to root lu, snapshotted at emit) and `ctx.cellLu`. Position goes through the full affine; **velocity, acceleration and size are multiplied by `ctx.cellLu`**, because presets author them in cu and particles store them in lu. Miss the size conversion and every particle is 32× too small; miss the velocity conversion and every burst crawls. Particles then live in root lu and never re-read the board transform, so a board that moves mid-flight cannot drag its particles.
4. **Shake is per-slot.** `applyShake(dx, dy)` writes `root.position` = layout position + offset. Global shake (game over) writes `stackedRoot.position`. The two compose without either knowing about the other.
5. **HUD is per-board.** `layerHud` holds `hudSlot[i]` sub-containers plus one shared container for run-wide chrome.
6. Phase 1 creates `boardSlot[1]` empty and hidden, so the Phase 2 diff never touches root assembly (contract §2.8 rule 4).

### 1.6 The frame loop

The renderer never drives the simulation and the simulation never drives the renderer. One `requestAnimationFrame` callback:

```js
function frame(nowMs) {
  rafHandle = requestAnimationFrame(frame);
  const cpuStart = performance.now();

  // Compute BOTH deltas from previousFrameAt before overwriting it.
  const rawDeltaMs = previousFrameAt === null ? 0 : nowMs - previousFrameAt;
  const renderDtSeconds = Math.min(rawDeltaMs / 1000, 1 / 30);   // clamp only the render dt
  previousFrameAt = nowMs;

  // 1. SIM — fixed step, catch-up bounded. update() is the accumulator wrapper;
  //    it calls the one-argument runtime.step(inputMask) zero or more times.
  //    It gets the UNCLAMPED delta: the sim does its own clamping and its own
  //    catch-up ceiling. A render-clamped delta would silently change pacing.
  simulation.update(rawDeltaMs, inputMask);

  // 2. PROJECTION — everything below is projection-only.
  const snapshot = simulation.snapshot();          // frozen
  const events = drainEvents(snapshot);            // sequence-gated; see below
  audioReactive.advance(renderDtSeconds);          // interpolates the last portal:audio-frame
  zoneState.update(snapshot.tick);                 // pure function of tick
  flashLimiter.begin();
  renderer.present(snapshot, events, audioReactive.read(), zoneState.read(), renderDtSeconds);
  app.render();

  if (previousFrameWasReal) {
    frameBudget.sample({ frameMs: rawDeltaMs, cpuMs: performance.now() - cpuStart });
  }
  previousFrameWasReal = true;
}
```

- **Order of `previousFrameAt`.** Both deltas are read before the assignment. Assign first and `renderDtSeconds` is identically zero, every particle freezes, and the bug reads as a broken emitter rather than a broken clock.
- **Events are drained by sequence number, never re-read.** `snapshot.events[]` is the sim's event *ring*, not a per-frame delta: a rAF frame that advances the sim zero ticks — every other frame at 120 Hz, every frame while paused — sees the identical array, and a naive consumer re-emits one HALVING's 260 particles every frame until the next lock. Every event carries a strictly increasing integer `sequence`; the renderer keeps `lastConsumedSequence` and `drainEvents()` returns only `sequence > lastConsumedSequence` before advancing the watermark. The ring must hold at least `STACKED_MAX_CATCH_UP_STEPS` (4) ticks' worth of events so a catch-up burst cannot overwrite an event before the next frame reads it. This also removes all pause handling from the emission side.
- **Two time signals, deliberately.** `rawDeltaMs` (rAF-to-rAF) is the presented frame interval; `cpuMs` measures only this callback's CPU work. `app.render()` returns as soon as the WebGL commands are submitted, so `cpuMs` systematically under-reports GPU-bound cost. §5.2 uses both, neither as a raw threshold.
- **The frame after a gap is not a sample.** `previousFrameWasReal` gates the first frame of a session and the first after a visibility return or `reset()` out of the budget ring, so a backgrounded tab cannot hand the guard a 4,000 ms "frame".

Clamping `renderDtSeconds` at 1/30 s makes a 400 ms stall a hitch rather than a glitch: particles lag instead of teleporting.

**Visibility.** Hidden: cancel the rAF handle, set `previousFrameAt = null`, call `analyser.suspend()` parent-side. Visible: restart with `previousFrameAt = null` so the first frame contributes a zero delta, drop the audio watchdog straight to its idle state (§2.8) rather than ramping, and `frameBudget.reset()`.

**Pause.** `portal:pause` holds the sim at its current tick; the renderer keeps running at full rate — `renderDtSeconds` advances, particles settle and expire, the backdrop breathes, audio keeps driving colour — because a frozen image behind a pause overlay reads as a crash. What stops is emission (no new `sequence`); `zoneState` holds naturally. On resume, `previousFrameAt` resets as for a visibility return. Whether Ranked may pause is owner gate G-7 (`portal.md`).

**Resize mid-run.** `renderer.on('resize')` runs one ordered fix-up and nothing else:

1. recompute `fitRootToViewport()`, write `stackedRoot.scale`/`.position`, publish `dataset.rootScale`;
2. recompute `layoutMatch()`, write each `boardSlot[i].position` / `.scale` / `.visible`;
3. resize the backdrop mesh and parallax tiling sprites to the new logical width;
4. destroy and recreate the bloom render textures (§5.1) and **skip the bloom passes on this frame** rather than sampling a destroyed target;
5. `frameBudget.reset()` — a resize costs a frame or two and must not be charged to the device.

Live particles are untouched: already in root lu, and steps 1–2 move root and boards under them. The quality tier is **not** re-selected (§5).

---

## 2. The audio-reactive pipeline

### 2.1 Where the AnalyserNode lives

The arcade music player is one plain `<audio id="arcadeMusicAudio" preload="metadata">` in the **parent** document (`apps/portal/index.html:113`); the cabinet renders inside a same-origin sandboxed iframe. There is no `AnalyserNode`, `createAnalyser` or `createMediaElementSource` call anywhere in the repo today.

**Decision: the AnalyserNode lives in the PARENT. Band energies cross the bridge as data. The child never touches the parent's audio element.**

1. `createMediaElementSource()` may be called **once** per media element (a second call throws `InvalidStateError`) and permanently reroutes the element's output into the graph. Created inside the cabinet iframe's realm, it dies when the iframe is destroyed on exit (`apps/portal/main.js:4787` `destroyHmhRebootSession()` → `host.destroy()` → `mount.replaceChildren()` at `apps/portal/src/hmh-reboot-host.mjs:101`), and **the arcade music goes silent for the rest of the session**. Also why the source node is cached for the *page* lifetime: a track change calls `audio.load()`, which does not detach it.
2. The parent already owns an `AudioContext` (`ensureAudioContext()` at `apps/portal/main.js:1414`, cached on `combatAudio.audioContext`, resumed if suspended). Browsers cap concurrent AudioContexts and nodes from two contexts cannot be connected.
3. The child never reaches across the realm boundary; nothing in this repository does that today.

Bind the analyser lifecycle to the cabinet, not the page: create on STACKED session mount (`apps/portal/src/stacked-host.mjs`), `suspend()` on destroy. Each `getByteFrequencyData` call costs an FFT.

### 2.2 crossOrigin, and the silent-failure trap

Every playlist track is same-origin — `apps/portal/src/arcade-playlist-manifest.mjs` entries are `"./assets/audio/playlist/*.mp3"` and `loadArcadeMusicTrack()` (`apps/portal/main.js:1094`) assigns `audio.src = track.src` directly. Same-origin media is not CORS-tainted, so `createMediaElementSource` yields real samples.

**Do not set `crossOrigin`** — on a same-origin request it adds an `Origin` header and buys nothing, and `media-src 'self' blob:` blocks cross-origin audio in every bucket anyway. **Record the trap:** if a track is ever served cross-origin, that origin must send `Access-Control-Allow-Origin`, the element must have `crossOrigin="anonymous"` set **before** `src` is assigned, and `media-src` must be widened. Miss any of the three and `getByteFrequencyData` silently returns all zeros.

**Taint detector.** Count samples where the summed magnitude across all 1,024 bins is *exactly* 0, but only while `!audio.paused && !audio.muted` and `audio.currentTime` is advancing (a silent intro must not trip it). At 120 consecutive such samples (2 s at 60 Hz) log once and set `available: false`; the child then runs its no-music idle drift. **Re-armed on every track change.**

### 2.3 The graph, and not breaking the player

New module `apps/portal/src/arcade-audio-analyser.mjs`:

```js
export function createArcadeAudioAnalyser({ audioElement, audioContext }) → {
  available: boolean,
  setGain(value),      // 0..1, replaces the element-volume duck
  read(),              // { sub, bass, lowMid, mid, high, level, onset, beatPhase, bpm, available }
  suspend(), resume(), destroy(),
}
```

```
 MediaElementAudioSourceNode → musicGain ─┬─► analyserSmooth ─────────────► destination
   (created ONCE, module-scope cached)     └─► analyserRaw → silentGain(0) ─► destination
```

Analysers sit **after** `musicGain`: `AnalyserNode` is pass-through, and reading post-duck means the visuals track what the player hears (gameplay ducks music to 0.55 via `arcadeMusicContextGain()`, `apps/portal/main.js:1232`; a pre-gain tap would make the visuals scream while the mix is quiet). **`analyserRaw` must not dangle** — whether a node with no path to `destination` is still pulled is engine-dependent, so terminate it through a zero gain: guaranteed scheduled, one multiply per sample, nothing added to the mix.

Not breaking the parent player. `applyArcadeMusicVolume()` (`apps/portal/main.js:1244`) currently sets `audio.volume = arcadeMusicVolume(arcadeMusic.volume) * arcadeMusicContextGain(reason)`; whether `HTMLMediaElement.volume` still attenuates a signal routed through a source node is engine-dependent.

1. Add one branch: if the graph exists and reports `available`, compute the same product, call `analyser.setGain(product)`, set `audio.volume = 1`, and **return the product, not `audio.volume`** — the function ends `return audio.volume;` and callers read that return. Otherwise keep the existing line unchanged. **The graph is the single volume authority, or it does not exist at all — never a half-state.** `setGain(value)` writes `musicGain.gain.setTargetAtTime(value, ctx.currentTime, 0.015)`, not `gain.value = value`: a bare write is a step discontinuity that clicks audibly, and this function runs on every game-over, gameplay entry and volume-slider input.
2. `audio.muted` is left alone — muting zeroes what the source node receives in every engine, so mute correctly kills both audio and visuals. Do not add a second mute path.
3. Creation is wrapped in `try { … } catch { available = false; }` and **must not touch `audio.volume` before it succeeds**, so a blocked `AudioContext` leaves the existing volume path untouched.
4. `destroy()` disconnects `musicGain` and both analysers, reconnects the source directly to `destination`, restores `audio.volume` to the last computed product. The source node is *not* recreated.
5. `ensureArcadeMusicPlayer()` (`apps/portal/main.js:1251`) swallows the `play()` rejection and leaves `arcadeMusic.playing = false`, so never assume music is running: when `audio.paused || audio.ended`, `read()` returns the idle frame (all bands 0, `onset: false`, `available: true`). Create the graph lazily on the first successful `play()`, not at page load.

### 2.4 Analyser configuration and the fixed-rate sampler

| Setting | Value | Why |
| --- | --- | --- |
| `fftSize` | `2048` | 1024 bins; ~21.5 Hz at 44.1 kHz, ~23.4 Hz at 48 kHz. Separates a kick fundamental from a bass line; 4096 doubles cost for detail nobody sees. |
| `smoothingTimeConstant` | `0.72` (`analyserSmooth`) | Visually smooth without smearing kicks. |
| `smoothingTimeConstant` | `0.0` (`analyserRaw`) | Spectral flux needs the unsmoothed spectrum; two taps off one source is cheaper than un-smoothing one analyser. |
| `minDecibels` | `-85` | Below this is room noise in a mastered mp3. |
| `maxDecibels` | `-12` | Above this everything pins at 255 on a loud master. |
| Read method | `getByteFrequencyData(Uint8Array(1024))` | Already dB-mapped and clamped; no per-frame `log10`. |
| Read cadence | **exactly 60 Hz, fixed-interval accumulator driven by the parent's rAF** | Not "once per rAF". |

**The 60 Hz sampler rate is load-bearing.** Every time constant in §2.6–§2.8 is expressed in *analyser samples*: a 43-sample flux history, an 8-sample refractory, per-sample α, a per-sample `beatPhase` increment. Bound to rAF, a 120 Hz laptop halves every half-life and turns the 133 ms refractory into 67 ms, and a 144 Hz monitor makes "send every other sample" 72 msg/s — breaching the 60 msg/s ceiling §2.8 sets for itself.

```js
const SAMPLE_INTERVAL_MS = 1000 / 60;
function pump(nowMs) {                       // called from the parent's rAF
  rafHandle = requestAnimationFrame(pump);
  if (lastSampleAt === null) { lastSampleAt = nowMs; return; }
  if (nowMs - lastSampleAt < SAMPLE_INTERVAL_MS) return;   // 30/60 Hz displays: ~every frame
  lastSampleAt = nowMs;                      // NOT += interval: no catch-up FFTs
  sampleOnce();                              // one getByteFrequencyData pair, one band update
  if ((sampleCounter++ & 1) === 0) postAudioFrame();       // 30 Hz to the child
}
```

`lastSampleAt = nowMs` rather than `+= SAMPLE_INTERVAL_MS`: an `AnalyserNode` has no history to replay, so two back-to-back reads after a stall hand the filters the same spectrum twice. On a 30 Hz display the sampler runs at 30 Hz and every time constant doubles in wall-clock terms — acceptable, and far better than letting 144 Hz machines run four times fast. `sampleCounter` resets alongside `lastSampleAt` on suspend/resume so the 30 Hz send phase does not drift.

### 2.5 Bands and bin math

Pure math lives in `apps/portal/src/audio-band-analysis.mjs` — **no Web Audio import**; takes `(Uint8Array magnitudes, sampleRate, fftSize, state)` and returns the band vector, making the analysis layer node-testable against synthetic spectra.

```js
export const STACKED_BANDS = Object.freeze([
  { id: 'sub',    loHz: 20,   hiHz: 60   },
  { id: 'bass',   loHz: 60,   hiHz: 160  },
  { id: 'lowMid', loHz: 160,  hiHz: 500  },
  { id: 'mid',    loHz: 500,  hiHz: 2000 },
  { id: 'high',   loHz: 2000, hiHz: 8000 },
]);
```

Bin math, computed once per `sampleRate` change and cached:

```js
const binHz = sampleRate / fftSize;                    // 48000/2048 = 23.4375 Hz
const loBin = Math.max(1, Math.round(loHz / binHz));   // bin 0 is DC — always skip it
const hiBin = Math.min(fftSize / 2 - 1, Math.round(hiHz / binHz));
raw = mean(magnitudes[loBin..hiBin]) / 255;            // 0..1
```

At 48 kHz: sub bins 1–3, bass 3–7, lowMid 7–21, mid 21–85, high 85–341. Adjacent bands share their boundary bin — intentional and harmless, because each band is a *mean*, not a partition of energy. `sub` is three bins wide, which is physically correct at this resolution and is why it is the twitchiest band and gets the tightest clamps in §2.9. The `hiHz: 8000` ceiling is deliberate: mp3 encoders lowpass hard above ~16 kHz and the 8–16 kHz region is mostly encoder noise that would make the bloom flicker on silence. `level` = the same computation over bins `binOf(20)..binOf(8000)`.

### 2.6 Adaptive normalization

A raw band mean is useless across tracks — a loud modern master and a quiet chiptune differ by 20 dB. Each band keeps an asymmetric running floor and ceiling:

```js
// per band, per analyser sample (60 Hz)
floor += (raw < floor ? 0.0600 : 0.0035) * (raw - floor);   // drops fast, creeps up slow
ceil  += (raw > ceil  ? 0.2000 : 0.0018) * (raw - ceil);    // jumps fast, decays slow
const span = Math.max(ceil - floor, 0.06);                   // never divide by a tiny span
const norm = Math.min(1, Math.max(0, (raw - floor) / span));
```

Half-lives at 60 Hz. Exact discrete form `t½ = ln(0.5) / ln(1 − α)` samples ÷ 60; the shorthand `ln2/α` overstates the fast edges by 10%, so those rows use the exact form.

| Edge | α | Half-life |
| --- | --- | --- |
| ceiling decay (slow) | 0.0018 | 385 samples ≈ **6.41 s** (9.26 s to 1/e) |
| floor rise (slow) | 0.0035 | 198 samples ≈ **3.30 s** (4.76 s to 1/e) |
| ceiling attack (fast) | 0.20 | 3.11 samples ≈ **51.8 ms** |
| floor drop (fast) | 0.06 | 11.2 samples ≈ **187 ms** |

The `span` floor of 0.06 stops a near-silent passage amplifying noise into a light show.

Seed `floor = 0.05`, `ceil = 0.35` on creation, and **reset both on an actual track swap**. Precision matters: `loadArcadeMusicTrack()` (`apps/portal/main.js:1094`) is called on *every* `ensureArcadeMusicPlayer()`, `setArcadeMusicContext()`, `startArcadeMusicForGame()`, and from `renderArcadeMusicPlayer()` on a queued rAF after any player state change — but only reassigns `audio.src` inside `if (audio.dataset.trackId !== track.id)`. Hook the reset to that inner branch, or to a `loadedmetadata` / `emptied` listener, which is the same edge and needs no parent-side edit. Resetting on every call would re-seed the envelope several times a minute.

Silence gate: if broadband `raw < 0.02` for 30 consecutive samples, force every `norm` to decay toward 0 at 0.05/sample and set `onset = false`.

### 2.7 Onset detection — spectral flux with hysteresis

Runs on `analyserRaw`, over bins `binOf(40) .. binOf(4000)` — low enough for kicks, high enough for snares, excluding the DC bin and the hiss shelf.

```js
let flux = 0;
for (let b = loBin; b <= hiBin; b += 1) {
  const d = (mag[b] - prevMag[b]) / 255;
  if (d > 0) flux += d;                       // half-wave rectified: onsets, not offsets
}
flux /= (hiBin - loBin + 1);
history.push(flux);                            // ring buffer, 43 samples ≈ 716 ms
const thrHigh = mean(history) * 1.35 + 0.006;
const thrLow  = thrHigh * 0.75;

if (armed && flux > thrHigh && samplesSinceOnset >= 8) {
  onset = true; armed = false; samplesSinceOnset = 0;
} else {
  onset = false;
  if (flux < thrLow) armed = true;
}
```

The `armed` latch with re-arm below `thrLow` stops a sustained loud passage firing every sample. `samplesSinceOnset >= 8` is a 133 ms refractory (450 BPM ceiling; kick-and-snare at 180 BPM is 333 ms apart). The `+ 0.006` additive floor prevents onsets during near-silence where a tiny absolute rise beats a tiny mean.

Tempo, used only for anticipatory motion (a bar-length backdrop breathe), never for gameplay:

```
intervals:   ring of the last 24 inter-onset gaps in ms, filtered to [300, 1000] (60–200 BPM)
bpmEstimate: mode of those intervals bucketed at 10 ms, converted to BPM; 0 if < 8 samples
beatPhase:   free-running sawtooth 0..1 advanced by (bpm/60)/60 per sample;
             snapped to 0 on an onset only when |phase - round(phase)| < 0.25
```

The 0.25 snap window means a missed or spurious onset nudges phase rather than jerking it.

### 2.8 Transport: parent → child

Contract §4.1 enumerates **six** parent→child message types — `portal:init`, `portal:settings`, `portal:pause`, `portal:resume`, `portal:exit` and `portal:audio-frame`, the transport for owner decision D-5's live audio analysis, whose exact-key payload is frozen there. This section is where its rate, derivation and rationale live. The message is purely additive: identical five-key envelope, identical `STACKED_MAX_MESSAGE_BYTES = 64 * 1024` cap, registered in `apps/portal/src/stacked-bridge-protocol.mjs`'s exact-key validator alongside the other five, and it is the one parent→child type that is **droppable** — a missed frame is a visual stutter, never a state error. `gates.md` §4.5's bridge test asserts the six-message set.

**Rate: 30 Hz, not 60.** The parent samples at a fixed 60 Hz and sends every other sample; the child interpolates the 33 ms gap. Because the send derives from the fixed-interval sampler and not from rAF, the rate is 30 Hz on a 60 Hz panel and a 144 Hz panel alike. `createMessageRateLimiter({ windowMs: 1000, maxPerWindow: 60 })` (`apps/portal/src/arcade-sdk.mjs:235`) is a **parent-side gate on inbound child→parent messages** and cannot throttle this stream; 30 Hz is a self-imposed budget inside that same envelope, so no future mirroring or two-player relay can breach a limit that was never checked. **Treat 60 msg/s as the hard ceiling for this channel in either direction.**

Payload, all integers, **155 bytes** of JSON, **≈308 bytes on the wire** in the five-key envelope — 212× under the 65,536-byte cap. At 30 Hz the channel costs ≈9.2 KB/s.

```js
{ audio: {
    t: 0..1048575,          // parent sample counter mod 2^20, for ordering + gap detection
    sub: 0..1000, bass: 0..1000, lowMid: 0..1000, mid: 0..1000, high: 0..1000,
    level: 0..1000,
    onset: boolean,          // true if ANY onset fired in the two samples this message covers
    beatPhase: 0..1000,
    bpm: 0 | 600..2000,      // bpm × 10; 0 = no estimate
    available: boolean,
} }
```

Integers keep the exact-key validator trivial (`Number.isInteger` + range) and the JSON small; the child divides by 1000.

**Ordering and gaps.** Let `d = (payload.t - lastT + 2**20) % 2**20`:

- `d === 2` — expected step at 30 Hz against a 60 Hz counter. Shift `next → prev`, store, interpolate.
- `3 ≤ d ≤ 16` — short gap (up to ~267 ms of dropped messages). Same handling; `advance()`'s clamping absorbs it.
- `d === 0` or `d > 16` — duplicate, reorder, or resumed-after-suspend. **Snap**: `prev = next = payload`, so the visuals jump once instead of sweeping across an arbitrary interval; reset the watchdog.

Child side, `apps/stacked/src/render/audio-reactive.mjs`:

```js
createAudioReactiveState() → {
  ingest(payload),           // from the bridge handler; stores prev + next
  advance(dtSeconds),        // lerps prev→next over 33 ms; decays toward idle after 250 ms of silence
  read(),                    // frozen { sub, bass, lowMid, mid, high, level, onsetPulse, beatPhase, bpm, available }
}
```

`onsetPulse` is a decaying scalar, not a boolean: set to `1.0` on an onset, then decayed **on wall time, not on frames**:

```js
const ONSET_PULSE_TAU = 0.111;                       // seconds; 0.1 reached at ~256 ms
onsetPulse *= Math.exp(-dtSeconds / ONSET_PULSE_TAU);
```

A per-frame `× 0.86` would decay twice as fast at 120 Hz and half as fast at 30 fps. (`0.86` per frame at exactly 60 Hz is `τ = 0.111 s` and reaches 0.1 in 256 ms, not 150 ms; visuals tuned against the shorter figure read as clipped.) Renderers consume the pulse, never the raw flag, so a dropped message degrades amplitude rather than dropping an event.

**Watchdog:** with no `portal:audio-frame` for 500 ms, `advance()` ramps all bands to a synthetic idle sine (period 4.2 s, amplitude 0.18) so the visuals keep breathing.

**Firewall note:** the `portal:audio-frame` handler writes into `audioReactive` and nothing else. That object is constructed in the render module, never passed to `simulation.update()`, never serialized into evidence. §6 pins this with a test.

### 2.9 Mapping table

`applyAudioMappings(audio, zone, tier, settings)` in `audio-reactive.mjs` produces one frozen `visualParams` per frame. Every value is clamped; every value has a defined output with silent audio.

| Band / signal | Drives | Base (silent) | Full range | Response curve | Clamps & notes |
| --- | --- | --- | --- | --- | --- |
| `sub` (20–60) | Board micro-shake amplitude, **lu** | 0 | 0 → 2.6 lu | `pow(sub, 1.8)` | 2.6 lu is 0.081 of a 32 lu cell, ~1.9 CSS px at 720p. ×0 when `reduceMotion` **or** `screenShake === false`. Direction from a per-frame draw on the **VFX RNG** (§4.2), never the sim RNG. |
| `bass` (60–160) | Backdrop pulse `uPulse`, radial brightness lift from well centre | 0.10 | 0.10 → 0.55 | linear, then 1-pole smooth α=0.25 | Flash-limited before reaching the shader. |
| `bass` | Well-frame emissive alpha | 0.30 | 0.30 → 0.85 | linear | — |
| `lowMid` (160–500) | Palette shift `uPaletteMix`, blends zone accent toward zone secondary | 0.0 | 0.0 → 0.40 | linear, smooth α=0.06 (slow) | Deliberately slow — fast hue swings are the ugliest failure mode in this genre. |
| `mid` (500–2000) | Ambient emission rate on `layerParticleFar`, particles/sec | tier base × 0.35 | ×0.35 → ×1.6 | `pow(mid, 1.3)` | Multiplies preset rate; the governor (§4.5) still caps absolute count. |
| `mid` | Active-piece rim-light alpha | 0.25 | 0.25 → 0.70 | linear | Keeps the piece the brightest thing on the board at all times. |
| `high` (2000–8000) | Bloom intensity (`layerPost` sprite alpha) | `zone.bloom.base` | base → `min(base + 0.24, zone.bloom.ceiling, tier.bloomCap)` | `pow(high, zone.bloom.curve)`, smooth α=0.18 | The zone owns both endpoints; the tier owns a hard cap. Flash-limited. |
| `high` | Bloom threshold `uThreshold` | `zone.bloom.threshold` | `threshold → threshold − 0.12` (inverse) | linear | Louder highs = lower threshold = more of the frame blooms. |
| `high` | Particle sparkle texture selection weight | 0.15 | 0.15 → 0.60 | linear | Data-driven: shifts the preset's texture-weight vector. |
| `level` (broadband) | Backdrop parallax scroll speed multiplier | 0.6 | 0.6 → 1.35 | linear, smooth α=0.10 | ×0 when `reduceMotion`. Does **not** respond to `screenShake` — parallax is not shake. |
| `onsetPulse` | Backdrop `uBeatFlash` | 0 | 0 → 0.28 | pulse × `(1 - reduceFlash × 0.65)` | Flash-limited. The only signal that can produce a fast full-screen luminance change, so it is the limiter's primary customer. |
| `onsetPulse` | Zone-motes emission burst | 0 | 0 → 24 particles (`desktopHigh`) | pulse, gated to ≤ 4/s | Scaled by tier; 0 on `mobile` at `minimal`. |
| `beatPhase` | Backdrop domain-warp phase offset | free-running | ±0.5 cycle | — | Cosmetic; if `bpm === 0` the warp runs on `uTime`. |
| `bpm` | Zone ribbon drift period | 4.0 s | 60/bpm × 2 bars | — | Only when `bpm > 0`. |

Global gates applied after this table, in order: `stackedEffects` setting → quality tier caps → frame-budget guard level → flash limiter. The limiter is last and unconditional (§7.2).

**`bloomIntensity` is one scalar with one meaning across all three tiers and all three gates: the alpha of the additive post-layer.** `zone.bloom.ceiling`, `tier.bloomCap` and the limiter's absolute additive ceiling are all clamps on the *same* number in the same units, reconciled so the tightest is meaningful rather than unreachable. On `desktopLow` the same scalar drives sprite alphas instead of a render-texture composite; on `mobile` it is pinned at 0.

**Colour space.** Zone palettes are stored in **linear light** so transition lerps are gamma-correct, but Pixi 8 renders into a non-linear sRGB framebuffer and `Particle.tint` multiplies in that space. Encoding is assigned, not left to chance:

- The backdrop fragment shader mixes in linear light and encodes **once, on output**: `fragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0)`. The 2.2 approximation rather than the piecewise sRGB transfer, because the difference is invisible on a background and the piecewise form costs a branch per pixel.
- `resolvePreset()` (§4.3) is the single place a linear palette stop becomes a `0xRRGGBB` tint, applying the same encode before packing. Cached per `(presetId, zoneIndex, tier, guardLevel)`, so it costs a handful of `pow` calls per run, not per particle.
- `visualParams` alphas (`bloomIntensity`, `overlayAlpha`, rim alpha) are not colours and are never encoded.
- The flash limiter computes its luminance proxy on the **linear** values, before encoding, because WCAG's flash thresholds are defined on relative luminance.

---

## 3. Zones

Six zones (`STACKED_ZONE_COUNT = 6`); ids and names frozen in contract §2.9. A zone milestone is an **EPOCH** in player-facing copy.

| # | id | Name | Theme | Palette read |
| --- | --- | --- | --- | --- |
| 0 | `genesis-vault` | Genesis Vault | Cold poured-concrete vault, the first block sealed under sodium light. Slow dust in still air. | Steel blue on near-black, one amber accent |
| 1 | `mempool-drift` | Mempool Drift | Unconfirmed transactions drifting past as translucent glyph cards, some fading out unconfirmed. | Teal / cyan on deep navy |
| 2 | `hashrate-forge` | Hashrate Forge | An industrial furnace of miners; embers rise, heat shimmer distorts the backdrop. | Amber / orange on scorched brown |
| 3 | `scrypt-lattice` | Scrypt Lattice | A crystalline memory-hard lattice (scrypt is Litecoin's PoW). Sharp refractive shards, geometric. | Violet / magenta on indigo |
| 4 | `halving-eclipse` | Halving Eclipse | Emission halves; the world dims to near-monochrome and rings like struck metal. Restraint zone. | Silver / bone on deep indigo, almost no chroma |
| 5 | `mainnet-aurora` | Mainnet Aurora | Payoff. Full-spectrum aurora ribbons over the well, maximum bloom, the ledger finally settling. | Full spectrum, cyan→magenta→gold ribbon |

`halving-eclipse` at position 4 is a deliberate rest: 25 minutes of escalating brightness with no trough is exhausting and, for photosensitive players, dangerous. Only zone 0's palette is specified numerically; zones 1–5 ship labelled placeholder palettes under the same hard constraints, replaced in a later art cycle (owner gate **G-18**, contract §5.2).

### 3.1 Zone data schema

`apps/portal/src/stacked-zones.mjs` — pure data plus pure functions, no Pixi import, node-testable, importable by the parent for results-screen copy.

```js
export const STACKED_ZONES = Object.freeze([Object.freeze({
  id: 'genesis-vault',
  index: 0,
  name: 'Genesis Vault',
  entryTick: 0,

  // 5-stop palette, linear-light sRGB 0..1 triplets. Consumed by the shader
  // as uPalette[5] and by particle presets via token paths ('zone.accent').
  palette: Object.freeze({
    deep:      Object.freeze([0.012, 0.018, 0.035]),  // backdrop far, and the well plate (§7.3)
    mid:       Object.freeze([0.035, 0.055, 0.095]),  // backdrop near
    accent:    Object.freeze([0.42,  0.63,  0.90 ]),  // primary particle / glow
    secondary: Object.freeze([0.90,  0.66,  0.28 ]),  // palette-shift target
    ink:       Object.freeze([0.86,  0.90,  0.96 ]),  // sparks, rim light, text-adjacent
  }),

  background: Object.freeze({
    preset: 'vault-dust',        // fragment-shader branch id, compiled once, selected by uniform
    warpAmplitude: 0.045,        // domain-warp strength, 0..0.2
    warpSpeed: 0.06,             // cycles/sec
    parallaxLayers: 2,           // TilingSprite count above the shader
    parallaxSpeed: Object.freeze([6, 14]),   // lu/sec at 1× level (60–170 s to cross a 16:9 field)
    vignette: 0.35,
  }),

  particles: Object.freeze({
    ambientPresetId: 'ambient-dust',
    ambientRate: 14,             // particles/sec at desktopHigh, before band modulation
    overrides: Object.freeze({   // sparse per-preset; anything absent uses the preset default
      lineClear: Object.freeze({ texture: 'shard', tint: 'zone.accent', drag: 2.0 }),
      quadClear: Object.freeze({ texture: 'ring',  tint: 'zone.ink',    burstScale: 1.0 }),
    }),
  }),

  bloom: Object.freeze({
    base: 0.18,                  // layerPost sprite alpha with silent audio
    ceiling: 0.34,               // absolute cap for this zone; hard gate is 0.35 (§7.2)
    threshold: 0.66,             // uThreshold with silent audio
    curve: 1.5,                  // exponent on the `high` band
  }),

  transition: Object.freeze({
    style: 'sweep-up',           // 'sweep-up' | 'iris' | 'dissolve' | 'shatter' | 'fade-down'
    durationTicks: 150,          // TICKS — 2.5 s at 60 Hz (contract §2.9)
  }),

  // Photosensitivity guard, asserted by a unit test over this array (§7.2).
  // Every palette stop must satisfy the WCAG-shaped saturated-red ratio
  //   R / (R + G + B) < 0.70   in linear light
  // Amber and ember stops pass (0.90,0.66,0.28 -> 0.489); saturated reds
  // do not (1.0,0.0,0.0 -> 1.0). Do NOT use "R - max(G,B) < 0.20": that is a
  // different rule, it is not what WCAG measures, and it rejects the amber
  // stop three lines above as well as the whole `hashrate-forge` zone.
})]);

export function zoneIndexForTick(tick);                     // pure; returns 0..5; takes NOTHING else
export function zoneBlendForTick(tick, durationTicks);      // pure; { fromIndex, toIndex, t: 0..1 }
export function zoneCardStateForTick(tick, durationTicks);  // pure; { zoneIndex, phase: 'in'|'hold'|'out'|'off', alpha }
```

**Everything about a zone is a pure function of `tick` plus a caller-supplied duration.** `zoneIndexForTick` takes the tick and nothing else — no settings, no wall clock — so which zone a run is in is identical for every player and on every replay. `durationTicks` is a *parameter* rather than a module constant because §7.1's accessibility settings shorten the blend (`reduceMotion` → 24 ticks, `stackedEffects: 'minimal'` → 18 ticks); the caller resolves the setting and passes the number, keeping the settings dependency out of the pure module and the zone *index* settings-free.

`zoneCardStateForTick` makes the EPOCH card tick-driven, not timer-driven: fade in over 12 ticks starting at `entryTick + 0.70 × durationTicks`, hold 96 ticks (1,600 ms), fade out over 18 ticks — so on a 150-tick transition the card is on screen from tick +105 to +231, outliving the blend by ~1.35 s by design and reproducing identically in a visual-regression capture and a replay.

`zoneReached` is a projection readout in the run summary, bounded `1..STACKED_ZONE_COUNT` (contract §4.4) — **1-based in the summary while `zoneIndexForTick` is 0-based**; convert once, at the summary boundary. The zone never reaches the result tuple.

### 3.2 Milestones

Zone advance is keyed to **survival ticks**, not wall-clock seconds: catch-up saturation silently drops simulated time on a stuttering client, so a wall-clock schedule would put two players on different zones at the same run progress.

| Zone | `entryTick` | ≈ at 60 Hz |
| --- | --- | --- |
| 0 `genesis-vault` | 0 | 0:00 |
| 1 `mempool-drift` | 10,800 | 3:00 |
| 2 `hashrate-forge` | 25,200 | 7:00 |
| 3 `scrypt-lattice` | 43,200 | 12:00 |
| 4 `halving-eclipse` | 64,800 | 18:00 |
| 5 `mainnet-aurora` | 90,000 | 25:00 |

Against the owner's session-length bands, and — the column that actually matters — against `mechanics.md` §10's own predicted top-outs for each tier. A run "sees" zone *n* once it reaches `entryTick`.

| Band | Target duration | Zones seen across the band | §10 predicted top-out | **Zones actually reached** |
| --- | --- | --- | --- | --- |
| Beginner | 2–3 min | 1 (`genesis-vault` only; zone 1 enters at exactly 3:00) | 2.70 min | **1** |
| Intermediate | 4–6 min | 2 | 5.47 min | **2** |
| Expert | 6–12 min | 2 at the floor, 4 at the ceiling (12:00 *is* zone 3's entry tick) | 9.54 min | **3** |
| Elite | 12–30 min | 4 at the floor, all 6 at the ceiling | 20.07 min | **5** |
| God tier | 30–40 min | all 6 | 33.4 min | **6** |

The band column describes what the *bands* permit; the last column describes what the difficulty model *predicts*. They disagree in one load-bearing place: **under the model, zone 5 `mainnet-aurora` is reached only by god tier.** The elite prediction of 20.07 min is five minutes short of its 25:00 entry, so "all 6 at the ceiling" is a property of the band's 30-minute upper edge, not of a modelled elite run. `mainnet-aurora` is described as the payoff zone and, on these numbers, is god-tier-only content.

That is either a deliberate reward for the longest runs or an authored zone almost nobody sees. It is the non-blocking feel question attached to **G-18**, and the fix if it is unwanted is data, not code: pull `entryTick` down toward the elite prediction. The zone *count* is frozen at 6 (contract §2.1) because it feeds a run-summary bound; `entryTick` is not.

Past 90,000 ticks the zone stays `mainnet-aurora` and the shader adds a hue-rotation offset of `min((tick - 90000) / 108000, 1) * 0.35` turns: **+0.058 turns (21°) at 30 min, +0.175 turns (63°) at 40 min**. The 0.35 cap does not bind until tick 198,000 (55 min), well inside `STACKED_MAX_TICKS = 432_000`, so it exists only to stop a two-hour run wrapping the wheel.

**`zoneIndexForTick` is called by the renderer from `snapshot.tick`. The simulation never calls it and does not know zones exist.**

### 3.3 Transitions without interrupting play

A zone transition is **150 ticks (2,500 ms) of pure cross-fade. Gravity, lock delay, input, RNG and scoring are untouched. Nothing pauses, nothing modal appears over the well.** Three overlapping stages driven by `t = zoneBlendForTick(tick, durationTicks).t`:

| `t` | What happens |
| --- | --- |
| 0.00 – 0.40 | Outgoing backdrop desaturates via `uZoneMorph`. A `zoneTransition` particle sweep (style-dependent: `sweep-up` rises from the bottom of the well, `iris` contracts inward, `shatter` for `scrypt-lattice`) crosses the **backdrop and far-particle layers only** — never over the well interior, never over the HUD. |
| 0.20 – 0.80 | Palette lerps. Each of the 5 stops interpolates in **linear light** (values are already linear, so a plain `lerp` is gamma-correct) with `smoothstep(t')`. Locked minos and the active piece cross-fade tint on the same curve; their **geometry never moves**. |
| 0.70 – 1.00 | Bloom base/ceiling/threshold lerp. The EPOCH card fades in on `layerHud`, top-centre, above the Next queue and outside the well rect, holds 96 ticks, fades out — all from `zoneCardStateForTick`. It is HUD text mirrored into the shell's `aria-live="polite"` status region so it is announced, not just seen. |

Explicitly forbidden during a transition: any full-screen flash, any luminance step above the limiter's per-frame ceiling, any camera zoom, any change to well geometry or cell size, any input suppression.

**Top-out mid-transition.** The tick stops advancing, so `zoneBlendForTick` and `zoneCardStateForTick` freeze — a half-blended palette held under the results overlay, correct and needing no unwind state. The card is removed when `layerHud` swaps to results chrome. `gameOver` (§4.4) emits into `layerParticleNear` as normal; §4.4's capacity derivation covers the overlap because `gameOver` fires into a board that has stopped emitting everything else.

---

## 4. The particle system

### 4.1 Design

One system, two `ParticleContainer`s (far/near), one texture atlas, structure-of-arrays typed storage, dense alive-prefix pooling. `apps/stacked/src/render/particles.mjs`:

```js
export function createParticleSystem({ capacity, rng, atlas, containers }) → {
  emit(presetId, ctx),          // ctx: { x, y, boardIndex, toRoot, cellLu, zone, count?, scale? }
                                //   x,y   — board-local au; toRoot maps them to root lu
                                //   cellLu — cu→lu factor for velocity, accel and size
  update(dtSeconds),
  syncToContainers(),
  setCapacity(n),               // guard shrinks/grows the ALIVE CEILING; never reallocates
  aliveCount, capacity, stats,
  clear(), destroy(),
}
```

Storage is allocated **once** at `tier.particleCapacity` and never reallocated. Note *tier*, not "current effective capacity": `stackedEffects: 'minimal'` and every guard level move only the alive ceiling, so a player who turns effects back up mid-run gets them back without an allocation, and one who starts on `minimal` is not stuck with zero-length arrays.

```js
x, y, vx, vy, ax, ay          Float32Array(capacity)   // ROOT logical units (lu), lu/s, lu/s²
life, maxLife                 Float32Array(capacity)   // seconds
size0, size1                  Float32Array(capacity)   // lu, start/end (converted from cu at emit)
rot, spin                     Float32Array(capacity)   // radians, radians/sec
alpha0, alpha1                Float32Array(capacity)
tint0, tint1                  Uint32Array(capacity)    // 0xRRGGBB
drag                          Float32Array(capacity)   // 1/sec
textureIndex                  Uint8Array(capacity)     // atlas cell 0..7
boardIndex                    Uint8Array(capacity)
layer                         Uint8Array(capacity)     // 0 = far, 1 = near
priority                      Uint8Array(capacity)     // 0 = never cull … 3 = cull first
```

Alive particles occupy `[0, aliveCount)`. Death is swap-remove with the last alive slot — O(1), no free list, no fragmentation, cache-local update loop.

**Memory.** The SoA is 15 `Float32Array` + 2 `Uint32Array` + 4 `Uint8Array` = **72 bytes per particle**, so even the largest tier is under a megabyte and can be allocated at boot. The `Particle` *view* objects are the expensive half — each a real JS object with ten fields plus a `Texture` reference, a few hundred bytes, and constructing tens of thousands at boot is a measurable hitch. **So the view pool is not preallocated to `capacity`:** it grows on demand in blocks of 512, never shrinks within a session, and its high-water mark is `stats.viewPoolSize` → `dataset.particlePoolSize`. A run that never exceeds 700 concurrent particles never allocates more than 1,024 views.

Update — semi-implicit Euler, drag as an exact exponential so it is framerate-independent:

```js
const dragMul = Math.exp(-drag[i] * dt);      // Math.exp is fine here — this is render code
vx[i] = (vx[i] + ax[i] * dt) * dragMul;
vy[i] = (vy[i] + ay[i] * dt) * dragMul;
x[i] += vx[i] * dt;  y[i] += vy[i] * dt;
rot[i] += spin[i] * dt;
life[i] -= dt;
if (life[i] <= 0) swapRemove(i);
```

Rendering: `syncToContainers()` walks the alive prefix, writes into the preallocated array of `Particle` view objects, sets each `ParticleContainer.particleChildren.length` to that layer's alive count, then calls `container.update()`. **All particle Pixi API contact happens inside this one function.**

Four Pixi 8 specifics, each a silent failure if guessed:

1. **`dynamicProperties` keys are `vertex`, `position`, `rotation`, `uvs`, `color`** — there is no `scale` key; per-particle scale rides on `vertex`. Both containers set all five `true`. `uvs` cannot be `false` even though a particle never changes its own atlas cell: swap-remove reuses view slot *i* for a different particle next frame, so slot *i*'s texture genuinely changes frame to frame. Fully dynamic re-uploads the whole attribute buffer each frame — the honest cost, and still one draw call.
2. **Direct mutation of `particleChildren` requires `container.update()`.** `addParticle()` / `removeParticles()` do it for you; assigning `.length` does not. Skip it and the container renders last frame's count forever.
3. **`Particle` exposes exactly `x, y, scaleX, scaleY, anchorX, anchorY, rotation, tint, alpha, texture`** — no `width`/`height`; `Particle.defaultOptions` is `{ anchorX: 0, anchorY: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, tint: 0xffffff, alpha: 1 }`. So **set `anchorX = anchorY = 0.5` on every view object at pool-construction time** — the `vertex` attribute builds the quad from `anchorX/anchorY × texture.orig`, so a default-anchored particle rotates about its corner and sits half a cell off. And `size0/size1` are lu, so the write is `scaleX = scaleY = sizeLu / cellTexture.orig.width`; **read the divisor off the texture, never hard-code it** — both atlases use 128 px cells today, so a literal works until someone repacks the atlas, after which every particle silently changes size by the ratio.
4. **Pixi 8 has no `BaseTexture`.** Cells are `new Texture({ source: atlas.source, frame: new Rectangle(col * cell, row * cell, cell, cell) })` over one shared `TextureSource`. That shared source is what collapses each container to a single draw call, and why the atlas must be one image rather than eight files. Per-particle UVs come from `p.texture.uvs`.

**Atlas load and its failure mode.** Two committed files, selected by tier:

| Tier | File | Size | Cell |
| --- | --- | --- | --- |
| `desktopHigh`, `desktopLow` | `apps/portal/assets/stacked/particle-atlas-v1.png` | 512×512, 8 cells | 128 |
| `mobile` | `apps/portal/assets/stacked/particle-atlas-v1-256.png` | 256×256, 4 cells (2×2) | 128 |

Both premultiplied-alpha PNGs referenced as **root-absolute runtime string URLs** — `'/assets/stacked/particle-atlas-v1.png'`. Two files rather than a client-side downscale: shrinking a decoded PNG needs a canvas round-trip, and the mobile file keeps the same 128 px cell while carrying a quarter of the texels.

`await Assets.load(url)` runs during boot, before the first frame. On rejection the system falls back to a 1×1 opaque white `Texture` for **all** cells, sets `stats.atlasFallback = true` and publishes `dataset.atlasFallback` — every particle becomes an untextured tinted square and the game is fully playable. It does not throw and does not block the run: a missing decorative PNG must never fail a Ranked start.

`build.mjs` forbids esbuild asset loaders (`// Do NOT add file/dataurl loaders: asset URLs are runtime strings, not imports.`), so this is a plain string, and it must be **root-absolute**: the child shells at `apps/portal/hmh-reboot/index.html` and `apps/portal/chikun/index.html` carry no `<base>` element (only the parent `apps/portal/index.html:5` has `<base href="/" />`), so a bare relative path resolves against `/stacked/` and 404s. HMH already uses this convention (`WORLD_DECAL_URL = '/assets/generated/hmh-world-decals/hmh-world-decals.json'`).

| Index | Cell | Used by |
| --- | --- | --- |
| 0 | soft dot (radial falloff) | ambient motes, bloom feeders |
| 1 | hard square (crisp, 4 px feather at 128 px cell) | mino debris |
| 2 | shard (elongated triangle) | line clears, `scrypt-lattice` |
| 3 | ring (thin annulus) | HALVING, spin-clear shockwave |
| 4 | streak (16:1 elongated) | hard-drop trail, REORG rise |
| 5 | glyph (Ł mark) | MEMPOOL cards, combo escalation |
| 6 | spark (4-point star) | lock, high-band sparkle |
| 7 | dust (soft irregular) | vault dust, ember |

The mobile atlas holds only cells 0, 1, 4, 6 (dot, square, streak, spark) in a 2×2 grid of 128 px cells at 256×256. `resolvePreset()` remaps any texture token absent on the current tier to cell 0; the remap table is data, so a preset never needs a tier branch.

### 4.2 The VFX RNG — a separate stream, deliberately

Particle jitter **must not** come from the simulation's RNG, or the visual layer would consume draws and change the game.

```js
// From apps/stacked/src/render/particles.mjs — three levels up to apps/, then across.
import { createSeededRng, hashSeed } from '../../../portal/src/seeded-rng.mjs';
const vfxRng = createSeededRng(hashSeed(`stacked-vfx:${session.seed}`) >>> 0);
```

`apps/portal/src/seeded-rng.mjs` exports `mulberry32`, `hashSeed`, `SeededRng`, `createSeededRng`, `createSeededSubstreams`. Reuse it — `mulberry32` is already open-coded in `drop-tables.mjs`, `hmh-drop-economy.mjs` and `leaderboard-seed.mjs`. Its `next()` divides by `4294967296`, so the range is `[0, 1)` and `Math.floor(rng.next() * arr.length)` is always in bounds. (`deterministicRoll` in `apps/portal/src/chikun-cabinet.mjs` divides by `0xffffffff`, where 1.0 is reachable; do not use that pattern for indexing.) The sim's substreams are separate and named — `createSeededSubstreams(seed, ['bag', 'garbage', 'zone'])`, contract §4.2 — and the VFX stream is never added to that list.

The seeded RNG is not about determinism of the game; it is about **reproducible visual-regression captures** (§8). Under `evidenceSafe=1` it is seeded from a fixed constant instead of the session seed.

### 4.3 Emitter presets — data, not code

`apps/stacked/src/render/particle-presets.mjs` exports one frozen map. **Colours and textures are token paths into the active zone, never literals** — that is the whole mechanism by which zones re-skin the particle system without new code.

```js
export const EMITTER_PRESETS = Object.freeze({
  lock: Object.freeze({
    id: 'lock',
    layer: 'near',
    priority: 2,
    burst: Object.freeze({ mobile: 6, desktopLow: 10, desktopHigh: 16 }),
    rate: 0, durationMs: 0,                       // pure burst
    shape: Object.freeze({ type: 'edge-box', spreadDeg: 70, dirDeg: -90 }),
    speed: Object.freeze([1.0, 3.8]),             // CELL UNITS/sec, uniform in range (×cellLu at emit)
    accel: Object.freeze([0, 10.5]),              // cu/sec², gravity down
    drag: 2.4,                                    // 1/sec — dimensionless, NOT converted
    lifeMs: Object.freeze([220, 420]),
    size: Object.freeze([[0.08, 0.25], [0, 0.05]]), // cu: [startMin,startMax], [endMin,endMax]
    alpha: Object.freeze([1.0, 0.0]),
    spinDegPerSec: Object.freeze([-240, 240]),
    tint: Object.freeze(['zone.accent', 'zone.ink']),   // start, end — token paths
    texture: Object.freeze({ spark: 0.7, square: 0.3 }), // weighted token selection
    blend: 'add',
    flashBudget: 0.06,                            // luminance contribution declared to the limiter
  }),
  // …
});
```

**Every linear preset quantity is in cell units (cu).** `speed`, `accel` and `size` are multiplied by `ctx.cellLu` at emit (§1.5 rule 3); `drag` (1/sec), `lifeMs`, `alpha` and `spinDegPerSec` are scale-free and are not. Sanity-check `lock` in cu: 1.0–3.8 cu/s over a 220–420 ms life is a 0.3–1.1 cell throw, and 10.5 cu/s² pulls it about a quarter cell downward over that life — a spray that hugs the locked piece.

`resolvePreset(presetId, zone, tier)` merges, in order: preset default → `zone.particles.overrides[presetId]` → tier scaling (including the mobile texture remap) → frame-budget-guard scaling. It returns a flat frozen record with `tint` resolved to `0xRRGGBB` and `texture` to an atlas index. Cached per `(presetId, zoneIndex, tier, guardLevel)`, invalidated on zone/tier/guard change. It is **not** keyed on `cellLu`: the cu→lu conversion happens per emit against `ctx`, because two boards can have different `cellLu` and must share one cache entry.

### 4.4 Preset catalogue and per-tier counts

Burst particle counts per event except where marked `/sec`. `desktopHigh` / `desktopLow` / `mobile`.

| Preset | Trigger (sim event) | High | Low | Mobile | Shape / feel | Prio |
| --- | --- | --- | --- | --- | --- | --- |
| `ambient-<zone>` | continuous | 14/sec | 6/sec | 2/sec | zone-authored drift on `layerParticleFar` | 3 |
| `softDrop` | soft drop, throttled to 1 burst per 3 sim ticks (20/s) | 2 | 1 | 0 | tiny trail under the piece | 3 |
| `hardDropTrail` | hard drop | 22 | 12 | 6 | streak column, spawn row to landing row | 2 |
| `lock` | piece locks | 16 | 10 | 6 | outward spray from the locked cells' outer edges | 2 |
| `lineClear` | 1–3 rows (CONFIRM / BATCH / MERKLE) | 34/row | 16/row | 8/row | horizontal shard burst from each cleared row | 1 |
| `quadClear` | 4 rows (HALVING) | 260 | 110 | 46 | ring shockwave + full-width shard rip + 2-frame bloom lift | 0 |
| `spinClear` | FORK / MINI FORK | 180 | 80 | 34 | rotational vortex, particles spiral out on the spin's chirality | 0 |
| `comboEscalation` | MEMPOOL ≥ 2, tiered | 18×tier | 8×tier | 4×tier | glyph cards ascending; tier capped at 8 → 144/64/32 max | 1 |
| `perfectClear` | GENESIS, board emptied | 420 | 180 | 70 | full-well column of rising ink + ring, brightest legal event | 0 |
| `levelUp` | gravity level increases | 90 | 44 | 20 | horizontal band sweeping the well, one per level | 1 |
| `zoneTransition` | zone blend `t` in [0, 0.4] | 40/sec | 18/sec | 6/sec | zone's `transition.style`, backdrop + far layer only | 1 |
| `garbageRiseWarning` | REORG queued, ≤ 90 ticks out | 26/sec | 12/sec | 5/sec | upward streaks from the well floor, ramping with proximity | 1 |
| `nearTopOutDanger` | stack height ≥ 85% for ≥ 30 ticks | 30/sec | 14/sec | 6/sec | red-shifted embers along the top rim + **static** border (no strobe) | 0 |
| `gameOver` | terminal (any `terminalReason`) | 600 | 260 | 110 | the whole stack disintegrates downward; only preset that may exceed the per-frame emit cap | 0 |

Continuous emitters need a lifetime to be countable, declared here rather than left to the preset author: **`ambient-<zone>` 4–8 s (mean 6 s); `zoneTransition` 0.9–1.5 s (mean 1.2 s); `garbageRiseWarning` and `nearTopOutDanger` 0.6–1.0 s (mean 0.8 s); `softDrop` 0.2–0.4 s (mean 0.3 s).** Steady-state alive count is `rate × mean lifetime`.

**Peak load, derived.** The adversarial instant is an elite player at a capped 8× MEMPOOL landing a HALVING on the same frame a zone transition is sweeping, REORG is rising, and the stack is in the danger band:

| Source | Alive contribution (`desktopHigh`) |
| --- | --- |
| `ambient` 14/s × 6 s | 84 |
| `zoneTransition` 40/s × 1.2 s (conservative: only 40 emitted across the whole 0 ≤ t ≤ 0.4 window) | 48 |
| `garbageRiseWarning` 26/s × 0.8 s | 21 |
| `nearTopOutDanger` 30/s × 0.8 s | 24 |
| `softDrop` 2 × 20/s × 0.3 s | 12 |
| `quadClear` burst | 260 |
| `comboEscalation` at the 8× cap | 144 |
| `lineClear` residue from the previous piece, 3 rows | 102 |
| `hardDropTrail` + `lock` | 38 |
| **Total** | **733** |

Substituting `perfectClear` (420) for the HALVING gives **893**; `gameOver` (600) fires only into a board no longer emitting anything else. The `desktopHigh` ceiling is therefore ~**1,200** concurrent particles — `893 × 1.35`, a 35% pad over the worst case the design can construct. The same arithmetic on the other two columns gives adversarial sums of 329 and 142, hence 445 and 190 padded, rounded up to ~540 and ~230. Capacities are ~5× the derived ceiling: enough that the governor never makes a judgement call during play, small enough that the SoA and view pool stay honest.

| | `desktopHigh` | `desktopLow` | `mobile` |
| --- | --- | --- | --- |
| adversarial sum | 893 | 329 | 142 |
| derived ceiling | ~1,200 | ~540 | ~230 |
| `particleCapacity` | **6,000** | **2,600** | **1,200** |
| SoA bytes (72 B each) | 432 KB | 187 KB | 86 KB |

If a future preset genuinely needs more, raise the cap in the same commit that adds it and update this derivation.

### 4.5 Emission governor

```js
function emit(presetId, ctx) {
  const p = resolvePreset(presetId, zone, tier);
  let want = ctx.count ?? p.burstForTier;
  const headroom = capacity - aliveCount;

  if (p.priority >= 2 && headroom < capacity * 0.25) return 0;        // drop low-priority under pressure
  if (want > headroom) want = Math.max(0, headroom);                   // never overflow
  if (want > perFrameEmitCap && p.priority > 0) want = perFrameEmitCap;
  // priority 0 (quadClear/spinClear/perfectClear/gameOver/nearTopOutDanger) bypasses
  // perFrameEmitCap but still cannot exceed headroom.
  spawn(p, ctx, want);
  return want;
}
```

`perFrameEmitCap` = **700 / 320 / 150** by tier — about 12% of capacity. Priority-0 events bypass it because a HALVING that emits 260 of its 260 particles is the entire emotional payload of the game.

**Both brakes are pathological-case brakes and are expected to be dead code in normal play.** At the derived steady state (~730 alive against 6,000) `headroom` is always far above `capacity × 0.25`. The largest single-frame priority-1 emission is `lineClear` at 3 rows (102) + `comboEscalation` at the 8× cap (144) + `levelUp` (90) = 336, under half the 700 cap; on mobile 24 + 32 + 20 = 76 against 150. If the smoke reports either brake firing during a scripted run, the capacity derivation is wrong — the threshold does not get nudged.

Dropped particles increment `stats.droppedByPriority[p]`, surfaced as `dataset.particlesDropped` and asserted near-zero by the performance smoke.

---

## 5. Quality tiers, bloom, and the frame-budget guard

Three tiers: `desktopHigh` | `desktopLow` | `mobile`. **`reduceMotion` and `reduceFlash` are orthogonal modifiers, never tiers** (contract §1.2) — a desktop player who needs reduced motion should still get a crisp board, just a calmer one. HMH models reduced-motion as a third profile in `RUNTIME_PERFORMANCE_PROFILES` (`apps/hmh-reboot/src/runtime-performance.mjs`); STACKED does not copy that.

`apps/stacked/src/render/quality-tier.mjs`:

```js
export const STACKED_QUALITY_TIERS = Object.freeze({ desktopHigh, desktopLow, mobile });
export function selectStackedQualityTier({ width, devicePixelRatio, coarsePointer,
                                           hardwareConcurrency, deviceMemory, override });
```

Selection, first match wins (contract §2.6):

1. `override !== 'auto'` → that tier verbatim (`stackedQuality` player setting).
2. `coarsePointer === true && width <= 820` → `mobile`. **Both conditions, not either.** An `||` sends every 10–13″ tablet and touchscreen laptop to the phone tier — resolution capped at 1.25, bloom off — on hardware that comfortably runs `desktopLow`, and flips the tier while a desktop player resizes a window.
3. `coarsePointer === true` (wider touch device) → `desktopLow`. Touch implies a thermally constrained device even on a large screen; `stackedQuality: 'high'` is available for players who know their tablet can take it.
4. `hardwareConcurrency <= 4 || deviceMemory <= 4` → `desktopLow`. Both may be `undefined` (`deviceMemory` is unimplemented in Safari and Firefox) — treat `undefined` as "not low" and fall through. Never treat a missing value as a failing one.
5. otherwise → `desktopHigh`.

Resolution: `resolution = Math.min(tier.resolutionCap, devicePixelRatio)`, then the per-tier area clamp `if (cssW * cssH * resolution ** 2 > maxPixelArea) resolution = sqrt(maxPixelArea / (cssW * cssH))`, floor 1.

The tier is selected **once, at boot**, never re-evaluated on resize: a mid-run tier change would reallocate the particle store and swap the backdrop pipeline while a Ranked run is live. The frame-budget guard is the in-session mechanism and is reversible in a way a tier swap is not. Follows the shape of `selectRuntimePerformanceProfile()` (pure, throws on bad input, returns frozen).

| | `desktopHigh` | `desktopLow` | `mobile` |
| --- | --- | --- | --- |
| `particleCapacity` | 6,000 | 2,600 | 1,200 |
| `perFrameEmitCap` | 700 | 320 | 150 |
| `bloomCap` (absolute `layerPost` alpha ceiling) | 0.35 | 0.22 | 0 |
| `resolutionCap` | 2 | 1.5 | 1.25 |
| `maxPixelArea` | 4,000,000 | 1,600,000 | 1,600,000 |
| `antialias` | true | false | false |
| Backdrop | full fragment shader, full res | shader at 1/2 res, upscaled | 2 `TilingSprite`s + tinted gradient, **no shader** |
| Bloom | RenderTexture at 1/4 res, threshold + 2 separable blur passes, additive composite | additive glow **sprites** on the well and cleared rows, no RenderTexture | **off** |
| Board glow | `Filter` | Sprite | Sprite |
| Parallax layers | 3 | 2 | 1 |
| Atlas cells | 8 (512²) | 8 (512²) | 4 (256²) |
| Shake amplitude × | 1.0 | 1.0 | 0.6 |
| `cpuBudgetMs` (p95 of the render callback's own CPU time) | 8.0 ms | 9.0 ms | 10.0 ms |
| `longFrameRatio` (dropped-frame fraction that escalates) | 0.10 | 0.10 | 0.12 |

`maxPixelArea`: a single 1.6 M ceiling would clamp a 1440×900 window at dpr 2 down to resolution 1.11 and defeat `resolutionCap: 2` on every display anyone owns, so desktop gets 4 M; 1.6 M matches `combatCanvasRenderScale`'s existing default in `apps/portal/src/device-model.mjs`. `desktopLow` takes the tighter budget because it *is* the weak-GPU tier.

**`bloomCap` reconciled with the flash limiter.** The tier ceiling and §7.2's absolute additive ceiling clamp the *same* scalar, so `desktopHigh` is 0.35 to match the limiter exactly. `desktopLow` is 0.22 because glow-sprite rendering reads brighter per unit alpha than a thresholded composite. Under `reduceFlash` the limiter tightens to 0.14 and binds on every tier. §7.2's static zone gate asserts no zone's `bloom.ceiling` exceeds 0.35, which is why `genesis-vault`'s ceiling is 0.34.

`stackedQuality: 'auto' | 'high' | 'low' | 'mobile'` lives in the parent's player-settings blob and is pushed in `portal:settings` next to `stackedEffects` (§7.1). Both must be added to `stacked-bridge-protocol.mjs`'s own `validateSettings` exact-key list — `sdk/hmh-bridge-protocol.mjs`'s `validateSettings` is HMH-shaped and rejects unknown keys.

**Telemetry.** Contract §2.6's dataset keys on `#stackedStage`, gated behind `telemetry=1`: `qualityProfile`, `reducedMotion`, `renderResolution`, `renderedParticles`, `particlePoolSize`, `simulationTick`, `runScore`, `garbageRowsInserted`, `runRestarts`, `longestRunTicks`, `assetsReady`. This document adds `rootScale`, `renderTick`, `particlesDropped`, `atlasFallback`, `shakeAmplitude`, `parallaxSpeed`, `degradationLevel`, plus §7.2's limiter stats. `gates.md` §6.1 already asserts `dataset.qualityProfile ∈ desktopHigh/desktopLow/mobile` plus a separate `dataset.reducedMotion` boolean, which is contract §2.6's vocabulary; nothing is outstanding there. It also asserts `0 < renderedParticles <= reducedCeiling` under the `reduceMotion` modifier — **not** `=== 0` — because §7.1 scales particle motion and keeps particles rendering; only `stackedEffects: 'minimal'` and guard level 3 zero the alive ceiling (contract §2.6).

### 5.1 Bloom implementation (`desktopHigh`)

```
   bloomRT_A / bloomRT_B = RenderTexture.create({
       width:  renderer.screen.width,          // CSS px — NOT device px
       height: renderer.screen.height,
       resolution: tier.resolution * 0.25,     // quarter linear = 1/16 the texels
       antialias: false,
   })

1. app.renderer.render({ container: boardRoot,         target: bloomRT_A,
                         clear: true,  transform: boardRoot.worldTransform })
2. app.renderer.render({ container: layerParticleNear, target: bloomRT_A,
                         clear: false, transform: layerParticleNear.worldTransform })
3. thresholdFilter (custom Filter + GlProgram):
      vec3 c = max(color.rgb - uThreshold, 0.0) / max(1.0 - uThreshold, 1e-3);
   → bloomRT_B
4. blurH (9-tap separable Gaussian, σ = 2.2) : bloomRT_B → bloomRT_A
5. blurV (same kernel)                        : bloomRT_A → bloomRT_B
6. layerPost holds one Sprite(bloomRT_B) at scale 1, blendMode 'add',
   alpha = clamp(visualParams.bloomIntensity, 0,
                 min(zone.bloom.ceiling, tier.bloomCap))   [flash-limited]
```

- **Downscale with `resolution`, not with a matrix.** Sizing the render textures in *CSS pixels* at a quarter *resolution* gives a target one-sixteenth the texels occupying the same logical rectangle as the screen, so the composite sprite is a plain 1:1 draw with no `scale = 4` fudge factor and no class of bugs where the downscale matrix and composite scale drift apart. It is also why `Matrix` is not in the vendor list.
- **The transform is still not optional.** `renderer.render({ container })` draws that container at its *own* transform, not its position in the live scene graph, so each pass is handed that container's live `worldTransform` — which already includes `stackedRoot`'s scale, position and global shake. Omit it and the shake is in the board but missing from the glow, reading as the bloom sliding off the well on every hard drop. This is why §1.4 pins `boardRoot` to an identity local transform.
- **The targets are resize-sensitive.** `renderer.on('resize')` must destroy and recreate both and skip the bloom passes on the rebuild frame.

Four extra render passes, three at 1/16 resolution and one fullscreen additive quad. Budget ≤ 1.0 ms at 1920×1080 on integrated graphics and **verify it in the performance smoke** — this is an order-of-magnitude estimate, not a measurement. If it exceeds 1.5 ms, drop to a single blur pass at σ = 3.0 before dropping the effect.

`desktopLow` skips all of it: `layerPost` instead holds a small pool of pre-authored radial-gradient Sprites in additive blend on the well rim and cleared rows, alpha-driven by the same `bloomIntensity`. One number, three renderings.

### 5.2 Frame-budget guard

`apps/stacked/src/render/frame-budget.mjs`: `createFrameBudgetGuard({ tier })` → `{ sample({ frameMs, cpuMs }), level, params, reset(), pin(level) }`.

**A p95 of `frameMs` against a fixed millisecond budget is the wrong test and would fail every healthy device.** On a vsynced 60 Hz display an idle page reports `frameMs ≈ 16.7 ms` on essentially every frame, so a p95 of 16.7 blows through a 13.5 ms "budget" on hardware doing nothing. The real signal is **dropped frames relative to that device's own refresh cadence**. Rolling ring of the last 120 samples (≈2 s at 60 Hz), two signals evaluated once per full window:

```js
// refreshMs is learned, not assumed. Median of the first full window after every
// reset(), clamped to [6.5, 34] ms so a pathological window cannot poison it.
refreshMs   = clamp(median(window), 6.5, 34);
longFrames  = count(window, (ms) => ms > refreshMs * 1.5);   // a dropped frame
longRatio   = longFrames / window.length;
cpuP95      = p95(window.cpuMs);
```

`longRatio` is primary and refresh-rate agnostic: 10% dropped frames means the same thing at 60, 120 and 144 Hz and in a 30 Hz-capped tab. `cpuP95` is secondary, checked against `tier.cpuBudgetMs`; it under-measures GPU-bound frames (§1.6) so it can never be the only test, but it rises *before* frames start dropping on a CPU-bound device. Samples across a visibility gap, a resize, or the first frame of a session never enter the ring.

| Level | Effect |
| --- | --- |
| 0 | tier nominal |
| 1 | `particleCapacity ×0.60`, bloom blur 2 passes → 1 |
| 2 | `particleCapacity ×0.35`, bloom **off**, backdrop shader → static zone gradient |
| 3 | `particleCapacity ×0.15`, board glow off, shake amplitude ×0.5, parallax layers → 1, and **L3 is announced** with a `PERF` pip in the HUD |

Escalate one level when `longRatio > tier.longFrameRatio` **or** `cpuP95 > tier.cpuBudgetMs`, for **2 consecutive windows** (~4 s). Recover one level when `longRatio < 0.02` **and** `cpuP95 < tier.cpuBudgetMs × 0.70`, for **4 consecutive windows** (~8 s), and never more than once per 10 s. The asymmetry is the design: degrade in 4 s, recover in 8+ s so the guard cannot oscillate and produce a visibly pumping effects budget, which looks far worse than staying at level 1. The 2% recovery floor is not 0% because one dropped frame in 120 is a browser doing housekeeping.

`setCapacity(n)` **never reallocates** — the typed arrays stay at `tier.particleCapacity`; only the alive ceiling moves. When `n < aliveCount`, cull in one backward pass from `aliveCount - 1`: remove non-priority-0 particles first, and only if the target is still unmet remove priority-0 ones from the tail. Newest-first within each pass, so an in-flight HALVING ring survives a demotion while the ambient motes behind it do not.

The guard reads `performance.now()` and is explicitly non-deterministic. It lives in `apps/stacked/src/render/`, its output reaches only `visualParams`, and it is **pinned to level 0** whenever `evidenceSafe=1` (§8). The current level is published as `dataset.degradationLevel` and travels in `game:result`'s `runStats` projection (contract §4.5) — telemetry only, never hashed, never ranked, never re-simulated.

---

## 6. The projection-only firewall

### 6.1 Structure

The simulation is **not** a directory under the child app. Per contract §2.10 it is one parent-side module:

```
apps/portal/src/stacked-sim.mjs    PURE. No DOM, no clock, no audio, no Pixi, no Math.random.
                                   Exports createStackedRuntime, simulateStackedRun,
                                   replayStackedRun, encodeSic1, decodeSic1,
                                   buildStackedResultTuple, refillBag, STACKED_SIM_CONSTANTS.
                                   Imports ONLY ./seeded-rng.mjs and ./stacked-contracts.mjs.

apps/stacked/src/render/**         EVERYTHING in this document. May read a frozen snapshot;
                                   may never write one. Never imported by the sim.
apps/stacked/src/main.mjs          wiring only: bridge → sim, sim → render, parent audio → render.
```

```
inputMask (uint8) ──► simulation.update(dtMs, mask) ──► frozen snapshot ──► renderer.present(snapshot, events, audio, zone, dt)
                                                                                │
   portal:audio-frame ──► audioReactive ────────────────────────────────────────┘   (never reaches update())
```

Four independent enforcement mechanisms:

1. **Signature.** `simulation.update(dtMs, mask)` is the *accumulator wrapper* — it owns `maxFrameDeltaMs` and the `STACKED_MAX_CATCH_UP_STEPS = 4` ceiling and nothing else, and calls `runtime.step(mask)` zero or more times. `runtime.step(mask)` accepts **exactly one argument, a `uint8` held-state mask** (contract §2.3): the only channel into the sim is 8 bits, every one allocated to a gameplay action, so audio, tier and `visualParams` have no parameter to arrive through. Argument validation follows the private `freezeClone` at `apps/hmh-reboot/src/simulation.mjs:19`, which throws on non-finite numbers and on any object whose prototype is not `Object.prototype`.
2. **Frozen snapshot.** `snapshot()` returns a deeply frozen object. The renderer holds a reference but cannot mutate it, and the sim never reads anything the renderer produced.
3. **Event-driven emission.** Particles are triggered from `snapshot.events[]` — a bounded ring the sim already produces for scoring (`lock`, `lineClear`, `quadClear`, `spinClear`, `combo`, `levelUp`, `garbageQueued`, `topOut`), each entry carrying a `tick` and a strictly increasing integer `sequence`. The renderer drains by watermark (§1.6), never writes back, never mutates the ring, never asks the sim a question. The ring holds at least four ticks' worth of events, matching `STACKED_MAX_CATCH_UP_STEPS`; the sim owns that guarantee and the renderer asserts it in dev by checking the lowest `sequence` in the ring is never above `lastConsumedSequence + 1`.
4. **Import direction.** `stacked-sim.mjs` may not import from `apps/stacked/src/render/` or from anything but `./seeded-rng.mjs` and `./stacked-contracts.mjs`. Asserted statically (§6.3).

### 6.2 Banned inside `stacked-sim.mjs`

`performance.now`, `Date.now`, `Math.random`, `requestAnimationFrame`, `window.`, `document.`, `navigator.`, `AudioContext`, `pixi.js`, and any import path containing `/render/`.

Also banned, for replay-hash stability across JS engines: `Math.hypot`, `Math.sin`, `Math.cos`, `Math.tan`, `Math.asin`, `Math.acos`, `Math.atan`, `Math.atan2`, `Math.pow`, `Math.exp`, `Math.expm1`, `Math.log`, `Math.log2`, `Math.log10`, `Math.log1p`, `Math.cbrt`, the hyperbolics, **and the `**` operator** — `**` is `Math.pow` with different syntax and a scanner that bans only `Math.pow` lets it through. ECMA-262 explicitly permits implementation-approximated results for all of these, so a run recorded in Chrome could fail parent-side re-verification in Firefox. `apps/portal/src/chikun-cabinet.mjs:291` calls `Math.hypot` inside its step function today — do not copy that; compare squared distances instead.

Permitted because they are exactly specified: `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`, `Math.abs`, `Math.sign`, `Math.min`, `Math.max`, `Math.imul`, `Math.fround`, `Math.clz32`, and **`Math.sqrt`** (IEEE-754 requires a correctly rounded square root, so it is bit-identical everywhere).

None of these bans apply to `render/` — a pixel that differs by one ULP between Chrome and Firefox is not a defect, which is why `Math.exp` is used freely in §4.1's integrator and §2.8's pulse decay.

### 6.3 The tests that prove it

All under `tests/`, picked up by `npm test`'s `tests/*.test.mjs` glob and `test:release`'s `readdirSync` auto-discovery. Contract §2.10's list is the scheme; the additions below follow it.

**`tests/stacked-sim-determinism.test.mjs`** (contract-listed) carries two jobs. First a **static source scan** over `apps/portal/src/stacked-sim.mjs`: none of §6.2's banned identifiers appears, and no import specifier resolves outside `./seeded-rng.mjs` and `./stacked-contracts.mjs` — the same technique `scripts/hmh-security-audit-sweep.mjs` uses to statically ban `.innerHTML =`, `eval(` and `new Function(` across `apps/portal`, `scripts` and `tests`. Second, determinism: same seed + same input stream ⇒ identical `resultHash`, three times in a row and once more from a freshly imported module instance; a different seed diverges. Precedent: `tests/iso-runtime-determinism.test.mjs`, `tests/seeded-rng.test.mjs`.

**`tests/stacked-projection-firewall.test.mjs`** — the load-bearing one. A headless harness constructs the full runtime (sim + a stub renderer that records calls + a scripted audio feed) and drives a fixed 20,000-tick input fixture under **nine** combinations:

```
tiers:  desktopHigh | desktopLow | mobile
audio:  absent (no portal:audio-frame ever arrives)
      | silent (frames arrive, all bands 0, onset false)
      | loud   (a scripted, non-random 900-sample spectral sequence, looped)
```

Assert all nine `resultHash` values are byte-identical **and equal to the hash from the pure `simulateStackedRun({ seed, inputs })` path with no renderer at all**. Add a tenth case with `stackedEffects: 'minimal'`, an eleventh with the guard forced to level 3, and a twelfth with `reduceMotion` + `reduceFlash` both on. The audio sequence is scripted, not random, so the test is itself deterministic and a failure is reproducible.

**Two things the twelve cases do not cover, and where their proof lives.** The thermal governor and every non-keyboard input path land in S-15, one cycle after this harness, and neither is one of the twelve. They are proved instead by `tests/stacked-thermal-governor.test.mjs` (its lowest and highest levels must produce an identical run result **and** an identical layout cell) and `tests/stacked-input-device-parity.test.mjs` (one intent list from synthetic keyboard, pointer and gamepad sources must produce a byte-identical result **and** byte-identical evidence). Those two plus this file are the firewall's joint proof; cite all three, because "a twelve-case firewall test proves it" points a future optimiser at a test that would catch neither. If either mechanism is ever restructured, extend this harness rather than relying on the S-15 tests alone.

`resultHash` is `await sha256Hex(canonicalSessionJson(tuple))` from `apps/portal/src/session-integrity.mjs` — `canonicalSessionJson` (line 14) recursively key-sorts before stringify; `sha256Hex` (line 43) is async, takes a `{ cryptoProvider }` seam so it runs identically under browser Web Crypto and Node ≥ 18, and returns a `0x`-prefixed 66-character string. Reuse it; do not copy the module-private `canonicalJson`/`replayDigest64` pair at `apps/portal/src/hmh-run-integrity.mjs:71,79` — those are FNV-derived checksums, not commitments.

**`tests/stacked-audio-band-analysis.test.mjs`** — pure-math tests on `apps/portal/src/audio-band-analysis.mjs`: bin boundaries at 44,100 and 48,000 Hz, adaptive floor/ceiling convergence against a synthetic loud track and a synthetic quiet track producing comparable normalized output, onset hysteresis (no double-fire inside the 8-sample refractory, no missed onset after a sustained loud passage), silence gate.

**Browser-level**, in the performance smoke: run the same pinned fixture for 10 s at each tier with `evidenceSafe=1` and assert `#stackedStage`'s `dataset.simulationTick` and `dataset.resultHash` are identical across all three. The HMH visual harness already reads `dataset.simulationTick` off `#hmhRebootStage` and asserts it settles before capture.

---

## 7. Accessibility

A falling-block game with heavy bloom and beat-synced flashing is a genuine photosensitive-epilepsy surface. This is not a checkbox section.

### 7.1 Settings

Four settings, pushed parent → child in `portal:settings`. Three already exist as validated booleans and keep their names: `sdk/hmh-bridge-protocol.mjs`'s `validateSettings` requires `musicEnabled, screenShake, gore, reduceMotion, reduceFlash, colorblindTags`; `apps/portal/src/hmh-player-settings.mjs` carries `reduceFlash` through its default accessibility block, normalize, merge and projection; `hmhRebootSettings()` (`apps/portal/main.js:4740`) threads `reduceMotion` / `reduceFlash` / `colorblindTags` across the bridge. Transport and storage are `portal.md`'s.

| Setting | Values | Effect in STACKED |
| --- | --- | --- |
| `reduceMotion` | boolean | Shake amplitude → 0 (per-board and global). Backdrop parallax speed → 0. Domain-warp frozen. Particle initial speeds ×0.35, lifetimes ×0.60. Beat-driven **scale** pulsing → 0 (response becomes colour-only). Zone transitions become a straight 24-tick (400 ms) cross-fade with no sweep. Default: **on** when `prefers-reduced-motion: reduce` matches. |
| `screenShake` | boolean | Shake amplitude → 0, everything else untouched. The *preference* knob for players who dislike shake but want the rest of the show; `reduceMotion` is the accessibility knob and kills far more. |
| `reduceFlash` | boolean | Per-preset `flashBudget` ×0.25. Additive post-layer ceiling 0.35 → 0.14 linear. `onsetPulse` → bloom mapping disabled entirely (bloom follows only the smoothed `high` envelope). `nearTopOutDanger` strobe becomes a **static** border. `quadClear` bloom lift removed; ring and shards remain. Default: **off**, offered explicitly at first launch. |
| `stackedEffects` | `'full' \| 'reduced' \| 'minimal'` | `reduced`: alive ceiling ×0.4, ambient particles off, bloom ceiling ×0.5, backdrop shader → 2-stop gradient. `minimal`: alive ceiling **0**, bloom **off**, backdrop a flat zone gradient, zone transitions an 18-tick colour fade, no shake at all. `minimal` is both the accessibility floor and the competitive-play option. Default: `full`. |

All four are **live, mid-run, in Ranked**: they are projection-only, so changing one cannot alter a result. `stackedEffects` and the guard move the *alive ceiling* only — the typed arrays stay at `tier.particleCapacity` (§4.1) — so turning effects back up costs no allocation and no hitch; `reduceMotion` and `reduceFlash` reach `applyAudioMappings` on the next frame. `stackedQuality` is the one exception: read once at boot (§5), takes effect next session. `zoneIndexForTick` is unaffected by any of them — only the blend *duration* changes.

**Where `prefers-reduced-motion` is actually read.** The child evaluates `window.matchMedia('(prefers-reduced-motion: reduce)')` itself at boot and **ORs** the result with whatever `portal:settings` supplies. Two reasons, the second a gate:

1. The child shell is loadable standalone (`http://127.0.0.1:8791/stacked/index.html`, exactly as HMH is), where no `portal:init` ever arrives and a parent-only path would silently render the full-motion build to a player who asked for less.
2. §8's reduced-motion evidence page drives the child directly with `page.emulateMedia({ reducedMotion: 'reduce' })` and asserts `dataset.shakeAmplitude === '0'`. That emulation reaches the child's media query and nothing else; if the child only trusts the bridge, **that assertion can never pass** and the accessibility gate is decorative.

The OR is one-directional: the media query can only turn reduced motion *on*. A parent setting of `reduceMotion: true` is never overridden by a system preference of "no preference".

**First-run photosensitivity notice.** There is no media query for photosensitivity, so `reduceFlash` cannot be auto-detected. On the cabinet's very first launch (parent-stored flag, once ever, not per session) the mode-select screen shows a one-screen notice: this cabinet uses flashing lights and rapid colour changes synchronized to music; two buttons, *Continue* and *Reduce flashing effects*. The choice writes `reduceFlash` into parent settings and is thereafter editable in the settings panel. It is a screen, not a modal over gameplay, and never appears again.

### 7.2 The flash limiter — always on, at every tier, in every setting

`apps/stacked/src/render/flash-limiter.mjs`: `createFlashLimiter({ reduceFlash })` → `{ begin(), submit(channel, value), read(), stats }`. It never reads pixels: it computes a **luminance proxy** from values the renderer already knows, which is cheap, monotonic with real screen brightness, and available *before* the frame is drawn, so it can clamp rather than react.

```js
L = 0.55 * backdropLuma        // mean of the zone palette's `mid` stop, scaled by uPulse + uBeatFlash
  + 0.25 * bloomIntensity      // layerPost sprite alpha
  + 0.20 * overlayAlpha        // line-clear bands, danger vignette, transition wash
```

Rules, applied in this order, every frame:

1. **Rate limit — at most 3 flashes per second.** A "flash" is a rise of `ΔL ≥ 0.10` followed by a fall of `≥ 0.10` within 500 ms. Keep a 1 s rolling window of flash timestamps. If a 4th flash would begin, clamp the rising edge to `L_prev + 0.03` per frame until the window drains. This implements the *shape* of the WCAG 2.3.1 general flash threshold, not compliance with it: WCAG defines a flash on relative luminance measured over the actual rendered area, and this is a pre-render proxy over the whole viewport. The CI assertion below is what makes it trustworthy.
2. **Absolute additive ceiling.** The composited post-layer's additive contribution is clamped to `+0.35` linear light at all times, and to `+0.14` when `reduceFlash` is on.
3. **Area rule.** No effect may raise more than **25% of the viewport** by more than `0.20` luma within 100 ms. This is what makes the line-clear pop a *band over the cleared rows plus a bloom lift* rather than a full-screen white frame, and why `layerPost` composites additively over a bloom of the board rather than as a fullscreen wash.
4. **Red saturation guard.** Any overlay covering more than 25% of the viewport must satisfy

   ```
   (R + G + B) <= 0 ? pass : R / (R + G + B) < 0.70     // linear light
   ```

   The zero guard is not decoration: pure black is a legal palette stop, `0/0` returns `NaN`, and `NaN < 0.70` is `false`, so an unguarded implementation *fails on black*. This is the WCAG-shaped saturated-red test (WCAG's own red-flash threshold is a ratio ≥ 0.8; 0.70 leaves margin), and it is why `nearTopOutDanger` uses ember-orange rather than pure red: ember `[0.95, 0.42, 0.10]` scores **0.646** and passes, a saturated `[0.80, 0.10, 0.10]` scores **0.800** and does not.

   **Do not use `R - max(G, B) < 0.20`.** That is not what WCAG measures and is far too aggressive at the warm end: it rejects the zone-0 `secondary` stop `[0.90, 0.66, 0.28]` (difference 0.24) and would reject the entire `hashrate-forge` amber zone, whose actual red ratio is 0.489. A gate that fails on correct data gets suppressed, and a suppressed gate protects nobody.

`stats` exposes `flashesLastSecond`, `clampedFrames` and `maxLuminanceDelta`, mirrored onto `#stackedStage` as dataset attributes. **The performance smoke asserts `flashesLastSecond <= 3` across a 30 s scripted run including a HALVING, a level-up, a zone transition and a top-out.**

**Static data gate:** `tests/stacked-zones.test.mjs` asserts, over `STACKED_ZONES` as pure data:

- every palette stop satisfies the guarded red-ratio test above;
- every stop is a 3-tuple of finite values in `[0, 1]`;
- `relativeLuminance(palette.deep) ≤ 0.030` for every zone — the well-interior contrast gate, §7.3;
- no zone's `bloom.ceiling` exceeds **0.35** (the limiter's absolute additive ceiling; a higher value would be unreachable and therefore a lie);
- `bloom.base ≤ bloom.ceiling`, and `bloom.threshold − 0.12 > 0` for every zone, so §2.9's inverse threshold mapping cannot go negative;
- `transition.durationTicks` is a positive integer and `transition.style` is one of the five declared strings;
- `entryTick` values are non-negative integers, strictly increasing, starting at 0; `index` matches array position;
- `STACKED_ZONES.length === STACKED_ZONE_COUNT` (6);
- every `particles.overrides` key names a real preset in `EMITTER_PRESETS`, and every `tint` token path resolves against the zone's own palette.

Palettes are data, so a future zone added by editing data alone cannot regress any of it.

### 7.3 Beyond flashing

- **Colourblind-safe piece identity.** The seven piece shapes must be distinguishable without colour: each carries a distinct 2-bit corner glyph in the mino sprite, rendered at all tiers, at 1.0 alpha, never bloomed, never zone-tinted. `colorblindTags` strengthens the glyph contrast rather than adding it — the glyph is always present.
- **The well interior keeps a floor contrast ratio structurally, not by clamping.** `wellFrame` paints an **opaque plate of `zone.palette.deep`** across the well rect, untouched by `uPulse`, `uBeatFlash` or the palette-shift mix, so the background a mino sits on is a single known colour per zone in every audio state at every guard level. With WCAG contrast `(L₁ + 0.05) / (L₂ + 0.05) ≥ 3` and the gate `relativeLuminance(deep) ≤ 0.030`, any mino with relative luminance ≥ **0.19** clears 3:1 — `(0.19 + 0.05) / (0.030 + 0.05) = 3.0`. `genesis-vault`'s `deep` is `[0.012, 0.018, 0.035]`, luminance 0.0180. The zones test asserts the `≤ 0.030` half; `mechanics.md`'s piece palette owns the `≥ 0.19` half. (It also rules out very dark blues and purples for minos — a constraint on the G-18 art pass.)
- **HUD never moves and never blooms.** Score, level, next, hold and the EPOCH card sit on `layerHud`, outside every shake and every filter.
- **EPOCH cards are announced.** Each transition mirrors the zone name into the shell's `aria-live="polite"` status region.

---

## 8. Visual regression and `evidenceSafe=1`

Harness registration, npm scripts and CI wiring belong to `gates.md`. This document owns the renderer behaviour that makes a capture reproducible, and the scene list.

**Copy the signature contract, do not fork it.** `scripts/hmh-reboot-visual-regression.mjs` exports `VISUAL_SIGNATURE_SCHEMA` (line 105), `SIGNATURE_WIDTH = 32` (109), `SIGNATURE_HEIGHT = 18` (110), `SIGNATURE_TOLERANCE = 2.5` (114), `SIGNATURE_MAX_CELL_DELTA = 26` (119), `SIGNATURE_MAX_CHANGED_CELLS = 24` (120), plus `decodePng`, `signatureFromPng`, `compareSignatures`. New `scripts/stacked-visual-regression.mjs` **imports** those rather than re-declaring them; it is safe to import from because the run block is guarded behind `const isMain = …import.meta.url` at line 247.

Baselines land in `docs/testing/VISUAL_BASELINES/stacked/` as JSON luma signatures — **not PNGs**; the committed HMH baselines are 32×18 Rec.601 luma grids under schema `hmh-reboot-visual-signature-v1`, one `.json` per scene. Run output (PNGs plus fresh signatures) goes to `.hermes/evidence/stacked-visual/current/`. The harness screenshots through the browser compositor, not the canvas: the runtime canvas is WebGL with the default `preserveDrawingBuffer: false`, so an in-page `toDataURL`/`getImageData` returns a cleared buffer and every comparison passes forever.

**The prerequisite: music-reactive visuals are non-deterministic, and a mean tolerance of 2.5 luma units will not absorb them.** `?evidenceSafe=1` on the STACKED shell means **exactly** these eight things, in one code path so there is no partial evidence mode. It is **ignored when `portal:init` reports `mode: 'ranked'`**.

1. `audioReactive` is replaced by a **frozen synthetic frame** — a fixed band vector declared per scene, `onset: false`, `onsetPulse: 0`, `beatPhase: 0`, `bpm: 0`. No `portal:audio-frame` is ingested.
2. The frame-budget guard is **pinned to level 0** (`guard.pin(0)`).
3. The VFX RNG is seeded from a fixed constant (`hashSeed('stacked-vfx-evidence')`), not the session seed.
4. Backdrop `uTime` is pinned to the scene's declared value; the domain-warp phase does not advance.
5. **The render clock is replaced, not merely clamped.** `renderDtSeconds` is forced to exactly `1/60` and `rawDeltaMs` to `1000/60`, so the particle integrator, the `onsetPulse` decay and the backdrop step on a synthetic clock. The loop runs a declared, fixed number of render ticks after the scene's sim tick is reached, then stops calling `app.render()` and publishes `dataset.renderTick`. Nothing in the captured frame depends on how fast the CI machine is.
6. `dataset.renderTick` is published alongside `dataset.simulationTick`, and the harness waits for **both** to settle across two consecutive reads before capturing — the same settle check the HMH harness performs on `simulationTick` (it throws `scene ... did not settle before capture` when two reads disagree).
7. The **flash limiter is reset** at the start of the declared render-tick sequence. It is stateful — a rolling window of flash timestamps and a previous-L value — so without a reset the captured frame depends on how many frames the browser ran before the scene was pinned.
8. The **viewport fit is recomputed once** and `stackedRoot`'s logical→pixel transform published as `dataset.rootScale`. Two machines at 1280×720 must produce the same scale or every signature cell shifts.

The harness additionally **fails the run if `dataset.atlasFallback === 'true'`** on any scene: §4.1's white-square fallback is right for a player whose PNG 404s, but blessing it as a baseline would sign off signatures taken from a build with no particle art.

Scene list (13):

| Scene id | Viewport | Notes |
| --- | --- | --- |
| `zone-0-genesis-vault-desktop` … `zone-5-mainnet-aurora-desktop` | 1280×720 | one per zone, mid-run stack, no active event |
| `zone-0-genesis-vault-mobile` | 390×844 | 9:16 layout proof |
| `zone-5-mainnet-aurora-mobile` | 390×844 | 9:16 at peak bloom |
| `quad-clear-desktop` | 1280×720 | captured 6 render ticks after the `quadClear` event |
| `near-top-out-desktop` | 1280×720 | danger state, static border, red-saturation proof |
| `zone-transition-mid-desktop` | 1280×720 | `zoneBlendForTick` pinned at `t = 0.5` |
| `effects-minimal-desktop` | 1280×720 | `stackedEffects=minimal` — no particles, no bloom |
| `reduce-flash-desktop` | 1280×720 | `reduceFlash=1` at the same frame as `quad-clear-desktop`; must differ measurably |

Plus a non-signature reduced-motion evidence page: `page.emulateMedia({ reducedMotion: 'reduce' })`, then assert `dataset.shakeAmplitude === '0'`, `dataset.parallaxSpeed === '0'` and `dataset.renderedParticles` below the reduced ceiling.

Both `visual:stacked` and the performance smoke need Playwright (vendored under `benchmarks/hmh-engine-bakeoff/node_modules/playwright`, imported by relative path — it is not a `package.json` dependency) and a Chrome binary. Copy the HMH visual script's `HMH_REBOOT_BROWSER_EXECUTABLE` env override pattern as `STACKED_BROWSER_EXECUTABLE`; do **not** copy `scripts/hmh-reboot-performance-browser-smoke.mjs:16`, which hard-codes `C:\Program Files\Google\Chrome\Application\chrome.exe` with no override.

**Every new `.mjs` below — source, script and test — must be appended to `NODE_CHECK_FILES` in `scripts/syntax-check.mjs`.** That list is hand-maintained and un-globbed by design; an omission silently escapes `npm run check`, which runs inside `vercel:build`.

---

## 9. New and changed files

| Path | New? | What |
| --- | --- | --- |
| `apps/portal/src/audio-band-analysis.mjs` | new | Pure band/flux/onset math. No Web Audio. Node-testable. |
| `apps/portal/src/arcade-audio-analyser.mjs` | new | Web Audio wrapper: source → `musicGain` → `analyserSmooth`/`analyserRaw` → destination. |
| `apps/portal/src/stacked-zones.mjs` | new | `STACKED_ZONES`, `zoneIndexForTick`, `zoneBlendForTick`, `zoneCardStateForTick`. |
| `apps/stacked/src/render/layers.mjs` | new | `createLayerStack()`, fixed layer order (§1.4). |
| `apps/stacked/src/render/board-view.mjs` | new | `createStackedBoardView({ index, … })`, seven sub-layers. |
| `apps/stacked/src/render/root-fit.mjs` | new | `ROOT_LOGICAL_HEIGHT`, `fitRootToViewport()`. Pure, node-testable. |
| `apps/stacked/src/render/backdrop.mjs` | new | Zone shader `Mesh` + `GlProgram` + parallax. |
| `apps/stacked/src/render/bloom.mjs` | new | Threshold + separable blur + additive composite (§5.1). |
| `apps/stacked/src/render/particles.mjs` | new | SoA pooled system, two `ParticleContainer`s. |
| `apps/stacked/src/render/particle-presets.mjs` | new | `EMITTER_PRESETS`, `resolvePreset`. |
| `apps/stacked/src/render/audio-reactive.mjs` | new | Ingest / interpolate / idle + `applyAudioMappings`. |
| `apps/stacked/src/render/flash-limiter.mjs` | new | Unconditional photosensitivity limiter (§7.2). |
| `apps/stacked/src/render/frame-budget.mjs` | new | 4-level degradation guard with hysteresis. |
| `apps/stacked/src/render/quality-tier.mjs` | new | `STACKED_QUALITY_TIERS`, `selectStackedQualityTier`. |
| `apps/stacked/src/render/renderer.mjs` | new | `createStackedRenderer` — owns `present()`. |
| `apps/portal/assets/stacked/particle-atlas-v1.png` | new | 512×512, 8 cells of 128 px, premultiplied alpha. |
| `apps/portal/assets/stacked/particle-atlas-v1-256.png` | new | 256×256, 4 cells of 128 px (dot, square, streak, spark) — the `mobile` atlas. |
| `apps/portal/stacked/index.html` + `game.css` | new | Owned by `portal.md`; listed for `#stackedStage` and the `modulepreload` of `../dist/chunks/hmh-pixi.js`. |
| `apps/portal/src/stacked-bridge-protocol.mjs` | new | Owned by `portal.md`; listed because §2.8 adds `portal:audio-frame` to its exact-key validator and §5 adds two settings keys. |
| `apps/portal/src/stacked-layout.mjs` | new | `layoutMatch()` (contract §2.8). Owned jointly with `versus.md`; §1.5 states what the renderer requires of it. |
| `apps/hmh-reboot/src/pixi-vendor.mjs` | edit | 9 → 16 exports (§1.2); comment noting shared arcade ownership. |
| `build.mjs` | edit | `stacked/game` entry; widen the Pixi plugin importer to `/\/apps\/(hmh-reboot\|stacked)\/src\//`; split the bundle budget. |
| `scripts/hmh-reboot-bundle-budget.mjs` | edit | Add `ARCADE_PIXI_VENDOR_CAP = 646_000` and `HMH_ENTRY_JS_CAP = 431_000` alongside `assertHmhInitialJsBudget`, which keeps its 1,050,000 aggregate unchanged. |
| `scripts/hmh-reboot-performance-browser-smoke.mjs` | edit | Import `HMH_ENTRY_JS_CAP` instead of its own `BUNDLE_MAX_BYTES = 1_050_000` literal (line 8). |
| `apps/portal/main.js` | edit | Create/suspend the analyser with the cabinet; add the `musicGain` branch to `applyArcadeMusicVolume()` (line 1244) returning the product, not `audio.volume`; pump `portal:audio-frame` at 30 Hz. |
| `apps/portal/sw.js` | edit | Owned by `portal.md`; bumping `CACHE_VERSION` (line 13, currently `lesters-arcade-v24-hmh-encounter-truth`) is required by the two new atlas assets. |
| `package.json` | edit | `visual:stacked`, `visual:stacked:accept`, `smoke:stacked:performance` (registration owned by `gates.md`). |
| `scripts/syntax-check.mjs` | edit | Append every new module above to `NODE_CHECK_FILES`. |
| `scripts/stacked-visual-regression.mjs` | new | Imports the HMH signature constants; 13 scenes; `docs/testing/VISUAL_BASELINES/stacked/`. |
| `scripts/stacked-performance-browser-smoke.mjs` | new | Per-tier frame p95/p99, particle-drop counters, flash-limiter assertion, cross-tier `resultHash` equality. |
| `tests/stacked-zones.test.mjs`, `stacked-particle-system.test.mjs`, `stacked-flash-limiter.test.mjs`, `stacked-audio-band-analysis.test.mjs`, `stacked-projection-firewall.test.mjs`, `stacked-root-fit.test.mjs` | new | Visuals-owned additions to contract §2.10's test scheme (§6.3, §7.2). |
| `tests/stacked-quality-tier.test.mjs`, `stacked-render-tree.test.mjs`, `stacked-layout.test.mjs`, `stacked-sim-determinism.test.mjs` | new | Contract-listed; §5, §1.4, §1.5 and §6.3 state what they must assert. |
