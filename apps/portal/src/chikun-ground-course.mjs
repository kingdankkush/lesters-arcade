// Canonical v6 course (chikun-flap-evidence-v6, cabinet 0.9.0). Shared by the
// child, the parent verifier, the server verifier and the replay viewer.
// Obstacle mix and scenery follow the seven-region loop in chikun-course-regions.mjs.
// The frozen v5 course lives in chikun-ground-v5-course.mjs.
//
// Determinism (contract A9): everything here uses only + - * /, Math.floor,
// Math.min, Math.max and integer operations, so Node (the server replay) and
// Safari compute bit-identical courses. No Math.sqrt, Math.pow, Math.exp,
// Math.hypot or trig in this file.
import {COURSE_CADENCE,regionForObstacle,courseRegion,courseTerrain,passageRoute} from './chikun-course-regions.mjs';
export {COURSE_CADENCE,courseRegion,courseTerrain};
export const GROUND_Y=690;
export const GROUND_SKY_KINDS=Object.freeze(['rock','log','thorn','hurdle','crate','shiba','pit','waterfall','willow','cherry','maple','oak','drone','hawk','eagle','pelican','plane','storm','pipe','forest','town','canopy']);

// Speed ramp (decision D11), tuned with scripts/chikun-difficulty-harness.mjs.
// Piecewise linear in fixed ticks and front-loaded across the hour: after a
// gentle three-minute warm-up the whole climb to about 7.1x happens by minute
// 15 (the v5 ramp took 49 minutes to get there), then it flattens. Each segment
// adds `slope / SPEED_SLOPE_UNIT` per tick from `from` to `to` (one unit per
// tick = +0.0549x per minute), so every speed is a dyadic rational and the
// running sum of speeds is exact in doubles.
export const SPEED_SLOPE_UNIT=65536;
export const SPEED_RAMP=Object.freeze([
 Object.freeze({from:0,to:10800,slope:1}),        // 0-3 min   1.00x -> 1.16x  learn the moves
 Object.freeze({from:10800,to:18000,slope:4}),    // 3-5 min   -> 1.60x
 Object.freeze({from:18000,to:25200,slope:11}),   // 5-7 min   -> 2.81x
 Object.freeze({from:25200,to:36000,slope:6}),    // 7-10 min  -> 3.80x
 Object.freeze({from:36000,to:43200,slope:15}),   // 10-12 min -> 5.45x
 Object.freeze({from:43200,to:54000,slope:10}),   // 12-15 min -> 7.10x  past 15 min is very rare
 Object.freeze({from:54000,to:216000,slope:2}),   // 15-60 min -> 12.04x
]);
export function speedAtTick(tick){
 const t=Math.max(0,Math.floor(tick));let units=0;
 for(const seg of SPEED_RAMP)units+=seg.slope*Math.max(0,Math.min(t,seg.to)-seg.from);
 return 1+units/SPEED_SLOPE_UNIT;
}
// Closed form of the sum of speedAtTick(k) for k < n. It is exact, so
// distanceAtTick(n) === 2.4 * (running sum of speedAtTick) with no drift.
export function speedSumBefore(tick){
 const n=Math.max(0,Math.floor(tick));let units=0;
 for(const seg of SPEED_RAMP){
  if(n<=seg.from)continue;
  // k in [from, min(n,to)) adds 0, 1, ..., inside-1 steps; every k >= to adds the full length.
  const inside=Math.min(n,seg.to)-seg.from;
  units+=seg.slope*(inside*(inside-1)/2+(n>seg.to?(seg.to-seg.from)*(n-seg.to):0));
 }
 return n+units/SPEED_SLOPE_UNIT;
}
export const distanceAtTick=tick=>2.4*speedSumBefore(tick);
export const courseRoll=(seed,index,salt=0)=>{let n=Math.imul((seed>>>0)^Math.imul(index+13,2654435761)^salt,2246822519)>>>0;n^=n>>>13;return (Math.imul(n,3266489917)>>>0)/4294967296;};

// Geometry ramp: the first DIFFICULTY_RAMP_START obstacles use the gentlest
// shapes, then obstacle i is built at difficulty (i - START) / SLOTS until the
// full-size course arrives with the second loop (index 48). Low passages start
// shallow (a mid-height cruise only has to dip), flight passages start short.
export const DIFFICULTY_RAMP_START=12;
export const DIFFICULTY_RAMP_SLOTS=36;
export const obstacleDifficulty=index=>Math.min(1,Math.max(0,Math.floor(index)-DIFFICULTY_RAMP_START)/DIFFICULTY_RAMP_SLOTS);
const lerp=(a,b,t)=>a+(b-a)*t;

const treeKinds=new Set(['willow','cherry','maple','oak']);
// Each region cycles its own passage list; the roll only picks within a passage,
// so the high / low / optional rhythm of a region is fixed and the loop back to
// farmland (index REGION_LOOP_SLOTS) reads the same table with fresh rolls.
export function courseKind(seed,index){
 const {region,local}=regionForObstacle(index);
 const choices=region.passages[local%region.passages.length];
 return choices[Math.floor(courseRoll(seed,index,41)*choices.length)];
}
// Buildings keep one collision silhouette; only the facade changes by region.
const townVariant={town:'town',city:'city',suburbs:'suburb'};
export function buildCourseObstacle({seed=1,index=0,tick=0,x=0,kind=courseKind(seed,index)}={}){
 const r=courseRoll(seed,index),floor=GROUND_Y,d=obstacleDifficulty(index);
 let width=100,y=floor,height=70,coinY=660,shapes=[],family='ground',variant=kind,route=passageRoute(kind);
 if(kind==='town')variant=townVariant[regionForObstacle(index).region.id]??'town';
 const rect=(rx,ry,w,h)=>({type:'rect',x:rx,y:ry,width:w,height:h});
 const circle=(cx,cy,radius)=>({type:'circle',x:cx,y:cy,radius});
 if(kind==='forest'||kind==='town'){
  family=kind;width=kind==='forest'?470:450;
  height=kind==='forest'?lerp(250,310,d)+r*lerp(40,65,d):lerp(220,270,d)+r*lerp(40,70,d);
  const count=kind==='forest'?4:3,slot=width/count;
  for(let i=0;i<count;i++){
   const h=height-(i%2)*38;
   // Closed silhouettes make the whole passage a readable fly-over. Rendering
   // uses these same extents for its trunks/canopies or walls and roof lines.
   shapes.push(rect(x+i*slot,floor-h,slot,h));
  }
  coinY=floor-height-65;
 }else if(kind==='canopy'||kind==='storm'){
  // Low passages hang from the sky down to `height`.
  family='sky';width=kind==='canopy'?330:280;height=lerp(440,580,d);y=0;
  shapes=[rect(x,0,width,height)];coinY=660;
 }else if(treeKinds.has(kind)){
  family='tree';height=lerp(200,235,d)+r*lerp(120,180,d);width=kind==='willow'?185:155;
  const cx=x+width/2,top=floor-height;
  shapes=[{type:'capsule',ax:cx,ay:floor,bx:cx,by:top+55,radius:12},circle(cx,top+68,width*.40),circle(cx-width*.22,top+101,width*.27),circle(cx+width*.23,top+106,width*.26)];
  coinY=Math.max(85,top-45);
 }else if(kind==='pit'||kind==='waterfall'){
  family='gap';width=kind==='waterfall'?520:420;height=kind==='waterfall'?180:36;
  shapes=[rect(x,floor+7,width,200)];
  if(kind==='waterfall')shapes.push(rect(x+24,floor-height,width-48,height+200));
  coinY=kind==='waterfall'?floor-height-60:510;
 }else if(['drone','hawk','eagle','pelican','plane'].includes(kind)){
  family='sky';width=kind==='plane'?235:kind==='drone'?154:110;
  const cycle=(tick+Math.floor(r*240))%240/240;
  const wave=cycle<.5?cycle*2:(1-cycle)*2;
  // Planes patrol the top band, so hugging the sky is never a safe lane.
  y=(kind==='plane'?100:kind==='drone'?340:410)+r*(kind==='plane'?50:70)+(wave*wave*(3-2*wave)-.5)*24;
  height=kind==='plane'?45:38;
  shapes=[{type:'capsule',ax:x+20,ay:y,bx:x+width-20,by:y,radius:height/2}];coinY=660;
 }else if(kind==='pipe'){
  height=lerp(120,140,d)+r*lerp(70,90,d);width=95;shapes=[rect(x,floor-height,width,height)];coinY=floor-height-60;
 }else{
  width={rock:76,log:112,thorn:100,hurdle:90,crate:78,shiba:110}[kind]??85;
  height={rock:50,log:48,thorn:64,hurdle:76,crate:76,shiba:65}[kind]??60;
  shapes=kind==='rock'?[circle(x+width/2,floor-20,32)]:[rect(x+7,floor-height,width-14,height)];
  coinY=floor-height-55;
 }
 return Object.freeze({id:`ground-sky-${index}`,index,kind:treeKinds.has(kind)?'tree':kind,variant,family,route,x,y,width,height,gapTop:30,gapBottom:family==='tree'?floor-height:family==='sky'?690:floor-height,gapCenter:coinY,
  shapes:Object.freeze(shapes.map(Object.freeze)),coin:Object.freeze({x:x+width/2,y:coinY,radius:19}),render:null});
}
// Screen x of obstacle `index` at `tick`: it enters at x = 1180 when the run has
// covered the distance of its slot, then scrolls with the course.
export const courseObstacleX=(index,tick)=>1180+distanceAtTick(index*COURSE_CADENCE)-distanceAtTick(tick);
export function courseObstacles(seed,tick){
 const t=Math.max(0,Math.floor(tick)),traveled=distanceAtTick(t),out=[];
 // Three slots back is always more than 2,400 px behind Chikun (speed >= 1).
 const first=Math.max(0,Math.floor(t/COURSE_CADENCE)-3);
 for(let index=first;index<first+8;index++){
  const x=1180+distanceAtTick(index*COURSE_CADENCE)-traveled;
  if(x>Math.max(1850,1280+2.4*speedAtTick(t)*220))break;
  const o=buildCourseObstacle({seed,index,tick:t,x});if(x+o.width>-100)out.push(o);
 }
 return out;
}
export function groundPickups(seed,tick,obstacles=courseObstacles(seed,tick)){
 const distance=distanceAtTick(tick),first=Math.max(0,Math.floor((distance-250)/175)),coins=[];
 for(let i=first;i<first+12;i++){
  const x=480+i*175-distance;if(x>1550)break;
  // Keep a 90px approach buffer around ground hazards and every gap.
  if(obstacles.some(o=>o.family!=='sky'&&x>o.x-90&&x<o.x+o.width+90))continue;
  coins.push({id:`ground-coin-${i}`,x,y:660,radius:17});
 }
 return coins;
}
