// Offline geometry proof. Not imported by a game entry, verifier or official run.
import { checkGreyboxNavigation } from './hmh-greybox-layout-check.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../../apps/hmh-reboot/src/collision.mjs';
import { resolveSweptTraversalPath, traceHeightAwareLineOfSight } from '../../apps/hmh-reboot/src/elevation.mjs';
const inside=(bounds,p)=>p.x>=bounds.minX&&p.x<=bounds.maxX&&p.y>=bounds.minY&&p.y<=bounds.maxY;
const rectangle=bounds=>bounds&&['minX','minY','maxX','maxY'].every(key=>Number.isFinite(bounds[key]))&&bounds.minX<bounds.maxX&&bounds.minY<bounds.maxY;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function checkGreyboxWorld(world) {
  if(!rectangle(world?.bounds)||typeof world.queryGround!=='function'||!point(world.spawn))throw new TypeError('authored greybox world/query/spawn required');
  for(const key of ['areas','roads','sites','arenas','collisionBlockers','pieces'])if(!Array.isArray(world[key]))throw new TypeError(`greybox ${key} array required`);
  const issues=[],warnings=[],add=(code,id=null)=>issues.push({code,id});
  if(world.rankedEligible!==false||world.officialRun!==false||world.rulesVersion!==null)add('OFFICIAL_RUN_BOUNDARY');
  if(world.areas.length!==10)add('AREA_COUNT');
  const areas=new Map(),sites=new Map(),roads=new Map();
  for(const area of world.areas){
    if(typeof area.id!=='string'||!area.id||areas.has(area.id))add('AREA_ID',area.id??null);
    else areas.set(area.id,area);
    if(!rectangle(area.bounds)||!point(area.center)||!inside(world.bounds,{x:area.bounds?.minX,y:area.bounds?.minY})||!inside(world.bounds,{x:area.bounds?.maxX,y:area.bounds?.maxY}))add('AREA_BOUNDS',area.id);
  }
  for(const site of world.sites){
    if(typeof site.id!=='string'||!site.id||sites.has(site.id))add('SITE_ID',site.id??null);else sites.set(site.id,site);
    const area=areas.get(site.areaId);
    if(!area)add('SITE_UNKNOWN_AREA',site.id);else if(!point(site)||!rectangle(area.bounds)||!inside(area.bounds,site))add('SITE_OUTSIDE_AREA',site.id);
    if(site.runtimeEffect!=='none')add('SITE_RUNTIME_EFFECT',site.id);
  }
  for(const road of world.roads){
    if(typeof road.id!=='string'||!road.id||roads.has(road.id))add('ROAD_ID',road.id??null);else roads.set(road.id,road);
    if(!areas.has(road.fromAreaId)||!areas.has(road.toAreaId)||road.fromAreaId===road.toAreaId)add('UNKNOWN_ROAD_AREA',road.id);
    if(!Number.isFinite(road.width)||road.width<300||road.width>600)add('ROAD_WIDTH',road.id);
    if(!Array.isArray(road.points)||road.points.length<2||!road.points.every(point))throw new TypeError('finite road polyline required');
    if(road.points.some(p=>!inside(world.bounds,p)))add('ROAD_OUTSIDE_BOUNDS',road.id);
    if(road.points.slice(1).some((p,i)=>distance(p,road.points[i])===0))add('ZERO_ROAD_SEGMENT',road.id);
    for(const[areaId,endpoint]of[[road.fromAreaId,road.points[0]],[road.toAreaId,road.points.at(-1)]]){const area=areas.get(areaId);if(area&&rectangle(area.bounds)&&!inside(area.bounds,endpoint))add('ROAD_ENDPOINT_OUTSIDE_AREA',road.id);}
  }
  const measuredAreas=[];
  for(const area of world.areas){
    const valid=[];
    if(!Array.isArray(area.entranceIds))throw new TypeError('declared entrance ids required');
    for(const id of area.entranceIds){
      const site=sites.get(id),road=roads.get(site?.roadId);
      if(!site||site.kind!=='entrance'||site.areaId!==area.id||!road){add('UNKNOWN_ENTRANCE',area.id);continue;}
      const endpoint=road.fromAreaId===area.id?road.points[0]:road.toAreaId===area.id?road.points.at(-1):null;
      if(!endpoint||!point(site)||distance(site,endpoint)>1e-7){add('ENTRANCE_ENDPOINT_MISMATCH',id);continue;}
      if(!rectangle(area.bounds)||!inside(area.bounds,site)){add('SITE_OUTSIDE_AREA',id);continue;}
      if(!valid.some(value=>value.roadId===site.roadId))valid.push(site);
    }
    const separated=valid.some((site,i)=>valid.slice(i+1).some(other=>distance(site,other)>=300));
    if(valid.length<2||!separated)add('AREA_ENTRANCE_COUNT',area.id);
    for(const kind of ['area','secret','objective','landmark-view','height-option'])if(!world.sites.some(site=>site.areaId===area.id&&site.kind===kind))add('AREA_STAGING_MISSING',area.id);
    measuredAreas.push({id:area.id,distinctEntrances:valid.length,separateByAtLeast300:separated});
  }
  const navigation=checkGreyboxNavigation({world,queryGround:world.queryGround,start:world.spawn,targets:world.sites.filter(point).map(site=>({id:site.id,kind:site.kind,x:site.x,y:site.y}))});
  issues.push(...navigation.issues);
  const body=createCollisionBody({id:'greybox-inspection-human',kind:'player',radius:world.playerRadius,minZ:0,maxZ:72});
  const sweep=(a,b,radius=world.playerRadius)=>resolveSweptCircleMotion({body:radius===world.playerRadius?body:createCollisionBody({id:'greybox-inspection-clearance',kind:'player',radius,minZ:0,maxZ:72}),start:{...a,z:world.queryGround(a.x,a.y).groundZ},delta:{x:b.x-a.x,y:b.y-a.y},blockers:world.collisionBlockers,bounds:{...world.bounds,visibleBoundaryId:'greybox-world-edge'},stopOnFirstContact:true});
  const clear=result=>result.contacts.length===0&&result.depenetrations.length===0;
  const journey=(a,b)=>{
    if(!point(a)||!point(b))return{actualSweepClear:false,groundContinuous:false};
    const forward=sweep(a,b),backward=sweep(b,a);
    return{actualSweepClear:clear(forward)&&clear(backward)&&distance(forward.position,b)<1e-4&&distance(backward.position,a)<1e-4,
      groundContinuous:world.queryGround(a.x,a.y).walkable&&world.queryGround(b.x,b.y).walkable&&resolveSweptTraversalPath({start:a,end:b,queryGround:world.queryGround}).allowed&&resolveSweptTraversalPath({start:b,end:a,queryGround:world.queryGround}).allowed};
  };
  const playerRadiusClear=clear(sweep(world.spawn,world.spawn)),protectedRadiusClear=clear(sweep(world.spawn,world.spawn,world.protectedSpawnRadius));
  if(!playerRadiusClear||!protectedRadiusClear)add('SPAWN_CLEARANCE');
  const roadJourneys=world.roads.map(road=>{
    let actualSweepClear=true,groundContinuous=true,pathLengthUnits=0;
    for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],b=road.points[i],length=distance(a,b);pathLengthUnits+=length;
      const result=sweep(a,b);if(!clear(result)||distance(result.position,b)>1e-4)actualSweepClear=false;
      // Both directions through the unchanged authored traversal contract;
      // successful centre samples alone cannot hide a one-way return failure.
      if(!world.queryGround(a.x,a.y).walkable||!world.queryGround(b.x,b.y).walkable||!resolveSweptTraversalPath({start:a,end:b,queryGround:world.queryGround}).allowed||!resolveSweptTraversalPath({start:b,end:a,queryGround:world.queryGround}).allowed)groundContinuous=false;
    }
    if(!actualSweepClear)add('ROAD_SWEEP_BLOCKED',road.id);if(!groundContinuous)add('ROAD_GROUND_DISCONTINUITY',road.id);
    const nominalSecondsAt240=pathLengthUnits/240;
    if(nominalSecondsAt240<10||nominalSecondsAt240>25)warnings.push({code:'ROAD_PACING_TARGET',id:road.id,nominalSecondsAt240,basis:'Declared gate-to-gate polyline at nominal240, not a timed current-hero run or shortest player path'});
    return{id:road.id,actualSweepClear,groundContinuous,pathLengthUnits,nominalSecondsAt240};
  });
  const sightlines=world.sites.filter(site=>site.kind==='objective').map(site=>{
    if(!point(site.approach)){add('OBJECTIVE_APPROACH',site.id);return{id:site.id,clear:false};}
    const from={...site.approach,z:world.queryGround(site.approach.x,site.approach.y).groundZ+20},to={x:site.x,y:site.y,z:world.queryGround(site.x,site.y).groundZ+20};
    const result=traceHeightAwareLineOfSight({from,to,blockers:world.collisionBlockers});if(!result.clear)add('STAGED_SIGHTLINE',site.id);
    return{id:site.id,clear:result.clear,blockerId:result.blockerId??null};
  });
  const arenaIds=new Set();
  const measuredArenas=world.arenas.map(arena=>{
    if(typeof arena.id!=='string'||!arena.id||arenaIds.has(arena.id))add('ARENA_ID',arena.id??null);else arenaIds.add(arena.id);
    if(!areas.has(arena.areaId))add('ARENA_AREA',arena.id);
    const validSize=point(arena.center)&&Number.isFinite(arena.width)&&Number.isFinite(arena.depth)&&arena.width>=1800&&arena.width<=2400&&arena.depth>=1800&&arena.depth<=2400;
    if(!validSize)add('ARENA_SIZE',arena.id);
    const court=validSize?{minX:arena.center.x-arena.width/2,minY:arena.center.y-arena.depth/2,maxX:arena.center.x+arena.width/2,maxY:arena.center.y+arena.depth/2}:null;
    const exits=Array.isArray(arena.exits)?arena.exits:[],separate=exits.length>=2&&exits.every(point)&&exits.some((exit,i)=>exits.slice(i+1).some(other=>distance(exit,other)>=600));
    const exitJourneys=exits.map(exit=>{
      const site=sites.get(exit.id),target=navigation.targets.find(target=>target.id===exit.id);
      const boundToCourt=Boolean(court&&point(exit)&&inside(court,exit)&&site?.kind==='arena-exit'&&site.arenaId===arena.id&&site.areaId===arena.areaId&&distance(site,exit)<1e-7);
      const route=boundToCourt?journey(arena.center,exit):{actualSweepClear:false,groundContinuous:false};
      return{id:exit.id??null,boundToCourt,navReachable:Boolean(target?.reachable&&target?.returnable),...route};
    });
    const reachableExits=exits.length>=2&&exitJourneys.every(exit=>exit.boundToCourt&&exit.navReachable&&exit.actualSweepClear&&exit.groundContinuous);
    if(!separate||!reachableExits)add('ARENA_EXITS',arena.id);
    let samples=0,open=0;
    if(validSize){
      for(let y=arena.center.y-arena.depth/2+60;y<arena.center.y+arena.depth/2;y+=120)for(let x=arena.center.x-arena.width/2+60;x<arena.center.x+arena.width/2;x+=120){samples++;if(world.queryGround(x,y).walkable&&clear(sweep({x,y},{x,y})))open++;}
    }
    const fraction=samples?open/samples:0;if(fraction<0.8)add('ARENA_FLOOR',arena.id);
    const usableCover=world.pieces.filter(piece=>piece.visible.areaId===arena.areaId&&['cover-short','cover-tall'].includes(piece.kind)).flatMap(piece=>{
      const box=piece.visible.bounds,blocker=world.collisionBlockers.find(blocker=>blocker.id===piece.blocker?.id);
      if(!court||!rectangle(box)||box.maxX<court.minX-120||box.minX>court.maxX+120||box.maxY<court.minY-120||box.minY>court.maxY+120)return[];
      const height=piece.visible.height,correctHeight=piece.kind==='cover-short'?height>=24&&height<=72:height>=96&&height<=192;
      const corners=[{x:box.minX,y:box.minY},{x:box.maxX,y:box.minY},{x:box.maxX,y:box.maxY},{x:box.minX,y:box.maxY}];
      if(!correctHeight||!blocker?.solid||!blocker.combatCover||blocker.visibleAssetId!==piece.visible.id||blocker.minZ!==0||blocker.maxZ!==height||blocker.shape.type!=='polygon'||blocker.shape.vertices.length!==4||!corners.every(corner=>blocker.shape.vertices.some(vertex=>distance(corner,vertex)<1e-7)))return[];
      const gap=world.playerRadius+8,cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2;
      const candidates=[{x:box.minX-gap,y:cy},{x:box.maxX+gap,y:cy},{x:cx,y:box.minY-gap},{x:cx,y:box.maxY+gap}];
      for(const standing of candidates){if(!inside(court,standing)||!world.queryGround(standing.x,standing.y).walkable||!clear(sweep(standing,standing)))continue;const route=journey(arena.center,standing);if(route.actualSweepClear&&route.groundContinuous)return[{id:piece.id,kind:piece.kind,standing:{...standing},...route}];}
      return[];
    });
    if(!usableCover.some(piece=>piece.kind==='cover-short')||!usableCover.some(piece=>piece.kind==='cover-tall'))add('ARENA_COVER_HEIGHTS',arena.id);
    return{id:arena.id,separateExits:separate,reachableExits,exitJourneys,usableCover,coverBasis:'Actual matching height/blocker in or within120 units of court, clear player stand-off inside court and straight two-way centre approach; not actual enter/peek/fire control proof',floorSamples:samples,openFloorSamples:open,openFloorFraction:fraction,fractionBasis:'120-unit point lattice with actual player-radius collision clearance; not exact geometric area or complete boss avoidance proof'};
  });
  return{schema:'hmh-greybox-world-layout-check-v1',passed:issues.length===0,scope:'Authored geometry/navigation/clearance/staged sightlines; not mission, actual cover/climb controls, boss AI, pacing playtest, verifier/version, streaming/device/performance acceptance',areas:measuredAreas,navigation,spawn:{playerRadiusClear,protectedRadiusClear},roadJourneys,sightlines,arenas:measuredArenas,issues,warnings};
}
