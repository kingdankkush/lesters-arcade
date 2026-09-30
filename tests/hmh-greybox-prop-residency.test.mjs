import assert from 'node:assert/strict';
import test from 'node:test';
import {createGreyboxWorld} from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import {worldToScreen} from '../apps/hmh-reboot/src/world-space.mjs';
const module = await import('../apps/hmh-reboot/src/dev/greybox-prop-residency.mjs').catch(error=>{
  if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;
});
const prop=(id,x,y=0,height=40,areaId='west')=>({id,areaId,bounds:{left:x-20,right:x+20,top:y-height,bottom:y+20}});
const camera=(x=0,y=0,extra={})=>({x,y,groundZ:0,zoom:1,shakeX:0,shakeY:0,...extra});
const view={width:100,height:100};
function make(catalog=[prop('near',0),prop('far',1000)],options={}){
  assert.equal(typeof module.createGreyboxPropResidency,'function','private prop display residency required');
  const events=[],resources=[];
  const live=module.createGreyboxPropResidency({catalog,
    create(record){const resource={id:record.id,visible:false,destroyed:false};resources.push(resource);events.push(`create:${record.id}`);return resource;},
    setVisible(resource,visible){assert.equal(resource.destroyed,false);resource.visible=visible;},
    destroy(resource){assert.equal(resource.destroyed,false);resource.destroyed=true;events.push(`destroy:${resource.id}`);},...options});
  return {live,events,resources,update:(x=0,y=0,extra={})=>live.update({camera:camera(x,y,extra),view})};
}

test('prop displays allocate lazily and repeat stationary frames retain exact owned objects',()=>{
  const f=make();assert.equal(f.resources.length,0);assert.equal(f.live.snapshot().catalogCount,2);
  f.update();const initial=f.resources[0];for(let n=0;n<20;n++)f.update();
  const state=f.live.snapshot();assert.deepEqual(state.residentIds,['near']);assert.deepEqual(state.visibleIds,['near']);
  assert.equal(state.liveCount,1);assert.equal(state.peakCount,1);assert.equal(state.createdCount,1);assert.equal(state.destroyedCount,0);
  assert.equal(f.resources[0],initial);assert.deepEqual(f.events,['create:near']);f.live.dispose();
});
test('exact painted roof bounds use camera height shake and zoom instead of anchor distance',()=>{
  const f=make([prop('tower',0,230,240),prop('outside',400)]);
  f.live.update({camera:camera(0,200,{groundZ:200,zoom:2,shakeX:20,shakeY:-10}),view});
  assert.deepEqual(f.live.snapshot().visibleIds,['tower'],'tower roof is visible while its ground anchor is far below viewport');
  assert.deepEqual(f.live.snapshot().residentIds,['tower']);assert.equal(f.resources[0].visible,true);
  f.update(0,600);assert.equal(f.live.snapshot().liveCount,0);f.live.dispose();
});
test('acquire and retain margins prevent seam churn and return traversal creates a fresh object',()=>{
  const f=make([prop('edge',0)]);f.update();const first=f.resources[0];
  f.update(130);assert.deepEqual(f.live.snapshot().residentIds,['edge']);assert.equal(first.visible,false);
  f.update(180);assert.equal(first.destroyed,true);assert.equal(f.live.snapshot().liveCount,0);
  f.update(130);assert.equal(f.live.snapshot().liveCount,0,'outside acquire margin does not reload');
  f.update(100);assert.equal(f.live.snapshot().createdCount,2);assert.notEqual(f.resources[1],first);
  f.update(0);assert.deepEqual(f.live.snapshot().visibleIds,['edge']);f.live.dispose();
});
test('distant display destruction finishes before replacement admission and bounds the peak',()=>{
  const f=make();f.update();f.update(1000);f.update();
  assert.deepEqual(f.events,['create:near','destroy:near','create:far','destroy:far','create:near']);
  assert.equal(f.live.snapshot().peakCount,1);assert.equal(f.live.snapshot().destroyedCount,2);
  f.live.dispose();assert.equal(f.live.snapshot().liveCount,0);assert.equal(f.live.snapshot().destroyedCount,3);
});
test('catalog and observation ownership are detached from caller edits',()=>{
  const catalog=[prop('near',0)],f=make(catalog);catalog[0].bounds.left=9000;catalog[0].id='changed';catalog.push(prop('extra',0));
  f.update();const state=f.live.snapshot();assert.deepEqual(state.residentIds,['near']);assert.equal(state.catalogCount,1);
  assert.ok(Object.isFrozen(state));assert.ok(Object.isFrozen(state.residentIds));assert.ok(Object.isFrozen(state.areaIds));
  assert.throws(()=>state.residentIds.push('foreign'),TypeError);assert.throws(()=>state.areaIds.push('foreign'),TypeError);
  assert.equal(Object.hasOwn(state,'resources'),false);f.live.dispose();assert.equal(state.liveCount,1);
});
test('idempotent disposal clears exact ownership and post-disposal updates cannot create',()=>{
  const f=make();f.update();f.live.dispose();f.live.dispose();
  assert.equal(f.live.snapshot().disposed,true);assert.equal(f.live.snapshot().liveCount,0);
  assert.throws(()=>f.update(1000),/disposed/);assert.deepEqual(f.events,['create:near','destroy:near']);
});
test('failed creation retains already acquired resources for explicit final cleanup',()=>{
  let released=0;const f=make([prop('good',0),prop('bad',30)],{
    create(record){if(record.id==='bad')throw Error('partial construction cleaned by owner');return {id:record.id};},
    destroy(){released++;},setVisible(){}});
  assert.throws(()=>f.update(),/partial construction/);assert.equal(f.live.snapshot().liveCount,1);
  assert.equal(f.live.snapshot().createdCount,1);f.live.dispose();assert.equal(released,1);assert.equal(f.live.snapshot().liveCount,0);
});
test('a failed destroy retains charged ownership and prevents replacement creation',()=>{
  let destroys=0;const f=make(undefined,{destroy(){destroys++;if(destroys===1)throw Error('release witness');}});f.update();
  assert.throws(()=>f.update(1000),/release witness/);assert.equal(f.live.snapshot().liveCount,1);
  assert.equal(f.live.snapshot().destroyedCount,0);assert.equal(f.live.snapshot().createdCount,1);
  f.live.dispose();f.live.dispose();assert.equal(destroys,2);assert.equal(f.live.snapshot().liveCount,0);
  const counts={first:0,second:0};const g=make([prop('first',0),prop('second',30)],{
    destroy(resource){counts[resource.id]++;if(resource.id==='second'&&counts.second===1)throw Error('transient dispose witness');}});
  g.update();assert.throws(()=>g.live.dispose(),/transient dispose witness/);
  assert.equal(g.live.snapshot().disposed,true);assert.equal(g.live.snapshot().liveCount,1,'failed release stays charged');
  assert.deepEqual(g.live.snapshot().residentIds,['second']);assert.equal(g.live.snapshot().destroyedCount,1);
  assert.throws(()=>g.update(),/disposed/);g.live.dispose();g.live.dispose();
  assert.equal(g.live.snapshot().liveCount,0);assert.deepEqual(counts,{first:1,second:2},'only retained ownership retries');
});
test('malformed catalog or projection fails before changing live displays',()=>{
  for(const catalog of [[prop('same',0),prop('same',1)],[{...prop('bad',0),bounds:{left:2,right:1,top:0,bottom:1}}],[prop('',0)],[prop('nan',NaN)]])assert.throws(()=>make(catalog),/catalog|bounds|unique|finite|id/i);
  const f=make();f.update();for(const bad of [{zoom:0},{x:NaN},{groundZ:Infinity},{shakeY:NaN}])assert.throws(()=>f.update(0,0,bad),/camera|finite|projection/i);
  assert.throws(()=>f.live.update({camera:camera(),view:{width:0,height:100}}),/view|finite|projection/i);
  assert.deepEqual(f.events,['create:near']);assert.deepEqual(f.live.snapshot().residentIds,['near']);f.live.dispose();
});
test('full authored catalog covers projected viewport solids across every area with bounded reversible residency',t=>{
  assert.equal(typeof module.createGreyboxPropResidency,'function','private prop display residency required');
  const world=createGreyboxWorld(),solid=world.pieces.filter(piece=>piece.blocker),catalog=solid.map(piece=>({id:piece.id,areaId:piece.areaId??null,bounds:{left:piece.visible.bounds.minX,right:piece.visible.bounds.maxX,top:piece.visible.bounds.minY-piece.visible.height,bottom:piece.visible.bounds.maxY}}));
  const f=make(catalog),sizes=[{width:1280,height:650},{width:414,height:630}],observations=[];
  const intersects=(r,s)=>r.right>=s.left&&r.left<=s.right&&r.bottom>=s.top&&r.top<=s.bottom;
  for(const viewport of sizes)for(const area of [...world.areas,...[...world.areas].reverse()]){
    const cam=camera(area.center.x,area.center.y,{zoom:.83,groundZ:24,shakeX:7,shakeY:-3});
    f.live.update({camera:cam,view:viewport});const state=f.live.snapshot();
    const projected=catalog.map(record=>{const r=record.bounds,a=worldToScreen({x:r.left,y:r.top,z:0},cam,viewport),b=worldToScreen({x:r.right,y:r.bottom,z:0},cam,viewport);return{id:record.id,bounds:{left:a.x,right:b.x,top:a.y,bottom:b.y}};});
    const expected=projected.filter(p=>intersects(p.bounds,{left:0,right:viewport.width,top:0,bottom:viewport.height})).map(p=>p.id).sort();
    const acquire=projected.filter(p=>intersects(p.bounds,{left:-viewport.width/2,right:viewport.width*1.5,top:-viewport.height/2,bottom:viewport.height*1.5})).map(p=>p.id);
    assert.deepEqual(state.visibleIds,expected,area.id);assert.ok(expected.every(id=>state.residentIds.includes(id)));
    assert.ok(acquire.every(id=>state.residentIds.includes(id)),`actual acquire-window coverage in ${area.id}`);
    assert.ok(state.liveCount<catalog.length,'actual catalog is not retained globally');
    observations.push({area:area.id,width:viewport.width,live:state.liveCount,visible:expected.length,acquire:acquire.length});
  }
  assert.ok(f.live.snapshot().destroyedCount>0);assert.ok(f.live.snapshot().createdCount>f.live.snapshot().liveCount);
  t.diagnostic(JSON.stringify({scope:'source projected-area camera inventory; Graphics are test objects',catalog:catalog.length,peakLive:f.live.snapshot().peakCount,minimumLive:Math.min(...observations.map(o=>o.live)),created:f.live.snapshot().createdCount,destroyed:f.live.snapshot().destroyedCount,emptyViews:observations.filter(o=>o.live===0)}));
  f.live.dispose();assert.equal(f.live.snapshot().liveCount,0);assert.equal(f.live.snapshot().createdCount,f.live.snapshot().destroyedCount);
});
