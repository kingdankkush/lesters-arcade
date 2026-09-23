// Frozen v5 runtime (chikun-flap-evidence-v5, cabinet 0.8.0) for historical replay.
// Byte copy of chikun-ground-runtime.mjs as of 43a31c65; reads the frozen v5 course.
import {courseObstacles,groundPickups,distanceAtTick,speedAtTick,courseRegion,courseTerrain,GROUND_Y} from './chikun-ground-v5-course.mjs';
import {obstacleClearance} from './chikun-obstacles.mjs';
export const GROUND_EVIDENCE='chikun-flap-evidence-v5';
export function groundDifficulty(tick=0){return Object.freeze({level:Math.floor(tick/7200)+1,speedMultiplier:speedAtTick(tick),scrollPixelsPerTick:2.4*speedAtTick(tick),safeGapHeight:320});}
export function createGroundRuntime({seed=1,maxTicks=60}={}){
 seed=Math.floor(Number(seed)||0)>>>0;maxTicks=Math.max(1,Math.min(216000,Math.floor(Number(maxTicks)||60)));
 const s={tick:0,y:660,v:0,locomotion:'run',motionTick:0,jumps:0,landings:0,score:0,coins:0,passed:0,near:0,combo:0,best:0,terminal:false,reason:'',impact:null,result:null,taps:[]};
 const collected=new Set(),passed=new Set(),closest=new Map();
 let cachedSnapshot=null,cachedTick=-1;
 const snapshot=()=>{
  if(cachedTick===s.tick&&cachedSnapshot)return cachedSnapshot;
  const forks=courseObstacles(seed,s.tick).map(o=>Object.freeze({...o,passed:passed.has(o.index),coin:Object.freeze({...o.coin,collected:collected.has(o.id)})}));
  cachedTick=s.tick;cachedSnapshot=Object.freeze({canvas:Object.freeze({width:1280,height:720}),tick:s.tick,elapsedSeconds:Number((s.tick/60).toFixed(6)),terminal:s.terminal,terminalReason:s.reason,impact:s.impact,score:s.score,coinsCollected:s.coins,forksPassed:s.passed,nearMisses:s.near,combo:s.combo,bestCombo:s.best,difficulty:groundDifficulty(s.tick),distancePixels:distanceAtTick(s.tick),region:courseRegion(s.tick),terrain:courseTerrain(s.tick),
   chikun:Object.freeze({x:280,y:Number(s.y.toFixed(6)),velocityY:Number(s.v.toFixed(6)),radius:30,locomotion:s.locomotion,motionTick:s.motionTick,jumpVariant:s.jumps%3,landingVariant:s.landings%3}),forks:Object.freeze(forks),groundCoins:Object.freeze(groundPickups(seed,s.tick,forks).map(c=>Object.freeze({...c,collected:collected.has(c.id)})))});
  return cachedSnapshot;
 };
 function finish(reason,impact=null){
  s.terminal=true;s.reason=reason;s.impact=impact?Object.freeze({...impact}):null;
  const survivalTime=Number((s.tick/60).toFixed(6)),achievements=[];
  if(s.tick>=10)achievements.push('chikun-first-flight');if(s.coins>=3)achievements.push('chikun-stack-three');if(s.passed>=5)achievements.push('chikun-fork-runner');if(s.near>=3)achievements.push('chikun-thread-needle');
  const finalState=Object.freeze({step:s.tick,y:Number(s.y.toFixed(6)),velocity:Number(s.v.toFixed(6)),score:s.score,coinsCollected:s.coins,forksPassed:s.passed,nearMisses:s.near,bestCombo:s.best,survivalTicks:s.tick,survivalTime,crashed:reason!=='run-complete',terminalReason:reason});
  s.result=Object.freeze({gameId:'chikun',seed,fixedStepHz:60,score:s.score,coinsCollected:s.coins,forksPassed:s.passed,nearMisses:s.near,bestCombo:s.best,survivalTicks:s.tick,survivalTime,crashed:finalState.crashed,achievements:Object.freeze(achievements),finalState,evidence:Object.freeze({version:GROUND_EVIDENCE,seed,fixedStepHz:60,maxTicks,flapSteps:Object.freeze([...s.taps])})});
 }
 function step({flap=false}={}){
  if(s.terminal)throw new Error('Chikun runtime is already terminal');if(typeof flap!=='boolean')throw new Error('Chikun runtime flap must be boolean');
  if(flap){
   if(s.taps.length>=4096)throw new Error('Chikun flap evidence exceeds 4096 transitions');s.taps.push(s.tick);
   if(s.locomotion==='run'){s.locomotion='jump';s.jumps++;s.v=-7.3;}else{s.locomotion='flight';s.v=-4.8;}s.motionTick=s.tick;
  }
  const beforeY=s.y;s.tick++;
  const obstacles=courseObstacles(seed,s.tick);
  const overGap=obstacles.find(o=>o.family==='gap'&&280>o.x&&280<o.x+o.width);
  if(s.locomotion==='run'&&overGap){s.locomotion='fall';s.motionTick=s.tick;}
  if(s.locomotion!=='run'){
   s.v=Math.min(7,s.v+(s.locomotion==='flight'?.12:.23));s.y+=s.v;
   if(s.y<62){s.y=62;s.v=Math.max(0,s.v);} // Open sky has a soft ceiling.
   if(s.y>=660&&!overGap&&beforeY<=665&&s.v>=0){s.y=660;s.v=0;s.locomotion='run';s.motionTick=s.tick;s.landings++;}
  }
  const previousObstacles=courseObstacles(seed,s.tick-1);
  for(const o of obstacles){
   // Sweep each fixed step: narrow obstacles cannot be skipped as speed increases.
   const previous=previousObstacles.find(p=>p.index===o.index);
   let clearance=obstacleClearance(o,280,s.y,30);
   if(previous){for(const t of [.25,.5,.75])clearance=Math.min(clearance,obstacleClearance(o,280+(o.x-previous.x)*(1-t),beforeY+(s.y-beforeY)*t,30));}
   if(Math.abs(o.x-280)<o.width+100)closest.set(o.index,Math.min(closest.get(o.index)??Infinity,clearance));
   if(clearance<0){finish(o.family==='gap'?o.kind:o.kind,{kind:o.kind,variant:o.variant,index:o.index,x:280,y:s.y,speed:groundDifficulty(s.tick).scrollPixelsPerTick,velocityY:s.v});return snapshot();}
   if(!collected.has(o.id)&&Math.hypot(o.coin.x-280,o.coin.y-s.y)<=49){collected.add(o.id);s.coins++;s.score+=25;}
   if(!passed.has(o.index)&&o.x+o.width<250){passed.add(o.index);s.passed++;s.combo++;s.best=Math.max(s.best,s.combo);s.score+=10;if((closest.get(o.index)??Infinity)<=32){s.near++;s.score+=40;}closest.delete(o.index);}
  }
  for(const c of groundPickups(seed,s.tick,obstacles))if(!collected.has(c.id)&&Math.hypot(c.x-280,c.y-s.y)<=47){collected.add(c.id);s.coins++;s.score+=25;}
  if(s.y>775){finish(overGap?.kind??'pit');return snapshot();}
  s.score++;if(s.tick>=maxTicks)finish('run-complete');
  return snapshot();
 }
 return Object.freeze({step,snapshot,result:()=>s.result,get terminal(){return s.terminal;}});
}
