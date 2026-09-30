# W2c: Halving Farms local flow

Status: local source/layout/native-browser checkpoint passes. Final area design,
owner playtest, art and official map integration remain open.

The Farms kit replaces that area's repeated template in the separate local Free
navigation preview. The existing 20,000 by 14,000 bounds, fourteen roads, Meadows
authoring, other eight area templates, protected spawn and official simulation
remain unchanged. This is greybox navigation design, not the official map,
final art, combat, new mission rules or a production release.

Farms now has a solid barn facing a working yard, a windmill and silo silhouette,
large field-edge volumes, a raised loading platform, and five declared paths.
The main route enters the yard and approaches the south barn frontage. A separate
field track joins the original western and southern entrances through the storage
track marker. The objective is a marker outside the barn wall with a clear apron;
it does not open a door, block progression or award anything. Tall and short cover
are visible collision volumes only. Climb/drop markers grant no movement controls.

Four new behavioral tests first ran against the old Farms template: three failed
for missing authored routes/barn staging, while the fixed-road and official-run
isolation control passed. After the minimal kit and two-line world dispatch were
added, all thirty related cases passed. The same thirty passed in an exact
seventeen-file source copy with no .git, no node_modules and an empty PATH.
These are repeated results, not sixty distinct tests. There were no skipped,
cancelled or todo cases. A real blocked barn-apron fixture prevents its objective
approach while the independent field route remains clear.

The unchanged conservative nav grid reports 37,707 walkable centres among 77,589
in-bounds centres (48.5984%); all rounded centres outside the world remain blocked.
All ninety-eight declared sites are reachable outward and back, and all fourteen
global roads and five Farms paths pass the existing physical sweep/ground checks.
The world contains 617 visible pieces and 577 blockers. The River-Woods nominal
38.17-second pacing warning remains. Road full-width, exact geometric area,
combat pacing and owner playtest are not proven by these centre-path checks.

The GREEN source/diagnostic children (44060, 39096 and 2768) closed normally with
exit zero and were then observed absent. The exact shared marker was released
and observed absent before the next lane received the slot. Seven authority
files remain byte-identical to their prior pins. Tests never invoke Git.

Raw source and browser observations are retained losslessly under
`docs/2.0/receipts/world-farms/`; the manifest records original and gzip identities.
The shared workspace also retains every uncompressed input and result.

One actual private preview build passed in 124.7ms and one native Chrome attempt
passed in 94.655s. These durations are not frame-time or device-performance data.
The browser walked 24 desktop legs from the actual Meadows spawn, through Farms'
field route and yard, onto the loading platform (actual groundZ24), then to the
barn. A separate contact witness stopped at the visible barn wall at y5724.
The phone viewport walked two road legs with keyboard input and two yard legs
with actual touch controls and cancellation. No inspection jumps were used.
Four default/Ranked/embedded/remote-location denial cases and both pagehide
cleanups passed. Nine desktop and three phone original-resolution captures had
no viewport overflow. No page, resource or cleanup error occurred.

Build child 5248, browser child 51048 and actual owned Chrome 52776 closed with
normal exit zero and were observed absent. Chrome had no exit signal. HTTP
127.0.0.1:51481 emitted close before the exact shared marker was released. Thirty-
one source files, seven protected authority files, two existing human runtime
assets, 188 dependencies and three harnesses matched their before/after pins.
Compiled and actually served bytes and all capture identities also matched.

All twelve original screenshots were inspected. Actor and controls are readable;
the field bypass, barn approach and loading route are distinguishable. The working
yard is still sparse. Landmarks are plain masses. Loading/storage labels overlap
their markers or actor, plan labels are tiny, and closed-mass boundary stripes
remain inspection artifacts. This passes local navigation review, not final art,
complete area design, combat pacing or owner acceptance. The separate manual
bundle is `outputs/hmh-farms-authored-flow-preview.zip`; its README explains the
local launcher on port8796. Packaging starts no browser or server.

Both new files have exactly one syntax-inventory registration; their JavaScript
was parsed during the actual focused/source-copy checks. No extra repository-wide
syntax, normal-build, default visual suite, full release gate, physical iPhone,
world streaming or official versioned verifier run is claimed for this slice.

No production art, credits, new gameplay rules, verifier version, release version,
push, deployment or owner approval is claimed.
