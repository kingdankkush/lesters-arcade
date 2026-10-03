import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Texture, TextureSource} from 'pixi.js';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createLedgerRidgeArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/ledger-ridge.mjs';
import {createMwebMeadowsArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import {validateAreaArtPlan} from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import {createAreaArt, createAreaArtTextureCache} from '../apps/hmh-reboot/src/world-v2-area-art.mjs';

const kit=JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json',import.meta.url)));
const world=createGreyboxWorld(), before=JSON.stringify(world);

test('native cliff sampling joins unequal image edges continuously at every horizontal turn',()=>{
  const source=fs.readFileSync(new URL('../apps/hmh-reboot/src/world-v2-area-art.mjs',import.meta.url),'utf8');
  const expression=source.match(/float ridgeMirror\(float u\)\s*\{\s*return ([^;]+);/);
  assert.ok(expression,'native horizontal sampling must mirror instead of jumping from the right edge to the left');
  // Evaluate the actual scalar GLSL expression: this deliberately uses a
  // synthetic image whose opposite edges differ, just as the native bakes do.
  const sample=new Function('u','fract','abs',`return ${expression[1]};`);
  const mirror=u=>sample(u,v=>v-Math.floor(v),Math.abs);
  const edgeImage=u=>0.1+u*0.8;
  for(const boundary of [-8,-3,-1,0,1,2,7]) {
    assert.ok(Math.abs(edgeImage(mirror(boundary-1e-7))-edgeImage(mirror(boundary+1e-7)))<1e-6,`continuous native texture at turn ${boundary}`);
    assert.ok(mirror(boundary+.37)>=0 && mirror(boundary+.37)<=1);
  }
  const nativeCalls=[...source.matchAll(/ridgeFrame\((\d)\.0, vec2\(([^\n]+?)\)\)/g)];
  assert.deepEqual([...new Set(nativeCalls.map(m=>m[1]))].sort(),['0','1','2','3','4','5']);
  assert.ok(nativeCalls.every(m=>m[2].startsWith('ridgeMirror(')),'all face/cap/rubble coordinates use continuous horizontal mirrors');
  assert.ok(source.includes('float v = clamp(lip / max(lip + foot, 1.0), 0.0, 1.0);'),'native vertical sampling retains the complete face height');
});

test('delivered native Ridge assets match their measured receipt and source provenance',()=>{
  const root=new URL('../apps/portal/assets/generated/hmh-art-target/',import.meta.url);
  const receipt=JSON.parse(fs.readFileSync(new URL('ridge-cliff-kit.json',root)));
  assert.equal(receipt.sourceSha256,'968188146c68601fa4753d8c60f349e243ae31d672b4b3e93fbe6d8c4dececa1');
  assert.equal(receipt.frames.length,6);
  for(const [index,file] of receipt.files.entries()) {
    const bytes=fs.readFileSync(new URL(file.file,root));
    assert.equal(bytes.length,file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
    assert.deepEqual(file.size,index===0?[1024,512]:[512,256]);
    assert.ok(file.bytes<=(index===0?300000:100000));
  }
});

test('Ridge alone opts into the native cliff kit within its existing ground memory cap',()=>{
  const plan=createLedgerRidgeArtPlan(world),summary=validateAreaArtPlan(plan,kit);
  assert.equal(plan.ground.cliffKit,'native-ridge-v1');
  assert.equal(summary.nativeRidgeCliffs,true);
  assert.equal(summary.budget.tileDecodedBytes,7471104);
  assert.ok(summary.budget.tileDecodedBytes<=8*1024*1024);
  assert.equal(validateAreaArtPlan(createMwebMeadowsArtPlan(world),kit).nativeRidgeCliffs,false);
  assert.throws(()=>validateAreaArtPlan({...plan,ground:{...plan.ground,cliffKit:'unknown'}},kit),/cliffKit/);
  const meadows=createMwebMeadowsArtPlan(world);
  assert.throws(()=>validateAreaArtPlan({...meadows,ground:{...meadows.ground,cliffKit:'native-ridge-v1'}},kit),/Ledger Ridge|ledger-ridge/);
  assert.equal(JSON.stringify(world),before);
});

test('native Ridge atlas is loaded by tier, paints a face/lip/foot fallback and is released',async()=>{
  const footprints=[];
  for(const resolution of ['full','half']) {
    const urls=[],cache=createAreaArtTextureCache({loadTexture:async url=>{
      urls.push(url);let width=512,height=512;
      if(url.includes('tripo-props-hd-')) width=height=url.includes('@0.5x')?1024:2048;
      else if(url.includes('ridge-cliff-kit')) {width=resolution==='half'?512:1024;height=resolution==='half'?256:512;}
      return new Texture({source:new TextureSource({width,height})});
    }});
    const art=createAreaArt({world,areaId:'ledger-ridge',plan:createLedgerRidgeArtPlan(world),kit,textureCache:cache,resolution,createProgram:()=>null});
    await art.ready;
    assert.equal(urls.filter(u=>u.includes('ridge-cliff-kit')).length,1);
    assert.ok(urls.some(u=>u.endsWith(resolution==='half'?'ridge-cliff-kit@0.5x.webp':'ridge-cliff-kit.webp')));
    const solid=art.createSolid(world.pieces.find(p=>p.id==='ledger-ridge-lower-cut'));
    const labels=[];const visit=n=>{if(n.label)labels.push(n.label);for(const child of n.children??[])visit(child);};visit(solid);
    assert.ok(labels.includes('area-native-ridge-face'));
    assert.ok(labels.includes('area-native-ridge-lip'));
    assert.ok(labels.includes('area-native-ridge-foot'));
    const painted=[];const inspect=n=>{if(n.label?.startsWith('area-native-ridge-')){
      const ratio=resolution==='half'?0.5:1;
      assert.equal(n.texture.frame.width,512*ratio-2,'one physical pixel inset on each horizontal edge');
      assert.equal(n.texture.frame.height,(n.label==='area-native-ridge-face'?192:128)*ratio-2,'one physical pixel inset on each vertical edge');
      painted.push([n.label,n.x,n.y,n.scale.x*n.texture.width,n.scale.y*n.texture.height].map(v=>typeof v==='number'?Math.round(v*1e6)/1e6:v));
    }for(const child of n.children??[])inspect(child);};inspect(solid);footprints.push(painted);
    art.dispose();solid.destroy({children:true});assert.equal(cache.snapshot().urls.length,0);cache.dispose();
    assert.equal(JSON.stringify(world),before,'native presentation never changes authoritative geometry');
  }
  assert.deepEqual(footprints[0],footprints[1],'full and half tiers retain identical projected face/lip/foot dimensions');
});

test('a malformed native cliff atlas fails ready and releases every acquired page',async()=>{
  const cache=createAreaArtTextureCache({loadTexture:async url=>new Texture({source:new TextureSource({width:url.includes('tripo-props-hd-')?2048:512,height:url.includes('tripo-props-hd-')?2048:512})})});
  const art=createAreaArt({world,areaId:'ledger-ridge',plan:createLedgerRidgeArtPlan(world),kit,textureCache:cache});
  await assert.rejects(art.ready,/native Ridge cliff atlas decoded/);
  assert.equal(cache.snapshot().urls.length,0);cache.dispose();
});
