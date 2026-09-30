import assert from 'node:assert/strict';
import test from 'node:test';
import {catalogFor} from '../apps/portal/src/achievements/index.mjs';
import {createPgliteClient,seedVerifiedSession,seedAchievementUnlock,seedWalletProfile} from './helpers/pglite-client.mjs';
const load=()=>import('../server/neon/achievement-stats.mjs');
const W=n=>'0x'+String(n).padStart(2,'0').repeat(20);
const ids=catalogFor('chikun').filter(entry=>entry.available).slice(0,3).map(entry=>entry.id);

test('rarity counts distinct per-game verified wallets across queue states and seasons, excluding board and mismatched records',async()=>{
 const {readAchievementStats}=await load(),db=createPgliteClient();
 try{
  const a=await seedVerifiedSession(db,{wallet:W(1)});
  await seedVerifiedSession(db,{wallet:W(1)});
  const b=await seedVerifiedSession(db,{wallet:W(2),status:'pending'});
  const excluded=await seedVerifiedSession(db,{wallet:W(3)});
  await seedWalletProfile(db,{wallet:W(3),boardExcluded:true});
  const hidden=await seedVerifiedSession(db,{wallet:W(4),status:'failed',seasonId:'chikun-old-season'});
  await seedWalletProfile(db,{wallet:W(4),hidden:true});
  const other=await seedVerifiedSession(db,{wallet:W(9),gameId:'stacked'});
  const sameWalletOther=await seedVerifiedSession(db,{wallet:W(1),gameId:'stacked'});
  const mismatch=await seedVerifiedSession(db,{wallet:W(5),chainMismatch:true});
  for(const [wallet,session,id]of[[W(1),a,ids[0]],[W(2),b,ids[0]],[W(3),excluded,ids[0]],[W(4),hidden,ids[1]],[W(5),mismatch,ids[0]],[W(2),a,ids[1]],[W(9),other,ids[2]],[W(1),sameWalletOther,ids[2]],[W(1),a,'retired-unknown-badge']])await seedAchievementUnlock(db,{wallet,gameId:'chikun',sessionId32:session.sessionId32,achievementId:id});
  const result=await readAchievementStats(db,{gameId:'chikun'});
  assert.equal(result.rankedPlayers,3,'multiple runs do not enlarge the cohort; hidden eligible players count; other games and board/mismatch records do not');
  const counts=new Map(result.achievements.map(row=>[row.id,row.unlockedPlayers]));
  assert.equal(counts.get(ids[0]),2,'verified pending publication still has server-earned progress');
  assert.equal(counts.get(ids[1]),1,'wrong earning-wallet row cannot count');
  assert.equal(counts.get(ids[2]),0,'even an eligible wallet cannot use its other game earning-session');
  assert.equal(counts.has('retired-unknown-badge'),false);
  assert.equal(result.achievements.length,40);
  assert.ok(result.achievements.every(row=>row.rarity==='early'&&row.percentage===null));
  const json=JSON.stringify(result);for(const n of[1,2,3,4,5,9])assert.equal(json.includes(W(n)),false,'the public snapshot contains no wallets');
 }finally{await db.close();}
});
test('the aggregate rejects an unknown game before touching the database',async()=>{
 const {readAchievementStats}=await load();let calls=0;
 await assert.rejects(readAchievementStats({query:async()=>{calls++;throw new Error('query must not run');}},{gameId:'chikun; DROP TABLE verified_sessions'}),TypeError);
 assert.equal(calls,0);
});
test('malformed aggregate driver counts fail rather than showing fabricated zero rarity',async()=>{
 const {readAchievementStats}=await load();
 for(const row of[{ranked_players:'20',counts:'[]'},{ranked_players:20,counts:'not-json'},{ranked_players:20,counts:JSON.stringify([{achievement_id:ids[0],unlocked_players:21}])}])await assert.rejects(readAchievementStats({query:async()=>[row]},{gameId:'chikun'}));
});
