import { resolveSweptTraversalPath } from './elevation.mjs';

// Deterministic navgrid + flow field over the authored world contract, so
// enemies route around blockers instead of pressing into them (MAP-REDO
// slice 3). Runtime authority: SIMULATION — the field feeds enemy intent.
// Everything here is derived from authored world data with fixed iteration
// order and integer BFS costs; no RNG, no wall-clock, no float accumulation
// across ticks, so same-seed replays stay stable.

// 60 world units: fine enough that the 216-unit corridor between the bridge
// rails keeps two walkable rows, coarse enough that the full grid (200 x 80)
// builds in well under a second at boot and a BFS costs microseconds.
export const ENEMY_NAV_CELL_SIZE = 60;

// The strictest movement limits across every ordinary archetype, so one
// shared field is legal for all of them (gas-bomber: drop 12, ascent 48).
const CONSERVATIVE_TRANSITION = Object.freeze({
  maxCurbHeight: 8,
  maxDropHeight: 12,
  maxAuthoredAscent: 48,
});

// A cell is unwalkable when its centre sits inside a blocker inflated by a
// typical ordinary-enemy radius, or on untraversable ground (deep water).
const ENEMY_CLEARANCE_RADIUS = 18;

function pointInsideInflatedShape(shape, x, y, inflate) {
  if (shape.type === 'circle') {
    return Math.hypot(x - shape.x, y - shape.y) <= shape.radius + inflate;
  }
  if (shape.type === 'capsule') {
    const abx = shape.b.x - shape.a.x;
    const aby = shape.b.y - shape.a.y;
    const lengthSquared = abx * abx + aby * aby;
    const t = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - shape.a.x) * abx + (y - shape.a.y) * aby) / lengthSquared));
    return Math.hypot(x - (shape.a.x + t * abx), y - (shape.a.y + t * aby)) <= shape.radius + inflate;
  }
  // Convex polygon: inside when on the interior side of every edge, or within
  // `inflate` of any edge.
  const vertices = shape.vertices;
  let inside = true;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross < 0) inside = false;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSquared = abx * abx + aby * aby;
    const t = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / lengthSquared));
    if (Math.hypot(x - (a.x + t * abx), y - (a.y + t * aby)) <= inflate) return true;
  }
  return inside;
}

export function createEnemyNavGrid({ world, queryGround, cellSize = ENEMY_NAV_CELL_SIZE } = {}) {
  if (!world?.bounds || !Array.isArray(world.collisionBlockers)) throw new TypeError('world with bounds and collisionBlockers is required');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new TypeError('cellSize must be positive');
  const { minX, minY, maxX, maxY } = world.bounds;
  const columns = Math.ceil((maxX - minX) / cellSize);
  const rows = Math.ceil((maxY - minY) / cellSize);
  const walkable = new Uint8Array(columns * rows);

  const centreX = (column) => minX + (column + 0.5) * cellSize;
  const centreY = (row) => minY + (row + 0.5) * cellSize;

  // A 3x3 sample lattice per cell so thin authored walls (fences are radius
  // 18) cannot slip between cell centres and vanish from the grid.
  const SAMPLE_OFFSETS = [0.1, 0.5, 0.9];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const ground = queryGround(centreX(column), centreY(row));
      let open = !(ground.kind === 'water' && ground.deepWater);
      if (open) {
        blocked: for (const blocker of world.collisionBlockers) {
          for (const oy of SAMPLE_OFFSETS) {
            for (const ox of SAMPLE_OFFSETS) {
              const x = minX + (column + ox) * cellSize;
              const y = minY + (row + oy) * cellSize;
              if (pointInsideInflatedShape(blocker.shape, x, y, ENEMY_CLEARANCE_RADIUS)) {
                open = false;
                break blocked;
              }
            }
          }
        }
      }
      walkable[row * columns + column] = open ? 1 : 0;
    }
  }

  // Directed edge legality via the canonical elevation transition rules, so
  // one-way drops and ramps behave exactly as the simulation resolves them.
  // Bit k of edges[cell] = travel from this cell toward neighbour k is legal.
  const NEIGHBOURS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  const edges = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const from = row * columns + column;
      if (!walkable[from]) continue;
      let mask = 0;
      for (let k = 0; k < NEIGHBOURS.length; k += 1) {
        const nc = column + NEIGHBOURS[k][0];
        const nr = row + NEIGHBOURS[k][1];
        if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
        if (!walkable[nr * columns + nc]) continue;
        const traversal = resolveSweptTraversalPath({
          start: { x: centreX(column), y: centreY(row) },
          end: { x: centreX(nc), y: centreY(nr) },
          queryGround,
          maxSampleDistance: cellSize / 4,
          transitionOptions: CONSERVATIVE_TRANSITION,
        });
        if (traversal.allowed) mask |= 1 << k;
      }
      edges[from] = mask;
    }
  }

  const cellAt = (x, y) => {
    const column = Math.floor((x - minX) / cellSize);
    const row = Math.floor((y - minY) / cellSize);
    if (column < 0 || row < 0 || column >= columns || row >= rows) return -1;
    return row * columns + column;
  };

  return Object.freeze({
    columns,
    rows,
    cellSize,
    minX,
    minY,
    walkable,
    edges,
    neighbours: NEIGHBOURS,
    cellAt,
    centreX,
    centreY,
    isWalkableCell(column, row) {
      if (column < 0 || row < 0 || column >= columns || row >= rows) return false;
      return walkable[row * columns + column] === 1;
    },
    isWalkableAt(x, y) {
      const cell = cellAt(x, y);
      return cell >= 0 && walkable[cell] === 1;
    },
  });
}

function defaultNavGridIdleYield() {
  return new Promise((resolve) => {
    if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(() => resolve(), { timeout: 32 });
    else setTimeout(resolve, 0);
  });
}

export async function createEnemyNavGridChunked({
  world,
  queryGround,
  cellSize = ENEMY_NAV_CELL_SIZE,
  cellsPerSlice = 128,
  scheduleYield = defaultNavGridIdleYield,
} = {}) {
  if (!world?.bounds || !Array.isArray(world.collisionBlockers)) throw new TypeError('world with bounds and collisionBlockers is required');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new TypeError('cellSize must be positive');
  if (!Number.isInteger(cellsPerSlice) || cellsPerSlice < 1) throw new TypeError('cellsPerSlice must be a positive integer');
  if (typeof scheduleYield !== 'function') throw new TypeError('scheduleYield must be a function');
  const { minX, minY, maxX, maxY } = world.bounds;
  const columns = Math.ceil((maxX - minX) / cellSize);
  const rows = Math.ceil((maxY - minY) / cellSize);
  const total = columns * rows;
  const walkable = new Uint8Array(total);
  const edges = new Uint8Array(total);
  const centreX = (column) => minX + (column + 0.5) * cellSize;
  const centreY = (row) => minY + (row + 0.5) * cellSize;
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const sampleOffsets = [0.1, 0.5, 0.9];

  for (let start = 0; start < total; start += cellsPerSlice) {
    const end = Math.min(total, start + cellsPerSlice);
    for (let cell = start; cell < end; cell += 1) {
      const column = cell % columns;
      const row = (cell - column) / columns;
      const ground = queryGround(centreX(column), centreY(row));
      let open = !(ground.kind === 'water' && ground.deepWater);
      if (open) {
        blocked: for (const blocker of world.collisionBlockers) {
          for (const oy of sampleOffsets) {
            for (const ox of sampleOffsets) {
              const x = minX + (column + ox) * cellSize;
              const y = minY + (row + oy) * cellSize;
              if (pointInsideInflatedShape(blocker.shape, x, y, ENEMY_CLEARANCE_RADIUS)) {
                open = false;
                break blocked;
              }
            }
          }
        }
      }
      walkable[cell] = open ? 1 : 0;
    }
    if (end < total) await scheduleYield();
  }

  for (let start = 0; start < total; start += cellsPerSlice) {
    const end = Math.min(total, start + cellsPerSlice);
    for (let from = start; from < end; from += 1) {
      if (!walkable[from]) continue;
      const column = from % columns;
      const row = (from - column) / columns;
      let mask = 0;
      for (let k = 0; k < neighbours.length; k += 1) {
        const nc = column + neighbours[k][0];
        const nr = row + neighbours[k][1];
        if (nc < 0 || nr < 0 || nc >= columns || nr >= rows || !walkable[nr * columns + nc]) continue;
        const traversal = resolveSweptTraversalPath({
          start: { x: centreX(column), y: centreY(row) },
          end: { x: centreX(nc), y: centreY(nr) },
          queryGround,
          maxSampleDistance: cellSize / 4,
          transitionOptions: CONSERVATIVE_TRANSITION,
        });
        if (traversal.allowed) mask |= 1 << k;
      }
      edges[from] = mask;
    }
    if (end < total) await scheduleYield();
  }

  const cellAt = (x, y) => {
    const column = Math.floor((x - minX) / cellSize);
    const row = Math.floor((y - minY) / cellSize);
    if (column < 0 || row < 0 || column >= columns || row >= rows) return -1;
    return row * columns + column;
  };
  return Object.freeze({
    columns, rows, cellSize, minX, minY, walkable, edges, neighbours, cellAt, centreX, centreY,
    isWalkableCell(column, row) {
      if (column < 0 || row < 0 || column >= columns || row >= rows) return false;
      return walkable[row * columns + column] === 1;
    },
    isWalkableAt(x, y) {
      const cell = cellAt(x, y);
      return cell >= 0 && walkable[cell] === 1;
    },
  });
}

// Flow field: BFS outward from the target cell. Expansion from cell B to
// neighbour A requires the DIRECTED edge A->B (an enemy at A must be able to
// step toward B), so one-way drops propagate correctly. Neighbour order is
// fixed, costs are integers, and ties resolve to the earliest neighbour, so
// the field is fully deterministic.
export function computeEnemyFlowField({ grid, targetX, targetY } = {}) {
  if (!grid?.walkable) throw new TypeError('grid is required');
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) throw new TypeError('target must be finite');
  const { columns, rows, neighbours, edges } = grid;
  const total = columns * rows;
  const distance = new Int32Array(total).fill(-1);
  const directions = new Int8Array(total).fill(-1);
  let target = grid.cellAt(targetX, targetY);
  if (target < 0 || grid.walkable[target] !== 1) {
    // Clamp to the nearest walkable cell in deterministic scan order.
    let best = -1;
    let bestMetric = Infinity;
    for (let cell = 0; cell < total; cell += 1) {
      if (grid.walkable[cell] !== 1) continue;
      const column = cell % columns;
      const row = (cell - column) / columns;
      const dx = grid.centreX(column) - targetX;
      const dy = grid.centreY(row) - targetY;
      const metric = dx * dx + dy * dy;
      if (metric < bestMetric) {
        bestMetric = metric;
        best = cell;
      }
    }
    target = best;
  }
  if (target < 0) return Object.freeze({ directions, distance, directionAtCell: () => null });

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  distance[target] = 0;
  queue[tail] = target;
  tail += 1;
  const REVERSE = [1, 0, 3, 2];
  while (head < tail) {
    const cell = queue[head];
    head += 1;
    const column = cell % columns;
    const row = (cell - column) / columns;
    for (let k = 0; k < neighbours.length; k += 1) {
      const nc = column + neighbours[k][0];
      const nr = row + neighbours[k][1];
      if (nc < 0 || nr < 0 || nc >= columns || nr >= rows) continue;
      const next = nr * columns + nc;
      if (distance[next] !== -1 || grid.walkable[next] !== 1) continue;
      // The neighbour must be able to step from itself toward `cell`.
      if (!(edges[next] & (1 << REVERSE[k]))) continue;
      distance[next] = distance[cell] + 1;
      directions[next] = REVERSE[k];
      queue[tail] = next;
      tail += 1;
    }
  }

  const directionAtCell = (column, row) => {
    if (column < 0 || row < 0 || column >= columns || row >= rows) return null;
    const raw = directions[row * columns + column];
    if (raw < 0) return null;
    return Object.freeze({ x: neighbours[raw][0], y: neighbours[raw][1] });
  };

  return Object.freeze({ directions, distance, directionAtCell });
}

export function sampleFlowDirection(grid, field, x, y) {
  if (!grid || !field) return null;
  const cell = grid.cellAt(x, y);
  if (cell < 0) return null;
  const column = cell % grid.columns;
  const row = (cell - column) / grid.columns;
  const primary = field.directionAtCell(column, row);
  if (!primary) return null;
  // Corner smoothing (Cycle 049): when the next cell along the flow would
  // itself turn, blend one step of lookahead so enemies cut smooth diagonals
  // instead of marching square staircases — but only when the diagonal
  // between the two steps is walkable from here (no corner clipping). Pure
  // function of grid+field: determinism unchanged.
  const nextColumn = column + primary.x;
  const nextRow = row + primary.y;
  const secondary = field.directionAtCell(nextColumn, nextRow);
  if (secondary && (secondary.x !== primary.x || secondary.y !== primary.y)
    && grid.isWalkableCell(column + primary.x + secondary.x, row + primary.y + secondary.y)
    && grid.isWalkableCell(column + secondary.x, row + secondary.y)) {
    const blendX = primary.x + secondary.x;
    const blendY = primary.y + secondary.y;
    const magnitude = Math.hypot(blendX, blendY);
    if (magnitude > 0) return Object.freeze({ x: blendX / magnitude, y: blendY / magnitude });
  }
  return primary;
}

// Bounded hazard-aware steering samples one validated nav step from the shared
// flow direction. It changes only intent: canonical swept collision, traversal,
// elevation, and bounds remain authoritative every fixed tick.
export function sampleHazardAwareDirection(grid, fromX, fromY, baseDirection, {
  costAt,
  stableSide = 1,
  sampleCells = 2,
} = {}) {
  if (!grid?.walkable) throw new TypeError('grid is required');
  for (const [value, name] of [[fromX, 'fromX'], [fromY, 'fromY'], [baseDirection?.x, 'baseDirection.x'], [baseDirection?.y, 'baseDirection.y']]) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  }
  if (typeof costAt !== 'function') throw new TypeError('costAt must be a function');
  if (![1, -1].includes(stableSide)) throw new TypeError('stableSide must be 1 or -1');
  if (!Number.isInteger(sampleCells) || sampleCells < 1 || sampleCells > 4) throw new TypeError('sampleCells must be an integer in [1, 4]');
  const magnitude = Math.hypot(baseDirection.x, baseDirection.y);
  if (magnitude <= 1e-9) return null;
  const base = { x: baseDirection.x / magnitude, y: baseDirection.y / magnitude };
  const tangent = { x: -base.y * stableSide, y: base.x * stableSide };
  const headings = [
    base,
    { x: base.x * Math.SQRT1_2 + tangent.x * Math.SQRT1_2, y: base.y * Math.SQRT1_2 + tangent.y * Math.SQRT1_2 },
    tangent,
    { x: base.x * Math.SQRT1_2 - tangent.x * Math.SQRT1_2, y: base.y * Math.SQRT1_2 - tangent.y * Math.SQRT1_2 },
    { x: -tangent.x, y: -tangent.y },
  ];
  const distance = grid.cellSize * sampleCells;
  let selected = null;
  for (let index = 0; index < headings.length; index += 1) {
    const direction = headings[index];
    const target = Object.freeze({ x: fromX + direction.x * distance, y: fromY + direction.y * distance });
    if (!grid.isWalkableAt(target.x, target.y) || navLineBlocked(grid, fromX, fromY, target.x, target.y)) continue;
    const hazardCost = costAt(target.x, target.y);
    if (!Number.isFinite(hazardCost) || hazardCost < 0) throw new TypeError('hazard cost must be finite and non-negative');
    const candidate = { direction, target, hazardCost, order: index };
    if (!selected || candidate.hazardCost < selected.hazardCost
      || (candidate.hazardCost === selected.hazardCost && candidate.order < selected.order)) selected = candidate;
  }
  if (!selected) return null;
  return Object.freeze({
    direction: Object.freeze({ ...selected.direction }),
    target: selected.target,
    hazardCost: selected.hazardCost,
  });
}

// Supercover raycast on the walkable grid: true when the straight segment
// crosses any unwalkable cell. Used to decide when direct pursuit is honest.
export function sampleCoverDirection(grid, fromX, fromY, targetX, targetY, {
  stableSide = 1,
  maxCells = 4,
} = {}) {
  if (!grid?.walkable) throw new TypeError('grid is required');
  for (const [value, name] of [[fromX, 'fromX'], [fromY, 'fromY'], [targetX, 'targetX'], [targetY, 'targetY']]) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  }
  if (![1, -1].includes(stableSide)) throw new TypeError('stableSide must be 1 or -1');
  if (!Number.isInteger(maxCells) || maxCells < 1 || maxCells > 8) throw new TypeError('maxCells must be an integer in [1, 8]');
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= 1e-9) return null;
  const lateral = { x: (-dy / magnitude) * stableSide, y: (dx / magnitude) * stableSide };
  for (const side of [1, -1]) {
    for (let cell = 1; cell <= maxCells; cell += 1) {
      const target = Object.freeze({
        x: fromX + lateral.x * grid.cellSize * cell * side,
        y: fromY + lateral.y * grid.cellSize * cell * side,
      });
      if (!grid.isWalkableAt(target.x, target.y)) continue;
      if (navLineBlocked(grid, fromX, fromY, target.x, target.y)) continue;
      if (!navLineBlocked(grid, target.x, target.y, targetX, targetY)) continue;
      const coverDx = target.x - fromX;
      const coverDy = target.y - fromY;
      const coverMagnitude = Math.hypot(coverDx, coverDy);
      if (coverMagnitude <= 1e-9) continue;
      return Object.freeze({
        direction: Object.freeze({ x: coverDx / coverMagnitude, y: coverDy / coverMagnitude }),
        target,
        side: stableSide * side,
        distanceCells: cell,
      });
    }
  }
  return null;
}

// A chokepoint is derived from the existing authored navigation graph rather
// than a second lane map: exactly two opposite legal exits identify a narrow
// through-cell. The bounded graph walk accepts only connected candidates that
// make progress toward the player and returns the first stable legal edge.
// Canonical swept collision/traversal still owns every movement step.
export function sampleChokepointDirection(grid, fromX, fromY, targetX, targetY, {
  maxCells = 4,
  holdingRadius = null,
} = {}) {
  if (!grid?.walkable || !grid?.edges) throw new TypeError('grid is required');
  for (const [value, name] of [[fromX, 'fromX'], [fromY, 'fromY'], [targetX, 'targetX'], [targetY, 'targetY']]) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  }
  if (!Number.isInteger(maxCells) || maxCells < 1 || maxCells > 8) throw new TypeError('maxCells must be an integer in [1, 8]');
  const holdRadius = holdingRadius === null ? grid.cellSize * 0.65 : holdingRadius;
  if (!Number.isFinite(holdRadius) || holdRadius <= 0 || holdRadius > grid.cellSize) throw new TypeError('holdingRadius must be in (0, cellSize]');
  const originCell = grid.cellAt(fromX, fromY);
  if (originCell < 0) return null;
  const playerDistance = Math.hypot(targetX - fromX, targetY - fromY);
  if (playerDistance <= 1e-9) return null;
  const towardPlayer = { x: (targetX - fromX) / playerDistance, y: (targetY - fromY) / playerDistance };
  const queue = [{ cell: originCell, depth: 0, firstCell: originCell }];
  const visited = new Set([originCell]);
  let selected = null;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const node = queue[cursor];
    const column = node.cell % grid.columns;
    const row = (node.cell - column) / grid.columns;
    const x = grid.centreX(column);
    const y = grid.centreY(row);
    const dx = x - fromX;
    const dy = y - fromY;
    const distance = Math.hypot(dx, dy);
    const exits = grid.edges[node.cell];
    if ((exits === 0b0011 || exits === 0b1100)
      && (distance <= holdRadius || (dx * towardPlayer.x + dy * towardPlayer.y) > 0)
      && Math.hypot(targetX - x, targetY - y) < playerDistance) {
      const candidate = { cell: node.cell, firstCell: node.firstCell, x, y, distance };
      if (!selected || candidate.distance < selected.distance
        || (candidate.distance === selected.distance && candidate.cell < selected.cell)) selected = candidate;
    }
    if (node.depth >= maxCells) continue;
    for (let neighbourIndex = 0; neighbourIndex < grid.neighbours.length; neighbourIndex += 1) {
      if ((exits & (1 << neighbourIndex)) === 0) continue;
      const nextColumn = column + grid.neighbours[neighbourIndex][0];
      const nextRow = row + grid.neighbours[neighbourIndex][1];
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= grid.columns || nextRow >= grid.rows) continue;
      const nextCell = nextRow * grid.columns + nextColumn;
      if (grid.walkable[nextCell] !== 1 || visited.has(nextCell)) continue;
      visited.add(nextCell);
      queue.push({
        cell: nextCell,
        depth: node.depth + 1,
        firstCell: node.depth === 0 ? nextCell : node.firstCell,
      });
    }
  }
  if (!selected) return null;
  const holding = selected.distance <= holdRadius;
  const firstColumn = selected.firstCell % grid.columns;
  const firstRow = (selected.firstCell - firstColumn) / grid.columns;
  const stepX = grid.centreX(firstColumn) - fromX;
  const stepY = grid.centreY(firstRow) - fromY;
  const stepDistance = Math.hypot(stepX, stepY);
  return Object.freeze({
    direction: Object.freeze(holding || stepDistance <= 1e-9 ? { x: 0, y: 0 } : { x: stepX / stepDistance, y: stepY / stepDistance }),
    target: Object.freeze({ x: selected.x, y: selected.y }),
    holding,
    openSides: 2,
  });
}

export function navLineBlocked(grid, fromX, fromY, toX, toY) {
  if (!grid) return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / (grid.cellSize / 3)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    if (!grid.isWalkableAt(x, y)) return true;
  }
  return false;
}
