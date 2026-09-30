# W2g: Hollow Pines local cemetery flow

Status: local source/layout/native-browser checkpoint passes. Owner playtest,
full area design and art remain open.

Hollow Pines now has an open cemetery court with opposed gates, an independent
outside service route, a crypt-side loop returning to its dead-tree landmark,
and a maintenance house facing a bank reached by ramps from both ends. Two
unequal grove masses replace generic corner blocks. Nineteen pieces and five
paths replace the repeated kit; the other nine areas and both River/Woods road
endpoints stay unchanged. The world remains isolated local Free navigation.

Six new behavior tests ran against the prior template: five genuine failures
and one passing road/official-isolation control. The first implementation passed
all route, footprint and staged-height checks but failed the actual court floor
gate, causing seven global assertions to fail. That failed attempt is retained.
The fix physically widens the side gates and shortens the south wall, opening
the space without changing the checker, court dimensions or test thresholds.

The revised candidate passed 54/54 focused cases and the same 54/54 in an exact
25-file isolated copy with no .git, no node_modules and empty PATH. These are
the same tests repeated, not 108 distinct cases. None skipped, cancelled or todo.
Tests do not invoke Git. Both new files have one syntax registration.

Actual two-way collision sweeps and current ground traversal check the cemetery,
outer service path and crypt return. A real test closure across the cemetery
walk leaves the outer connection usable. The main path has a 240-unit moving
collision-clear band. This does not prove lateral ground support everywhere,
crowd combat, current cover controls or final pacing. The house marker has a
clear approach and stand-off from its actual face; both bank ramps return to
ground. The secret sits beside solid crypt geometry, with no new reward.

The summed local solid footprint is 1,837,700 units², below the old 2,060,800-unit²
template allowance. This sum counts overlapping faces conservatively rather
than computing their geometric union.
The unchanged conservative grid reports 36,167/77,589 walkable centres (46.6136%),
zero outside, all 98 sites reachable outward/back and all 14 roads passing.
This is 24 fewer clear cells than the preceding Ridge checkpoint despite the
smaller solid area: perimeter and grid clearance matter too. The world contains
626 pieces, 584 blockers, 479 closed masses and four guards. Pines court is
188/225 open samples (83.5556%), with two reachable exits and usable short/tall
cover. The original River-Woods 38.17-second nominal pacing warning remains.

RED child 52804 closed with expected exit 1; failed GREEN01 child 47860 also
closed. GREEN02 children 16276, 23412 and 43100 closed with exit 0/no signal and
were independently observed absent. The owned marker was released and observed
absent before Character's next source slot. All seven authority/checker pins
remain unchanged. No normal build, default visual suite, release gate, physical
iPhone result, final art, official map/verifier, version, credits or deploy is
claimed here.

One private preview build passed in 136.0 ms and one actual Chrome attempt
passed in 79.980 seconds. These are job durations, not FPS/device measurements.
It used one visible UI inspection jump per viewport followed by 19 real keyboard
legs and five real touch legs. Desktop traversed the cemetery, both ramps of
the outside service path and the crypt return to the dead-tree view. Phone
controls reached the bank and the maintenance-house approach. Desktop and touch
reached groundZ24, and the desktop returned to groundZ0. A separate collision
against the sloped root base stopped at y10445.275587254611 on its visible edge.
Four entry denials and both pagehide cleanups passed without page, resource,
cleanup or overflow errors. This is local coverage, not a continuous regional
journey, native combat or full simulation check.

Build child 29884, browser child 34668 and owned Chrome 31688 closed with exit
0/no signal and were independently observed absent. HTTP 127.0.0.1:62767 emitted
close. The exact owned marker was released and observed absent before handing
the slot to Character. All 39 source pins, seven authority pins, two existing
human assets, 188 dependencies and three harnesses matched before/after. Built,
actually served and captured bytes match their recorded identities.

All seven desktop 1280x800 and four phone 1242x2688 original captures were viewed.
The plans separate the cemetery, outer service path and crypt detour. Desktop
views frame the cemetery path with walls and the crypt nook with its real face.
Phone entry shows the tall monument and low boundary; the house frontage is
visible during the touch approach. Actor and controls stay contained. Flat
house/root/grove blocks, sparse ground, tiny plan text, clipped bank labels and
site outlines over the actor remain. Boundary stripes are preview artifacts.
The preview renderer is unchanged; final tree, cemetery and terrain art is open.

Exact RED, retained failed GREEN01, repaired GREEN02/copy and browser observations
are compressed under `docs/2.0/receipts/world-pines/`, with raw/stored identities.
The exact compiled manual bundle is `outputs/hmh-pines-authored-flow-preview.zip`
in the shared task workspace. Its launcher uses port 8800; packaging starts no
server. No extra repository-wide syntax run, normal build/default visual suite,
full release gate, physical phone, streaming result, owner approval or public
release is claimed.
