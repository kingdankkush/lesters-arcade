// Explicitly separate design data; no import from the active map/main/verifier.
import { createGreyboxPiece } from './greybox-kit.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../elevation.mjs';
import { freezeDeep } from '../value-guards.mjs';
import { createClosedMassPolygons } from './greybox-closed-masses.mjs';
const bounds = { minX: 0, minY: 0, maxX: 20000, maxY: 14000 };
const areaSpecs = [
  ['mweb-meadows', 'MWEB Meadows', 12500, 6700, 1, 'relay-neighbourhood'],
  ['litecoin-city', 'Litecoin City', 7500, 6700, 2, 'exchange-skyline'],
  ['halving-farms', 'Halving Farms', 17500, 6700, 2, 'windmill'],
  ['silver-coast', 'Silver Coast', 2500, 6700, 2, 'lighthouse'],
  ['scrypt-bayou', 'Scrypt Bayou', 2500, 11600, 3, 'lock-house'],
  ['hashwood-river', 'Hashwood River', 7500, 11600, 3, 'waterfall'],
  ['hollow-pines', 'Hollow Pines', 12500, 11600, 4, 'cemetery-tree'],
  ['ledger-ridge', 'Ledger Ridge', 7500, 2500, 4, 'quarry-headframe'],
  ['fork-fortress', 'Fork Fortress', 12500, 2500, 5, 'fortress-keep'],
  ['rugpull-woods', 'Rugpull Woods', 17500, 11600, 3, 'watchtower'],
];
const roadSpecs = [
  ['coast-city', 'silver-coast', 'litecoin-city', 'paved', 600, [[3400,6700],[6600,6700]]],
  ['city-meadows', 'litecoin-city', 'mweb-meadows', 'paved', 600, [[8400,6700],[11600,6700]]],
  ['meadows-farms', 'mweb-meadows', 'halving-farms', 'gravel', 480, [[13400,6700],[16600,6700]]],
  ['coast-bayou', 'silver-coast', 'scrypt-bayou', 'path', 420, [[2500,7600],[2500,10700]]],
  ['city-river', 'litecoin-city', 'hashwood-river', 'gravel', 480, [[7500,7600],[7500,10700]]],
  ['meadows-woods', 'mweb-meadows', 'rugpull-woods', 'path', 420, [[14000,7650],[14700,7650],[15000,9000],[15300,10650],[16600,10650]]],
  ['farms-woods', 'halving-farms', 'rugpull-woods', 'path', 420, [[17500,7600],[17500,10700]]],
  ['bayou-river', 'scrypt-bayou', 'hashwood-river', 'path', 360, [[3400,11600],[6600,11600]]],
  ['river-pines', 'hashwood-river', 'hollow-pines', 'path', 360, [[8400,11600],[11600,11600]]],
  ['pines-woods', 'hollow-pines', 'rugpull-woods', 'path', 360, [[13400,11600],[16600,11600]]],
  ['river-woods', 'hashwood-river', 'rugpull-woods', 'path', 360, [[9100,10650],[9700,10650],[10000,9200],[15000,9200],[15300,10650],[15900,10650]]],
  ['city-ridge', 'litecoin-city', 'ledger-ridge', 'gravel', 420, [[7500,5800],[7500,3400]]],
  ['ridge-fortress', 'ledger-ridge', 'fork-fortress', 'path', 360, [[8400,2500],[9600,1700],[10400,1700],[11600,2500]]],
  ['fortress-service', 'fork-fortress', 'mweb-meadows', 'gravel', 420, [[14000,3300],[15000,3300],[15000,4600],[14600,5200],[14600,5750],[14000,5750]]],
];
const xy = ([x,y]) => ({ x, y });
function localRect(area, x, y, width, depth) { return { minX: area.center.x+x-width/2, minY: area.center.y+y-depth/2, maxX: area.center.x+x+width/2, maxY: area.center.y+y+depth/2 }; }
function roadRect(a,b,width) {
  const dx=b.x-a.x, dy=b.y-a.y, distance=Math.hypot(dx,dy), nx=-dy/distance*width/2, ny=dx/distance*width/2;
  return { type:'polygon', vertices:[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}] };
}
export function createGreyboxWorld() {
  const areas=areaSpecs.map(([id,name,x,y,tier,landmark]) => ({ id,name,center:{x,y},tier,landmark,bounds:{minX:x-2000,minY:y-2000,maxX:x+2000,maxY:y+2000},entranceIds:[] }));
  const byId=new Map(areas.map(area=>[area.id,area]));
  const roads=roadSpecs.map(([id,fromAreaId,toAreaId,kind,width,points])=>({id,fromAreaId,toAreaId,kind,width,points:points.map(xy)}));
  const pieces=[],surfaces=[],sites=[],arenas=[];
  for (const area of areas) {
    surfaces.push(createElevationSurface({id:`${area.id}-floor`,area:{type:'rect',...area.bounds},visibleTerrainId:`greybox-${area.id}-floor`,priority:10,walkable:true,deepWater:false}));
    // Four corner masses retain a broad readable court. Their different later
    // area kits/art must follow the brief; these are intentionally bare volumes.
    for (const [i,[x,y]] of [[-1550,-1550],[1550,-1550],[-1550,1550],[1550,1550]].entries()) pieces.push(createGreyboxPiece({id:`${area.id}-mass-${i}`,kind:area.tier>=4?'cliff':'mass',bounds:localRect(area,x,y,700,700),height:area.tier>=4?180:260,areaId:area.id}));
    pieces.push(createGreyboxPiece({id:`${area.id}-landmark-mass`,kind:'mass',bounds:localRect(area,-600,-900,240,220),height:360,areaId:area.id}));
    for (const [i,[x,y]] of [[-950,-650],[950,-650],[-950,850],[950,850]].entries()) pieces.push(createGreyboxPiece({id:`${area.id}-cover-${i}`,kind:i%2?'cover-tall':'cover-short',bounds:localRect(area,x,y,150,80),height:i%2?128:48,areaId:area.id}));
    pieces.push(createGreyboxPiece({id:`${area.id}-ramp`,kind:'ramp',bounds:localRect(area,-1175,200,350,300),height:0,fromZ:0,toZ:24,priority:40,areaId:area.id}));
    pieces.push(createGreyboxPiece({id:`${area.id}-deck`,kind:'deck',bounds:localRect(area,-800,200,400,300),height:24,visibleStepId:true,priority:41,areaId:area.id}));
    pieces.push(createGreyboxPiece({id:`${area.id}-climb-intent`,kind:'climb-marker',bounds:localRect(area,-600,200,40,120),height:24,areaId:area.id}));
    pieces.push(createGreyboxPiece({id:`${area.id}-drop-intent`,kind:'drop-marker',bounds:localRect(area,-800,350,120,40),height:24,areaId:area.id}));
    for (const [kind,x,y] of [['area',0,0],['landmark-view',-600,-600],['secret',1200,650],['height-option',-800,200]]) sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,x:area.center.x+x,y:area.center.y+y,runtimeEffect:'none'});
    const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,x:area.center.x+600,y:area.center.y-650,approach:{x:area.center.x+600,y:area.center.y-1050},runtimeEffect:'none'};
    sites.push(objective);
    const boss={ 'litecoin-city':'liquidator','scrypt-bayou':'lockkeeper','hashwood-river':'rug-pull-baron','fork-fortress':'51-percent-foreman' }[area.id]??null;
    const arena={id:`${area.id}-court`,areaId:area.id,center:{x:area.center.x,y:area.center.y+200},width:2000,depth:2000,bossId:boss,exits:[{id:`${area.id}-court-exit-0`,x:area.center.x-950,y:area.center.y+700},{id:`${area.id}-court-exit-1`,x:area.center.x+950,y:area.center.y+700}],runtimeEffect:'none'};
    arenas.push(arena);
    arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  }
  for (const road of roads) {
    for (const [areaId,point] of [[road.fromAreaId,road.points[0]],[road.toAreaId,road.points.at(-1)]]) {
      const id=`${road.id}-${areaId}-entrance`; byId.get(areaId).entranceIds.push(id); sites.push({id,kind:'entrance',areaId,roadId:road.id,...point,runtimeEffect:'none'});
    }
    for (let i=1;i<road.points.length;i++) surfaces.push(createElevationSurface({id:`${road.id}-segment-${i}`,area:roadRect(road.points[i-1],road.points[i],road.width),visibleTerrainId:`greybox-${road.id}-segment-${i}`,priority:15,walkable:true,deepWater:false}));
    // Square joins avoid cracks at bent segment unions, using the same ground query.
    road.points.slice(1,-1).forEach((point,i)=>surfaces.push(createElevationSurface({id:`${road.id}-join-${i}`,area:{type:'rect',minX:point.x-road.width/2,minY:point.y-road.width/2,maxX:point.x+road.width/2,maxY:point.y+road.width/2},visibleTerrainId:`greybox-${road.id}-join-${i}`,priority:15,walkable:true,deepWater:false})));
  }
  const baseSurface=createElevationSurface({id:'greybox-closed-mass',area:{type:'rect',...bounds},visibleTerrainId:'greybox-closed-mass',walkable:false,deepWater:false});
  const footprints=surfaces.map(surface=>surface.area.type==='polygon'?surface.area.vertices:[{x:surface.area.minX,y:surface.area.minY},{x:surface.area.maxX,y:surface.area.minY},{x:surface.area.maxX,y:surface.area.maxY},{x:surface.area.minX,y:surface.area.maxY}]);
  for(const [i,vertices]of createClosedMassPolygons({bounds,floors:footprints}).entries())pieces.push(createGreyboxPiece({id:`closed-mass-${i}`,kind:'cliff',bounds:{minX:Math.min(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxX:Math.max(...vertices.map(p=>p.x)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height:180}));
  // Actual visible guard solids cover rounded nav centres beyond exact bounds.
  // They do not modify the legacy nav perimeter or silently make land water.
  const guards=[{minX:-120,minY:-120,maxX:0,maxY:14120},{minX:20000,minY:-120,maxX:20120,maxY:14120},{minX:0,minY:-120,maxX:20000,maxY:0},{minX:0,minY:14000,maxX:20000,maxY:14120}];
  guards.forEach((bounds,i)=>pieces.push(createGreyboxPiece({id:`world-guard-${i}`,kind:'cliff',bounds,height:180})));
  const allSurfaces=[...surfaces,...pieces.flatMap(piece=>piece.surface?[piece.surface]:[])];
  const world=freezeDeep({schema:'hmh-authored-greybox-v1',mapId:'visual-overhaul-greybox-v1',rankedEligible:false,officialRun:false,rulesVersion:null,bounds:{...bounds},areas,roads,pieces,sites,arenas,spawn:{x:12500,y:6700},playerRadius:24,protectedSpawnRadius:560,collisionBlockers:pieces.flatMap(piece=>piece.blocker?[piece.blocker]:[]),baseSurface,surfaces:allSurfaces});
  return Object.freeze({...world,queryGround:createAuthoredGroundQuery({baseSurface,surfaces:allSurfaces})});
}
