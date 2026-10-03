import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { garbageIntervalTicks, createStackedRuntime, replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
import { createStackedPortalLifecycle } from '../apps/portal/src/stacked-portal-lifecycle.mjs';
import { handleStackedVerificationRequest } from '../apps/stacked/src/verify-worker.mjs';
import { verifyStackedRun, createStackedVerifier } from '../server/verify/stacked.mjs';
import { createCanonicalSessionIdentity } from '../apps/portal/src/session-integrity.mjs';
import { resolveStackedLedgerPacing } from '../apps/portal/src/stacked-ledger-rules.mjs';
const buildHash = 'site-2.2.0:game-2.2.0:cabinet-0.2.0';
const config = {buildHash, seasonId:'stacked-season-preview-1'};

test('new ledger grants 108 seconds before the first row, then slowly tightens from 18 to 6 seconds', () => {
  assert.equal(garbageIntervalTicks(5399, '2.2.0'), Infinity);
  assert.equal(garbageIntervalTicks(5400, '2.2.0'), 1080);
  assert.equal(garbageIntervalTicks(10799, '2.2.0'), 1080);
  assert.equal(garbageIntervalTicks(10800, '2.2.0'), 1050);
  assert.equal(garbageIntervalTicks(135000, '2.2.0'), 360);
  assert.equal(garbageIntervalTicks(432000, '2.2.0'), 360);
  const run = createStackedRuntime({seed:1, config});
  while(run.snapshot().tick < 6480 && !run.terminal) {
    run.step(0);
    if(run.snapshot().tick === 5400) assert.equal(run.snapshot().garbageTimerTicks,1080);
    if(run.snapshot().tick < 6480) assert.equal(run.snapshot().garbageGroups,0);
  }
  assert.equal(run.snapshot().tick,6480, 'ordinary slow play reaches the first row');
  assert.equal(run.snapshot().garbageGroups,1);
});

test('strict version selection rejects ambiguity and all unspecified/old versions retain the pinned maximal tuple', () => {
  for(const version of ['2.2', '2.2.0-beta', '02.2.0', '', null, 22, '9007199254740992.0.0']) assert.throws(()=>createStackedRuntime({seed:1,config:{gameVersion:version}}),/gameVersion/);
  assert.throws(()=>createStackedRuntime({seed:1,config:{buildHash,gameVersion:'2.1.1'}}),/gameVersion/);
  assert.throws(()=>createStackedRuntime({seed:1,config:{buildHash:'site-2.2.0:game-bogus:cabinet-0.2.0'}}),/gameVersion/);
  for(const version of ['2.2.0','2.2.1']) assert.equal(resolveStackedLedgerPacing({gameVersion:version}).id,'2.2');
  assert.throws(()=>resolveStackedLedgerPacing(Object.defineProperty({},'gameVersion',{enumerable:true,get(){throw Error('getter executed');}})),/gameVersion/);
  assert.notEqual(createStackedRuntime({seed:1}).stateHash(),createStackedRuntime({seed:1,config:{gameVersion:'2.2.0'}}).stateHash(),'pacing is part of future canonical state');
  for(const version of [undefined,'0.2.0','1.9.4','2.0.0','2.1.1']) {
    const options = version === undefined ? {} : {gameVersion:version};
    assert.equal(garbageIntervalTicks(3600,version),720);
    const r=createStackedRuntime({seed:1,config:options});
    for(let tick=0;tick<4320;tick++)r.step(0);
    assert.equal(r.snapshot().garbageGroups,1);
  }
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/stacked-maximal-run.json',import.meta.url)));
  const bytes=gunzipSync(fs.readFileSync(new URL('./fixtures/stacked-maximal-run.sic1.gz',import.meta.url)));
  assert.deepEqual(replayStackedRun(bytes,fixture.replayOptions),fixture.expectedTuple);
});

test('new live run, parent lifecycle, worker and server use the same bound build version', async () => {
  const run=createStackedPlaySession({seed:1,mode:'ranked',...config});
  while(!run.result)run.step(0);
  assert.ok(run.result.garbageGroups > 0 && run.result.ticks > 6480);
  const evidence=run.evidence(), options={expectedSeed:1,maxTicks:432000,config};
  assert.deepEqual(replayStackedRun(evidence,options),run.result);
  const worker=handleStackedVerificationRequest({requestId:'pacing',evidence,...options,config:{...config,gameVersion:'2.2.0'}});
  assert.equal(worker.ok,true); assert.deepEqual(worker.tuple,run.result);
  const session={seed:1,...config,leaderboardEligible:true};
  const lifecycle=createStackedPortalLifecycle({session,persistRanked:async canonical=>{assert.deepEqual(canonical,run.result);}});
  assert.equal((await lifecycle.finish(evidence,run.result)).ok,true);
  const old=JSON.parse(fs.readFileSync(new URL('./fixtures/ranked/stacked-valid.json',import.meta.url)));
  const identity=await createCanonicalSessionIdentity({...old.body.identity,seed:1,buildHash});
  const candidateVerifier = createStackedVerifier({deployedGameVersion:'2.2.0'});
  const verified=await candidateVerifier({identity,evidence:{encoding:'stacked-sic1+base64',sic1:Buffer.from(evidence).toString('base64'),startLevel:1},nowMs:1_790_976_000_000});
  assert.equal(verified.ok,true,JSON.stringify(verified));
  assert.equal(verified.stats.boardHash,run.result.boardHash);
  assert.equal(verified.stats.ticks,run.result.ticks);
  const oldBound=await createCanonicalSessionIdentity({...old.body.identity,seed:1});
  const oldReject=await verifyStackedRun({identity:oldBound,evidence:{encoding:'stacked-sic1+base64',sic1:Buffer.from(evidence).toString('base64'),startLevel:1},nowMs:1_790_976_000_000});
  assert.equal(oldReject.ok,false,'new evidence cannot choose new rules under an old session binding');
  const wrong=handleStackedVerificationRequest({requestId:'pacing',evidence,...options,config:{...config,gameVersion:'2.1.1'}});
  assert.equal(wrong.ok,false);
});

test('Free undo retains an explicitly selected private pacing version', () => {
  const run=createStackedPlaySession({seed:21,mode:'free',gameVersion:'2.2.0'});
  const initial=run.snapshot;
  run.step(0);run.step(8);assert.equal(run.undo(),true);assert.deepEqual(run.snapshot,initial);
  while(run.snapshot.tick < 5400 && !run.result)run.step(0);
  assert.equal(run.snapshot.tick,5400);
  assert.equal(run.snapshot.garbageTimerTicks,1080);
});
