# Visible cover protection — October 3

Presentation candidate for master item 12. The current cover face gains a quiet
grounded edge highlight and a small shield badge beside the utility controls.
The badge reads 60% for tall cover and 40% for short cover from the existing
cover-v1 rules. Its explanation qualifies protection as damage from the
covered side; it does not promise protection from all directions or above the
cover. Moving away hides the badge. Cover timing, damage, collision, pose clips,
inputs and run-summary counters remain unchanged.

The helper loads through the existing lazy ten-area combat chunk. It owns one
four-coordinate buffer, two bounded Pixi paths and no textures, filters,
listeners or timers. DOM changes are diffed, the badge resets for each session,
and reduced motion freezes the existing contextual prompt pulse. The actual
cover anchor/tangent and hero ground elevation locate the edge. Every stroke
rebuilds its path because Pixi consumes a path when stroking it.

Tests were RED before implementation, then 42/42 passed across the new three
readability cases and existing cover/gameplay wiring. They exercise real Pixi
GraphicsContext instructions, exact ground projection, unchanged authoritative
state, both reduction values, invalid/free states and repeated DOM writes.
Independent read-only review found no concrete authority/lifecycle blocker.

First actual desktop capture verified entry, shield and movement-only exit,
but the wall hid the highlighted ground edge. The correction draws the active
edge on a separate bounded graphic above world-depth art. A second screenshot
still showed no edge: Pixi compiled the typed-array polygon with undefined
coordinates. A reusable plain numeric array fixes it, with a RED/GREEN actual
compiled-shape assertion. Fresh desktop and phone viewport captures now show
the edge, contained shield and movement-only exit. Current
ordinary cover placeholders still need their own world-art replacement; this
cue does not make the placeholder walls final art or add a gamepad cover button.
