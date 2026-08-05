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
add child code and are effectively blocked.** Two program items unblock them:

- **P6 legacy code triage** — the pre-reboot canvas combat path
  (`#combatCanvas`, `renderCombatMenuActionGrid`, `renderCombatSettingsPanel`)
  and the hidden `#developerBackstage` shell are still shipped.
- **U10 portal modularization** — split the 15.5k-line `main.js` by route and
  delete the dead legacy combat path on the way through.

Until one lands: prefer **asset-shaped work** (costs no bundle bytes), or make
each code slice pay for itself in removals.

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

### Immediate: unblock the code path

**P6 legacy code triage**, then **U10 portal modularization**. Everything in
Waves 4 and 6 is gated behind bundle headroom. Doing these two first is worth
more than any single feature slice.

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

**The shotgun being the worst swarm weapon at mid range is the thing to look at
first.** Its spread has dispersed past the pack by 420 units, so it pays a
reload cost for pellets that miss. This was deliberately NOT tuned — changing
values in the slice that produced the evidence defeats the point. Take it into
S5 with S1's long-run simulation alongside it.

### Wave 3 needs an owner decision first

**W2 (a real town district)** still says *decide scope with the owner before
building*. That has not happened. **A6 town kit** is its prerequisite and is
buildable now without the decision.

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
