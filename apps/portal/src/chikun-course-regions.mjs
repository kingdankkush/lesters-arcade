// One continuous looping course (owner direction 2026-09-16). The run never
// resets: farmland → forest → town → city → industrial → suburbs → coast, then
// straight back into farmland at the current speed, score and difficulty.
// Regions are segments of obstacle slots (one slot per COURSE_CADENCE ticks),
// so the obstacle mix and the scenery share one schedule. Everything here is
// pure and allocation-free on the hot path; the runtime, the world renderer,
// the replay viewer and tests all read the same table.
// The scenery clock reads the course distance (chikun-ground-course.mjs). The two
// modules import each other, which is safe: neither uses the other at load time.
import {distanceAtTick} from './chikun-ground-course.mjs';
export const COURSE_CADENCE=340;
// Scenery switches when a region's first obstacle is 180 px from Chikun (it
// enters at x = 1180, so after 720 px of travel: REGION_LEAD_TICKS at 1x, fewer
// at speed), then cross-fades. The lead is a distance, so the first obstacles of
// a region never pass under the previous region's scenery as the course speeds up.
export const REGION_LEAD_TICKS=300;
export const REGION_LEAD_PX=2.4*REGION_LEAD_TICKS;
export const REGION_BLEND_TICKS=180;
const freeze=Object.freeze;
// Every visit to a region seeds where its low passages fall (see lowSlotsOf), so
// the loop cannot be memorised: `passages` are the slot lists without low
// passages, `low.kinds` the region's low passages, `low.count` how many one visit
// holds and `low.slots` the local slots that may host one.
const region=(id,name,terrain,passages,low,ambience)=>freeze({id,name,terrain,slots:passages.length,passages:freeze(passages.map(freeze)),
 low:freeze({kinds:freeze(low.kinds),count:low.count,slots:freeze(low.slots)}),ambience:freeze(ambience)});
// Passage design rules (pinned by tests/chikun-regions.test.mjs):
//  - every region visit mixes required flight passages, low passages and optional routes;
//  - a low passage (storm / canopy) always follows a landable stretch, never a gap,
//    never opens a region and never follows another low passage;
//  - plane slots (the top-band patrol) and the region's signature flight passages
//    (forests, towns) never give way to a low passage.
export const CHIKUN_REGIONS=freeze([
 region('farmland','Farmland','grass',[
  ['hurdle','log','crate'],['oak','willow'],['hawk','drone'],['crate','shiba','log'],['pit'],['shiba','crate','hurdle'],['oak','cherry'],['hawk','pelican'],
 ],{kinds:['storm'],count:1,slots:[2,3,6,7]},{sky:[236,214,168],dusk:[240,168,120]}),
 region('forest','Forest','loam',[
  ['rock','log','thorn'],['forest'],['cherry','willow'],['waterfall','pit'],['cherry','willow','maple','oak'],['hawk','eagle'],['forest'],['maple','oak'],
 ],{kinds:['canopy','storm'],count:2,slots:[2,5,7]},{sky:[196,222,196],dusk:[214,160,132]}),
 region('town','Town','cobble',[
  ['town'],['drone','hawk'],['hurdle','crate'],['town'],
 ],{kinds:['storm'],count:1,slots:[1,2]},{sky:[232,210,180],dusk:[238,164,126]}),
 region('city','City','asphalt',[
  ['town'],['drone','plane'],['pipe'],['drone','hawk'],['crate','hurdle'],['town'],['plane','drone'],['pipe'],
 ],{kinds:['storm','canopy'],count:1,slots:[2,3,4,7]},{sky:[188,206,224],dusk:[226,150,140]}),
 region('industrial','Industrial','concrete',[
  ['pipe'],['crate','hurdle'],['drone','plane'],['crate','log'],['pipe'],['pit'],
 ],{kinds:['storm','canopy'],count:1,slots:[1,3,4]},{sky:[214,196,176],dusk:[236,150,104]}),
 region('suburbs','Suburbs','pavement',[
  ['town'],['hurdle','log','crate'],['shiba','crate'],['oak','maple','cherry'],['drone','hawk'],['shiba','log'],
 ],{kinds:['storm'],count:1,slots:[1,2,4,5]},{sky:[226,206,214],dusk:[240,170,150]}),
 region('coast','Coast','sand',[
  ['rock','log'],['pelican','plane'],['waterfall','pit'],['willow'],['pelican','hawk'],['rock','crate'],['pit'],['rock','log','crate'],
 ],{kinds:['storm'],count:1,slots:[4,5]},{sky:[186,224,236],dusk:[244,178,134]}),
]);
const starts=[];let total=0;for(const r of CHIKUN_REGIONS){starts.push(total);total+=r.slots;}
export const REGION_START_SLOTS=freeze(starts);
export const REGION_LOOP_SLOTS=total;
export const REGION_LOOP_TICKS=REGION_LOOP_SLOTS*COURSE_CADENCE;
export const REGION_SCHEDULE=freeze(CHIKUN_REGIONS.map((r,i)=>freeze({id:r.id,name:r.name,startSlot:starts[i],slots:r.slots,startTick:starts[i]*COURSE_CADENCE,ticks:r.slots*COURSE_CADENCE})));
const GROUND_ROUTE=new Set(['storm','canopy']);
const GAP=new Set(['pit','waterfall']);
const FLIGHT_ROUTE=new Set(['forest','town','pit','waterfall','willow','cherry','maple','oak','pipe']);
export const passageRoute=kind=>GROUND_ROUTE.has(kind)?'ground':FLIGHT_ROUTE.has(kind)?'flight':'choice';
export const isGapKind=kind=>GAP.has(kind);
// Every way to place a region's `low.count` low passages on its `low.slots`
// without two of them in adjacent slots, in a fixed order.
const LOW_COMBOS=freeze(CHIKUN_REGIONS.map(r=>{
 const out=[],pick=(from,chosen)=>{
  if(chosen.length===r.low.count){out.push(freeze([...chosen]));return;}
  for(let i=from;i<r.low.slots.length;i++){const slot=r.low.slots[i];if(chosen.length&&slot-chosen[chosen.length-1]<2)continue;pick(i+1,[...chosen,slot]);}
 };
 pick(0,[]);return freeze(out);
}));
export const REGION_LOW_COMBOS=LOW_COMBOS;
// The local slots holding low passages in one region visit; `roll` is a seeded
// uniform in [0, 1) for that visit (chikun-ground-course.mjs courseKind).
export function lowSlotsOf(regionIndex,roll){const combos=LOW_COMBOS[regionIndex];return combos[Math.min(combos.length-1,Math.floor(roll*combos.length))];}
function regionIndexForSlot(slot){
 const s=((slot%REGION_LOOP_SLOTS)+REGION_LOOP_SLOTS)%REGION_LOOP_SLOTS;
 let i=CHIKUN_REGIONS.length-1;while(i>0&&starts[i]>s)i--;
 return i;
}
// Obstacle index → region, slot within the region and how many loops are complete.
export function regionForObstacle(index=0){
 const slot=Math.max(0,Math.floor(index)),i=regionIndexForSlot(slot);
 return {region:CHIKUN_REGIONS[i],index:i,local:slot%REGION_LOOP_SLOTS-starts[i],loop:Math.floor(slot/REGION_LOOP_SLOTS)};
}
// The scenery clock: the slot-timeline tick the scenery shows at `tick`, i.e. the
// last tick by which the course had covered REGION_LEAD_PX less than it has now.
// It is tick - 300 at 1x and closes up at speed; slot i's scenery takes over as
// obstacle i comes within 180 px of Chikun. Rendering only (never in evidence).
let memoTick=-1,memoScenery=0;
export function sceneryTick(tick=0){
 const t=Math.max(0,Math.floor(Number(tick)||0));
 if(t===memoTick)return memoScenery;
 const target=distanceAtTick(t)-REGION_LEAD_PX;
 let lo=0;
 if(target>0){
  // Covering 720 px takes at most 300 ticks (speed >= 1), so the answer lies in [t - 300, t).
  lo=Math.max(0,t-REGION_LEAD_TICKS);let hi=t;
  while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(distanceAtTick(mid)<=target)lo=mid;else hi=mid;}
 }
 memoTick=t;memoScenery=lo;
 return lo;
}
// The first tick whose scenery shows obstacle slot `slot` (its region's switch
// when `slot` opens a region): the tick obstacle `slot` comes within 180 px.
export function regionSwitchTick(slot=0){
 const start=Math.max(0,Math.floor(Number(slot)||0))*COURSE_CADENCE;
 if(start===0)return 0;
 let lo=start,hi=start+REGION_LEAD_TICKS;
 while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(sceneryTick(mid)>=start)hi=mid;else lo=mid;}
 return sceneryTick(lo)>=start?lo:hi;
}
// Scenery state for a tick. `out` is reused by callers so drawing allocates nothing.
export function courseRegionState(tick=0,out={}){
 const t=sceneryTick(tick),local=t%REGION_LOOP_TICKS;
 const slot=Math.floor(local/COURSE_CADENCE),i=regionIndexForSlot(slot),r=CHIKUN_REGIONS[i];
 const start=starts[i]*COURSE_CADENCE,end=start+r.slots*COURSE_CADENCE;
 const blend=Math.max(0,Math.min(1,(local-(end-REGION_BLEND_TICKS))/REGION_BLEND_TICKS));
 out.index=i;out.region=r;out.next=CHIKUN_REGIONS[(i+1)%CHIKUN_REGIONS.length];out.nextIndex=(i+1)%CHIKUN_REGIONS.length;
 out.blend=blend;out.loop=Math.floor(t/REGION_LOOP_TICKS);out.localTick=local-start;out.name=r.name;out.terrain=r.terrain;out.nextTerrain=out.next.terrain;
 return out;
}
const scratch={};
export function courseRegion(tick=0){return courseRegionState(tick,scratch).name;}
export function courseTerrain(tick=0){return courseRegionState(tick,scratch).terrain;}
