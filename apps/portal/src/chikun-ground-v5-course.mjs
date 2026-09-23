// Frozen v5 course (chikun-flap-evidence-v5, cabinet 0.8.0) for historical replay.
// Byte copy of chikun-ground-course.mjs and chikun-course-regions.mjs as of 43a31c65,
// before the chikun-tune retune. It carries its own region passage table,
// COURSE_CADENCE, speed functions and scenery schedule, because courseKind reads
// the region table. Never edit: v5 evidence must keep replaying exactly.
// ---- frozen copy of chikun-course-regions.mjs ----
// One continuous looping course (owner direction 2026-09-16). The run never
// resets: farmland → forest → town → city → industrial → suburbs → coast, then
// straight back into farmland at the current speed, score and difficulty.
// Regions are segments of obstacle slots (one slot per COURSE_CADENCE ticks),
// so the obstacle mix and the scenery share one schedule. Everything here is
// pure and allocation-free on the hot path; the runtime, the world renderer,
// the replay viewer and tests all read the same table.
export const COURSE_CADENCE=340;
// Scenery switches when a region's first obstacle is about to reach Chikun
// (900 px of travel ≈ 375 ticks at 1×, fewer later), then cross-fades.
export const REGION_LEAD_TICKS=300;
export const REGION_BLEND_TICKS=180;
const freeze=Object.freeze;
const region=(id,name,terrain,passages,ambience)=>freeze({id,name,terrain,slots:passages.length,passages:freeze(passages.map(freeze)),ambience:freeze(ambience)});
// Passage design rules (pinned by tests/chikun-regions.test.mjs):
//  - every region mixes required flight passages, low passages and optional routes;
//  - a low passage (storm / canopy) always follows a landable stretch, never a gap.
export const CHIKUN_REGIONS=freeze([
 region('farmland','Farmland','grass',[
  ['hurdle','log','crate'],['oak','willow'],['hawk','drone'],['storm'],['pit'],['shiba','crate','hurdle'],['oak','cherry'],['hawk','pelican'],
 ],{sky:[236,214,168],dusk:[240,168,120]}),
 region('forest','Forest','loam',[
  ['rock','log','thorn'],['forest'],['canopy','storm'],['waterfall','pit'],['cherry','willow','maple','oak'],['hawk','eagle'],['forest'],['canopy'],
 ],{sky:[196,222,196],dusk:[214,160,132]}),
 region('town','Town','cobble',[
  ['town'],['drone','hawk'],['storm'],['town'],
 ],{sky:[232,210,180],dusk:[238,164,126]}),
 region('city','City','asphalt',[
  ['town'],['drone','plane'],['pipe'],['storm','canopy'],['crate','hurdle'],['town'],['plane','drone'],['pipe'],
 ],{sky:[188,206,224],dusk:[226,150,140]}),
 region('industrial','Industrial','concrete',[
  ['pipe'],['crate','hurdle'],['drone','plane'],['storm','canopy'],['pipe'],['pit'],
 ],{sky:[214,196,176],dusk:[236,150,104]}),
 region('suburbs','Suburbs','pavement',[
  ['town'],['hurdle','log','crate'],['shiba','crate'],['oak','maple','cherry'],['drone','hawk'],['storm'],
 ],{sky:[226,206,214],dusk:[240,170,150]}),
 region('coast','Coast','sand',[
  ['rock','log'],['pelican','plane'],['waterfall','pit'],['willow'],['pelican','hawk'],['storm'],['pit'],['rock','log','crate'],
 ],{sky:[186,224,236],dusk:[244,178,134]}),
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
// Scenery state for a tick. `out` is reused by callers so drawing allocates nothing.
export function courseRegionState(tick=0,out={}){
 const t=Math.max(0,Math.floor(Number(tick)||0)-REGION_LEAD_TICKS),local=t%REGION_LOOP_TICKS;
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
// ---- frozen copy of chikun-ground-course.mjs ----
// Obstacle mix and scenery follow the seven-region loop in chikun-course-regions.mjs.
export const GROUND_Y=690;
export const GROUND_SKY_KINDS=Object.freeze(['rock','log','thorn','hurdle','crate','shiba','pit','waterfall','willow','cherry','maple','oak','drone','hawk','eagle','pelican','plane','storm','pipe','forest','town','canopy']);
export const speedAtTick=tick=>1+Math.max(0,tick)/28800;
// Sum of the exact per-step speed; no integration drift during seeking.
export const distanceAtTick=tick=>{const n=Math.max(0,Math.floor(tick));return 2.4*(n+n*(n-1)/57600);};
const tickAtDistance=d=>(-57599+Math.sqrt(57599**2+4*Math.max(0,d)/2.4*57600))/2;
export const courseRoll=(seed,index,salt=0)=>{let n=Math.imul((seed>>>0)^Math.imul(index+13,2654435761)^salt,2246822519)>>>0;n^=n>>>13;return (Math.imul(n,3266489917)>>>0)/4294967296;};
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
 const r=courseRoll(seed,index),floor=GROUND_Y;
 let width=100,y=floor,height=70,coinY=660,shapes=[],family='ground',variant=kind,route=passageRoute(kind);
 if(kind==='town')variant=townVariant[regionForObstacle(index).region.id]??'town';
 const rect=(rx,ry,w,h)=>({type:'rect',x:rx,y:ry,width:w,height:h});
 const circle=(cx,cy,radius)=>({type:'circle',x:cx,y:cy,radius});
 if(kind==='forest'||kind==='town'){
  family=kind;width=kind==='forest'?470:450;height=kind==='forest'?310+r*65:270+r*70;
  const count=kind==='forest'?4:3,slot=width/count;
  for(let i=0;i<count;i++){
   const h=height-(i%2)*38;
   // Closed silhouettes make the whole passage a readable fly-over. Rendering
   // uses these same extents for its trunks/canopies or walls and roof lines.
   shapes.push(rect(x+i*slot,floor-h,slot,h));
  }
  coinY=floor-height-65;
 }else if(kind==='canopy'){
  family='sky';width=330;height=580;y=0;
  shapes=[rect(x,0,width,height)];coinY=660;
 }else if(treeKinds.has(kind)){
  family='tree';height=235+r*180;width=kind==='willow'?185:155;
  const cx=x+width/2,top=floor-height;
  shapes=[{type:'capsule',ax:cx,ay:floor,bx:cx,by:top+55,radius:12},circle(cx,top+68,width*.40),circle(cx-width*.22,top+101,width*.27),circle(cx+width*.23,top+106,width*.26)];
  coinY=Math.max(85,top-45);
 }else if(kind==='pit'||kind==='waterfall'){
  family='gap';width=kind==='waterfall'?520:420;height=kind==='waterfall'?180:36;
  shapes=[rect(x,floor+7,width,200)];
  if(kind==='waterfall')shapes.push(rect(x+24,floor-height,width-48,height+200));
  coinY=kind==='waterfall'?floor-height-60:510;
 }else if(kind==='storm'){
  family='sky';width=280;height=580;y=0;shapes=[rect(x,0,width,height)];coinY=660;
 }else if(['drone','hawk','eagle','pelican','plane'].includes(kind)){
  family='sky';width=kind==='plane'?235:kind==='drone'?154:110;
  const cycle=(tick+Math.floor(r*240))%240/240;
  const wave=cycle<.5?cycle*2:(1-cycle)*2;
  y=(kind==='plane'?190:kind==='drone'?340:410)+r*70+(wave*wave*(3-2*wave)-.5)*24;
  height=kind==='plane'?45:38;
  shapes=[{type:'capsule',ax:x+20,ay:y,bx:x+width-20,by:y,radius:height/2}];coinY=660;
 }else if(kind==='pipe'){
  height=140+r*90;width=95;shapes=[rect(x,floor-height,width,height)];coinY=floor-height-60;
 }else{
  width={rock:76,log:112,thorn:100,hurdle:90,crate:78,shiba:110}[kind]??85;
  height={rock:50,log:48,thorn:64,hurdle:76,crate:76,shiba:65}[kind]??60;
  shapes=kind==='rock'?[circle(x+width/2,floor-20,32)]:[rect(x+7,floor-height,width-14,height)];
  coinY=floor-height-55;
 }
 return Object.freeze({id:`ground-sky-${index}`,index,kind:treeKinds.has(kind)?'tree':kind,variant,family,route,x,y,width,height,gapTop:30,gapBottom:family==='tree'?floor-height:family==='sky'?690:floor-height,gapCenter:coinY,
  shapes:Object.freeze(shapes.map(Object.freeze)),coin:Object.freeze({x:x+width/2,y:coinY,radius:19}),render:null});
}
export function courseObstacles(seed,tick){
 const traveled=distanceAtTick(tick),first=Math.max(0,Math.floor(tickAtDistance(traveled-1500)/COURSE_CADENCE)-1),out=[];
 for(let index=first;index<first+8;index++){
  const x=1180+distanceAtTick(index*COURSE_CADENCE)-traveled;
  if(x>Math.max(1850,1280+2.4*speedAtTick(tick)*220))break;
  const o=buildCourseObstacle({seed,index,tick,x});if(x+o.width>-100)out.push(o);
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
