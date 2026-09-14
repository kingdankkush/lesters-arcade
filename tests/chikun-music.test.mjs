import test from 'node:test';
import assert from 'node:assert/strict';
import { createChikunRunMusic } from '../apps/portal/src/chikun-run-music.mjs';
import { chooseArcadeMusicStartIndex } from '../apps/portal/src/arcade-core.mjs';
import { validateChikunChildMessage, createChikunBridgeEnvelope } from '../apps/portal/src/chikun-bridge-protocol.mjs';

test('one random music start per new flight, including Free retries, without restarting on resume or score updates',()=>{
 const starts=[];const music=createChikunRunMusic(()=>starts.push('chikun'));
 music.observe({status:'ready',survivalTicks:0});assert.equal(starts.length,0);
 music.observe({status:'running',survivalTicks:0});
 music.observe({status:'running',survivalTicks:0});
 music.observe({status:'running',survivalTicks:60});
 music.observe({paused:true});music.observe({paused:false});
 music.observe({status:'running',survivalTicks:60});assert.equal(starts.length,1);
 music.observe({status:'game-over',survivalTicks:400});
 music.observe({status:'running',survivalTicks:0});assert.equal(starts.length,2);
 music.dispose();music.observe({status:'game-over'});music.observe({status:'running',survivalTicks:0});assert.equal(starts.length,2);
});

test('music controls request can only open the parent player and carries no track URL or playback authority',()=>{
 const envelope=payload=>createChikunBridgeEnvelope({type:'game:music-request',sessionId:'chikun:free:music-test',messageId:'music-1',payload});
 assert.equal(validateChikunChildMessage(envelope({})).ok,true);
 assert.equal(validateChikunChildMessage(envelope({src:'https://untrusted.test/track.mp3'})).ok,false);
});

test('new-session shuffle avoids an immediate repeat without biasing the course seed',()=>{
 for(let previousIndex=0;previousIndex<26;previousIndex++) {
  const seen=new Set();
  for(let i=0;i<25;i++)seen.add(chooseArcadeMusicStartIndex({queueLength:26,previousIndex,random:()=>i/25}));
  assert.equal(seen.size,25);assert.ok(!seen.has(previousIndex));
 }
 assert.equal(chooseArcadeMusicStartIndex({queueLength:1,previousIndex:0}),0);
});
