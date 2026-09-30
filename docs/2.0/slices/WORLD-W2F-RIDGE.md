# W2f: Ledger Ridge local quarry flow

Status: local source/layout/native-browser checkpoint passes. Owner playtest,
full area design and art remain open.

Ledger Ridge now has a quarry switchback shaped by five rock cuts, a lower
service route across an open working landing, a tucked store branch, and a
maintenance shelf reached by ramps from both ends. The shelf's uplink marker
faces actual headframe equipment. Nearby north/south rock faces frame the clear
inspection junction so the phone view has closer geometric landmarks.

Fourteen pieces and five paths replace Ridge's repeated kit. The fixed City and
Fortress road endpoints, other nine areas, world bounds and official simulation
are unchanged. The small 24-unit shelf uses current ground/ramp behavior; it does
not implement final mountain-scale elevation, climbing, dropping or sniper AI.

Six new tests ran against the prior template: five genuine expected failures
and one passing road/official-isolation control. The minimal source then passed
48/48 focused cases and the same 48/48 in an exact 23-file copy with no .git,
no node_modules and empty PATH. These repeat the same cases, not 96 distinct
tests. No cases were skipped, cancelled or marked todo. Tests do not invoke Git.

Tests use actual two-way sweeps and ground traversal to check the quarry and
service routes. A 150-radius collision sweep clears the main route, establishing
a 300-unit moving band through the solid geometry. This does not prove full
ground support at every lateral point, crowd performance or combat pacing. A
real test obstruction blocks the quarry switchback while leaving the lower
connection usable. Other checks prove the store-facing secret and return loop,
the shelf's two ramps, objective stand-off, and clear inspection junction.

The unchanged conservative navigation grid reports 36,191 walkable centres of
77,589 in-bounds centres (46.6445%), with zero outside walkable centres. All 98
sites are reachable outward and back; all 14 roads and five Ridge paths pass.
The complete world now contains 620 pieces, 579 blockers, 479 closed masses and
four guards. The Ridge working landing has 204/225 clear samples (90.6667%),
two reachable exits and usable short/tall peripheral cover. The previous
River-Woods nominal 38.17-second warning remains. These lattice measurements
are not exact geometric-area, combat or performance certification.

The Ridge main polyline is 5,400 units, the lower service route 1,900, the store
loop 4,070, the uplink approach 125 and the headframe viewing approach 1,450.
Those are authored lengths, not timed native-player route durations.

RED child 52936 closed with expected exit 1 and no signal. GREEN children 24128,
9004 and 25076 closed normally with exit 0/no signal and were observed absent.
The owned shared marker was released and observed absent before the Character
native handoff. All seven protected authority/checker files stayed byte-identical.

One private preview build passed in 139.9 ms. The single Chrome attempt passed
in 58.559 seconds. These are job durations, not frame-rate/device performance.
It used one explicit visible inspection jump per viewport followed by 16 native
keyboard legs and three native touch legs. It covered the lower service route,
quarry turns, store nook, shelf and uplink face. Desktop and touch reached shelf
groundZ 24, the desktop returned down the west ramp to groundZ 0, and a separate
headframe south-face contact stopped at y1504.000001. This is local route
coverage, not a continuous regional journey. Four denied entries and both
pagehide cleanups passed without page/resource/cleanup/overflow errors.

Build 15736, browser child 10932 and owned Chrome 15244 closed with exit 0/no
signal and were independently observed absent. HTTP 127.0.0.1:56891 emitted close
before the owned marker was released. All 37 source pins, seven authority pins,
two human runtime assets, 188 dependencies and three harnesses matched before
and after. The built and actually served bytes and all capture identities match.

All eight desktop 1280x800 and three phone 1242x2688 original images were viewed.
Both plans show a coherent quarry loop and separate southeast working landing.
The phone entry now shows nearby north/south rock faces, and the shelf view
contains the headframe; these are closer landmarks than the Coast walk frames.
Actor and controls remain contained. Flat masses, a sparse service yard, tiny
plan text and boundary stripes remain. The uplink label overlaps the actor in
the maintenance-shelf capture. This records a local geometry/framing improvement,
not final art approval. The preview renderer is unchanged.

Exact compressed RED/GREEN/copy/browser observations are under
`docs/2.0/receipts/world-ridge/`, with raw/stored identities in the manifest.
The manual exact-byte bundle is `outputs/hmh-ridge-authored-flow-preview.zip`
in the shared task workspace; its launcher uses port 8799 and packaging starts
no service. Both new files have one syntax registration and parsed during the
focused/copy checks. No extra repository-wide syntax run, normal build/default
visual suite, full release gate, physical iPhone result, streaming result,
official-map/verifier version, credits, push, deployment or owner approval is
claimed. The small 24-unit shelf remains a navigation prototype, not final
mountain-scale elevation.
