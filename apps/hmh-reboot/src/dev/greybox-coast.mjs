// Local dry-ground navigation authoring only; no water or traversal rules change.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorCoastKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const polygon=(name,kind,coordinates,height)=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id}));
  };
  // Two oblique rock masses leave a dry shelf between the coast and the road.
  // These solids are rock faces, not simulated deep water or invisible beaches.
  polygon('headland-cliff','cliff',[[-1900,-1900],[-1200,-1900],[-850,-1300],[-1400,-700],[-1900,-500]],220);
  polygon('shore-cliff','cliff',[[-1900,-100],[-1500,-300],[-1200,400],[-1450,1300],[-1900,1700]],160);
  polygon('lighthouse','mass',[[-750,-1805],[-720,-1835],[-400,-1835],[-370,-1805],[-370,-1430],[-400,-1400],[-720,-1400],[-750,-1430]],440);
  // A roof-free wall shell makes the secret physically interior. South entry
  // faces the road; a separate west door returns toward the coastal shelf.
  add('mansion-north-wall','mass',1100,-1400,1280,80,280);
  add('mansion-east-wall','mass',1700,-850,80,1180,280);
  add('mansion-south-west-wall','mass',740,-300,480,80,280);
  add('mansion-south-east-wall','mass',1480,-300,440,80,280);
  add('mansion-west-north-wall','mass',500,-1185,80,430,280);
  add('mansion-west-south-wall','mass',500,-515,80,430,280);
  add('utility-house','mass',950,600,400,300,190);
  add('terrace-wall','cover-tall',-500,800,120,300,128);
  add('terrace-bench','cover-short',900,905,180,160,48);
  add('overlook-ramp','ramp',-675,-450,350,300,0,{fromZ:24,toZ:0,priority:40});
  add('overlook-deck','deck',-1050,-450,400,300,24,{visibleStepId:true,priority:41});
  add('climb-intent','climb-marker',-1250,-450,40,120,24);
  add('drop-intent','drop-marker',-1050,-300,120,40,24);

  area.landmark='Lighthouse / dry headland';
  area.flowLabels=[{label:'Cliff road',...point(600,260)}];
  for(const[kind,x,y,label]of[['area',250,200,'Coastal terrace'],['landmark-view',-550,-1200,'Lighthouse view'],['secret',1100,-850,'Mansion interior'],['height-option',-1050,-450,'Dry overlook']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(650,600),label:'Utility access',approach:point(400,600),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(250,200),width:1800,depth:1800,bossId:null,exits:[{id:`${area.id}-court-exit-0`,...point(-400,150)},{id:`${area.id}-court-exit-1`,...point(700,950)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const cityRoad=roads.find(road=>road.id==='coast-city'&&road.fromAreaId===area.id),bayouRoad=roads.find(road=>road.id==='coast-bayou'&&road.fromAreaId===area.id);
  if(!cityRoad||!bayouRoad)throw new Error('Coast requires its existing City and Bayou roads');
  const east={...cityRoad.points[0]},south={...bayouRoad.points[0]},eastId=`${cityRoad.id}-${area.id}-entrance`,southId=`${bayouRoad.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('landward-road','main',eastId,southId,[east,point(400,100),point(400,650),south]),
    route('shoreline-detour','optional',eastId,southId,[east,point(200,0),point(-400,0),point(-900,300),point(-950,900),point(-450,1300),south]),
    route('mansion-service-loop','optional',eastId,southId,[east,point(1100,-100),point(1100,-850),point(380,-850),point(380,100),point(400,650),south]),
    route('utility-approach','main',`${area.id}-area`,objective.id,[point(250,200),point(400,600),point(650,600)]),
    route('headland-view','optional',`${area.id}-area`,`${area.id}-landmark-view`,[point(250,200),point(-300,200),point(-300,-900),point(-550,-1200)]),
    route('dry-overlook','optional',`${area.id}-area`,`${area.id}-height-option`,[point(250,200),point(-300,200),point(-300,-450),point(-500,-450),point(-1050,-450)])
  ];
}
