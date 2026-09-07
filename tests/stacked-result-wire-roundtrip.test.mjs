import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createStackedRuntime,createStackedInputRecorder,replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { validateStackedBridgeMessage } from '../apps/portal/src/stacked-bridge-protocol.mjs';
import { chunkStackedEvidence,reassembleStackedEvidence } from '../apps/portal/src/stacked-evidence-transport.mjs';
import { summaryFixture } from './fixtures/stacked-summary-fixture.mjs';
test('a real terminal runtime tuple survives SIC1 transport, replay and result wire validation',()=>{
 const config={buildHash:'stacked-test'},runtime=createStackedRuntime({seed:1,config}),recorder=createStackedInputRecorder({seed:1});
 let hardDrops=0;while(!runtime.terminal&&recorder.tick<100){const tick=recorder.tick+1,mask=tick%2?8:0;if(mask)hardDrops++;recorder.sample(tick,mask);runtime.step(recorder.commit());}
 assert.equal(runtime.terminal,true);const t=runtime.result(),state=runtime.snapshot(),summary=summaryFixture();
 Object.assign(summary.identity,{seed:t.seed,buildHash:t.buildHash,seasonId:t.seasonId,terminalReason:t.terminalReason,endTick:t.ticks});
 Object.assign(summary.totals,{score:t.score,survivalTicks:t.ticks,elapsedMs:Math.round(t.ticks*1000/60),level:t.level,pieces:t.pieces,linesCleared:t.lines});
 Object.assign(summary.clears,{singles:state.singles,doubles:state.doubles,triples:state.triples,quadClears:t.quadClears,perfectClears:t.perfectClears});
 Object.assign(summary.technique,{spins:t.spins,maxCombo:t.maxCombo,maxBackToBack:t.maxBackToBack,holds:t.holdsUsed,hardDrops,softDropCells:state.softDropCells});
 Object.assign(summary.pressure,{garbageRowsReceived:t.garbageRowsReceived,garbageRowsCleared:t.garbageRowsCleared,maxStackHeight:state.maxStackHeight,topOutTick:t.ticks});
 const bytes=recorder.encode(),chunks=chunkStackedEvidence(bytes,{sessionId:'real-roundtrip'});
 for(const chunk of chunks)assert.equal(validateStackedBridgeMessage(chunk).ok,true);
 const restored=reassembleStackedEvidence(chunks,{sessionId:'real-roundtrip'});
 assert.deepEqual(replayStackedRun(restored,{expectedSeed:1,config}),t);
 const payload={v:'stacked-run-payload-v1',score:t.score,evidenceDigest:'0x'+createHash('sha256').update(bytes).digest('hex'),totalRawBytes:bytes.length,tuple:t,summary,runStats:{pauseCount:0,pausedWallClockMs:0,sampledTicksPerSecond:60,qualityTier:'desktopHigh',reducedMotion:false,droppedInputs:0,degradationLevel:0}};
 assert.equal(validateStackedBridgeMessage({protocol:'stacked-bridge/v1',type:'game:result',sessionId:'real-roundtrip',messageId:'result-one',payload}).ok,true);
});
