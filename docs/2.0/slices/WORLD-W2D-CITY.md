# W2d: Litecoin City local flow

Status: local source/layout/native-browser checkpoint passes. Owner playtest,
final area design and art remain open.

City now has two public streets crossing at a clear civic junction. A southeast
Liquidator forecourt sits beside the streets instead of consuming their junction.
Its south boundary is the exchange's long north-facing frontage. Two separate
street approaches reach the plaza; Closing Bell is a marker outside the exchange
wall. A ramp and deck provide a visible, returnable east-side gantry. A narrower
maintenance alley passes between the northwest market and warehouse and returns
to the north street. Southwest housing and a service shed provide a different
mass rhythm from the northern commercial block.

These are twelve local greybox pieces and seven declared inspection paths. They
replace only City's repeated template. The 20,000 by 14,000 bounds, all fourteen
roads and their endpoints, Meadows and Farms authoring, other seven templates,
protected spawn and official simulation remain unchanged. This is local Free
navigation staging, not the official map, new mission/combat/cover/climb rules,
final art, a verifier version or a production release.

Six new behavioral tests ran first against the generic City template. Five
failed for absent authored routes and one fixed-road/official-isolation control
passed. After the minimal kit and two-line world dispatch, all thirty-six related
cases passed. The same thirty-six passed in an exact nineteen-file copy with no
.git, no node_modules and an empty PATH. These are repeated results, not seventy-
two distinct tests. No cases were skipped, cancelled or marked todo.

Tests close the entire Liquidator forecourt with a real solid blocker. Both plaza
approaches are then blocked while both public streets and the maintenance route
remain clear. Other checks require real solid buildings on both sides of the
maintenance lane, a bell marker at an actual exchange frontage, two usable
plaza approaches and continuous, returnable travel onto the visible gantry.

The unchanged conservative nav grid reports 37,097 walkable centres among 77,589
in-bounds centres (47.8122%). All rounded centres outside the world remain blocked.
All ninety-eight sites are reachable outward and back. Fourteen regional roads
and all seven City paths pass actual radius24 sweep/ground checks. The world has
616 visible pieces and 576 blockers. City's 1,800 by 1,800 court has 192 clear
samples out of 225 (85.33%), separate reachable exits, and accessible short/tall
cover. The existing River-Woods nominal38.17-second pacing warning remains.
Full-width travel, combat pacing and exact geometric open area are not proven by
these centre-path and lattice checks.

GREEN children 53344, 49368 and 32076 closed normally with exit zero, no signal,
and were observed absent. The exact shared marker was released and observed
absent before the next lane received the slot. Seven official authority files
remained byte-identical. Tests do not invoke Git. The source installer initially
hit a text-decoding error while reading the syntax inventory; the remaining two
registrations were completed with explicit UTF-8 before GREEN. No source test
failure was discarded.

The area brief records intentional future terrain and prop placement: broad worn
public paving, rougher service surfaces with loading wear, sparse clean stone in
the plaza, smaller domestic detail by housing and readable gantry supports. These
are art directions to review against the approved bible/slice, not produced art.
City uses one displaced street label and short unique site labels; global plan
label scale remains a separate preview limitation.

One private preview build passed in129.7ms. The single actual Chrome attempt
passed in104.255s. These are job durations, not FPS or device performance. The
browser walked23desktop legs continuously from Meadows through City streets,
service alley, plaza and gantry, returned down the ramp, then contacted the
exchange north wall at y8325.999999. Gantry groundZ was24. The phone viewport
walked two road legs with keyboard controls and three legs with actual touch
controls/cancellation. No inspection jump was used. Four entry denials and both
pagehide cleanups passed. No page, resource, cleanup or overflow error occurred.

Build45652, browser child17912 and owned Chrome15480 closed normally with exit0
and no signal, then were observed absent. HTTP127.0.0.1:61342 emitted close before
the exact shared marker was released. Thirty-three source pins, seven authority
pins, two human runtime assets,188dependencies and three harnesses matched.
Compiled/actually served bytes and all capture identities matched too.

All nine desktop1280x800 and three phone1242x2688 originals were inspected. The
service lane and public/plaza split read clearly in plan; actor and controls are
contained and wall contact aligns. This is still flat greybox presentation:
plain masses, a sparse plaza, tiny plan text, some viewport-edge label clipping,
and Closing Bell text overlapping the actor during deliberate wall contact.
Closed-mass stripes remain inspection artifacts. No final-art acceptance follows.

Exact compressed source/browser observations are under
`docs/2.0/receipts/world-city/`, with raw/stored hashes in the manifest. The manual
review bundle is `outputs/hmh-city-authored-flow-preview.zip` in the shared task
workspace; its launcher uses local port8797 and packaging starts no service.

Both new files have exactly one syntax registration. Their JavaScript parsed
during focused/source-copy execution. No extra repository-wide syntax run,
normal build/default visual suite, full release gate, physical iPhone result,
world-streaming result or official-map acceptance is claimed for this slice.

No credits, production art, rule/version bump, push, deployment or owner approval
is claimed. Whole-area playtest, final art and the versioned W3 map review remain
open.
