// Canonical v3 course. Shared by the child, parent verifier and replay viewer.
// Obstacle placement is frozen for historical replays; only the cosmetic region
// and terrain labels follow the current seven-region loop.
export {courseRegion,courseTerrain} from './chikun-course-regions.mjs';
export const GROUND_Y=690;
export const GROUND_SKY_KINDS=Object.freeze(['rock','log','thorn','hurdle','crate','shiba','pit','waterfall','willow','cherry','maple','oak','drone','hawk','eagle','pelican','plane','storm','pipe']);
export const speedAtTick=tick=>1+Math.max(0,tick)/28800;
// Sum of the exact per-step speed; no integration drift during seeking.
export const distanceAtTick=tick=>{const n=Math.max(0,Math.floor(tick));return 2.4*(n+n*(n-1)/57600);};
const tickAtDistance=d=>(-57599+Math.sqrt(57599**2+4*Math.max(0,d)/2.4*57600))/2;
export const courseRoll=(seed,index,salt=0)=>{let n=Math.imul((seed>>>0)^Math.imul(index+13,2654435761)^salt,2246822519)>>>0;n^=n>>>13;return (Math.imul(n,3266489917)>>>0)/4294967296;};
const treeKinds=new Set(['willow','cherry','maple','oak']);
const intro=['rock','log','hurdle','cherry','drone','pit','crate','thorn','storm','shiba','waterfall','hawk'];
export function courseKind(seed,index){
 if(index<intro.length)return intro[index];
 // Low and high passages have a full recovery interval; hazards never stack.
 return GROUND_SKY_KINDS[(index+Math.floor(courseRoll(seed,Math.floor(index/19),17)*19))%19];
}
export function buildCourseObstacle({seed=1,index=0,tick=0,x=0,kind=courseKind(seed,index)}={}){
 const r=courseRoll(seed,index),floor=GROUND_Y;
 let width=100,y=floor,height=70,coinY=660,shapes=[],family='ground',variant=kind;
 const rect=(rx,ry,w,h)=>({type:'rect',x:rx,y:ry,width:w,height:h});
 const circle=(cx,cy,radius)=>({type:'circle',x:cx,y:cy,radius});
 if(treeKinds.has(kind)){
  family='tree';height=235+r*180;width=kind==='willow'?185:155;
  const cx=x+width/2,top=floor-height;
  shapes=[{type:'capsule',ax:cx,ay:floor,bx:cx,by:top+55,radius:12},circle(cx,top+68,width*.40),circle(cx-width*.22,top+101,width*.27),circle(cx+width*.23,top+106,width*.26)];
  coinY=Math.max(85,top-45);
 }else if(kind==='pit'||kind==='waterfall'){
  family='gap';width=kind==='waterfall'?220:155;height=36;shapes=[rect(x,floor+7,width,200)];coinY=540;
 }else if(kind==='storm'){
  family='sky';width=240;height=490;y=0;shapes=[rect(x,0,width,height)];coinY=660;
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
 return Object.freeze({id:`ground-sky-${index}`,index,kind:treeKinds.has(kind)?'tree':kind,variant,family,x,y,width,height,gapTop:30,gapBottom:family==='tree'?floor-height:family==='sky'?690:floor-height,gapCenter:coinY,
  shapes:Object.freeze(shapes.map(Object.freeze)),coin:Object.freeze({x:x+width/2,y:coinY,radius:19}),render:null});
}
export function courseObstacles(seed,tick){
 const traveled=distanceAtTick(tick),first=Math.max(0,Math.floor(tickAtDistance(traveled-1500)/280)-1),out=[];
 for(let index=first;index<first+8;index++){
  const x=1180+distanceAtTick(index*280)-traveled;
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
