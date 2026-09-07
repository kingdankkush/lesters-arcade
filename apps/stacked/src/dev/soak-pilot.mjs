import { cellsFor, collides, compactCompletedRows, SPAWN_ORIGIN, attemptRotation } from '../../../portal/src/stacked-sim.mjs';
import { BOARD_WIDTH, BOARD_ROWS, STACKED_ACTIONS } from '../../../portal/src/stacked-contracts.mjs';

// Developer-only greedy lookahead. These heuristic weights are not balance
// constants, human telemetry or proof of player skill; no Ranked caller allowed.
function surfaceCost(board) {
  const heights = Array(BOARD_WIDTH).fill(0);
  let holes = 0, rowTransitions = 0, columnTransitions = 0, wells = 0;
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    let covered = false, previous = false, wellDepth = 0;
    for (let y = BOARD_ROWS - 1; y >= 0; y -= 1) {
      const solid = board[y * BOARD_WIDTH + x] !== 0;
      if (solid && !covered) { heights[x] = y + 1; covered = true; }
      if (!solid && covered) holes += 1;
      if (solid !== previous) columnTransitions += 1;
      previous = solid;
      const left = x === 0 || board[y * BOARD_WIDTH + x - 1] !== 0;
      const right = x === BOARD_WIDTH - 1 || board[y * BOARD_WIDTH + x + 1] !== 0;
      if (!solid && left && right) { wellDepth += 1; wells += wellDepth; } else wellDepth = 0;
    }
    if (!previous) columnTransitions += 1;
  }
  const maximum = Math.max(...heights);
  for (let y = 0; y < maximum; y += 1) {
    let previous = true;
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const solid = board[y * BOARD_WIDTH + x] !== 0;
      if (solid !== previous) rowTransitions += 1;
      previous = solid;
    }
    if (!previous) rowTransitions += 1;
  }
  let bumpiness = 0;
  for (let x = 1; x < BOARD_WIDTH; x += 1) bumpiness += Math.abs(heights[x] - heights[x - 1]);
  return holes * 80 + heights.reduce((a, b) => a + b, 0) * 5 + bumpiness * 4 + maximum * 5 + rowTransitions * 2 + columnTransitions * 4 + wells * 3;
}
function placements(board, active) {
  const choices = [];
  for (let rotation = 0; rotation < (active.kind === 'O' ? 1 : 4); rotation += 1) {
    const rotated = rotation === active.rotation ? active : attemptRotation(board, active, rotation);
    if (!rotated) continue;
    for (let x = -3; x < BOARD_WIDTH; x += 1) {
      let reachable = true;
      const direction = Math.sign(x - rotated.x);
      for (let testX = rotated.x; testX !== x; testX += direction) {
        if (collides(board, cellsFor(active.kind, rotation, testX, rotated.y))) { reachable = false; break; }
      }
      if (!reachable || collides(board, cellsFor(active.kind, rotation, x, rotated.y))) continue;
      let y = rotated.y;
      while (!collides(board, cellsFor(active.kind, rotation, x, y - 1))) y -= 1;
      const placed = Uint8Array.from(board);
      for (const [cx, cy] of cellsFor(active.kind, rotation, x, y)) placed[cy * BOARD_WIDTH + cx] = 1;
      const compacted = compactCompletedRows(placed);
      choices.push({ x, rotation, board: compacted.board, cost: surfaceCost(compacted.board) - compacted.lines * 80 + y * 2 });
    }
  }
  choices.sort((a, b) => a.cost - b.cost || a.rotation - b.rotation || a.x - b.x);
  return choices;
}
function choose(state) {
  const candidates = placements(state.board, state.active);
  let best = candidates[0] ?? { x: state.active.x, rotation: state.active.rotation, cost: 0 };
  let bestCost = Infinity;
  for (const candidate of candidates.slice(0, 6)) {
    const next = state.queue[0];
    const future = placements(candidate.board, { kind: next, rotation: 0, ...SPAWN_ORIGIN[next] });
    const cost = candidate.cost + (future[0]?.cost ?? 1000000);
    if (cost < bestCost) { best = candidate; bestCost = cost; }
  }
  return { x: best.x, rotation: best.rotation };
}
export function createStackedSoakPilot({ mode } = {}) {
  if (mode !== 'free') throw new Error('soak pilot is Free-only');
  let piece = -1, plan = null, lastMask = 0, lastX = null, lastRotation = null;
  const bit = action => 1 << STACKED_ACTIONS.indexOf(action);
  return Object.freeze({
    sample(state) {
      if (state.terminal || !state.active) return 0;
      if (piece !== state.piecesSpawned || !plan || ((lastMask & 3) && state.active.x === lastX) || ((lastMask & 112) && state.active.rotation === lastRotation)) {
        plan = choose(state); piece = state.piecesSpawned;
      }
      const difference = (plan.rotation - state.active.rotation + 4) % 4;
      let mask = difference ? bit(difference === 1 ? 'rotateCW' : difference === 2 ? 'rotate180' : 'rotateCCW')
        : state.active.x < plan.x ? bit('moveRight') : state.active.x > plan.x ? bit('moveLeft') : bit('hardDrop');
      if (mask & lastMask) mask = 0;
      lastMask = mask; lastX = state.active.x; lastRotation = state.active.rotation;
      return mask;
    },
  });
}

