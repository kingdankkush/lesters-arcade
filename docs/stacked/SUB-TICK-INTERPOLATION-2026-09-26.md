# STACKED sub-tick active-piece interpolation (2026-09-26)

Pieces used to move in whole 60 Hz steps: the renderer received no
interpolation alpha, so a gravity fall was a 32 px hop and a horizontal shift
snapped a column. The active piece now travels between its previous and current
tick cells by the frame loop's leftover time. This is projection only.

## What moves

- The active piece's four visuals, and the music-reactive halo under them
  (`board-pulse.mjs`), by `(previous cell - current cell) * (1 - alpha)`.
- Gravity falls between rows, horizontal shifts and soft drops. Travel is capped
  at one cell per tick, so a level-15 two-row fall reads as one cell of motion.

## What snaps to the tick cell

Lock, hard drop, rotation, hold or swap, spawn, game over and a missing piece.

A fall whose cells would emerge from above the well rim snaps its vertical
travel and keeps its horizontal travel. The board culls rows at or above
`BOARD_VISIBLE_ROWS` (20), and every non-I piece spawns with its top cells on
row 20, so on its first fall (y 18 to 17 at one row per tick) those cells reach
row 19, authored y 0, and an offset of up to one cell would draw them over the
rim stroke and the backdrop; the halo would follow. The rule in
`active-interpolation.step()` is: if any cell of the current piece would start
its travel on a culled row (`y + dy >= BOARD_VISIBLE_ROWS`, with `dy` the capped
travel), `dy` is 0 for that tick. Travel that starts on a visible row is
untouched, so the I piece (spawns on row 19) and a level-15 two-row fall whose
capped travel starts on row 19 still interpolate. The controller therefore takes
the canonical `geometry` (`cellsFor`) and throws without it.

The ghost piece, locked cells, previews and effects never move with it.
Reduced motion switches interpolation off and renders whole-tick steps.

## How alpha reaches the renderer

`apps/stacked/src/main.mjs` keeps its fixed-step loop (`TICK_MS = 1000 / 60`,
at most four catch-up steps). After the steps it passes
`alpha = accumulator / TICK_MS` to `renderer.frame(snapshot, now, settings, alpha)`
while the run is stepping, and `1` when the run is paused, unstarted or
finished. `renderer.gameplay(before, snapshot)` records the tick delta for every
simulation step, so a frame with several catch-up steps interpolates the last
one only. Alpha at or past one is the tick state and consumes the delta, so a
resume at alpha 0 never jumps back a cell. A snapshot from another tick (undo,
restart) never inherits a delta, and `resetEffects()` clears it.

Module: `apps/stacked/src/render/active-interpolation.mjs`.
Board hook: `board.setActiveOffset(cellsX, cellsY)` / `board.activeOffset`
(authored px) in `board-view.mjs`; at most four transforms move per frame and
the offset object is reused, so per-frame allocations stay flat. A zero-step
frame still reuses the last projection: the same frozen snapshot short-circuits
the board rebuild while only the offset changes.

## Boundaries

- The simulation, the inputs consumed per tick, the evidence bytes, the replay
  and the result are untouched. `tests/stacked-active-interpolation.test.mjs`
  drives a Ranked play session with and without interpolation and proves
  byte-identical evidence, identical tick-by-tick positions and an identical
  result that the replay verifies; every STACKED replay, evidence and
  server-verify test passes unchanged.
- No parent (portal) change is needed.

## Verification

- `node --test tests/stacked-active-interpolation.test.mjs` (14 tests: alpha
  reaches the renderer, interpolated position formula and snaps, the rim rule
  on synthetic pieces and on the real seed `0x51a2` first fall through the real
  renderer and halo, zero-step frames reuse the last snapshot, reduced motion,
  reused offset object, canonical runtime deltas, determinism and replay proof).
- `node --test tests/stacked-*.test.mjs tests/server-verify-stacked.test.mjs`.
- `npm run check` (module and test registered in `scripts/syntax-check.mjs`).
- `scripts/stacked-playable-browser-smoke.mjs` against a local `apps/portal`
  static server (real frame loop and renderer path).
