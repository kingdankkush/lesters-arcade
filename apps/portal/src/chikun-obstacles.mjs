import geometry from '../../chikun/assets/obstacle-shapes.json' with {type:'json'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const roll=(seed,i)=>{let n=Math.imul((seed>>>0)^Math.imul(i+13,2654435761),2246822519)>>>0;n^=n>>>13;return (Math.imul(n,3266489917)>>>0)/4294967295;};
const freeze=shapes=>Object.freeze(shapes.map(s=>Object.freeze(s)));
export function buildChikunObstacle({seed=1,index=0,tick=0,x=0,safeGapHeight=320}={}) {
 const kind=['gate','tree','drone','tree','drone','gate'][index%6],floor=690;
 let width=130,y=360,gapCenter=360,gapTop=200,gapBottom=520,render=null,shapes=[];
 if(kind==='gate') {
  const half=safeGapHeight/2;gapCenter=half+38+roll(seed,index)*(720-(half+38)*2);gapTop=gapCenter-half;gapBottom=gapCenter+half;
  shapes=[{type:'rect',x,y:0,width,height:gapTop},{type:'rect',x,y:gapBottom,width,height:720-gapBottom}];
 } else if(kind==='tree') {
  const scale=64+roll(seed,index)*24; width=geometry.tree.frameWidth*scale;
  const center=x+width/2;
  shapes=geometry.tree.crown.map(([cx,z,r])=>({type:'circle',x:center+cx*scale,y:floor-z*scale,radius:r*scale*.90}));
  shapes.push({type:'capsule',ax:center,ay:floor-.08*scale,bx:center,by:floor-3.1*scale,radius:.16*scale});
  render={x,y:floor-geometry.tree.frameHeight*scale,width,height:geometry.tree.frameHeight*scale};
  gapCenter=Math.max(120,floor-4.45*scale-78);gapTop=30;gapBottom=floor-4.45*scale;y=floor;
 } else {
  const scale=46; width=geometry.drone.frameWidth*scale;
  const cycle=((tick+Math.floor(roll(seed,index+49)*240))%240)/240;
  const halfCycle=cycle<.5?cycle*2:(1-cycle)*2;
  const hover=2*halfCycle*halfCycle*(3-2*halfCycle)-1;
  const baseY=225+roll(seed,index)*255;
  y=baseY+22*hover;
  shapes=[{type:'capsule',ax:x+width/2-1.28*scale,ay:y,bx:x+width/2+1.28*scale,by:y,radius:.27*scale}];
  render={x,y:y-geometry.drone.frameHeight*scale/2,width,height:geometry.drone.frameHeight*scale};
  gapCenter=baseY<355?y+130:y-130;gapTop=clamp(gapCenter-120,30,600);gapBottom=clamp(gapCenter+120,120,690);
 }
 return Object.freeze({id:`obstacle-${index}`,index,kind,x,y,width,gapCenter,gapTop,gapBottom,render:render?Object.freeze(render):null,shapes:freeze(shapes),coin:Object.freeze({x:x+width/2,y:gapCenter,radius:24})});
}
function segmentDistance(x,y,s) {
 const dx=s.bx-s.ax,dy=s.by-s.ay,den=dx*dx+dy*dy;
 const t=den?clamp(((x-s.ax)*dx+(y-s.ay)*dy)/den,0,1):0;
 return Math.hypot(x-s.ax-t*dx,y-s.ay-t*dy)-s.radius;
}
export function obstacleClearance(obstacle,x,y,radius=0) {
 let distance=Infinity;
 for(const s of obstacle.shapes??[]) {
  let d;
  if(s.type==='circle')d=Math.hypot(x-s.x,y-s.y)-s.radius;
  else if(s.type==='capsule')d=segmentDistance(x,y,s);
  else {
   const dx=Math.abs(x-s.x-s.width/2)-s.width/2,dy=Math.abs(y-s.y-s.height/2)-s.height/2;
   d=Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0);
  }
  distance=Math.min(distance,d-radius);
 }
 return distance;
}
