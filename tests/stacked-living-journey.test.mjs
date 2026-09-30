import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivingJourney, LIVING_JOURNEY_SCENES } from '../apps/stacked/src/render/living-journey.mjs';

function drive(journey,{seconds=120,fps=60,...fields}={}) {
  let result;
  for(let frame=0;frame<=seconds*fps;frame+=1) result=journey.update({now:frame*1000/fps,...fields});
  return result;
}
test('automatic cosmetic deck includes Matrix and all existing worlds and scenes',()=>{
  assert.deepEqual([...LIVING_JOURNEY_SCENES].sort(),['matrix','living','aurora','orbit','spectrum','tunnel','particles','horizon'].sort());
  const journey=createLivingJourney({seed:123});const seen=new Set();
  for(let frame=0;frame<60*300;frame+=1)seen.add(journey.update({now:frame*1000/60,bpm:120}).scene);
  assert.deepEqual([...seen].sort(),[...LIVING_JOURNEY_SCENES].sort());
});
test('cosmetic seed determines a repeatable deck without global or simulation randomness',()=>{
  const original=Math.random;Math.random=()=>{throw new Error('presentation drew global random');};
  try{
    const a=createLivingJourney({seed:123}),b=createLivingJourney({seed:123}),c=createLivingJourney({seed:987});
    assert.deepEqual(a.deck,b.deck);assert.notDeepEqual(a.deck,c.deck);
    drive(a);drive(b);assert.deepEqual(a.state,b.state);assert.equal(Object.isFrozen(a.deck),true);
  }finally{Math.random=original;}
});
test('beat-driven automatic morphs continue without line clears',()=>{
  const slow=createLivingJourney({seed:10}),fast=createLivingJourney({seed:10});
  drive(slow,{seconds:80,bpm:60});drive(fast,{seconds:80,bpm:180});
  assert.ok(slow.state.transitionCount>0);assert.ok(fast.state.transitionCount>slow.state.transitionCount);
});
test('forward flight is continuous and responds smoothly to tempo and combo',()=>{
  const journey=createLivingJourney();journey.update({now:0,bpm:60});
  for(let frame=1;frame<=120;frame+=1)journey.update({now:frame*1000/60,bpm:60});
  const before={...journey.state};journey.update({now:2017,bpm:200,combo:8});
  assert.ok(journey.state.distance>before.distance);
  assert.ok(journey.state.bpm>before.bpm&&journey.state.bpm<200);
  assert.ok(journey.state.speed>before.speed&&journey.state.speed-before.speed<1);
});
test('a Halving requests one early portal and repeated snapshots do not retrigger it',()=>{
  const journey=createLivingJourney();drive(journey,{seconds:3,bpm:120,lines:0});
  const before=journey.state.transitionCount;
  const first=journey.update({now:3017,bpm:120,lines:4});
  assert.equal(first.transitionCount,before+1);assert.equal(first.phase,'portal');assert.equal(first.reason,'halving');
  for(let frame=1;frame<240;frame+=1)journey.update({now:3017+frame*1000/60,bpm:120,lines:4});
  assert.equal(journey.state.transitionCount,before+1);
});
test('a rising large combo can trigger a portal, a sustained combo cannot spam it',()=>{
  const journey=createLivingJourney();drive(journey,{seconds:3,combo:0});
  journey.update({now:3017,combo:4});assert.equal(journey.state.reason,'combo');
  const count=journey.state.transitionCount;
  for(let frame=1;frame<240;frame+=1)journey.update({now:3017+frame*1000/60,combo:4});
  assert.equal(journey.state.transitionCount,count);
});
test('portal mix and radius grow continuously and finish in the next scene',()=>{
  const journey=createLivingJourney();drive(journey,{seconds:3,lines:0});journey.update({now:3017,lines:4});
  const destination=journey.state.to;let previousMix=journey.state.mix,previousRadius=journey.state.portalRadius;
  for(let frame=1;frame<=180;frame+=1){const state=journey.update({now:3017+frame*1000/60,lines:4});assert.ok(state.mix>=previousMix&&state.mix<=1);assert.ok(state.portalRadius>=previousRadius);previousMix=state.mix;previousRadius=state.portalRadius;}
  assert.equal(journey.state.scene,destination);assert.equal(journey.state.mix,1);assert.equal(journey.state.phase,'ambient');
});
test('reduced motion holds flight and deck still, including during an active portal',()=>{
  const journey=createLivingJourney();drive(journey,{seconds:3,lines:0});journey.update({now:3017,lines:4});
  const before={...journey.state};
  for(let frame=1;frame<600;frame+=1)journey.update({now:3017+frame*1000/60,lines:8,combo:9,bpm:200,reducedMotion:true});
  for(const key of ['distance','mix','portalRadius','from','to','scene','transitionCount'])assert.equal(journey.state[key],before[key],key);
  assert.equal(journey.state.phase,'still');
  journey.update({now:13017,lines:8,combo:9,reducedMotion:false});assert.ok(journey.state.distance-before.distance<3);
});
test('rewound and invalid clocks do not rewind flight or create a catch-up burst',()=>{
  const journey=createLivingJourney();journey.update({now:1000});journey.update({now:1017});const distance=journey.state.distance;
  journey.update({now:900});assert.equal(journey.state.distance,distance);
  journey.update({now:NaN});assert.equal(journey.state.distance,distance);
  journey.update({now:61017});assert.ok(journey.state.distance-distance<3);
});
test('feedback and beat changes do not produce brightness flashes; danger dims smoothly',()=>{
  const journey=createLivingJourney();journey.update({now:0});const light=journey.state.brightness;
  for(let frame=1;frame<180;frame+=1){const state=journey.update({now:frame*1000/60,bpm:frame%2?60:200,combo:frame%9,lines:frame});assert.equal(state.brightness,light);assert.ok(state.brightness<=.18);}
  journey.update({now:3000,danger:1});assert.ok(journey.state.brightness<light&&journey.state.brightness>light*.4);
});
test('long presentation updates reuse one bounded state and preserve input objects',()=>{
  const journey=createLivingJourney();const fields=Object.freeze({now:0,bpm:120,lines:0,combo:0,danger:0,reducedMotion:false});
  const state=journey.update(fields),deck=journey.deck;
  for(let frame=1;frame<=60000;frame+=1){assert.equal(journey.update({now:frame*1000/60,bpm:120}),state);assert.equal(journey.deck,deck);}
  for(const key of ['distance','bpm','speed','mix','portalRadius','brightness'])assert.ok(Number.isFinite(state[key]),key);
  assert.equal(fields.now,0);
});
