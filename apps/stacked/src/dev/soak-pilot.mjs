import {
  cellsFor,
  collides,
  compactCompletedRows,
  SPAWN_ORIGIN,
  attemptRotation,
  levelForLines,
} from '../../../portal/src/stacked-sim.mjs';
import {
  BOARD_WIDTH,
  BOARD_ROWS,
  BOARD_VISIBLE_ROWS,
  STACKED_ACTIONS,
  STACKED_GRAVITY_Q16,
  STACKED_Q16_SCALE,
  GRAVITY_LEVEL_CAP,
  LOCK_LEVEL_CAP,
  LOCK_DELAY_TICKS,
  LOCK_RESET_CAP,
} from '../../../portal/src/stacked-contracts.mjs';

// Developer-only bounded lookahead. These heuristic weights are not balance
// constants, human telemetry or proof of player skill; no Ranked caller allowed.
const ACTION = Object.freeze(Object.fromEntries(
  STACKED_ACTIONS.map((name, index) => [name, 1 << index]),
));
const SEARCH_ACTIONS = Object.freeze([
  0,
  ACTION.moveLeft,
  ACTION.moveRight,
  ACTION.rotateCW,
  ACTION.rotateCCW,
  ACTION.rotate180,
]);
const CURRENT_SEARCH = Object.freeze({ maxTicks: 20, maxFrontier: 160 });
const FUTURE_SEARCH = Object.freeze({ maxTicks: 16, maxFrontier: 64 });
const FUTURE_CANDIDATES = 6;

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
      if (!solid && left && right) { wellDepth += 1; wells += wellDepth; }
      else wellDepth = 0;
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
  for (let x = 1; x < BOARD_WIDTH; x += 1) {
    bumpiness += Math.abs(heights[x] - heights[x - 1]);
  }
  return holes * 80
    + heights.reduce((a, b) => a + b, 0) * 5
    + bumpiness * 4
    + maximum * 5
    + rowTransitions * 2
    + columnTransitions * 4
    + wells * 3;
}

const lockIndex = level => Math.min(level, LOCK_LEVEL_CAP) - 1;
const lockDelay = level => LOCK_DELAY_TICKS[lockIndex(level)];
const lockResetCap = level => LOCK_RESET_CAP[lockIndex(level)];
const gravityFor = level => STACKED_GRAVITY_Q16[Math.min(level, GRAVITY_LEVEL_CAP)];

function comparePaths(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function compareCandidates(left, right) {
  return left.cost - right.cost
    || left.rotation - right.rotation
    || left.x - right.x
    || left.y - right.y
    || comparePaths(left.path, right.path);
}

function establishNewLowest(active, level) {
  if (active.y >= active.lowestYReached) return false;
  active.lowestYReached = active.y;
  active.lockResetsUsed = 0;
  active.lockTimer = lockDelay(level);
  return true;
}

function resetForAction(active, level) {
  if (active.lockResetsUsed >= lockResetCap(level)) return;
  active.lockTimer = lockDelay(level);
  active.lockResetsUsed += 1;
}

function simulateTick(board, source, mask) {
  const node = {
    active: { ...source.active },
    prevMask: source.prevMask,
    gravityAccQ16: source.gravityAccQ16,
    level: source.level,
  };
  let active = node.active;
  const oldMask = node.prevMask;
  const rising = mask & ~oldMask;
  node.prevMask = mask;

  let target = null;
  if ((rising & ACTION.rotateCCW) !== 0) target = (active.rotation + 3) & 3;
  else if ((rising & ACTION.rotateCW) !== 0) target = (active.rotation + 1) & 3;
  else if ((rising & ACTION.rotate180) !== 0) target = (active.rotation + 2) & 3;
  if (target !== null) {
    const rotated = attemptRotation(board, active, target);
    if (!rotated) return null;
    active = {
      ...rotated,
      lastActionWasRotation: true,
      lockTimer: active.lockTimer,
      lockResetsUsed: active.lockResetsUsed,
      lowestYReached: active.lowestYReached,
    };
    node.active = active;
    if (!establishNewLowest(active, node.level)) resetForAction(active, node.level);
  }

  let horizontal = 0;
  if ((rising & 3) === 3) horizontal = 1;
  else if ((rising & ACTION.moveLeft) !== 0) horizontal = -1;
  else if ((rising & ACTION.moveRight) !== 0) horizontal = 1;
  else if ((oldMask & 3) === 3 && (mask & 3) === ACTION.moveLeft) horizontal = -1;
  else if ((oldMask & 3) === 3 && (mask & 3) === ACTION.moveRight) horizontal = 1;
  if (horizontal !== 0) {
    if (collides(board, cellsFor(active.kind, active.rotation, active.x + horizontal, active.y))) {
      return null;
    }
    active.x += horizontal;
    active.lastActionWasRotation = false;
    if (!establishNewLowest(active, node.level)) resetForAction(active, node.level);
  }

  node.gravityAccQ16 += gravityFor(node.level);
  while (node.gravityAccQ16 >= STACKED_Q16_SCALE) {
    if (collides(board, cellsFor(active.kind, active.rotation, active.x, active.y - 1))) {
      node.gravityAccQ16 = 0;
      break;
    }
    active.y -= 1;
    active.lastActionWasRotation = false;
    node.gravityAccQ16 -= STACKED_Q16_SCALE;
    establishNewLowest(active, node.level);
  }

  let locked = false;
  if (collides(board, cellsFor(active.kind, active.rotation, active.x, active.y - 1))) {
    active.lockTimer -= 1;
    locked = active.lockTimer <= 0;
  }
  return { node, locked };
}

function makeCandidate(board, sourceActive, path, endMask, gravityAccQ16, hardDrop) {
  const active = { ...sourceActive };
  if (hardDrop) {
    while (!collides(board, cellsFor(active.kind, active.rotation, active.x, active.y - 1))) {
      active.y -= 1;
    }
    active.lastActionWasRotation = false;
  }
  const cells = cellsFor(active.kind, active.rotation, active.x, active.y);
  if (cells.every(([, y]) => y >= BOARD_VISIBLE_ROWS)) return null;
  const placed = Uint8Array.from(board);
  for (const [x, y] of cells) placed[y * BOARD_WIDTH + x] = 1;
  const compacted = compactCompletedRows(placed);
  return {
    x: active.x,
    y: active.y,
    rotation: active.rotation,
    board: compacted.board,
    lines: compacted.lines,
    cost: surfaceCost(compacted.board) - compacted.lines * 80 + active.y * 2,
    path,
    endMask,
    gravityAccQ16,
  };
}

function nodeKey(node) {
  const active = node.active;
  return [
    active.x,
    active.y,
    active.rotation,
    active.lockTimer,
    active.lockResetsUsed,
    active.lowestYReached,
    node.prevMask,
    node.gravityAccQ16,
  ].join(':');
}

function candidateKey(candidate) {
  return `${candidate.rotation}:${candidate.x}:${candidate.y}`;
}

function searchPlacements(board, initial, { maxTicks, maxFrontier }) {
  if (maxTicks < 1 || maxFrontier < 1) return [];

  const found = new Map();
  const placementKey = candidate => candidateKey(candidate);

  const retainCandidate = candidate => {
    if (!candidate) return;
    const key = placementKey(candidate);
    const previous = found.get(key);
    if (!previous || compareCandidates(candidate, previous) < 0) {
      found.set(key, candidate);
    }
  };

  const boundsFor = rotation => {
    const cells = cellsFor(initial.active.kind, rotation, 0, 0);
    let minimumCellX = Infinity;
    let maximumCellX = -Infinity;
    for (const [x] of cells) {
      minimumCellX = Math.min(minimumCellX, x);
      maximumCellX = Math.max(maximumCellX, x);
    }
    return {
      minimum: -minimumCellX,
      maximum: BOARD_WIDTH - 1 - maximumCellX,
    };
  };

  const rotationMaskFor = (from, to) => {
    const delta = (to - from + 4) & 3;
    if (delta === 1) return ACTION.rotateCW;
    if (delta === 2) return ACTION.rotate180;
    if (delta === 3) return ACTION.rotateCCW;
    return 0;
  };

  const advance = (run, mask) => {
    if (run.done || run.path.length >= maxTicks) return false;
    const stepped = simulateTick(board, run.node, mask);
    if (!stepped) {
      run.done = true;
      return false;
    }

    run.node = stepped.node;
    run.path.push(mask);
    if (stepped.locked) {
      retainCandidate(makeCandidate(
        board,
        stepped.node.active,
        run.path.slice(),
        stepped.node.prevMask,
        stepped.node.gravityAccQ16,
        false,
      ));
      run.done = true;
    }
    return true;
  };

  const startRun = () => {
    const run = { node: initial, path: [], done: false };
    if (initial.prevMask !== 0) advance(run, 0);
    return run;
  };

  const pulse = (run, mask) => {
    if (!advance(run, mask) || run.done) return false;
    if (!advance(run, 0) || run.done) return false;
    return true;
  };

  const moveTo = (run, targetX) => {
    while (!run.done && run.node.active.x !== targetX) {
      const mask = targetX < run.node.active.x
        ? ACTION.moveLeft
        : ACTION.moveRight;
      if (!pulse(run, mask)) return false;
    }
    return !run.done && run.node.active.x === targetX;
  };

  const rotateTo = (run, targetRotation) => {
    if (run.done) return false;
    if (run.node.active.rotation === targetRotation) return true;
    const mask = rotationMaskFor(run.node.active.rotation, targetRotation);
    if (mask === 0 || !pulse(run, mask)) return false;
    return run.node.active.rotation === targetRotation;
  };

  const finishWithHardDrop = run => {
    if (run.done) return;
    if ((run.node.prevMask & ACTION.hardDrop) !== 0) {
      if (!advance(run, 0) || run.done) return;
    }
    if (run.path.length >= maxTicks) return;

    const source = run.node;
    const path = [...run.path, ACTION.hardDrop];
    const tested = simulateTick(board, source, ACTION.hardDrop);
    if (!tested) return;

    retainCandidate(makeCandidate(
      board,
      source.active,
      path,
      ACTION.hardDrop,
      source.gravityAccQ16,
      true,
    ));
    run.done = true;
  };

  const orientations = initial.active.kind === 'O'
    ? [initial.active.rotation]
    : [0, 1, 2, 3];

  for (const rotation of orientations) {
    const bounds = boundsFor(rotation);
    for (let targetX = bounds.minimum; targetX <= bounds.maximum; targetX += 1) {
      const run = startRun();
      if (run.done) continue;
      if (!rotateTo(run, rotation)) continue;
      if (!moveTo(run, targetX)) continue;
      if (run.node.active.rotation !== rotation || run.node.active.x !== targetX) continue;
      finishWithHardDrop(run);
    }
  }

  const initialBounds = boundsFor(initial.active.rotation);
  for (const rotation of orientations) {
    if (rotation === initial.active.rotation) continue;
    const finalBounds = boundsFor(rotation);
    for (let horizontalX = initialBounds.minimum;
      horizontalX <= initialBounds.maximum;
      horizontalX += 1) {
      const run = startRun();
      if (run.done) continue;
      if (!moveTo(run, horizontalX)) continue;
      if (!rotateTo(run, rotation)) continue;
      if (run.node.active.rotation !== rotation) continue;
      if (run.node.active.x < finalBounds.minimum
        || run.node.active.x > finalBounds.maximum) continue;
      finishWithHardDrop(run);
    }
  }

  return [...found.values()].sort(compareCandidates);
}

function spawnNode(board, kind, level, gravityAccQ16, prevMask) {
  const origin = SPAWN_ORIGIN[kind];
  const active = {
    kind,
    rotation: 0,
    x: origin.x,
    y: origin.y,
    lastKickIndex: 0,
    lastActionWasRotation: false,
    lockTimer: lockDelay(level),
    lockResetsUsed: 0,
    lowestYReached: origin.y,
  };
  if (collides(board, cellsFor(kind, 0, active.x, active.y))) return null;
  if (!collides(board, cellsFor(kind, 0, active.x, active.y - 1))) active.y -= 1;
  active.lowestYReached = active.y;
  return { active, prevMask, gravityAccQ16, level };
}

function chooseRoute(state) {
  const board = Uint8Array.from(state.board);
  const initial = {
    active: { ...state.active },
    prevMask: state.prevMask,
    gravityAccQ16: state.gravityAccQ16,
    level: state.level,
  };
  const candidates = searchPlacements(board, initial, CURRENT_SEARCH);
  if (candidates.length === 0) {
    return (state.prevMask & ACTION.hardDrop) !== 0
      ? [0, ACTION.hardDrop]
      : [ACTION.hardDrop];
  }

  let best = null;
  let bestCost = Infinity;
  for (const candidate of candidates.slice(0, FUTURE_CANDIDATES)) {
    let futureCost = 1000000;
    const nextKind = state.queue[0];
    if (nextKind) {
      const nextLevel = levelForLines(state.startLevel, state.lines + candidate.lines);
      const next = spawnNode(
        candidate.board,
        nextKind,
        nextLevel,
        candidate.gravityAccQ16,
        candidate.endMask,
      );
      if (next) {
        const future = searchPlacements(candidate.board, next, FUTURE_SEARCH);
        if (future[0]) futureCost = future[0].cost;
      }
    }
    const total = candidate.cost + futureCost;
    if (total < bestCost
      || (total === bestCost && (!best || compareCandidates(candidate, best) < 0))) {
      best = candidate;
      bestCost = total;
    }
  }
  return [...best.path];
}

function maskIsLiveLegal(state, mask) {
  if (mask !== 0 && mask === state.prevMask) return false;
  if ((mask & ACTION.moveLeft) !== 0
    && collides(state.board, cellsFor(
      state.active.kind,
      state.active.rotation,
      state.active.x - 1,
      state.active.y,
    ))) return false;
  if ((mask & ACTION.moveRight) !== 0
    && collides(state.board, cellsFor(
      state.active.kind,
      state.active.rotation,
      state.active.x + 1,
      state.active.y,
    ))) return false;

  let target = null;
  if ((mask & ACTION.rotateCCW) !== 0) target = (state.active.rotation + 3) & 3;
  else if ((mask & ACTION.rotateCW) !== 0) target = (state.active.rotation + 1) & 3;
  else if ((mask & ACTION.rotate180) !== 0) target = (state.active.rotation + 2) & 3;
  return target === null || attemptRotation(state.board, state.active, target) !== null;
}

export function createStackedSoakPilot({ mode } = {}) {
  if (mode !== 'free') throw new Error('soak pilot is Free-only');
  let plannedPiece = -1;
  let route = [];

  return Object.freeze({
    sample(state) {
      if (state.terminal || !state.active) return 0;
      if (plannedPiece !== state.piecesSpawned || route.length === 0) {
        plannedPiece = state.piecesSpawned;
        route = chooseRoute(state);
      }

      let mask = route[0] ?? 0;
      if (!maskIsLiveLegal(state, mask)) {
        route = chooseRoute(state);
        mask = route[0] ?? 0;
      }
      if (!maskIsLiveLegal(state, mask)) {
        route = [];
        return (state.prevMask & ACTION.hardDrop) === 0 ? ACTION.hardDrop : 0;
      }

      route.shift();
      return mask;
    },
  });
}
