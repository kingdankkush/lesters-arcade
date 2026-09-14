import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
export function validateNativeRosterAsset({repoRoot,actorId,imagePath,metadataPath,metadata}){
  const manifest=JSON.parse(readFileSync(path.join(repoRoot,'apps/hmh-reboot/assets/source/blender/hmh-native-roster.json')));
  const source=manifest.sources.find(s=>s.actorId===actorId);assert.ok(source,actorId);
  assert.equal(sha(path.join(repoRoot,source.path)),source.sourceSha256);
  assert.equal(sha(path.join(repoRoot,source.baseSource)),source.baseSha256);
  assert.equal(metadata.sourceModel.sourceSha256,source.sourceSha256);
  assert.ok(source.bones>=19&&source.nativeBodyVertices>=50000);
  assert.deepEqual(Object.keys(source.clipActions).sort(),['attack','death','hit','idle','run','tell']);
  const measurements=JSON.parse(readFileSync(path.join(repoRoot,'docs/testing/hmh-native-roster/measurement.json')));
  const proof=measurements.actors.find(a=>a.actorId===actorId);assert.ok(proof);
  assert.equal(sha(imagePath),proof.imageSha256);assert.equal(sha(metadataPath),proof.metadataSha256);
  assert.equal(proof.pixelReconstructionChanged,0);assert.equal(proof.sourceUnchanged,true);
  for(const [key,limit] of Object.entries({maxChangedVisiblePixels:8,maxChannelDelta:2,maxTotalChannelDelta:32}))assert.ok(proof.repeatability[key]<=limit);
  const result=spawnSync(process.env.PYTHON??'python',[path.join(repoRoot,'scripts/hmh-native-roster-image-report.py'),'--image',imagePath,'--metadata',metadataPath],{cwd:repoRoot,encoding:'utf8'});
  assert.equal(result.status,0,`${actorId}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
