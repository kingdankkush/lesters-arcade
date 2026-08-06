# Cycle ledger — upgrade program through Wave 5 A13 hero motion

Date: 2026-08-06 PDT
Author: Claude Fable 5 + Hermes Agent
Branch: `reboot/hmh-aaa-continuous` (Wave 5 A13 hero-motion head: `e0c9aa20`)
Program: `docs/handoffs/2026-08-03-hmh-upgrade-program-hermes-tasks.md`

The original fifteen Wave 1/2 tasks and the subsequent Wave 3/4 and bounded
Wave 5 slices were
RED-tested first, gated, reviewed against exact staged indices, and committed as
bounded implementation slices. T1 also exposed one prerequisite certification-
repair commit. **Production was not promoted** — that remains the owner's from
the Vercel dashboard. Pushing the branch creates a Preview only.

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
| Wave 3 authored world | `c4680a68` | A6 town kit, W2 ruined neighborhood, A9 set-pieces, T4 roads, P5 12-scene coverage. |
| Wave 5 A14 role profiles | `dfcd216a` | Role-native fork-slash and canister-lob anticipation/strike/recovery replace the last two shared ordinary-enemy pose profiles. |
| Wave 5 A15 phase beat | `4ee4f0fb` | A bounded 18%/45-tick Liquidator scale pulse marks the three authored phase entries. |
| Wave 5 A13 hero motion | `e0c9aa20` | Four manifest-owned hero motion profiles create distinct action weight inside the existing atlas/runtime contract. |

Authored-prop manifest: **100 assets**. Prop atlas 259,679 B against a 524,288 B
cap. Visual scenes 8 → 12. Test count 1,852 → **2,042**, expected failures still
51. Enemy roster: 7 actors, 1,368 frames and 5,005,462 atlas bytes.

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

**Current child JS bundle: 1,050,000 B against a 1,050,000 B cap — zero headroom.**

At the original Wave 1/2 close the child measured 1,048,584 B with 1,416 B left.
That arc had already consumed the 9.4 KB the program started with. T2 hit the wall
directly: its placement logic cost 4,451 B against 3,218 B of headroom, and
the perf gate failed at 1,051,172. Raising the cap was not on the table, and
unifying the code did not recover enough, so the derivation moved to build
time and the child fetched a 57 KB asset. Subsequent Wave 3/4 work left 56 B;
asset-shaped A14 kept that byte-identical, and A15 consumed those final bytes.
Bundle work, not art work, is what that pattern buys.

**Practical consequence: further child code slices are effectively blocked.**
D1 run-stats, S4's pistol tree, M3 rebinding and U9 settings all add child
code. P6 closed at `372c7ef9`, retiring the public backstage/canvas runtime and
its obsolete soak. It reduced the emitted parent from 1,253,798 B to 1,090,277
B, but the separately-built child stayed exactly 1,048,584 B. That measurement
disproves the earlier assumption that P6/U10 parent cleanup would recover child
headroom.

U10 is complete at `6b9e1b42`. Six dependency-injected route slices reduced
`main.js` from 15,540 to 14,501 lines and passed 2,005 release tests plus portal,
cockpit, network, profile, scores, and Chikun interaction checks. The eager
parent grew 8,084 B to 1,098,361 B, while the child stayed exactly 1,048,584 B.
Actual child-code work still requires child-specific bundle triage, or each
slice must pay for itself in measured child removals. Prefer asset-shaped work
until then.

## The props reproducibility drift is resolved

Wave 3 reproduced the old one-channel render variance while authoring A9. The
pipeline now zeros RGB for fully transparent pixels and quantizes every
nontransparent RGB channel with `0xF8` before exact comparison/publication,
while preserving authored alpha. It also renders single-threaded and disables
Blender dithering. The full 100-asset pipeline and metadata-only reproducibility
path pass. A broad comparison tolerance was not introduced.

## Wave 3 authored-world closeout

Implementation commit `c4680a68` closes A6/W2/A9/T4 and expands P5:

- 12 deterministic town modules and six authored district set-pieces;
- a three-block liquidation-yard neighborhood with 18 metadata-driven
  placements, including 7 canonical-blocker and 11 visual-only policies;
- deterministic road shoulder/crack/track grammar through the existing pooled
  terrain request shape;
- safe landmark fallback handoff and dedicated town-blocker rendering;
- 12 accepted desktop/mobile visual scenes.

The release gate passed 2,033 entries (1,982 current passes plus 51 ledgered
expected failures), syntax passed 336 JS and 49 Python files, and the full asset,
long-run, weapon, visual, portal, cockpit, collectible, network and performance
chain passed. The child is 1,049,944 / 1,050,000 bytes. Exact staged review
`0c507bc1bab1ce56eb723217cb3a8f4ab2a39e5d65c181d51901977053f51e88`
returned `PASS` with `BLOCKERS: none`.

Ready Preview `dpl_FFMKT6g7cFZ9u2nMDjRGKfUjN1cw` at
`https://lesters-arcade-3eg52i6rw-justin-agent-projects.vercel.app` served both
configured HTML routes and a raw-identical 1,049,944-byte child with SHA-256
`edc08245bc852761ae0cadbb23877e9a78b496c6fb5cba260efade0d05d65929`.
Production and LitVM remained untouched.

## Wave 5 A14 role-profile slice

Implementation commit `dfcd216a` adds explicit
`forkrunner-quick-fork-slash-v1` and `gas-bomber-canister-lob-v1` authored pose
branches. Both provide distinct anticipation, strike/follow-through and recovery
without changing AI, attack timing, damage, collision, spawning or runtime JS.

The first cold rebuild exposed four RGB-only backend drifts across three actors:
2–8 pixels per frame, alpha unchanged and maximum channel delta 1–3. A 5-bit
floor mask was measured and rejected because boundary values became full-step
mismatches. The accepted pipeline rounds visible RGB to the nearest step 8
(maximum change 4/255), zeros invisible RGB and preserves alpha. Applied to both
cold passes before hashes and packaging, it made all 1,368 decoded frames and
every generated artifact exact. Final metrics report zero duplicate frames, zero
tolerance exceptions and 5,005,462 total atlas bytes.

All 80 affected tell/attack frames passed 8-connected alpha audit with a minimum
93-pixel component. Native and live desktop/mobile review found no detached art,
proxy identity, cropping or doubled fallback body. Release `2037/1986 + 51`,
syntax `336 JS + 49 Python`, asset QA, long-run, weapon, visual, portal, cockpit,
collectible, selector, browser, network and performance gates passed. Exact
staged review `b39d6b379d9fb6a5d4fe5f7c30331d4ab7648d697a5db3749a5fa8816378c9b4`
returned `PASS` with `BLOCKERS: none`.

Ready Preview `dpl_9mgEXxwbo4Ltvo7usqpBEkY66WZd` at
`https://lesters-arcade-7ne0uxy5n-justin-agent-projects.vercel.app` served both
configured HTML routes and a raw-identical 1,049,944-byte child with SHA-256
`edc08245bc852761ae0cadbb23877e9a78b496c6fb5cba260efade0d05d65929`.
Production and LitVM remained untouched. This is an A14 role-animation slice,
not final A14 completion.

## Wave 5 A15 phase-transition slice

Implementation commit `4ee4f0fb` projects each authored Liquidator phase entry
through a scale pulse from 1.18 to 1.0 over 45 ticks. The elapsed-tick gate ends
at 2,445, preventing false pulses in the endless total-liquidation cadence at
3,600 and 4,800. The compact optional-start guard remains null-safe: undefined
start arithmetic yields `NaN`, the comparison is false and later dereferences
short-circuit. No alpha, attack-plan, simulation, damage, collision, health,
spawn, RNG or settlement authority changed.

Release `2039/1988 + 51`, syntax `336 JS + 49 Python`, long-run, weapon, asset,
12-scene visual, portal, cockpit, collectible, character, selector, five-profile
browser, network and performance gates passed. Desktop and portrait evidence
captured real market-open → margin-call boundaries with production boss art. The
final portrait actor/boss distance was about 127 versus an 84-unit separation
radius, and the pulsed boss remained fully visible between HUD and controls.
Exact staged review
`4d022a070cc2a293ccd562fb2282c8227f178d7a6bd11880f7e6c0a897cc9ebd`
returned parser-valid `PASS` with `BLOCKERS: none`.

The child now exactly fills the fixed cap: 1,050,000 / 1,050,000 bytes, SHA-256
`2e4691e1fad6f4e986c5f67c9e4d46b6e5ee931b5c88e9587d63a0995e19a21c`.
Ready Preview `dpl_2iCh6oDxowShj5p7Zjpv1QZp2Ltw` at
`https://lesters-arcade-94ho56zhj-justin-agent-projects.vercel.app` served both
configured HTML routes and that raw-identical child. Production and LitVM were
not touched. This is an A15 transition slice, not final A15 completion.

## Wave 5 A13 hero-motion slice

Implementation commit `e0c9aa20` introduces four bounded animation profiles in
the authoritative hero manifest: heavy/planted Lit Commando, agile Lit Valkyrie,
scrappy Lester and disciplined Lilly. The Blender exporter consumes profile
scales for idle breath, run stride/lift, pistol recoil, hurt, dash, melee,
grenade and lateral death direction. Profile provenance is copied exactly into
atlas metadata and generated metrics. Hero clip counts, 648-frame coverage,
source resolution, atlas dimensions, runtime mappings, gameplay bodies,
collision, weapons, movement, combat, progression and unlock authority are
unchanged; no child runtime source file changed.

The shared source/publish pipeline regenerated all four heroes twice with zero
changed visible pixels, maximum channel delta zero and total delta zero. The
editable `.blend` probe found four canonical actor IDs, 14 bones, a valid
`weapon_socket` and zero external libraries. All 2,592 frames passed an
8-connected alpha audit with no component of eight pixels or fewer and a
51-pixel minimum. Native comparison/contact sheets and fresh live desktop/mobile
evidence received independent visual `PASS`.

Hero atlases total 12,279,348 / 12,582,912 bytes (303,564 bytes headroom); the
selector is 361,863 / 524,288 bytes. Release `2042/1991 + 51`, syntax
`336 JS + 49 Python`, long-run, weapon, production-asset, 12-scene visual,
portal, cockpit, collectible, four-hero, enemy-detail, selector, five-profile
browser, network and performance gates passed. The child remained byte-identical
at the fixed 1,050,000-byte cap, SHA-256
`2e4691e1fad6f4e986c5f67c9e4d46b6e5ee931b5c88e9587d63a0995e19a21c`.
Exact staged text/authority and visual reviews for digest
`ec50ea8adbe53978c4e3a295a0c5b3f6e68445b64014cf41e268de9fc343fcc1`
both returned `PASS` with `BLOCKERS: none`.

GitHub deployment `5778932319` binds the exact implementation commit to Ready
Preview `dpl_ERKAoPvn3RZFGg8sMpweUKwLjJr5` at
`https://lesters-arcade-oeu9s4zoq-justin-agent-projects.vercel.app`.
Authenticated verification covered `/games/hard-money-heroes/play`,
`/hmh-reboot/`, the raw-identical child, four raw-identical hero atlases with
matching profile metadata and the raw-identical selector JSON/PNG. Production
and LitVM remained untouched. This is an A13 hero-motion slice; character-select
presentation still remains before final A13 completion.

## Standing debts

- **`balanced-boulder` and `driftwood-log` are in the atlas but held out of
  district dressing.** Both need re-concepting, not another iteration. For the
  boulder: wedged in a cleft, or split by a fracture, rather than perched on a
  plinth. The hold-out list is asserted at one entry so it cannot quietly grow.
- **P5 now has 12 pinned production scenes.** Camp, water, foliage, district
  landmarks, combat and three neighborhood views are represented. Transient C2
  timing remains unit/live-probe evidence rather than a paused baseline.
- **Boot long tasks are real:** 546–905 ms desktop, ~390 ms mobile, sitting
  right at the budget of two. Standing evidence for M6 (chunked navgrid).
- **Wave 2, P6, and U10 are complete.** A5, T2 and T1 are closed with
  deterministic generated assets and 10-scene visual evidence; P6 retired the
  legacy parent runtime; U10 established route ownership through the Ready
  immutable Preview `dpl_AuFosN2dQ3WYysfWazEpkikqKAe5`. Child-specific bundle
  triage remains separate and still gates child-code-heavy tasks.
- **Wave 4 complete — S1, S5, S2, and S4:** S5 commit `b785ce6f` adds weighted band
  mixes, measured stat corrections, a bounded validator armor pulse, and a
  range-only shotgun correction. Final matrix digest `6a6f21c3`; base shotgun
  mid-range DPS is 10.8 and its eight-body clear is 19.567 seconds. Preview
  `dpl_7NkyGHvhTqPYeQUMhEsuYkEYb79L` is Ready with a raw-identical 1,049,934-byte
  child. S2 commit `fa64070d` adds a reproducible authored Litecoin token worth
  160 base XP and fixed-tick 5/10/20/30 no-damage combo milestones worth
  120/240/480/900 base XP through one multiplier/threshold authority. Damage and
  run resets clear the combo. Release/browser/art gates passed; Ready Preview
  `dpl_HC3G4bDDcJkUi3Ct4k6w3R6xpi5r` served a raw-identical 1,049,954-byte child.
  S4 commit `0570fe07` makes the three-branch Coin Blaster tree live through
  authored run ranks; adds existing crit routes, speed/range, 12-round magazine,
  ricochet-to-pierce progression, seeded shock, and the bounded all-branch crowd
  capstone. Release `2019/1968 + 51`, benchmark `24/48/16`, visual/browser gates,
  and exact review `d6fd2277...ef4bd` passed. Ready Preview
  `dpl_98gnDoAKrznrmu96H3K43BqkSShj` served a raw-identical 1,049,945-byte child
  with SHA-256 `143082c7...f22c7`; that slice had 55 bytes of child headroom.
- **Wave 3 complete — A6, W2, A9, T4 and P5:** implementation commit `c4680a68`,
  exact reviewed diff `0c507bc1...f51e88`, 100 deterministic authored props,
  12 visual scenes and Ready Preview `dpl_FFMKT6g7cFZ9u2nMDjRGKfUjN1cw`.
- **A14 remains partial after `dfcd216a`.** All six ordinary enemy roles now own
  distinct attack profiles. Explicit damage-state art and the gas-bomber's
  separate thrown-projectile presentation remain before final A14 certification.
- **A15 remains partial after `4ee4f0fb`.** Phase art, telegraphs and a visible
  transition beat are live. Phase-change audio remains in X1, and the child has
  zero byte headroom for additional runtime presentation.
- **A13 remains partial after `e0c9aa20`.** All four heroes now have distinct
  deterministic action weight inside the existing animation contract. Remaining
  character-select presentation polish must stay within the established selector
  and hero-atlas budgets unless the owner explicitly approves A12 escalation.
- **Audio still thin beyond weapons:** X1 (footsteps by surface, level-up,
  boss phase cues) and X2 (volume categories, ducking) remain. The synth
  pipeline added here is the obvious vehicle for them.

## Verification note

Production was NOT promoted and remains the owner's call from the Vercel
dashboard. The latest protected Preview was verified with authenticated read-only
fetches against `/games/hard-money-heroes/play` and `/hmh-reboot/`, plus exact
child and generated-hero/selector byte comparison. The implementation passed the
2,042-entry release suite (1,991 current passes and 51 expected failures), syntax,
generated assets, long-run/weapon evidence, 12-scene visual regression,
four-scenario network audit, portal E2E, cockpit, collectibles, all four hero
smokes, selector, five-profile browser certification and performance.
`SETTLEMENT_LIVE` and LitVM were not changed.
