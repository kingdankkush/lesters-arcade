import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCombatAudio} from '../apps/hmh-reboot/src/combat-audio.mjs';
import {HMH_SFX_CUE_REGISTRY} from '../apps/portal/src/hmh-audio-system.mjs';
class Sample {constructor(src){this.src=src;this.ended=false;}play(){return Promise.resolve();}pause(){this.paused=true;}}
for(const cue of ['silver-collect','objective-complete','supply-ready'])test(`${cue} reaches audible sample playback with bounded repetition and pause cleanup`,()=>{
  const audio=createCombatAudio({AudioCtor:Sample,maxVoices:2});
  assert.equal(audio.play(cue,{now:100,volume:.12}).played,true);
  assert.equal(audio.play(cue,{now:101,volume:.12}).reason,'cooldown');
  assert.equal(HMH_SFX_CUE_REGISTRY[cue].family,'reward');
  audio.pause();assert.equal(audio.status().activeVoices,0);
  assert.equal(audio.play(cue,{now:2000}).reason,'paused');audio.destroy();
});
test('objective sound samples are original, finite, click-free, and bound to their recipe',()=>{
  const root=new URL('../',import.meta.url),dir=new URL('apps/portal/assets/audio/sfx/',root);
  const manifest=JSON.parse(readFileSync(new URL('hmh-objective-cues.json',dir)));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(hash(readFileSync(new URL(manifest.recipe,root))),manifest.recipeSha256);
  for(const cue of manifest.cues){
    const bytes=readFileSync(new URL(cue.file,dir));
    assert.equal(hash(bytes),cue.sha256);
    assert.ok(cue.peak>0.2&&cue.peak<0.5);
    assert.ok(cue.durationSeconds<.8);
    assert.equal(bytes.readInt16LE(44),0);
    assert.equal(bytes.readInt16LE(bytes.length-2),0);
  }
});
