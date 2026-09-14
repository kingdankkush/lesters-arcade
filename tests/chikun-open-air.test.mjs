import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChikunRuntime,replayChikunRun,simulateChikunRun,verifyChikunReplayClaim,buildChikunReplayClaim} from '../apps/portal/src/chikun-cabinet.mjs';
import {createChikunReplayPlayback} from '../apps/chikun/src/replay-viewer.mjs';
import {buildChikunObstacle, obstacleClearance} from '../apps/portal/src/chikun-obstacles.mjs';

test('trees and drones are independent obstacles with open air around their silhouettes',()=>{
 const tree=buildChikunObstacle({seed:1,index:1,tick:0,x:500,safeGapHeight:320});
 const drone=buildChikunObstacle({seed:1,index:2,tick:0,x:800,safeGapHeight:320});
 assert.equal(tree.kind,'tree');assert.equal(drone.kind,'drone');
 assert.ok(obstacleClearance(tree,tree.x+tree.width/2,80,30)>0,'air above tree is safe');
 assert.ok(obstacleClearance(tree,tree.x+tree.width/2,670,30)<0,'trunk is solid');
 assert.ok(obstacleClearance(drone,drone.x+drone.width/2,drone.y-100,30)>0,'above drone is safe');
 assert.ok(obstacleClearance(drone,drone.x+drone.width/2,drone.y+100,30)>0,'below drone is safe');
 assert.ok(obstacleClearance(drone,drone.x+drone.width/2,drone.y,30)<0,'drone body is solid');
 assert.ok(tree.shapes.every(s=>s.type!=='rect'));assert.ok(drone.shapes.every(s=>s.type!=='rect'));
});
test('new course emits versioned evidence and moving drones replay deterministically',()=>{
 const run=simulateChikunRun({seed:99,taps:[0,50,100],maxTicks:120});
 assert.equal(run.evidence.version,'chikun-flap-evidence-v2');assert.deepEqual(replayChikunRun(run.evidence),run);
 const a=buildChikunObstacle({seed:3,index:2,tick:20,x:500,safeGapHeight:320}),b=buildChikunObstacle({seed:3,index:2,tick:100,x:500,safeGapHeight:320});
 assert.notEqual(a.y,b.y);assert.deepEqual(a,buildChikunObstacle({seed:3,index:2,tick:20,x:500,safeGapHeight:320}));
 const snapshot=createChikunRuntime({seed:3,maxTicks:120}).snapshot();assert.ok(snapshot.forks.some(f=>f.kind==='tree'));assert.ok(snapshot.forks.some(f=>f.kind==='gate'));
 assert.ok(Object.isFrozen(snapshot.forks[1].shapes));assert.ok(Object.isFrozen(snapshot.forks[1].shapes[0]));
});
test('saved v1 flights retain their exact old course, score and seek behavior',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/chikun-v1-replay.json',import.meta.url)));
 assert.deepEqual(replayChikunRun(old.evidence),old);
 const viewer=createChikunReplayPlayback(old.evidence);viewer.seek(old.survivalTicks);assert.deepEqual(viewer.result,old);assert.deepEqual(viewer.snapshot().score,old.score);
 viewer.seek(40);viewer.seek(old.survivalTicks);assert.equal(viewer.snapshot().score,old.score);
});
test('an old course cannot be submitted as a new Ranked run',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/chikun-v1-replay.json',import.meta.url)));
 const replayClaim=buildChikunReplayClaim({buildHash:'cabinet-0.6.0',seasonId:'test',result:old});
 assert.throws(()=>verifyChikunReplayClaim({expectedSeed:old.seed,expectedBuildHash:'cabinet-0.6.0',expectedSeasonId:'test',score:old.score,runStats:old,replayClaim}),/course|evidence version/i);
});
test('the character has no oval ghost marker and no box around the next opening',()=>{
 const main=readFileSync(new URL('../apps/chikun/src/main.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(main,/function drawGhost\(|drawGhost\(snapshot\)|ctx\.ellipse\(0, 0, 4[06]/);
 assert.doesNotMatch(main,/ctx\.strokeRect\(nextFork/);
});

test('a hovering drone keeps its coin on the same safe side throughout its cycle',()=>{
 for(let seed=1;seed<=50;seed++) {
  const sides=new Set();
  for(let tick=0;tick<240;tick+=3) {
   const drone=buildChikunObstacle({seed,index:2,tick,x:500});
   sides.add(Math.sign(drone.coin.y-drone.y));
   assert.ok(obstacleClearance(drone,drone.coin.x,drone.coin.y,30)>30);
  }
  assert.equal(sides.size,1,'a coin must not jump through its drone while it hovers');
 }
});

test('native obstacle art has verified payloads and editable source provenance',()=>{
 const base=new URL('../apps/portal/assets/generated/chikun-open-air-v1/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
 assert.ok(manifest.runtimeBytes<150000);
 assert.deepEqual(manifest.assets.map(a=>a.name),['tree','drone']);
 for(const asset of manifest.assets)assert.equal(createHash('sha256').update(readFileSync(new URL(asset.file,base))).digest('hex'),asset.sha256);
 for(const source of manifest.sourceFiles)assert.equal(createHash('sha256').update(readFileSync(new URL('../apps/chikun/assets/source/open-air/'+source.file,import.meta.url))).digest('hex'),source.sha256);
});
