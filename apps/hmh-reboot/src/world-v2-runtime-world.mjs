// W4a: the authored ten-area world in the LEVEL_ONE_WORLD contract shape.
//
// Every key main.mjs and its consumers read from the legacy world exists here
// with the same meaning: districts are the ten areas (2D rectangles rather
// than x-strips), routes/routeGraph are the fourteen regional roads plus each
// area's authored local paths, blockers carry a visualKind the production
// renderer already knows, and the ground query is the same authored elevation
// query the private W3 runtime used. Only main.mjs's world resolution
// (world-context.mjs) loads this module, and only for an explicitly unranked
// Free selection; the legacy world and its verifier stay untouched.
//
// Everything is derived deterministically from the authored greybox data. No
// randomness, clocks, DOM or renderer state is read. Presentation hints
// (colours, materialId, landmark glyphs, artPlans) are projection-only.
import { createGreyboxWorld } from './dev/greybox-world-v1.mjs';
import { createWorldV2Geometry } from './world-v2-geometry.mjs';
import { auditCollisionWorld, createCollisionBody, resolveSweptCircleMotion } from './collision.mjs';
import { createAuthoredGroundQuery } from './elevation.mjs';
import { freezeDeep } from './value-guards.mjs';

export const WORLD_V2_RUNTIME_ID = 'ten-area-frontier';
export const WORLD_V2_RUNTIME_VERSION = 2;
export const WORLD_V2_PLAYER_RADIUS = 24;
export const WORLD_V2_PROTECTED_SPAWN_RADIUS = 560;
const REVEAL_CELL_SIZE = 240;
const REVEAL_RADIUS = 420;
const ARENA_RADIUS = 600;
const LOCAL_PATH_WIDTH = 160;

// Area presentation hooks. `materialId` selects an existing production ground
// kit until each area's own art lands; palette/board come from the briefs.
// `landmark` picks an existing landmark glyph as the placeholder silhouette.
export const WORLD_V2_AREA_PRESENTATION = freezeDeep({
  'mweb-meadows': { color: 0x78836b, materialId: 'frontier-relay', landmark: 'beacon-tree', board: 'L01/L02', palette: ['#78836B', '#786750', '#D4D0BE'] },
  'litecoin-city': { color: 0x4e5e62, materialId: 'liquidation-yard', landmark: 'extraction-tower', board: 'L04/L05/L06', palette: ['#4E5E62', '#91948C', '#B8C1BD'] },
  'halving-farms': { color: 0x85846a, materialId: 'frontier-relay', landmark: 'headframe', board: 'L11/L12', palette: ['#85846A', '#665044', '#625A47'] },
  'silver-coast': { color: 0xb8ac8f, materialId: 'liquidity-crossing', landmark: 'signal-tower', board: 'L07/L08', palette: ['#B8AC8F', '#D8D5C6', '#406764'] },
  'scrypt-bayou': { color: 0x586451, materialId: 'liquidity-crossing', landmark: 'bridge', board: 'L10/L14/L15', palette: ['#586451', '#494D3F', '#344C48'] },
  'hashwood-river': { color: 0x445d4c, materialId: 'hashwood', landmark: 'bridge', board: 'L25/L26/L27', palette: ['#445D4C', '#415D61', '#77796D'] },
  'hollow-pines': { color: 0x4c5664, materialId: 'hashwood', landmark: 'beacon-tree', board: 'L16/L17', palette: ['#4C5664', '#605D70', '#8B8D88'] },
  'ledger-ridge': { color: 0x7e817a, materialId: 'rugpull-ravine', landmark: 'forked-cliff', board: 'L19/L20', palette: ['#7E817A', '#515E66', '#58685D'] },
  'fork-fortress': { color: 0x424b4b, materialId: 'mining-camp', landmark: 'headframe', board: 'L22/L23/L24', palette: ['#424B4B', '#7B7C70', '#635F68'] },
  'rugpull-woods': { color: 0x56634e, materialId: 'hashwood', landmark: 'signal-tower', board: 'L30', palette: ['#56634E', '#635948', '#96917E'] },
});

// One cache per area at its authored secret site. Asset ids are the existing
// collectible effects; `hook` is an existing interaction glyph.
export const WORLD_V2_POINT_OF_INTEREST_ASSETS = freezeDeep({
  'mweb-meadows': { hook: 'reward', assetId: 'bonus-life' },
  'litecoin-city': { hook: 'weapon', assetId: 'launcher-rig' },
  'halving-farms': { hook: 'weapon', assetId: 'scatter-shotgun' },
  'silver-coast': { hook: 'upgrade', assetId: 'time-dilation' },
  'scrypt-bayou': { hook: 'weapon', assetId: 'hash-rail-core' },
  'hashwood-river': { hook: 'reward', assetId: 'berserk-candle' },
  'hollow-pines': { hook: 'hazard-reward', assetId: 'nuke-liquidation' },
  'ledger-ridge': { hook: 'weapon', assetId: 'auto-miner' },
  'fork-fortress': { hook: 'reward', assetId: 'bonus-life' },
  'rugpull-woods': { hook: 'weapon', assetId: 'coin-blaster' },
});

// Lazy area-art plan loaders (projection-only chunks, never on the initial path).
export const WORLD_V2_AREA_ART_HOOKS = Object.freeze({
  'mweb-meadows': Object.freeze({ kind: 'area-art-plan', planId: 'mweb-meadows', load: () => import('./world-v2-area-plans/mweb-meadows.mjs').then((module) => module.createMwebMeadowsArtPlan) }),
  'rugpull-woods': Object.freeze({ kind: 'area-art-plan', planId: 'rugpull-woods', load: () => import('./world-v2-area-plans/rugpull-woods.mjs').then((module) => module.createRugpullWoodsArtPlan) }),
  // Lane B (areas 06-09).
  'hashwood-river': Object.freeze({ kind: 'area-art-plan', planId: 'hashwood-river', load: () => import('./world-v2-area-plans/hashwood-river.mjs').then((module) => module.createHashwoodRiverArtPlan) }),
  'hollow-pines': Object.freeze({ kind: 'area-art-plan', planId: 'hollow-pines', load: () => import('./world-v2-area-plans/hollow-pines.mjs').then((module) => module.createHollowPinesArtPlan) }),
  'ledger-ridge': Object.freeze({ kind: 'area-art-plan', planId: 'ledger-ridge', load: () => import('./world-v2-area-plans/ledger-ridge.mjs').then((module) => module.createLedgerRidgeArtPlan) }),
  'fork-fortress': Object.freeze({ kind: 'area-art-plan', planId: 'fork-fortress', load: () => import('./world-v2-area-plans/fork-fortress.mjs').then((module) => module.createForkFortressArtPlan) }),
  // End lane B.
  'halving-farms': Object.freeze({ kind: 'area-art-plan', planId: 'halving-farms', load: () => import('./world-v2-area-plans/halving-farms.mjs').then((module) => module.createHalvingFarmsArtPlan) }),
  'scrypt-bayou': Object.freeze({ kind: 'area-art-plan', planId: 'scrypt-bayou', load: () => import('./world-v2-area-plans/scrypt-bayou.mjs').then((module) => module.createScryptBayouArtPlan) }),
  'silver-coast': Object.freeze({ kind: 'area-art-plan', planId: 'silver-coast', load: () => import('./world-v2-area-plans/silver-coast.mjs').then((module) => module.createSilverCoastArtPlan) }),
  'litecoin-city': Object.freeze({ kind: 'area-art-plan', planId: 'litecoin-city', load: () => import('./world-v2-area-plans/litecoin-city.mjs').then((module) => module.createLitecoinCityArtPlan) }),
});
export const WORLD_V2_ROAD_ART_HOOK = Object.freeze({ kind: 'area-art-plan', planId: 'world-roads', load: () => import('./world-v2-area-plans/world-roads.mjs').then((module) => module.createWorldRoadsArtPlan) });

const PIECE_VISUAL_KIND = Object.freeze({ mass: 'building', cliff: 'cliff', 'cover-tall': 'containers', 'cover-short': 'fence' });
const ROAD_ROUTE_KIND = Object.freeze({ paved: 'main', gravel: 'street', path: 'loop' });

const point = (x, y) => Object.freeze({ x, y });
const rect = (minX, minY, maxX, maxY) => Object.freeze({ type: 'rect', minX, minY, maxX, maxY });
const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (a, b) => lexical(a.id, b.id);
const boundsOfVertices = (vertices) => ({
  minX: Math.min(...vertices.map((p) => p.x)), minY: Math.min(...vertices.map((p) => p.y)),
  maxX: Math.max(...vertices.map((p) => p.x)), maxY: Math.max(...vertices.map((p) => p.y)),
});

function continuousSegments(length, physicalCause) {
  const third = Math.floor(length / 3);
  return [
    { start: 0, end: third + 24, physicalCause },
    { start: third, end: third * 2 + 24, physicalCause },
    { start: third * 2, end: length, physicalCause },
  ];
}

function buildRouteGraph(geometry, authored) {
  const nodes = [];
  const nodeIdByKey = new Map();
  const nodeFor = (base, index, p) => {
    const key = `${p.x}:${p.y}`;
    if (!nodeIdByKey.has(key)) {
      const id = `${base}:${index}`;
      nodeIdByKey.set(key, id);
      nodes.push({ id, x: p.x, y: p.y });
    }
    return nodeIdByKey.get(key);
  };
  const routes = [];
  for (const road of geometry.roads) {
    routes.push({ id: road.id, kind: ROAD_ROUTE_KIND[road.kind] ?? 'loop', width: road.width, nodeIds: road.points.map((p, index) => nodeFor(road.id, index, p)) });
  }
  for (const area of [...authored.areas].sort(byId)) {
    for (const route of area.inspectionRoutes ?? []) {
      routes.push({ id: route.id, kind: 'loop', width: LOCAL_PATH_WIDTH, local: true, areaId: area.id, nodeIds: route.points.map((p, index) => nodeFor(route.id, index, p)) });
    }
  }
  const edges = [];
  for (const route of routes) {
    for (let index = 1; index < route.nodeIds.length; index += 1) {
      edges.push({ id: `${route.id}:${index - 1}`, routeId: route.id, from: route.nodeIds[index - 1], to: route.nodeIds[index], width: route.width });
    }
  }
  return { nodes, edges, routes };
}

function buildBlockers(geometry, authored, areaById) {
  const pieceByBlockerId = new Map(authored.pieces.filter((piece) => piece.blocker).map((piece) => [piece.blocker.id, piece]));
  const blockers = geometry.collisionBlockers.map((blocker) => {
    const piece = pieceByBlockerId.get(blocker.id);
    const vertices = blocker.shape.vertices;
    const bounds = piece?.visible?.bounds ?? boundsOfVertices(vertices);
    const areaId = piece?.visible?.areaId ?? null;
    return {
      id: blocker.id,
      districtId: areaId && areaById.has(areaId) ? areaId : null,
      anchor: point((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2),
      visualKind: PIECE_VISUAL_KIND[piece?.kind] ?? 'cliff',
      shape: blocker.shape,
      maxZ: blocker.maxZ,
      combatCover: blocker.combatCover,
      collisionBlockerId: blocker.id,
      visibleAssetId: blocker.visibleAssetId,
      bounds: { ...bounds },
    };
  });
  const visibleBarriers = geometry.collisionBlockers.map((blocker) => ({ id: blocker.visibleAssetId, hard: true, collisionBlockerIds: [blocker.id] }));
  return { blockers, visibleBarriers };
}

function buildCrossings(authored) {
  const crossings = [];
  const legalAscents = [];
  for (const piece of [...authored.pieces].sort(byId)) {
    const surface = piece.surface;
    if (!surface) continue;
    const b = piece.visible.bounds;
    const axis = surface.axis ?? 'x';
    const along = axis === 'x' ? [point(b.minX, (b.minY + b.maxY) / 2), point(b.maxX, (b.minY + b.maxY) / 2)] : [point((b.minX + b.maxX) / 2, b.minY), point((b.minX + b.maxX) / 2, b.maxY)];
    if (piece.kind === 'bridge') {
      const extend = axis === 'x' ? point(100, 0) : point(0, 100);
      crossings.push({ id: piece.id, entry: point(along[0].x - extend.x, along[0].y - extend.y), exit: point(along[1].x + extend.x, along[1].y + extend.y), axis, clearWidth: axis === 'x' ? b.maxY - b.minY : b.maxX - b.minX, surfaceIds: [surface.id] });
    } else if (piece.kind === 'ramp') {
      const low = surface.fromZ <= surface.toZ ? along[0] : along[1];
      const high = surface.fromZ <= surface.toZ ? along[1] : along[0];
      legalAscents.push({ id: piece.id, entry: low, exit: high, surfaceId: surface.id });
    }
  }
  return { crossings, legalAscents };
}

// `official`: the 2.1.0 Level 1 (Free and Ranked, schema-8 run summaries);
// false is the 2.0.x unofficial Free preview. The world data is the same.
export function createWorldV2RuntimeWorld({ authored = createGreyboxWorld(), official = false } = {}) {
  if (typeof official !== 'boolean') throw new TypeError('ten-area world official must be a boolean');
  const geometry = createWorldV2Geometry(authored);
  const areaById = new Map(geometry.areas.map((area) => [area.id, area]));
  const authoredAreaById = new Map(authored.areas.map((area) => [area.id, area]));
  for (const id of areaById.keys()) if (!WORLD_V2_AREA_PRESENTATION[id]) throw new TypeError(`area ${id} has no presentation hook`);
  const siteFor = (areaId, kind) => {
    const site = authored.sites.find((row) => row.areaId === areaId && row.kind === kind);
    if (!site) throw new TypeError(`area ${areaId} is missing its ${kind} site`);
    return site;
  };

  const districts = geometry.areas.map((area) => {
    const presentation = WORLD_V2_AREA_PRESENTATION[area.id];
    const source = authoredAreaById.get(area.id);
    return {
      id: area.id,
      name: area.name,
      area: rect(area.bounds.minX, area.bounds.minY, area.bounds.maxX, area.bounds.maxY),
      color: presentation.color,
      landmarkId: `${area.id}-landmark`,
      materialId: presentation.materialId,
      tier: source.tier,
      center: point(source.center.x, source.center.y),
    };
  });
  const bounds = { ...geometry.bounds, visibleBoundaryId: `${WORLD_V2_RUNTIME_ID}-perimeter` };
  const { nodes, edges, routes } = buildRouteGraph(geometry, authored);
  const { blockers, visibleBarriers } = buildBlockers(geometry, authored, areaById);
  const { crossings, legalAscents } = buildCrossings(authored);
  const seams = geometry.roads.map((road) => {
    const mid = road.points[Math.floor(road.points.length / 2)];
    return { id: `${road.fromAreaId}-to-${road.toAreaId}`, roadId: road.id, x: mid.x, y: mid.y, districtIds: [road.fromAreaId, road.toAreaId], landmarkId: `${road.fromAreaId}-checkpoint`, clearWidth: road.width };
  });
  const landmarks = districts.map((district) => {
    const view = siteFor(district.id, 'landmark-view');
    return { id: district.landmarkId, districtId: district.id, anchor: point(view.x, view.y), visualKind: WORLD_V2_AREA_PRESENTATION[district.id].landmark, label: authoredAreaById.get(district.id).landmark };
  });
  const pointsOfInterest = districts.map((district) => {
    const secret = siteFor(district.id, 'secret');
    return { id: `${district.id}-cache`, districtId: district.id, anchor: point(secret.x, secret.y), hook: WORLD_V2_POINT_OF_INTEREST_ASSETS[district.id].hook };
  });
  const encounterArenas = [...authored.arenas].sort(byId).map((arena) => ({
    id: arena.id, districtId: arena.areaId, anchor: point(arena.center.x, arena.center.y), radius: ARENA_RADIUS, bossId: arena.bossId ?? null,
  }));
  const spawn = point(geometry.inspectionStart.x, geometry.inspectionStart.y);
  const spawnPoints = geometry.roadEntrances.map((entrance) => ({
    id: `${entrance.id}-spawn`, regionId: `${entrance.areaId}-perimeter`, districtId: entrance.areaId, x: entrance.x, y: entrance.y, routeValid: true,
  }));
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const perimeter = [
    { id: 'north-perimeter', length: width, physicalCause: 'closed-mass-and-guards', segments: continuousSegments(width, 'closed-mass-and-guards') },
    { id: 'east-perimeter', length: height, physicalCause: 'closed-mass-and-guards', segments: continuousSegments(height, 'closed-mass-and-guards') },
    { id: 'south-perimeter', length: width, physicalCause: 'closed-mass-and-guards', segments: continuousSegments(width, 'closed-mass-and-guards') },
    { id: 'west-perimeter', length: height, physicalCause: 'closed-mass-and-guards', segments: continuousSegments(height, 'closed-mass-and-guards') },
  ];
  // Area-art hooks: a dressed district carries a lazy plan loader that the
  // real game binds through world-v2-area-art-binding.mjs (unranked Free only).
  // Undressed districts keep artTarget null and the borrowed greybox kit.
  const artPlans = {
    mode: 'greybox-fallback',
    districts: Object.fromEntries(districts.map((district) => {
      const presentation = WORLD_V2_AREA_PRESENTATION[district.id];
      return [district.id, { materialId: presentation.materialId, palette: presentation.palette, board: presentation.board, artTarget: WORLD_V2_AREA_ART_HOOKS[district.id] ?? null }];
    })),
    roads: WORLD_V2_ROAD_ART_HOOK,
    authored,
  };

  return freezeDeep({
    id: WORLD_V2_RUNTIME_ID,
    displayName: 'Crypto Wasteland: Ten-Area Frontier',
    version: WORLD_V2_RUNTIME_VERSION,
    officialRun: official,
    rankedEligible: official,
    sourceMapId: geometry.sourceMapId,
    bounds,
    traversalTargetSeconds: { minimum: 10, maximum: 25 },
    player: { maxSpeed: 240, radius: WORLD_V2_PLAYER_RADIUS, spawn, protectedSpawnRadius: WORLD_V2_PROTECTED_SPAWN_RADIUS },
    routeClearance: { main: 192, bridge: 160, secondary: 144 },
    districts,
    seams,
    routeGraph: { nodes, edges },
    routes,
    baseSurface: geometry.baseSurface,
    surfaces: geometry.surfaces,
    blockers,
    collisionBlockers: geometry.collisionBlockers,
    visibleBarriers,
    perimeter,
    crossings,
    legalAscents,
    landmarks,
    pointsOfInterest,
    encounterArenas,
    interactions: { destructibles: [], hazards: [], explosiveZones: [] },
    spawnPoints,
    reveal: { cellSize: REVEAL_CELL_SIZE, radius: REVEAL_RADIUS },
    // Legacy ground paths are drawn by the production renderer unless a world
    // supplies its own list; the ten-area world has none yet.
    groundPaths: [],
    artPlans,
  });
}

export function createWorldV2GroundQuery(world) {
  return createAuthoredGroundQuery({ baseSurface: world.baseSurface, surfaces: world.surfaces });
}

export function getWorldV2DistrictAt(world, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('district query coordinates must be finite');
  return world.districts.find((district) => x >= district.area.minX && x <= district.area.maxX && y >= district.area.minY && y <= district.area.maxY) ?? null;
}

// Reveal bookkeeping parameterised by the world's bounds and reveal cell; the
// same algorithm as the legacy level-one reveal helpers.
export function createWorldRevealState(world) {
  const cell = world.reveal.cellSize;
  return {
    revealedCellIds: new Set(),
    columns: Math.ceil((world.bounds.maxX - world.bounds.minX) / cell),
    rows: Math.ceil((world.bounds.maxY - world.bounds.minY) / cell),
  };
}

export function revealWorldAt(world, state, position, radius = world.reveal.radius) {
  if (!(state?.revealedCellIds instanceof Set)) throw new TypeError('reveal state is required');
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y) || !Number.isFinite(radius) || radius < 0) throw new TypeError('reveal position and radius must be finite');
  const cell = world.reveal.cellSize;
  const { minX, minY } = world.bounds;
  const priorSize = state.revealedCellIds.size;
  const minimumColumn = Math.max(0, Math.floor((position.x - radius - minX) / cell));
  const maximumColumn = Math.min(state.columns - 1, Math.floor((position.x + radius - minX) / cell));
  const minimumRow = Math.max(0, Math.floor((position.y - radius - minY) / cell));
  const maximumRow = Math.min(state.rows - 1, Math.floor((position.y + radius - minY) / cell));
  for (let row = minimumRow; row <= maximumRow; row += 1) {
    for (let column = minimumColumn; column <= maximumColumn; column += 1) {
      const center = { x: minX + (column + 0.5) * cell, y: minY + (row + 0.5) * cell };
      if (Math.hypot(center.x - position.x, center.y - position.y) <= radius + cell * Math.SQRT2 * 0.5) state.revealedCellIds.add(`${column}:${row}`);
    }
  }
  return state.revealedCellIds.size - priorSize;
}

export function getWorldRevealSnapshot(world, state) {
  if (!(state?.revealedCellIds instanceof Set)) throw new TypeError('reveal state is required');
  return freezeDeep({
    revealedCellIds: [...state.revealedCellIds].sort((a, b) => {
      const [aColumn, aRow] = a.split(':').map(Number);
      const [bColumn, bRow] = b.split(':').map(Number);
      return aRow - bRow || aColumn - bColumn;
    }),
    totalCells: state.columns * state.rows,
    columns: state.columns,
    rows: state.rows,
    cellSize: world.reveal.cellSize,
    alwaysVisibleBoundaryIds: world.visibleBarriers.map((barrier) => barrier.id).sort(),
  });
}

// Pickup placements for the ten caches, in the shape collectible-system and
// the authored prop display already consume.
export function buildWorldV2PointOfInterestPlacements(world) {
  return freezeDeep(world.pointsOfInterest.map((poi) => ({
    id: `poi:${poi.id}`,
    pointOfInterestId: poi.id,
    assetId: WORLD_V2_POINT_OF_INTEREST_ASSETS[poi.districtId].assetId,
    category: 'point-of-interest',
    districtId: poi.districtId,
    hook: poi.hook,
    x: poi.anchor.x,
    y: poi.anchor.y,
    runtimeAuthority: 'projection-only',
  })));
}

// A point is usable for a body of `radius` when the ground is walkable and the
// resting body touches nothing; the same swept primitive the runtime uses.
export function isWorldV2PointClear(world, queryGround, position, radius = WORLD_V2_PLAYER_RADIUS) {
  const ground = queryGround(position.x, position.y);
  if (!ground.walkable) return false;
  const body = createCollisionBody({ id: 'world-v2-clearance', kind: 'player', radius, minZ: 0, maxZ: 56 });
  const result = resolveSweptCircleMotion({ body, start: { x: position.x, y: position.y, z: ground.groundZ }, delta: { x: 0, y: 0 }, blockers: world.collisionBlockers, bounds: world.bounds });
  return result.contacts.length === 0 && result.depenetrations.length === 0 && result.position.x === position.x && result.position.y === position.y;
}

const inBounds = (world, value) => value.x >= world.bounds.minX && value.x <= world.bounds.maxX && value.y >= world.bounds.minY && value.y <= world.bounds.maxY;

export function auditWorldV2(world) {
  const errors = [];
  const nodeIds = new Set(world.routeGraph.nodes.map((node) => node.id));
  const adjacency = new Map([...nodeIds].map((id) => [id, []]));
  for (const edge of world.routeGraph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`route edge ${edge.id} references a missing node`);
    else {
      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from);
    }
  }
  const startNode = world.routeGraph.nodes.find((node) => node.x === world.player.spawn.x && node.y === world.player.spawn.y) ?? world.routeGraph.nodes[0];
  const reachable = new Set(startNode ? [startNode.id] : []);
  const queue = startNode ? [startNode.id] : [];
  while (queue.length) {
    const current = queue.shift();
    for (const next of [...(adjacency.get(current) ?? [])].sort()) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      queue.push(next);
    }
  }
  // Regional roads must form one network from the spawn. Authored local paths
  // are guidance polylines; a path that shares no node with the network is
  // reported, not failed: physical reachability is proven by the nav checker.
  const detachedRouteIds = world.routes.filter((route) => route.nodeIds.some((id) => !reachable.has(id))).map((route) => route.id).sort();
  if (detachedRouteIds.some((id) => world.routes.find((route) => route.id === id)?.local !== true)) errors.push('route graph is disconnected');
  for (const node of world.routeGraph.nodes) if (!inBounds(world, node)) errors.push(`route node ${node.id} is outside world bounds`);
  for (const [index, district] of world.districts.entries()) {
    if (!inBounds(world, { x: district.area.minX, y: district.area.minY }) || !inBounds(world, { x: district.area.maxX, y: district.area.maxY })) errors.push(`district ${district.id} is outside world bounds`);
    for (const other of world.districts.slice(index + 1)) {
      if (district.area.minX < other.area.maxX && other.area.minX < district.area.maxX && district.area.minY < other.area.maxY && other.area.minY < district.area.maxY) errors.push(`district ${district.id} overlaps ${other.id}`);
    }
  }
  const districtIds = new Set(world.districts.map((district) => district.id));
  for (const seam of world.seams) if (!seam.districtIds.every((id) => districtIds.has(id))) errors.push(`seam ${seam.id} references a missing district`);
  const collisionAudit = auditCollisionWorld({ blockers: world.collisionBlockers, visibleBarriers: world.visibleBarriers });
  errors.push(...collisionAudit.errors);
  const ids = [];
  for (const collection of [world.pointsOfInterest, world.encounterArenas, world.interactions.destructibles, world.interactions.explosiveZones, world.spawnPoints, world.landmarks]) {
    for (const item of collection) ids.push(item.id);
  }
  if (new Set(ids).size !== ids.length) errors.push('authored world feature IDs are not unique');
  const queryGround = createWorldV2GroundQuery(world);
  if (!isWorldV2PointClear(world, queryGround, world.player.spawn, world.player.radius)) errors.push('player spawn is not walkable and clear');
  if (world.spawnPoints.length < 12) errors.push('fewer than twelve spawn points');
  for (const spawnPoint of world.spawnPoints) {
    if (!districtIds.has(spawnPoint.districtId)) errors.push(`spawn point ${spawnPoint.id} references a missing district`);
    if (Math.hypot(spawnPoint.x - world.player.spawn.x, spawnPoint.y - world.player.spawn.y) <= world.player.protectedSpawnRadius) errors.push(`spawn point ${spawnPoint.id} is inside the protected spawn radius`);
    if (!isWorldV2PointClear(world, queryGround, spawnPoint, world.player.radius)) errors.push(`spawn point ${spawnPoint.id} is not walkable and clear`);
    const district = getWorldV2DistrictAt(world, spawnPoint.x, spawnPoint.y);
    if (district?.id !== spawnPoint.districtId) errors.push(`spawn point ${spawnPoint.id} lies outside its district`);
  }
  for (const poi of world.pointsOfInterest) if (!isWorldV2PointClear(world, queryGround, poi.anchor, world.player.radius)) errors.push(`point of interest ${poi.id} is not walkable and clear`);
  for (const arena of world.encounterArenas) if (!districtIds.has(arena.districtId)) errors.push(`arena ${arena.id} references a missing district`);
  return freezeDeep({ ok: errors.length === 0, errors: errors.sort(), reachableNodeIds: [...reachable].sort(), detachedRouteIds });
}
