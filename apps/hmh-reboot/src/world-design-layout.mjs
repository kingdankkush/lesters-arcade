import { freezeDeep } from './value-guards.mjs';
import { WORLD_DESIGN_EXPLORATION_PATHS } from './world-design-encounters.mjs';

const model = (id,name) => `hmh-ld2-${id}-${name}`;
export const WORLD_DESIGN_ASSETS = freezeDeep({
  farmhouse:model('62','clapboard-farmhouse'),pickup:model('54','rusted-pickup-truck'),well:model('80','stone-well-with-winch'),
  hedge:model('75','hedgerow-section'),shelter:model('53','bus-shelter'),canopy:model('64','fuel-station-canopy'),
  warehouse:model('63','brick-warehouse'),bus:model('55','overturned-school-bus'),chapel:model('65','steepled-chapel'),
  traffic:model('52','traffic-light-mast'),conifer:model('72','tall-conifer-trio'),stump:model('73','hollow-stump-shelf-fungus'),root:model('74','uprooted-root-ball'),
  cliff:'hmh-cx3-01-stratified-escarpment',duplex:'hmh-cx3-02-workers-duplex',pump:'hmh-cx3-03-lakeside-pumphouse',bridge:'hmh-cx3-05-timber-footbridge',
});
// Measurements are the selected model view's grounded XY bounds, rounded
// outward by at most one unit. Art uses the same uniform source scale.
export const WORLD_DESIGN_NEW_LOTS = freezeDeep([
  {id:'relay-stone-well',districtId:'frontier-relay',x:330,y:3720,width:120,depth:102,maxZ:130,asset:'well',scale:130},
  {id:'relay-hedgerow',districtId:'frontier-relay',x:330,y:1200,width:350,depth:90,maxZ:162,asset:'hedge',scale:350},
  {id:'relay-bus-shelter',districtId:'frontier-relay',x:480,y:4030,width:240,depth:146,maxZ:169,asset:'shelter',scale:240},
  {id:'yard-brick-warehouse',districtId:'liquidation-yard',x:10300,y:4150,width:400,depth:167,maxZ:140,asset:'warehouse',scale:400},
  {id:'yard-overturned-bus',districtId:'liquidation-yard',x:10900,y:4260,width:460,depth:176,maxZ:136,asset:'bus',scale:460},
  {id:'yard-steepled-chapel',districtId:'liquidation-yard',x:11750,y:500,width:285,depth:153,maxZ:350,asset:'chapel',scale:350},
  {id:'hashwood-hollow-stump',districtId:'hashwood',x:6200,y:3670,width:160,depth:160,maxZ:86,asset:'stump',scale:160},
  {id:'hashwood-uprooted-root',districtId:'hashwood',x:7750,y:1500,width:171,depth:156,maxZ:150,asset:'root',scale:170},
]);
const FIXED = freezeDeep([
  {blockerId:'relay-abandoned-farmhouse',asset:'farmhouse',scale:260},
  {blockerId:'relay-abandoned-pickup',asset:'pickup',scale:230},
  {blockerId:'town-fuel-island',asset:'canopy',scale:320},
  {blockerId:'ravine-south-escarpment-outcrop',asset:'cliff',scale:480},
  {blockerId:'yard-residential-duplex-south',asset:'duplex',scale:203},
  {blockerId:'crossing-lakeside-pumphouse',asset:'pump',scale:220},
]);
export function buildWorldDesignPlacements(world,assets) {
  const placements=[],blockerIds=new Set();
  const add=(id,asset,x,y,scale,extra={})=>{
    const assetId=WORLD_DESIGN_ASSETS[asset];
    if(!assets.has(assetId)) return false;
    placements.push(Object.freeze({id:`world-design:${id}`,assetId,x,y,scale,category:'environment',groundZ:0,...extra}));return true;
  };
  for(const spec of FIXED) {
    const feature=world.blockers.find(b=>b.id===spec.blockerId);
    if(!feature) throw new RangeError(`world design blocker missing: ${spec.blockerId}`);
    if(add(feature.id,spec.asset,feature.anchor.x,feature.anchor.y,spec.scale,{collisionBlockerId:feature.id})) blockerIds.add(feature.id);
  }
  for(const spec of WORLD_DESIGN_NEW_LOTS) if(add(spec.id,spec.asset,spec.x,spec.y,spec.scale,{collisionBlockerId:spec.id})) blockerIds.add(spec.id);
  // Continuous grounded undergrowth explains the collision capsule. Tall trees
  // grow through it at a separate cadence, without stretching a single canopy.
  for(const feature of world.blockers.filter(b=>b.districtId==='hashwood'&&b.visualKind==='dense-trees'&&b.shape.type==='capsule')) {
    if(!assets.has(WORLD_DESIGN_ASSETS.hedge)||!assets.has(WORLD_DESIGN_ASSETS.conifer)) continue;
    const {a,b,radius}=feature.shape,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(length/92));
    const nx=-dy/length,ny=dx/length;
    for(let i=0;i<=steps;i++) {
      const x=a.x+dx*i/steps,y=a.y+dy*i/steps;
      for(const [j,offset] of [-radius*.7,0,radius*.7].entries()) add(`${feature.id}:brush:${i}:${j}`,'hedge',x+nx*offset,y+ny*offset,150,{collisionBlockerId:feature.id});
      if(i%2===0) add(`${feature.id}:tree:${i}`,'conifer',x,y,270+(i%3)*16,{collisionBlockerId:feature.id});
    }
    blockerIds.add(feature.id);
  }
  if(add('crossing-footbridge','bridge',4750,975,100,{groundZ:0,occlusion:'deck'})) {
    blockerIds.add('crossing-footbridge-north-rail');blockerIds.add('crossing-footbridge-south-rail');
  }
  add('yard-traffic-light','traffic',10200,900,180);
  return Object.freeze({placements:Object.freeze(placements),blockerIds});
}

export function extendWorldDesignLandmarks(assets) {
  const aliases=[
    ['hashwood-beacon-setpiece',WORLD_DESIGN_ASSETS.conifer,360],
    ['forked-spire-setpiece',WORLD_DESIGN_ASSETS.cliff,380],
    ['crystal-cluster',WORLD_DESIGN_ASSETS.cliff,48],
    ['moss-boulder',WORLD_DESIGN_ASSETS.cliff,85],
    ['rock-spire',WORLD_DESIGN_ASSETS.cliff,130],
    ['relay-tower-setpiece','watchtower',2.2],
    ['liquidation-tower-setpiece','watchtower',2.4],
    ['proof-bridge-setpiece','watchtower',1.8],
    ['relay-console','liquidation-terminal',.8],
    ['warning-beacon',WORLD_DESIGN_ASSETS.traffic,85],
  ];
  for(const [id,sourceId,scale] of aliases) {
    const source=assets.get(sourceId);if(!source) continue;
    assets.set(id,{...source,frame:{...source.frame,runtimeScale:source.frame.runtimeScale*scale}});
  }
}

export const WORLD_DESIGN_GROUND_PATHS = freezeDeep([
  ...WORLD_DESIGN_EXPLORATION_PATHS,
  {id:'relay:training-path',kind:'footpath',width:144,points:[{x:1250,y:3200},{x:900,y:3450}]},
  {id:'yard:commercial-street',kind:'street',width:192,points:[{x:10200,y:1070},{x:11300,y:1070}]},
  {id:'yard:commercial-connection',kind:'street',width:144,points:[{x:10650,y:1250},{x:10650,y:1070}]},
  {id:'yard:south-service-lane',kind:'street',width:144,points:[{x:11350,y:3400},{x:11700,y:3430},{x:11750,y:4450},{x:10200,y:4450}]},
]);
