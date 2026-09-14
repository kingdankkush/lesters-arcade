// Exact separation reference from b8635cf; protects canonical movement.
const EPSILON=1e-9,ENEMY_CAPACITY=192,ENEMY_SPATIAL_CELL_SIZE=96,MAX_ENEMY_SEPARATION_STEP=6;
const lexical=(a,b)=>a<b?-1:a>b?1:0;
const finite=(v)=>{if(!Number.isFinite(v))throw Error('finite');return v;};
const positiveInteger=v=>{if(!Number.isInteger(v)||v<=0)throw Error('positive');};
function stableNormal(idA, idB = '') {
  let hash = 2166136261;
  for (const char of `${idA}:${idB}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const angle = (hash / 0x1_0000_0000) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function computeEnemySeparation(enemies, {
  neighborRadius = 96,
  maxNeighbors = 8,
  strength = 0.35,
  maxStep = MAX_ENEMY_SEPARATION_STEP,
  cellSize = ENEMY_SPATIAL_CELL_SIZE,
} = {}) {
  if (!Array.isArray(enemies)) throw new TypeError('enemies must be an array');
  finite(neighborRadius, 'neighborRadius');
  if (neighborRadius <= 0) throw new TypeError('neighborRadius must be positive');
  positiveInteger(maxNeighbors, 'maxNeighbors');
  finite(strength, 'strength');
  finite(maxStep, 'maxStep');
  finite(cellSize, 'cellSize');
  if (maxStep <= 0) throw new TypeError('maxStep must be positive');
  if (cellSize <= 0) throw new TypeError('cellSize must be positive');
  if (strength < 0 || strength > 1) throw new TypeError('strength must be in [0, 1]');
  const ordered = enemies.filter((enemy) => enemy?.active).sort((a, b) => lexical(a.id, b.id));
  if (ordered.length > ENEMY_CAPACITY) throw new TypeError(`active enemy count cannot exceed capacity ${ENEMY_CAPACITY}`);
  const grid = new Map();
  const cellKey = (x, y) => `${x},${y}`;
  for (const enemy of ordered) {
    const cellX = Math.floor(finite(enemy.x, `${enemy.id}.x`) / cellSize);
    const cellY = Math.floor(finite(enemy.y, `${enemy.id}.y`) / cellSize);
    const key = cellKey(cellX, cellY);
    const bucket = grid.get(key) ?? [];
    bucket.push(enemy);
    grid.set(key, bucket);
  }
  const cellReach = Math.ceil(neighborRadius / cellSize);
  const deltas = new Map();
  let maxNeighborsObserved = 0;
  let broadphaseCandidateChecks = 0;
  for (const enemy of ordered) {
    const cellX = Math.floor(enemy.x / cellSize);
    const cellY = Math.floor(enemy.y / cellSize);
    const localCandidates = [];
    for (let offsetY = -cellReach; offsetY <= cellReach; offsetY += 1) {
      for (let offsetX = -cellReach; offsetX <= cellReach; offsetX += 1) {
        for (const other of grid.get(cellKey(cellX + offsetX, cellY + offsetY)) ?? []) {
          if (other !== enemy) localCandidates.push(other);
        }
      }
    }
    broadphaseCandidateChecks += localCandidates.length;
    const neighbors = localCandidates
      .map((other) => ({
        other,
        dx: enemy.x - other.x,
        dy: enemy.y - other.y,
        distance: Math.hypot(enemy.x - other.x, enemy.y - other.y),
      }))
      .filter((candidate) => candidate.distance <= neighborRadius)
      .sort((a, b) => a.distance - b.distance || lexical(a.other.id, b.other.id))
      .slice(0, maxNeighbors);
    maxNeighborsObserved = Math.max(maxNeighborsObserved, neighbors.length);
    let x = 0;
    let y = 0;
    for (const neighbor of neighbors) {
      const required = enemy.radius + neighbor.other.radius;
      const overlap = Math.max(0, required - neighbor.distance);
      if (overlap <= 0) continue;
      const normal = neighbor.distance > EPSILON
        ? { x: neighbor.dx / neighbor.distance, y: neighbor.dy / neighbor.distance }
        : stableNormal(enemy.id, neighbor.other.id);
      x += normal.x * overlap * strength;
      y += normal.y * overlap * strength;
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude > maxStep && magnitude > EPSILON) {
      const scale = maxStep / magnitude;
      x *= scale;
      y *= scale;
    }
    deltas.set(enemy.id, Object.freeze({ x, y }));
  }
  return Object.freeze({
    deltas,
    maxNeighborsObserved,
    broadphaseCandidateChecks,
    naiveCandidateChecks: ordered.length * Math.max(0, ordered.length - 1),
  });
}

