import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildHeroDiagnosticPlan } from '../scripts/hmh-native-hero-diagnostics.mjs';
import { PRODUCTION_HERO_ASSETS, createProductionHeroAtlasIndex, resolveProductionHeroPose } from '../apps/hmh-reboot/src/production-hero-atlas.mjs';

for (const asset of Object.values(PRODUCTION_HERO_ASSETS)) {
  test(`${asset.actorId}: diagnostic evidence covers every delivered frame through the runtime resolver`, () => {
    const metadata = JSON.parse(readFileSync(new URL(`../apps/portal${asset.metadataUrl}`, import.meta.url), 'utf8'));
    const index = createProductionHeroAtlasIndex(metadata, asset);
    const plan = buildHeroDiagnosticPlan(index);
    assert.deepEqual(plan.actions.map(action => action.id), ['idle', 'run', 'aim', 'pistol-fire', 'hurt', 'dash', 'melee', 'grenade', 'death']);
    const used = new Set();
    for (const action of plan.actions) for (const sample of action.samples) {
      assert.deepEqual(sample.frameIds, resolveProductionHeroPose(index, sample.pose).map(frame => frame.id));
      for (const id of sample.frameIds) used.add(id);
    }
    assert.deepEqual([...used].sort(), metadata.frames.map(frame => frame.id).sort());
    assert.equal(plan.waist.length, 64);
    for (const sample of plan.waist) {
      assert.deepEqual(sample.frameIds, resolveProductionHeroPose(index, sample.pose).map(frame => frame.id));
    }
    assert.equal(new Set(plan.waist.map(s => `${s.pose.legDirection}:${s.pose.torsoDirection}`)).size, 64);
    assert.equal(plan.runtimeScale, 0.58);
  });
}

test('diagnostic composition respects trimmed frame pivots, layer order and compact-source density', () => {
  const script = String.raw`
import json, sys
sys.path.insert(0, sys.argv[1])
from PIL import Image
from hmh_native_hero_diagnostics import rebuild_pose
atlas=Image.new('RGBA',(4,1))
atlas.putdata([(255,0,0,255),(0,255,0,255),(0,0,255,255),(0,0,0,0)])
def frame(x,pivot,trim,size=256):
 return {'frame':{'x':x,'y':0,'w':1,'h':1},'pivot':{'x':pivot,'y':pivot},'trim':{'x':trim,'y':trim},'sourceSize':{'h':size}}
frames={'lower':frame(0,0,0),'upper':frame(1,4,4),'compact':frame(2,0,1,128),'released':frame(3,0,0)}
result=rebuild_pose(atlas,frames,['lower','upper','compact','released'])
print(json.dumps([result.getpixel((160,256)),result.getpixel((162,258)),result.getpixel((159,255))]))
`;
  const result=spawnSync(process.env.PYTHON??'python',['-c',script,fileURLToPath(new URL('../scripts/',import.meta.url))],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),[[0,255,0,255],[0,0,255,255],[0,0,0,0]]);
});
