// Authoring/navigation-playtest geometry only. Never a canonical run or rule set.
import { createStaticBlocker } from '../collision.mjs';
import { createElevationSurface } from '../elevation.mjs';
import { freezeDeep } from '../value-guards.mjs';
// `prop-solid`: the collider authored under a plan's own blocking kit card (a
// car, barrier, transformer, rock or tree trunk). It carries its cover flags
// explicitly and names the card it stands under (`artPlanId`, `artProp`).
const solidKinds = new Set(['mass', 'cliff', 'cover-tall', 'cover-short', 'prop-solid']);
const floorKinds = new Set(['road', 'deck', 'ramp', 'ledge', 'water', 'bridge']);
const polygonEpsilon=1e-8;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<=polygonEpsilon&&p.x>=Math.min(a.x,b.x)-polygonEpsilon&&p.x<=Math.max(a.x,b.x)+polygonEpsilon&&p.y>=Math.min(a.y,b.y)-polygonEpsilon&&p.y<=Math.max(a.y,b.y)+polygonEpsilon;
function segmentsIntersect(a,b,c,d){
  const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
  return(ac>polygonEpsilon&&ad< -polygonEpsilon||ac< -polygonEpsilon&&ad>polygonEpsilon)&&(ca>polygonEpsilon&&cb< -polygonEpsilon||ca< -polygonEpsilon&&cb>polygonEpsilon)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
export function createGreyboxPiece(spec = {}) {
  if (typeof spec.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(spec.id)) throw new TypeError('greybox id required');
  if (!solidKinds.has(spec.kind) && !floorKinds.has(spec.kind) && !['climb-marker', 'drop-marker'].includes(spec.kind)) throw new TypeError('unsupported greybox kind');
  const water = spec.kind === 'water';
  if (water && (spec.walkable !== undefined && spec.walkable !== false || spec.deepWater !== undefined && spec.deepWater !== true)) throw new TypeError('water must remain nonwalkable deepWater');
  const bounds = Object.fromEntries(['minX', 'minY', 'maxX', 'maxY'].map(key => [key, spec.bounds?.[key]]));
  if (!Object.values(bounds).every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new TypeError('finite positive greybox bounds required');
  const height = spec.height ?? (spec.kind === 'cover-short' ? 48 : spec.kind === 'cover-tall' ? 128 : solidKinds.has(spec.kind) ? 240 : 0);
  if (!Number.isFinite(height) || height < 0 || (solidKinds.has(spec.kind) && height === 0)) throw new TypeError('positive solid or nonnegative floor height required');
  if (spec.areaId !== undefined && spec.areaId !== null && typeof spec.areaId !== 'string') throw new TypeError('greybox areaId must be a string');
  if ((spec.kind === 'cover-short' && (height < 24 || height > 72)) || (spec.kind === 'cover-tall' && (height < 96 || height > 192))) throw new TypeError('cover height must match its declared short/tall kind');
  let vertices=[{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY }];
  if(spec.vertices!==undefined){
    if(!['mass','cliff','water'].includes(spec.kind)||!Array.isArray(spec.vertices)||spec.vertices.length<3||!spec.vertices.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)))throw new TypeError('finite solid mass or water polygon required');
    vertices=spec.vertices.map(({x,y})=>({x,y}));
    // Local convex turns alone accept stars and repeated loops. Reject these
    // before the unchanged collision constructor receives the authored shape.
    for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++)if(Math.hypot(vertices[i].x-vertices[j].x,vertices[i].y-vertices[j].y)<=polygonEpsilon)throw new TypeError('polygon duplicate vertex or zero-length edge');
    for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++){
      if(j===i+1||i===0&&j===vertices.length-1)continue;
      if(segmentsIntersect(vertices[i],vertices[(i+1)%vertices.length],vertices[j],vertices[(j+1)%vertices.length]))throw new TypeError('polygon must be simple without intersecting edges');
    }
    if(Math.min(...vertices.map(p=>p.x))!==bounds.minX||Math.max(...vertices.map(p=>p.x))!==bounds.maxX||Math.min(...vertices.map(p=>p.y))!==bounds.minY||Math.max(...vertices.map(p=>p.y))!==bounds.maxY)throw new TypeError('polygon must match its visible bounds');
    const signed=vertices.reduce((sum,p,i)=>{const q=vertices[(i+1)%vertices.length];return sum+p.x*q.y-p.y*q.x;},0);
    if(Math.abs(signed)<=polygonEpsilon)throw new TypeError('polygon must have positive area');
    if(signed<0)vertices.reverse(); // Same geometry, canonical winding for the unchanged nav narrow phase.
  }
  const prop = spec.kind === 'prop-solid';
  if (prop && (typeof spec.artPlanId !== 'string' || typeof spec.artProp?.source !== 'string' || !Number.isFinite(spec.artProp?.x) || !Number.isFinite(spec.artProp?.y) || typeof spec.combatCover !== 'boolean' || !['tall', 'short', 'none'].includes(spec.coverKind))) throw new TypeError('prop solid requires its art plan, card and explicit cover flags');
  const visible = { id: `greybox-${spec.id}`, kind: spec.kind, bounds, height, ...(spec.vertices!==undefined?{vertices}:{}), areaId: spec.areaId ?? null, annotation: ['climb-marker', 'drop-marker'].includes(spec.kind) ? 'Future traversal annotation; no new control or movement permission' : null, ...(prop ? { artPlanId: spec.artPlanId, artProp: { source: spec.artProp.source, x: spec.artProp.x, y: spec.artProp.y } } : {}) };
  const shape = { type: 'polygon', vertices };
  const blocker = solidKinds.has(spec.kind) ? createStaticBlocker({ id: spec.id, shape, minZ: 0, maxZ: height, visibleAssetId: visible.id, combatCover: prop ? spec.combatCover : spec.kind.startsWith('cover-'), coverKind: prop ? spec.coverKind : spec.kind === 'cover-tall' ? 'tall' : spec.kind === 'cover-short' ? 'short' : null }) : null;
  const surfaceKind = water ? 'water' : spec.kind === 'bridge' ? 'bridge' : spec.kind === 'ramp' ? 'ramp' : spec.kind === 'ledge' ? 'ledge' : 'ground';
  const surface = floorKinds.has(spec.kind) ? createElevationSurface({
    id: spec.id, kind: surfaceKind, area: water && spec.vertices !== undefined ? shape : { type: 'rect', ...bounds },
    groundZ: height, fromZ: spec.fromZ ?? height, toZ: spec.toZ ?? height, axis: spec.axis ?? 'x',
    priority: spec.priority ?? (water ? 30 : spec.kind === 'bridge' ? 41 : 20), visibleTerrainId: visible.id,
    oneWayDrop: spec.oneWayDrop ?? null, visibleStepId: spec.visibleStepId === true ? visible.id : spec.visibleStepId ?? null,
    walkable: !water, deepWater: water,
  }) : null;
  return freezeDeep({ id: spec.id, kind: spec.kind, visible, blocker, surface });
}
