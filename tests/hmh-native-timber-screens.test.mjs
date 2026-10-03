import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Texture,TextureSource} from 'pixi.js';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createMwebMeadowsArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import {createHashwoodRiverArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/hashwood-river.mjs';
import {validateAreaArtPlan} from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import {createAreaArt,createAreaArtTextureCache} from '../apps/hmh-reboot/src/world-v2-area-art.mjs';
const kit=JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json',import.meta.url)));
const ids=['mweb-meadows-court-wall','hashwood-river-marquee-west-post','hashwood-river-marquee-east-post','hashwood-river-court-tall-screen'];
const expected=[[13415,5920,13485,6180,128],[6915,12155,6985,12245,160],[7415,12155,7485,12245,160],[7160,12920,7240,13080,128]];
test('four brown placeholder stakes become native art without changing their authored geometry',()=>{
 const world=createGreyboxWorld(),before=JSON.stringify(world);
 assert.equal(createHash('sha256').update(JSON.stringify(ids.map(id=>{const p=world.pieces.find(p=>p.id===id);return[p.id,p.kind,p.blocker];}))).digest('hex'),'10a145d08273e11226b79c1dd351ea5c9293f833e613acf56867207f2e322b1b','all blocker identities, shapes, heights and properties stay canonical');
 for(const make of[createMwebMeadowsArtPlan,createHashwoodRiverArtPlan]){
  const plan=make(world),s=validateAreaArtPlan(plan,kit);assert.equal(s.nativeTimberScreens,true);assert.ok(s.budget.tileDecodedBytes<=8*1024*1024);
  for(const row of plan.solids.filter(r=>ids.includes(r.pieceId))){assert.equal(row.style,'native-timber');const p=world.pieces.find(p=>p.id===row.pieceId),b=p.visible.bounds;assert.deepEqual([b.minX,b.minY,b.maxX,b.maxY,p.visible.height],expected[ids.indexOf(row.pieceId)]);}
 }assert.equal(JSON.stringify(world),before);
});
test('full and both half source conventions retain world footprint/height and release the native page',async()=>{
 const world=createGreyboxWorld();for(const convention of['full','half','half-source-resolution'])for(const make of[createMwebMeadowsArtPlan,createHashwoodRiverArtPlan]){
  const plan=make(world),resolution=convention==='full'?'full':'half',urls=[];
  const cache=createAreaArtTextureCache({loadTexture:async u=>{urls.push(u);let width=u.includes('tripo-props-hd-')?(resolution==='half'?1024:2048):512,height=width,res=1;if(u.includes('native-timber-screens')){width=resolution==='half'?256:512;height=resolution==='half'?128:256;if(convention==='half-source-resolution'){width*=2;height*=2;res=.5;}}return new Texture({source:new TextureSource({width,height,resolution:res})});}});
  const art=createAreaArt({world,areaId:plan.areaId,plan,kit,textureCache:cache,resolution,createProgram:()=>null});await art.ready;
  for(const id of ids.filter(id=>id.startsWith(plan.areaId))){const p=world.pieces.find(p=>p.id===id),b=p.visible.bounds,n=art.createSolid(p),sprite=n.children.find(c=>c.label?.startsWith('native-timber-'));assert.ok(sprite,'native geometry replaces stake Graphics');assert.equal(sprite.x,(b.minX+b.maxX)/2);assert.equal(sprite.y,b.maxY);assert.equal(sprite.width,b.maxX-b.minX);assert.equal(sprite.height,b.maxY-b.minY+p.visible.height);assert.equal(n.areaArtCover.top,p.visible.height);n.destroy({children:true});}
  assert.equal(urls.filter(u=>u.includes('native-timber-screens')).length,1);art.dispose();assert.equal(cache.snapshot().urls.length,0);cache.dispose();
 }
});
test('unsafe native frame and malformed page fail closed without retaining texture ownership',async()=>{
 const w=createGreyboxWorld(),p=structuredClone(createMwebMeadowsArtPlan(w));p.solids.find(s=>ids.includes(s.pieceId)).nativeFrame='other';assert.throws(()=>validateAreaArtPlan(p,kit),/nativeFrame/);
 const cache=createAreaArtTextureCache({loadTexture:async u=>new Texture({source:new TextureSource({width:u.includes('tripo-props-hd-')?2048:512,height:u.includes('tripo-props-hd-')?2048:512})})});const art=createAreaArt({world:w,areaId:'mweb-meadows',plan:createMwebMeadowsArtPlan(w),kit,textureCache:cache});await assert.rejects(art.ready,/native timber atlas decoded/);assert.equal(cache.snapshot().urls.length,0);cache.dispose();
});
test('native material/source and physical framing receipts match runtime files',()=>{
 const root=new URL('../apps/portal/assets/generated/hmh-art-target/',import.meta.url),r=JSON.parse(fs.readFileSync(new URL('native-timber-screens.json',root)));assert.equal(r.schema,'native-timber-screens/v1');assert.equal(r.sourceUnchanged,true);assert.deepEqual(r.frames.map(f=>f.pieceId),ids);for(const f of r.files){const b=fs.readFileSync(new URL(f.file,root));assert.equal(b.length,f.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256);assert.equal(f.decodedBytes,f.size[0]*f.size[1]*4);}
});
