import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createWorldDesignAppearance } from '../apps/hmh-reboot/src/world-design-native-assets.mjs';
import { WORLD_DESIGN_ASSETS, buildWorldDesignPlacements } from '../apps/hmh-reboot/src/world-design-layout.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
export function auditWorldDesignAssets({repoRoot=process.cwd()}={}) {
 const dir=path.join(repoRoot,'apps/portal/assets/generated/hmh-world-design');
 const metadata=JSON.parse(readFileSync(path.join(dir,'world-design.json'),'utf8'));
 let appearance;
 for(const tier of ['desktop','mobile']) appearance=createWorldDesignAppearance(metadata,metadata.tiers[tier].pages.map(p=>({source:{width:p.width,height:p.height}})),{tier});
 assert.deepEqual([...appearance.keys()].sort(),Object.values(WORLD_DESIGN_ASSETS).sort());
 const renderer=sha(path.join(repoRoot,'scripts/hmh-blender/export-hmh-world-design.py'));
 const helper=sha(path.join(repoRoot,'scripts/hmh-blender/export-hmh-tripo-props.py'));
 const provenance=JSON.parse(readFileSync(path.join(repoRoot,'docs/hmh-reboot/world-design/NATIVE-WORLD-PROVENANCE.json'),'utf8'));
 assert.equal(provenance.schema,'hmh-world-design-provenance/v1','native provenance schema');
 assert.equal(provenance.assets?.length,17,'native provenance source count');
 const sources=new Map(provenance.assets.map(source=>[source.assetId,source]));
 assert.equal(sources.size,17,'duplicate native provenance source');
 assert.deepEqual([...sources.keys()].sort(),Object.values(WORLD_DESIGN_ASSETS).sort(),'native provenance roster');
 for(const frame of metadata.frames) {
  const source=sources.get(frame.assetId);assert.ok(source,`native provenance missing: ${frame.assetId}`);
  for(const key of ['sourceModelSha256','nativeFrameSha256A','nativeFrameSha256B','yawDegrees','sourceNormalization','sourceDimensions','rendererSha256','nativeHelperSha256']) {
   assert.deepEqual(frame[key],source[key],`native source provenance mismatch: ${frame.assetId}.${key}`);
  }
  assert.equal(frame.rendererSha256,renderer);assert.equal(frame.nativeHelperSha256,helper);
  for(const tier of ['desktop','mobile']) {
   const actual=frame.tiers[tier],expected=source.tiers[tier];
   for(const key of ['anchor','runtimeScale','projectionY','sampling','decodedRgbaSha256','sourceCrop']) assert.deepEqual(actual[key],expected[key],`native source frame mismatch: ${frame.assetId}.${tier}.${key}`);
   assert.equal(actual.frame.w,expected.width,'native source frame width');
   assert.equal(actual.frame.h,expected.height,'native source frame height');
  }
 }
 const placed=buildWorldDesignPlacements(LEVEL_ONE_WORLD,appearance);
 for(const id of placed.blockerIds) assert.ok(LEVEL_ONE_WORLD.collisionBlockers.some(b=>b.id===id),`missing physics ${id}`);
 const result=spawnSync(process.env.PYTHON??'python',['-B',path.join(repoRoot,'scripts/hmh-world-design-published-image-qa.py'),'--asset-root',dir],{cwd:repoRoot,encoding:'utf8',timeout:120000});
 assert.equal(result.status,0,`world design decoded image QA: ${result.stderr||result.error?.message}`);
 return {...JSON.parse(result.stdout),placements:placed.placements.length,pairedBlockers:placed.blockerIds.size,metadataSha256:sha(path.join(dir,'world-design.json'))};
}
