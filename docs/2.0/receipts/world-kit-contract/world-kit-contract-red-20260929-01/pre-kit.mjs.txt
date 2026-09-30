// Authoring/navigation-playtest geometry only. Never a canonical run or rule set.
import { createStaticBlocker } from '../collision.mjs';
import { createElevationSurface } from '../elevation.mjs';
import { freezeDeep } from '../value-guards.mjs';
const solidKinds = new Set(['mass', 'cliff', 'cover-tall', 'cover-short']);
const floorKinds = new Set(['road', 'deck', 'ramp', 'ledge']);
export function createGreyboxPiece(spec = {}) {
  if (typeof spec.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(spec.id)) throw new TypeError('greybox id required');
  if (!solidKinds.has(spec.kind) && !floorKinds.has(spec.kind) && !['climb-marker', 'drop-marker'].includes(spec.kind)) throw new TypeError('unsupported greybox kind');
  const bounds = Object.fromEntries(['minX', 'minY', 'maxX', 'maxY'].map(key => [key, spec.bounds?.[key]]));
  if (!Object.values(bounds).every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new TypeError('finite positive greybox bounds required');
  const height = spec.height ?? (spec.kind === 'cover-short' ? 48 : spec.kind === 'cover-tall' ? 128 : solidKinds.has(spec.kind) ? 240 : 0);
  if (!Number.isFinite(height) || height < 0 || (solidKinds.has(spec.kind) && height === 0)) throw new TypeError('positive solid or nonnegative floor height required');
  if (spec.areaId !== undefined && spec.areaId !== null && typeof spec.areaId !== 'string') throw new TypeError('greybox areaId must be a string');
  if ((spec.kind === 'cover-short' && (height < 24 || height > 72)) || (spec.kind === 'cover-tall' && (height < 96 || height > 192))) throw new TypeError('cover height must match its declared short/tall kind');
  let vertices=[{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY }];
  if(spec.vertices!==undefined){
    if(!['mass','cliff'].includes(spec.kind)||!Array.isArray(spec.vertices)||spec.vertices.length<3||!spec.vertices.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)))throw new TypeError('finite solid mass polygon required');
    vertices=spec.vertices.map(({x,y})=>({x,y}));
    if(Math.min(...vertices.map(p=>p.x))!==bounds.minX||Math.max(...vertices.map(p=>p.x))!==bounds.maxX||Math.min(...vertices.map(p=>p.y))!==bounds.minY||Math.max(...vertices.map(p=>p.y))!==bounds.maxY)throw new TypeError('polygon must match its visible bounds');
    const signed=vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p.x*q.y-p.y*q.x;},0);
    if(signed<0)vertices.reverse(); // Same geometry, canonical winding for the unchanged nav narrow phase.
  }
  const visible = { id: `greybox-${spec.id}`, kind: spec.kind, bounds, height, ...(spec.vertices!==undefined?{vertices}:{}), areaId: spec.areaId ?? null, annotation: ['climb-marker', 'drop-marker'].includes(spec.kind) ? 'Future traversal annotation; no new control or movement permission' : null };
  const shape = { type: 'polygon', vertices };
  const blocker = solidKinds.has(spec.kind) ? createStaticBlocker({ id: spec.id, shape, minZ: 0, maxZ: height, visibleAssetId: visible.id, combatCover: spec.kind.startsWith('cover-') }) : null;
  const surface = floorKinds.has(spec.kind) ? createElevationSurface({ id: spec.id, kind: spec.kind === 'ramp' ? 'ramp' : spec.kind === 'ledge' ? 'ledge' : 'ground', area: { type: 'rect', ...bounds }, groundZ: height, fromZ: spec.fromZ ?? height, toZ: spec.toZ ?? height, axis: spec.axis ?? 'x', priority: spec.priority ?? 20, visibleTerrainId: visible.id, oneWayDrop: spec.oneWayDrop ?? null, visibleStepId:spec.visibleStepId===true?visible.id:spec.visibleStepId??null, walkable: true, deepWater: false }) : null;
  return freezeDeep({ id: spec.id, kind: spec.kind, visible, blocker, surface });
}
