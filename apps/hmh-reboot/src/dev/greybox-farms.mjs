// Local navigation authoring only. Barn objectives and combat remain staged.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorFarmsKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));

  // The barn faces the open working yard; the southern track remains independent
  // of the staged door. Long field edges are solid, never tiny crop collision.
  add('barn','mass',350,-1300,1100,600,300);
  add('windmill-base','mass',-1400,-1350,220,220,400);
  add('silo','mass',1350,-1300,220,220,330);
  add('west-storage','mass',-1450,1450,400,300,210);
  add('east-storage','mass',1450,1450,450,400,220);
  add('north-hedge','mass',-800,-1800,700,100,110);
  add('east-field-edge','mass',1750,200,100,1600,110);
  add('west-field-row','mass',-700,950,500,80,72);
  add('east-field-row','mass',950,950,500,80,72);
  add('yard-timber','cover-short',-650,300,180,70,48);
  add('yard-wall','cover-tall',1000,350,80,260,128);
  add('loading-ramp','ramp',-875,-550,350,300,0,{fromZ:0,toZ:24,priority:40});
  add('loading-deck','deck',-500,-550,400,300,24,{visibleStepId:true,priority:41});
  add('climb-intent','climb-marker',-300,-550,40,120,24);
  add('drop-intent','drop-marker',-500,-400,120,40,24);

  area.landmark='Windmill / barn yard';
  area.flowLabels=[['Working yard',200,80],['Field track',-300,1320],['Loading platform',-500,-540]].map(([label,x,y])=>({label,...point(x,y)}));
  for(const[kind,x,y,label]of[['area',200,100,'Working yard'],['landmark-view',-1400,-1080,'Windmill'],['secret',-300,1350,'Storage track'],['height-option',-500,-550,'Loading platform']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(350,-900),label:'Barn door',approach:point(350,-600),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(200,100),width:2000,depth:1800,bossId:null,exits:[{id:`${area.id}-court-exit-0`,...point(-650,700)},{id:`${area.id}-court-exit-1`,...point(1050,700)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const westRoad=roads.find(road=>road.id==='meadows-farms'&&road.toAreaId===area.id);
  const southRoad=roads.find(road=>road.id==='farms-woods'&&road.fromAreaId===area.id);
  if(!westRoad||!southRoad)throw new Error('Farms requires its existing Meadows and Woods roads');
  const west={...westRoad.points.at(-1)},south={...southRoad.points[0]};
  const westId=`${westRoad.id}-${area.id}-entrance`,southId=`${southRoad.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('west-yard','main',westId,`${area.id}-area`,[west,point(-300,0),point(200,100)]),
    route('yard-barn','main',`${area.id}-area`,objective.id,[point(200,100),point(350,-450),point(350,-900)]),
    route('yard-south','main',`${area.id}-area`,southId,[point(200,100),point(300,600),south]),
    route('field-bypass','optional',westId,southId,[west,point(-1250,0),point(-1250,1050),point(-300,1350),point(450,1350),point(450,1100),south]),
    route('loading-approach','optional',westId,`${area.id}-height-option`,[west,point(-1250,0),point(-1250,-550),point(-1050,-550),point(-500,-550)])
  ];
}
