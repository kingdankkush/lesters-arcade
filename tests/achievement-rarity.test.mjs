import assert from 'node:assert/strict';
import test from 'node:test';
const load=()=>import('../apps/portal/src/achievements/rarity.mjs');

test('empty and small per-game Ranked cohorts show Early without a percentage',async()=>{
 const {achievementRarity}=await load();
 for(const [unlockedPlayers,rankedPlayers]of[[0,0],[0,19],[19,19]])assert.deepEqual(achievementRarity({unlockedPlayers,rankedPlayers}),{rarity:'early',label:'Early',percentage:null});
});
test('the twentieth Ranked player enables percentages using this game denominator',async()=>{
 const {achievementRarity}=await load();
 assert.deepEqual(achievementRarity({unlockedPlayers:1,rankedPlayers:20}),{rarity:'rare',label:'Rare',percentage:5});
 assert.deepEqual(achievementRarity({unlockedPlayers:1,rankedPlayers:100}),{rarity:'epic',label:'Epic',percentage:1});
});
test('Common and Uncommon include their exact 50 and 20 percent boundaries',async()=>{
 const {achievementRarity}=await load();
 for(const [u,n,key]of[[20,20,'common'],[50,100,'common'],[49,100,'uncommon'],[20,100,'uncommon'],[19,100,'rare']])assert.equal(achievementRarity({unlockedPlayers:u,rankedPlayers:n}).rarity,key);
});
test('Rare and Epic include their exact 5 and 1 percent boundaries',async()=>{
 const {achievementRarity}=await load();
 for(const [u,n,key]of[[5,100,'rare'],[4,100,'epic'],[1,100,'epic'],[1,101,'legendary'],[0,100,'legendary']])assert.equal(achievementRarity({unlockedPlayers:u,rankedPlayers:n}).rarity,key);
 assert.equal(achievementRarity({unlockedPlayers:1,rankedPlayers:101}).percentage,100/101);
});
test('integer counts remain exact at the database count limit',async()=>{
 const {achievementRarity}=await load();
 assert.equal(achievementRarity({unlockedPlayers:2147483647,rankedPlayers:2147483647}).percentage,100);
 assert.equal(achievementRarity({unlockedPlayers:21474836,rankedPlayers:2147483647}).rarity,'legendary');
 assert.equal(achievementRarity({unlockedPlayers:21474837,rankedPlayers:2147483647}).rarity,'epic');
});
test('missing, coerced, fractional and unbounded counts cannot become fabricated rarity',async()=>{
 const {achievementRarity}=await load();
 for(const bad of[undefined,null,'1',-1,.5,NaN,Infinity,2147483648,Number.MAX_SAFE_INTEGER]){
  assert.throws(()=>achievementRarity({unlockedPlayers:bad,rankedPlayers:100}),TypeError);
  assert.throws(()=>achievementRarity({unlockedPlayers:0,rankedPlayers:bad}),TypeError);
 }
});
test('the unlocked cohort cannot exceed the eligible Ranked cohort',async()=>{
 const {achievementRarity}=await load();
 assert.throws(()=>achievementRarity({unlockedPlayers:1,rankedPlayers:0}),TypeError);
 assert.throws(()=>achievementRarity({unlockedPlayers:21,rankedPlayers:20}),TypeError);
});
test('rarity calculation does not mutate or freeze its caller data',async()=>{
 const {achievementRarity}=await load(),input={unlockedPlayers:7,rankedPlayers:100},before=structuredClone(input);
 const first=achievementRarity(input);assert.deepEqual(input,before);assert.equal(Object.isFrozen(input),false);
 assert.deepEqual(achievementRarity(input),first);input.unlockedPlayers=20;assert.equal(achievementRarity(input).rarity,'uncommon');
});
