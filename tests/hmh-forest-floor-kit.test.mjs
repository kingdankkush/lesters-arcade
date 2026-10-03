import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {createHollowPinesArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/hollow-pines.mjs';
import {createRugpullWoodsArtPlan} from '../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs';
import {cardBlocks} from '../apps/hmh-reboot/src/world-v2-area-plans/card-footprints.mjs';
import {createPlacementGuard,validateAreaArtPlan} from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import {Texture,TextureSource,Container} from 'pixi.js';
import {createAreaArt,createAreaArtTextureCache} from '../apps/hmh-reboot/src/world-v2-area-art.mjs';

const kit=JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json',import.meta.url)));
const baseline={
  'hollow-pines':'780dedb3f38bbd665e62381ff5993f66c2d7a86bdbe03330b029bda274d3b7d7',
  'rugpull-woods':'abc4550956478843c5826f6019c3993864167d1d94bd97bc883abbce882b2f18',
};

test('forest-floor beds visibly frame arrivals while keeping every blocking card and full path clear',()=>{
  const world=createGreyboxWorld(),before=JSON.stringify(world);
  for(const make of [createHollowPinesArtPlan,createRugpullWoodsArtPlan]) {
    const plan=make(world),area=world.areas.find(a=>a.id===plan.areaId);
    const blocked=plan.props.filter(r=>cardBlocks(r.source,r.height)).map(r=>[r.id,r.source,r.x,r.y,r.height,r.groundZ??0]);
    assert.equal(createHash('sha256').update(JSON.stringify(blocked)).digest('hex'),baseline[area.id],'existing tree/trunk/structure authority remains unchanged');
    const patches=plan.ground.decals.filter(d=>d.source.startsWith('detail:forest-'));
    assert.ok(patches.length>=30,`${area.id} has authored forest-floor beds`);
    assert.ok(patches.filter(d=>Math.abs(d.x-area.center.x)<=116&&Math.abs(d.y-area.center.y)<=250).length>=6,'the portrait arrival sees near patches');
    const guard=createPlacementGuard({world:{...world,sites:world.sites.filter(s=>s.id!==`${area.id}-area`)},areaId:area.id,routeClearance:20,siteClearance:150,spawnClearance:60});
    for(const d of patches) {
      const radius=256*.32*d.scale/2;
      for(const [dx,dy] of [[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]])assert.ok(guard.clear(d.x+dx,d.y+dy),`${d.id} frame keeps routes, water and solids clear`);
    }
    const summary=validateAreaArtPlan(plan,kit);
    assert.equal(summary.nativeForestDetails,true);
    assert.ok(summary.budget.tileDecodedBytes<=8*1024*1024,'ground kit stays inside its decoded cap');
  }
  assert.equal(JSON.stringify(world),before);
});

test('native forest page receipt matches runtime bytes and reused source provenance',()=>{
  const root=new URL('../apps/portal/assets/generated/hmh-art-target/',import.meta.url);
  const receipt=JSON.parse(fs.readFileSync(new URL('forest-ground-details.json',root)));
  assert.equal(receipt.schema,'native-forest-floor/v1');assert.equal(receipt.maxHeightMetres,.18);
  assert.deepEqual(receipt.frames,['leaf-litter','needle-bed','fern-bed','moss-root']);
  assert.equal(receipt.sources[0].sha256,'c52842ed67e23cc4dd91bbe1102c4072896be7e376d50e4fa49eb6ebce061f52');
  assert.equal(receipt.sources[1].sha256,'3ab71d16794ec08530ee04707c2408245113a5c147ae9b8a0ac306d224e66ca5');
  for(const file of receipt.files){const bytes=fs.readFileSync(new URL(file.file,root));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
});

test('full and both half texture-resolution conventions preserve forest patch size and dispose shared pages',async()=>{
  const world=createGreyboxWorld(),widths=[];
  for(const convention of ['full','half','half-source-resolution']){
    const resolution=convention==='full'?'full':'half',urls=[];
    const cache=createAreaArtTextureCache({loadTexture:async url=>{
      urls.push(url);let width=512,height=512,res=1;
      if(url.includes('tripo-props-hd-'))width=height=resolution==='half'?1024:2048;
      if(url.includes('forest-ground-details')){
        width=resolution==='half'?512:1024;height=resolution==='half'?128:256;
        if(convention==='half-source-resolution'){width*=2;height*=2;res=.5;}
      }
      return new Texture({source:new TextureSource({width,height,resolution:res})});
    }});
    const art=createAreaArt({world,areaId:'rugpull-woods',plan:createRugpullWoodsArtPlan(world),kit,textureCache:cache,resolution,createProgram:()=>null});
    await art.ready;const ground=new Container();art.paintSurface({target:ground,surface:{id:'rugpull-woods-floor'}});
    const patches=ground.children.filter(n=>n.label?.startsWith('area-detail-rugpull-woods-forest-floor-'));
    assert.ok(patches.length>100);widths.push(patches[0].width);
    assert.equal(urls.filter(u=>u.includes('forest-ground-details')).length,1);
    assert.ok(!urls.some(u=>u.includes('meadow-ground-details')),'forest does not load the Meadow page');
    art.dispose();assert.equal(cache.snapshot().urls.length,0);cache.dispose();ground.destroy({children:true});
  }
  assert.deepEqual(widths,[widths[0],widths[0],widths[0]]);
});

test('forest atlas dimension failures release acquired texture ownership',async()=>{
  const world=createGreyboxWorld(),cache=createAreaArtTextureCache({loadTexture:async url=>new Texture({source:new TextureSource({width:url.includes('tripo-props-hd-')?2048:512,height:url.includes('tripo-props-hd-')?2048:512})})});
  const art=createAreaArt({world,areaId:'rugpull-woods',plan:createRugpullWoodsArtPlan(world),kit,textureCache:cache});
  await assert.rejects(art.ready,/forest-floor atlas decoded/);assert.equal(cache.snapshot().urls.length,0);cache.dispose();
});
