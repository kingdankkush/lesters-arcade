# HMH AAA Continuous Improvement Cycle 049

Date: `2026-08-02`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `1a281acd` (Cycle 048 closeout; production promoted)

## Scope: terrain visibility, traversal smoothing, measured pistol cadence

1. **Terrain visibility pass (owner: "still single color, no texture")** —
   the painted layering was real but value-compressed into invisibility at
   gameplay zoom. Bakery contrast step: underpainting `0.16 → 0.30`, value
   banding mix `0.24 → 0.34` (5 bands), stroke grain ×1.6, accent amounts
   ×1.35 across all 11 materials. Re-baked seamless-verified; ground reads
   granular mottling and the road reads gravel at gameplay zoom in the
   evidence captures. Remaining lever if the owner wants more: macro
   blotch decals / intra-district material patches (recorded in the task).
2. **Enemy corner smoothing** — `sampleFlowDirection` now blends one step
   of flow lookahead into a unit diagonal when the next cell turns AND the
   diagonal is walkable (no corner clipping by construction) — enemies cut
   smooth diagonals instead of marching grid staircases. Pure function of
   grid+field: determinism unchanged. New sweep test covers the whole map:
   every blended diagonal is unit-length and leads through walkable cells.
3. **Pistol cadence 2.6 → 3.0/s (measured balance, SIMULATION)** — the
   moving-target benchmark justified lifting sustained pressure: base @mid
   DPS `5.6 → 6.4` (+14%), maxed nearly flat (reload-bound, 45.3 → 46.9),
   parent design record updated in lockstep. The moving-vs-rusher per-shot
   rate dipped 0.179 → 0.141 (cadence/strafe phase sensitivity of the
   synthetic probe — recorded for honesty; absolute pressure is the point).
4. **Playtest sweep** — local 049 build boots clean (zero console errors,
   session ready, prop atlas ready); movement/weapons/collectibles/touch
   exercised by the green browser smokes. A direct keyboard probe through
   the embedded pane was inconclusive by construction (hidden-tab
   visibility pause — correct runtime behavior, noted).

Replay note: item 3 is a simulation change; pre-049 replays diverge.

## Gates

- check; terrain 13/13; navgrid 8/8 (new smoothing sweep); weapon suites
  green (cadence test re-derived at 20 ticks)
- test:release `1,846 / 1,794 / 52 / 0`
- visual regression 8/8 (contrast step stayed within signature tolerance;
  evidence captures inspected by eye regardless)
- certification five profiles; combat/collectibles smokes; mobile 4/4;
  perf PASS (bundle `1,040,559 / 1,050,000`); assets QA pass
