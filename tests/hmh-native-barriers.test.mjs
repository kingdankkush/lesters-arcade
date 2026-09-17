import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LEVEL_ONE_WORLD} from '../apps/hmh-reboot/src/level-one-world.mjs';
import {buildNativeBarrierPlacements, hiddenNativeBarriers, createNativeBarrierAppearance} from '../apps/hmh-reboot/src/native-barriers.mjs';

import {buildWorldDesignPlacements,WORLD_DESIGN_ASSETS} from '../apps/hmh-reboot/src/world-design-layout.mjs';
import {WORLD_DESIGN_GATE_IDS} from '../apps/hmh-reboot/src/world-design-encounters.mjs';
const kinds=['stone-wall','concrete-wall','concrete-barrier','wood-fence','steel-fence','rock-formation','boulders','bridge-rail'];
const assets=new Map(kinds.flatMap(k=>[0,1,2,3,4,5,6].map(d=>[`hmh-barrier-${k}-${d}`,{}])));
test('native barrier segments cover existing collision routes without changing authority',()=>{
  const before=JSON.stringify(LEVEL_ONE_WORLD),result=buildNativeBarrierPlacements(LEVEL_ONE_WORLD,assets);
  assert.ok(result.placements.length>50 && result.placements.length<=1024);
  assert.equal(new Set(result.placements.map(p=>p.id)).size,result.placements.length);
  assert.equal(JSON.stringify(LEVEL_ONE_WORLD),before);
  for(const id of result.blockerIds){
    const b=LEVEL_ONE_WORLD.blockers.find(b=>b.id===id),rows=result.placements.filter(p=>p.collisionBlockerId===id);
    assert.equal(b.shape.type,'capsule');
    assert.ok(rows.every(p=>p.scale===b.shape.radius));
    assert.ok(rows.every(p=>Math.abs((p.x-b.shape.a.x)*(b.shape.b.y-b.shape.a.y)-(p.y-b.shape.a.y)*(b.shape.b.x-b.shape.a.x))<.0001),'anchors follow the collider');
    for(let i=1;i<rows.length;i++)assert.ok(Math.hypot(rows[i].x-rows[i-1].x,rows[i].y-rows[i-1].y)<=b.shape.radius*4+.00001,'no visual gap between native segments');
  }
  for(const kind of kinds.filter(k=>k!=='bridge-rail'))assert.ok(result.placements.some(p=>p.assetId.startsWith(`hmh-barrier-${kind}-`)),kind+' appears in Level 1');
});
test('opening one court removes only its gate segments, and missing art retains its fallback',()=>{
  const result=buildNativeBarrierPlacements(LEVEL_ONE_WORLD,assets);
  const open=new Set(['relay-supply-gate']);
  const hidden=hiddenNativeBarriers(result.placements,open);
  assert.ok(hidden.length>0);assert.ok(hidden.every(id=>id.startsWith('native-barrier:relay-supply-gate:')));
  assert.equal(hiddenNativeBarriers(result.placements,new Set()).length,0);
  for(const gateId of WORLD_DESIGN_GATE_IDS){
    const rows=hiddenNativeBarriers(result.placements,new Set([gateId]));
    assert.ok(rows.length>=2,`${gateId} has native gate segments`);
    assert.ok(rows.every(id=>id.startsWith(`native-barrier:${gateId}:`)));
  }
  assert.equal(buildNativeBarrierPlacements(LEVEL_ONE_WORLD,new Map()).blockerIds.size,0);
});
test('both delivery tiers bind all 56 repeatable views to the native source and recipes',()=>{
  const m=JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-barriers/manifest.json',import.meta.url)));
  const hash=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
  assert.equal(hash(m.source),m.sourceSha256);
  assert.equal(hash('scripts/hmh-blender/build-hmh-barriers.py'),m.recipeSha256);
  assert.equal(hash('scripts/hmh-blender/pack-hmh-barriers.py'),m.packerSha256);
  assert.equal(m.frames.length,56);assert.ok(m.frames.every(f=>f.nativeABPixelExact));
  for(const tier of ['desktop','mobile']){
    const p=m.tiers[tier];assert.equal(hash('apps/portal/assets/generated/hmh-barriers/'+p.image),p.sha256);
    assert.ok(p.bytes<(tier==='mobile'?300000:900000));
    const texture={source:{pixelWidth:p.width,pixelHeight:p.height}};
    assert.equal(createNativeBarrierAppearance(m,texture,tier).size,56);
    assert.throws(()=>createNativeBarrierAppearance(m,{source:{pixelWidth:1,pixelHeight:1}},tier));
  }
});

test('every capsule wall, fence, cliff and bridge rail has an aligned native view',()=>{
 const result=buildNativeBarrierPlacements(LEVEL_ONE_WORLD,assets);
 const integrated=buildWorldDesignPlacements(LEVEL_ONE_WORLD,new Map([[WORLD_DESIGN_ASSETS.bridge,{}]]));
 assert.ok(integrated.placements.some(p=>p.assetId===WORLD_DESIGN_ASSETS.bridge));
 for(const id of ['crossing-footbridge-north-rail','crossing-footbridge-south-rail']){assert.ok(integrated.blockerIds.has(id));assert.equal(result.blockerIds.has(id),false,'native deck already contains its rails');}
 for(const b of LEVEL_ONE_WORLD.blockers.filter(b=>b.shape.type==='capsule'&&['fence','cliff','bridge-rail'].includes(b.visualKind))) assert.ok(result.blockerIds.has(b.id)||integrated.blockerIds.has(b.id),b.id);
});
