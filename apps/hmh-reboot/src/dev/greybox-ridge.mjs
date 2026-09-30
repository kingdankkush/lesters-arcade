// Local quarry layout only. Existing ground/movement rules remain authoritative.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorRidgeKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const rock=(name,coordinates,height)=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind:'cliff',bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id}));
  };
  // The western and upper cuts frame the quarry road. The two inner fingers
  // leave the inspection junction open, with a nearby rock edge on both sides.
  rock('west-buttress',[[-1900,-400],[-1500,-550],[-1220,-400],[-1220,1600],[-1700,1750],[-1900,1300]],300);
  rock('lower-cut',[[-650,180],[420,180],[550,300],[550,650],[-450,650],[-650,500]],180);
  rock('upper-cut',[[-600,-450],[-450,-600],[550,-600],[550,-200],[-600,-200]],240);
  rock('north-cap',[[-500,-1850],[1100,-1850],[1250,-1400],[500,-1100],[-500,-1100]],420);
  // Leave the fixed diagonal Fortress road below this northeastern rock shelf.
  rock('east-buttress',[[1400,-1850],[1950,-1850],[1950,-1000],[1700,-1000],[1400,-1300]],300);
  // The store faces its side track. Headframe equipment sits against the rock,
  // with its control face toward the shallow maintenance shelf below it.
  add('quarry-store','mass',-1510,-1235,380,270,170);
  add('headframe','mass',0,-1095,180,150,360);
  add('landing-barrier','cover-short',850,1700,240,80,48);
  add('landing-wall','cover-tall',1650,600,120,240,128);
  add('shelf-west-ramp','ramp',-500,-850,400,300,0,{fromZ:0,toZ:24,priority:40});
  add('maintenance-shelf','deck',-75,-850,450,300,24,{visibleStepId:true,priority:41});
  add('shelf-east-ramp','ramp',350,-850,400,300,0,{fromZ:24,toZ:0,priority:40});
  add('climb-intent','climb-marker',0,-700,120,40,24);
  add('drop-intent','drop-marker',150,-850,40,120,24);

  area.landmark='Quarry headframe';
  area.flowLabels=[{label:'Quarry road',...point(-1090,450)}];
  for(const[kind,x,y,label]of[['area',0,0,'Quarry junction'],['landmark-view',950,-500,'Headframe view'],['secret',-1510,-950,'Store track'],['height-option',0,-850,'Maintenance shelf']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(0,-925),label:'Uplink access',approach:point(0,-825),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(950,1050),width:1800,depth:1800,bossId:null,exits:[{id:`${area.id}-court-exit-0`,...point(100,1400)},{id:`${area.id}-court-exit-1`,...point(950,250)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const cityRoad=roads.find(road=>road.id==='city-ridge'&&road.toAreaId===area.id),fortressRoad=roads.find(road=>road.id==='ridge-fortress'&&road.fromAreaId===area.id);
  if(!cityRoad||!fortressRoad)throw new Error('Ridge requires its existing City and Fortress roads');
  const south={...cityRoad.points.at(-1)},east={...fortressRoad.points[0]},southId=`${cityRoad.id}-${area.id}-entrance`,eastId=`${fortressRoad.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('quarry-switchback','main',southId,eastId,[south,point(-950,900),point(-950,-850),point(0,-850),point(900,-850),east]),
    route('lower-service-bypass','optional',southId,eastId,[south,point(950,900),point(950,0),east]),
    route('store-loop','optional',`${area.id}-area`,`${area.id}-height-option`,[point(0,0),point(-950,0),point(-950,-750),point(-1510,-750),point(-1510,-950),point(-950,-950),point(-950,-850),point(0,-850)]),
    route('uplink-approach','main',`${area.id}-height-option`,objective.id,[point(0,-850),point(0,-825),point(0,-925)]),
    route('headframe-view','optional',`${area.id}-area`,`${area.id}-landmark-view`,[point(0,0),point(950,0),point(950,-500)])
  ];
}
