import {CHIKUN_REGIONS,courseRegionState} from '../../portal/src/chikun-course-regions.mjs';
import {sceneBus} from './scene-bus.mjs';
import {readDeviceFrame,blitPeriodic} from './device-blit.mjs';
import {seamX} from './parallax.mjs';
import {rgba} from './light-rig.mjs';
import {prefetchObstacleArt,scheduleObstacleArt,drawObstacleArt,drawCoinArt,drawLowPassageHint,drawStormWeather,obstacleArt} from './obstacle-art.mjs';
const TAU=Math.PI*2;
// Obstacles draw from the rendered v2 kits (obstacle-art.mjs). The 1.8.2
// sprites (chikun-ground-props-v1) are only the fallback: they download when a
// v2 kit fails, never alongside it.
const propNames=['willow','cherry','maple','oak','rock','log','crate','hurdle','thorn','shiba','hawk','eagle','pelican','plane'];
const art=new Map();
let legacyRequested=false;
function loadLegacyArt(){
 if(legacyRequested||typeof Image==='undefined')return Promise.resolve();
 legacyRequested=true;
 return Promise.allSettled(propNames.filter(n=>!art.has(n)).map(async name=>{const img=new Image();img.src='/assets/generated/chikun-ground-props-v1/'+name+'.webp';try{await img.decode();art.set(name,img);}catch{}}));
}
// main.mjs calls this at boot: start the common and first-region obstacle kits.
export function loadGroundArt(){
 try{prefetchObstacleArt();}catch{}
 return Promise.resolve();
}
function debugFlag(name){try{return typeof location!=='undefined'&&Boolean(new URLSearchParams(location.search).get('chikunDebug')?.split(',').includes(name));}catch{return false;}}
const debugHitbox=debugFlag('hitbox');
// Terrain strips per region (RGB so the blend between regions costs nothing).
const colors={
 grass:[[87,108,50],[141,165,75],[66,53,34]],loam:[[96,82,52],[140,120,76],[58,44,30]],cobble:[[122,116,104],[168,160,144],[70,66,60]],
 asphalt:[[52,62,67],[114,123,120],[32,43,50]],concrete:[[119,123,113],[189,190,170],[66,75,78]],pavement:[[150,146,136],[196,192,180],[88,84,78]],sand:[[207,184,120],[240,219,160],[165,129,83]],
 dirt:[[170,128,81],[210,169,107],[103,67,46]],
};
const URBAN=new Set(['asphalt','concrete','cobble','pavement']);
const regionScratch={},frameScratch={};
const lerp=(a,b,t)=>Math.round(a+(b-a)*t);
const blendColor=(a,b,t)=>t<=0?'rgb('+a[0]+','+a[1]+','+a[2]+')':'rgb('+lerp(a[0],b[0],t)+','+lerp(a[1],b[1],t)+','+lerp(a[2],b[2],t)+')';
const detail={grass:['#9aad53','#527542'],loam:['#8f9c58','#5c4a30'],sand:['#e6d7a0','#b89a5c'],dirt:['#c9a570','#7a5236']};
const FRONT_TOP=686,MAX_GAPS=6;
const gaps=new Float64Array(MAX_GAPS*2);let gapCount=0;
const pmod=(a,n)=>((a%n)+n)%n;
// Gaps inside the view only: the ground reacts to an obstacle once it is on
// screen, never earlier (look-ahead guard).
function collectGaps(forks,view){
 gapCount=0;const left=view.left,right=view.left+view.width;
 for(const o of forks??[]){if(o.family!=='gap'||o.x>=right||o.x+o.width<=left)continue;if(gapCount<MAX_GAPS){gaps[gapCount*2]=o.x;gaps[gapCount*2+1]=o.x+o.width;gapCount++;}}
}
function inGap(x,pad=0){for(let i=0;i<gapCount;i++)if(x>gaps[i*2]-pad&&x<gaps[i*2+1]+pad)return true;return false;}
// The code-drawn strip (the fallback when the front-face art is missing), clipped to [x0, x1) logical.
function drawCodeStrip(ctx,terrainFrom,terrainTo,t,distance,x0,x1){
 if(x1<=x0)return;
 const from=colors[terrainFrom]??colors.grass,to=colors[terrainTo]??from;
 const base=blendColor(from[0],to[0],t),edge=blendColor(from[1],to[1],t),under=blendColor(from[2],to[2],t);
 const terrain=t<.5?terrainFrom:terrainTo,urban=URBAN.has(terrain),[tuftA,tuftB]=detail[terrain]??detail.grass;
 ctx.fillStyle=under;ctx.fillRect(x0,690,x1-x0,30);ctx.fillStyle=base;ctx.fillRect(x0,690,x1-x0,13);ctx.fillStyle=edge;ctx.fillRect(x0,690,x1-x0,3);
 const first=Math.floor((x0+distance)/43)-1,last=Math.ceil((x1+distance)/43)+1;
 for(let world=first;world<=last;world++){
  const x=world*43-distance;
  if(x<x0-20||x>x1||inGap(x,8))continue;
  if(urban){ctx.strokeStyle=under;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,705);ctx.lineTo(x+16,707);ctx.lineTo(x+19,720);ctx.stroke();if(pmod(world,5)===0){ctx.fillStyle=edge;ctx.fillRect(x,714,32,2);}if(terrain==='cobble'&&pmod(world,2)===0){ctx.fillStyle=edge;ctx.fillRect(x+4,696,12,4);}}
  else if(terrain==='sand'){if(pmod(world,2)===0){ctx.strokeStyle=tuftA;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,697);ctx.quadraticCurveTo(x+10,694,x+20,697);ctx.stroke();}if(pmod(world,5)===0){ctx.fillStyle=tuftB;ctx.beginPath();ctx.arc(x+8,700,2,0,TAU);ctx.fill();}ctx.fillStyle=under;ctx.fillRect(x+12,706,4+pmod(world,5),2);}
  else{
   ctx.strokeStyle=pmod(world,3)===0?tuftA:tuftB;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,690);ctx.lineTo(x-4,681);ctx.moveTo(x+2,690);ctx.lineTo(x+5,680);ctx.stroke();
   if(pmod(world,4)===0&&terrain==='grass'){ctx.fillStyle=['#f0c865','#e8a4bc','#d5d5b2'][pmod(world,3)];ctx.beginPath();ctx.arc(x+5,680,2.4,0,TAU);ctx.fill();}
   ctx.fillStyle=under;ctx.fillRect(x+12,702,5+pmod(world,7),2);
  }
 }
}
// Front-face art for one region between device x0 and x1, skipping in-view gaps.
function drawFrontArt(ctx,bus,face,frame,distance,x0,x1,alpha){
 const d=frame.density;
 const scroll=(distance+frame.viewLeft-frame.shakeX)*d;
 const y=Math.round((FRONT_TOP+frame.shakeY)*d);
 ctx.globalAlpha=alpha;
 let from=x0;
 for(let i=0;i<=gapCount;i++){
  const g0=i<gapCount?(gaps[i*2]-frame.viewLeft+frame.shakeX)*d:x1,g1=i<gapCount?(gaps[i*2+1]-frame.viewLeft+frame.shakeX)*d:x1;
  const to=Math.min(x1,g0);
  if(to>from){
   if(Math.abs(face.density-d)<1e-3)blitPeriodic(ctx,face.canvas,face.w,scroll,y,Math.floor(from),Math.ceil(to),true);
   else{
    // Briefly after a rotation: the previous prescale, drawn scaled and clipped.
    const k=d/face.density,period=face.w*k;ctx.save();ctx.beginPath();ctx.rect(from,0,to-from,frame.canvasHeight);ctx.clip();
    for(let x=-(((scroll%period)+period)%period);x<to;x+=period)ctx.drawImage(face.canvas,x,y,period,face.h*k);ctx.restore();
   }
  }
  from=Math.max(from,g1);
 }
 ctx.globalAlpha=1;
}
export function drawGround(ctx,snapshot,{reduced=false,view=null}={}){
 const bus=sceneBus,v=view??bus.view,distance=snapshot.distancePixels??0,tick=snapshot.tick??0,state=courseRegionState(tick,regionScratch);
 collectGaps(snapshot.forks,v);
 const frame=readDeviceFrame(ctx,v,frameScratch);frame.viewLeft=v.left;
 // Obstacle kits follow the scenery clock (never the obstacle list).
 try{scheduleObstacleArt(tick,frame.density);}catch{}
 const sameFrame=Boolean(bus.tick===tick&&bus.region&&bus.transition&&bus.view===v);
 const t=sameFrame?bus.transition:null,loader=sameFrame?bus.art:null;
 const faceOf=index=>loader?.layer(CHIKUN_REGIONS[index].id,'front')??null;
 // Segments of the running line by region: previous | current | next, split at the seams.
 const segs=[];
 if(t&&t.seams&&!reduced){
  const toDev=x=>(x-v.left+frame.shakeX)*frame.density;
  const xp=Number.isFinite(t.Dprev)?Math.max(0,Math.min(frame.canvasWidth,toDev(seamX(t.Dprev,distance,1)))):0;
  const xn=Math.max(0,Math.min(frame.canvasWidth,toDev(seamX(t.Dnext,distance,1))));
  if(xp>0)segs.push([t.prev,0,xp,1]);
  if(xn>xp)segs.push([t.cur,xp,xn,1]);
  if(xn<frame.canvasWidth)segs.push([t.next,xn,frame.canvasWidth,1]);
 }else{
  segs.push([state.index,0,frame.canvasWidth,1]);
  if(state.blend>0)segs.push([state.nextIndex,0,frame.canvasWidth,state.blend]);
 }
 if(segs.some(s=>faceOf(s[0]))){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  for(const [index,x0,x1,alpha] of segs){
   const face=faceOf(index);
   if(face)drawFrontArt(ctx,bus,face,frame,distance,x0,x1,alpha);
   else{
    // Missing art for this segment: the code strip, drawn in logical space.
    ctx.save();ctx.setTransform(frame.density,0,0,frame.density,(-v.left+frame.shakeX)*frame.density,frame.shakeY*frame.density);
    ctx.globalAlpha=alpha;const tr=CHIKUN_REGIONS[index].terrain;
    drawCodeStrip(ctx,tr,tr,0,distance,x0/frame.density+v.left-frame.shakeX,x1/frame.density+v.left-frame.shakeX);ctx.restore();
   }
  }
  // Time-of-day grade on the opaque cut face (ground class strength 0.85).
  const g=bus.rig?.grade;
  if(g){
   const y=Math.round((690+frame.shakeY)*frame.density),h=frame.canvasHeight-y;
   if(g.w>.002){ctx.fillStyle=rgba(g.W,g.w*.85);ctx.fillRect(0,y,frame.canvasWidth,h);}
   if(g.a>.002){ctx.fillStyle=rgba(g.D,g.a*.85);ctx.fillRect(0,y,frame.canvasWidth,h);}
  }
  ctx.restore();
 }else drawCodeStrip(ctx,snapshot.terrain??state.terrain,state.nextTerrain,state.blend,distance,v.left-4,v.left+v.width+4);
 const c=snapshot.chikun;
 if(c&&!snapshot.terminal){const altitude=690-c.y;ctx.fillStyle='rgba(10,25,24,.20)';ctx.beginPath();ctx.ellipse(c.x,693,Math.max(9,25-altitude*.028),3,0,0,TAU);ctx.fill();}
 for(const coin of snapshot.groundCoins??[])if(!coin.collected)drawGroundCoin(ctx,coin,snapshot.tick,reduced);
}
export function drawGroundCoin(ctx,c,tick=0,reduced=false){
 if(drawCoinArt(ctx,c,tick,reduced))return;
 ctx.save();ctx.translate(c.x,c.y);ctx.scale(reduced?1:.86+.14*Math.cos(tick*.07+c.x*.01),1);ctx.fillStyle='#d8e4e2';ctx.strokeStyle='#7caaa8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,c.radius,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#35656b';ctx.font=`800 ${c.radius*1.35}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Ł',0,1);ctx.restore();
}
function shapeFallback(ctx,o){
 ctx.fillStyle=o.family==='tree'?'#507642':'#a59572';ctx.strokeStyle=ctx.fillStyle;
 for(const s of o.shapes){if(s.type==='rect')ctx.fillRect(s.x,s.y,s.width,s.height);else if(s.type==='circle'){ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,TAU);ctx.fill();}else{ctx.lineWidth=s.radius*2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s.ax,s.ay);ctx.lineTo(s.bx,s.by);ctx.stroke();}}ctx.lineCap='butt';
}
// Collision outlines for the Verify phase (?chikunDebug=hitbox), never in Ranked.
function drawHitbox(ctx,o){
 ctx.save();ctx.strokeStyle='rgba(255,40,80,.95)';ctx.lineWidth=1.5;
 for(const s of o.shapes){ctx.beginPath();if(s.type==='rect')ctx.rect(s.x,s.y,s.width,s.height);else if(s.type==='circle')ctx.arc(s.x,s.y,s.radius,0,TAU);else{const dx=s.bx-s.ax,dy=s.by-s.ay,a=Math.atan2(dy,dx);ctx.arc(s.ax,s.ay,s.radius,a+Math.PI/2,a+Math.PI*1.5);ctx.arc(s.bx,s.by,s.radius,a-Math.PI/2,a+Math.PI/2);ctx.closePath();}ctx.stroke();}
 ctx.restore();
}
export function drawGroundObstacle(ctx,o,tick=0,reduced=false){
 // Nothing is drawn for an obstacle outside the view (main draws every fork).
 const v=sceneBus.view;
 if(o.x-48>=v.left+v.width||o.x+o.width+48<=v.left)return;
 if(drawObstacleArt(ctx,o,tick,reduced)){
  drawStormWeather(ctx,o,tick,reduced);
  drawLowPassageHint(ctx,o,tick,reduced);
  if(!o.coin.collected)drawGroundCoin(ctx,o.coin,tick,reduced);
  if(debugHitbox&&sceneBus.mode!=='ranked')drawHitbox(ctx,o);
  return;
 }
 if(!legacyRequested&&obstacleArt().failedAny())loadLegacyArt();
 drawLegacyObstacle(ctx,o,tick,reduced);
 if(debugHitbox&&sceneBus.mode!=='ranked')drawHitbox(ctx,o);
}
// The 1.8.2 code-drawn obstacles: the fallback while a kit loads or if it fails.
function drawLegacyObstacle(ctx,o,tick=0,reduced=false){
 const img=art.get(o.variant),x=o.x,w=o.width;
 if(o.family==='forest'){
  const varieties=['oak','maple','willow','cherry'];
  for(let i=0;i<o.shapes.length;i++){
   const s=o.shapes[i],tree=art.get(varieties[(o.index+i)%varieties.length]);
   // Dense overlapping foliage closes the ground route with an organic edge.
   for(let row=0;row<Math.ceil(s.height/31);row++)for(let col=0;col<5;col++){
    const px=s.x+14+col*(s.width-28)/4,py=Math.min(676,s.y+25+row*31);
    ctx.fillStyle=['#284b39','#315941','#3b6243'][(row+col+i)%3];ctx.beginPath();ctx.ellipse(px,py,21,27,0,0,TAU);ctx.fill();
   }
   if(tree)ctx.drawImage(tree,s.x-8,s.y,s.width+16,s.height);
   ctx.fillStyle='#3f693f';for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(s.x+j*s.width/3,663,30,33,0,0,TAU);ctx.fill();}
  }
 }else if(o.family==='town'){
  // One collision silhouette, three facades: town shops, city glass, suburban homes.
  const variant=o.variant==='city'||o.variant==='suburb'?o.variant:'town';
  const faces=variant==='city'?['#5b7280','#4a5d6e','#6b7f8a']:variant==='suburb'?['#d9c9a6','#b7c7d3','#cfb2a0']:['#a88366','#687d80','#936f60'];
  for(let i=0;i<o.shapes.length;i++){
   const s=o.shapes[i];ctx.fillStyle=faces[i%3];ctx.fillRect(s.x,s.y,s.width,s.height);
   if(variant==='suburb'){
    ctx.fillStyle='#5a4a48';ctx.beginPath();ctx.moveTo(s.x,s.y+46);ctx.lineTo(s.x+s.width/2,s.y);ctx.lineTo(s.x+s.width,s.y+46);ctx.closePath();ctx.fill();
    ctx.fillStyle='#4a3e44';ctx.fillRect(s.x+s.width*.7,s.y+8,12,26);
    for(let row=60;row<s.height-60;row+=48)for(let col=18;col<s.width-30;col+=44){ctx.fillStyle='#2c3a44';ctx.fillRect(s.x+col,s.y+row,26,24);ctx.fillStyle='#e8eef3';ctx.fillRect(s.x+col+3,s.y+row+3,20,18);ctx.fillStyle='#4a3e44';ctx.fillRect(s.x+col+12,s.y+row,2,24);ctx.fillRect(s.x+col,s.y+row+11,26,2);}
    ctx.fillStyle='#4a3238';ctx.fillRect(s.x+s.width*.4,648,26,42);ctx.fillStyle='#e8d59a';ctx.fillRect(s.x+s.width*.4+19,668,3,3);
    ctx.fillStyle='#f0ece0';for(let px=s.x+4;px<s.x+s.width*.36;px+=10)ctx.fillRect(px,672,5,18);
   }else{
    ctx.fillStyle=variant==='city'?'#2b3a44':'#354950';ctx.fillRect(s.x,s.y,s.width,13);ctx.fillRect(s.x+s.width-9,s.y+13,9,s.height-13);
    ctx.strokeStyle=variant==='city'?'#b9d2dc44':'#d2b89c55';ctx.lineWidth=1;for(let row=22;row<s.height;row+=22){ctx.beginPath();ctx.moveTo(s.x,s.y+row);ctx.lineTo(s.x+s.width-10,s.y+row);ctx.stroke();}
    if(variant==='city'){for(let row=24;row<s.height-50;row+=30)for(let col=12;col<s.width-24;col+=26){ctx.fillStyle='#1d2c38';ctx.fillRect(s.x+col,s.y+row,18,22);ctx.fillStyle=(row+col+i)%3?'#a9c9d8':'#f0d998';ctx.fillRect(s.x+col+2,s.y+row+2,14,18);}}
    else for(let row=34;row<s.height-50;row+=52)for(let col=18;col<s.width-25;col+=40){ctx.fillStyle='#243e4d';ctx.fillRect(s.x+col,s.y+row,25,34);ctx.fillStyle='#e4cf91';ctx.fillRect(s.x+col+3,s.y+row+3,18,25);ctx.fillStyle='#687578';ctx.fillRect(s.x+col+11,s.y+row,3,33);}
    ctx.fillStyle='#233b42';ctx.fillRect(s.x+s.width*.38,637,30,53);
    ctx.fillStyle=variant==='city'?'#1c2a34':'#d8bf89';ctx.fillRect(s.x+14,606,s.width-32,17);ctx.fillStyle=variant==='city'?'#8fe0d4':'#344b50';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText((variant==='city'?['LITE BANK','EXCHANGE','HODL INC']:['LITE CAFE','ARCADE','POST'])[i%3],s.x+s.width/2,618);
   }
  }
 }else if(o.kind==='canopy'){
  const gradient=ctx.createLinearGradient(0,0,0,o.height);gradient.addColorStop(0,'#223d3b');gradient.addColorStop(1,'#426642');ctx.fillStyle=gradient;ctx.fillRect(x,0,w,o.height-24);
  for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#395a39':'#557543';ctx.beginPath();ctx.ellipse(x+18+i*(w-36)/8,o.height-34,25,34,0,0,TAU);ctx.fill();}
  ctx.strokeStyle='#779365';ctx.lineWidth=3;for(let i=0;i<7;i++){const px=x+24+i*(w-48)/6;ctx.beginPath();ctx.moveTo(px,120);ctx.bezierCurveTo(px+18,270,px-12,420,px+Math.sin(reduced?i:tick*.023+i)*7,o.height-8);ctx.stroke();}
  ctx.fillStyle='#e1cf98';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText('LOW PASSAGE',x+w/2,o.height+21);
 }else if(o.family==='gap'){
  const water=o.kind==='waterfall';ctx.fillStyle=water?'#195164':'#142d35';ctx.fillRect(x,690,w,30);
  if(water){
   const top=690-o.height;ctx.fillStyle='#31525a';ctx.fillRect(x+24,top,w-48,720-top);
   const gradient=ctx.createLinearGradient(0,top,0,720);gradient.addColorStop(0,'#afdce0');gradient.addColorStop(.16,'#5ea9ba');gradient.addColorStop(1,'#245b76');ctx.fillStyle=gradient;ctx.fillRect(x+28,top+2,w-56,718-top);
   ctx.strokeStyle='#d7eff0a8';ctx.lineWidth=2;for(let i=0;i<32;i++){const px=x+32+i*(w-64)/31,shift=reduced?0:(tick*3+i*19)%155;ctx.beginPath();ctx.moveTo(px,top+shift);ctx.lineTo(px,Math.min(720,top+shift+40+i%5*9));ctx.stroke();}
   ctx.fillStyle='#c5e9e5';for(let i=0;i<24;i++){ctx.beginPath();ctx.ellipse(x+30+i*(w-60)/23,top+3,12,4+(i%3),0,0,TAU);ctx.fill();}
  }
  for(const lip of [x-8,x+w]){ctx.fillStyle='#b7ad87';ctx.fillRect(lip,687,8,11);ctx.fillStyle='#534739';ctx.fillRect(lip,698,8,22);}
  ctx.fillStyle='#dfbe82';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText(water?'WATERFALL':'GAP',x+w/2,710);
 }else if(o.kind==='storm'){
  const gradient=ctx.createLinearGradient(0,80,0,o.height);gradient.addColorStop(0,'#334657cc');gradient.addColorStop(1,'#83939755');ctx.fillStyle=gradient;ctx.fillRect(x,0,w,o.height);
  ctx.fillStyle='#324957';for(let i=0;i<6;i++){ctx.beginPath();ctx.ellipse(x+23+i*37,95+(i%2)*13,40,32,0,0,TAU);ctx.fill();}
  ctx.save();ctx.beginPath();ctx.rect(x,125,w,o.height-125);ctx.clip();ctx.strokeStyle='#a7d3d57c';ctx.lineWidth=1.4;for(let i=0;i<36;i++){const px=x+(i*43)%w,py=128+(i*71+(reduced?0:tick*6))%370;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-5,py+23);ctx.stroke();}ctx.restore();
  ctx.strokeStyle='#f1d78d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+w*.53,138);ctx.lineTo(x+w*.43,180);ctx.lineTo(x+w*.53,178);ctx.lineTo(x+w*.44,216);ctx.stroke();
  ctx.fillStyle='#e1cf98';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText('↓ FLY LOW / RUN',x+w/2,o.height+22);
 }else if(o.kind==='drone'){
  ctx.strokeStyle='#6b929c';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+16,o.y);ctx.lineTo(x+w-16,o.y);ctx.stroke();ctx.fillStyle='#baccc9';ctx.beginPath();ctx.ellipse(x+w/2,o.y,37,18,0,0,TAU);ctx.fill();
  ctx.fillStyle='#263b4c';ctx.fillRect(x+w/2-22,o.y-7,44,9);ctx.fillStyle='#f38a54';ctx.fillRect(x+w/2-5,o.y-3,10,4);ctx.strokeStyle='#b8dedc';ctx.lineWidth=2;
  for(const px of [x+23,x+w-23]){const d=reduced?18:10+Math.abs(Math.sin(tick*.8))*13;ctx.beginPath();ctx.moveTo(px-d,o.y-12);ctx.lineTo(px+d,o.y-12);ctx.stroke();}
 }else if(o.kind==='pipe'){
  const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,'#1c3f40');g.addColorStop(.23,'#799687');g.addColorStop(1,'#203e42');ctx.fillStyle=g;ctx.fillRect(x,690-o.height,w,o.height);ctx.fillStyle='#a8b699';ctx.fillRect(x,690-o.height,w,12);ctx.strokeStyle='#152d32';ctx.lineWidth=3;ctx.strokeRect(x+2,692-o.height,w-4,12);
  ctx.fillStyle='#ead296';for(let i=0;i<5;i++)ctx.fillRect(x+7+i*17,706-o.height,9,5);
 }else if(img){
  let y=690-o.height,h=o.height;
  if(o.family==='sky'){h=o.kind==='plane'?72:70;y=o.y-h*.60;}
  // Grounded art is anchored at the same floor as the canonical geometry.
  const bounce=!reduced&&o.kind==='shiba'?Math.abs(Math.sin(tick*.19))*3:0;
  ctx.drawImage(img,x,y-bounce,w,h);
  if(o.kind==='shiba'){ctx.fillStyle='#edd7a3';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText('SHIBA!',x+w/2,y-11);}
 }else shapeFallback(ctx,o);
 if(!o.coin.collected)drawGroundCoin(ctx,o.coin,tick,reduced);
}
