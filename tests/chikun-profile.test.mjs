import test from 'node:test';import assert from 'node:assert/strict';
import {buildChikunProfile,chikunAchievements} from '../apps/portal/src/chikun-profile.mjs';
const row=(id,extras={})=>({sessionId:id,gameId:'chikun',wallet:'0xabc',mode:'ranked',score:50,runStats:{evidenceVersion:'chikun-flap-evidence-v6',coinsCollected:3,survivalTicks:120,survivalTime:2,...extras}});
test('profile isolates wallets, games, practice and historical physics before aggregating',()=>{
 const rows={a:row('a'),b:row('a'),c:{...row('c'),wallet:'0xdef'},d:{...row('d'),gameId:'stacked'},e:{...row('e'),mode:'free'},f:row('f',{evidenceVersion:'chikun-flap-evidence-v2'})};
 const profile=buildChikunProfile(rows,'0xABC');assert.equal(profile.runs,1);assert.equal(profile.coins,3);assert.equal(profile.historicalRuns,1);assert.equal(profile.forks,null);assert.equal(profile.awards,2);
});
test('achievements use recorded thresholds and missing progress remains unknown',()=>{
 const awards=chikunAchievements({coinsCollected:2});assert.equal(awards[1].progress,2/3);assert.equal(awards[1].unlocked,false);assert.equal(awards[0].progress,null);
});
