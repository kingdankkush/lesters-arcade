# Lester's Arcade 2.2 progress

Updated 2026-10-03 PDT. The owning scope is
`MASTER-OVERHAUL-LIST-2026-10-02.md`; this ledger records verified delivery,
not a declaration that its 34 items are complete.

## Baseline and decisions

- Own worktree: `220-codex-overhaul`, branch `codex/220-overhaul-20261002`,
  created from local integration successor `561e48333`. Other worktrees were
  not modified. Fetched remote integration head: `fbbc594baa06bc022518ec77c1723b492a11f42a`.
- Live `/api/health` inspected: healthy **2.1.1**, not paused or degraded.
  Live service worker marker: `lesters-arcade-v67-level-one-only`.
  These are baseline observations; this candidate has not been deployed.
- Owner decision: **preserve overall hero power and smooth progression**.
  No 14% power reduction is authorized by this decision.
- Reuse existing rigs/assets and native Blender; no paid generation this wave.
- Release targets 2.2; version constants remain unchanged until the release
  commit. New solo STACKED pacing is dormant for existing 2.1.1 sessions.
- Device acceptance remains iPhone XS Max / Chrome. Desktop Chrome at a phone
  viewport is useful visual evidence, not physical-phone performance proof.

## Delivered slices and evidence

The first visual delivery checkpoint is committed as **`b7037ceaa`** on the
overhaul branch. It is a feature checkpoint, not a versioned release; nothing
from this branch has been pushed, deployed or promoted.

### Enemy clips, Ridge cliffs and HMH pause (second delivery batch)

Ordinary enemy hit clips now span their complete authored animation in the
existing six-tick hit window. Existing opaque corpse markers can use spare
native actor slots after the hero, bosses and living enemies. Fading, unready
models and failures restore sprites. No enemy health, RNG, evidence, corpse
lifetime or cap changes. Evidence-only counters record successfully rendered
native hits and corpses.

Ledger Ridge has four native fractured face variants, cap trim and rubble
footing, using the existing archived sandstone material. Runtime atlases are
104,916 B full and 46,092 B half; Ridge ground decode is 7,471,104 B, below
8 MiB. Other districts do not load this page. The source archive is unchanged.
Independent review corrected double alpha multiplication and sprite fallback
atlas insets. Actual screenshots exposed horizontal texture jumps; continuous
mirrored sampling corrected them. Fresh desktop/phone captures were inspected
and both native atlas requests returned 200. Other cliffs, ramps, seams and
pillar variants remain open.

HMH now owns its pause and upgrade surfaces without the parent legacy menu
stacking on top. Parent completion and game-over recap remain reachable.
Pause/resume leaves the soundtrack transport alone, preserving both ongoing
music and a player's manual music pause. The map is collapsible so settings
are easier to reach. Seven behavior checks plus actor/flow-contract checks
pass (48 combined at that checkpoint). Actual desktop/phone-viewport checks
passed for one child menu, settings above the fold, map expansion/collapse,
music continuity and preserving manual soundtrack pause.

Final focused regressions: **88/88 pass**. The 13 edited/new JavaScript modules
and native Python generator parse. Required `visual:reboot` passes all 12
legacy scenes unchanged, with zero frame-signature delta and no runtime
errors; it still does not cover the ten-area world. Fresh build: HMH initial
plus shared **1,004,517 / 1,048,576 B**; STACKED **583,177 / 607,000 B**.

Native hit playback was observed in the existing full-health pressure scene
(up to six native hit rows). Ordinary Free play separately showed a native
corpse and sprite handoff during fade. The crowded scene prioritizes living
actors, so it need not allocate native corpse slots. The initial combined
checker incorrectly required both observations in the same scene, and the
stationary roster test has automatic firing disabled. Those failed receipts
remain preserved; the independent observations are summarized in the lead
workspace's `outputs/22-hmh-second/animation-observations.json`. Original
browser jobs confirmed owned Chrome/server closure. No frame-time or physical
phone performance acceptance is claimed. Full new animation/art sets remain
open despite these corrected clip-delivery paths.

### Progression policy audit (item 15, not implemented)

Preserve upgrade amounts, selectable ranks, XP multipliers and maximum power.
The current catalogue has 36 upgrades and 167 selectable ranks, rather than
the guide's historical 24 upgrades. Recommended new threshold for completing
level L below 19: legacy cumulative XP plus
`round(25 * L * (19 - L)^2 / 27)`; L >= 19 remains exactly legacy. This raises
level-2 XP from 300 to 600, level-5 from 3,000 to 3,833, and rejoins the existing
57,000 XP threshold at level 20. Later thresholds and eventual power stay
unchanged. The 15–20 Liquidator level is a soft target: current evidence does
not prove a universal fight-entry level, and high-income runs may exceed 20.

Do not change the shared schema-6/7/8 helpers or verifiers. Implement this with
the upcoming bound-version schema-9 ruleset, including XP bar floors, objective
XP, OG Miner span and new verifier selection. Historical runs must retain their
original curve. No curve code or version constants changed in this batch.

### Default HMH character delivery (item 1, partial)

Default lazy 3D delivery, bounded low/medium/high actor counts, reduced texture
decode size, safe sprite fallback and production animation selection. Existing
hero combat/interaction clips, district bosses and expanded enemy identities
now have a production renderer path. Desktop and phone-viewport Chrome both
reported `actor3dStatus=ready`, visible actor count > 0, default ten-area world,
and no page errors. No special actor pilot query was used.

All four optimized low-tier downloads now pass real Chrome decoding at a phone
viewport; their compressed asset requests succeed without classic-GLB fallback.
Native geometry, rig and all 80 clips are retained; each download is below
1.5 MB. Medium/high remain the original GLBs. Observed movement starts, stops
and stationary turns/pivots now route to existing clips, interrupted by combat,
cover and traversal; 40 actor checks pass. This is texture/transport optimization,
not mesh LOD or physical-phone FPS proof.

Mesh LODs, full missing clip sets, sustained heavy-load proof and
physical-phone acceptance remain open. Details: `HMH-ACTOR-DELIVERY-2026-10-02.md`.

### HMH material groundwork (items 2/4, partial)

Ten authored full/phone surface textures, route spine correction, reduced
high-frequency grain and continuous contact-shadow falloff. Focused checks:
37 passing. Runtime source images total 455,335 B; maximum per-area ground
decode stays below 8 MiB. Default game screenshot inspected. Its empty opening
composition still fails the art bar; centre dressing is being corrected.

310 nonblocking centre instances now frame all ten areas. City skyline
building/building overlaps decreased from 19 to zero within the tested scope;
broader mixed-prop placement faults remain. Meadows' thorny foreground assets
failed visual review and were replaced with four native low ground patches.
56 focused checks pass; Meadows decoded ground is 7,733,248 B below 8 MiB.
The first replacement screenshots were still too sparse, especially on phones.
A second layout correction removed accidental double scaling and added 23
near-camera verge patches; 19 now fit the normal portrait playfield. Actual
desktop/phone screenshots confirm visible low foliage beside the arrival path.
This improves framing; full Meadow/ten-area art acceptance remains open.
Full terrain/cliff/transition/water/identity kits remain open. Details:
`HMH-GROUND-MATERIAL-SLICE.md` and `HMH-CENTRE-COMPOSITION-SLICE.md`.

### Chikun obstacle art and audio (items 10/26, partial)

Six native Blender replacements, with real eight-frame 12 fps drone, canopy,
storm and waterfall loops; pipe and cliff lips remain still geometry. Existing
eight-frame eagle is reused. Lazy medium/phone tiers total 938,210 B encoded,
2,399,432 B phone decode and 9,622,364 B medium decode. Actor lighting now
reads the existing environment rig. Audio master covers the existing sampled
and oscillator paths; persisted pause volume control added. Focused checks:
46 passing for the initial slice. Nine further native facade designs now replace
procedural town/city/suburb rectangles with stable three-design variety. They
add 126,242 B; the full kit totals 1,064,452 B encoded, 3,016,904 B low decode
and 12,103,772 B medium decode, under 4/12 MiB caps. Fourteen facade/kit checks
pass. Native sources and bake previews stay outside Git.

Natural Free gameplay through the real portal was checked on desktop and a
phone viewport, with loaded obstacle art and no page errors. An earlier standalone
child screenshot was only a ready-art/start screen: direct child URLs lack a
parent session, so it was not claimed as a completed gameplay test.
The actual loaded runtime facade painter was also checked at both viewport
sizes using canonical shapes on a separate labelled projection canvas; those
images are renderer evidence, not natural-course playthroughs of all regions.
Details: `CHIKUN-OBSTACLE-DELIVERY-2026-10-02.md`.

### STACKED visual replacement (owner request, partial acceptance)

New lazy fullscreen material shader replaces the default line-form visualizer
with eight luminous worlds, automatic music portals, forward drift, smoothed
audio response, and reduced-motion/flash controls. Cached beveled luminous
blocks and bounded shard/halo clear effects reuse the existing presentation
pools. Actual desktop/phone-viewport gameplay loads the new shader, not its
legacy fallback. Settings preview now copies the actual rendered cabinet.
All eight worlds cycle automatically; local Next world opens the next portal.
Five historical fixed choices retain cached-parent preference compatibility.
Phone pause music access is restored. Its bridge state now updates the parent
pause surface, while the child continues owning its menu.

Focused state/loader/presentation/preferences/bridge checks: 60 passing.
Eight scene modes, automatic advancement, repeated desktop/phone resizing,
reduced-motion distance freeze and Effects Off were exercised in Chrome.
Some paused scene screenshots include the settings overlay; they are not clean
art exports. Clear-burst acceptance remains open. The unsupported-GPU path now
uses a quiet static nebula, so the legacy line-form factory is not called by
the production renderer. Independent review corrected retained GPU programs,
missing audio availability and missing scene labels. A real Pixi regression
checks release of all five fallback graphics contexts.

### STACKED pressure pacing (owner request, versioned)

New 2.2 solo pacing: timer arms at 90 s, first garbage row at 108 s, intervals
ease gradually from 18 to 6 s. Gravity, scoring, input handling and versus
rules are unchanged. Canonical session build hash selects the rules; historical
sessions retain the original first row at 72 s. 104 focused tests pass,
including the pinned long historical tuple and client/worker/server parity;
46 purity/pacing checks pass. Independent review found that signed build hashes
were not server-approved version choices. Production verifier now checks the
deployed game version before decoding evidence; stored reverification uses the
same check. Only the known 2.2 rules line selects the new schedule. Candidate
parity uses a trusted server-only factory, never a per-request override.
150 combined regressions and eight independent authority checks pass. Seed
issuance and settlement source were not changed; future-labelled tickets can
still be issued, but unpublished rules cannot be accepted by replay verification.
Details: `STACKED-LEDGER-PACING.md`.

### Level-up repaint correction (items 24/32, partial)

Repeated projection of one real offer preserves card nodes, expanded details,
keyboard focus, the selection latch and held gamepad release edges. A changed
offer/reroll still rebuilds; hide/destroy resets the local cache. No progression
state, offer counts, rules or evidence changed. 40 card/progression adapter tests
pass and six independent focused review checks pass. In the actual browser,
keyboard navigation, reroll and confirmation close the real upgrade panel
without errors. The evidence-only progression pilot supplies this short check;
it is not Ranked or balance acceptance. Three-card rules, new rarity/grade and
the preserve-power curve remain pending.

## Master-list status

| Item | Status / work still required |
| --- | --- |
| 1 | Default 3D, native hero crossfades and genuine four-hero low mesh LOD delivered; low textured silhouettes checked at desktop/phone viewports. Quality governor, full clip polish and physical-phone performance remain open. |
| 2 | New surface materials and native Pines/Woods floor beds delivered and inspected at desktop/phone viewports; full biome terrain/edges/composition remain open. |
| 3 | Ridge native face/lip/foot kit desktop/phone-viewport reviewed; other cliff, ramp, pillar and deck work pending. |
| 4 | Ground shadow cutoff corrected; full light rig/local pools/fog pending. |
| 5 | Existing River/Bayou flow/depth/foam/caustics/glints browser reviewed; Coast sea, banks and physical-phone proof pending. |
| 6 | Centre identity composition in progress; all ten final kits pending. |
| 7 | Collision-consistent building overlap/placement corrections pending. |
| 8 | Filled impact fragments, textured projected boss fields/safe cutouts, soft low-health component and visible boss edge warnings delivered; natural low-health/charge capture, gore and full boss framing remain open. |
| 9 | Existing 3D identities activated; distinct models/full boss/enemy clips pending. |
| 10 | Six larger obstacle assets/four loops, nine facades, three eight-pose sky sheets, four static ground props and Shiba/hurdle loops delivered; ground trees/owl/course content and full scene/phone acceptance remain open. |
| 11 | Existing start/stop/turn/pivot clips wired with native hero TRS crossfades; dedicated walk and tested speed/turn rules pending. |
| 12 | Existing cover clips routed; shield badge/active edge checked in actual desktop/phone views with entry/exit. Full cover action polish/gamepad button remain open. |
| 13 | Visibility-aware aim/spawn fairness versioned rules pending. |
| 14 | Typed pickup respawn versioned rules pending. |
| 15 | Preserve-power progression smoothing, rarity/cards/rerolls pending. |
| 16 | Dash/perfect-dodge/boss invulnerability versioned rules pending. |
| 17 | Boss staging/phases/hazards/rewards and honest corpus pending. |
| 18 | Expanded enemy AI kit versioned rules pending. |
| 19 | Seeded landing zones/parachute staging pending. |
| 20 | Area objective routes/tracker/rewards versioned rules pending. |
| 21 | Compact HUD/active weapon layout browser checked (85 px desktop, 83 px phone); FOV/reticle checks open. |
| 22 | Liquidated recap, cosmetic grade, applied damage sources, standalone Free restart and short-screen scrolling delivered; desktop/phone-viewport parent result path checked. Natural long-run/device acceptance remains open. |
| 23 | HMH double pause, music continuity/manual pause and map disclosure corrected and browser checked; child transport bridge and gamepad/menu completion pending. |
| 24 | Repeated-offer repaint corrected; new cards/briefing art and merged intro pending. |
| 25 | Uniform three-cabinet menu/gamepad audit pending. |
| 26 | Audio master/environment light and standard-controller jump/glide/pause adapter delivered; synthetic browser lifecycle and v5/v6 byte-parity checked. Physical controller/haptics/typed deaths remain open. |
| 27 | Modern STACKED visuals and phone music access in review; more tracks/themes pending. |
| 28 | HMH haptic intensity pending. |
| 29 | Physical phone, long soak/heavy scene acceptance and governor proof pending. |
| 30 | Ten-area production visual gate coverage pending. |
| 31 | Summary forgery/verifier r4 work pending; no untested verifier weakening. |
| 32 | Repeated offers and coming-soon deep links corrected; both future routes and all three playable routes browser checked at desktop/phone viewports. Other recorded bugs remain open. |
| 33 | Legacy fallback/repository budget/error tracking cleanup pending. |
| 34 | Weapons/prisoners/audio/accessibility/achievement remainder pending. |

## Third visual batch — 2026-10-03

Native hero TRS crossfades now soften movement, cover, reload, interaction and
fidget changes. Combat/hurt/death interrupt immediately, repeated paused ticks
freeze, and rollback resets. No model bytes or per-frame arrays were added;
only one bounded hero transform snapshot is allocated. This does not add the
missing dedicated walk or second enemy deaths.

Existing River/Bayou water now uses shore-tangent current in unused channels
of its existing distance texture, layered wave normals, quieter shallow
caustics, depth absorption, foam/wet edges and directional glints. Actual first
captures failed art acceptance: caustics were too large/uniform and the water
looked grey. The corrective pass was rebuilt and reviewed in both desktop and
phone viewports. Geometry, palettes, GPU texture allocation and frozen phone
motion policy stayed intact. Coast sea/banks remain separately unfinished.

Chikun's hawk, pelican and plane have refined native eight-pose loops, with
distinct compressed frames at both tiers. Six WebPs total **172,350 B**;
decoded sheets **720,896 B phone / 1,966,080 B full**. Superseded static assets
are skipped on successful load. Natural guest Free entry proves actual kit
loading; a separately labelled runtime-painter gallery inspects all three.
This does not prove natural encounters in every region or typed death quality.

Combat markers now use real projected ground footprints, capsule ends, actual
annular/safe-sector cutouts and reusable grain. Independent review caught an
empty second Pixi stroke and excessive ring instructions; both were corrected,
with actual GraphicsContext coverage. Impact fragments are filled chips; low
health has a bounded soft radial component. A 60-second natural Free observation
did **not** reach its warning threshold. The failed job/receipt remains intact;
the in-game low-health screenshot is still unobserved, not claimed as passed.
Details: `HMH-COMBAT-READABILITY-SLICE.md`.

Combined targeted regressions: **180/180 passed**. Fresh build/browser job:
**eight desktop/phone viewport scenes pass**, no page errors, owned Chrome and
server closure confirmed. HMH initial including shared **1,005,148 / 1,048,576 B**;
STACKED **583,177 / 607,000 B**. Required `visual:reboot`: **12 retired-map scenes
unchanged**, zero comparison delta and no errors. Those legacy scenes do not
certify the new ten-area world; the new area captures are recorded separately.
Evidence: root `outputs/22-water-combat-sky/review.json` and full-resolution PNGs.

One extra positive bug fix guards coming-soon deep links before selecting an
unsupported runtime. `/play/mweb-invaders` and the analogous future cabinet
return to cabinet browsing; playable cabinet and wallet gates are unchanged.
**23/23 focused route regressions passed**. Browser acceptance for this newer
source change remains pending, so it is a newer candidate than the art build.

Live baseline rechecked at **2026-10-03 15:22 UTC**: healthy **2.1.1**, cache
`lesters-arcade-v67-level-one-only`; fetched integration is still
`fbbc594baa06bc022518ec77c1723b492a11f42a`. No deployment or release bump occurred.
Genuine low hero mesh LOD and native forest-floor variation have now been
delivered for final runtime review. Failed scratch LOD silhouette gates were
corrected before publishing the candidate; generated/native sources remain
outside Git. Mesh/animation integrity is covered by 11 focused checks, with
typed geometry buffers 42–44% smaller and roughly 51% fewer triangles. Four
low hero downloads total 3,868,467 B. Desktop textured capture preserves the
recognizable silhouettes; physical phone FPS and full clip quality stay open.

The forest page is 1 MiB full / 256 KiB half, with 71 Pines and 188 Woods low
beds. Existing blocking-card identities and entire patch/route/solid/water
clearance are checked. Ground allocation remains 7,733,248 B Pines / 6,422,528 B
Woods. Actual desktop centres were inspected: a better initial litter and
understory layer, not final composed forest areas. Full canopy, landmarks,
ruins, terrain transitions and area acceptance are still required.

Visible cover now reads existing 60%/40% directional damage reduction in a
shield badge and highlights the current wall edge. Tests first, 42/42 focused
checks passed and independent review found no concrete blocker. Actual desktop
entry/exit worked; the first edge was occluded by the wall. Its corrected
layer and phone layout are awaiting a fresh browser review. Source details in
`HMH-COVER-READABILITY-SLICE.md`.

### Third-batch closeout — actual runtime review

The follow-up **26-scene desktop/phone-viewport job passed**, including Pines
and Woods, all four genuine low hero downloads, cover entry/exit, both future
cabinet links and all three playable links, and Chikun's ground kit. All four
textured low heroes retain recognizable silhouettes in the actual renderer;
this accepts the reduced geometry slice, not every clip or physical-device FPS.
Forest-floor review accepts an initial litter/understory improvement; sparse
centre composition and missing landmarks still prevent whole-area acceptance.

Cover's first layer correction exposed a second real defect: Pixi interpreted
a typed polygon buffer as a point object, compiling undefined coordinates.
A reusable plain array fixes it; actual compiled-shape coverage first failed,
then passed. The fresh focused browser job confirms the edge is visible,
the shield fits both HUDs, and movement-only exit clears it. The brown walls
remain unfinished world art.

Chikun now replaces all six old ground prop painters. Rock/log/thorn/crate use
one refined native page; Shiba/hurdle use a second page with eight poses each.
Shiba tail/ear/breath and hurdle loose wrap move cosmetically; rigid collision,
draw dimensions and existing Shiba bounce stay unchanged. The six runtime
painters and ready status were inspected at both viewports. The review gallery
is labelled presentation-only and its phone overlay stretches vertically; it
does not certify natural encounters in every region. Native-page decoded
subtotal is **4,786,376 B low / 18,264,156 B medium**, excluding region scenery,
characters, trees and remaining fallback assets. Ground trees and owl/course
content remain open. Details: `CHIKUN-GROUND-OBSTACLE-KIT-SLICE.md` and
`CHIKUN-SHIBA-HURDLE-LOOP-SLICE.md`.

The boss edge warning is now visible in the real Baron court at desktop and
phone viewports, inside the HUD/touch safe region. Locked charge origin and
countdown are unit checked; a natural charge-warning capture remains open.
Full boss camera framing remains open: camera reframing changes mouse aim,
while a separate aiming camera visibly misses the cursor. No such workaround
was adopted. The later versioned encounter/input design must resolve this.

Chikun's lazy standard-controller adapter reuses existing flap/glide booleans.
Independent review caught a focus-gap edge: background RAF may stop before
sampling disabled input. Synchronous blur/hidden resets fix it. Both actual
browser layouts pass synthetic A jump, Start pause/resume, frozen paused tick,
and held A across a zero-disabled-frame blur without a false resume. Current
v6 and historical v5 keyboard/controller equivalents have byte-identical
canonical replay/results. No physical controller claim. Details:
`CHIKUN-CONTROLLER-SLICE.md`.

The final focused browser job passes **eight scenes**, with no page errors and
owned browser/server closure. Its first attempt failed because the helper read
`vy` instead of the real snapshot's `velocityY`; the unchanged build passed
after correcting the helper. Earlier helper failures for a wrong spawn field
and future-cabinet slug are retained too. Latest built candidate: HMH initial
including shared **1,005,973 / 1,048,576 B**, STACKED **583,177 / 607,000 B**.
Targeted final component suite: **26/26 pass**; prior wider slice suites remain
recorded above. No ruleset, version, settlement or production changes.

Final syntax registry passes **1,474 JS modules + 188 Python scripts**. The
first required visual comparison found one intentional change: the new boss
edge warning in `combat-engaged-desktop` (mean delta .24, maximum 33, sixteen
signature cells); enemy crops are unchanged and all twelve scenes have no
runtime errors. The other eleven scenes pass (mobile mean .01/max 2, others
zero). Current desktop combat and phone frames were inspected; reviewed
baseline acceptance and a fresh comparison are in progress. The failed first
receipt is preserved as root `outputs/22-wave-checks-20261003-preaccept.json`.

Closeout: reviewed baseline acceptance and fresh comparison both passed, with
all twelve legacy scenes unchanged and no runtime errors; exact metrics are
preserved in the timestamped `22-wave-checks-*` receipts. These scenes still do
not certify the ten-area world. The final focused integration suite passes
**106/106 cases** across all new modules, native asset integrity, actor
transitions, replay-equivalent input and routes. All owned heavy-job children
closed before releasing the lock. This is a feature checkpoint, not the full
release gate or physical-device acceptance.

Evidence: root `outputs/22-forest-lod-cover-routes/`, including timestamped
receipts (the newest `review.json` is the focused follow-up, not the 26-scene
job). Next valuable art slice: replace the spawn/Baron brown placeholder bars
without changing their authoritative blockers; then continue full district
composition, missing character/death content and the remaining master items.

## Fourth visual batch — native timber, enemy death and recap

Four brown placeholder blockers now have registered native timber/canvas art.
Their complete collision records and height/placement remain unchanged. One
lazy shared page adds 524,288 B full / 131,072 B half decode; Meadows totals
8,257,536 B and River 7,208,960 B within the 8 MiB area ground/material cap.
The 72 focused native/renderer/placement checks pass. Actual full-tier and
half-tier requests return 200; cover still enters at the same wall and shows
60%. Desktop captures show both River posts, phone framing shows one at its
ground contact. These are initial fitted replacements: sparse surrounding
spaces, structural scale and full district composition remain open. Details:
`HMH-NATIVE-TIMBER-SCREENS-SLICE.md`.

Bagholder Rusher gains a distinct native side-fall death. The original mesh,
rig, textures and six clips remain byte-identical. The additional clip adds
33,868 B; the GLB is 1,780,176 B. Stable presentation identity selects the
variation without consuming any random stream; an old cached asset lacking
only this optional clip falls back to its original death. 53 focused checks
pass. Native reimport checks all seven clips at five fractions with maximum
ground residual 3.6e-7 m. The textured native final pose was inspected. Both
variations in natural gameplay and other families' variations remain open;
this is one bounded asset delivery, not completion of master item 9.

The new lazy Liquidated recap reports existing kills, survival, level, score,
final hit and bounded applied-damage sources. Its grade is cosmetic. The
existing 72-tick presentation death camera, held result messages and backstop
remain unchanged. Only unbridged Free has a local restart. Independent review
found a cropped short-screen panel; scrolling and touch pan now make restart
reachable in landscape. Inactive touch controls and the controls hint hide.
All eight combined actual browser scenes pass with no page errors: timber,
standalone recap/restart and parent Free result path at desktop/phone sizes;
landscape scrolling also passes. Parent receives exactly one schema-8 summary
with unchanged score/kills. These are evidence-only terminal fixture runs,
not natural defeats, physical phone or Ranked acceptance. Initial helper
failures (URL field, nonexistent tick field) and Commando armor surviving the
fixture are retained in timestamped receipts. Valkyrie exercises the existing
fixture without changing runtime gameplay or the fixture hit.

Combined final focused suite: 115/115 passing. Latest pre-release build:
HMH initial plus shared 1,006,947 / 1,048,576 B; STACKED 583,177 / 607,000 B.
All owned native/browser children closed before token-owned lock release.
Root evidence: `outputs/22-timber-death/` in the chat workspace.

## Completed-scope release authorization — 2026-10-03

The owner explicitly changed the immediate release scope: wrap up work already
in progress, polish/test/optimize, and bundle completed work for commit and
publication. The full master overhaul remains preserved above for later work.
No claim of full AAA quality, all 34 items completed, final area approval or
physical XS Max performance is made. Release target is 2.2.0. Independent
review finds HMH retains schema 8/map v2 and legacy verification; no new HMH
ruleset is activated. STACKED's already-tested 2.2 solo schedule activates by
canonical build hash; historical replay rules stay unchanged.

## Release readiness (current)

No release commit, push, deployment or promotion yet. Full release gate,
three-game local Ranked end-to-end checks, required visual comparison and live
verification remain required for the completed-scope release. New HMH ruleset
corpus, real phone performance and final area/art acceptance remain requirements
for the deferred full overhaul, not evidence already obtained by this bundle.
Completed tests and browser evidence do not imply completion of this scope.
All 34 master items remain partially delivered or open; none is declared
fully accepted by this batch. Latest build budgets are recorded in the
third-batch closeout above. The previous evidence below is historical and
does not replace certification of the newest candidate.

Owned local browser jobs use the shared heavy lock and confirm Chrome/server
closure before releasing it. Root workspace evidence:
`outputs/22-first-wave/review.json` and full-resolution game screenshots.
First-wave combined browser pass: all three games desktop/phone viewport ready,
natural Free entry for STACKED/Chikun, default HMH 3D delivery, music pause
access and owned browser/server closure. Physical-device acceptance is open.
Measured build: HMH initial including shared 1,004,154 / 1,048,576 B;
STACKED 583,177 / 607,000 B. Latest targeted browser pass includes all four low
hero downloads and the actual upgrade flow, with owned Chrome/server closure.
The earlier syntax gate exceeded its 120 s watchdog; its failure and exact-PID
closure record were preserved. The bounded retry passed 1,452 JS modules and
173 Python scripts. All 12 legacy visual scenes changed from 3D/HUD delivery;
their screenshots and metrics were inspected, with no runtime errors. Reviewed
baseline acceptance completed; the fresh comparison passes all 12 scenes with
zero frame-signature delta and no runtime errors. Both jobs confirmed owned
child closure. Final syntax registry passes **1,453 JS modules + 178 Python
scripts**, including all native asset producers and the facade test.

Combined current focused regressions: **172/172 pass**, covering actor delivery,
downloads, terrain composition/materials, upgrade interaction, Chikun art/audio
and STACKED presentation/version authority. This is not the full release gate.
Latest art browser checks pass, but Chrome's first shutdown observation timed
out. A subsequent exact-PID/descendant audit confirmed all owned processes
absent and released only its owned lock; both receipts are preserved in
`outputs/22-first-wave/review.json` and `outputs/22-art-review-closure-followup.json`.
