// Offline authoring checker. Never imported by a game entry or verifier.
// Builds the unchanged real conservative enemy grid; diagnostics cannot patch it.
import { createHash } from 'node:crypto';
import { createEnemyNavGrid, ENEMY_NAV_CELL_SIZE } from '../../apps/hmh-reboot/src/enemy-navgrid.mjs';

function point(value, name) {
  if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) throw new TypeError(`${name} coordinates must be finite`);
  return { x: value.x, y: value.y };
}

function distances(grid, legal, origin, reverse = false) {
  const result = new Int32Array(legal.length).fill(-1);
  if (origin < 0 || !legal[origin] || !grid.walkable[origin]) return result;
  const queue = new Int32Array(legal.length), opposite = [1, 0, 3, 2];
  let head = 0, tail = 0; result[origin] = 0; queue[tail++] = origin;
  while (head < tail) {
    const current = queue[head++], column = current % grid.columns, row = Math.floor(current / grid.columns);
    for (let k = 0; k < grid.neighbours.length; k++) {
      const [dx, dy] = grid.neighbours[k], nc = column + dx, nr = row + dy;
      if (nc < 0 || nr < 0 || nc >= grid.columns || nr >= grid.rows) continue;
      const next = nr * grid.columns + nc;
      if (!legal[next] || !grid.walkable[next] || result[next] >= 0) continue;
      const hasEdge = reverse ? grid.edges[next] & (1 << opposite[k]) : grid.edges[current] & (1 << k);
      if (!hasEdge) continue;
      result[next] = result[current] + 1; queue[tail++] = next;
    }
  }
  return result;
}

export function checkGreyboxNavigation({ world, queryGround, start, targets, cellSize = ENEMY_NAV_CELL_SIZE,
  walkableBand = [0.45, 0.55] } = {}) {
  const bounds = world?.bounds;
  if (!bounds || !['minX', 'minY', 'maxX', 'maxY'].every(key => Number.isFinite(bounds[key]))
    || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new TypeError('finite positive world bounds required');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new TypeError('positive finite cellSize required');
  if (!Array.isArray(targets) || !targets.length) throw new TypeError('nonempty declared targets required');
  if (!Array.isArray(walkableBand) || walkableBand.length !== 2 || !walkableBand.every(Number.isFinite)
    || walkableBand[0] < 0 || walkableBand[1] > 1 || walkableBand[0] > walkableBand[1]) throw new TypeError('valid walkable fraction band required');
  const canonicalBounds = Object.fromEntries(['minX', 'minY', 'maxX', 'maxY'].map(key => [key, bounds[key]]));
  const origin = point(start, 'start'), ids = new Set();
  const declared = targets.map(target => {
    if (typeof target?.id !== 'string' || !target.id.trim()) throw new TypeError('target id required');
    if (ids.has(target.id)) throw new TypeError(`duplicate target id ${target.id}`);
    if (target.kind !== undefined && typeof target.kind !== 'string') throw new TypeError('target kind must be a string');
    ids.add(target.id);
    return { id: target.id, kind: target.kind ?? 'target', ...point(target, target.id) };
  });
  const grid = createEnemyNavGrid({ world, queryGround, cellSize });
  if (JSON.stringify(grid.neighbours) !== '[[1,0],[-1,0],[0,1],[0,-1]]') throw new TypeError('canonical directed neighbour order changed');
  const inside = p => p.x >= bounds.minX && p.x < bounds.maxX && p.y >= bounds.minY && p.y < bounds.maxY;
  const legal = new Uint8Array(grid.walkable.length);
  let inBoundsCells = 0, walkableCells = 0, outsideWalkableCells = 0;
  for (let cell = 0; cell < legal.length; cell++) {
    const p = { x: grid.centreX(cell % grid.columns), y: grid.centreY(Math.floor(cell / grid.columns)) };
    if (inside(p)) { legal[cell] = 1; inBoundsCells++; walkableCells += grid.walkable[cell]; }
    else outsideWalkableCells += grid.walkable[cell];
  }
  const issues = [], add = (code, id = null) => issues.push({ code, id });
  if (outsideWalkableCells) add('OUTSIDE_WALKABLE_CELLS');
  const fraction = inBoundsCells ? walkableCells / inBoundsCells : 0;
  if (fraction < walkableBand[0] || fraction > walkableBand[1]) add('WALKABLE_FRACTION');
  const locate = p => inside(p) ? grid.cellAt(p.x, p.y) : -1;
  const startCell = locate(origin);
  if (startCell < 0) add('OUTSIDE_START');
  else if (!legal[startCell] || !grid.walkable[startCell]) add('BLOCKED_START');
  const outward = distances(grid, legal, startCell), returning = distances(grid, legal, startCell, true);
  const measured = declared.map(target => {
    const cell = locate(target), open = cell >= 0 && legal[cell] === 1 && grid.walkable[cell] === 1;
    const reachable = open && outward[cell] >= 0, returnable = open && returning[cell] >= 0;
    if (cell < 0) add('OUTSIDE_TARGET', target.id);
    else if (!open) add('BLOCKED_TARGET', target.id);
    else { if (!reachable) add('UNREACHABLE_TARGET', target.id); if (!returnable) add('NO_RETURN_ROUTE', target.id); }
    return { ...target, cell, reachable, returnable, pathDistanceUnits: reachable ? outward[cell] * cellSize : null,
      returnDistanceUnits: returnable ? returning[cell] * cellSize : null };
  });
  const hash = createHash('sha256').update(JSON.stringify({ bounds: canonicalBounds, cellSize, columns: grid.columns, rows: grid.rows }))
    .update(grid.walkable).update(grid.edges).digest('hex');
  return { schema: 'hmh-greybox-navigation-check-v1', scope: 'canonical conservative enemy lattice, not a playable map, player-traversal/arena/sightline/spawn/performance or verifier acceptance',
    passed: issues.length === 0, bounds: canonicalBounds, cellSize, navSha256: hash,
    distanceBasis: 'Shortest directed lattice steps between cell centres, not actor paths or exact point-to-point distances',
    metrics: { columns: grid.columns, rows: grid.rows, inBoundsCells, walkableCells, walkableFraction: fraction,
      fractionBasis: 'cell centres inside exact bounds; lattice estimate, not geometric area fraction', outsideWalkableCells },
    start: { ...origin, cell: startCell }, targets: measured, issues };
}
