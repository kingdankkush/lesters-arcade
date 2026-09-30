import test from 'node:test';
import assert from 'node:assert/strict';
const switches=await import('../apps/portal/src/stacked-presentation-switch.mjs').catch(()=>({}));
const loader=await import('../apps/stacked/src/render/living-journey-loader.mjs').catch(()=>({}));
const suffix=search=>{assert.equal(typeof switches.stackedJourneySuffix,'function');return switches.stackedJourneySuffix(search);};
const load=(search,options)=>{assert.equal(typeof loader.loadLivingJourneyFactory,'function');return loader.loadLivingJourneyFactory(search,options);};
test('only one exact allowed journey switch crosses the cabinet boundary',()=>{
  assert.equal(suffix('?livingJourney=living-v1'),'?livingJourney=living-v1');
  assert.equal(suffix('?unrelated=1&livingJourney=living-v1'),'?livingJourney=living-v1');
});
test('default journey is enabled while unsupported and duplicate switches explicitly opt out',()=>{
  assert.equal(suffix(''),'?livingJourney=living-v1');
  for(const search of['?livingJourney=on','?livingJourney=LIVING-V1','?livingJourney=living-v1&livingJourney=living-v1','?livingJourney=living-v1&livingJourney=bad'])assert.equal(suffix(search),'?livingJourney=off');
});
test('unrequested journey loads no module and valid request yields only a presentation factory',async()=>{
  let calls=0;const factory=()=>{};const options={load:async()=>{calls++;return{createLivingJourneyView:factory};}};
  assert.deepEqual(await load('?livingJourney=off',options),{factory:null,status:'off'});assert.equal(calls,0);
  assert.deepEqual(await load('?livingJourney=living-v1',options),{factory,status:'ready'});assert.equal(calls,1);
});
test('a failed or invalid optional module preserves ordinary effects',async()=>{
  for(const download of[async()=>{throw new Error('download failed');},async()=>({createLivingJourneyView:null})])assert.deepEqual(await load('?livingJourney=living-v1',{load:download}),{factory:null,status:'fallback'});
});
test('an already closed cabinet never starts the optional download',async()=>{
  let calls=0;const result=await load('?livingJourney=living-v1',{isDisposed:()=>true,load:async()=>{calls++;return{};}});
  assert.deepEqual(result,{factory:null,status:'disposed'});assert.equal(calls,0);
});
test('download completion after cabinet closure yields no factory, including a late rejection',async()=>{
  for(const reject of[false,true]){let disposed=false,release;const promise=load('?livingJourney=living-v1',{isDisposed:()=>disposed,load:()=>new Promise((resolve,fail)=>{release=()=>reject?fail(new Error('late download failure')):resolve({createLivingJourneyView:()=>{throw new Error('late construction');}});})});disposed=true;release();assert.deepEqual(await promise,{factory:null,status:'disposed'});}
});

const construct=(factory,args,options)=>{assert.equal(typeof loader.createPresentationAtmosphere,'function');return loader.createPresentationAtmosphere(factory,args,options);};
test('successful visual construction never instantiates fallback effects',()=>{
  const args={layer:{}},value={},fallback=()=>{throw new Error('unnecessary fallback');};assert.equal(construct(actual=>{assert.equal(actual,args);return value;},args,{fallback}),value);
});
test('optional constructor failure instantiates ordinary effects once and reports the fallback',()=>{
  const args={layer:{}},failure=new Error('optional GPU failure'),value={};let calls=0,observed;const actual=construct(()=>{throw failure;},args,{fallback:input=>{assert.equal(input,args);calls++;return value;},onFallback:error=>{observed=error;}});assert.equal(actual,value);assert.equal(calls,1);assert.equal(observed,failure);
});
test('ordinary renderer construction failures retain their original error and are not retried',()=>{
  const error=new Error('WebGL unavailable');let calls=0;const fallback=()=>{calls++;throw error;};assert.throws(()=>construct(fallback,{}, {fallback}),actual=>actual===error);assert.equal(calls,1);
});
