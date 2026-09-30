import assert from 'node:assert/strict';
import test from 'node:test';
import {createAuthoredGroundQuery,createElevationSurface} from '../apps/hmh-reboot/src/elevation.mjs';
const projection=await import('../apps/hmh-reboot/src/dev/greybox-ground-presentation.mjs').catch(()=>({}));
const paint=surfaces=>{assert.equal(typeof projection.createGreyboxGroundPaint,'function','local ground painting needs the tested priority and shoreline projection');return projection.createGreyboxGroundPaint(surfaces);};
const rect=(minX,minY,maxX,maxY)=>({type:'rect',minX,minY,maxX,maxY});
const surface=(id,kind,area,priority,extra={})=>createElevationSurface({id,kind,area,priority,visibleTerrainId:id,...extra});
const contains=(vertices,x,y)=>{let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){const a=vertices[i],b=vertices[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;};
const visibleAt=(commands,x,y)=>commands.filter(command=>contains(command.vertices,x,y)).at(-1);
function layers(){return[
  surface('z-bridge','bridge',rect(400,340,600,660),41,{groundZ:24}),
  surface('water','water',rect(400,0,600,1000),30),
  surface('a-bridge','bridge',rect(450,340,600,660),41,{groundZ:24}),
  surface('dry','ground',rect(0,0,1000,1000),10),
];}

test('paint overlap agrees with actual ground priority and equal-priority id ties in either input order',()=>{
  for(const source of [layers(),layers().reverse()]){
    const before=JSON.stringify(source),commands=paint(source),query=createAuthoredGroundQuery({baseSurface:source.find(value=>value.id==='dry'),surfaces:source});
    for(const[x,y]of [[100,100],[500,100],[420,500],[500,500],[800,500]])assert.equal(visibleAt(commands,x,y).surfaceId,query(x,y).surfaceId);
    assert.equal(visibleAt(commands,500,500).surfaceId,'a-bridge');assert.equal(JSON.stringify(source),before);
  }
});

test('deep water and timber crossings stay distinguishable from dry ground and ramps',()=>{
  const source=[...layers(),surface('ramp','ramp',rect(200,340,400,660),40,{fromZ:0,toZ:24})];
  const byId=new Map(paint(source).map(command=>[command.surfaceId,command]));
  const water=byId.get('water'),bridge=byId.get('a-bridge'),dry=byId.get('dry'),ramp=byId.get('ramp');
  assert.notEqual(water.fill,dry.fill);assert.notEqual(water.fill,bridge.fill);assert.notEqual(bridge.fill,ramp.fill);
  assert.equal(typeof water.stroke,'string');assert.ok(water.stroke.length>0);assert.equal(typeof bridge.stroke,'string');assert.ok(bridge.stroke.length>0);
});

test('a shaped shoreline paints its real polygon instead of its enclosing rectangle and is detached from source',()=>{
  const vertices=[{x:400,y:0},{x:550,y:0},{x:600,y:300},{x:600,y:1000},{x:400,y:1000}];
  const dry=surface('dry','ground',rect(0,0,1000,1000),10),water={id:'water',kind:'water',area:{type:'polygon',vertices},groundZ:0,priority:30};
  const commands=paint([water,dry]),painted=commands.find(command=>command.surfaceId==='water');
  assert.deepEqual(painted.vertices,vertices);assert.equal(visibleAt(commands,590,30).surfaceId,'dry');assert.equal(visibleAt(commands,500,500).surfaceId,'water');
  vertices[0].x=999;assert.equal(painted.vertices[0].x,400);assert.ok(Object.isFrozen(commands)&&Object.isFrozen(painted)&&Object.isFrozen(painted.vertices)&&Object.isFrozen(painted.vertices[0]));
});

test('cached paint preparation is repeatable and cannot alter the authority samples or draw simulation randomness',()=>{
  const source=layers(),query=createAuthoredGroundQuery({baseSurface:source.at(-1),surfaces:source});
  const points=[[100,100],[500,100],[420,500],[500,500]],before=points.map(([x,y])=>query(x,y)),random=Math.random;
  let first,second;try{Math.random=()=>{throw new Error('presentation must not draw random streams');};first=paint(source);second=paint(source);}finally{Math.random=random;}
  assert.deepEqual(first,second);assert.deepEqual(points.map(([x,y])=>query(x,y)),before);
});
