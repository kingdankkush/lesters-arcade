// Local compound navigation only. No Foreman trigger, gate state or official map change.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorFortressKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const mass=(name,kind,coordinates,height)=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id}));
  };
  // Keep and curtain arms face the working court. The western approach has a
  // broad gatehouse opening; the lower loading track branches before that court.
  mass('keep','mass',[[-450,-1800],[650,-1800],[780,-1650],[780,-1370],[600,-1220],[-450,-1220],[-580,-1370],[-580,-1650]],420);
  mass('ridge-foot','cliff',[[-1950,-1750],[-1450,-1850],[-1300,-1500],[-1600,-1050],[-1950,-1250]],220);
  add('north-gatehouse','mass',-1000,-480,260,280,280);
  add('south-gatehouse','mass',-1000,480,260,280,280);
  add('west-curtain','cover-tall',-1000,-1050,180,700,160);
  add('east-curtain','cover-tall',1100,-1000,180,700,160);
  // Supplies arrive by the outer loading track, away from the keep threshold.
  add('service-store','mass',-1050,1550,460,320,180);
  add('yard-low-barrier','cover-short',-500,600,300,70,48);
  add('yard-tall-wall','cover-tall',700,350,100,220,128);
  add('platform-west-ramp','ramp',800,1100,300,320,0,{fromZ:0,toZ:24,priority:40});
  add('maintenance-platform','deck',1100,1100,300,320,24,{visibleStepId:true,priority:41});
  add('platform-east-ramp','ramp',1400,1100,300,320,0,{fromZ:24,toZ:0,priority:40});
  add('climb-intent','climb-marker',1100,1260,120,40,24);
  add('drop-intent','drop-marker',1250,1100,40,120,24);

  area.landmark='Fortress keep';
  area.flowLabels=[{label:'Loading track',...point(0,1140)}];
  for(const[kind,x,y,label]of[['area',0,0,'Keep court'],['landmark-view',100,-1050,'Keep approach'],['secret',-750,1550,'Store side'],['height-option',1100,1100,'Maintenance platform']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(-775,-480),label:'Gate controls',approach:point(-625,-480),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(100,-250),width:1800,depth:1800,bossId:'51-percent-foreman',exits:[{id:`${area.id}-court-exit-0`,...point(-750,0)},{id:`${area.id}-court-exit-1`,...point(950,0)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const ridgeRoad=roads.find(road=>road.id==='ridge-fortress'&&road.toAreaId===area.id),serviceRoad=roads.find(road=>road.id==='fortress-service'&&road.fromAreaId===area.id);
  if(!ridgeRoad||!serviceRoad)throw new Error('Fortress requires its existing Ridge and Meadows service roads');
  const west={...ridgeRoad.points.at(-1)},east={...serviceRoad.points[0]},westId=`${ridgeRoad.id}-${area.id}-entrance`,eastId=`${serviceRoad.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('gate-court-approach','main',westId,eastId,[west,point(-600,0),point(-600,-350),point(950,-350),point(1700,-350),point(1700,800),east]),
    route('lower-service-loop','optional',westId,eastId,[west,point(-1350,0),point(-1350,1100),point(1100,1100),point(1700,1100),point(1700,800),east]),
    route('storage-return','optional',`${area.id}-area`,`${area.id}-height-option`,[point(0,0),point(0,950),point(-750,950),point(-750,1550),point(300,1550),point(300,1100),point(1100,1100)]),
    route('gate-controls','main',`${area.id}-area`,objective.id,[point(0,0),point(-600,0),point(-600,-480),point(-625,-480),point(-775,-480)]),
    route('keep-view','optional',`${area.id}-area`,`${area.id}-landmark-view`,[point(0,0),point(100,0),point(100,-1050)])
  ];
}
