import assert from 'node:assert/strict';
import test from 'node:test';
import {ACHIEVEMENT_GAME_IDS,catalogFor} from '../apps/portal/src/achievements/index.mjs';
const load=()=>import('../apps/portal/src/achievements/collection-model.mjs');
const first=gameId=>catalogFor(gameId).find(entry=>entry.available);
const unlock=(gameId,id=first(gameId).id,unlockedAt='2026-09-29T12:00:00.000Z')=>Object.freeze({gameId,id,unlockedAt});
function population(gameId,rankedPlayers,counts={}) {
 return Object.freeze({ok:true,gameId,cohort:'verified-ranked-all-time',minimumPlayers:20,rankedPlayers,
  achievements:Object.freeze(catalogFor(gameId).filter(entry=>entry.available).map(entry=>Object.freeze({id:entry.id,unlockedPlayers:counts[entry.id]??0,rarity:'forged',percentage:99}))) });
}

test('collection measures the available catalog per cabinet without awarding progress',async()=>{
 const {buildAchievementCollection}=await load();
 const model=buildAchievementCollection();
 assert.equal(model.rows.length,124);assert.equal(model.unlocked,0);assert.equal(model.total,124);assert.equal(model.rarest,null);
 assert.deepEqual(model.games.map(game=>[game.gameId,game.total,game.unlocked]),[['lester-blaster',44,0],['chikun',40,0],['stacked',40,0]]);
 assert.equal(model.trophies.total,13);assert.equal(model.trophies.unlocked,0);
 assert.ok(model.rows.every(row=>!row.unlocked&&row.rarity===null&&row.unlockedAt===null));
});

test('verified unlock rows are unique, cabinet-bound and never mutate earned history',async()=>{
 const {buildAchievementCollection}=await load();
 const retired=catalogFor('lester-blaster').find(entry=>!entry.available);
 const records=Object.freeze([unlock('chikun'),unlock('chikun'),unlock('stacked',first('chikun').id),unlock('lester-blaster',retired.id),unlock('chikun','<script>'),unlock('unknown','unknown')]);
 const before=JSON.stringify(records),model=buildAchievementCollection({unlocks:records});
 assert.equal(model.unlocked,1);assert.equal(model.rows.filter(row=>row.unlocked).length,1);assert.equal(JSON.stringify(records),before);
 assert.equal(model.games.find(game=>game.gameId==='chikun').unlocked,1);assert.equal(model.games.find(game=>game.gameId==='stacked').unlocked,0);
});

test('rarity uses validated per-game population counts rather than response labels or another game',async()=>{
 const {buildAchievementCollection}=await load();
 const snapshots=Object.freeze({chikun:population('chikun',100,{[first('chikun').id]:20}),stacked:population('stacked',20,{[first('stacked').id]:10})});
 const before=JSON.stringify(snapshots),model=buildAchievementCollection({unlocks:[unlock('chikun'),unlock('stacked')],statsByGame:snapshots});
 assert.equal(model.rows.find(row=>row.id===first('chikun').id).rarity.label,'Uncommon');
 assert.equal(model.rows.find(row=>row.id===first('stacked').id).rarity.label,'Common');
 assert.equal(model.rarest.gameId,'chikun');assert.equal(model.rarest.rarity.percentage,20);assert.equal(JSON.stringify(snapshots),before);
});

test('malformed population snapshots stay unavailable without revoking verified unlocks',async()=>{
 const {buildAchievementCollection}=await load();
 const valid=population('chikun',100,{[first('chikun').id]:1});
 const bad=[{...valid,gameId:'stacked'},{...valid,cohort:'local-preview'},{...valid,minimumPlayers:0},{...valid,rankedPlayers:'100'},
  {...valid,achievements:[...valid.achievements,valid.achievements[0]]},{...valid,achievements:valid.achievements.slice(1)},
  {...valid,achievements:valid.achievements.map((row,i)=>i===0?{...row,unlockedPlayers:101}:row)}];
 for(const snapshot of bad){const model=buildAchievementCollection({unlocks:[unlock('chikun')],statsByGame:{chikun:snapshot}});assert.equal(model.unlocked,1);assert.equal(model.rarest,null);assert.equal(model.rows.find(row=>row.unlocked).rarity,null);}
});

test('small cohorts show Early and count with no rate or invented rarest badge',async()=>{
 const {buildAchievementCollection}=await load();
 const model=buildAchievementCollection({unlocks:[unlock('chikun')],statsByGame:{chikun:population('chikun',19,{[first('chikun').id]:1})}});
 const row=model.rows.find(row=>row.unlocked);assert.equal(row.rarity.label,'Early');assert.equal(row.rarity.percentage,null);assert.equal(row.rarity.unlockedPlayers,1);assert.equal(row.rarity.rankedPlayers,19);assert.equal(model.rarest,null);
});

test('game, ownership, trophy and text filters do not change completion totals',async()=>{
 const {buildAchievementCollection}=await load(),unlocks=[unlock('chikun'),unlock('stacked')];
 const owned=buildAchievementCollection({unlocks,gameId:'chikun',filter:'unlocked'});assert.equal(owned.rows.length,1);assert.equal(owned.total,124);assert.equal(owned.unlocked,2);
 assert.equal(buildAchievementCollection({unlocks,gameId:'chikun',filter:'locked'}).rows.length,39);
 assert.equal(buildAchievementCollection({unlocks,filter:'trophies'}).rows.length,13);
 assert.equal(buildAchievementCollection({unlocks,query:'  FIRST FLIGHT  '}).rows.length,1);
 assert.equal(buildAchievementCollection({unlocks,query:'<script>'}).rows.length,0);
 for(const options of [{gameId:'unknown'},{filter:'owned-ish'},{sort:'random'}])assert.throws(()=>buildAchievementCollection(options),/collection/);
});

test('recent sorting uses valid UTC dates and stable catalog order for unknown dates',async()=>{
 const {buildAchievementCollection}=await load();
 const a=first('chikun'),b=catalogFor('chikun').find(entry=>entry.available&&entry.id!==a.id),c=first('stacked');
 const records=[unlock('chikun',a.id,'2026-09-28T12:00:00.000Z'),unlock('chikun',b.id,'not-a-date'),unlock('stacked',c.id,'2026-09-29T12:00:00.000Z')];
 const one=buildAchievementCollection({unlocks:records,sort:'recent'}),two=buildAchievementCollection({unlocks:[...records].reverse(),sort:'recent'});
 assert.deepEqual(one.rows.map(row=>row.id),two.rows.map(row=>row.id));assert.deepEqual(one.rows.slice(0,3).map(row=>row.id),[c.id,a.id,b.id]);assert.equal(one.rows[2].unlockedAt,null);
});

test('rarity ordering compares exact rates and ignores Early or missing populations',async()=>{
 const {buildAchievementCollection}=await load();
 const statsByGame={chikun:population('chikun',199,{[first('chikun').id]:1}),stacked:population('stacked',200,{[first('stacked').id]:1})};
 const model=buildAchievementCollection({unlocks:[unlock('chikun'),unlock('stacked'),unlock('lester-blaster')],statsByGame,filter:'unlocked',sort:'rarity'});
 assert.deepEqual(model.rows.map(row=>row.gameId),['stacked','chikun','lester-blaster']);assert.equal(model.rarest.gameId,'stacked');assert.equal(model.rarest.rarity.percentage,.5);
});

test('collection preview switch accepts one exact value while unrelated query data stays opaque',async()=>{
 const {achievementCollectionPreview}=await load();
 assert.equal(achievementCollectionPreview('?achievementCollection=collection-v1&seed=10'),true);
 for(const search of ['', '?achievementCollection=on','?achievementCollection=collection-v1&achievementCollection=collection-v1','?achievementCollection=collection-v1&achievementCollection=off','?other=collection-v1'])assert.equal(achievementCollectionPreview(search),false);
});
