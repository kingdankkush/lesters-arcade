import { freezeDeep } from './value-guards.mjs';

// Authored world space. None of these choices depend on viewport or quality.
// (x, y) is the machine's operate spot (package §3.2): the hero docks there
// facing east or west, toward the control prop 46 units away. Each spot sits
// beside its footpath, so the prop never narrows a route, a path, a lot or an
// encounter floor, stays clear of the courts, and the placement rules of §3.4
// hold (tests/hmh-mission-placement.test.mjs).
// holdTicks is the mission fill: a button 30, a lever 45, a crank or valve 90
// (mission-objectives.mjs gives each its mode).
export const WORLD_DESIGN_SITES = freezeDeep([
  { id: 'relay-power', districtId: 'frontier-relay', name: 'Farmstead power station', kind: 'generator', x: 490, y: 3780, facing: 'west', holdTicks: 30, reward: 'heal', gateId: 'relay-supply-gate', arenaId: 'relay-training-yard', color: 0x9de4b1 },
  { id: 'ravine-winch', districtId: 'rugpull-ravine', name: 'Quarry winch', kind: 'winch', x: 3050, y: 3120, facing: 'east', holdTicks: 90, gateId: 'ravine-salvage-gate', arenaId: 'ravine-ambush-bowl', color: 0xf1bd83 },
  { id: 'crossing-pump', districtId: 'liquidity-crossing', name: 'Reservoir pump', kind: 'pump', x: 5710, y: 4280, facing: 'west', holdTicks: 90, reward: 'ammo', gateId: 'crossing-haven-gate', arenaId: 'crossing-lockdown', color: 0x81dce4 },
  { id: 'hashwood-shrine', districtId: 'hashwood', name: 'Woodland sanctuary', kind: 'shrine', x: 7380, y: 3550, facing: 'west', holdTicks: 90, reward: 'heal', gateId: 'hashwood-sanctuary-gate', arenaId: 'hashwood-clearing-arena', color: 0xc6e798 },
  // The steam vents across the trap court's mouth: the gate opens at once, but
  // the reward is only safe once the warning ring and the burst have passed.
  { id: 'mining-valve', districtId: 'mining-camp', name: 'Pressure relief valve', kind: 'vent', x: 9590, y: 3000, facing: 'east', holdTicks: 90, hazard: { x: 9310, y: 2960, radius: 110, warningTicks: 90, durationTicks: 150 }, gateId: 'mining-trap-gate', arenaId: 'mining-yard-arena', color: 0xffbe75 },
  { id: 'yard-warehouse', districtId: 'liquidation-yard', name: 'Warehouse supplies', kind: 'cache', x: 10390, y: 3890, facing: 'west', holdTicks: 45, reward: 'ammo', gateId: 'yard-service-gate', arenaId: 'liquidator-arena', color: 0xe9afd0 },
]);

export const WORLD_DESIGN_SITE_PROPS = freezeDeep(WORLD_DESIGN_SITES.map(s=>({id:`world-control:${s.id}`,collisionBlockerId:`${s.id}-control-body`,assetId:'liquidation-terminal',category:'environment',x:s.x+(s.facing==='east'?46:-46),y:s.y,scale:.42})));
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
// The gate faces its machinery; the other three sides keep their compass names.
const courts = [
  ['relay-supply', 'frontier-relay', 340, 3310, 'south'],
  ['ravine-salvage', 'rugpull-ravine', 2990, 2580, 'south'],
  ['crossing-haven', 'liquidity-crossing', 6040, 4285, 'west'],
  ['hashwood-sanctuary', 'hashwood', 7150, 3450, 'east'],
  ['mining-trap', 'mining-camp', 9300, 2790, 'south'],
  ['yard-service', 'liquidation-yard', 10490, 3680, 'south'],
];
// The Dark Pool (design package 4.3, shipped-map fallback, slice S1.5): a
// walled z0 court in the east back alley. The world perimeter is its east
// side; the hero comes in from the north through a cracked container (a
// breakable, world-destructibles.mjs), whose gap is the door. Entering finds
// the Warehouse logbook (a secret), and once the Liquidator is ready and no
// other trigger owns him, crossing 48 units past the threshold starts his fight
// here with no intro. The door then seals (a boss lock, boss-arenas.mjs).
export const WORLD_DESIGN_DARK_POOL = freezeDeep({
  id: 'dark-pool', districtId: 'liquidation-yard',
  // Where bodies may stand (the walls' inner faces and the perimeter).
  bounds: { minX: 11592, minY: 1916, maxX: 11976, maxY: 2684 },
  threshold: { y: 1900, enterDepth: 48 },
  // The door is wide enough for the 60-unit navgrid (18 clearance) once open.
  door: { a: { x: 11720, y: 1900 }, b: { x: 11860, y: 1900 } },
  container: { id: 'dark-pool-container', x: 11790, y: 1900, radius: 56 },
  wallRadius: 16,
});
export const WORLD_DESIGN_DARK_POOL_BLOCKERS = freezeDeep([
  ['west', 11576, 1900, 11576, 2700],
  ['south', 11576, 2700, 11976, 2700],
  ['north-west', 11576, 1900, 11720, 1900],
  ['north-east', 11860, 1900, 11976, 1900],
].map(([side, ax, ay, bx, by]) => ({
  id: `dark-pool-wall-${side}`, districtId: 'liquidation-yard', anchor: { x: (ax+bx)/2, y: (ay+by)/2 },
  visualKind: 'fence', shape: { type: 'capsule', a: {x:ax,y:ay}, b: {x:bx,y:by}, radius: 16 },
  maxZ: 96, combatCover: true,
})));

export const WORLD_DESIGN_COURTS = freezeDeep(courts.map(([id, districtId, x, y, gateSide]) => ({id, districtId, x, y, gateSide, gateId: `${id}-gate`})));
export const WORLD_DESIGN_GATE_IDS = freezeDeep(courts.map(([id]) => `${id}-gate`));
export const WORLD_DESIGN_COURT_BLOCKERS = freezeDeep(courts.flatMap(([id, districtId, x, y, gateSide]) => [
  ['west', x-105, y-100, x-105, y+100],
  ['east', x+105, y-100, x+105, y+100],
  ['north', x-105, y-100, x+105, y-100],
  ['south', x-105, y+100, x+105, y+100],
].map(([side, ax, ay, bx, by]) => ({
  id: `${id}-${side === gateSide ? 'gate' : side}`, districtId, anchor: { x: (ax+bx)/2, y: (ay+by)/2 },
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
