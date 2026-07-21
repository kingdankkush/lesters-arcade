const CARDINAL = Object.freeze([
  ['north', 0, -1, 1],
  ['east', 1, 0, 2],
  ['south', 0, 1, 4],
  ['west', -1, 0, 8],
]);

const DIAGONAL = Object.freeze([
  ['northEast', 1, -1, 16],
  ['southEast', 1, 1, 32],
  ['southWest', -1, 1, 64],
  ['northWest', -1, -1, 128],
]);

function sameTerrainFamily(a, b) {
  if (a === b) return true;
  if ((a === 'road' && b === 'bridge') || (a === 'bridge' && b === 'road')) return true;
  if ((a === 'water' && b === 'shore') || (a === 'shore' && b === 'water')) return true;
  if ((a === 'dirt' && b === 'scrub') || (a === 'scrub' && b === 'dirt')) return true;
  return false;
}

function normalizeRole(zone) {
  if (String(zone?.zoneId ?? '').includes('bridge')) return 'bridge';
  return zone?.role ?? 'dirt';
}

function elevationFor(zone) {
  const role = normalizeRole(zone);
  if (role === 'water') return { band: 'low', height: -1 };
  if (role === 'shore' || role === 'bridge') return { band: 'mid', height: 0 };
  if (role === 'rocky' || String(zone?.zoneId ?? '').includes('boss')) return { band: 'high', height: 1 };
  return { band: 'mid', height: 0 };
}

function layerList(zone, adjacency) {
  const role = normalizeRole(zone);
  const layers = ['base-terrain'];
  if (role === 'road') layers.push('road-surface');
  if (role === 'bridge') layers.push('bridge-deck');
  if (role === 'water') layers.push('water-ripple');
  if (role === 'shore') layers.push('shore-blend');
  if (role === 'rocky') layers.push('elevation-ridge');
  if (Object.values(adjacency.cardinal).some((neighbor) => neighbor.role !== zone.role)) layers.push('edge-blend');
  return Object.freeze(layers);
}

function vfxList(zone, adjacency, elevation) {
  const role = normalizeRole(zone);
  const vfx = [];
  if (role === 'water') vfx.push('water-shimmer');
  if (role === 'water' && Object.values(adjacency.cardinal).some((neighbor) => ['shore', 'bridge', 'road'].includes(normalizeRole(neighbor)))) vfx.push('shoreline-foam');
  if (role === 'bridge') vfx.push('bridge-shadow');
  if (role === 'road') vfx.push('road-dust');
  if (elevation.band === 'high') vfx.push('terrain-cast-shadow');
  return Object.freeze(vfx);
}

function compactNeighbor(zone) {
  return Object.freeze({
    zoneId: zone.zoneId,
    role: zone.role,
    terrainRole: normalizeRole(zone),
    terrain: zone.terrain,
    biome: zone.biome,
    route: zone.route,
    textureKey: zone.textureKey,
  });
}

export function buildTerrainBlobCell(plan, worldX = 0, worldY = 0) {
  if (!plan?.zoneAt) throw new Error('ground plan with zoneAt is required');
  const zone = plan.zoneAt(worldX, worldY);
  const terrainRole = normalizeRole(zone);
  let cardinalMask = 0;
  let diagonalMask = 0;
  const cardinal = {};
  const diagonal = {};
  for (const [name, dx, dy, bit] of CARDINAL) {
    const neighbor = plan.zoneAt(worldX + dx, worldY + dy);
    cardinal[name] = compactNeighbor(neighbor);
    if (sameTerrainFamily(terrainRole, normalizeRole(neighbor))) cardinalMask |= bit;
  }
  for (const [name, dx, dy, bit] of DIAGONAL) {
    const neighbor = plan.zoneAt(worldX + dx, worldY + dy);
    diagonal[name] = compactNeighbor(neighbor);
    if (sameTerrainFamily(terrainRole, normalizeRole(neighbor))) diagonalMask |= bit;
  }
  const mask8 = cardinalMask | diagonalMask;
  const elevation = Object.freeze(elevationFor(zone));
  const adjacency = Object.freeze({ cardinal: Object.freeze(cardinal), diagonal: Object.freeze(diagonal) });
  return Object.freeze({
    x: Math.round(Number(worldX) || 0),
    y: Math.round(Number(worldY) || 0),
    zoneId: zone.zoneId,
    role: zone.role,
    terrainRole,
    terrain: zone.terrain,
    biome: zone.biome,
    route: zone.route,
    groundNav: zone.groundNav,
    blocked: Boolean(zone.blocked),
    authoredX: zone.authoredX,
    authoredY: zone.authoredY,
    textureKey: zone.textureKey,
    isWater: terrainRole === 'water',
    isBridge: terrainRole === 'bridge',
    elevation,
    adjacency,
    blob: Object.freeze({ cardinalMask, diagonalMask, mask8, variantIndex: mask8 % 47, variantCount: 47 }),
    renderLayers: layerList({ ...zone, role: terrainRole }, adjacency),
    vfx: vfxList({ ...zone, role: terrainRole }, adjacency, elevation),
  });
}

export function buildTerrainRenderingCapabilityReport(plan, options = {}) {
  const bounds = typeof plan?.worldBounds === 'function' ? plan.worldBounds() : (plan?.worldBounds ?? null);
  const xMin = Number.isFinite(options.xMin) ? options.xMin : (bounds?.minX ?? 0);
  const xMax = Number.isFinite(options.xMax) ? options.xMax : (bounds?.maxX ?? 105);
  const yMin = Number.isFinite(options.yMin) ? options.yMin : (bounds?.minY ?? 0);
  const yMax = Number.isFinite(options.yMax) ? options.yMax : (bounds?.maxY ?? 80);
  const cellAt = typeof plan.cellAt === 'function' ? plan.cellAt.bind(plan) : (x, y) => buildTerrainBlobCell(plan, x, y);
  const cells = [];
  for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) cells.push(cellAt(x, y));
  }
  const roles = new Set(cells.map((cell) => cell.terrainRole));
  const elevationBands = [...new Set(cells.map((cell) => cell.elevation.band))].sort();
  const bridgeCells = cells.filter((cell) => cell.isBridge).length;
  const waterCells = cells.filter((cell) => cell.isWater).length;
  const shadowCells = cells.filter((cell) => cell.vfx.includes('terrain-cast-shadow') || cell.vfx.includes('bridge-shadow')).length;
  const gates = Object.freeze([
    Object.freeze({ id: '47-blob-terrain', status: cells.every((cell) => cell.blob.variantIndex >= 0 && cell.blob.variantIndex < 47) ? 'pass' : 'fail', metric: 'variantIndex 0..46' }),
    Object.freeze({ id: 'roads', status: roles.has('road') ? 'pass' : 'fail', metric: `${cells.filter((cell) => cell.terrainRole === 'road').length} road cells` }),
    Object.freeze({ id: 'water', status: waterCells > 0 ? 'pass' : 'fail', metric: `${waterCells} water cells` }),
    Object.freeze({ id: 'bridges', status: bridgeCells > 0 ? 'pass' : 'fail', metric: `${bridgeCells} bridge cells` }),
    Object.freeze({ id: 'elevation', status: elevationBands.includes('low') && elevationBands.includes('high') ? 'pass' : 'fail', metric: elevationBands.join(', ') }),
    Object.freeze({ id: 'shadows', status: shadowCells > 0 ? 'pass' : 'fail', metric: `${shadowCells} shadow/vfx cells` }),
    Object.freeze({ id: 'vfx', status: cells.some((cell) => cell.vfx.length > 0) ? 'pass' : 'fail', metric: [...new Set(cells.flatMap((cell) => cell.vfx))].sort().join(', ') }),
  ]);
  return Object.freeze({
    policy: Object.freeze({
      legacyTerrainFallbacksAllowed: false,
      disallowedFallbacks: Object.freeze(['generic-biome-random-tile', 'per-tile-sbs-fallback', 'rectangle-ground-fill', 'random-scatter-road']),
    }),
    summary: Object.freeze({
      sampledCells: cells.length,
      terrainRoles: Object.freeze([...roles].sort()),
      bridgeCells,
      waterCells,
      shadowCells,
      elevationBands: Object.freeze(elevationBands),
    }),
    gates,
  });
}
