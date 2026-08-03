# HMH AAA Continuous Improvement Cycle 046

Date: `2026-08-02`
Status: `IN PROGRESS`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `cc5590fc` (Cycle 045 closeout; production promoted)

## Scope: debt-clearing quality packet

Three review follow-ups from earlier cycles, cleared as one bounded packet.

1. **Circle-blocker render fix** — `world-production-art.mjs` computed the
   visibility anchor for circle shapes from `shape.center`, which does not
   exist in the canonical collision form (`x`/`y`); a circle blocker would
   project NaN, fail the visibility test, and silently never render while
   still blocking movement. Latent (no authored circles yet), found by the
   Cycle 041 consumer audit. Fixed with a source regression guard.
2. **Navgrid lazy build — attempted, REVERTED with evidence.** Moving
   `createEnemyNavGrid` from module evaluation into `initializeSession`
   made the mobile-controls smoke fail deterministically on
   iphone-13-portrait ("hero kept moving after the touch ended"): the
   ~400 ms construction burst lands inside the interactive window and
   swallows a pointer-up. Bisected by stashing the change (4/4 without it,
   3/4 with it, twice). The module-scope build stays — it blocks first
   paint, which is annoying, but never drops input, which is worse. The
   open follow-up is now precise: the fix must be a CHUNKED build (idle
   slices before input binds), not a naive deferral.
3. **Driftwood-log polish (third pass)** — root end rebuilt as faceted
   chunk massing, fatter trunk, hard bleach/bark split. Honest verdict at
   full resolution: still under the bar — a long horizontal log
   fundamentally fights the 55° camera at dressing scale, the same failure
   mode as the first beveled fence/shack. The improved source ships in the
   atlas (reproducible ×2) but the asset REMAINS atlas-only; the crossing
   keeps its reed/boulder mix. If a fourth attempt happens it should
   re-concept (e.g. a stump-and-roots tidewrack pile), not iterate the log.

## Gates

(recorded at closeout)
