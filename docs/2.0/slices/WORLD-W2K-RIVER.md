# W2k: Hashwood River bank routes and crossings

Status: local source/layout/native-browser checkpoint passes. All ten areas
now have distinct authored geometry in the private local preview. Whole-map
owner playtest, full area design, production art and gameplay integration
remain open.

Hashwood River replaces the final generic template with a transverse channel,
two north/south bridge crossings, a quiet lower-bank trail and an upper-bank
connection. The City and Woods approaches cross separately; Bayou and Pines
remain connected outside the optional southwest Baron clearing. A capstan
house has a practical southern apron beside the City bridge. A shaped
waterfall shelf supplies a secret approach and separate upper return leg.
Sixteen pieces and seven local paths replace the old footprint; all four
existing roads and endpoints remain exact.

Both bridges use the existing y-axis ramp contract, from ground to 24 and
back. Water remains nonwalkable ground with a matching visible polygon,
not a fabricated collision wall. No kit, preview renderer, active map,
collision, elevation, movement, main, nav authority or layout checker change
was needed. No Baron trigger, water physics, structural collapse, swimming,
climb/drop control, official map/rules version or canonical run is activated.

Seven tests first produced six genuine expected authored-layout failures and
one passing exact-road/local-authority control. The first GREEN run passed
99/100: its walker stopped within a four-unit tolerance just before the ramp
ended at groundZ 0.14146267337687846 while the assertion demanded zero. The
test now returns 50 units past the ramp into the already checked dry corridor.
The original failure is retained; no geometry or movement fix was needed.
The installer also stopped at an existing UTF-8 syntax file after Python used
the Windows cp1252 default; only the missing syntax entries were completed
with explicit UTF-8 before testing. See the preserved source notes.

Final 100/100 focused cases and the identical 100/100 in an exact 45-file copy
passed without Git/node_modules and with empty PATH. Counts repeat the same
cases; none were skipped, cancelled or todo. Source checks include both
directions across both bridges, three parallel legal crossing paths, actual
fixed-step y-axis ascent/descent and return, bridge-removal failure, blocked
water between crossings, full-court closure preserving regional routes,
outside-solid equipment approach and a returnable shelf nook. All seven
protected authority files remained unchanged.

Gross water plus solid footprint is 1,670,700 units², below the replaced
2,060,800 allowance. The unchanged conservative grid contains 36,749/77,589
walkable centres (47.363673%), 316 more than Bayou, with zero outside. All
98 sites are reachable/returnable; 14 roads and all 57 local paths pass,
including seven River paths. The 1,800 × 1,800 court has 217/225 open samples
(96.4444%), two usable exits and both cover heights. The existing River/Woods
38.17-second nominal pacing warning remains; these are layout checks rather
than encounter balance, current-hero timing or crowd performance evidence.

The single private build took 129.651 ms. The actual Chrome walkthrough took
93.267 seconds and completed 29 desktop keyboard legs plus four touch legs,
following one explicitly visible inspection jump per viewport. Desktop
checked both bridges and dry landings, the regional bank, marquee clearing,
equipment frontage, secret and its returning upper path. A separate upward
held-input check stopped at the visible water boundary between the bridges
with zero solid contacts. Touch crossed the City bridge, returned onto the
dry lower bank and followed it toward Pines. Four denied entries, both
pagehide cleanups and DOM containment passed, with zero page/resource/cleanup
errors, parent posts or storage writes. No continuous full regional journey
is claimed.

All ten desktop 1280×800 and four phone 1242×2688 originals were viewed. The
plans show separate northern loops, two river crossings, quiet bank and a
southern court. Shelf shape, objective standoff and bridge/shore boundaries
agree with the visible player position. The narrow phone bridge view exposes
only small edge strips of water; guide strokes obscure the deck centre.
Placeholder terrain is flat and sparse. Plan labels are tiny, actor markers
overlap labels and some canvas labels clip. The sprite can straddle the
shore under the unchanged centre-ground contract. These remain local
navigation visuals, not final art, whole-map acceptance or a physical-iPhone
performance result.

Source RED child 42172 and first GREEN child 29792 closed with expected exit
1/no signal. Final focused/copy/diagnostic children 46204/17780/10144 closed
exit 0/no signal. Private build/browser/Chrome children 30536/17724/22296
closed exit 0/no signal; all eight owned children were independently observed
absent. HTTP port 62740 emitted close. Exact owned markers were released and
observed absent before handoff. Job duration is not an FPS measurement.

The builder checked its own resolved preview dist target and ancestors as
contained and nonjunction before replacement. Fifty source inputs, seven
authority files, two human assets, 188 dependencies and three harness pins
matched; served bytes and original capture dimensions/identities matched.
No renderer or production build was changed, so no new default visual run or
baseline acceptance was bundled here. Compact lossless receipts are under
`docs/2.0/receipts/world-river/`; duplicate source trees and PNG originals stay
in the task workspace.

`outputs/hmh-river-authored-flow-preview.zip` contains the compiled local
preview with all ten authored areas, launch instructions and these captures.
Its launcher uses port 8804; packaging starts no server. The brief index now
records this local checkpoint and the remaining owner gate. No release gate,
Ranked E2E, measured streaming, physical-phone performance/soak, final art,
version bump, credit spend, push or deployment is claimed.
