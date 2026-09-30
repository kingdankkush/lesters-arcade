// Local navigation authoring only. Missions, cover controls and fights are staged.
import {createGreyboxPiece} from './greybox-kit.mjs';
export function authorMeadowsKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  // Human-scale inner neighbourhood; the full district is still an open prototype.
  add('garden-home','mass',-1220,-1400,420,340,250);
  add('north-home','mass',-560,-1300,360,240,220);
  add('relay-home','mass',610,-1430,560,340,280);
  add('east-home','mass',1500,-1300,400,350,260);
  add('south-home','mass',-1100,1100,380,440,220);
  add('garden-wall','mass',-1550,-740,80,760,180);
  add('garden-fence','cover-short',-1150,-750,70,500,48);
  add('old-oak-placeholder','mass',-390,-660,260,200,280);
  add('relay-equipment','mass',520,-600,90,90,110);
  add('court-low-cover','cover-short',720,280,160,70,48);
  add('court-wall','cover-tall',950,-650,70,260,128);
  add('ramp','ramp',-1175,200,350,300,0,{fromZ:0,toZ:24,priority:40});
  add('deck','deck',-800,200,400,300,24,{visibleStepId:true,priority:41});
  add('climb-intent','climb-marker',-600,200,40,120,24);
  add('drop-intent','drop-marker',-800,350,120,40,24);

  area.landmark='Old oak / relay green';
  area.flowLabels=[['Entry green',0,80],['Garden lane',-1350,-350],['Relay court',720,-430],['Porch',-800,180]].map(([label,x,y])=>({label,...point(x,y)}));
  for(const[kind,x,y,label]of[['area',0,0,'Entry green'],['landmark-view',-390,-930,'Old oak'],['secret',-1400,-700,'Garden loop'],['height-option',-800,200,'Porch']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(700,-960),label:'Relay switch',approach:point(700,-1210),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(600,-450),width:1800,depth:1800,bossId:null,exits:[{id:`${area.id}-court-exit-0`,...point(-220,320)},{id:`${area.id}-court-exit-1`,...point(1350,350)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const cityRoad=roads.find(road=>road.id==='city-meadows'&&road.toAreaId===area.id);
  if(!cityRoad)throw new Error('Meadows requires its existing city road');
  const entranceId=`${cityRoad.id}-${area.id}-entrance`,entrance={...cityRoad.points.at(-1)};
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('city-green','main',entranceId,`${area.id}-area`,[entrance,point(0,0)]),
    route('green-relay','main',`${area.id}-area`,objective.id,[point(0,0),point(0,-420),point(260,-930),point(700,-960)]),
    route('garden-out','optional',entranceId,`${area.id}-secret`,[entrance,point(-1350,0),point(-1350,-700),point(-1400,-700)]),
    route('garden-rejoin','optional',`${area.id}-secret`,`${area.id}-area`,[point(-1400,-700),point(-1400,-1050),point(-800,-1050),point(-80,-930),point(-80,0),point(0,0)]),
    route('porch-approach','optional',entranceId,`${area.id}-height-option`,[entrance,point(-1440,0),point(-1440,200),point(-1300,200),point(-800,200)])
  ];
}
