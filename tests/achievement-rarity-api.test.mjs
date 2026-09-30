import assert from 'node:assert/strict';
import test from 'node:test';
import {createPgliteClient,seedVerifiedSession,seedAchievementUnlock} from './helpers/pglite-client.mjs';
import {invoke} from './helpers/fake-http.mjs';
const load=()=>import('../api/achievements/stats.mjs');
const NOW=Date.parse('2026-09-29T22:00:00.000Z');
test('the real public stats adapter initializes an empty index and caches only aggregate success',async()=>{
 const api=await load(),db=createPgliteClient();
 try{
  const handler=api.createHandler(()=>api.buildDeps({VERCEL_ENV:'development'},{db,nowMs:NOW}));
  const empty=await invoke(handler,{url:'/api/achievements/stats?game=chikun'});
  assert.equal(empty.status,200,JSON.stringify(empty.body));assert.equal(empty.body.ok,true);assert.equal(empty.body.gameId,'chikun');assert.equal(empty.body.rankedPlayers,0);assert.equal(empty.body.minimumPlayers,20);assert.equal(empty.body.cohort,'verified-ranked-all-time');assert.equal(empty.body.generatedAt,new Date(NOW).toISOString());
  assert.equal(empty.headers['cache-control'],'public, s-maxage=300, stale-while-revalidate=300');
  assert.equal(empty.body.achievements.length,40);assert.ok(empty.body.achievements.every(row=>row.unlockedPlayers===0&&row.rarity==='early'&&row.percentage===null));
  const run=await seedVerifiedSession(db,{status:'pending'});await seedAchievementUnlock(db,{sessionId32:run.sessionId32});
  const response=await invoke(handler,{url:'/api/achievements/stats?game=chikun'});assert.equal(response.body.rankedPlayers,1);assert.equal(response.body.achievements.find(row=>row.id==='chikun-first-flight').unlockedPlayers,1);
  const alias=await invoke(handler,{url:'/api/achievements/stats?game=hard-money-heroes'});assert.equal(alias.status,200);assert.equal(alias.body.gameId,'lester-blaster');assert.equal(alias.body.achievements.length,44);
 }finally{await db.close();}
});
test('bad methods, games, undeclared and conflicting query parameters never read the index',async()=>{
 const api=await load();let queries=0;const handler=api.createHandler(()=>api.buildDeps({VERCEL_ENV:'development'},{db:{query:async()=>{queries++;throw new Error('must not query');}},nowMs:NOW}));
 for(const [request,status,error]of[[{url:'/api/achievements/stats'},400,'invalid-game'],[{url:'/api/achievements/stats?game=tetris'},400,'invalid-game'],[{url:'/api/achievements/stats?game=chikun&wallet=0x1234'},400,'invalid-query'],[{url:'/api/achievements/stats?game=chikun&cb=1'},400,'invalid-query'],[{url:'/api/achievements/stats?game=chikun&game=stacked'},400,'invalid-query'],[{method:'POST',url:'/api/achievements/stats?game=chikun'},405,'method-not-allowed']]){
  const response=await invoke(handler,request);assert.equal(response.status,status);assert.equal(response.body.error,error);assert.equal(response.headers['cache-control'],'no-store');
 }
 assert.equal(queries,0);
});
test('an unavailable index remains unavailable rather than reporting no earners',async()=>{
 const api=await load(),handler=api.createHandler(()=>api.buildDeps({VERCEL_ENV:'development'},{db:null,nowMs:NOW}));
 const response=await invoke(handler,{url:'/api/achievements/stats?game=stacked'});assert.deepEqual([response.status,response.body.error,response.headers['cache-control']],[503,'index-not-configured','no-store']);
});
