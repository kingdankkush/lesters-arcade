import test from 'node:test';
import assert from 'node:assert/strict';
import { CHIKUN_CLIPS, CHIKUN_FLOURISHES, milestoneFlourish, selectChikunAnimation, createChikunCharacter } from '../apps/chikun/src/character.mjs';

test('milestones rotate through four full-turn flourishes without changing the flight state', () => {
  assert.deepEqual([5,10,15,20,25].map(milestoneFlourish), ['barrel_roll','reverse_roll','corkscrew','victory_twirl','barrel_roll']);
  const state={tick:300,chikun:{x:280,y:360,velocityY:-2}};
  const before=structuredClone(state);
  for(const event of CHIKUN_FLOURISHES) {
    assert.ok(CHIKUN_CLIPS[event]);
    assert.equal(selectChikunAnimation(state,{event,eventAge:.7,flapAge:.01}),event);
    assert.notEqual(selectChikunAnimation(state,{event,eventAge:.81}),event);
  }
  assert.deepEqual(state,before);
});

test('a completed run celebrates, while impact always interrupts a flourish', () => {
  assert.equal(selectChikunAnimation({terminal:true,terminalReason:'run-complete'},{terminalAge:.3}),'victory_twirl');
  for(const event of CHIKUN_FLOURISHES) {
    assert.equal(selectChikunAnimation({terminal:true,terminalReason:'fork'},{event,eventAge:.1,terminalAge:.1}),'impact');
  }
});

test('character downloads report complete failure and recover with an explicit retry', async () => {
  const originals={Image:globalThis.Image,document:globalThis.document};
  let fail=true;
  globalThis.Image=class {naturalWidth=0;async decode(){if(fail)throw new Error('offline');this.naturalWidth=768;}};
  globalThis.document={createElement:()=>({getContext:()=>({})})};
  try {
    const character=createChikunCharacter();
    assert.equal(await character.ready,false);
    assert.equal(character.renderable,false);
    assert.equal(character.complete,false);
    fail=false;
    assert.equal(await character.retry(),true);
    assert.equal(character.loaded,31);
    assert.equal(character.complete,true);
    character.dispose();
  } finally {Object.assign(globalThis,originals);}
});
