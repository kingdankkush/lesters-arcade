// Sub-tick interpolation of the active piece (projection only, 2026-09-26).
//
// The simulation advances in whole 60 Hz ticks and the frame loop in main.mjs
// carries the leftover time in an accumulator. Between ticks the renderer
// offsets the active piece from the cell it occupied on the previous tick
// toward the cell it occupies now by alpha = accumulator / TICK_MS, so gravity
// falls, horizontal shifts and soft drops read as travel instead of 32 px hops.
//
// Boundaries:
// - Reads committed snapshots only. Nothing here touches the runtime, the
//   inputs consumed per tick, the evidence, the replay or the result.
// - Travel is capped at one cell per tick, and the piece snaps to its tick cell
//   on lock, hard drop, rotation, hold or swap, spawn and game over.
// - The board culls rows at or above BOARD_VISIBLE_ROWS (the well rim). A fall
//   whose cells would be drawn sliding down from a culled row snaps its
//   vertical travel and keeps the horizontal one, so the rigid piece never
//   crosses the rim. Every non-I piece spawns with cells on row 20, so this is
//   its first fall; travel that starts on a visible row is untouched.
// - The ghost piece, locked cells and effects never move with it.
// - Off under reduced motion (the caller passes enabled = false).
// - The offset object is reused every frame: no per-frame allocation.
import { BOARD_VISIBLE_ROWS } from '../../../portal/src/stacked-contracts.mjs';

export const TICK_MS = 1000 / 60;

const clampCell = value => value > 1 ? 1 : value < -1 ? -1 : value;

export function createActiveInterpolation({ geometry } = {}) {
  if (typeof geometry?.cellsFor !== 'function') throw new TypeError('active interpolation requires canonical cellsFor geometry');
  // Cells the piece travelled during the recorded tick, as previous minus
  // current, and the tick the delta belongs to.
  let dx = 0, dy = 0, tick = -1;
  const offset = { x: 0, y: 0 };
  // True when a cell of the current piece would start its travel on a culled row.
  const startsAboveRim = (piece, travel) => geometry.cellsFor(piece.kind, (piece.rotation ?? 0) & 3, piece.x ?? 0, piece.y ?? 0).some(([, y]) => y + travel >= BOARD_VISIBLE_ROWS);
  return Object.freeze({
    // Called once per simulation step with the snapshots around it.
    step(before, after) {
      tick = after.tick;
      const a = before.active, b = after.active;
      const snap = !a || !b || after.terminal
        || after.piecesLocked !== before.piecesLocked
        || after.piecesSpawned !== before.piecesSpawned
        || after.holdsUsed !== before.holdsUsed
        || after.hardDropCells !== before.hardDropCells
        || a.kind !== b.kind || a.rotation !== b.rotation;
      dx = snap ? 0 : clampCell(a.x - b.x);
      dy = snap ? 0 : clampCell(a.y - b.y);
      if (dy > 0 && startsAboveRim(b, dy)) dy = 0;
    },
    // Cell offset for this frame (board coordinates: +y is up the well). Alpha
    // at or past one is the tick state itself and consumes the delta, so a
    // paused or capped catch-up frame never leaves a jump behind for later.
    offset(snapshot, alpha, enabled) {
      if (!(alpha < 1)) { dx = 0; dy = 0; }
      if (!enabled || snapshot.tick !== tick || (dx === 0 && dy === 0)) { offset.x = 0; offset.y = 0; return offset; }
      const remaining = 1 - (alpha > 0 ? alpha : 0);
      offset.x = dx * remaining;
      offset.y = dy * remaining;
      return offset;
    },
    reset() { dx = 0; dy = 0; tick = -1; offset.x = 0; offset.y = 0; },
    get dx() { return dx; },
    get dy() { return dy; },
  });
}
