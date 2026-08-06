# Hermes handoff — remaining upgrade program

Date: 2026-08-05 PDT
Author: Claude Fable 5
Recipient: Hermes agent
Branch: `reboot/hmh-aaa-continuous` (T1 implementation head: `d059a2b1`)

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

World props **26 → 61**. Visual scenes **8 → 10**. Tests **1,852 → 1,984**
(expected failures still 51).

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

### The child bundle is nearly full

**1,048,584 B against a 1,050,000 B cap — 1,416 B left.**

This arc consumed the 9.4 KB the program started with. T2 hit it directly: its
placement logic cost 4,451 B against 3,218 B of headroom, and the perf gate
failed at 1,051,172. The cap was not raised. The derivation moved to build time
and the child now fetches a 57 KB asset.

**Consequence: D1 run-stats, S4's pistol tree, M3 rebinding and U9 settings all
add child code and are effectively blocked.** P6 proved that the original
unblocker assumption was wrong: the portal parent and HMH child are separate
esbuild entries.

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

Other budgets are healthy: prop atlas 326,439 / 524,288 (198 KB free), roster
atlases 3.1 MB free, hero atlases 334 KB free (still tight — A12 needs an
explicit budget conversation with the owner).

### The props reproducibility gate is flaky

The authored-props verify **failed once and then passed five consecutive times
on an unchanged scene** — 1 in 6. A byte diff of both render directories after
the failure showed **zero** differing assets.

This is the same structural flakiness that made the enemy-roster exact-byte gate
untenable in Cycle 037 and earned it the ±1 LSB policy. Props were left exact on
the assumption they were stable.

- **Treat a lone props-verify failure as rerun-once** — not as a defect in
  whatever asset you were adding.
- Migrating props to the roster's ±1 LSB policy is existing debt and now has a
  measurement behind it. Worth doing early; it will otherwise waste a cycle.

---

## 3. What to pick up, in order

### Immediate: recover real child headroom, while Wave 4 proceeds

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

### Wave 3 scope is decided

The owner previously chose the **ruined-yard town** direction and subsequently
authorized all remaining waves. Implement W2 as the documented option (a):
convert part of `liquidation-yard` into a ruined neighborhood rather than adding
a seventh district. **A6 town kit** remains its prerequisite and lands first.

---

## 4. Debts carried forward

- **`balanced-boulder` and `driftwood-log`** are in the atlas but held out of
  district dressing. Both need re-concepting, not another iteration. For the
  boulder: wedged in a cleft, or split by a fracture, rather than perched on a
  plinth. The hold-out list is asserted at one entry so it cannot quietly grow.
- **P5 is partially closed.** Camp and water have scenes. The five A1 trees still
  appear in none, and C2's combat feel is covered by unit tests plus a live probe
  rather than a baseline, because the gate captures a paused frame.
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
test:release        1984 / 1933 passed / 51 expected failures   PASS
visual regression   10 scenes                                    PASS
performance         p95 7.0 ms both profiles                     PASS
bundle              1,048,584 / 1,050,000                        PASS (1.4 KB left)
prop atlas          326,439 / 524,288                            PASS
security audit      5/5, 0 findings                              PASS
web3 audit          9/9                                          PASS
portal E2E          all implemented flows                        PASS
browser certify     5 profiles, zero anchor-pixel delta          PASS
network audit       4 clean/warm scenarios, zero errors          PASS
Vercel build        production-shape .vercel/output              PASS
weapon SFX decode   6 cues, peaks < 1.0                          PASS
```

Serve `apps/portal` on 8899 and pass `HMH_REBOOT_ORIGIN`. The Vercel Security
Checkpoint still 403s automated clients against production, so verify production
in a real browser.
