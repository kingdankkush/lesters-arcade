# HMH AAA Continuous Improvement Cycle 073

Date: `2026-09-04`
Status: `LIVE · VERIFIED`
Branch: `fable/hmh-cycle-073-feel-and-world`
Baseline: `104b01dc` (Cycle 072 closeout, production `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w`)

## Scope: relit enemies, combat feel, height that reads, a denser world, and the platform seams

1. **The enemy roster renders under the hero EEVEE rig, and the gate that blocked it in
   Cycle 072 is fixed rather than widened (P-4, projection-only).** The Cycle 072 two-run
   gate could not pass under any renderer that jitters by one LSB: `canonicalize_rendered_rgb`
   (nearest-8, offset 4) ran before the in-place save, so a one-LSB raw flip on a bucket edge
   (123 to 124) became exactly 8 (120 to 128) and `frames_within_lsb_tolerance` (limit 1)
   rejected it. On the preserved Cycle 072 passes all 71 eight-step drifts were adjacent
   multiples of 8 and the 13 deltas of 16 to 255 were one LSB in premultiplied space at alpha
   1 to 23. The quantiser also posterised EEVEE's gradients to 32 levels per channel. It is
   deleted. The two cold passes are now compared premultiplied and unquantised per frame
   against the manifest `reproducibilityBudget` {8 changed visible pixels, 2 per channel, 32
   total}, the hero pilot's form, published as `bounded-premultiplied-rgba-v1`. The byte-exact
   320x320 Blender output is preserved beside the runtime frames, and a machine-readable drift
   report (premultiplied histogram, alpha band of every drifted subpixel, per-actor counts,
   straight-RGBA supersampled histogram) is written on every verify run. Two full verify runs
   passed: run 1 observed 4 / 2 / 5 against 8 / 2 / 32 (80 of 1,368 frames drifting, histogram
   {1: 142, 2: 5}); the shipped run 2 observed 4 / 2 / 4 (58 frames, {1: 109, 2: 4}); a warm
   control rendering the same `.blend` twice measured 0 / 0 / 0. Exposure stays at the hero's
   -0.45, chosen on a measured Rec.709 ladder: shipped idle-south means are bagholder-rusher
   108.3, forkrunner 119.6, gas-bomber 110.5, validator-cultist 108.6, whale-enforcer 142.4,
   liquidator-agent 86.0, the-liquidator 86.7, against a hero envelope of lower-body 97.1 to
   114.8 and torso 128.6 to 143.2; zero blown pixels. Asset QA: boss atlas 2,025,648 of the
   2,097,152 cap (96.6 percent), roster total 7,793,762 of 10,485,760. The visual gate gained a
   per-enemy crop check for the three scenes with roster enemies on camera, because the 32x18
   frame signature measured the whole engine change at 1 to 3 cells while the crop check
   measures it at 40 to 72 cells and reads 0 between two independent EEVEE captures.
2. **Per-weapon combat VFX identity and surface-typed impacts (V-1, V-2, projection-only).**
   Every projectile weapon previously fired the same four-spoke flash with a hue swap and every
   hit drew the same orange ring. New `weapon-vfx.mjs` carries a frozen identity table for all
   eight weapon ids (pistol star and brass casing, shotgun cone and red shotshell with eight
   pellet slugs, minigun bar cleared before the next round, rail gun expanding ring and violet
   lance with after-image, launcher halo and smoke puff; Lightning Ledger, Burner and Forked
   Standard keep their own event renderers), pure resolvers keyed on simulation tick and event
   fields with the runtime's FNV-1a `deterministicUnit`, and `classifyImpactSurface` reading
   the authored ground kind, district terrain material and cover blocker kind from frozen world
   data (flesh / dirt / rock / metal / water). Cover hits, range-expiry ground impacts, casings
   and target hits are emitted from existing simulation results and drawn as surface-typed
   bursts from a frame-scoped two-bank sprite pool capped at 192 with a dropped counter. Under
   `reduceFlash` the white core becomes the weapon colour, core alpha is clamped to 0.30, halo
   to 0.22, radius to 12 px, and no spokes are emitted. Bundle: 7,921 bytes minified for the
   module against a 6,000-byte target; recorded honestly rather than trimmed into a stub.
3. **Grenade feedback set (V-3, projection-only).** A grenade was a 6 px circle with a
   hardcoded fuse ring, one blast circle for both classes, discarded bounce reports and a flat
   shake of 10. New `grenade-feedback.mjs` resolves everything from simulation output: a
   two-class table keyed on `mode`, blast shake = class shake x clamp(radius / 150, 1, 1.2)
   (hand stays at the documented ceiling of 10), a fuse blink whose period halves twice toward
   detonation over an always-on core ring so reduce-flash users keep a steady cue, an arc
   shadow that hands the contact-shadow pool a class footprint and a capped lift, bounce dust
   puffs fed from the simulation's own bounce reports through a separate 32-slot queue, a
   seeded radial fragment fan tiered like impact sparks and budgeted at 64 per frame, and a
   shockwave ring eased to exactly radius x zoom so it lands on the danger boundary the player
   was shown. Only two classes exist at runtime (the `shaped-charge` capstone is never plumbed
   into `throwGrenade`, so every live blast is 150); the set scales off `detonation.radius` so
   a later simulation plumb inherits it.
4. **Level-up cards read their tier and play from keyboard or pad; the pause menu owns an SFX
   slider (U-4, U-5).** `upgrade-card-presentation.mjs` derives a render-side tier from frozen
   catalog fields (mastery / core / weapon / capstone mapped to the four rarity tokens; 3 / 9 /
   9 / 3 over the 24 ids) and an icon asset id whose PNG exists on disk for all 24 upgrades;
   twelve weapon-branch ids previously requested a 404 background on every card. Cards gain a
   tier band, tier chip, hotkey chip and `aria-keyshortcuts`; `Digit1` / `Digit2`, arrows and
   Enter arm and pick with a visible ring, and a gamepad poll runs only while the panel is
   open. Input-layer note (not a simulation change): `applySelectedUpgrade` now resets input
   after the pick so a held digit cannot leak a weapon swap into the first resumed tick. The
   pause menu gains a child-owned SFX volume slider on the existing `game:settings` channel
   with the pinned `PAUSE_SETTING_KEYS` byte-identical and **no save-schema change**; the
   portal persists it in player-settings version 1, standalone it is session-only. Known edge:
   the parent projects `sfxVolume` 0 while `audio.sfxEnabled` is false.
5. **Height reads as height: ledge fronts, ramps and cliff rock (W-11 projection, W-5
   partial).** `heightToScreenY` is 1, so the camera-facing front of a raised surface is
   exactly `(groundZ - baseZ) x zoom` px tall, and nothing drew in that band: the 64 px
   ravine-overlook wall and the 48 px mining-loader-deck wall were bare ground, the ramp tile
   overpainted two triangles of ground, and cliffs were a lifted capsule with an accent stripe.
   Ledges now draw a face trapezoid from the south lip to the projected foot, an opaque
   V-clamped `rock-face` strip (new bakery overlay profile, two-run reproducible) stretched
   across exactly that height with a district tint, ground-contact bands below the foot, the
   scree moved from the lip to the foot line, and a thin lit cap. Ramps tile through a
   per-sprite polygon mask with five grade bands and a rock flank. Cliff capsules draw as a
   grounded dark wall body with a lifted crown, ridge shading toward the light, seeded fracture
   lines, strata, a lit lip and the rock-face strip along any camera-facing run. Fences, rails,
   canopies, machinery and containers are byte-identical; every Cycle 072 pin is unchanged.
6. **Prop density and spawn-point encampments (W-7, W-8, projection-only).** Measured on the
   Cycle 072 layout: 128 dressing placements, of which 15 stood inside a collision-blocker
   footprint, 3 in the deep river, 8 inside a set-piece breathing ring and 5 on loop-route
   corridors, and none of the twelve spawn points had a camp. The generator now imports the
   world contract read-only and refuses ground within 24 units of any blocker or route edge,
   deep water, arena floors, 300 units of a set-piece, 80 of a pickup or town placement, and
   any camp ring; the layout is a pure function of the world constant `0x484d4807` (never the
   run seed). Density 128 to 200 dressing placements in 70 clusters; twelve spawn-point camps
   join the five arena camps (17 total, 84 placements), each a ring of 5 to 6 district-kit
   props with deterministic jitter. The five arena camps are byte-identical to `104b01dc` and
   pinned as a snapshot. Total authored sprites 218 to 354.
7. **Platform: source-model LFS policy, bounded anchor warm-up, navgrid readiness (P-5,
   harness, K-7).** `.gitattributes` routes `apps/hmh-reboot/assets/source/models/**` for
   glb / fbx / bin / png / jpg / jpeg through Git LFS; `npm run assets:hmh:models:lfs-check`
   proves rules, `check-attr`, `git lfs ls-files`, pointer blobs, a 40 MB cap and a 2048 px
   texture cap, with a `--clean-clone` ritual for the first committed model (today:
   `trackedModels=0, rules=6/6, lfs=git-lfs/3.7.1`). The certification anchor now warms until
   two consecutive screenshots hash identically (cap 6) and records the warm-up per profile.
   The navgrid builds in time-budgeted idle slices with a readiness authority asserted before
   the first simulation step; measured boot wall time rose about 20 percent in headless Chrome
   (desktop 653 to 696 ms, iPhone 13 portrait 578 to 702 ms) because the 4 ms budget roughly
   doubles the yield count; the mobile-controls smoke that caught the Cycle 046 regression
   passed 4 / 4 after the change.
8. **Stray-line defect fixed in production art (found during this cycle's inspection).**
   Pixi 8 `Graphics.arc()` connects from the path's current point; after `clear()` and fills
   that point is the screen origin, so an `arc()` without a leading `moveTo()` drew a fan of
   accent-coloured lines from the top-left corner of the screen to every hashwood canopy
   crown and landmark beacon. This shipped in Cycle 072 and earlier (the hashwood-camp
   baseline was byte-identical) and was visible to players without any debug flag. The two
   world-art sites now route through the existing `arcFrom()` helper and the three new combat
   flash arcs anchor explicitly; `tests/hmh-reboot-graphics-arc-origin.test.mjs` guards every
   `.arc(` in the render modules. Hashwood scenes changed by 21 and 12 cells (under the 24
   threshold) and were re-accepted so the baselines encode the fixed state.

## Replay note

No simulation change. Items 1 to 8 are projection-only or platform; the navgrid readiness
authority gates the first step but does not alter any step's result; the upgrade-pick input
reset changes the input stream only after a pick and same-seed replays of the same action
stream are unchanged.

## Gates

- `npm run check`: `381` JavaScript modules + `52` Python scripts
- `npm run test:release`: `2,429` evaluated, `2,378` passing, `51` accepted legacy failures,
  `0` unexpected (Cycle 072 was `2,339 / 2,288 / 51 / 0`; +90 tests, all passing)
- `node build.mjs`: entry `444,168` + vendor `575,891` = combined `1,020,059 / 1,050,000`;
  headroom `29,941`; delta vs Cycle 072 `+34,103`, all in the entry
- `npm run visual:reboot`: 7 of 12 scenes changed by intent on the first pass (ravine,
  mining, hashwood-foliage, yard, market, residential, crossing), every one inspected at full
  resolution, then re-accepted after the arc fix moved the two hashwood scenes; new enemy-crop
  check active on frontier-relay desktop / mobile and combat-engaged
- `npm run certify:hmh:browser`: five profiles PASS, `changedPixels: 0` / `maxChannelDelta: 0`
  on every anchor
- `npm run smoke:hmh:performance`: PASS; desktop p95 `8.4 ms` p99 `8.6 ms`; mobile p95
  `8.1 ms` p99 `8.5 ms`; zero long tasks (Cycle 072 was 7.1 / 7.1; the rise tracks the
  354-sprite authored set and stays far inside the 34 ms budget)
- `npm run smoke:hmh:mobile-controls`: `devices=4 failures=0`
- combat browser smoke and `smoke:hmh:collectibles`: PASS, zero errors
- `assets:qa:hmh-reboot`, `assets:hmh:enemy-roster:verify` (two passes), `assets:hmh:terrain:verify`,
  `docs:links`, `contracts:check`, `design:tokens`, `design:security-audit`,
  `design:third-party-security`, `design:web3-audit`, `design:web3-live`: PASS / PARTIAL-as-expected

### Certification flake recorded honestly

The first `certify:hmh:browser` run failed on `mobile-landscape` with anchor passes differing
across `9,946` pixels at `maxChannelDelta` 23, confined to antialiased DOM edges (HUD chip
top edge, rail bottom edge, minimap frame, status card edge) and spread across the whole
frame; the canvas interior was identical. Four consecutive fresh contexts through a minimal
probe hashed identically, and the full five-profile run afterwards measured zero changed
pixels everywhere. The new bounded warm-up cannot help here because each pass is internally
stable; the difference is between contexts under GPU memory pressure after the dsf-3 portrait
pass. Recorded rather than silently re-run. Hardening candidate for the next platform slice:
relaunch the browser per profile so each anchor pair starts from the same GPU state.

## Cache contract

- Portal token: `hmh-aaa-cycle-073-feel-and-world`
- Service worker: `lesters-arcade-v26-hmh-feel-and-world`

## Boundaries

`SETTLEMENT_LIVE=false` unchanged. No contract, chain, address, operator, verifier, wallet,
transaction or real-fund behaviour changed. No paid generation or external asset upload. The
portal still owns music, profiles, leaderboards, sessions and settlement; the child still owns
only input, simulation and projection.

## Exact review and release identity

- Runtime commits: `d71cfe51` (integration) and `f764ac75` (Vercel-image portability: Pillow 12
  `get_flattened_data` replaced by `getdata`; LFS tests pass vacuously without a work tree)
  on `fable/hmh-cycle-073-feel-and-world`
- Integration staged patch SHA-256: `1e2fe8fcf1e7f4f7516527e2fcbc68b41ca423d6555cc782e5322587094862c7`
- First preview `dpl_Gn7…` lineage failed its Vercel build on six new tests that pass locally
  (CPython 3.12 + Pillow 11.3 vs the host's 3.11 + 12.3; stripped `.git`); reproduced in a
  local uv venv and fixed in `f764ac75`
- Preview: `dpl_CTf15k2GHret4CBXHBS2QVuDzxfL` — <https://lesters-arcade-anaccwidf-justin-agent-projects.vercel.app> (behind Vercel Authentication; verified on the alias)
- Production: `dpl_EQekrTvicPuJ95Qzfn33D7s8Z4dw` — <https://lesters-arcade-2er8kpl2y-justin-agent-projects.vercel.app>
- Public alias: <https://lestersarcade.io>
- Immediate rollback retained: `dpl_FMqS2vbPBq1Na12m33ER9K7Ho27w` — <https://lesters-arcade-qkk7kcv56-justin-agent-projects.vercel.app> (Cycle 072)

### Hosted artifact proof (production, byte-identical to the local build)

- `sw.js`: `b3ee76f51e0716c67038c4c4…` (3,709 bytes)
- `dist/main.js`: `969516db92addb3fa4b870b4…` (1,134,738 bytes, unchanged from Cycle 072)
- `dist/hmh-reboot/game.js`: `bd9ddfc4481e4b5a9d7199d3…` (444,168 bytes)
- `dist/chunks/hmh-pixi.js`: `d8bc671038603d2f523ef2b7…` (575,891 bytes, unchanged)
- `styles.css`: `941bece09b287a9cd9741df0…` (148,941 bytes, unchanged)

Live HTML contains `hmh-aaa-cycle-073-feel-and-world` and no Cycle 072 token; the live
service worker contains `lesters-arcade-v26-hmh-feel-and-world`; `npm run docs:production`
matches.

### Hosted verification

- Five-profile browser certification against `https://lestersarcade.io`: PASS, every anchor
  `changedPixels: 0` / `maxChannelDelta: 0`, every warm-up stable in 2 screenshots
- Production network/console audit: PASS, 4 of 4 scenarios with zero failures
- Live desktop capture inspected by eye after real keyboard input

