// Local cemetery/forest layout only. Existing ground/movement rules stay authoritative.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorPinesKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const grove=(name,coordinates,height)=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind:'mass',bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id}));
  };
  // Uneven forest edges leave an open service bank to the south and a crypt
  // trail to the northwest. These are solid root/grove volumes, not final trees.
  grove('southwest-grove',[[-1900,200],[-1500,150],[-1300,650],[-1450,1350],[-1800,1500],[-1900,1000]],260);
  grove('northeast-grove',[[1150,-1700],[1750,-1600],[1800,-1100],[1500,-800],[1000,-1000],[950,-1400]],300);
  grove('dead-tree-roots',[[-180,-1450],[0,-1550],[200,-1420],[180,-1190],[-150,-1170],[-220,-1300]],420);
  add('crypt','mass',-1450,-1230,300,280,200);
  add('maintenance-house','mass',1150,600,420,400,180);
  // Two opposed cemetery gates retain public access. The broken north boundary
  // frames the dead tree; the southern service path stays outside this court.
  add('north-west-wall','cover-tall',-500,-750,600,60,128);
  add('north-east-wall','cover-tall',500,-750,600,60,128);
  for(const side of [-1,1]){
    add(`${side<0?'west':'east'}-upper-wall`,'cover-tall',side*800,-535,60,430,128);
    add(`${side<0?'west':'east'}-lower-wall`,'cover-tall',side*800,535,60,430,128);
  }
  add('south-wall','cover-tall',0,750,900,60,128);
  add('low-boundary','cover-short',-280,180,260,70,48);
  add('stone-monument','cover-tall',180,-210,100,220,128);
  add('bank-west-ramp','ramp',625,1050,350,300,0,{fromZ:0,toZ:24,priority:40});
  add('maintenance-bank','deck',1000,1050,400,300,24,{visibleStepId:true,priority:41});
  add('bank-east-ramp','ramp',1375,1050,350,300,0,{fromZ:24,toZ:0,priority:40});
  add('climb-intent','climb-marker',1000,1200,120,40,24);
  add('drop-intent','drop-marker',1200,1050,40,120,24);

  area.landmark='Dead cemetery tree';
  area.flowLabels=[{label:'Service path',...point(-350,1090)}];
  for(const[kind,x,y,label]of[['area',0,0,'Cemetery clearing'],['landmark-view',0,-950,'Dead tree view'],['secret',-1250,-1200,'Crypt trail'],['height-option',1000,1050,'Maintenance bank']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(1150,900),label:'House access',approach:point(1150,1050),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(0,0),width:1800,depth:1800,bossId:null,exits:[{id:`${area.id}-court-exit-0`,...point(-850,0)},{id:`${area.id}-court-exit-1`,...point(850,0)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const riverRoad=roads.find(road=>road.id==='river-pines'&&road.toAreaId===area.id),woodsRoad=roads.find(road=>road.id==='pines-woods'&&road.fromAreaId===area.id);
  if(!riverRoad||!woodsRoad)throw new Error('Pines requires its existing River and Woods roads');
  const west={...riverRoad.points.at(-1)},east={...woodsRoad.points[0]},westId=`${riverRoad.id}-${area.id}-entrance`,eastId=`${woodsRoad.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('cemetery-walk','main',westId,eastId,[west,point(-600,0),point(-600,-500),point(600,-500),point(600,0),east]),
    route('outer-service-path','optional',westId,eastId,[west,point(-1050,0),point(-1050,1050),point(1000,1050),point(1650,1050),point(1650,0),east]),
    route('crypt-loop','optional',westId,`${area.id}-landmark-view`,[west,point(-1100,0),point(-1100,-1200),point(-1250,-1200),point(-1250,-1500),point(-500,-1500),point(-500,-950),point(0,-950)]),
    route('dead-tree-approach','main',`${area.id}-area`,`${area.id}-landmark-view`,[point(0,0),point(0,-500),point(0,-950)]),
    route('maintenance-approach','main',`${area.id}-height-option`,objective.id,[point(1000,1050),point(1150,1050),point(1150,900)])
  ];
}
