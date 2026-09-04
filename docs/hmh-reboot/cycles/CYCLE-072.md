# HMH AAA Continuous Improvement Cycle 072

Date: `2026-09-03`
Status: `LIVE · VERIFIED`
Branch: `fable/hmh-cycle-072-visual-facelift`
Baseline: `dc6fd00a` (Cycle 071 live lineage `5046c0f3` plus the committed 2026-09-02 review)

## Scope: the gameworld facelift, a real HUD, grounded actors, and the external-model pipeline

1. **Terrain rebuilt as lit micro-terrain, and the tile grid removed (W-1, W-3, W-4).**
   The owner's standing complaint ("still single color, no texture") was structural,
   not a tuning problem. `TERRAIN_TILE_REPEAT_WORLD` was `66.56`, so each 512-texel
   tile covered 66.56 screen pixels at zoom 1: 7.7x oversampled, no mipmaps, every
   baked feature collapsed into salt-and-pepper grain, and the repeat itself was
   visible. Measured before the change, 2-D autocorrelation of ground luminance
   peaked at lag 67 px in six of the twelve visual scenes (r up to 0.72). The repeat
   is now `399.36` with mipmaps enabled at all three registry sites, chosen from a
   four-way A/B (66.56 / 133.12 / 266.24 / 399.36) captured across all twelve scenes
   and inspected at 100% and 3x. The bakery moved to `hmh-terrain-tiles-v3`
   (schemaVersion 3, `litMicroTerrain`): numpy-vectorised wrapped value noise,
   deterministic scatter stamps (pebbles and grass tufts) written into the height
   field *before* shading so they receive real Lambert and specular response,
   multi-scale wrapped ambient occlusion, and a directional cast-shadow term. Three
   new edge overlays (`road-shoulder`, `shore-band`, `scree-skirt`) are baked as
   512x128 RGBA strips with `addressV: clamp-to-edge` and placed by a pooled generic
   strip placer. Roads lost the two `0x130f13` outline strokes and the dark verge
   that made them read as a map overlay; the flat route slab survives only as the
   no-tile fallback. A new `--verify-reproducible` mode bakes twice and compares
   per-image pixel SHA-256 and per-file PNG SHA-256: `assets:hmh:terrain:verify`
   reports 11 materials, 3 overlays, `reproducibleVerified: true`,
   `seamlessVerified: true`, 3,741,231 bytes total, 159.2 s wall.
2. **The developer telemetry HUD is gone, and the cockpit is a real HUD (U-2, U-3).**
   The top-centre Pixi string (`PISTOL 8/8 // DASH READY // FRAG 3 // HP 100 // E 2
   // K 0`), the `HMH // FORKED FRONTIER` kicker, `#hmhRebootStatus` and
   `#hmhRebootSession` now render only under `?debugHud=1`. The strip is gated with
   `label.visible` so `computeCombatStatusLayout`, `combatStatusX/Y` and
   `label.position.set(...)` stay pinned; the DOM gate is
   `html:not([data-debug-hud="1"]) [data-debug-only] { display: none !important; }`,
   and every gated node keeps byte-identical `textContent` because all readers use
   `textContent`, which resolves on hidden elements. `#hmhAdapterStatus` is
   deliberately not gated so the L-1a simulated-wallet disclosure survives. The
   `.hmh-run-rail` cockpit keeps its class, rect and every pinned id and becomes a
   real HUD: hero crest, health bar with quarter pips and a severity band, score,
   level, combo, kills, XP, a weapon card covering all eight weapons (ammo pips up
   to twelve, a bar variant for the 120/180-round drum and the 1,200+ fuel tank, six
   channel cells for Lightning Ledger, an ammo-free state for Forked Standard) with
   a reload and cooldown ring, an eight-slot arsenal strip badging only the four real
   `Digit1-4` hotkeys, grenade pips, a dash cooldown ring around the existing
   `#hmhRebootDashStatus` output, power-up timer chips, and the boss bar as a docked
   DOM row. `getWeaponReadabilityStatus` gained no fields, so its deepEqual pin is
   green; ring progress is derived render-side.
3. **Phone HUD containment (follow-up inside the same cycle).** The first cockpit
   build occupied 256 px of a 390x844 viewport (30%) and hid the hero. CSS-only
   compaction inside the existing narrow and landscape media queries brought the
   measured `.hmh-run-rail` height to `115 px` portrait (13.6% of viewport) and
   `86 px` landscape, desktop unchanged at `119 px`. Overlap against the status
   card, the minimap and all five touch controls measured `0 px^2` on four profiles,
   including a synthetic worst case (boss bar up, 128-hit combo, seven-digit score,
   bar-mode weapon with a state label, both power-up chips lit, all eight slots
   owned) at 168 px portrait.
4. **Ground contact shadows (W-14, projection-only).** Roster enemies, the roster
   boss, death corpses, authored props and pickups no longer float. New
   `contact-shadows.mjs` provides a pure `resolveContactShadow`, a generated soft
   blob texture and a pooled sprite layer capped at 160, inserted inside the single
   existing `world.addChild(...)` call between the world art and the actors so a
   body always occludes a shadow behind it. Footprints are tagged where displays are
   created, never on simulation entities and never inside the roster atlas module.
   The hero's baked shadow layer and the vector-fallback enemies keep their existing
   shadows and are excluded by test.
5. **The encounter director no longer reads the render camera (K-1, SIMULATION).**
   `stepEncounterDirector`'s spawn-exclusion rectangle was derived from
   `app.screen` and the render-ticker-smoothed camera centre, so the same seed
   produced different spawn sequences on different viewports and frame timings
   (half-extents 720x450 desktop, 960x400 ultrawide, 195x422 mobile portrait). It is
   now `DIRECTOR_VIEW_HALF_EXTENTS` = a frozen 720x450 logical rectangle centred on
   the simulated actor, exported with `directorViewBounds(center)` from
   `encounter-director.mjs`. The `camera` parameter name and the `on-camera` reason
   string are unchanged so the eleven pinned director tests still hold.
6. **The external-model pipeline exists (P-1, P-2, P-3).** Committed GLB/FBX actors
   can now enter the deterministic sprite path. `import-hmh-external-model.py`
   imports glTF/FBX with the operator arguments verified on Blender 5.1.2,
   normalises height on a parent Empty (never applied scale, which would not scale
   an animated armature's location curves), sets a ground-contact origin and facing,
   splits the skinned mesh at the waist by vertex-group weight majority into the
   `lower-body` and `torso-head` layer objects sharing one armature, creates and
   parents `weapon_socket`, mutes NLA tracks, strips stray object-level animation,
   and applies a shared `HMH_LookDev_v1` toon node group driven by the shared light
   rig. Both exporters gained a `clipActions` branch that assigns the action and
   slot and samples frames evenly across its range without the rotation-mode override
   that would freeze imported quaternion poses. A throwaway skinned fixture with
   procedural weights proves the path end to end under `.tmp` and is never shipped.
   Both actor manifests are bumped to schema v2 with optional per-actor `sourceModel`,
   `sourceSha256`, `frameSize`, `clipActions` and `lookDev` keys placed beside, never
   inside, the pinned `clips` objects. Documented in
   `docs/hmh-reboot/EXTERNAL-MODEL-PIPELINE.md`.

## Not shipped in this cycle, with evidence

**P-4 (enemy roster Workbench to EEVEE) is deliberately excluded.** The render
contract was written and works, but the two-run reproducibility gate failed on a
cold scene rebuild: `68 / 1,368` frames drift (4.97%), 86 subpixels total, at most 4
per frame, delta histogram `{1: 2, 8: 71, 16: 5, 32: 1, 80: 1, 88: 4, 128: 1, 255: 1}`.
78 of the 86 sit above `alphaThreshold` 8 and 17 are fully opaque, so this is not
confined to the invisible fringe. Per actor: gas-bomber 24, forkrunner 17,
bagholder-rusher 8, liquidator-agent 8, the-liquidator 5, validator-cultist 3,
whale-enforcer 3. Pinning TAA samples, dither, shadow jitter, raytracing and the
shadow ray/step/resolution knobs did not remove it. This is the same failure that
made Cycle 035 choose Workbench. The tolerance was **not** widened and the art was
**not** shipped. A separate finding worth acting on: with the EEVEE atlases live the
12-scene visual regression stayed inside tolerance, which means the 32x18 luminance
signature does not gate enemy sprite lighting. Next step for whoever picks this up:
snapshot the pre-normalisation supersampled frames of both passes and measure the raw
delta; if it is within 1-2 LSB, replace the step-8 quantiser with the hero pipeline's
budget form (`maxChangedVisiblePixels` 8 / `maxChannelDelta` 2 /
`maxTotalChannelDelta` 32, which Lester observes at 0/0/0) under its own RED test.

## Replay note

Item 5 is a simulation change; pre-072 replays diverge under 072 playback.
Determinism within the build is unchanged and is covered by a new same-seed test
that runs two zoom and viewport settings to an identical spawn sequence while the
legacy formula provably diverges. Behaviour changes by profile: mobile portrait and
landscape and tablet gain a larger exclusion rectangle (they previously spawned
enemies closer than intended); ultrawide loses horizontal band (960 to 720); desktop
1440x900 changes only by centring on the simulated actor rather than the smoothed
render camera, which also removes the pre-existing frame-rate dependence.

## Gates

- `npm run check`: `368` JavaScript modules + `52` Python scripts
- `npm run test:release`: `2,339` evaluated, `2,288` passing, `51` accepted legacy
  failures, `0` unexpected (Cycle 071 was `2,283 / 2,232 / 51 / 0`; the delta is the
  56 new tests, all passing)
- `node build.mjs`: HMH entry `410,065` + Pixi vendor `575,891` = combined initial JS
  `985,956 / 1,050,000`; headroom `64,044`; delta vs Cycle 071 `+14,728`, all in the
  entry, vendor byte-identical
- `npm run visual:reboot`: 12/12 scenes changed by intent, zero errors, every
  per-scene `requires` satisfied; all twelve inspected at full resolution before
  `visual:reboot:accept`; the accepted baselines are committed with this change
- `npm run certify:hmh:browser`: five profiles PASS with `changedPixels: 0` and
  `maxChannelDelta: 0` anchors on every profile
- `npm run smoke:hmh:performance`: PASS; bundle `410,065 / 1,050,000`; desktop p95
  `7.1 ms` p99 `7.5 ms`; mobile p95 `7.1 ms` p99 `7.1 ms`; zero long tasks (Cycle 071
  was 7.1 / 7.0)
- `npm run smoke:hmh:mobile-controls`: `devices=4 failures=0`
- combat browser smoke and `npm run smoke:hmh:collectibles`: PASS, zero errors
- `npm run assets:qa:hmh-reboot`, `docs:links`, `contracts:check`, `design:tokens`,
  `design:security-audit`, `design:third-party-security`, `design:web3-audit`,
  `design:web3-live`: PASS / PARTIAL-as-expected

### Certification flake recorded honestly

The first `certify:hmh:browser` run failed on `mobile-portrait` with the anchor
passes differing across `28,886` pixels at `maxChannelDelta` 19. It reproduced
exactly once more through a minimal probe, then stopped reproducing: four consecutive
probes and the full five-profile run afterwards all measured zero changed pixels. The
changed pixels were confined to the antialiased edges of DOM chrome (panel borders,
button outlines, touch-stick rings, minimap frame); the canvas interior was
byte-identical. The harness already documents this class of cold-context
rasterisation difference and warms with one throwaway screenshot; the richer HUD has
more antialiased edges to be affected by it. This is a harness-hardening item, not a
runtime defect: strengthen the mobile warm-up before the anchor, the same way the
heap gate was medianised in N-1. Recorded rather than silently re-run.

## Cache contract

- Portal token: `hmh-aaa-cycle-072-visual-facelift`
- Service worker: `lesters-arcade-v25-hmh-visual-facelift`

## Boundaries

`SETTLEMENT_LIVE=false` unchanged. No contract, chain, address, operator, verifier,
wallet, transaction, or real-fund behaviour changed. No paid generation or external
asset upload. Parent authority over wallets, profiles, leaderboards, analytics,
sessions and settlement is unchanged; the child still owns only input, simulation and
projection.

## Exact review and release identity

- Runtime commit: `414fc3049` on `fable/hmh-cycle-072-visual-facelift`
- Frozen staged patch SHA-256: `16c34b984f26dd73353fa171d307f8530aabcae46c2ccb0379b30185ac2cad13`
- Preview: `dpl_Gn7CJuYMMEvw6Kyak7yfGEu31v9u` — <https://lesters-arcade-oh1d0gdhu-justin-agent-projects.vercel.app>
  (preview byte verification was not possible: preview deployments sit behind
  Vercel Authentication and return 302 to automated clients; verification was
  performed on the public production alias instead)
- Production: `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w` — <https://lesters-arcade-qkk7kcv56-justin-agent-projects.vercel.app>
- Public alias: <https://lestersarcade.io>
- Immediate rollback retained: `dpl_5HbBQf21BFoPzucGvijjcefygcDS` — <https://lesters-arcade-57ws1fm9l-justin-agent-projects.vercel.app>, confirmed `Ready`

### Hosted artifact proof (production, byte-identical to the local build)

- `sw.js`: `bef4737dbea4a14b11f6f336…` (3,710 bytes)
- `dist/main.js`: `969516db92addb3fa4b870b4…` (1,134,738 bytes)
- `dist/hmh-reboot/game.js`: `df26e190d968bc9a06b45d46…` (410,065 bytes)
- `dist/chunks/hmh-pixi.js`: `d8bc671038603d2f523ef2b7…` (575,891 bytes)
- `styles.css`: `941bece09b287a9cd9741df0…` (148,941 bytes)

Live HTML contains `hmh-aaa-cycle-072-visual-facelift` and no Cycle 071 token; the
live service worker contains `lesters-arcade-v25-hmh-visual-facelift`.

### Hosted verification

- Five-profile browser certification against `https://lestersarcade.io`: PASS on
  desktop, ultrawide, tablet landscape, mobile portrait and mobile landscape, every
  anchor `changedPixels: 0` / `maxChannelDelta: 0`, live runs advanced ticks under
  real keyboard input and pause froze the authoritative tick
- Production network/console audit: PASS, zero failures
- `npm run docs:production`: live service-worker marker matches the README
- Live desktop capture inspected by eye: lit granular terrain with no visible tile
  grid, roads without the black outline, enemies carrying contact shadows, and the
  HUD showing a live reload state

The embedded in-app browser pane reports `document.visibilityState === 'hidden'`
even when fronted, so the runtime correctly defers boot there; that pane remains
unusable for gameplay verification, as recorded in Cycle 049.

