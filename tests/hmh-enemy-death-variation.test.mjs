import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectActor3dEnemyDeathClip, createActor3dPresentationEntries } from '../apps/hmh-reboot/src/actor-3d-controller.mjs';
import { decodeActor3dGlb, evaluateActor3dPose } from '../apps/hmh-reboot/src/actor-3d-model.mjs';

test('stable presentation identity selects both authored deaths without randomness, ordering or clock dependence',()=>{
  const selected=Array.from({length:40},(_,i)=>selectActor3dEnemyDeathClip('bagholder-rusher',`rusher:${i}`));
  assert.deepEqual(new Set(selected),new Set(['death','death-side']));
  for(let i=39;i>=0;i--)assert.equal(selectActor3dEnemyDeathClip('bagholder-rusher',`rusher:${i}`),selected[i]);
  for(const id of ['forkrunner','hodl-revenant','boss-lockkeeper','unknown'])assert.equal(selectActor3dEnemyDeathClip(id,'rusher:1'),'death');
});

test('native variation stays on the same corpse clock, opacity gates and remaining quality slots',()=>{
  const ids=Array.from({length:30},(_,i)=>`rusher:${i}`);
  const id=ids.find(id=>selectActor3dEnemyDeathClip('bagholder-rusher',id)==='death-side');
  const corpse=Object.freeze({id,actorId:'bagholder-rusher',visible:true,alpha:1,x:1,y:2,z:3,pose:Object.freeze({state:'death',direction:2,tick:30}),originals:[]});
  const before=JSON.stringify(corpse);
  const rows=createActor3dPresentationEntries(null,[],null,2,{x:0,y:0},null,[corpse]);
  assert.equal(rows[0].descriptor.clip,'death-side');assert.equal(rows[0].descriptor.clipTimeSeconds,.5);
  assert.equal(createActor3dPresentationEntries(null,[],null,2,{x:0,y:0},null,[{...corpse,alpha:.99}]).length,0);
  const live=[0,1].map(i=>({id:'live'+i,actorId:'bagholder-rusher',active:true,visible:true,alpha:1,x:0,y:0,z:0,pose:{state:'run',direction:0,tick:1},originals:[]}));
  assert.ok(createActor3dPresentationEntries(null,live,null,2,{x:0,y:0},null,[corpse]).every(row=>row.descriptor.id.startsWith('enemy:')));
  assert.equal(JSON.stringify(corpse),before);
});

test('the new native clip is actually resident, distinct, source-bound, and retains every original runtime byte',()=>{
  const root=new URL('../',import.meta.url), base='apps/portal/assets/generated/hmh-actor-3d-pilot/';
  const bytes=readFileSync(new URL(`${base}bagholder-rusher.glb`,root));
  const receipt=JSON.parse(readFileSync(new URL(`${base}bagholder-rusher-deaths.json`,root)));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(bytes),receipt.glbSha256);
  assert.equal(receipt.sourceSha256,'d71630544fb236ad3a165a3e9d3e3f7aa2f5bbd254311b6d8f9c7a1f92b85856');
  assert.equal(receipt.sourceUnchanged,true);assert.equal(receipt.originalClipBytesUnchanged,true);assert.equal(receipt.geometryRigTexturesUnchanged,true);
  // The old BIN payload is retained as one exact prefix, not re-exported art.
  const jsonLength=bytes.readUInt32LE(12),binAt=20+jsonLength+8;
  assert.equal(hash(bytes.subarray(binAt,binAt+receipt.originalBinBytes)),receipt.originalBinSha256);
  const asset=decodeActor3dGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.ok(asset.clips.has('death-side'));assert.equal(asset.clips.get('death-side').duration,1);
  const old=evaluateActor3dPose(asset,'death',1)[0],side=evaluateActor3dPose(asset,'death-side',1)[0];
  assert.ok(side.every(Number.isFinite));
  assert.ok(side.some((value,i)=>Math.abs(value-old[i])>.3),'side fall must genuinely deform the native skeleton differently');
  assert.ok(receipt.assetDeltaBytes < 40000,'one animation must not duplicate mesh/textures');
  // Exercise an actual historical six-clip cache without altering its geometry.
  asset.clips.delete('death-side');
  assert.deepEqual(evaluateActor3dPose(asset,'death-side',.5)[0],evaluateActor3dPose(asset,'death',.5)[0]);
  assert.throws(()=>evaluateActor3dPose(asset,'invented-death',.5),/unknown actor clip/);
});
