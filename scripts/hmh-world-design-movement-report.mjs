import { createPlayerMotionState, stepPlayerMovement } from '../apps/hmh-reboot/src/movement.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { writeFileSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dt=1/60, make=()=>createPlayerMotionState({maxSpeed:LEVEL_ONE_WORLD.player.maxSpeed});
const advance=(state,move)=>stepPlayerMovement(state,{move,aim:{x:1,y:0,active:false}},{dtSeconds:dt});
const straight=make(),diagonal=make(),rows=[];
for(let tick=1;tick<=12;tick++){advance(straight,{x:1,y:0});advance(diagonal,{x:1,y:1});rows.push({tick,cardinal:Math.hypot(straight.vx,straight.vy),diagonal:Math.hypot(diagonal.vx,diagonal.vy),x:straight.x});}
const atSpeed=rows.find(r=>r.cardinal>=straight.maxSpeed-1e-8).tick;
const release=structuredClone(straight),turn=structuredClone(straight),corner=structuredClone(straight),response=[];
for(let tick=1;tick<=15;tick++){advance(release,{x:0,y:0});advance(turn,{x:-1,y:0});advance(corner,{x:0,y:1});response.push({tick,releaseSpeed:Math.hypot(release.vx,release.vy),reverseVx:turn.vx,cornerVx:corner.vx,cornerVy:corner.vy});}
const replay=partition=>{const state=make();for(let frame=partition;frame<=180;frame+=partition)for(let tick=frame-partition+1;tick<=frame;tick++)advance(state,tick<=60?{x:1,y:1}:tick<=120?{x:-1,y:0}:{x:0,y:0});return state;};
assert.deepEqual(replay(1),replay(2));assert.deepEqual(replay(1),replay(3));
const report={scope:'Canonical fixed-tick movement measurements. Browser input-to-present latency is a separate receipt; no physical-device latency or FPS claim.',tickHz:60,parameters:{maxSpeed:straight.maxSpeed,accelerationTime:straight.accelerationTime,decelerationTime:straight.decelerationTime,turnAccelerationTime:straight.turnAccelerationTime},measurements:{firstMotionTick:rows.find(r=>r.x>0).tick,fullSpeedTicks:atSpeed,fullSpeedMs:atSpeed*1000/60,stopTicks:response.find(r=>r.releaseSpeed<1e-8).tick,reverseSignTicks:response.find(r=>r.reverseVx<0).tick,fullReverseTicks:response.find(r=>r.reverseVx<=-straight.maxSpeed+1e-8).tick,diagonalSpeedGain:Math.max(...rows.map(r=>Math.abs(r.diagonal-r.cardinal)))},start:rows,response,partitionsEqual:[60,30,20],sourceHashes:Object.fromEntries(['apps/hmh-reboot/src/movement.mjs','apps/hmh-reboot/src/input.mjs','apps/hmh-reboot/src/level-one-world.mjs'].map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')]))};
writeFileSync(new URL('../docs/qa/hmh-world-design-movement-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.measurements));
