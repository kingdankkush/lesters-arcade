# WORLD W1b / W2a — authored kit and local navigation checkpoint

## Result and limits

The first 20,000 × 14,000 authored ten-area layout passes the actual conservative
navigation and geometry checks. A separate local Free preview lets a human
survivor walk its real walls, ramps and connecting roads with native keyboard or
touch controls. This is a usable navigation/kit prototype, **not the finished
ten-area level design or owner greybox acceptance**.

The current central courts, corner masses and landmark approaches repeat a bare
kit. Routes are wide and frequently empty; complement partitions leave thin
visible outlines. The next design pass must give each area distinct flow,
landmark approaches, combat sightlines and optional routes at actual human scale.
No production area art starts before the owner's playable greybox approval.

Combat, objectives, boss courts, cover poses and climbing/drop controls are
staged markers. Only existing movement/circle collision/elevation behavior is
used here. The new data are absent from the normal game build. No official run,
map rules version, verifier, session, score, bridge, save or Ranked path is mounted.

## Authored geometry

Ten connected 4,000 × 4,000 areas, fourteen roads and ninety-eight declared sites
occupy one continuous map. The kit uses the unchanged real collision/elevation
constructors. Visible polygon footprints match physical blockers; the non-water
closed complement is filled with visible physical masses rather than changing
navigation masks or relabelling it water. Four outer guards cover rounded lattice
centres beyond the exact perimeter.

The floor-complement helper rejects non-simple stars, duplicate/zero-length edges
and twice-wound inputs independently of local convex-turn tests. Its numerical
tolerance is 1e-8. It accepts at most 128 floor polygons with 3–8 vertices each,
and limits output to 8,192 pieces. The kit's optional arbitrary raw polygon input
still delegates convex validation to the old collision helper; rejection of every
raw self-intersecting kit input is a separately prepared contract slice before
broader authoring. Current generated/authored polygons pass the actual layout.

Arena checks bind exits to the particular court and prove centre-to-exit player
sweeps. Short and tall usable cover must actually lie in/adjacent to that court,
match the physical piece, have a clear stand-off and a real centre approach.
Far-away cover or a reachable exit borrowed from another court cannot pass.

Road sweeps check the actual radius-24 centre route and continuous ground. They
do not prove the entire nominal road width. Court floor is sampled on a 120-unit
lattice, not a proof of every point. Declared sightlines and optional sites are
checked; complete combat/spawn/AI behavior, pacing and owner playtest remain open.

## Checks actually completed

The final W1b gate passes **18/18 focused** and the same **18/18** in an exact
twelve-file copy with empty PATH, no .git and no node_modules. All seven old
world/navigation/main helpers retain their frozen source hashes. Actual unfiltered
navigation reports **37,268/77,589 walkable cells (48.0325819%)**, 334 × 234 cells,
and **zero walkable rounded centres outside the perimeter**. All ninety-eight
declared sites have directed outward and return connectivity. All ten area
entrance, protected spawn, sampled court, staged sightline and fourteen road
centre-route checks pass, with zero issues.

The layout contains 613 visible pieces: 479 complement masses, four outer guards
and 130 area-kit pieces; 573 have blockers. These counts are diagnostics of this
layout, not frame-time, residency or device measurements. River–Woods retains a
**38.1726-second nominal polyline at speed240**, beyond the initial 10–25-second
target. This is an unresolved pacing/design warning, not an actual timed player run.

W2a passes **9/9 source checks** and the same **9/9** in an exact nine-file copy
with empty PATH/no .git/no node_modules. Actual wall contact, immutable detached
views, the60Hz/four-catch-up clock, invalid/rewound clock handling, strict access,
late import completion after disposal, active cleanup failure and failed download
are covered. These do not duplicate a full HMH simulator/verifier review.

The first actual native browser gate passes **two viewports and four denied-entry
cases**, with twenty-five full-resolution captures. Windows Chrome desktop
1280 × 800 uses genuine key down/up to walk from x12500 to x15605.67 across the
Meadows–Farms road without an inspection jump, and genuine native movement into
the visible landmark records a radius-24 contact. Phone framing414 × 896 at DPR3
uses real Chrome touch down/cancel to move x12500 → x12805.67 with no jump, then
clears held pointers and velocity. Its PNGs are1242 × 2688, not physical-phone
performance acceptance.

Twenty area-plan screenshots use clearly labelled inspection jumps; they prove
geometry/framing, **not walking all ten routes or close actor scale**. Default,
Ranked, embedded and actual non-loopback URL entry are denied before loading the
playtest/assets. The non-loopback URL is fulfilled with exact local built bytes;
no external host/DNS is contacted. Native pagehide releases controls, RAF and the
atlas. There are zero observed console/page/request/cleanup errors, no SDK posts,
persistence writes or API requests in this preview witness.

The exact BrowserServer-owned Chrome PID48792 closes normally and the local HTTP
server's close event is observed. Both owned Node children close normally and the
exact shared marker is released. Twenty-six source/package/CSS files, seven
protected helpers, two approved human atlas files,188 dependency files and the
reviewed harness retain before/after hashes. Actual built meta inputs, compiled
artifacts, served bytes and screenshot hashes/dimensions reconcile.

Thirteen new modules pass syntax and exact single-registration checks; this is
not the full repository syntax gate. One fresh normal build passes with HMH
initial plus shared JavaScript **1,039,992 B (8,584 B headroom)** and STACKED
**576,100 B (30,900 B headroom)**. The development kit, checker and preview are
absent from both normal game meta input graphs. The normal build removes the
ignored compiled preview directory; the exact review bundle preserves it.

The first default-visual invocation fails before loading the observer or visual
target: Node rejects a Windows path passed directly to `--import`. It produces
zero scenes and launches no Chrome or HTTP server. Its successful parse/build
results and failed invocation remain immutable. A visual-only continuation uses
the required file URL and revalidates exact prior source, dependency and built
artifact custody; it repeats neither the passing build nor parse checks.

That continuation passes **12/12 unchanged default visual scenes**, with maximum
mean delta0.019, maximum cell delta4 and three changed cells at most. No baseline
is accepted. Actual Chrome PID32304 closes with exit0, Node PID12760 closes
normally, and the local HTTP server close event is observed. The lifecycle
observer forwards original process/HTTP calls and changes no game clock or
browser arguments. Full-resolution desktop and mobile default captures were
inspected for grounding, readability and containment. This bounded result does
not certify every runtime asset identity, the full release gate, physical-phone
performance, complete ten-area design or W3/Ranked behavior.

## Failures preserved

Original raw receipts are retained under
`docs/2.0/receipts/world-w1b-w2a/` with an exact archive manifest.

- Initial eight missing-module cases fail before implementation.
- The first file install omitted the absent development directory; a nonterminating
  copy error was corrected with explicit directory creation and terminating copies.
- Arena02 fails on missing existing bounds metadata before the intended assertions;
  its incorrect selected-test TAP expectation is a harness failure, not valid RED.
  Arena03 supplies the genuine moved-away-cover RED, but its borrowed exit witness
  accidentally used an already unreachable exit. Arena04 corrects that witness
  with a reachable other-court exit and fails genuinely before the checker repair.
- First actual layout05 fails: old nav ignores non-water walkable flags, giving
  90.38% density/567 outside centres; raised-deck/exit seams and two blocked roads
  also fail. The old helpers remain unchanged; authored physical geometry is repaired.
- Four missing-complement tests and the sloped-polygon footprint case fail before
  implementation. A preflight blocked by another owner's lock launches no child.
  The later three star/duplicate/twice-wound contract tests fail genuinely before repair.
- Layout09 still fails the Meadows–Woods physical route despite48.07% density and
  reachable sites. The actual road is routed around the closed corner mass;
  layout10 passes with the current unchanged helpers.
- Six preview/clock and three async lifecycle missing-module cases fail before
  implementation; source gate13 passes. Browser01 passes on its first actual attempt.
- A source-only preparer initially mistook a comment's `import()` for a computed
  import; it is replaced with actual Acorn syntax-tree import discovery. Bundle
  preparation initially guessed the wrong Fortress PNG filename; the copy stops,
  then resumes using the actual fork-fortress capture without replacing frozen bytes.
- Default-visual01 fails on the Windows preload-path form before any visual code,
  browser or server runs. The strict missing-lifecycle guard retains the marker.
  Read-only exact PID/descendant absence and the pre-import failure are then
  recorded before releasing only the matching marker. A first follow-up metadata
  record serializes a PowerShell bare `true` as null; that record is retained and
  a separate explicit-boolean confirmation records the actual release. The
  file-URL-corrected visual-only02 continuation passes on its first attempt.

No failures are removed or relabelled as passing. No baselines are accepted.

## Review and continuation

Lead source/adversarial reviews cover the physical complement, court-bound cover
and exit corrections, detached local preview and owned browser gate. The lead and
author inspected actual full-resolution native/plan screenshots and agree on the
repetitive-layout limitation. This does not constitute owner art or map approval.

Use the separate builder `scripts/build-hmh-greybox-preview.mjs` after any normal
build, then serve from `apps/portal` and open only
`/dist/hmh-greybox/index.html?mode=free&world=visual-overhaul-greybox-v1` at HTTP
localhost/127.0.0.1 in a top-level tab. The user-review output bundle contains only
the exact compiled preview and approved runtime human atlas, with a manual local
launcher and screenshots; no source art or lingering server.

The archive retains original raw observation bytes. The large normal-build and
visual records are losslessly gzip-compressed; the extension manifest records
both compressed and original byte hashes. Full-resolution images remain in the
local witness directories and the user-facing preview bundle, with exact hashes
and dimensions in the preserved browser/visual receipts. No source art is added.

Next: the small raw-kit polygon contract and area-specific authored flow.
Actual HMH Free integration,
versioned W3 verifier-map dispatch preserving old runs, complete world streaming,
combat/cover/traversal/AI, physical device performance and owner greybox approval
remain separate gates. No merge/push, release/version bump, deployment or promotion.
