# HMH AAA Continuous Improvement Cycle 040

Date: `2026-07-31`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `36f4b1d2`

## Scope

1. **Joined-mesh structures** — the fence and shack rebuilt as vertex-authored
   flat-shaded solids (new `prism_mesh` helper: explicit vertex/face lists via
   `from_pydata`, no modifiers, no bevels). The fence is one comb solid (base
   rail, pickets and tips share a mesh) plus a crossing mid-rail and capped
   posts; the shack is a grooved wall slab, a closed gabled roof prism with
   course lines, and a capped chimney. **Both pass the strict bar** after four
   failed beveled-primitive iterations proved that technique was the ceiling —
   per-part bevels round everything into pills that never visually join.
   Restored to dressing: fence → liquidity-crossing + liquidation-yard,
   shack → mining-camp. 37 assets reproducible, anchors in bounds.
2. **Priority C first slice** — deterministic weapon benchmark
   (`npm run bench:hmh:weapons` → `docs/qa/hmh-weapon-benchmark.json`).
   4 weapons × base/maxed × close/mid/long through the real weapon-system and
   `resolveProjectilePath` modules: DPS, TTK, time-to-first-hit, reload
   downtime, empty time, reserve remaining, trigger accuracy. Two full runs
   compared with `deepEqual`; fails closed on drift or non-finite output.
   Flight is resolved against a static flat-ground target (documented in the
   report); moving targets and swarm pressure are the next extensions.
   **No balance values changed** — per the handoff, changes need this plus
   long-run simulations. First findings for the record: base shotgun cannot
   reach mid range (role-consistent, 320 range); maxed pistol sustains 45.3
   DPS at mid — the intended late-game fallback depth; finite-reserve weapons
   show meaningful empty-time (shotgun 16.9s of a 30s max-tier window).

## Gates

check 337+49 · prop tests 7/7 · test:release `1818/1766/52/0` · build
1002.7 KB → re-built with dressing · visual re-accepted (fence/shack scenes
inspected) · certification five profiles · performance p95 7ms/7ms · security
5/5 · web3 9/9 · assets:qa pass · props verify reproducible ×2 this cycle.

## Deployment

Pushed to the continuation branch (Vercel Preview). Owner gave explicit
blanket approval to proceed and push this session; production promotion still
requires the Vercel dashboard/authenticated CLI, which this environment does
not hold. `SETTLEMENT_LIVE` untouched.
