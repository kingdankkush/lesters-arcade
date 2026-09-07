import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryFixture } from './fixtures/stacked-summary-fixture.mjs';
import { encodeSic1 } from '../apps/portal/src/stacked-sim.mjs';
import { chunkStackedEvidence } from '../apps/portal/src/stacked-evidence-transport.mjs';
import { STACKED_ACTIONS } from '../apps/portal/src/stacked-contracts.mjs';
const load=async()=>{const m=await import('../apps/portal/src/stacked-bridge-protocol.mjs');assert.ok(m,'complete exact-key bridge validator is required');return m;};
const settings=()=>({version:1,handling:{dasMs:133,arrMs:33,dcdMs:0,cancelDas:true},controls:{keyboardBindings:Object.fromEntries(STACKED_ACTIONS.map((id,i)=>[id,{primary:`Key${String.fromCharCode(65+i)}`,secondary:null}])),touchLayout:'gesture',touchOpacity:0.4,touchLeftHanded:false,touchSensitivity:1},video:{qualityTier:'auto',reducedEffects:false,audioReactive:true,ghostPiece:true,gridLines:true},audio:{musicEnabled:true,sfxEnabled:true,sfxVolume:0.85},accessibility:{reduceMotion:false,reduceFlash:false,colorblindPieces:false,hudScale:1}});
const tuple=()=>({v:'stacked-result-v1',gameId:'stacked',seed:1,buildHash:'stacked-test',seasonId:'stacked-season-preview-1',ticks:60,pieces:10,lines:4,level:1,score:100,quadClears:1,spins:0,perfectClears:0,maxCombo:0,maxBackToBack:1,garbageRowsReceived:0,garbageGroups:0,garbageRowsCleared:0,holdsUsed:0,bagRefills:3,bagDraws:18,garbageDraws:0,transitionCount:2,boardHash:'0x'+'a'.repeat(64),terminalReason:'block-out'});
const cases=()=>({
 'portal:init':{gameId:'stacked',mode:'free',profile:{displayName:'Player',locale:'en-US'},session:{seed:1,buildHash:'stacked-test',seasonId:'stacked-season-preview-1',rankedEligible:false},settings:{...settings(),startLevel:1}},
 'portal:settings':{settings:settings()},'portal:pause':{},'portal:resume':{},'portal:exit':{},
 'portal:audio-frame':{audio:{t:0,sub:0,bass:0,lowMid:0,mid:0,high:0,level:0,onset:false,beatPhase:0,bpm:0,available:false}},
 'game:ready':{runtimeVersion:'0.2.0',renderer:'pixi-webgl',capabilities:['leaderboard','achievements','ranked','audio','haptics']},
 'game:state':{status:'running',score:0,linesCleared:0,level:1,survivalTicks:0,paused:false},
 'game:evidence-chunk':chunkStackedEvidence(encodeSic1({seed:1,totalTicks:1,transitions:[]}),{sessionId:'session-protocol'})[0].payload,
 'game:result':{v:'stacked-run-payload-v1',score:100,evidenceDigest:'0x'+'a'.repeat(64),totalRawBytes:100,tuple:tuple(),summary:summaryFixture(),runStats:{pauseCount:0,pausedWallClockMs:0,sampledTicksPerSecond:60,qualityTier:'desktopHigh',reducedMotion:false,droppedInputs:0,degradationLevel:0}},
 'game:error':{code:'runtime-error',message:'Unable to initialize graphics.'},
});
const envelope=(type,payload)=>({protocol:'stacked-bridge/v1',type,sessionId:'session-protocol',messageId:'message-one',payload});
test('bridge accepts all eleven allowlisted exact payloads and rejects unknown/missing envelope fields',async()=>{
 const {validateStackedBridgeMessage}=await load();const fixtures=cases();assert.equal(Object.keys(fixtures).length,11);
 for(const [type,payload]of Object.entries(fixtures)){
  const good=envelope(type,payload);assert.equal(validateStackedBridgeMessage(good).ok,true,type);
  for(const key of Object.keys(good)){const bad=structuredClone(good);delete bad[key];assert.equal(validateStackedBridgeMessage(bad).ok,false,`${type}.${key}`);}
  assert.equal(validateStackedBridgeMessage({...good,extra:true}).ok,false);
  assert.equal(validateStackedBridgeMessage({...good,type:'game:score'}).ok,false);
  assert.equal(validateStackedBridgeMessage(good,{sessionId:'different-session'}).ok,false);
 }
});
test('bridge rejects unknown and missing keys recursively in every object payload',async()=>{
 const {validateStackedBridgeMessage}=await load();
 for(const [type,payload]of Object.entries(cases())){
  const visit=(value,path=[])=>{if(!value||typeof value!=='object'||Array.isArray(value))return;
   for(const key of [...Object.keys(value),'extra']){
    const bad=envelope(type,structuredClone(payload));let node=bad.payload;for(const part of path)node=node[part];
    if(key==='extra')node.extra=true;else delete node[key];
    assert.equal(validateStackedBridgeMessage(bad).ok,false,`${type}.${path.join('.')}.${key}`);
   }
   for(const [key,child]of Object.entries(value))visit(child,[...path,key]);
  };visit(payload);
 }
});
test('bridge rejects session/settings injection, Ranked start levels and inconsistent result identities',async()=>{
 const {validateStackedBridgeMessage}=await load();
 const init=cases()['portal:init'];init.mode='ranked';init.session.rankedEligible=true;init.settings.startLevel=2;
 assert.equal(validateStackedBridgeMessage(envelope('portal:init',init)).ok,false);
 init.settings.startLevel=1;assert.equal(validateStackedBridgeMessage(envelope('portal:init',init)).ok,true);
 for(const [field,value]of [['seed',2],['rankedEligible',true],['buildHash','other-build']]){
  const s=cases()['portal:settings'];s.settings[field]=value;assert.equal(validateStackedBridgeMessage(envelope('portal:settings',s)).ok,false);
 }
 for(const mutate of [p=>p.score++,p=>p.tuple.ticks++,p=>p.summary.totals.elapsedMs+=5,p=>p.tuple.seed++,p=>p.tuple.bagDraws=17,p=>p.evidenceDigest="0x00",p=>p.totalRawBytes=1302001,p=>p.runStats.degradationLevel=4]){
  const p=cases()['game:result'];mutate(p);assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,false);
 }
 const audio=cases()['portal:audio-frame'];audio.audio.bass=1001;assert.equal(validateStackedBridgeMessage(envelope('portal:audio-frame',audio)).ok,false);
 audio.audio.bass=1000;audio.audio.bpm=599;assert.equal(validateStackedBridgeMessage(envelope('portal:audio-frame',audio)).ok,false);
});
test('result tuple holds cannot exceed spawned pieces despite a superficially valid hold/drop sum',async()=>{
 const {validateStackedBridgeMessage}=await load();const p=cases()['game:result'];p.tuple.holdsUsed=10;p.summary.technique.holds=10;
 assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,true);
 p.tuple.holdsUsed=11;p.summary.technique.holds=11;assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,false);
});
test('result transition claims cannot exceed the SIC1 tick count',async()=>{
 const {validateStackedBridgeMessage}=await load();const p=cases()['game:result'];p.tuple.transitionCount=p.tuple.ticks;
 assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,true);
 p.tuple.transitionCount+=1;assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,false);
});
test('result perfect-clear claims cannot exceed total cleared lines',async()=>{
 const {validateStackedBridgeMessage}=await load();const p=cases()['game:result'];p.tuple.perfectClears=1;p.summary.clears.perfectClears=1;
 assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,true);
 p.tuple.perfectClears=p.tuple.lines+1;p.summary.clears.perfectClears=p.tuple.perfectClears;
 assert.equal(validateStackedBridgeMessage(envelope('game:result',p)).ok,false);
});

