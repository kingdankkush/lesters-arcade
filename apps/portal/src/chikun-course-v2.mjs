// Course two: deterministic additions. The released v6 course is untouched.
import {courseObstacles,groundPickups,distanceAtTick,courseRoll,COURSE_CADENCE} from './chikun-ground-course.mjs';
import {REGION_LOOP_SLOTS} from './chikun-course-regions.mjs';
export {distanceAtTick,speedAtTick,courseRegion,courseTerrain} from './chikun-ground-course.mjs';
const freeze=Object.freeze;
export function courseV2Obstacles(seed,tick){
 return courseObstacles(seed,tick).map(o=>{
  // A raised bramble bank leaves two visibly separate routes: a clear lower
  // path and a five-coin flight path. Choosing height needs no new lane button.
  if(o.index%8!==5)return o;
  const width=300;
  return freeze({...o,kind:'fork-route',variant:'fork-route',family:'fork-route',route:'choice',width,height:150,y:390,gapCenter:310,
   shapes:freeze([freeze({type:'rect',x:o.x,y:390,width,height:150})]),
   coin:freeze({x:o.x+width/2,y:315,radius:19}),
   routeCoins:freeze(Array.from({length:5},(_,i)=>freeze({id:i===2?o.id:`route-${o.index}-${i}`,x:o.x+(i===2?150:25+i*62),y:315,radius:17}))),
  });
 });
}
export function courseV2GroundPickups(seed,tick,obstacles=courseV2Obstacles(seed,tick)){
 // Raised route banks do not block the safe ground path beneath them.
 return groundPickups(seed,tick,obstacles.filter(o=>o.family!=='fork-route'));
}
export function courseV2Pickups(seed,tick){
 const distance=distanceAtTick(tick),out=[];
 const first=Math.max(0,Math.floor(tick/(COURSE_CADENCE*4))-1);
 for(let slot=first;slot<first+6;slot++){
  const x=480+distanceAtTick(slot*COURSE_CADENCE*4)-distance;
  if(x>1600)break;
  if(x< -70)continue;
  const kind=['shield','magnet','feather'][slot%3];
  out.push(freeze({id:`power-${slot}`,kind,x,y:660,radius:23}));
 }
 return out;
}
export function courseV2Chase(seed,tick){
 const lapTicks=REGION_LOOP_SLOTS*COURSE_CADENCE,lap=Math.floor(tick/lapTicks);
 const start=lap*lapTicks+1800+Math.floor(courseRoll(seed,lap,0x51c7)*1200);
 const age=tick-start;
 if(age<0||age>=720)return null;
 const kind=courseRoll(seed,lap,0x721a)<.5?'tractor':'hawk';
 const telegraph=age<120,x=-180+Math.max(0,age-120)*.64;
 return freeze({id:`chase-${lap}`,kind,telegraph,remainingTicks:720-age,x,y:kind==='tractor'?596:310,width:138,height:94,
  shapes:freeze(telegraph?[]:[freeze({type:'rect',x:x+12,y:kind==='tractor'?606:328,width:112,height:kind==='tractor'?84:40})])});
}
