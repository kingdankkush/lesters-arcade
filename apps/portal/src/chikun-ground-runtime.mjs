// Chikun ground-and-sky runtime, evidence v6 (canvas-runtime-v7, cabinet 0.9.0).
// The frozen v5 runtime lives in chikun-ground-v5-runtime.mjs.
//
// Evidence v6: {version, seed, fixedStepHz: 60, maxTicks, flapDeltas}. The flap
// ticks are the pre-step ticks at which a flap was applied; flapDeltas[0] is the
// first tick and flapDeltas[i] = tick[i] - tick[i-1]. The 12,000th flap ends the
// run gracefully with terminalReason 'flap-limit' (never a throw).
//
// Result counters (outside finalState, so the bridge finalState shape is unchanged;
// the achievements stats mapper reads them):
//  - combo / bestCombo: consecutive passed obstacles where Chikun either collected
//    that obstacle's own coin or scored a near miss on it. Any other pass resets
//    the combo to 0, so bestCombo is no longer just forksPassed.
//  - nearMissStreakBest: the longest run of consecutive passed obstacles that were
//    each a near miss (closest clearance <= 32 px while it was within reach).
//  - flawlessRegions: region visits (one region of one loop) whose obstacles were
//    all passed with no near miss. A region counts when its last obstacle is passed.
//  - regionIndexReached / regionReached: obstacle-exact, the region of the highest
//    obstacle index passed (regionForObstacle(index)); 0 / 'farmland' before the
//    first pass. The snapshot `region` label lags by REGION_LEAD_TICKS (scenery).
//  - laps: completed loops = floor((highest passed index + 1) / REGION_LOOP_SLOTS).
//  - distancePixels: distanceAtTick(survivalTicks).
//  - speedMultiplierReached: speedAtTick(survivalTicks).
//
// Determinism: new math uses only + - * /, Math.floor, Math.min, Math.max and
// integer operations. Coin pickups compare squared distances (no Math.hypot).
import {courseObstacles,groundPickups,distanceAtTick,speedAtTick,courseRegion,courseTerrain} from './chikun-ground-course.mjs';
import {regionForObstacle,REGION_LOOP_SLOTS} from './chikun-course-regions.mjs';
import {obstacleClearance} from './chikun-obstacles.mjs';
export const GROUND_EVIDENCE='chikun-flap-evidence-v6';
export const GROUND_MAX_FLAPS=12000;
export const GROUND_MAX_TICKS=216000;
// Physics shared with the difficulty-harness bots (scripts/lib/chikun-bots.mjs).
export const GROUND_PHYSICS=Object.freeze({
 chikunX:280,radius:30,runY:660,jumpVelocity:-7.3,flightVelocity:-4.8,
 jumpGravity:.23,flightGravity:.12,maxFallVelocity:7,ceilingY:62,ceilingLethal:false,
 landingSlack:665,fallDeathY:775,
});
const P=GROUND_PHYSICS;
export function groundDifficulty(tick=0){return Object.freeze({level:Math.floor(tick/7200)+1,speedMultiplier:speedAtTick(tick),scrollPixelsPerTick:2.4*speedAtTick(tick),safeGapHeight:320});}
export function createGroundRuntime({seed=1,maxTicks=60}={}){
 seed=Math.floor(Number(seed)||0)>>>0;maxTicks=Math.max(1,Math.min(GROUND_MAX_TICKS,Math.floor(Number(maxTicks)||60)));
 const s={tick:0,y:P.runY,v:0,locomotion:'run',motionTick:0,jumps:0,landings:0,score:0,coins:0,passed:0,near:0,combo:0,best:0,nearStreak:0,nearStreakBest:0,
  lastPassed:-1,regionVisit:-1,regionClean:true,flawless:0,terminal:false,reason:'',impact:null,result:null,taps:[]};
 const collected=new Set(),passed=new Set(),closest=new Map();
 let cachedSnapshot=null,cachedTick=-1;
 const snapshot=()=>{
  if(cachedTick===s.tick&&cachedSnapshot)return cachedSnapshot;
  const forks=courseObstacles(seed,s.tick).map(o=>Object.freeze({...o,passed:passed.has(o.index),coin:Object.freeze({...o.coin,collected:collected.has(o.id)})}));
  cachedTick=s.tick;cachedSnapshot=Object.freeze({canvas:Object.freeze({width:1280,height:720}),tick:s.tick,elapsedSeconds:Number((s.tick/60).toFixed(6)),terminal:s.terminal,terminalReason:s.reason,impact:s.impact,score:s.score,coinsCollected:s.coins,forksPassed:s.passed,nearMisses:s.near,combo:s.combo,bestCombo:s.best,difficulty:groundDifficulty(s.tick),distancePixels:distanceAtTick(s.tick),region:courseRegion(s.tick),terrain:courseTerrain(s.tick),
   chikun:Object.freeze({x:P.chikunX,y:Number(s.y.toFixed(6)),velocityY:Number(s.v.toFixed(6)),radius:P.radius,locomotion:s.locomotion,motionTick:s.motionTick,jumpVariant:s.jumps%3,landingVariant:s.landings%3}),forks:Object.freeze(forks),groundCoins:Object.freeze(groundPickups(seed,s.tick,forks).map(c=>Object.freeze({...c,collected:collected.has(c.id)})))});
  return cachedSnapshot;
 };
 function finish(reason,impact=null){
  s.terminal=true;s.reason=reason;s.impact=impact?Object.freeze({...impact}):null;
  const survivalTime=Number((s.tick/60).toFixed(6)),achievements=[];
  if(s.tick>=10)achievements.push('chikun-first-flight');if(s.coins>=3)achievements.push('chikun-stack-three');if(s.passed>=5)achievements.push('chikun-fork-runner');if(s.near>=3)achievements.push('chikun-thread-needle');
  const crashed=reason!=='run-complete'&&reason!=='flap-limit';
  const finalState=Object.freeze({step:s.tick,y:Number(s.y.toFixed(6)),velocity:Number(s.v.toFixed(6)),score:s.score,coinsCollected:s.coins,forksPassed:s.passed,nearMisses:s.near,bestCombo:s.best,survivalTicks:s.tick,survivalTime,crashed,terminalReason:reason});
  const reached=regionForObstacle(Math.max(0,s.lastPassed));
  const flapDeltas=s.taps.map((tick,i)=>i===0?tick:tick-s.taps[i-1]);
  s.result=Object.freeze({gameId:'chikun',seed,fixedStepHz:60,score:s.score,coinsCollected:s.coins,forksPassed:s.passed,nearMisses:s.near,bestCombo:s.best,survivalTicks:s.tick,survivalTime,crashed,achievements:Object.freeze(achievements),finalState,
   nearMissStreakBest:s.nearStreakBest,flawlessRegions:s.flawless,regionIndexReached:s.lastPassed<0?0:reached.index,regionReached:s.lastPassed<0?'farmland':reached.region.id,
   laps:Math.floor((s.lastPassed+1)/REGION_LOOP_SLOTS),distancePixels:distanceAtTick(s.tick),speedMultiplierReached:speedAtTick(s.tick),
   evidence:Object.freeze({version:GROUND_EVIDENCE,seed,fixedStepHz:60,maxTicks,flapDeltas:Object.freeze(flapDeltas)})});
 }
 function pass(o){
  passed.add(o.index);s.passed++;s.score+=10;
  const near=(closest.get(o.index)??Infinity)<=32;closest.delete(o.index);
  if(near){s.near++;s.score+=40;}
  // Combo: this obstacle's coin or a near miss keeps it going.
  if(near||collected.has(o.id)){s.combo++;s.best=Math.max(s.best,s.combo);}else s.combo=0;
  if(near){s.nearStreak++;s.nearStreakBest=Math.max(s.nearStreakBest,s.nearStreak);}else s.nearStreak=0;
  const {index:regionIndex,local,loop,region}=regionForObstacle(o.index),visit=loop*8+regionIndex;
  if(visit!==s.regionVisit){s.regionVisit=visit;s.regionClean=local===0;}
  if(near)s.regionClean=false;
  if(local===region.slots-1&&s.regionClean)s.flawless++;
  s.lastPassed=Math.max(s.lastPassed,o.index);
 }
 function step({flap=false}={}){
  if(s.terminal)throw new Error('Chikun runtime is already terminal');if(typeof flap!=='boolean')throw new Error('Chikun runtime flap must be boolean');
  if(flap){
   s.taps.push(s.tick);
   if(s.locomotion==='run'){s.locomotion='jump';s.jumps++;s.v=P.jumpVelocity;}else{s.locomotion='flight';s.v=P.flightVelocity;}s.motionTick=s.tick;
  }
  const beforeY=s.y;s.tick++;
  const obstacles=courseObstacles(seed,s.tick);
  const overGap=obstacles.find(o=>o.family==='gap'&&P.chikunX>o.x&&P.chikunX<o.x+o.width);
  if(s.locomotion==='run'&&overGap){s.locomotion='fall';s.motionTick=s.tick;}
  if(s.locomotion!=='run'){
   s.v=Math.min(P.maxFallVelocity,s.v+(s.locomotion==='flight'?P.flightGravity:P.jumpGravity));s.y+=s.v;
   if(s.y<P.ceilingY){s.y=P.ceilingY;s.v=Math.max(0,s.v);} // Open sky has a soft ceiling; planes patrol the top band.
   if(s.y>=P.runY&&!overGap&&beforeY<=P.landingSlack&&s.v>=0){s.y=P.runY;s.v=0;s.locomotion='run';s.motionTick=s.tick;s.landings++;}
  }
  const previousObstacles=courseObstacles(seed,s.tick-1);
  for(const o of obstacles){
   // Sweep each fixed step: narrow obstacles cannot be skipped as speed increases.
   const previous=previousObstacles.find(p=>p.index===o.index);
   let clearance=obstacleClearance(o,P.chikunX,s.y,P.radius);
   if(previous){for(const t of [.25,.5,.75])clearance=Math.min(clearance,obstacleClearance(o,P.chikunX+(o.x-previous.x)*(1-t),beforeY+(s.y-beforeY)*t,P.radius));}
   if(Math.abs(o.x-P.chikunX)<o.width+100)closest.set(o.index,Math.min(closest.get(o.index)??Infinity,clearance));
   if(clearance<0){finish(o.kind,{kind:o.kind,variant:o.variant,index:o.index,x:P.chikunX,y:s.y,speed:groundDifficulty(s.tick).scrollPixelsPerTick,velocityY:s.v});return snapshot();}
   const cx=o.coin.x-P.chikunX,cy=o.coin.y-s.y;
   if(!collected.has(o.id)&&cx*cx+cy*cy<=49*49){collected.add(o.id);s.coins++;s.score+=25;}
   if(!passed.has(o.index)&&o.x+o.width<250)pass(o);
  }
  for(const c of groundPickups(seed,s.tick,obstacles)){const gx=c.x-P.chikunX,gy=c.y-s.y;if(!collected.has(c.id)&&gx*gx+gy*gy<=47*47){collected.add(c.id);s.coins++;s.score+=25;}}
  if(s.y>P.fallDeathY){finish(overGap?.kind??'pit');return snapshot();}
  s.score++;if(s.tick>=maxTicks)finish('run-complete');
  else if(s.taps.length>=GROUND_MAX_FLAPS)finish('flap-limit');
  return snapshot();
 }
 return Object.freeze({step,snapshot,result:()=>s.result,get terminal(){return s.terminal;}});
}
