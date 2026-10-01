// Local woodland navigation only. No camp-clear state, patrol AI or official map change.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorWoodsKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const mass=(name,coordinates,height)=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind:'cliff',bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id}));
  };
  // Natural edges shape three different spaces without filling every corner.
  // The western trail is calm; occupied supplies are east of that through route.
  mass('northwest-root-bank',[[-1850,-1750],[-1150,-1830],[-1000,-1550],[-1350,-1300],[-1850,-1300]],180);
  mass('western-woodland-edge',[[-1900,500],[-1580,520],[-1420,800],[-1460,1750],[-1900,1820]],160);
  mass('southeast-bank',[[1050,1450],[1400,1100],[1820,1220],[1920,1810],[1350,1850],[1050,1670]],190);
  add('supply-tent','mass',950,-450,360,260,180);
  add('east-palisade','cover-tall',1550,100,90,1000,144);
  add('south-windbreak','cover-tall',750,1000,550,90,128);
  add('supply-stack','cover-short',400,722.5,240,45,48);
  // Lookout occupies the northern bank, with a continuous accessible loop.
  add('lookout-post','mass',650,-1690,260,300,360);
  add('lookout-west-ramp','ramp',250,-1250,400,320,0,{fromZ:0,toZ:24,priority:40});
  add('lookout-bank','deck',650,-1250,400,320,24,{visibleStepId:true,priority:41});
  add('lookout-east-ramp','ramp',1050,-1250,400,320,0,{fromZ:24,toZ:0,priority:40});
  // The abandoned stores face the returning southern track, away from traffic.
  add('abandoned-store','mass',-950,1580,360,240,150);
  add('abandoned-lean-to','mass',-450,1600,200,220,110);
  add('climb-intent','climb-marker',650,-1090,120,40,24);
  add('drop-intent','drop-marker',850,-1250,40,120,24);

  area.landmark='Woodland lookout';
  area.flowLabels=[{label:'Quiet trail',...point(-650,500)}];
  for(const[kind,x,y,label]of[['area',0,0,'Trail junction'],['landmark-view',650,-1450,'Lookout front'],['secret',-950,1350,'Old stores'],['height-option',650,-1250,'Lookout bank']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(950,-220),label:'Supply frontage',approach:point(700,-220),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(650,50),width:1800,depth:1800,bossId:null,exits:[{id:`${area.id}-court-exit-0`,...point(-150,50)},{id:`${area.id}-court-exit-1`,...point(1450,50)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const entrance=roadId=>{const road=roads.find(road=>road.id===roadId&&road.toAreaId===area.id);if(!road)throw new Error(`Woods requires its existing ${roadId} road`);return{id:`${road.id}-${area.id}-entrance`,point:{...road.points.at(-1)}};};
  const farms=entrance('farms-woods'),meadows=entrance('meadows-woods'),river=entrance('river-woods'),pines=entrance('pines-woods');
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('quiet-through','main',farms.id,pines.id,[farms.point,point(0,-1050),point(-650,-1050),point(-650,0),pines.point]),
    route('camp-approach','optional',farms.id,pines.id,[farms.point,point(400,-900),point(400,50),point(-900,50),pines.point]),
    route('river-meadows-link','main',river.id,meadows.id,[river.point,meadows.point]),
    route('meadows-junction','main',meadows.id,pines.id,[meadows.point,point(-650,-950),point(-650,0),pines.point]),
    route('lookout-circuit','optional',farms.id,meadows.id,[farms.point,point(0,-1250),point(650,-1250),point(1300,-1250),point(1300,-1000),point(0,-1000),point(-900,-1000),meadows.point]),
    route('supply-return','optional',`${area.id}-area`,pines.id,[point(0,0),point(0,1100),point(-550,1100),point(-550,1350),point(-950,1350),point(-1250,1350),point(-1250,950),point(-1250,0),pines.point]),
    route('supplies-frontage','main',`${area.id}-area`,objective.id,[point(0,0),point(600,0),point(600,-220),point(700,-220),point(950,-220)])
  ];
}
