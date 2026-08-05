# Cycle ledger — upgrade program Waves 1 and 2 (complete)

Date: 2026-08-05 PDT
Author: Claude Fable 5 + Hermes Agent
Branch: `reboot/hmh-aaa-continuous` (T1 implementation head: `d059a2b1`)
Program: `docs/handoffs/2026-08-03-hmh-upgrade-program-hermes-tasks.md`

Fifteen program tasks, each RED-tested first, gated, reviewed against the exact
staged index, and committed separately. T1 also exposed one prerequisite
certification-repair commit. **Production was not promoted** — that remains the
owner's from the Vercel dashboard. Pushing the branch creates a Preview only.

---

## What shipped

| Slice | Commit | Summary |
|---|---|---|
| P2 heap gate | `fef0dae3` | Forced synchronous major GC + median-of-7. Swing ~70 MB → ~7 MB; cap 24 MB → 16 MB. |
| U11a mock wallet | `7d36a85d` | Simulated wallet labelled on every visible surface; own browser smoke. |
| A2 undergrowth | `19fc79c0` | 6 plant props + prism_mesh normals guard. |
| A3 rock/cliff | `54f3f348` | 6 rock props; `balanced-boulder` held out of dressing. |
| A1 trees gen 2 | `3cfec4c3` | 5 tree props + `massCentroidY` silhouette descriptor in the pipeline. |
| A4 water | `e6a95ee6` | 6 water props; the crossing now reads as water. |
| W1 density | `2cecaf6b` | Dressing 75 → 128, anchor-plus-satellite clustering. |
| A7 + W3 camps | `ff013b60` | 6 camp props, 5 encampments ringing the encounter arenas. |
| C1 weapon audio | `9d669796` | Per-weapon fire/reload/empty, synthesised in-repo, byte-exact. |
| C6 swarm bench | `530ff899` | Pack clear time, overkill and projectile pressure. |
| P5 visual scenes | `18dffedd` | Camp + water scenes; scenes now declare what they gate. |
| C2 combat feel | `1a901a2e` | Per-weapon recoil weight, directional impact spray. |
| T2 ground decals | `5b1ac494` | 177 contract-anchored marks, baked to a runtime asset. |
| A5 bridge kit | `4938bc21` | 6 bridge parts; span/upright proportion split. |
| T1 terrain patches | `d059a2b1` | Three named sub-materials per district, wrapped deterministic patch masks, same runtime tile/request count. |

World-prop library: **26 → 61**. Prop atlas 178,089 B → 326,439 B against a
524,288 B cap. Visual scenes 8 → 10. Test count 1,852 → **1,984**, expected
failures still 51.

## Non-art pipelines added

**Synthesised SFX** (`scripts/build-hmh-weapon-sfx.py`). Every weapon shared
one sourced weapon-fire.ogg. The existing SFX are CC0 packs that cannot be
regenerated from repo source, so six new cues are synthesised instead: pure
Python DSP, fixed xorshift32 PRNG, byte-exact. Output is **WAV, not OGG**, and
that was measured rather than assumed — libvorbis is not byte-reproducible in
this ffmpeg build (re-encoding the same input twice differs, because the Ogg
stream serial is not pinned by `-fflags +bitexact`). 71 KB for six cues is
cheaper than the codec dependency.

**Swarm benchmark** (`docs/qa/hmh-weapon-benchmark.json`, schema 3). Packs of
4 and 8 with overkill tracked explicitly. Base tier at mid range:
launcher-rig clears 8 in 4.1 s at 4.0 contacts/projectile; auto-miner never
clears 8; coin-blaster runs its reserve dry at 3 kills; **scatter-shotgun kills
1 of 4** because its spread has dispersed past the pack by 420 units. That last
one is counter-intuitive and is a finding for S5 — not tuned here, because
changing values in the slice that produced the evidence defeats the point.

**Terrain sub-material patch bake** (`scripts/build-hmh-terrain-tiles.py`).
Each of the six district materials now owns three named palette/relief recipes.
A wrapped FBM field at periods 2/4/8 smoothly selects low/base/high variants,
then the composite is saved over the same district tile and used to derive the
existing fringe. Manifest schema 2 records `districtPatches`, mask seeds and
variant palettes. This is projection-only and bundle-neutral: 11 runtime tile
requests before and after, with no atlas or renderer code change.

Two consecutive generator runs produced byte-identical district tiles, fringes
and manifest. The focused terrain/world set passed 25/25. All 10 runtime scenes
were inspected before baseline acceptance, then reran with zero changed cells
(the animated crossing-water scene had max channel delta 1). Performance ended
at p95 7.0 ms desktop/mobile and the child bundle stayed 1,048,584 B.

**Certification prerequisites** (`1f27add0`). The T1 full gate found two older
failures outside terrain: mobile portrait and short landscape placed all three
pause actions below the initial viewport, and fresh DPR-3 GPU contexts could
differ by one channel step before their first screenshot. The fixes keep the
44px actions in a fixed footer while the dense pause content scrolls, and wait
for images/fonts plus warm the compositor before the strict anchor. The
original thresholds remain unchanged. Cockpit passes four profiles and release
certification passes five with zero anchor-pixel delta.

**Clean-clone deployment prerequisite** (`f14fd833`). The first Vercel Preview
failed the existing WO-102 runtime-asset test even though local builds passed.
Root cause: the three selected mega-prop PNGs were covered by the processed-
candidate ignore rule and had never been tracked; local ignored copies masked
the omission. The repair adds exact exceptions for those three winners, tracks
only them, and asserts local Git tracking in the existing test. A clean archive
of the staged Git tree contained exactly three processed winners and passed the
focused runtime test before the full release suite reran.

---

## Pipeline facts learned the hard way

These cost multiple render cycles each. They are the most valuable thing in
this document.

1. **The render frame clips content below roughly z = 0.15.** A prop composed
   at the ground plane loses its lower parts silently — the objects build, the
   scene inspection counts them, and they simply do not appear. Compose low
   props to START at ~0.16. This ate three passes on `campfire-ring` and
   `bedroll-cluster`.
2. **`prism_mesh` takes an (x, z) profile and extrudes along Y.** It cannot
   express a round *horizontal* shape. Disc profiles come out as vertical
   plates seen edge-on. For anything genuinely horizontal (lily pads,
   platforms) use a flat faceted `cylinder`.
3. **The 55° camera turns Y DEPTH into screen height.** A part with a large Y
   extent projects as a tall band that hides whatever sits behind it in Z.
   This is why `balanced-boulder` had no visible pinch and `rock-shelf`'s
   strata merged. Put the feature that carries the concept frontmost and
   shallow, and step everything else back in Y.
4. **Small primitives with bevels near their own half-extent collapse.** A
   0.062-wide cube with a 0.018 bevel renders as nothing.
5. **Author silhouettes as polygons; do not assemble rotated primitives and
   compute where the next piece should meet.** At 20-30° of lean the
   small-angle offsets are visibly wrong and pieces detach. Four passes of A2
   were lost to this before switching to `prism_mesh` profiles.
6. **A filled polygon has no holes.** A curtain of vines drawn as one polygon
   renders as a slab; the gaps between strands are most of what makes foliage
   read. Draw each strand.

## Gate lessons

- **Measure and eyeball; neither alone is enough.** `fern-cluster` passed the
  height gate at 0.86 h/w while rendering as disconnected floating blobs.
  `balanced-boulder` measures 1.13 and still reads as a mushroom. Conversely
  `scrub-bush` looked fine in a zoomed crop at 0.44 h/w and would have smeared
  into the ground band in play.
- **A rule that cannot separate the good case from the bad one is not a rule.**
  A mass-centroid "flat decal" check was drafted for A4 and removed: the
  reference set showed `reed-cluster` (ships, reads well) at 0.687 and
  `driftwood-log` (the documented failure) at 0.706 — 0.019 apart. Any
  threshold rejecting the failure also rejected the good prop. Tuning it to fit
  this wave's assets would have been rerunning to green.
- **Nudge the geometry, not the threshold.** Three camp props landed just under
  minimums declared before authoring; the shapes moved, the gate did not.
- **The visual gate screenshots the canvas only.** It is blind to the entire
  portal DOM. U11a shipped with its own browser smoke
  (`npm run smoke:portal:simulated-wallet`), which earned itself twice: it
  caught a disclosure rendered into a 0×0 legacy panel, and a chain-guard line
  still reading "Wallet connected" under a "Simulated Wallet" headline.

## Calibration reference (shipped nature props, h/w)

```
driftwood-log 0.30 (FAILURE, held out)   granite-boulder 0.62 (ships)
hashwood-stump 0.76   hashwood-pine 0.99   moss-boulder 1.05
hashwood-tree 1.13    reed-cluster 1.33    dead-pine 2.10
```

Nothing new was allowed below 0.55.

---

## Gate lessons, continued

- **Verify the runtime path, not just the module.** Per-weapon recoil measured
  exactly zero in a browser probe while being correctly wired, because
  standalone hardcodes `screenShake: false` (it is the evidence-capture path;
  stable baselines need no jitter) while the portal path defaults it on. Both
  defaults are now asserted.
- **Decode audio in a real browser.** scatter-shotgun decoded at peak 1.082
  because the browser resamples 22.05 kHz to its device rate and reconstruction
  overshoots between samples. Nothing static would have caught the clipping;
  cue peaks now carry a 0.78 ceiling and `smoke:hmh:weapon-sfx` gates it.
- **Make every scene declare what it gates.** Adding camp and water scenes hit
  a harness rule requiring three visible landmarks in EVERY scene. Weakening it
  for the new scenes would have produced scenes asserting nothing about their
  own subject. They now require visible authored props instead.

## The bundle budget is now the binding constraint

**Child JS bundle: 1,048,584 B against a 1,050,000 B cap — 1,416 B left.**

This arc consumed the 9.4 KB the program started with. T2 hit the wall
directly: its placement logic cost 4,451 B against 3,218 B of headroom, and
the perf gate failed at 1,051,172. Raising the cap was not on the table, and
unifying the code did not recover enough, so the derivation moved to build
time and the child now fetches a 57 KB asset. Bundle work, not art work, is
what that pattern buys.

**Practical consequence: further child code slices are effectively blocked.**
D1 run-stats, S4's pistol tree, M3 rebinding and U9 settings all add child
code. Two things would unblock them, both already in the program:

- **P6 legacy code triage** — the pre-reboot canvas combat path and the hidden
  `#developerBackstage` shell are still shipped.
- **U10 portal modularization** — 15.5k-line `main.js` split by route, with the
  dead legacy combat path deleted on the way through.

Until one of those lands, prefer asset-shaped work (which costs no bundle
bytes) or accept that each code slice must pay for itself in removals.

## The props reproducibility gate is flaky, and now there is evidence

The authored-props verify FAILED once and then passed five consecutive times
on an unchanged scene: **1 failure in 6 runs**. Nothing in the scene changed
between them, and a byte diff of the two render directories after the failure
showed zero differing assets.

This is the same structural flakiness that made the enemy-roster exact-byte
gate untenable in Cycle 037 and earned it the ±1 LSB policy. The props
pipeline was left exact on the assumption that it was stable. That assumption
now has a counter-example.

Two consequences:
- A lone props-verify failure should be treated as rerun-once, like the heap
  gate was before P2 fixed it — **not** as a reproducibility defect in whatever
  asset was being added at the time.
- Migrating props to the roster's ±1 LSB policy was already open debt. It now
  has a measurement behind it rather than a suspicion.

## Standing debts

- **`balanced-boulder` and `driftwood-log` are in the atlas but held out of
  district dressing.** Both need re-concepting, not another iteration. For the
  boulder: wedged in a cleft, or split by a fracture, rather than perched on a
  plinth. The hold-out list is asserted at one entry so it cannot quietly grow.
- **P5 partially closed.** Camp and water now have pinned scenes (10 total).
  The A1 trees still do not appear in any scene, and the C2 combat-feel work is
  covered by unit tests and a live probe rather than by a baseline, because the
  gate captures a paused frame that may never land on an active shake.
- **Boot long tasks are real:** 546–905 ms desktop, ~390 ms mobile, sitting
  right at the budget of two. Standing evidence for M6 (chunked navgrid).
- **Wave 2 is complete.** A5, T2 and T1 are closed with deterministic generated
  assets and 10-scene visual evidence. The next program move is P6 legacy-code
  triage, followed by U10 portal modularization, to recover bundle headroom.
- **Unblocked and waiting:** S1 long-run balance simulation and S5 enemy band
  rebalance now have the swarm evidence they were missing. The shotgun's
  mid-range swarm result is the first thing to look at.
- **Audio still thin beyond weapons:** X1 (footsteps by surface, level-up,
  boss phase cues) and X2 (volume categories, ducking) remain. The synth
  pipeline added here is the obvious vehicle for them.

## Verification note

Production was NOT promoted and remains the owner's call from the Vercel
dashboard. The Vercel Security Checkpoint still 403s automated clients, so
live verification has to happen in a real browser regardless. T1's final gate
also passed the 1,984-test release suite, syntax, generated assets, contract
structure, security, Web3 audit, four-scenario network audit, six-flow portal
E2E, browser certification, cockpit smoke, and a wrapped Windows production-
shape `vercel build`. `SETTLEMENT_LIVE` was not changed.
