import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Texture,TextureSource,Container} from 'pixi.js';
import * as surfaces from '../apps/hmh-reboot/src/world-v2-area-surfaces.mjs';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createDistrictTerrainArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/district-terrain.mjs';
import {createAreaArt,createAreaArtTextureCache} from '../apps/hmh-reboot/src/world-v2-area-art.mjs';

const outline=[{x:0,y:0},{x:320,y:0},{x:320,y:1000},{x:0,y:1000}];
const at=(field,x,y)=>Math.floor((y-field.minY)/field.unitsPerTexel)*field.width+Math.floor((x-field.minX)/field.unitsPerTexel);
const direction=(field,x,y)=>{const i=at(field,x,y)*2;return [field.flowData[i]/255*2-1,field.flowData[i+1]/255*2-1];};

test('actual shader confines caustics to the shallow bank and absorbs to quiet depth sooner',()=>{
  // Evaluate the simple scalar GLSL functions used by the material itself;
  // this prevents a broad caustic web returning across the deeper channel.
  const evaluate=name=>{
    const body=surfaces.WATER_FRAGMENT.match(new RegExp(`float ${name}\\(float d\\) \\{\\s*return ([^;]+);\\s*\\}`))?.[1];
    assert.ok(body,`${name} is bound into the material shader`);
    return Function('d','smoothstep','exp',`return ${body};`);
  };
  const depth=evaluate('waterDepthFactor'),caustics=evaluate('waterCausticMask');
  const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const sample=(fn,d)=>fn(d,smoothstep,Math.exp);
  assert.equal(sample(depth,0),0);
  assert.ok(sample(depth,80)>.65,'mid channel is predominantly the deeper palette');
  assert.ok(sample(depth,199)>.94);
  assert.equal(sample(caustics,0),1);
  assert.ok(sample(caustics,35)>0&&sample(caustics,35)<.65);
  assert.equal(sample(caustics,65),0,'caustics stop in the shallow bank strip');
  assert.equal(sample(caustics,199),0);
});

test('shore flow follows the channel banks, bends near an end and leaves signed depth unchanged',()=>{
  const before=JSON.stringify(outline),legacy=surfaces.buildShoreField(outline);
  const flow=surfaces.buildShoreField(outline,{flow:{x:0,y:1,speed:5}}),again=surfaces.buildShoreField(outline,{flow:{x:0,y:1,speed:18}});
  assert.ok(flow.flowData instanceof Uint8Array,'shore field has two baked direction channels');
  assert.equal(flow.flowData.length,flow.width*flow.height*2);
  assert.deepEqual(flow.data,legacy.data,'depth/distance encoding stays unchanged');
  assert.deepEqual(flow.flowData,again.flowData,'speed is a presentation uniform, not a new geometry stream');
  assert.ok(direction(flow,12,500)[1]>.95,'river flows alongside the west bank');
  assert.ok(Math.abs(direction(flow,160,12)[0])>.4,'near its end the current turns along the shore instead of entering land');
  assert.ok(direction(flow,160,500)[1]>.95,'deep channel keeps its authored current direction');
  assert.equal(JSON.stringify(outline),before);
});

test('distance plus flow occupy the existing opaque RGBA shore texture without an extra GPU page',()=>{
  const field=surfaces.buildShoreField(outline,{flow:{x:0,y:1}});
  assert.equal(typeof surfaces.packShoreFieldRGBA,'function');
  const rgba=surfaces.packShoreFieldRGBA(field);
  assert.equal(rgba.length,field.width*field.height*4);
  for(let i=0;i<field.data.length;i++) {
    assert.equal(rgba[i*4],field.data[i]);assert.equal(rgba[i*4+1],field.flowData[i*2]);assert.equal(rgba[i*4+2],field.flowData[i*2+1]);assert.equal(rgba[i*4+3],255);
  }
});

test('water material binds district optics and preserves geometry, tier and reduced-motion behaviour',async()=>{
  const world=createGreyboxWorld(),before=JSON.stringify(world);
  const kit=JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json',import.meta.url)));
  for(const areaId of ['hashwood-river','scrypt-bayou'])for(const resolution of ['full','half']) {
    const cache=createAreaArtTextureCache({loadTexture:async url=>{const w=url.includes('tripo-props-hd-')?(url.includes('@0.5x')?1024:2048):512;return new Texture({source:new TextureSource({width:w,height:w})});}});
    const art=createAreaArt({world,areaId,plan:createDistrictTerrainArtPlan(world,areaId),kit,textureCache:cache,resolution,terrainFieldSize:16,createControlTexture:()=>null,createProgram:kind=>({name:kind}),createShoreTexture:field=>new Texture({source:new TextureSource({width:field.width,height:field.height})}),reducedMotion:()=>true});
    await art.ready;const ground=new Container();art.paintSurfaces(ground);art.mount(new Container(),ground);
    const water=ground.children.find(n=>n.label?.startsWith('area-water-'));
    assert.ok(water.shader.resources.waterUniforms.uniforms.uOptics,'normal/foam/caustic/specular optics reach the actual water mesh');
    assert.equal(water.shader.resources.waterUniforms.uniforms.uWater[1],resolution==='half'?0:1);
    for(let n=0;n<120;n++)art.update({x:world.areas.find(a=>a.id===areaId).center.x,y:world.areas.find(a=>a.id===areaId).center.y,zoom:1},{width:900,height:700});
    assert.equal(water.shader.resources.waterUniforms.uniforms.uWater[0],0,'reduced motion freezes wave phase');
    art.dispose();assert.equal(cache.snapshot().urls.length,0);cache.dispose();ground.destroy({children:true});
  }
  assert.equal(JSON.stringify(world),before);
});
