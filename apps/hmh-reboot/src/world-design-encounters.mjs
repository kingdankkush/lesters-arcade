import { freezeDeep } from './value-guards.mjs';

// Authored world space. None of these choices depend on viewport or quality.
export const WORLD_DESIGN_SITES = freezeDeep([
  { id: 'relay-power', districtId: 'frontier-relay', name: 'Farmstead power station', kind: 'generator', x: 340, y: 3540, holdTicks: 90, reward: 'heal', gateId: 'relay-supply-gate', arenaId: 'relay-training-yard', color: 0x9de4b1 },
  { id: 'ravine-winch', districtId: 'rugpull-ravine', name: 'Quarry winch', kind: 'winch', x: 2990, y: 2810, holdTicks: 120, gateId: 'ravine-salvage-gate', arenaId: 'ravine-ambush-bowl', color: 0xf1bd83 },
  { id: 'crossing-pump', districtId: 'liquidity-crossing', name: 'Reservoir pump', kind: 'pump', x: 5800, y: 4280, holdTicks: 150, reward: 'ammo', arenaId: 'crossing-lockdown', color: 0x81dce4 },
  { id: 'hashwood-shrine', districtId: 'hashwood', name: 'Woodland sanctuary', kind: 'shrine', x: 7380, y: 3450, holdTicks: 120, reward: 'heal', arenaId: 'hashwood-clearing-arena', color: 0xc6e798 },
  { id: 'mining-valve', districtId: 'mining-camp', name: 'Pressure relief valve', kind: 'vent', x: 9210, y: 3030, holdTicks: 90, hazard: { x: 9080, y: 2880, radius: 110, warningTicks: 90, durationTicks: 150 }, arenaId: 'mining-yard-arena', color: 0xffbe75 },
  { id: 'yard-warehouse', districtId: 'liquidation-yard', name: 'Warehouse supplies', kind: 'cache', x: 10490, y: 3910, holdTicks: 180, reward: 'ammo', gateId: 'yard-service-gate', arenaId: 'liquidator-arena', color: 0xe9afd0 },
]);

export const WORLD_DESIGN_SITE_PROPS = freezeDeep(WORLD_DESIGN_SITES.map(s=>({id:`world-control:${s.id}`,collisionBlockerId:`${s.id}-control-body`,assetId:'liquidation-terminal',category:'environment',x:s.x+(s.id==='relay-power'?140:170),y:s.y-110,scale:.42})));
export const WORLD_DESIGN_ORCHARD = freezeDeep([
  [180,3200],[180,3420],[180,3640],
].map(([x,y],i)=>({id:`world-orchard:${i}`,collisionBlockerId:`relay-orchard-tree-${i}`,assetId:'hashwood-tree',category:'environment',x,y,scale:1.05})));
export const WORLD_DESIGN_PROP_BLOCKERS = freezeDeep([...WORLD_DESIGN_SITE_PROPS,...WORLD_DESIGN_ORCHARD].map(p=>({
  id:p.collisionBlockerId,districtId:p.id.startsWith('world-orchard')?'frontier-relay':WORLD_DESIGN_SITES.find(s=>`world-control:${s.id}`===p.id).districtId,
  anchor:{x:p.x,y:p.y},visualKind:p.id.startsWith('world-orchard')?'dense-trees':'machinery',
  shape:{type:'circle',x:p.x,y:p.y,radius:p.id.startsWith('world-orchard')?16:20},maxZ:p.id.startsWith('world-orchard')?150:64,combatCover:true,
})));

export function buildWorldDesignPerimeter(bounds) {
  const {minX,minY,maxX,maxY}=bounds;
  return [
    ['north','rugpull-ravine','cliff',minX+24,minY+18,maxX-24,minY+18,18,140],
    ['south','rugpull-ravine','cliff',minX+24,maxY-18,maxX-24,maxY-18,18,100],
    ['west','frontier-relay','fence',minX+12,minY+18,minX+12,maxY-18,12,72],
    ['east','liquidation-yard','fence',maxX-12,minY+18,maxX-12,maxY-18,12,72],
  ].map(([side,districtId,visualKind,ax,ay,bx,by,radius,maxZ])=>({id:`world-perimeter-${side}`,districtId,visualKind,anchor:{x:(ax+bx)/2,y:(ay+by)/2},shape:{type:'capsule',a:{x:ax,y:ay},b:{x:bx,y:by},radius},maxZ,combatCover:true}));
}

// Low fences frame optional supply courts. Opening the gate removes exactly
// one collider; side rails remain, so the opening has a visible physical cause.
const courts = [
  ['relay-supply', 'frontier-relay', 340, 3310],
  ['ravine-salvage', 'rugpull-ravine', 2990, 2580],
  ['yard-service', 'liquidation-yard', 10490, 3680],
];
export const WORLD_DESIGN_COURTS = freezeDeep(courts.map(([id, districtId, x, y]) => ({id, districtId, x, y})));
export const WORLD_DESIGN_GATE_IDS = freezeDeep(courts.map(([id]) => `${id}-gate`));
export const WORLD_DESIGN_COURT_BLOCKERS = freezeDeep(courts.flatMap(([id, districtId, x, y]) => [
  ['west', x-105, y-100, x-105, y+100],
  ['east', x+105, y-100, x+105, y+100],
  ['north', x-105, y-100, x+105, y-100],
  ['gate', x-105, y+100, x+105, y+100],
].map(([side, ax, ay, bx, by]) => ({
  id: `${id}-${side}`, districtId, anchor: { x: (ax+bx)/2, y: (ay+by)/2 },
  visualKind: 'fence', shape: { type: 'capsule', a: {x:ax,y:ay}, b: {x:bx,y:by}, radius: 12 },
  maxZ: 52, combatCover: true,
}))));

// Routes are deliberately open-ended spokes or closed circuits; return paths
// are tested with collision and directed elevation, not just graph adjacency.
export const WORLD_DESIGN_EXPLORATION_PATHS = freezeDeep([
  { id: 'farmstead-circuit', kind: 'footpath', width: 144, districtId: 'frontier-relay', points: [[1250,3200],[1110,3580],[670,3620],[340,3540],[520,3540],[600,3860],[1050,3860],[1250,3200]] },
  { id: 'quarry-court', kind: 'footpath', width: 144, districtId: 'rugpull-ravine', points: [[3250,3000],[3200,2840],[2990,2810],[2720,2850],[2560,3060],[3250,3000]] },
  { id: 'woodland-sanctuary', kind: 'footpath', width: 144, districtId: 'hashwood', points: [[7450,3200],[7380,3450],[7570,3590],[7740,3370],[7740,2800],[7900,2500]] },
  { id: 'loading-yard-loop', kind: 'street', width: 160, districtId: 'mining-camp', points: [[9450,3200],[9210,3030],[8850,3050],[8650,3200],[9060,3200],[9060,3700],[9350,3700],[9450,3200]] },
  { id: 'warehouse-court-loop', kind: 'street', width: 160, districtId: 'liquidation-yard', points: [[11350,3400],[11065,3400],[11065,3900],[10760,3930],[10490,3910],[10600,4030],[11065,4040],[11065,3400],[11350,3400]] },
].map(path => ({ ...path, points: path.points.map(([x,y]) => ({x,y})) })));

export const WORLD_DESIGN_ARENA_ROLES = freezeDeep([
  ['relay-training-yard','Farmyard','open lanes / low cover','farmstead-circuit'],
  ['ravine-ambush-bowl','Quarry bowl','overlook / ground flank','quarry-court'],
  ['crossing-lockdown','Bridgehead','bank staging / bridge commitment','crossing-reservoir-cut-through'],
  ['hashwood-clearing-arena','Woodland clearing','root islands / circular flank','woodland-sanctuary'],
  ['mining-yard-arena','Loading yard','cross lanes / steam counterplay','loading-yard-loop'],
  ['liquidator-arena','Market and alleys','open square / tight service courts','warehouse-court-loop'],
].map(([arenaId,name,tactics,pathId]) => ({arenaId,name,tactics,pathId})));
