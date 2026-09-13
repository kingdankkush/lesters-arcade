import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CHIKUN_CLIPS, selectChikunAnimation, sampleChikunFrame } from '../apps/chikun/src/character.mjs';
import { chikunSkyState } from '../apps/chikun/src/world.mjs';
import { createChikunRuntime } from '../apps/portal/src/chikun-cabinet.mjs';

test('30 bounded animation clips cover flight, reactions and death', () => {
  assert.equal(Object.keys(CHIKUN_CLIPS).length, 30);
  for (const clip of Object.keys(CHIKUN_CLIPS)) {
    for (const time of [-1,0,.01,.65,100,Infinity,NaN]) {
      const f = sampleChikunFrame(clip,time);
      assert.ok(f.frame>=0 && f.frame<16);
      assert.ok(f.next>=0 && f.next<16);
      assert.ok(f.mix>=0 && f.mix<=1);
    }
  }
  assert.equal(selectChikunAnimation({tick:120,chikun:{velocityY:-3}}), 'rise_fast');
  assert.equal(selectChikunAnimation({tick:120,chikun:{velocityY:5}}), 'dive');
  assert.equal(selectChikunAnimation({tick:120,terminal:true,terminalReason:'fork'}, {terminalAge:.1}), 'hit_front');
  assert.equal(selectChikunAnimation({terminal:true,terminalReason:'ceiling'}, {terminalAge:.1}), 'hit_ceiling');
  assert.equal(selectChikunAnimation({terminal:true,terminalReason:'ground'}, {terminalAge:.1}), 'hit_ground');
  assert.equal(selectChikunAnimation({terminal:true}, {terminalAge:.6}), 'death_tumble');
  assert.equal(selectChikunAnimation({terminal:true}, {terminalAge:3}), 'death_fall');
  assert.equal(sampleChikunFrame('death_fall',100).frame,15);
});

test('art sampling does not affect deterministic simulation, score, or replay', () => {
  const a=createChikunRuntime({seed:735,maxTicks:1000});
  const b=createChikunRuntime({seed:735,maxTicks:1000});
  while (!a.terminal) {
    const snapshot=a.snapshot();
    const flap=snapshot.chikun.y>385;
    for(let i=0;i<4;i++) {
      const before=JSON.stringify(snapshot);
      sampleChikunFrame(selectChikunAnimation(snapshot), snapshot.tick/60+i/240);
      chikunSkyState(snapshot.tick/60);
      assert.equal(JSON.stringify(snapshot),before);
    }
    a.step({flap});b.step({flap});
  }
  assert.deepEqual(a.result(),b.result());
});

test('day/night cycle wraps without discontinuities and reduced motion freezes ambience', () => {
  assert.deepEqual(chikunSkyState(0),chikunSkyState(180));
  assert.deepEqual(chikunSkyState(15,true),chikunSkyState(100,true));
  for(let t=0;t<=180;t+=.5) {
    const s=chikunSkyState(t);
    assert.ok(s.night>=0 && s.night<=1);
    assert.ok(s.day>=0 && s.day<=1);
    assert.ok(s.top.every(Number.isFinite));
  }
  assert.notDeepEqual(chikunSkyState(0),chikunSkyState(90));
});

test('all shipped clips are genuine distinct native frames within the payload budget', () => {
  const base=new URL('../apps/portal/assets/generated/chikun-flight-v1/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('character.json',base),'utf8'));
  assert.equal(manifest.clips.length,30);
  assert.equal(manifest.bones.length,15);
  assert.ok(manifest.triangles<=60000);
  assert.ok(manifest.runtimeBytes<4*1024*1024);
  for(const clip of manifest.clips) {
    assert.ok(CHIKUN_CLIPS[clip.name]);
    assert.ok(clip.uniqueFrames>=12);
    assert.equal(createHash('sha256').update(readFileSync(new URL(clip.sheet,base))).digest('hex'),clip.sha256);
  }
});
