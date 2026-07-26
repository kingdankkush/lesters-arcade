# HMH AAA Continuous Improvement Cycle 005

Date: 2026-07-25
Status: `LOCAL GATES PASSED · PREVIEW VERIFICATION PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `cbbdd5d5`

## Objective

A visual and presentation cycle (master-plan Phases 4, 8, 9, 10). The driving
finding: the shipped game rendered the player as a prototype line-art graybox
while a certified 168-frame production hero atlas sat unused, combat had almost
no legible feedback, and the world read as flat colour fields. This cycle also
repairs the visual gate itself, which had been broken for the reboot runtime.

## Preserved invariants

- Every change in this cycle is projection-only. No collision, damage, AI,
  spawn order, RNG, progression, or result changed. Two evidence-telemetry
  fields do change, deliberately: `dataset.actorArtSource` now reports the
  atlas rather than the graybox in real runs, and `dataset.actorArtFallbackReason`
  is new. Both are art telemetry, not gameplay evidence.
- No `Math.random` anywhere in the runtime; new effects use a seeded
  `deterministicUnit` hash so shake and debris are identical on replay.
- PixiJS `8.19.0`; fixed `60 Hz` with four catch-up steps; alias `hmh`,
  game ID `lester-blaster`, profile `wo71`, save schema `2`,
  bridge `hmh-bridge/v1`, 65,536-byte cap all unchanged.
- Camera shake offsets the **render container**, never `camera.shakeX/Y`.
  `screenToGround` reads those fields back for pointer aim, so shaking the
  camera would have let a cosmetic accessibility setting change which shots
  hit. A first implementation in this cycle did exactly that and was caught in
  review; the runtime now contains no `setCameraShake` call at all, and a test
  asserts `camera.shakeX/Y` are never written.
- `SETTLEMENT_LIVE` remains false. No LitVM action, no production promotion.

## 1. The visual gate was broken, then measuring nothing

`npm run visual:regression` drove the legacy portal canvas and waited for
`#hmhReadyOverlay`, which the reboot short-circuit never renders — so it could
only ever throw. It was recorded as debt in Cycle 004.

Rather than retrofit 857 lines of legacy-specific instrumentation, this cycle
adds a purpose-built gate for the reboot runtime:
`scripts/hmh-reboot-visual-regression.mjs` (`npm run visual:reboot`).

- Eight deterministic scenes (desktop + mobile viewports, six authored
  districts including the water crossing, the hashwood foliage belt, and the
  liquidation yard) captured under `evidenceSafe`. Each scene is **paused via
  the runtime's own Escape path before capture** and asserted to have settled,
  so the frame is pinned to an exact simulation tick rather than drifting;
  modal chrome is hidden and only the renderer canvas is captured.
- A 32x18 Rec. 601 luma signature per scene, compared against a committed
  baseline on three axes: mean delta, worst single-cell delta, and number of
  changed cells. Mean alone is blind to a large change confined to a small
  part of the frame — a hero sprite is under 1% of a 1440x900 view, so losing
  it entirely moves the mean by ~0.9 and a mean-only gate passes it. Review
  proved that hole; the cell bounds close it.
- `--accept` updates baselines; PNGs are written for human review.

**A first implementation of this gate was silently useless.** It read the
canvas inside the page via `drawImage`/`getImageData`, but the runtime canvas
is WebGL with the default `preserveDrawingBuffer: false`, so every signature
came back as 576 zeros and every scene compared equal forever. The harness now
decodes the browser's own screenshot PNG in Node (`decodePng`), and refuses to
record a scene whose frame is uniform. Baseline signatures are now real
(min 29, max 149, 76 distinct values on the opening scene).

## 2. The shipped player was a placeholder

`productionPilotEnabled` required `?productionPilot=1`; the portal host builds
`iframe.src` with no query string. Every real run therefore rendered
`drawPrototypeHumanoid` — an 8-segment line figure whose legs rotate with the
torso — while the certified four-layer, 168-frame atlas was never loaded. This
is also an `AGENTS.md` canon violation: a QA placeholder standing in as final
production identity.

The atlas is now the default (`?graybox=1` keeps the prototype for regression
work). **It loads asynchronously.** Awaiting a ~650 KB texture before the shell
signals READY pushed embedded boot past the parent's 8s bridge timeout and
broke every portal E2E flow; the run now starts on the prototype and swaps to
the atlas the moment it decodes. A failed load leaves the prototype in place
and reports the reason through `dataset.actorArtFallbackReason` — art telemetry
now reports what actually rendered rather than what was requested.

## 3. Combat feedback

- **Health no longer drives transparency.** A dying enemy used to fade toward
  invisible (floor 0.35; boss 0.38), so the highest-priority target was the
  hardest to see and dense fights became overlapping ghosts. Enemies now render
  at full opacity with a health pip under the body; the boss has a dedicated
  screen-space bar with phase tick marks.
- **Kill confirmation**: an expanding ring plus a seeded 8-shard debris fan.
  Corpses fade out instead of hard-deleting mid-frame.
- **Impact sparks**: 4 (8 on crit) seeded spark lines per hit.
- **Muzzle flash** shrinks and brightens with a 4-spoke star instead of growing
  like a smoke puff, and now draws *above* the actor — it used to spawn 28
  units along the aim vector and be occluded by the player when aiming north.
- **Camera shake** was fully dead code: `setCameraShake` was exported and read
  by `worldToScreen`/`screenToGround`, but nothing ever called it. Wired to
  grenade blasts (10), player damage (5), and boss defeat (12), decaying over
  9 ticks, gated on `settings.screenShake && !settings.reduceMotion`.
- **Player damage** now has a bounded full-screen flash (gated on
  `reduceFlash`) and a persistent low-health vignette below 35% health.

## 4. Readability

- Enemy visuals are depth-sorted by screen Y (`sortableChildren` + `zIndex`);
  previously a body standing in front drew behind one standing behind it.
- Enemies face their movement direction. `pose.direction` was resolved and
  passed but never applied, so every enemy faced screen-right permanently and
  a charging bruiser looked identical to a retreating one.
- Telegraphs get a dark contour stroke under every coloured stroke. Several
  archetype tell colours sit within a few points of their own district's
  palette (gas-bomber orange on rugpull-ravine, boss red on liquidation-yard).

## 5. Level design artwork

The ground was a single flat fill per district plus 7 diagonal lines and 5
rings spread over a ~2000x4800 unit region — roughly one faint mark per
screenful. The `materialLayers` named in `DISTRICT_PRODUCTION_MATERIALS`
(packed-earth / relay-traces / signal-pads, etc.) were never drawn at all.

Ground is now built in three screen-clipped, world-locked passes:

1. **Macro tonal patches** — large soft blocks of shifted ground tone so the
   base plane stops reading as one flat colour.
2. **District motif** — an authored pattern per district: relay circuit traces
   with solder nodes (frontier-relay), angular fracture strata
   (rugpull-ravine), flow ripples (liquidity-crossing), concentric root rings
   (hashwood), ore grid with hazard chevrons (mining-camp), diagonal
   margin-call banding (liquidation-yard).
3. **Micro scatter** — fine grain that holds up close in.

All three iterate only the tiles intersecting the visible rect, so cost tracks
screen area rather than world area, and every mark is seeded from its world
cell index — deterministic and locked to the world as the camera moves.

Routes were a flat slab between two hard black borders. They now build up as a
soft shoulder, a worn verge, the surface, a lighter centre wear band, and
world-spaced dashed lane marks.

Raised surfaces (ledges, bridges) drew as translucent panels with a bright
outline, reading as floating glass. They now get a cast shadow, an opaque deck,
a lit top edge, and a shaded front lip so the height change is legible.

Foliage was a row of flat discs; a treeline now has a grounded trunk shadow, a
layered canopy built from three offset lobes, and a lit crown. Structures were
flat polygons; they are now extruded with a cast shadow, camera-facing side
walls, a lit roof plate, and trim, so a building occupies space.

Water was a flat slab with 7 shimmer lines spread over a 4,800-unit river —
about one line every 600px. It now has a depth gradient down the channel,
world-spaced drifting caustic bands clipped to the visible span, seeded caustic
flecks, and lit shorelines.

The edge vignette was drawing a dark fill into an **additive** layer, where
dark *lightens* — it contributed roughly (1,3,4)/255 in the wrong direction and
was effectively invisible while being reported as an active shader. It now has
its own normal-blended layer and draws in four graduated bands.

## Release gates run on this candidate

- `npm run check` — 319 JS modules + 40 Python scripts pass.
- `npm run test:release` — `PASS tests=1662 passed=1610 expected_failures=52`,
  zero unexpected results (+14 tests vs Cycle 004).
- `npm run build` — HMH bundle 951.3 KB region, under the 1,050,000-byte gate.
- `npm run visual:reboot` — 8 scenes, real pixel signatures, tick-pinned,
  baselines committed under `docs/testing/VISUAL_BASELINES/hmh-reboot/`.
- `npm run assets:qa:hmh-reboot` — pass.
- `design:security-audit` 5/5 zero findings; `design:web3-audit` 9/9;
  `repo:health:strict`; `docs:links` — all pass.
- `audit:hmh:network` — four audits, zero failures.
- Cockpit, performance, four hero, portal, and portal-interaction smokes — all
  exit 0.
- `smoke:portal:e2e` — all six implemented flows pass, zero console/page
  errors. Four flows (ranked, wallet reconnect, in-portal game-over, service
  worker) remain explicitly deferred in the harness manifest.
- Chrome and Edge certification — five viewport profiles each, zero errors.
- Deterministic soaks — enemy, director/boss, combat, dash, level-one world,
  projectile fuzz and soak all exit 0.
- Full-resolution desktop and mobile captures inspected by eye at each step.

## Honest assessment of the level art

The world is materially better than it was — it now has tonal variation,
per-district identity, travelled-looking roads, readable elevation, and a real
vignette. It is **not** finished AAA environment art. Everything here is
procedural vector drawing generated at runtime; there are no authored textures,
no props scattered through open ground, no lighting model, and large stretches
of terrain still read as open space. Bringing this to a genuine AAA bar needs
authored art passes (tile/decal sets, prop kits, edge transitions between
districts, baked lighting), which is a content production effort rather than a
render-code change. Recorded as the top item in remaining work.

## Independent review

The staged index was reviewed adversarially before commit. Verdict: **BLOCK**,
with two defects introduced by this cycle:

1. **Hero identity race.** Defaulting the atlas on loaded whichever hero the
   *URL* named (always `lit-commando`, since the portal sends no query string),
   while the portal sends the player's actual selection in the session payload.
   A pre-existing guard then threw on mismatch — from inside the bridge
   `onInit` handler, so `game:ready` was never sent and the parent stranded on
   its 8s timeout. Picking any hero other than Lit Commando either broke the
   run or silently rendered the wrong character, depending on load timing.
   Fixed: the atlas is loaded for the session's actor, re-loaded if a restart
   changes it, stale loads are ignored by token, and the throw is gone.
   Verified across all four heroes in the portal and standalone.
2. **Camera shake fed pointer aim.** Writing `camera.shakeX/Y` meant
   `screenToGround` re-resolved aim against a jittering camera, so a cosmetic
   accessibility setting could change which shots hit — a projection-only
   violation. Fixed by offsetting the render container instead.

Also applied from the review: the visual gate now bounds worst-cell delta and
changed-cell count (mean alone could not see a lost hero sprite), captures are
tick-pinned rather than drifting, and four inaccurate claims in this document
were corrected.

A second review round then found three more issues, all fixed:

3. **The gate's coverage claim was false.** The `hashwood` and `yard` evidence
   spawns framed empty ground — the tree line and the only polygon building sat
   ~1,000px outside the capture, so the new foliage and building-extrusion
   passes were ungated while the document claimed they were covered. The
   evidence spawns were moved (`hashwood` y 2000 -> 900, `yard` y 2400 -> 800)
   and both features are now visibly in frame. `combat-engaged-desktop` was
   also indistinguishable from the opening scene under the gate's own
   thresholds; it now runs with `director=1&boss=1` so it actually gates the
   combat-feedback work.
4. **A failed hero switch left the previous hero on screen.** The optimistic
   `loadedProductionHeroId` write also meant telemetry named the requested
   actor rather than the rendered one. The id is now set inside the success
   path, and a failed switch reverts to the identity-neutral prototype.
5. **The capture raced the async atlas swap.** The harness now waits for
   `dataset.actorArtSource` to settle before screenshotting, so a baseline
   cannot be half prototype and half production hero.

Carried as debt rather than fixed here: route dash marks are not clipped to
the visible span; ground detail draws above roads and water; idle enemies
resolve to direction 0 (east) because `atan2(0,0)` is 0; and the building
side-wall selection is not winding-independent.

## Known debt

- **Level art is improved but not finished** (see above) — authored texture,
  prop, and lighting passes remain.
- The legacy `npm run visual:regression` remains broken for the legacy canvas
  path; `visual:reboot` supersedes it for the shipped runtime. Retiring or
  repointing the legacy harness is unfinished.
- Player death still freezes the hero mid-pose; no death animation.
- Boss phases still render identically apart from the new health bar.
- Melee remains height-locked at ledges (carried from Cycle 004).
- Ledge-base projectile dead zone and sticky low flight across the −24 river
  (carried from Cycle 004).
- Browser retained-memory debt (carried from Cycle 002).

## Evidence

- `docs/testing/VISUAL_BASELINES/hmh-reboot/*.json` (committed baselines)
- `.hermes/evidence/hmh-reboot-visual/current/*.png` (local)
- `.hermes/evidence/hmh-aaa-cycle-005/portal-e2e/*.png` (local)
- `.hermes/evidence/hmh-aaa-cycle-005/edge-certification/report.json` (local)

## Deployment state

- No production change. Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`;
  rollback remains `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`.
- This cycle stops at the branch push. Preview verification requires
  authorized Vercel access, which is not available in this checkout.
