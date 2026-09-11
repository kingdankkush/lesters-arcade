import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {HMH_HERO_PORTRAITS} from '../apps/portal/src/generated/hmh-hero-portraits.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
test('four portraits bind the unchanged gameplay sources and stay within the download budget',()=>{
  const receipt=JSON.parse(read('apps/portal/assets/generated/hmh-hero-portraits/portraits.json'));
  const pilots=JSON.parse(read('apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json')).pilots;
  const config=JSON.parse(read('apps/hmh-reboot/assets/source/blender/hmh-hero-portrait-render.json'));
  assert.equal(config.action,'HMH_Idle');
  assert.equal(config.cameraPitchDegrees,84);
  assert.deepEqual(config.hideLayers,['weapon','shadow']);
  assert.equal(Object.keys(HMH_HERO_PORTRAITS.heroes).length,4);
  let total=0;
  for(const pilot of pilots) {
    assert.equal(receipt.sources[pilot.sourceModel.path],pilot.sourceModel.sourceSha256);
    const hero=HMH_HERO_PORTRAITS.heroes[pilot.actorId==='lester-original'?'lester':pilot.actorId];
    const bytes=read('apps/portal'+hero.image);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hero.imageSha256);
    assert.equal(bytes.length,hero.imageBytes);
    assert.ok(bytes.length<=524288);
    total+=bytes.length;
    assert.equal(hero.frames.length,8);
  }
  assert.ok(total<=2097152);
  for(const frame of receipt.drift) assert.ok(frame.changed<=8 && frame.maxDelta<=2 && frame.totalDelta<=32);
  assert.equal(receipt.drift.length,20);
});
