// Dormant preparation for the authored ten-area world. No runtime, URL, seed,
// schema or verifier registration imports this module. Input is trusted authored
// data, not a network payload. Inspection metadata never defines gameplay rules.
import { createAuthoredGroundQuery } from './elevation.mjs';
import { finite, freezeDeep, lexical, point2, positive } from './value-guards.mjs';

function label(value, name) {
  if (typeof value !== 'string' || !value) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}
function boundsOf(value, name) {
  const bounds = Object.fromEntries(['minX', 'minY', 'maxX', 'maxY'].map(key => [key, finite(value?.[key], `${name}.${key}`)]));
  if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new TypeError(`${name} must be ordered`);
  return bounds;
}
const contains = (bounds, point) => point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
const areaContaining = (areas, point) => areas.find(area => contains(area.bounds, point)) ?? null;
const overlaps = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
function uniqueIds(rows, name) {
  const ids = new Set();
  for (const row of rows) {
    label(row.id, `${name}.id`);
    if (ids.has(row.id)) throw new TypeError(`${name} has duplicate id ${row.id}`);
    ids.add(row.id);
  }
}

export function createWorldV2Geometry(authored) {
  if (authored?.officialRun !== false || authored?.rankedEligible !== false || authored?.rulesVersion !== null) {
    throw new TypeError('world geometry must remain unofficial, unranked and rules-null');
  }
  label(authored.mapId, 'source map id');
  const bounds = boundsOf(authored.bounds, 'world bounds');
  for (const key of ['areas', 'roads', 'sites', 'surfaces', 'collisionBlockers']) {
    if (!Array.isArray(authored[key])) throw new TypeError(`${key} must be an array`);
  }
  if (!authored.baseSurface?.area) throw new TypeError('baseSurface is required');
  const areas = authored.areas.map(area => ({ id: label(area.id, 'area.id'), name: label(area.name, 'area.name'), bounds: boundsOf(area.bounds, 'area bounds') }))
    .sort((a, b) => lexical(a.id, b.id));
  uniqueIds(areas, 'areas');
  for (const [index, area] of areas.entries()) {
    if (!contains(bounds, { x: area.bounds.minX, y: area.bounds.minY }) || !contains(bounds, { x: area.bounds.maxX, y: area.bounds.maxY })) {
      throw new TypeError(`area ${area.id} is outside world bounds`);
    }
    if (areas.slice(index + 1).some(other => overlaps(area.bounds, other.bounds))) throw new TypeError(`area ${area.id} overlaps another area`);
  }
  const byArea = new Map(areas.map(area => [area.id, area]));
  const roads = authored.roads.map(road => {
    const from = byArea.get(road.fromAreaId), to = byArea.get(road.toAreaId);
    if (!from || !to || from.id === to.id) throw new TypeError('road requires two known distinct areas');
    if (!Array.isArray(road.points) || road.points.length < 2) throw new TypeError('road requires a polyline');
    const points = road.points.map(point => point2(point, 'road point'));
    if (points.some(point => !contains(bounds, point)) || areaContaining(areas, points[0])?.id !== from.id || areaContaining(areas, points.at(-1))?.id !== to.id) {
      throw new TypeError('road points must be inside their world and match deterministic endpoint area ownership');
    }
    if (points.slice(1).some((point, index) => point.x === points[index].x && point.y === points[index].y)) throw new TypeError('road segments must have length');
    return { id: label(road.id, 'road.id'), fromAreaId: from.id, toAreaId: to.id, kind: label(road.kind, 'road.kind'), width: positive(road.width, 'road.width'), points };
  }).sort((a, b) => lexical(a.id, b.id));
  uniqueIds(roads, 'roads');
  const byRoad = new Map(roads.map(road => [road.id, road]));
  const roadEntrances = authored.sites.filter(site => site.kind === 'entrance').map(site => {
    const road = byRoad.get(site.roadId);
    const endpoint = road && (site.areaId === road.fromAreaId ? road.points[0] : site.areaId === road.toAreaId ? road.points.at(-1) : null);
    const point = point2(site, 'road entrance');
    if (!endpoint || point.x !== endpoint.x || point.y !== endpoint.y || site.runtimeEffect !== 'none') throw new TypeError('road entrance must match its inert endpoint');
    return { id: label(site.id, 'entrance.id'), areaId: site.areaId, roadId: site.roadId, ...point };
  }).sort((a, b) => lexical(a.id, b.id));
  uniqueIds(roadEntrances, 'road entrances');
  for (const road of roads) for (const areaId of [road.fromAreaId, road.toAreaId]) {
    if (roadEntrances.filter(entry => entry.roadId === road.id && entry.areaId === areaId).length !== 1) throw new TypeError('road needs exactly one entrance per endpoint');
  }
  const inspectionStart = point2(authored.spawn, 'inspection start');
  if (!contains(bounds, inspectionStart)) throw new TypeError('inspection start is outside world bounds');
  // structuredClone preserves infinite height bands and exact authored numbers.
  // Select fields before copying: opaque callbacks and staged effects stay out.
  const data = freezeDeep(structuredClone({ sourceMapId: authored.mapId, officialRun: false, rankedEligible: false, rulesVersion: null,
    bounds, areas, roads, roadEntrances, inspectionStart, baseSurface: authored.baseSurface,
    surfaces: authored.surfaces, collisionBlockers: authored.collisionBlockers }));
  const queryGround = createAuthoredGroundQuery(data);
  const getAreaAt = (x, y) => {
    const point = { x: finite(x, 'area query x'), y: finite(y, 'area query y') };
    if (!contains(data.bounds, point)) return null;
    return areaContaining(data.areas, point);
  };
  return Object.freeze({ ...data, queryGround, getAreaAt });
}
