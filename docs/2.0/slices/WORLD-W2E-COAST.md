# W2e: Silver Coast local flow

Status: local source/layout/native-browser checkpoint passes. Owner playtest,
final area design and art remain open.

Silver Coast now uses two oblique rock polygons around a dry coastal shelf,
a faceted lighthouse, a shallow ramped overlook and a mansion wall shell.
The landward road and scenic shoreline route join the unchanged City and Bayou
entrances. The mansion secret is inside physical walls, reached through a south
door and exited through a separate west door. A coastal utility marker sits at
the west face of its actual roadside building. These spaces contrast with City's
orthogonal streets and Farms' open yard without adding random decorative props.

Sixteen pieces and six inspection paths replace only Coast's repeated template.
The 20,000 by 14,000 bounds, fourteen regional roads, Meadows/Farms/City authoring,
six remaining templates and official simulation are unchanged. Rock solids and
dry ground do not constitute water, tide, swimming, beach slowdown or new
traversal rules. No official map or mission is activated by this local preview.

Six new tests first ran against the prior template: five expected failures and
one passing official-isolation/fixed-road control. After the minimal Coast kit,
world import/dispatch and two syntax registrations, all forty-two related cases
passed. The same forty-two passed in an exact twenty-one-file copy with no .git,
no node_modules and an empty PATH. Those are repeated results, not eighty-four
distinct tests. No cases were skipped, cancelled or marked todo.

Checks require visible/collision polygon agreement, physically distinct routes,
and a real obstruction that blocks the scenic shore while leaving the landward
connection open. The mansion secret is inside a solid wall shell, with the path
entering and leaving through different faces. Other checks bind the objective
to the utility building and verify continuous, returnable travel onto the
visible overlook deck at groundZ24 and a separate lighthouse viewing approach.

The unchanged nav grid reports 36,842 walkable centres among 77,589 in-bounds
centres (47.4835%), with zero walkable rounded centres outside the exact world.
All ninety-eight sites are reachable outward and back; fourteen roads and six
Coast paths pass actual radius24 sweep/ground checks. The world has 619 pieces,
579 blockers, 479 closed masses and four boundary guards. Coast's 1,800 by 1,800
terrace court has 200 of 225 clear samples (88.89%), two reachable exits and usable
short/tall cover. The prior River-Woods nominal 38.17-second pacing warning
remains. Full-width travel, combat pacing and geometric open area are not proven
by these centre-path and lattice checks.

RED child 14136 closed with expected exit 1. GREEN children 54320, 17616 and 51916
closed normally with exit 0/no signal and were observed absent. The exact shared
marker was released and observed absent before handing off the source slot.
Seven official authority files remained byte-identical; tests never invoke Git.

The placement brief distinguishes exposed chalk rock, sparse dry shelf,
landward service wear, a sea-facing mansion, the lighthouse apron and an
understandable ramped overlook. This is future art placement intent, not produced
textures, models or accepted final terrain. The existing preview renderer and
its small/clipped labels remain unchanged for a separately tested UI follow-up.

One private preview build passed in 123.0 ms. The single actual Chrome attempt
passed in 72.334 seconds. These are job durations, not FPS or device performance.
It used exactly one visible UI inspection jump per viewport to start at Coast,
then 26 actual desktop walking legs and four touch walking legs. It does not
prove an uninterrupted Meadows-to-Coast road journey. The desktop walked inside
the mansion and out its west door, followed the scenic shelf, reached the
lighthouse approach and overlook at groundZ 24, returned down the ramp and
contacted the utility west wall at x3225.999999. Four denied entries and both
pagehide cleanups passed. No page, resource, cleanup or overflow error occurred.

Build 22912, browser child 19252 and owned Chrome 24908 closed normally with exit 0
and no signal, then were observed absent. HTTP 127.0.0.1:56365 emitted close before
the exact shared marker was released. Thirty-five source pins, seven authority
pins, two human runtime assets, 188 dependencies and three harnesses matched.
Compiled and actually served bytes and all capture identities matched too.

All nine desktop 1280x800 and three phone 1242x2688 originals were inspected. The
desktop plan distinguishes the cliff edge, two-door mansion and separate routes.
Actor and controls are contained; wall contact aligns and the overlook height
agrees with the snapshot. Phone walking frames show broad flat ground and path
with cliffs and landmarks off screen. Nearby landmarks and a stronger ground
hierarchy remain needed for final art/readability. Plan text remains tiny, some
world labels crop at viewport edges, and boundary stripes remain inspection
artifacts. These observations do not approve final area art or owner playtest.

Exact compressed source/browser observations are under
`docs/2.0/receipts/world-coast/`, with raw/stored hashes in the manifest. The manual
review bundle is `outputs/hmh-coast-authored-flow-preview.zip` in the shared task
workspace; its launcher uses local port 8798 and packaging starts no service.

Both new files have exactly one syntax registration. Their JavaScript parsed
during focused/source-copy execution. No extra repository-wide syntax run,
normal build/default visual suite, full release gate, physical iPhone result,
world streaming, official-map/verifier version, credits, push, deployment or
owner approval is claimed for this local source and navigation checkpoint.
