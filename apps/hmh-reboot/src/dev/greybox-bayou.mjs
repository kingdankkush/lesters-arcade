// Local channel navigation only. No lock state, Lockkeeper trigger or official map change.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorBayouKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const polygon=(name,kind,coordinates,height,extra={})=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id,...extra}));
  };
  // Engineered narrow crossing section opens into the southern marsh. Water is
  // blocked ground, not a fabricated solid wall; dry crossings explicitly win.
  polygon('channel','water',[[200,-2000],[500,-2000],[520,-700],[520,900],[700,1700],[700,2000],[350,2000],[350,1700],[200,950]],0,{priority:30});
  polygon('northwest-root-bank','cliff',[[-1900,-1850],[-1400,-1800],[-1300,-1480],[-1600,-1260],[-1900,-1400]],170);
  polygon('southwest-root-foot','cliff',[[-1920,1660],[-1760,1600],[-1650,1770],[-1770,1920],[-1920,1880]],140);
  // The working apron faces the lock bridge; the quiet court is on dry west bank.
  add('control-house','mass',-350,300,340,260,220);
  add('wheel-tower','mass',-50,250,150,220,300);
  add('court-low-stack','cover-short',-1300,1000,260,80,48);
  add('court-tall-screen','cover-tall',-1550,50,100,260,128);
  for(const[name,y]of [['lock',650],['north',-650]]){
    add(`${name}-west-ramp`,'ramp',40,y,280,360,0,{fromZ:0,toZ:24,priority:40});
    add(`${name}-bridge`,'bridge',360,y,360,360,24,{visibleStepId:true,priority:41});
    add(`${name}-east-ramp`,'ramp',680,y,280,360,0,{fromZ:24,toZ:0,priority:40});
  }
  add('stilt-store','mass',1300,1450,320,280,180);
  add('climb-intent','climb-marker',360,830,120,40,24);
  add('drop-intent','drop-marker',540,650,40,120,24);

  area.landmark='Lock wheel tower';
  area.flowLabels=[{label:'North crossing',...point(360,-650)}];
  for(const[kind,x,y,label]of [['area',0,0,'West lock bank'],['landmark-view',-50,450,'Wheel tower'],['secret',1050,1450,'Stilt store'],['height-option',360,650,'Lock bridge']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(-350,520),label:'Lock controls',approach:point(-650,520),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(-950,650),width:1800,depth:1800,bossId:'lockkeeper',exits:[{id:`${area.id}-court-exit-0`,...point(-950,-150)},{id:`${area.id}-court-exit-1`,...point(-100,650)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const coast=roads.find(road=>road.id==='coast-bayou'&&road.toAreaId===area.id),river=roads.find(road=>road.id==='bayou-river'&&road.fromAreaId===area.id);
  if(!coast||!river)throw new Error('Bayou requires its existing Coast and River roads');
  const north={...coast.points.at(-1)},east={...river.points[0]},northId=`${coast.id}-${area.id}-entrance`,eastId=`${river.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('lock-court-crossing','main',northId,eastId,[north,point(-650,-900),point(-650,650),point(360,650),point(900,650),east]),
    route('north-crossing','optional',northId,eastId,[north,point(0,-650),point(360,-650),point(900,-650),east]),
    route('stilt-store-return','optional',eastId,`${area.id}-height-option`,[east,point(1200,0),point(1200,1000),point(1050,1000),point(1050,1450),point(1000,1750),point(1650,1750),point(1650,650),point(900,650),point(360,650)]),
    route('lock-controls','main',`${area.id}-area`,objective.id,[point(0,0),point(-650,0),point(-650,520),point(-350,520)]),
    route('wheel-view','optional',objective.id,`${area.id}-landmark-view`,[point(-350,520),point(-50,520),point(-50,450)])
  ];
}
