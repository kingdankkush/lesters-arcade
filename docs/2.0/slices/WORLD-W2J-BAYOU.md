# W2j: Scrypt Bayou water and dry crossings

Status: local source/layout/native-browser checkpoint and unchanged standard
visual regression pass. Owner playtest, full area design and production art
remain open. Hashwood River is the last area still using the initial template.

Scrypt Bayou now has a shaped channel, two dry crossings and a west-bank
machinery court. The northern crossing preserves the Coast/River connection
when the whole court is blocked. An east-bank stilt-store detour returns to
the lower crossing. Sixteen pieces and five inspection paths replace the old
template; the existing road geometry and endpoints are unchanged.

The local kit now supports water and bridge pieces. Water is blocked ground,
not an invented solid wall. Its visible polygon matches the ground query;
malformed, repeated and zero-area outlines and contradictory dry flags are
rejected. Both bridges and their shallow 24-unit ramps reuse the existing
priority/elevation contract. No swimming, mud slowdown, lock state, boss
trigger, collapse, climbing control or official map/version is activated.

The local preview caches immutable paint polygons once per mount. Its reverse
priority/id paint order agrees with the existing ground resolver, including
equal-priority ids. Water, timber crossings and ramps have separate flat
greybox cues. Polygon shorelines are not replaced by enclosing rectangles.
This preparation draws no randomness and does not mutate the source world.

Fourteen kit/topology tests first produced twelve genuine expected failures
and two passing controls. The first implementation passed 80/80 focused tests
and the identical 80/80 in an exact 34-file isolated copy. Four presentation
tests then produced four genuine missing-helper failures. The minimal paint
change passed 93/93 focused tests and the same 93/93 in an exact 43-file copy
without Git or node_modules and with empty PATH. These repeat cases rather
than add new ones. None were skipped, cancelled or todo; tests do not invoke
Git. Seven protected simulation/navigation/official-map/checker files remain
unchanged.

Source checks prove both directions across each bridge, three parallel legal
crossing paths, both ramps, blocked water between crossings, bridge-removal
failure, actual navigator shore refusal, and actual conservative grid support.
The full-court blocker closes the lock route but leaves the northern bypass
open. The store point and lock controls sit outside their physical masses.

Water plus solid footprint totals 1,876,300 units², below the old 2,060,800-unit²
allowance. The unchanged conservative grid has 36,433/77,589 walkable centres
(46.956398%), 191 more than Woods, with zero outside. All 98 sites, 14 roads
and five Bayou paths pass. The world has 632 pieces, 583 blockers, 479 closed
masses and four guards. The court has 208/225 open samples (92.4444%), two
reachable exits and usable short/tall cover. The existing River/Woods nominal
38.17-second warning remains. This is layout coverage, not encounter pacing
or crowd performance.

The one private build took 144.374 ms; the actual Chrome walkthrough took
63.926 seconds. One explicit UI inspection jump per viewport preceded all
local movement. Desktop completed 20 keyboard legs, both bridge up/down
transitions, store return, controls and wheel frontage. A separate held-input
check stopped at x2699.666666666667 before the visible x2700 shoreline, with
zero solid contacts. Five actual touch legs crossed the northern bridge,
returned to dry ground and reached the lower bridge. Four denied entries,
both pagehide cleanups and DOM containment passed without page/resource/
cleanup errors. No continuous regional road journey is claimed.

All ten desktop 1280×800 and four phone 1242×2688 originals were inspected.
The channel, north bypass, west court and eastern store return are distinct
in the plans. Water and bridge/ramp cues remain separate in actor-scale phone
views. Phone entry is sparse; overview labels are tiny; inspection markers
overlap actors; some canvas labels clip; the path guide covers the bridge's
central timber cue. The sprite can straddle the bank while its centre stops
on legal ground, consistent with the unchanged traversal contract. These are
flat navigation placeholders, not area art acceptance or physical-iPhone proof.

The separately approved fresh normal build and unchanged standard
`npm run visual:reboot` path also passed. All 12 scene signatures and all four
enemy crops were unchanged; maximum mean scene delta was 0.019, maximum cell
delta 4 and maximum changed cells 3 within the existing comparison. Reduced
motion retained seven landmarks with zero animated signals/atmosphere sprites.
All 12 original scenes and three enemy-capture images were viewed. Their
existing terrain repetition, abrupt edges, sparse dressing and objective
arrow/text overlap remain visible; no new baseline was accepted.

Normal-build input inspection excludes local authoring and checker modules.
HMH initial plus shared JavaScript is 1,039,992 B (8,584 B headroom); STACKED
initial JavaScript is 576,100 B (30,900 B headroom). This is this worktree's
fresh build, not certification of the gathered release candidate.

Source RED child 30040 and paint RED 9280 closed with expected exit 1/no
signal. Initial source children 17916/37504/49584 and paint source children
48264/42592/17420 closed with exit 0/no signal. Preview build/browser/Chrome
6580/46816/11740 and normal build/visual/Chrome 27472/53296/47324 closed with
exit 0/no signal and were independently observed absent. HTTP ports 64457
and 59750 emitted close. Exact owned markers were released and observed
absent before handoff. Job durations are not FPS measurements.

Before either builder, its own resolved dist target and existing ancestors
were checked as contained and nonjunction. Preview custody matched 48 source,
seven authority, two human asset, 188 dependency and three harness pins;
served and captured bytes matched. Default custody matched its exact source,
dependency, baseline and output bindings. Compact lossless receipts are under
`docs/2.0/receipts/world-bayou/`; source copies and original images stay in the
task workspace instead of adding duplicate source/image trees to Git.

The manual compiled bundle is `outputs/hmh-bayou-authored-flow-preview.zip`
in the task workspace. Its launcher uses port 8803; packaging starts no server.
No full release gate, Ranked E2E, physical-phone performance, streaming,
final art, whole-map owner approval, credit spend, version, push or deployment
is claimed.
