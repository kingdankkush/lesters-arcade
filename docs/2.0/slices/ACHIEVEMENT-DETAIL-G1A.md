# G1a — focused badge preview

The optional collection preview now opens a single native dialog on “Inspect
badge”. The focused module loads only on inspection; the grid remains static.
It shows the same validated cabinet, tier, requirement, ownership, date and rarity
facts. There are no earning, wallet, storage, chain or simulation writes.

Drag tilt clamps to ±35°, arrow keys rotate by 5°, Home resets, and release/cancel,
focus loss or backgrounding returns to rest. Reduced motion stays static, including
when that preference changes while open. Native dialog keyboard containment and
Escape are retained. Focus returns to the current badge after an async repaint.
Disposal/profile replacement invalidates pending imports and suppresses stale focus.
There is no WebGL context, per-frame animation loop, sensor permission or gyro read.

## Verified behavior and failures retained

Seven initial missing-module RED cases were followed by implementation. Independent
review reproduced a queued-close/reopen focus bug, then eight cases passed. Three
integration RED cases preceded lazy loading/fallback/lifecycle wiring; 48 related
collection/profile tests passed. The first actual browser run found a phone Close
tap after dragging did not synthesize a click. Instrumented attempts confirmed
pointer-down/up/touch-end reached the button and Enter closed the dialog. A single
touch session and a CSS-only manipulation change did not fix it; all four failed
browser attempts remain in the receipt.

A focused RED reproduced missing compatibility click. Close now accepts a deliberate
primary touch release inside its bounds, cancelling movement beyond 10px, cancellation,
capture loss and other fingers. It suppresses that touch's compatibility mouse path;
native keyboard click remains. Ten focused cases pass, plus the exact 32-case
collection/detail copy without Git, dependencies or PATH. Repeated checks are not
additional tests. Independent source review found no remaining actionable issue.

Fresh build and real Chrome pass all ten cases, including immediate Close after
native touch drag, bounded tilt/reset, lazy module loading, keyboard focus, phone
containment, reduced motion, legacy/default-off and malformed rarity. Desktop and
414×896 at 2× phone-viewport screenshots are retained. No page errors; actual Chrome
exit0/null and HTTP closure precede owned-lock release for every browser attempt.
HMH initial plus shared remains 1,039,992 B (8,584 B headroom); STACKED 577,431 B
(29,569 B headroom). This is a current local build, not the full release gate.

## Art and device limits

The viewer uses existing low-resolution badge images. Their enlarged pixel art,
current global heading styling and focus frame are visibly provisional. This slice
does not approve final badge art, shaders, 3D trophies or the full profile redesign.
Population is synthetic fixture data, not live player statistics. Windows phone
viewports and touch events are not physical iPhone performance or soak acceptance.

Raw observations are losslessly archived in
`../receipts/achievement-detail-g1a/receipt.json`. The collection switch remains
`?achievementCollection=collection-v1`; production defaults and versions are unchanged.
