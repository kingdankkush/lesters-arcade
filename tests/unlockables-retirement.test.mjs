import test from 'node:test';
import assert from 'node:assert/strict';
import {UNLOCKABLES,unlockState,emptyUnlocks,childCosmeticsFor} from '../apps/portal/src/unlockables.mjs';
const load=()=>import('../apps/portal/src/unlockables-retirement.mjs');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('retirement inventory matches exactly the 25 old cosmetics and excludes both heroes',async()=>{
 const {RETIRED_COSMETICS_2_0}=await load();
 assert.equal(RETIRED_COSMETICS_2_0.length,25);
 assert.deepEqual(RETIRED_COSMETICS_2_0.map(r=>[r.gameId,r.slot,r.id]).sort(),UNLOCKABLES.filter(r=>r.kind!=='character').map(r=>[r.gameId,r.kind,r.id]).sort());
 assert.deepEqual(['lester-blaster','chikun','stacked'].map(g=>RETIRED_COSMETICS_2_0.filter(r=>r.gameId===g).length),[8,10,7]);
 assert.ok(Object.isFrozen(RETIRED_COSMETICS_2_0)&&RETIRED_COSMETICS_2_0.every(Object.isFrozen));
});
test('every retired selection plans a default fallback without changing the input or current catalog',async()=>{
 const {RETIRED_COSMETICS_2_0,planCosmeticRetirement}=await load();
 for(const row of RETIRED_COSMETICS_2_0){
  const input=freeze({cosmetics:{[row.gameId]:{[row.slot]:row.id}}});
  const result=planCosmeticRetirement(input);
  assert.deepEqual(result.preferences,{cosmetics:{}});assert.equal(result.changed,true);assert.deepEqual(result.removed,[row]);
  assert.equal(input.cosmetics[row.gameId][row.slot],row.id);
  assert.ok(UNLOCKABLES.some(r=>r.id===row.id&&r.artStatus==='ready'));
 }
});
test('Lester and Lilly selections and earned history survive without granting or revoking their gates',async()=>{
 const {planCosmeticRetirement}=await load();
 for(const selectedCharacterId of ['lester-original','lilly']){
  const preferences=freeze({selectedCharacterId,nameClaimDismissed:true,cosmetics:{chikun:{hat:'chikun-hat-cap'}}});
  const history=freeze({achievementIds:['chikun-first-flight'],confirmedRuns:{'lester-blaster':10}});
  const before=JSON.stringify(history);const result=planCosmeticRetirement(preferences);
  assert.equal(result.preferences.selectedCharacterId,selectedCharacterId);assert.equal(result.preferences.nameClaimDismissed,true);
  assert.equal(JSON.stringify(history),before);
 }
 const unlocks=emptyUnlocks();unlocks.confirmedRuns['lester-blaster']=10;
 for(const hero of UNLOCKABLES.filter(r=>r.kind==='character'))assert.equal(unlockState(hero,unlocks).unlocked,true);
});
test('unrelated and future preference fields are preserved in a detached copy',async()=>{
 const {planCosmeticRetirement}=await load();
 const input=freeze({selectedCharacterId:'lilly',audio:{volume:.4,mutes:[false,true]},cosmetics:{chikun:{hat:'chikun-hat-cap',trail:'future-authored-trail'},stacked:{scene:'future-space-scene'}},showcase:['one','two']});
 const result=planCosmeticRetirement(input);
 assert.deepEqual(result.preferences,{selectedCharacterId:'lilly',audio:{volume:.4,mutes:[false,true]},cosmetics:{chikun:{trail:'future-authored-trail'},stacked:{scene:'future-space-scene'}},showcase:['one','two']});
 result.preferences.audio.mutes[0]=true;result.preferences.showcase.push('three');
 assert.equal(input.audio.mutes[0],false);assert.equal(input.showcase.length,2);
});
test('matching is exact by cabinet, slot and ID; future IDs are not normalized away',async()=>{
 const {planCosmeticRetirement}=await load();
 const input={cosmetics:{chikun:{hat:'chikun-hat-cap-v2',trail:'chikun-hat-cap',coat:'CHIKUN-COAT-GOLDEN'},stacked:{hat:'chikun-hat-cap'},future:{hat:'chikun-hat-cap'}}};
 const result=planCosmeticRetirement(input);assert.deepEqual(result.preferences,input);assert.equal(result.changed,false);assert.deepEqual(result.removed,[]);
});
test('all seven legacy slots clear explicitly and repeated planning is idempotent',async()=>{
 const {planCosmeticRetirement}=await load();
 const input={selectedCharacterId:'lilly',cosmetics:{'lester-blaster':{'hero-skin':'hmh-hero-gold','weapon-skin':'hmh-weapon-veteran'},chikun:{coat:'chikun-coat-golden',trail:'chikun-trail-ember',hat:'chikun-hat-crown'},stacked:{'piece-skin':'stacked-pieces-gold',scene:'stacked-scene-forge'}}};
 const first=planCosmeticRetirement(input),again=planCosmeticRetirement(first.preferences);
 assert.equal(first.removed.length,7);assert.deepEqual(first.preferences,{selectedCharacterId:'lilly',cosmetics:{}});
 assert.deepEqual(again.preferences,first.preferences);assert.equal(again.changed,false);assert.deepEqual(again.removed,[]);
 for(const gameId of ['lester-blaster','chikun','stacked'])assert.ok(Object.values(childCosmeticsFor(gameId,first.preferences.cosmetics,emptyUnlocks())).every(v=>v===null));
});
test('absent cosmetics and already empty objects remain unchanged',async()=>{
 const {planCosmeticRetirement}=await load();
 for(const input of [{},{selectedCharacterId:'lester-original'},{cosmetics:{}},{cosmetics:{chikun:{}}}]){
  const result=planCosmeticRetirement(input);assert.deepEqual(result.preferences,input);assert.equal(result.changed,false);assert.deepEqual(result.removed,[]);
 }
});
test('retiring one game does not clean up unrelated empty or malformed game records',async()=>{
 const {planCosmeticRetirement}=await load();
 const input=freeze({cosmetics:{chikun:{hat:'chikun-hat-cap'},future:{},stacked:[],another:null}});
 const result=planCosmeticRetirement(input);
 assert.deepEqual(result.preferences,{cosmetics:{future:{},stacked:[],another:null}});
 assert.equal(result.changed,true);assert.equal(result.removed.length,1);
});
test('invalid preference containers fail without manufacturing a replacement',async()=>{
 const {planCosmeticRetirement}=await load();
 for(const input of [null,undefined,[],true,'',42,new Date(),new Map()])assert.throws(()=>planCosmeticRetirement(input),TypeError);
 for(const cosmetics of [null,[],false,'invalid']){
  const input={cosmetics};assert.deepEqual(planCosmeticRetirement(input),{preferences:input,changed:false,removed:[]});
 }
});
test('JSON special property names stay own data without changing object prototypes',async()=>{
 const {planCosmeticRetirement}=await load();
 const input=JSON.parse('{"__proto__":{"polluted":true},"cosmetics":{"chikun":{"hat":"chikun-hat-cap","__proto__":"future"}}}');
 const result=planCosmeticRetirement(input);
 assert.equal({}.polluted,undefined);assert.equal(Object.getPrototypeOf(result.preferences),Object.prototype);
 assert.equal(Object.hasOwn(result.preferences,'__proto__'),true);assert.deepEqual(result.preferences.__proto__,{polluted:true});
 assert.deepEqual(result.preferences.cosmetics.chikun,JSON.parse('{"__proto__":"future"}'));
});
