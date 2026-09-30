// Local navigation authoring only. Closing Bell and Liquidator remain staged.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorCityKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));

  // Public frontages frame the crossing. Behind the northwest block, two real
  // walls narrow the service lane without making it a mandatory boss route.
  add('market-block','mass',-650,-850,700,850,260);
  add('service-warehouse','mass',-1500,-1350,400,800,190);
  add('north-commercial-block','mass',1100,-1050,1500,900,340);
  add('river-housing','mass',-900,1000,950,1100,230);
  add('river-service-shed','mass',-1600,1725,450,300,140);
  // The exchange faces north into a separate southeast civic forecourt. Its
  // broad frontage anchors the bell; the arena centre stays open for later tells.
  add('exchange','mass',1000,1800,1600,300,420);
  add('plaza-wall','cover-tall',250,400,80,240,128);
  add('plaza-bench','cover-short',1550,1300,220,80,48);
  add('gantry-ramp','ramp',1775,500,250,350,0,{axis:'y',fromZ:0,toZ:24,priority:40});
  add('gantry-deck','deck',1775,925,250,500,24,{visibleStepId:true,priority:41});
  add('climb-intent','climb-marker',1900,925,40,120,24);
  add('drop-intent','drop-marker',1775,1175,120,40,24);

  area.landmark='Exchange / civic plaza';
  // Do not repeat site labels at their marker/actor position.
  area.flowLabels=[{label:'High Street',...point(-600,180)}];
  for(const[kind,x,y,label]of[['area',0,0,'Civic junction'],['landmark-view',850,550,'Exchange view'],['secret',-1150,-1050,'Maintenance'],['height-option',1775,1000,'Bell gantry']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(1000,1550),label:'Closing Bell',approach:point(1000,1200),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(1000,1000),width:1800,depth:1800,bossId:'liquidator',exits:[{id:`${area.id}-court-exit-0`,...point(1450,250)},{id:`${area.id}-court-exit-1`,...point(250,800)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const entrance=roadId=>{
    const road=roads.find(road=>road.id===roadId&&(road.fromAreaId===area.id||road.toAreaId===area.id));
    if(!road)throw new Error(`City requires its existing ${roadId} road`);
    return{id:`${road.id}-${area.id}-entrance`,...(road.fromAreaId===area.id?road.points[0]:road.points.at(-1))};
  };
  const west=entrance('coast-city'),east=entrance('city-meadows'),north=entrance('city-ridge'),south=entrance('city-river');
  const xy=({x,y})=>({x,y});
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('high-street','main',west.id,east.id,[xy(west),point(0,0),xy(east)]),
    route('river-street','main',north.id,south.id,[xy(north),point(0,0),xy(south)]),
    route('service-loop','optional',west.id,north.id,[xy(west),point(-1150,0),point(-1150,-1050),point(-1150,-1500),point(0,-1500),xy(north)]),
    route('market-plaza-entry','main',east.id,arena.exits[0].id,[xy(east),point(1450,0),point(1450,250)]),
    route('river-plaza-entry','main',south.id,arena.exits[1].id,[xy(south),point(250,800)]),
    route('exchange-approach','main',arena.exits[0].id,objective.id,[point(1450,250),point(1000,800),point(1000,1200),point(1000,1550)]),
    route('gantry-approach','optional',arena.exits[0].id,`${area.id}-height-option`,[point(1450,250),point(1775,250),point(1775,325),point(1775,1000)])
  ];
}
