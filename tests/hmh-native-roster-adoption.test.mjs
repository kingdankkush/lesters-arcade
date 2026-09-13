import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import { enemyRosterAsset,createEnemyRosterAtlasIndex,resolveEnemyRosterPose } from '../apps/hmh-reboot/src/enemy-roster-atlas.mjs';
const root=new URL('../',import.meta.url);
const json=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex');
const actors=['forkrunner','liquidator-agent','whale-enforcer','gas-bomber','validator-cultist','the-liquidator'];

test('six native enemies have verified editable sources, complete runtime art and matching independent render receipts',()=>{
  const source=json('apps/hmh-reboot/assets/source/blender/hmh-native-roster.json');
  const measurement=json('docs/testing/hmh-native-roster/measurement.json');
  assert.equal(source.sources.length,6);
  for(const actor of actors){
    const s=source.sources.find(s=>s.actorId===actor),r=measurement.actors.find(r=>r.actorId===actor);
    assert.equal(sha(s.path),s.sourceSha256);assert.ok(s.nativeBodyVertices>50000);assert.ok(s.bones>=19);
    assert.deepEqual(Object.keys(s.clipActions).sort(),['attack','death','hit','idle','run','tell']);
    const asset=enemyRosterAsset(actor);
    const metaPath='apps/portal/'+asset.metadataUrl.replace('../','');
    const imagePath='apps/portal/'+asset.imageUrl.replace('../','');
    const m=json(metaPath);assert.equal(sha(imagePath),m.imageSha256);assert.equal(sha(metaPath),r.metadataSha256);
    assert.equal(m.sourceModel.sourceSha256,s.sourceSha256);assert.equal(m.imageBytes,r.imageBytes);assert.ok(r.imageBytes<=4194304);
    assert.equal(m.poseAuthoring.mode,'retargeted-native-role-actions');
    assert.equal(m.frames.length,actor==='the-liquidator'?840:280);
    assert.equal(m.runtimeScale,asset.runtimeScale);
    const a=json(`docs/testing/hmh-native-roster/${actor}/run-a-receipt.json`),b=json(`docs/testing/hmh-native-roster/${actor}/run-b-receipt.json`);
    assert.deepEqual(a,b);assert.equal(a.sourceSha256,s.sourceSha256);assert.equal(a.sourceUnchanged,true);
    assert.equal(r.pixelReconstructionChanged,0);assert.ok(r.repeatability.maxChannelDelta<=2);
    for(const frame of m.frames){assert.ok(frame.frame.x+frame.frame.w<=m.dimensions.width);assert.ok(frame.frame.y+frame.frame.h<=m.dimensions.height);}
  }
});
test('native locomotion completes twelve distinct poses per half-second while short combat reactions complete inside their live windows',()=>{
  for(const actor of actors){
    const asset=enemyRosterAsset(actor),m=json('apps/portal/'+asset.metadataUrl.replace('../',''));
    const index=createEnemyRosterAtlasIndex(m,actor);
    const run=new Set(Array.from({length:30},(_,tick)=>resolveEnemyRosterPose(index,{state:'run',tick,direction:0}).id));
    assert.equal(run.size,12,actor);
    assert.equal(resolveEnemyRosterPose(index,{state:'hit',tick:4,direction:0}).frameIndex,2,actor);
    assert.equal(resolveEnemyRosterPose(index,{state:'tell',tick:10,phaseTick:8,direction:0}).frameIndex,3,actor);
    assert.equal(resolveEnemyRosterPose(index,{state:'attack',tick:12,phaseTick:10,direction:0}).frameIndex,5,actor);
  }
});
