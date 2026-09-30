import test from 'node:test';
import assert from 'node:assert/strict';
const load=()=>import('../apps/stacked/src/tutorial-model.mjs');
test('training starts with an isolated ten-column board and move task',async()=>{
 const {createTutorial}=await load(),a=createTutorial(),b=createTutorial();
 assert.equal(a.snapshot().step,'move');assert.equal(a.snapshot().board.length,80);
 a.act('right');assert.equal(a.snapshot().ready,true);assert.equal(b.snapshot().ready,false);
 const s=a.snapshot();s.board[0]=9;s.cells[0][0]=99;assert.equal(a.snapshot().board[0],0);assert.notEqual(a.snapshot().cells[0][0],99);
});
test('only the taught action completes each stage; next cannot skip practice',async()=>{
 const t=(await load()).createTutorial();
 assert.equal(t.next(),false);for(const a of ['rotate','hold','drop','unknown'])t.act(a);
 assert.equal(t.snapshot().ready,false);t.act('left');assert.equal(t.next(),true);
 assert.equal(t.snapshot().step,'rotate');t.act('hold');assert.equal(t.snapshot().ready,false);
 const before=t.snapshot().cells;t.act('rotate');assert.notDeepEqual(t.snapshot().cells,before);assert.equal(t.snapshot().ready,true);
});
test('move and rotate never put the demonstration outside its board',async()=>{
 const t=(await load()).createTutorial();for(let i=0;i<50;i++)t.act('left');
 assert.ok(t.snapshot().cells.every(([x])=>x>=0));for(let i=0;i<50;i++)t.act('right');assert.ok(t.snapshot().cells.every(([x])=>x<10));
 t.next();for(let i=0;i<8;i++)t.act('rotate');assert.ok(t.snapshot().cells.every(([x,y])=>x>=0&&x<10&&y>=0&&y<8));
});
test('hold stores T and brings in I exactly once for the lesson',async()=>{
 const t=(await load()).createTutorial();t.act('right');t.next();t.act('rotate');t.next();
 assert.equal(t.snapshot().step,'hold');t.act('hold');const s=t.snapshot();assert.equal(s.hold,'T');assert.equal(s.piece,'I');assert.equal(s.ready,true);
 t.act('hold');assert.deepEqual(t.snapshot(),s);
});
test('hard drop lands at the guide and the Halving example clears four full rows',async()=>{
 const t=(await load()).createTutorial();t.act('right');t.next();t.act('rotate');t.next();t.act('hold');t.next();
 assert.equal(t.snapshot().step,'drop');const guide=t.snapshot().ghost;t.act('drop');assert.deepEqual(t.snapshot().cells,guide);assert.equal(t.snapshot().ready,true);t.next();
 assert.equal(t.snapshot().step,'halving');assert.equal(t.snapshot().board.filter(Boolean).length,36);
 t.act('drop');assert.equal(t.snapshot().cleared,4);assert.equal(t.snapshot().board.filter(Boolean).length,0);assert.equal(t.snapshot().cells.length,0);
 assert.equal(t.next(),true);assert.equal(t.snapshot().step,'complete');assert.equal(t.next(),false);
});
test('reset restarts the lesson without retaining a held piece or cleared rows',async()=>{
 const t=(await load()).createTutorial();t.act('left');t.next();t.act('rotate');t.next();t.act('hold');t.reset();
 assert.deepEqual(t.snapshot(),(await load()).createTutorial().snapshot());
});
test('the tutorial switch is strict and combines with living journey without forwarding other input',async()=>{
 const {stackedPresentationSuffix}=await import('../apps/portal/src/stacked-presentation-switch.mjs');
 assert.equal(stackedPresentationSuffix('?stackedTutorial=tutorial-v1&junk=abc'),'?stackedTutorial=tutorial-v1');
 assert.equal(stackedPresentationSuffix('?livingJourney=living-v1&stackedTutorial=tutorial-v1'),'?livingJourney=living-v1&stackedTutorial=tutorial-v1');
 for(const s of ['', '?stackedTutorial=no','?stackedTutorial=tutorial-v1&stackedTutorial=tutorial-v1'])assert.equal(stackedPresentationSuffix(s),'');
});
