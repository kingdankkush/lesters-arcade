import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayParticles, mobilePresentation } from '../apps/stacked/src/render/gameplay-particles.mjs';
import { createStackedRuntime, cellsFor, collides, compactCompletedRows } from '../apps/portal/src/stacked-sim.mjs';
import { locateCommittedLock } from '../apps/stacked/src/render/lock-projection.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';
const geometry = { cellsFor, collides };
const settings = defaultStackedSettings();
const fixture = () => ({ tick:1, board:Array(240).fill(0), active:{kind:'T',rotation:0,x:3,y:14}, lines:0,piecesLocked:0,piecesSpawned:1,holdsUsed:0,comboCount:0,hardDropCells:0 });

test('lock bursts use the committed footprint after a simultaneous rotation and drop, including ledger rise',()=>{
  const before={...fixture(),active:{kind:'I',rotation:1,x:3,y:12}};
  for(let x=0;x<10;x++){before.board[x]=x===9?0:2;before.board[50+x]=x===3?2:0;before.board[60+x]=(x>=3&&x<=6)?0:2;}
  const cells=cellsFor('I',0,3,4),placed=[...before.board];for(const [x,y]of cells)placed[y*10+x]=1;
  const compacted=compactCompletedRows(Uint8Array.from(placed)),after={...before,tick:2,lines:1,piecesLocked:1,board:Array.from(compacted.board)};
  const found=locateCommittedLock(before,after,geometry);assert.deepEqual(found.rows,[6]);assert.deepEqual(found.cells,cells);
  const raised={...after,garbageRowsReceived:1,board:[...Array(10).fill(8),...after.board.slice(0,230)]};raised.board[2]=0;
  assert.deepEqual(locateCommittedLock({...before,garbageRowsReceived:0},raised,geometry).rows,[6]);
});
test('mobile policy covers portrait, rotated phones and touch tablets without penalizing large desktop windows', () => {
  assert.equal(mobilePresentation({width:390,coarsePointer:true}),true);
  assert.equal(mobilePresentation({width:844,coarsePointer:true}),true);
  assert.equal(mobilePresentation({width:1280,coarsePointer:true}),true);
  assert.equal(mobilePresentation({width:320,coarsePointer:false}),true);
  assert.equal(mobilePresentation({width:1440,coarsePointer:false}),false);
});
test('successful movement/rotation emit once; invalid inputs and repeated frames emit nothing', () => {
  const particles=createGameplayParticles({geometry,mobile:true});
  const before=fixture(), moved={...before,tick:2,active:{...before.active,x:4}};
  particles.step(before,moved,0,settings);
  assert.equal(particles.state.lastEvent,'move');
  const count=particles.state.emitted;
  particles.step(before,moved,0,settings);
  particles.step(moved,{...moved,tick:3},20,settings);
  assert.equal(particles.state.emitted,count);
  particles.step(moved,{...moved,tick:4,active:{...moved.active,rotation:1}},40,settings);
  assert.equal(particles.state.lastEvent,'rotate');
  assert.ok(particles.state.emitted>count);
});
test('clear tiers grow from single through HALVING and combos add a bounded celebration', () => {
  const counts=[];
  for(let lines=1;lines<=4;lines++) {
    const particles=createGameplayParticles({geometry,mobile:true}), before=fixture();
    for(let y=0;y<lines;y++) for(let x=0;x<9;x++) before.board[y*10+x]=1;
    particles.step(before,{...before,tick:2,lines,piecesLocked:1,piecesSpawned:2},0,settings);
    counts.push(particles.state.emitted);
    assert.equal(particles.state.clearTier,lines);
    assert.ok(particles.state.count<=128);
    assert.ok(particles.state.rows.slice(0,lines).every((row,i)=>row===i));
  }
  assert.ok(counts.every((count,i)=>i===0||count>counts[i-1]));
  const particles=createGameplayParticles({geometry,mobile:true}), before=fixture();
  particles.step(before,{...before,tick:2,lines:4,piecesLocked:1,comboCount:5},0,settings);
  assert.ok(particles.state.emitted>counts[3]);
});
test('bounded pools expire, reset on rewind and suppress particles for reduced motion and zero intensity', () => {
  const particles=createGameplayParticles({geometry,mobile:true});
  let before=fixture();
  for(let i=0;i<2000;i++) { const after={...before,tick:before.tick+1,lines:before.lines+4,piecesLocked:before.piecesLocked+1}; particles.step(before,after,i,settings); before=after; }
  assert.ok(particles.state.count<=128);
  particles.update(4000,settings);
  assert.equal(particles.state.count,0);
  particles.step(before,fixture(),5000,settings);
  assert.equal(particles.state.count,0);
  for(const prefs of [{...settings,accessibility:{...settings.accessibility,reduceMotion:true}},{...settings,video:{...settings.video,effectsIntensity:0}}]) {
    particles.step(fixture(),{...fixture(),tick:2,lines:4,piecesLocked:1},5100,prefs);
    assert.equal(particles.state.count,0);
  }
});
test('effects never change replay, board, tuple or hash through a real run', () => {
  const left=createStackedRuntime({seed:928}), right=createStackedRuntime({seed:928});
  const particles=createGameplayParticles({geometry,mobile:true});
  while(!left.terminal) {
    const before=left.snapshot(), mask=before.tick%30===0?8:before.tick%7===0?16:0;
    const after=left.step(mask); right.step(mask);
    particles.step(before,after,after.tick*1000/60,settings); particles.update(after.tick*1000/60,settings);
  }
  assert.deepEqual(left.result(),right.result()); assert.equal(left.stateHash(),right.stateHash());
});
