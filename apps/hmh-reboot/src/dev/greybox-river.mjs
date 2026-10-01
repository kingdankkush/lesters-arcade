// Local bank/crossing inspection only. No waterfall physics or Baron activation.
import {createGreyboxPiece} from './greybox-kit.mjs';

export function authorRiverKit(area,{pieces,sites,arenas},roads){
  const point=(x,y)=>({x:area.center.x+x,y:area.center.y+y});
  const bounds=(x,y,width,depth)=>({minX:area.center.x+x-width/2,minY:area.center.y+y-depth/2,maxX:area.center.x+x+width/2,maxY:area.center.y+y+depth/2});
  const add=(name,kind,x,y,width,depth,height,extra={})=>pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:bounds(x,y,width,depth),height,areaId:area.id,...extra}));
  const polygon=(name,kind,coordinates,height,extra={})=>{
    const vertices=coordinates.map(([x,y])=>point(x,y));
    pieces.push(createGreyboxPiece({id:`${area.id}-${name}`,kind,bounds:{minX:Math.min(...vertices.map(p=>p.x)),maxX:Math.max(...vertices.map(p=>p.x)),minY:Math.min(...vertices.map(p=>p.y)),maxY:Math.max(...vertices.map(p=>p.y))},vertices,height,areaId:area.id,...extra}));
  };
  // A broad transverse channel narrows at two crossings. The lower bank stays
  // quiet and dry; the boss clearing is an optional southern destination.
  polygon('channel','water',[[-2000,-720],[-1400,-690],[-1000,-620],[1700,-620],[2000,-720],[2000,-360],[1700,-280],[-1000,-280],[-1400,-340],[-2000,-390]],0,{priority:30});
  polygon('waterfall-shelf','cliff',[[-1900,-1300],[-1500,-1250],[-1380,-950],[-1630,-820],[-1900,-930]],190);
  for(const[name,x]of [['city',0],['woods',1400]]){
    add(`${name}-north-ramp`,'ramp',x,-770,420,260,0,{axis:'y',fromZ:0,toZ:24,priority:40});
    add(`${name}-bridge`,'bridge',x,-450,420,380,24,{visibleStepId:true,priority:41});
    add(`${name}-south-ramp`,'ramp',x,-130,420,260,0,{axis:'y',fromZ:24,toZ:0,priority:40});
  }
  add('capstan-house','mass',480,-210,180,180,180);
  add('marquee-backing','mass',-1000,1650,350,180,240);
  add('marquee-west-post','mass',-550,600,70,90,160);
  add('marquee-east-post','mass',-50,600,70,90,160);
  add('court-low-stack','cover-short',-1600,1312.5,160,45,48);
  add('court-tall-screen','cover-tall',-300,1400,80,160,128);
  add('climb-intent','climb-marker',210,-450,40,120,24);
  add('drop-intent','drop-marker',1400,-260,120,40,24);

  area.landmark='Waterfall shelf';
  area.flowLabels=[{label:'City crossing',...point(0,-450)},{label:'Woods crossing',...point(1400,-450)},{label:'Quiet bank',...point(600,150)}];
  for(const[kind,x,y,label]of [['area',0,0,'Lower river bank'],['landmark-view',-1300,-900,'Waterfall shelf'],['secret',-1700,-1450,'Shelf path'],['height-option',0,-450,'City bridge']])sites.push({id:`${area.id}-${kind}`,kind,areaId:area.id,...point(x,y),label,runtimeEffect:'none'});
  const objective={id:`${area.id}-objective`,kind:'objective',areaId:area.id,...point(480,-30),label:'River capstan',approach:point(780,-30),runtimeEffect:'none'};
  sites.push(objective);
  const arena={id:`${area.id}-court`,areaId:area.id,center:point(-900,1050),width:1800,depth:1800,bossId:'rug-pull-baron',exits:[{id:`${area.id}-court-exit-0`,...point(-900,250)},{id:`${area.id}-court-exit-1`,...point(-100,1050)}],runtimeEffect:'none'};
  arenas.push(arena);arena.exits.forEach(exit=>sites.push({...exit,kind:'arena-exit',areaId:area.id,arenaId:arena.id,runtimeEffect:'none'}));
  const city=roads.find(road=>road.id==='city-river'&&road.toAreaId===area.id),bayou=roads.find(road=>road.id==='bayou-river'&&road.toAreaId===area.id),pines=roads.find(road=>road.id==='river-pines'&&road.fromAreaId===area.id),woods=roads.find(road=>road.id==='river-woods'&&road.fromAreaId===area.id);
  if(!city||!bayou||!pines||!woods)throw new Error('River requires its four existing neighbour roads');
  const north={...city.points.at(-1)},west={...bayou.points.at(-1)},east={...pines.points[0]},northeast={...woods.points[0]};
  const entrance=road=>`${road.id}-${area.id}-entrance`;
  const route=(name,kind,fromSiteId,toSiteId,points)=>({id:`${area.id}-${name}`,kind,fromSiteId,toSiteId,points,runtimeEffect:'none'});
  area.inspectionRoutes=[
    route('city-bank-crossing','main',entrance(city),`${area.id}-area`,[north,point(0,-450),point(0,0)]),
    route('quiet-bank-trail','main',entrance(bayou),entrance(pines),[west,point(0,0),east]),
    route('woods-bank-crossing','main',entrance(woods),entrance(pines),[northeast,point(1400,-950),point(1400,-450),point(1400,0),east]),
    route('north-bank-return','optional',entrance(city),entrance(woods),[north,point(0,-1100),point(1400,-1100),northeast]),
    route('marquee-clearing','optional',`${area.id}-area`,entrance(bayou),[point(0,0),point(-300,0),point(-300,1050),point(-900,1050),point(-1500,1050),point(-1500,0),west]),
    route('waterfall-nook','optional',entrance(city),`${area.id}-landmark-view`,[north,point(-900,-1100),point(-1100,-1500),point(-1700,-1450),point(-1900,-1550),point(-1900,-1750),point(-900,-1750),point(-900,-1100),point(-1300,-900)]),
    route('river-equipment','main',`${area.id}-area`,objective.id,[point(0,0),point(780,0),point(780,-30),point(480,-30)])
  ];
}
