// W4a: the ten-area world's enemy nav grid, built once inside the lazy world
// chunk with a uniform bucket index over the 581 blockers, so each cell tests
// only the blockers whose padded bounds overlap its bucket instead of walking
// every blocker. The sampling lattice, the narrow-phase shape test, the edge
// legality rules and the cell order are the ones enemy-navgrid.mjs uses, and a
// test pins the walkable/edges arrays byte-identical to createEnemyNavGrid.
//
// The result carries the same shape createEnemyNavGrid returns, so
// createEnemyNavGridChunked adopts it as the world's precomputed grid and the
// idle-sliced walk (which amplified a ~300 ms build into minutes on a busy
// main thread) is skipped for this world only.
import { CONSERVATIVE_TRANSITION, ENEMY_CLEARANCE_RADIUS, ENEMY_NAV_CELL_SIZE, navBlockerBounds, pointInsideInflatedShape } from './enemy-navgrid.mjs';
import { resolveSweptTraversalPath } from './elevation.mjs';

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SAMPLE_OFFSETS = [0.1, 0.5, 0.9];
const CELLS_PER_BUCKET = 4;

export function createWorldV2NavGrid({ world, queryGround, cellSize = ENEMY_NAV_CELL_SIZE } = {}) {
  if (!world?.bounds || !Array.isArray(world.collisionBlockers)) throw new TypeError('world with bounds and collisionBlockers is required');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround must be a function');
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new TypeError('cellSize must be positive');
  const { minX, minY, maxX, maxY } = world.bounds;
  const columns = Math.ceil((maxX - minX) / cellSize);
  const rows = Math.ceil((maxY - minY) / cellSize);
  const total = columns * rows;
  const walkable = new Uint8Array(total);
  const edges = new Uint8Array(total);
  const centreX = (column) => minX + (column + 0.5) * cellSize;
  const centreY = (row) => minY + (row + 0.5) * cellSize;

  // Uniform buckets of CELLS_PER_BUCKET x CELLS_PER_BUCKET cells. An entry
  // without finite bounds (a degenerate shape) is a candidate for every cell,
  // exactly as the unindexed walk treats it.
  const bucketSize = cellSize * CELLS_PER_BUCKET;
  const bucketColumns = Math.ceil(columns / CELLS_PER_BUCKET);
  const bucketRows = Math.ceil(rows / CELLS_PER_BUCKET);
  const buckets = new Array(bucketColumns * bucketRows);
  const everywhere = [];
  for (const entry of world.collisionBlockers.map(navBlockerBounds)) {
    if (!Number.isFinite(entry.minX)) { everywhere.push(entry); continue; }
    const fromColumn = Math.max(0, Math.floor((entry.minX - minX) / bucketSize));
    const toColumn = Math.min(bucketColumns - 1, Math.floor((entry.maxX - minX) / bucketSize));
    const fromRow = Math.max(0, Math.floor((entry.minY - minY) / bucketSize));
    const toRow = Math.min(bucketRows - 1, Math.floor((entry.maxY - minY) / bucketSize));
    for (let row = fromRow; row <= toRow; row += 1) {
      for (let column = fromColumn; column <= toColumn; column += 1) {
        const index = row * bucketColumns + column;
        (buckets[index] ??= []).push(entry);
      }
    }
  }

  for (let cell = 0; cell < total; cell += 1) {
    const column = cell % columns;
    const row = (cell - column) / columns;
    const ground = queryGround(centreX(column), centreY(row));
    let open = !(ground.kind === 'water' && ground.deepWater);
    if (open) {
      const bucket = buckets[Math.floor(row / CELLS_PER_BUCKET) * bucketColumns + Math.floor(column / CELLS_PER_BUCKET)];
      const left = minX + (column + 0.1) * cellSize, right = minX + (column + 0.9) * cellSize;
      const top = minY + (row + 0.1) * cellSize, bottom = minY + (row + 0.9) * cellSize;
      blocked: for (const candidates of (bucket === undefined ? [everywhere] : [everywhere, bucket])) {
        for (const entry of candidates) {
          if (Number.isFinite(entry.minX) && (right < entry.minX || left > entry.maxX || bottom < entry.minY || top > entry.maxY)) continue;
          const blocker = entry.blocker;
          for (const oy of SAMPLE_OFFSETS) {
            for (const ox of SAMPLE_OFFSETS) {
              if (pointInsideInflatedShape(blocker.shape, minX + (column + ox) * cellSize, minY + (row + oy) * cellSize, ENEMY_CLEARANCE_RADIUS)) {
                open = false;
                break blocked;
              }
            }
          }
        }
      }
    }
    walkable[cell] = open ? 1 : 0;
  }

  for (let from = 0; from < total; from += 1) {
    if (!walkable[from]) continue;
    const column = from % columns;
    const row = (from - column) / columns;
    let mask = 0;
    for (let k = 0; k < NEIGHBOURS.length; k += 1) {
      const nc = column + NEIGHBOURS[k][0];
      const nr = row + NEIGHBOURS[k][1];
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

  const cellAt = (x, y) => {
    const column = Math.floor((x - minX) / cellSize);
    const row = Math.floor((y - minY) / cellSize);
    if (column < 0 || row < 0 || column >= columns || row >= rows) return -1;
    return row * columns + column;
  };
  return Object.freeze({
    columns, rows, cellSize, minX, minY, walkable, edges, neighbours: NEIGHBOURS, cellAt, centreX, centreY,
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
