# Hermes handoff — remaining upgrade program

Date: 2026-08-06 PDT
Author: Claude Fable 5 + Hermes Agent
Recipient: Hermes agent
Branch: `reboot/hmh-aaa-continuous` (Wave 5 A14 slice head: `dfcd216a`)

Supersedes nothing. The task backlog is still
`2026-08-03-hmh-upgrade-program-hermes-tasks.md` — read it for the full
descriptions. This document says **what is done, what changed underneath you,
and what to pick up next**. The cycle ledger
`2026-08-05-hmh-wave-1-2-fable-ledger.md` has the evidence behind every claim
here.

**Production is Cycle 049 and was NOT promoted.** Everything below is pushed to
the branch, which builds a Vercel Preview only. Promotion is the owner's from
the dashboard.

---

## 0. Read this before you start anything

These are not style notes. Each cost multiple render or debug cycles to find.

### The Blender props pipeline

1. **The render frame clips content below roughly z = 0.15.** A prop composed at
   the ground plane silently loses its lower parts — objects build, the scene
   inspection counts them, nothing appears. Compose low props to START at ~0.16.
   Do **not** fix it by scaling the asset in z; that turned a campfire into an
   obelisk.
2. **`prism_mesh` takes an (x, z) profile and extrudes along Y.** It cannot make
   a round *horizontal* shape — disc profiles render as vertical plates seen
   edge-on. Use a flat faceted `cylinder` for anything genuinely horizontal.
3. **The 55° camera turns Y DEPTH into screen height.** A part with a large Y
   extent projects as a tall band hiding whatever is behind it in Z. Put the
   feature carrying the concept frontmost and shallow.
4. **Small primitives with bevels near their own half-extent collapse to
   nothing** (a 0.062-wide cube with a 0.018 bevel).
5. **Author silhouettes as `prism_mesh` polygons.** Do not assemble rotated
   primitives and compute where the next piece meets — at 20–30° of lean the
   offsets are visibly wrong and pieces detach.
6. **A filled polygon has no holes.** Draw each vine/strand separately.
7. `prism_mesh` caps face **inward**. Harmless under EEVEE; breaks in the
   BLENDER_WORKBENCH enemy pipeline. Guarded by
   `tests/hmh-reboot-prism-mesh-policy.test.mjs`.

### Proportion calibration (h/w), from props that already ship

```
driftwood-log 0.30  FAILURE, held out of dressing
granite-boulder 0.62  ships  <-- the floor everything is measured against
hashwood-stump 0.76   hashwood-pine 0.99   moss-boulder 1.05
hashwood-tree 1.13    reed-cluster 1.33    dead-pine 2.10
```

Nothing new goes below 0.62. A5 added a **span vs upright** split: parts that
carry load across a gap (truss, handrail, rope anchor, deck) are wide by nature
and sit at the 0.62 floor; free-standing parts keep the higher minimums. The
floor is the same for both classes so nothing can be filed as a "span" to
escape it.

The pipeline records `massCentroidY` per asset (vertical centre of the trimmed
silhouette). Use it for variety checks: it separates shapes an aspect ratio
cannot — conifer taper 0.635 vs crown-over-trunk 0.458.

### Gate discipline that repeatedly paid off

- **Measure AND eyeball.** `fern-cluster` passed the height gate at 0.86 while
  rendering as disconnected blobs; `balanced-boulder` measures 1.13 and still
  reads as a mushroom; `scrub-bush` looked fine zoomed at 0.44 and would have
  smeared into the ground in play.
- **A rule that cannot separate the good case from the bad one is not a rule.**
  A mass-centroid "flat decal" check was drafted and removed: `reed-cluster`
  (ships) sits 0.019 from `driftwood-log` (the known failure).
- **Nudge the geometry, not the threshold.** Moving a gate to fit the asset it
  exists to judge is rerunning to green.
- **The visual gate screenshots the canvas only.** It is blind to the whole
  portal DOM, and it captures a *paused* frame so it may never land on an active
  effect. DOM and runtime work needs its own browser check.

---

## 1. What changed underneath you

### Done from the program

| Task | Commit | Note |
|---|---|---|
| P2 heap gate | `fef0dae3` | Forced sync major GC + median-of-7; cap 24 → 16 MB. |
| U11a mock wallet | `7d36a85d` | Labelled on every visible surface; own browser smoke. |
| A2 undergrowth | `19fc79c0` | 6 plants. |
| A3 rock/cliff | `54f3f348` | 6 rocks; `balanced-boulder` held out of dressing. |
| A1 trees gen 2 | `3cfec4c3` | 5 trees; added `massCentroidY` to the pipeline. |
| A4 water | `e6a95ee6` | 6 water props. |
| W1 density | `2cecaf6b` | Dressing 75 → 128, anchor+satellite clustering. |
| A7 + W3 camps | `ff013b60` | 6 camp props, 5 encampments on the arenas. |
| C1 weapon audio | `9d669796` | Per-weapon fire/reload/empty, synthesised in-repo. |
| C6 swarm bench | `530ff899` | Pack clear time, overkill, projectile pressure. |
| P5 visual scenes | `18dffedd` | 8 → 10 scenes; scenes now declare what they gate. |
| C2 combat feel | `1a901a2e` | Per-weapon recoil, directional impact spray. |
| T2 ground decals | `5b1ac494` | 177 marks, baked to a runtime asset. |
| A5 bridge kit | `4938bc21` | 6 parts; span/upright proportion split. |
| T1 terrain patches | `d059a2b1` | 3 named sub-materials per district, blended by a wrapped deterministic mask into the existing six runtime tiles. |
| Wave 3 authored world | `c4680a68` | A6 12-piece town kit, W2 three-block ruined neighborhood, A9 six set-pieces, T4 road materials, P5 12-scene coverage. |
| Wave 5 A14 role profiles | `dfcd216a` | Forkrunner fork-slash and gas-bomber canister-lob anticipation/strike/recovery replace the last shared ordinary-enemy poses. |

Authored-prop manifest **100 assets**. Visual scenes **8 → 12**. Tests
**1,852 → 2,037** (expected failures still 51). The seven-actor enemy roster
holds 1,368 frames in 5,005,462 atlas bytes.

### New pipelines you can reuse

- **`scripts/build-hmh-weapon-sfx.py`** — deterministic SFX synthesis, pure
  Python, no numpy. Output is **WAV not OGG**: libvorbis is not byte-reproducible
  in this ffmpeg build (re-encoding the same input twice differs — the Ogg stream
  serial is not pinned by `-fflags +bitexact`). This is the vehicle for X1/X2.
  Cue peaks carry a **0.78 ceiling**: browsers resample 22.05 kHz to their device
  rate and reconstruction overshoots between samples, so a cue authored at 0.92
  decoded at 1.082 and clipped. `npm run smoke:hmh:weapon-sfx` gates it.
- **`scripts/build-hmh-world-decals.mjs`** — bakes decal placements to an asset.
  The pattern to copy whenever derived data would otherwise cost bundle bytes.
- **`scripts/build-hmh-terrain-tiles.py` patch baking** — each district declares
  three named sub-material recipes. A wrapped FBM selector at periods 2/4/8
  blends those recipes into the district's existing 512px tile, before its
  fringe is derived. The runtime still loads the same 11 files and uses the
  same pooled `TilingSprite` path. Manifest schema 2 records the mask seed,
  periods and palettes; no child JS or request was added.

---

## 2. Two constraints that will bite you

### The child bundle is effectively full

**1,049,944 B against a 1,050,000 B cap — 56 B left after Wave 3.**

The cap was not raised. Wave 3 remained mostly asset- and metadata-shaped, but
its fail-closed atlas validation consumed the remaining safe margin. Any further
child-code slice must recover bytes first and prove the removal behaviorally, or
remain numeric/data-only. Parent refactors do not pay this budget because the
portal parent and HMH child are separate esbuild entries.

- **P6 legacy code triage is complete at `372c7ef9`.** The public
  `#developerBackstage` and `#combatCanvas` markup, parent animation/input roots,
  obsolete legacy browser soak, and conditional Reboot flag were retired. The
  emitted parent fell from 1,253,798 B to 1,090,277 B (163,521 B / 13.0%), while
  the child remained exactly 1,048,584 B.
- **U10 portal modularization is complete at `6b9e1b42`.** Six reviewed slices
  extracted history/deep-link control, shell rendering, app dispatch, profile,
  leaderboard, and cabinet/mode/character/gameplay routes into dependency-
  injected modules. `main.js` fell from 15,540 to 14,501 lines. Because the
  route modules remain intentionally eager, emitted parent JS grew 8,084 B
  (0.741%) to 1,098,361 B; the child remained exactly 1,048,584 B. This is
  source ownership and reviewability, not lazy loading or child headroom.
- **A child-specific bundle triage is now required** before D1/S4/M3/U9 unless
  each slice pays for itself with measured child removals.

Until that lands: prefer **asset-shaped work** (costs no child bundle bytes), or
make each child-code slice pay for itself in measured removals.

Other budgets are healthy: prop atlas 259,679 / 524,288, roster atlases 3.1 MB
free, hero atlases 334 KB free (still tight — A12 needs an explicit budget
conversation with the owner).

### The props reproducibility drift is resolved

Wave 3 reproduced the old one-channel render variance on the A9 set-pieces. The
pipeline now zeros RGB for fully transparent pixels and quantizes every
nontransparent RGB channel with `0xF8` before comparison/publication, while
preserving authored alpha. Blender also renders single-threaded with dithering
disabled. The full 100-asset pipeline and metadata-only verification path both
pass exact reproducibility; do not replace this with a wider image tolerance.

---

## 3. Completed continuation work and next pickup

### Completed platform and balance prerequisites

**P6 legacy code triage is complete at `372c7ef9`.** It removed 813 indexed
lines, reduced emitted parent JS by 163,521 B, and passed 1,987 release tests,
six portal E2E flows with zero page/console errors, four cockpit profiles, five
browser-certification profiles, performance, network, and all ten visual
scenes. **U10 portal modularization is also complete at `6b9e1b42`.** Its six
route slices passed 2,005 release tests, six portal E2E flows, four cockpit
profiles, four network scenarios, direct `/profile`, `/scores`, and Chikun dev-
cabinet interaction, plus exact child-byte verification. Immutable Preview
`dpl_AuFosN2dQ3WYysfWazEpkikqKAe5` is Ready at
`https://lesters-arcade-k97umtc74-justin-agent-projects.vercel.app`; authenticated
fetches covered `/`, `/profile`, `/scores`, `/settings`,
`/play/hard-money-heroes`, and `/games/hard-money-heroes`. The deployed parent
matched the local build after normalizing only esbuild content-hash chunk names;
the deployed child matched raw bytes. A measured child-entry triage is now the
remaining prerequisite for child-code-heavy work. Wave 4 balance work that does
not add child code can proceed; Wave 6 child features remain bundle-gated.

Wave 2 is now complete. T1 landed at `d059a2b1`: six district tiles each bake
three named sub-materials through a deterministic wrapped mask. Regeneration
was byte-identical across consecutive runs; all 10 scenes were inspected and
accepted; bundle bytes and runtime sprite/request counts did not change.

The full gate exposed two pre-existing certification defects, repaired
separately at `1f27add0`: mobile/short-landscape pause actions were below the
initial viewport, and DPR-3 anchor captures needed image decode + compositor
warm-up. The behavioral gates failed before the fixes and pass afterward; no
threshold was weakened.

The first pushed Preview then exposed a clean-clone deployment defect outside
T1: three WO-102 mega-prop runtime winners existed only as ignored local files,
so Vercel correctly failed their disk-existence test. `f14fd833` tracks only the
three selected PNGs, adds exact ignore exceptions, and makes the local test
assert `git ls-files` when Git metadata is present. A staged-tree archive passed
without access to ignored local files.

### Then: Wave 4, which now has its evidence

**C6 is done**, so S1/S5 are unblocked. The swarm benchmark's first finding,
base tier at mid range:

```
launcher-rig     clears 8 in 4.1 s, 4.0 contacts/projectile, 11.8% overkill
auto-miner       clears 4 in 22.5 s, never clears 8
coin-blaster     kills 3 of 4, reserve runs dry
scatter-shotgun  kills 1 of 4, 0.18 contacts/projectile
```

**S1 is complete** at implementation commit `951cb8d9`. The canonical
`npm run design:long-run` report now covers 192 deterministic 30-minute runs:
4 heroes × 4 authoritative weapons × 6 authoritative enemy archetypes × 2
seeds. It reports levels/minute, the choices from each one visible draft,
dead offers, build diversity, expected-hit growth sourced from live combat
math, survivability, and upgrade intervals. The final matrix had 192/192 valid
completed runs, zero dead offers, median 2.0 levels/minute, median 1.605×
expected-hit growth, and a 28-second median upgrade interval; digest
`3289067f`. These are analytical baseline-player results, not a substitute for
the canonical browser durability soak or human balance playtest.

The implementation passed the 2,008-test release gate: 1,957 current passes and
51 separately ledgered expected legacy failures. Syntax, bundle metadata, the
weapon benchmark, and the browser performance smoke passed on an unchanged
rerun after one retained-heap variance failure. Parent output stayed 1,098,361
bytes and the child stayed exactly 1,048,584 bytes. Immutable Preview `dpl_13eBCtQnRDuZbfCViZeN8yHNAxbJ` was
Ready; `/play/hard-money-heroes` returned authenticated HTML and deployed child
SHA-256 `1e815ad88f00b99a5f0c4d60b14b5232c30b83044827399d6662d45a674e1f8e`
matched local raw bytes.

**S5 is complete** at implementation commit `b785ce6f`. It added deterministic
20-slot role weights to all six encounter bands, modest measured stat
corrections, and a non-stacking validator support pulse: nearest non-support
ally target, 1.15x armor for 180 ticks, exact refresh/expiry, and zero direct
player damage. Existing spawn rates, body/threat caps, and attack-token budgets
remain because evidence maps 30/40/60/80/60/120 spawns/minute against measured
weapon medians of 34.24–55 KPM instead of just churning working limits.

The shotgun finding is closed with a range-only change from 320 to 480 pixels;
its original 28-degree spread and all damage/cadence/ammo/reload values remain.
Base mid-range DPS moved 2.4 → 10.8, maxed mid stayed 33.57 below launcher
45.3, and the eight-body swarm clears in 19.567 seconds. The regenerated
192-run matrix digest is `6a6f21c3`: zero invalid runs and dead offers, median
2.033 levels/minute, 1.602x damage growth, and 27-second upgrade intervals.

Focused S5 tests passed 36/36. Release passed 2,012 entries (1,961 current
passes and 51 separately ledgered expected legacy failures), plus syntax,
portal E2E, cockpit, network, and browser performance. Child output is
1,049,934 / 1,050,000 bytes, leaving only 66 bytes; future child-code work must
recover bytes first or remain numeric/data-only. Ready Preview
`dpl_7NkyGHvhTqPYeQUMhEsuYkEYb79L` at
`https://lesters-arcade-b6ekcptjm-justin-agent-projects.vercel.app` served a
raw-identical child with SHA-256
`ddc29efe151c33fe6a746de816526894d466e53133c36d02f8cda2f44563244a`.

**S2 is complete** at implementation commit `fa64070d`. Enemy defeats, the
authored Litecoin token, and no-damage combo milestones now share the child
progression authority, XP multiplier, deterministic thresholds, and fixed-tick
event record. The token awards 160 base XP and retains the ammo refill. Combo
milestones at 5/10/20/30 kills award 120/240/480/900 base XP; actual player
damage and every run reset clear the chain. Normal and boss defeat paths both
participate without changing wallet, settlement, parent bridge, or replay
authority.

The existing `hash-rail-core` atlas slot was rebuilt through its deterministic
Blender owner as a silver/blue `litecoin-token` with a raised mark; the asset ID
and projection-only runtime slot remain stable. Two consecutive pipeline renders
were byte-identical across all 82 unique source frames. Focused S2/art tests
passed 24/24. Release passed 2,015 entries (1,964 current passes and 51 separately
ledgered expected legacy failures), plus syntax, asset QA, all 10 visual scenes,
collectible browser evidence, portal E2E, four cockpit viewports, network, and
performance. The child is 1,049,954 / 1,050,000 bytes, leaving 46 bytes.
Ready Preview `dpl_HC3G4bDDcJkUi3Ct4k6w3R6xpi5r` at
`https://lesters-arcade-bj6ios0n4-justin-agent-projects.vercel.app` served a
raw-identical child with SHA-256
`4db3191c0ca74df928f1b8747039415e7db4a1a8ceab8e9f7bfb3fcc672a5ff3`.

**S4 is complete** at implementation commit `0570fe07`. Three existing authored
run cards now route into the live Coin Blaster tree without adding parallel
progression state: `proof-of-work` advances damage, `hot-wallet` advances
cadence/velocity, and `block-reward` advances reload/magazine. Existing
`precision-ledger` and `hard-fork-rounds` remain the critical-chance and
critical-damage routes. Pistol cadence tiers add projectile speed/range
multipliers `1.10/1.08`, `1.22/1.18`, and `1.30/1.25`; damage tier 2 uses
one-bounce ricochet while tier 3 pierces three targets and bypasses armor;
reload tier 2 gains seeded shock at `12% / 1.5x` knockback, tier 3 carries a
12-round magazine and `18% / 1.75x`, and all three branches maxed unlock the
bounded `25% / 3x` crowd-displacement capstone. Shock derives from weapon seed
plus attack ID, survives the active-projectile copy, and multiplies the existing
collision-aware knockback authority.

S4 validation passed release `2019/1968 + 51`, syntax `336 JS + 49 Python`,
unchanged long-run certification, weapon benchmark `24` static + `48` moving +
`16` swarm rows, visual `10/10`, cockpit, portal E2E, network, and performance.
The maxed pistol measures `46.93` sustained DPS at mid/long range versus base
`6.4`; its eight-enemy pack clears in `10.533 s`. The child is
`1,049,945 / 1,050,000` bytes (`55` bytes headroom). Frozen implementation diff
`d6fd22774a0544b0436dddb58e280f76b3eaa55304d9e80583df38a8252ef4bd`
received exact-digest local review `PASS`. Ready Preview
`dpl_98gnDoAKrznrmu96H3K43BqkSShj` at
`https://lesters-arcade-8ovhhsrs3-justin-agent-projects.vercel.app` served a
raw-identical child with SHA-256
`143082c7b1bcd0e7c525a99b93cd0cc32847c11c4b46b74041e2d888ff6f22c7`;
configured portal and child routes both returned their expected HTML identities.

### Wave 3 is complete

Implementation commit `c4680a68` closes A6, W2, A9, T4 and the current P5
production-scene expansion as one reviewed authored-world slice:

- A6 adds 12 deterministic Blender-authored town modules to the 100-asset prop
  manifest and atlas.
- W2 converts `liquidation-yard` into north-commercial, south-market/fuel and
  east-residential blocks through 18 generated-metadata placements: 7 explicitly
  synchronized to canonical blockers and 11 explicitly visual-only.
- A9 replaces all six procedural landmark presentations with authored set-pieces
  after successful display attachment; canonical collision remains active.
- T4 bakes gravel shoulder, cracked asphalt and dirt-track grammar into the
  existing pooled road material without adding runtime requests.
- P5 expands deterministic visual coverage to 12 desktop/mobile scenes.

The full 100-asset pipeline is reproducible; release passed 2,033 entries (1,982
current passes and 51 ledgered expected failures), syntax passed 336 JS modules
and 49 Python scripts, and asset QA, long-run, weapon, visual, portal, cockpit,
collectible, network and performance gates passed. The frozen implementation
diff `0c507bc1bab1ce56eb723217cb3a8f4ab2a39e5d65c181d51901977053f51e88`
received exact-digest review `PASS` with `BLOCKERS: none`.

Ready Preview `dpl_FFMKT6g7cFZ9u2nMDjRGKfUjN1cw` at
`https://lesters-arcade-3eg52i6rw-justin-agent-projects.vercel.app` returned the
configured portal route `/games/hard-money-heroes/play` and child route
`/hmh-reboot/`. Its emitted child is raw-identical to the reviewed local build:
1,049,944 bytes, SHA-256
`edc08245bc852761ae0cadbb23877e9a78b496c6fb5cba260efade0d05d65929`.
Production and LitVM were not touched.

### Wave 5 A14 role-profile slice is complete

Implementation commit `dfcd216a` removes the final two shared ordinary-enemy
animation profiles without changing simulation, timing, damage, collision or
runtime JavaScript:

- `forkrunner-quick-fork-slash-v1` adds a low crossed-fork anticipation, fast
  cross-body strike, follow-through and recovery.
- `gas-bomber-canister-lob-v1` adds a canister-braced overhand wind-up, release,
  torso follow-through and recovery.
- The enemy pipeline now rounds visible RGB to the nearest step of 8 (maximum
  authored change 4/255), zeros invisible RGB and preserves alpha. This replaced
  neither source art nor alpha authority; it closes measured cold-render RGB
  jitter that a floor mask made worse at bin boundaries.

The full seven-actor pipeline rebuilt 1,368 frames twice with zero duplicates,
zero tolerated frames and byte-exact packaged artifacts. The 80 affected
tell/attack frames had no alpha component smaller than 93 pixels; native and live
desktop/mobile evidence passed. Release passed 2,037 entries (1,986 current
passes and 51 ledgered expected failures), syntax passed 336 JS and 49 Python,
and the full asset, long-run, weapon, 12-scene visual, portal, cockpit,
collectible, selector, browser-certification, network and performance chain
passed. Frozen implementation diff
`b39d6b379d9fb6a5d4fe5f7c30331d4ab7648d697a5db3749a5fa8816378c9b4`
received exact review `PASS` with `BLOCKERS: none`.

Ready Preview `dpl_9mgEXxwbo4Ltvo7usqpBEkY66WZd` at
`https://lesters-arcade-7ne0uxy5n-justin-agent-projects.vercel.app` served both
configured HTML routes and a raw-identical 1,049,944-byte child with SHA-256
`edc08245bc852761ae0cadbb23877e9a78b496c6fb5cba260efade0d05d65929`.
Production and LitVM were not touched.

### Next: continue Wave 5 character presentation

Proceed with A13 hero animation, remaining A14 damage-state/full-role polish and
A15 Liquidator phase-transition presentation as projection-only work using
existing atlas budgets. **A12 256px hero escalation remains a separate owner
budget gate**: do not raise the hero atlas budget or start the full-resolution
batch without explicit approval.

---

## 4. Debts carried forward

- **`balanced-boulder` and `driftwood-log`** are in the atlas but held out of
  district dressing. Both need re-concepting, not another iteration. For the
  boulder: wedged in a cleft, or split by a fracture, rather than perched on a
  plinth. The hold-out list is asserted at one entry so it cannot quietly grow.
- **P5 now covers 12 production scenes**, including camp, water, foliage, all six
  district landmarks, combat and three ruined-neighborhood views. Transient C2
  recoil/impact timing remains live-probe evidence rather than a paused baseline.
- **A14 is not complete.** All six ordinary roles now own distinct attack
  profiles, but explicit damage-state art and the gas-bomber's separate thrown
  projectile presentation remain. Treat `dfcd216a` as the role-animation slice,
  not final enemy-wave certification.
- **Boot long tasks are real:** 546–905 ms desktop, ~390 ms mobile, sitting right
  at the budget of two. Standing evidence for **M6 chunked navgrid**. Remember the
  naive deferral into `initializeSession` was tried and reverted — it dropped a
  touch pointer-up on iphone-13-portrait. The fix must slice the build across
  idle time *before* input binds.
- **Audio beyond weapons:** X1 (footsteps by surface, level-up, boss phase cues)
  and X2 (volume categories, ducking) remain. The synth pipeline is the vehicle.
- **Standalone defaults `screenShake: false`** (it is the evidence-capture path;
  stable baselines need no jitter) while the portal path defaults it on. Verify
  runtime effects through the portal configuration or you will measure zero on a
  correctly-wired feature. Both defaults are asserted.

---

## 5. Ground rules that still bind

Unchanged from the program, and all five were load-bearing this arc:

1. **Determinism.** Every shipped atlas/tile regenerates byte-for-byte from
   repo-owned source. No hand-painting, no one-off generation.
2. **Projection-only vs simulation.** Art, VFX, audio, animation and LOD may
   never change collision, damage, AI, spawning, RNG, progression or results.
3. **Budgets.** See §2. Code work comes with size accounting.
4. **Cycle discipline.** One bounded slice → RED tests observed failing →
   implement → gates **sequentially** (never two browser smokes at once) →
   inspect visual evidence by eye → exact-index adversarial review → re-review
   after restaging → commit implementation and closeout separately → push.
5. **`SETTLEMENT_LIVE=false`.** No contract deploy, transaction or settlement
   change without a separate explicit HALT approval.

One more, learned the hard way here: **`git fetch` at session start and refuse
to commit if HEAD is behind origin.** Two agents share this branch.

---

## 6. Current gate state

```
test:release        2037 / 1986 passed / 51 expected failures    PASS
visual regression   12 scenes, zero delta                        PASS
performance         p95 7.1 ms desktop / 7.0 ms mobile           PASS
bundle              1,049,944 / 1,050,000                        PASS (56 B left)
prop atlas          259,679 / 524,288                            PASS
authored pipeline   100/100 frames, reproducible                 PASS
enemy roster        1,368 frames / 5,005,462 B, reproducible     PASS
portal E2E          all implemented flows                        PASS
cockpit             desktop/tablet/mobile/landscape              PASS
network audit       4 clean/warm scenarios, zero errors          PASS
staged security     secrets/paths/eval/wallet/deploy: 0 hits     PASS
exact review        b39d6b37...6378c9b4, BLOCKERS: none          PASS
Vercel Preview      dpl_9mgEXxwbo4Ltvo7usqpBEkY66WZd            READY
```

Serve `apps/portal` on 8899 and pass `HMH_REBOOT_ORIGIN`. The Vercel Security
Checkpoint still 403s automated clients against production, so verify production
in a real browser.
