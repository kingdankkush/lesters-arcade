// Course-two overlays paint the exact gameplay extents; cosmetic motion never
// feeds the simulation. Reuses the game's canvas. When the lazily loaded
// course-two art (course-v2-art.mjs) is ready it draws the sprites; otherwise
// the vector prototype below stays as the fallback.
const colors={shield:['#70e5f0','#133e61','S'],magnet:['#ffbf65','#753145','M'],feather:['#c1efb7','#245458','F']};
// Reserved hazard tell colour (red/orange): only chase warnings use it here.
export const COURSE_V2_TELL='#ff5a2e';
const TAU=Math.PI*2;
// Pickup / expiry cues keyed on simulation ticks (projection only; resets on a new run).
const cues={tick:-1,shield:false,magnetTicks:0,pickups:0,list:[]};
export function trackCourseV2Cues(s){
 if(s?.courseVersion!==2||!s.powers)return cues.list;
 const p=s.powers;
 if(s.tick<cues.tick){cues.list.length=0;cues.shield=false;cues.magnetTicks=0;cues.pickups=0;}
 if(s.tick!==cues.tick){
  if(p.pickups>cues.pickups)cues.list.push({kind:'pickup',tick:s.tick});
  if(cues.shield&&!p.shield)cues.list.push({kind:'shield-pop',tick:s.tick});
  if(cues.magnetTicks>0&&p.magnetTicks===0)cues.list.push({kind:'magnet-end',tick:s.tick});
  cues.shield=p.shield;cues.magnetTicks=p.magnetTicks;cues.pickups=p.pickups;cues.tick=s.tick;
  while(cues.list.length&&s.tick-cues.list[0].tick>40)cues.list.shift();
 }
 return cues.list;
}
export function drawCourseV2Obstacle(ctx,o,art=null){
 if(o.family!=='fork-route')return false;
 ctx.save();
 if(!art?.drawTrellis?.(ctx,o)){
  const gradient=ctx.createLinearGradient(0,390,0,540);gradient.addColorStop(0,'#80954b');gradient.addColorStop(.15,'#485c35');gradient.addColorStop(1,'#273c29');
  ctx.fillStyle=gradient;ctx.fillRect(o.x,390,o.width,150);
  // A vine-laden timber trellis: the solid crown matches its collision band,
  // with bark, lattice and foliage instead of a flat test rectangle.
  ctx.fillStyle='#554331';ctx.fillRect(o.x,506,o.width,28);ctx.fillStyle='#9a8355';ctx.fillRect(o.x,506,o.width,5);
  for(let i=0;i<8;i++){const x=o.x+i*42;ctx.strokeStyle='#8b774c';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x,502);ctx.lineTo(Math.min(o.x+o.width,x+42),412);ctx.stroke();}
  for(let i=0;i<31;i++){const x=o.x+8+(i*47)%(o.width-16),y=400+(i*31)%95;ctx.fillStyle=['#5e793e','#7b9148','#3d5b36','#95a05a'][i%4];ctx.beginPath();ctx.ellipse(x,y,11+i%5,7+i%4,(i%5)*.6,0,TAU);ctx.fill();}
  ctx.strokeStyle='#a3a766';ctx.lineWidth=2;
  for(let i=0;i<9;i++){const x=o.x+13+i*33;ctx.beginPath();ctx.moveTo(x,532);ctx.bezierCurveTo(x-18,485,x+29,462,x+8,403);ctx.stroke();}
 }
 ctx.fillStyle='#eee5b5';ctx.font='700 16px system-ui';ctx.textAlign='center';
 ctx.fillText('↑ COIN ROUTE',o.x+o.width/2,371);ctx.fillText('SAFE PATH →',o.x+o.width/2,570);
 ctx.restore();return true;
}
function drawVectorPickup(ctx,p,bob){
 const [edge,base]=colors[p.kind];
 ctx.save();ctx.translate(p.x,p.y+bob);ctx.fillStyle=base;ctx.strokeStyle=edge;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,23,0,TAU);ctx.fill();ctx.stroke();
 ctx.strokeStyle='#ffffff8c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,18,Math.PI,Math.PI*1.7);ctx.stroke();
 ctx.fillStyle=edge;ctx.strokeStyle=edge;ctx.lineWidth=4;
 if(p.kind==='shield'){ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(11,-7);ctx.lineTo(8,8);ctx.lineTo(0,15);ctx.lineTo(-8,8);ctx.lineTo(-11,-7);ctx.closePath();ctx.stroke();}
 else if(p.kind==='magnet'){ctx.beginPath();ctx.moveTo(-9,-10);ctx.lineTo(-9,5);ctx.quadraticCurveTo(0,19,9,5);ctx.lineTo(9,-10);ctx.stroke();ctx.fillStyle='#fff1d0';ctx.fillRect(-12,-12,6,6);ctx.fillRect(6,-12,6,6);}
 else{ctx.beginPath();ctx.ellipse(2,-2,7,15,.6,0,TAU);ctx.fill();ctx.strokeStyle=base;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,13);ctx.lineTo(8,-12);ctx.stroke();}ctx.restore();
}
function drawVectorChase(ctx,c){
 if(c.kind==='tractor'){
  ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle='#172a24';for(const x of [25,111]){ctx.beginPath();ctx.arc(x,69,x===25?25:19,0,TAU);ctx.fill();ctx.strokeStyle='#ad9671';ctx.lineWidth=5;ctx.stroke();}
  const g=ctx.createLinearGradient(0,12,0,64);g.addColorStop(0,'#e9a548');g.addColorStop(1,'#87532b');ctx.fillStyle=g;ctx.fillRect(8,25,122,35);ctx.fillStyle='#d4b883';ctx.fillRect(12,5,53,6);ctx.fillStyle='#244449';ctx.fillRect(20,11,37,30);ctx.fillStyle='#3b3731';ctx.fillRect(92,5,8,24);ctx.fillStyle='#ffe1a3';ctx.fillRect(125,30,8,15);ctx.restore();
 }else{
  ctx.save();ctx.translate(c.x+69,c.y+42);ctx.fillStyle='#664536';ctx.beginPath();ctx.moveTo(-67,-12);ctx.quadraticCurveTo(-25,-42,0,-5);ctx.quadraticCurveTo(35,-41,68,-11);ctx.lineTo(24,17);ctx.lineTo(-22,17);ctx.closePath();ctx.fill();ctx.fillStyle='#ecd5a2';ctx.beginPath();ctx.ellipse(30,1,14,10,0,0,TAU);ctx.fill();ctx.fillStyle='#1b2020';ctx.fillRect(36,-1,3,3);ctx.restore();
 }
}
// Warning cue during the 120-tick telegraph: pulsing tell band at the left
// edge, chevrons pointing the escape direction, and the text call.
function drawChaseWarning(ctx,c,tick,reduced,left){
 const pulse=reduced?.7:.55+.45*Math.abs(Math.sin(tick*.16));
 const g=ctx.createLinearGradient(left,0,left+150,0);g.addColorStop(0,'rgba(255,90,46,'+(.42*pulse).toFixed(3)+')');g.addColorStop(1,'rgba(255,90,46,0)');
 ctx.fillStyle=g;ctx.fillRect(left,0,150,720);
 const y=c.kind==='tractor'?650:350;
 ctx.strokeStyle=COURSE_V2_TELL;ctx.lineWidth=5;ctx.lineCap='round';ctx.globalAlpha=pulse;
 for(let i=0;i<3;i++){const x=left+28+i*22+(reduced?0:(tick*2)%22);ctx.beginPath();ctx.moveTo(x,y-18);ctx.lineTo(x+12,y);ctx.lineTo(x,y+18);ctx.stroke();}
 ctx.globalAlpha=1;ctx.lineCap='butt';
 ctx.fillStyle='#241c19df';ctx.fillRect(left+12,170,230,42);ctx.strokeStyle=COURSE_V2_TELL;ctx.lineWidth=2;ctx.strokeRect(left+12.5,170.5,229,41);
 ctx.fillStyle='#ffd47d';ctx.font='700 15px system-ui';ctx.textAlign='left';ctx.fillText(c.kind==='tractor'?'TRACTOR BEHIND · FLY UP':'HAWK BEHIND · STAY LOW',left+22,197);
}
export function drawCourseV2(ctx,s,{reduced=false,left=0,art=null}={}){
 if(s?.courseVersion!==2)return;
 const live=trackCourseV2Cues(s);
 ctx.save();
 for(const p of s.powerups){if(p.collected)continue;const bob=reduced?0:Math.sin(s.tick*.05+p.x*.002)*3;
  if(!reduced){const [edge]=colors[p.kind];ctx.strokeStyle=edge;ctx.globalAlpha=.35+.25*Math.sin(s.tick*.1+p.x);ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y+bob,29,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
  if(!art?.drawPickup?.(ctx,p,bob))drawVectorPickup(ctx,p,bob);
 }
 const c=s.chase;
 if(c){
  if(c.telegraph)drawChaseWarning(ctx,c,s.tick,reduced,left);
  else{
   // Dust kicked up along the ground behind a tractor (sprite dust is baked; this adds motion).
   if(c.kind==='tractor'&&!reduced){ctx.fillStyle='#c4aa80';for(let i=0;i<4;i++){const a=((s.tick*3+i*17)%60)/60;ctx.globalAlpha=.35*(1-a);ctx.beginPath();ctx.arc(c.x+10-a*60-i*8,684-a*26,6+a*16,0,TAU);ctx.fill();}ctx.globalAlpha=1;}
   if(!art?.drawChase?.(ctx,c,s.tick,reduced))drawVectorChase(ctx,c);
   if(c.kind==='hawk'&&!reduced){ctx.fillStyle=COURSE_V2_TELL;ctx.globalAlpha=.6+.4*Math.abs(Math.sin(s.tick*.3));ctx.beginPath();ctx.arc(c.x+c.width-24,c.y+30,2.5,0,TAU);ctx.fill();ctx.globalAlpha=1;}
  }
 }
 const p=s.powers,x=s.chikun.x,y=s.chikun.y;
 if(p.shield){
  // Shield bubble: soft cyan dome with a bright rim and a rotating highlight.
  const g=ctx.createRadialGradient(x-10,y-14,6,x,y,50);g.addColorStop(0,'rgba(190,245,250,0.26)');g.addColorStop(.75,'rgba(112,229,240,0.10)');g.addColorStop(1,'rgba(112,229,240,0.34)');
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,46,50,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#91e9efcc';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,46,50,0,0,TAU);ctx.stroke();
  const a=reduced?-.9:s.tick*.06;ctx.strokeStyle='#ffffffb0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,40,44,0,a,a+.9);ctx.stroke();
 }
 if(p.magnetTicks){
  // Magnet pull: orbiting sparkles and a faint field ring; coins inside 180 are pulled.
  ctx.strokeStyle='#ffc87955';ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.beginPath();ctx.arc(x,y,60,0,TAU);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#ffd98a';for(let i=0;i<6;i++){const a=(reduced?i:s.tick*.11+i)*TAU/6,r=46+(reduced?0:8*Math.sin(s.tick*.2+i));const sx=x+Math.cos(a)*r,sy=y+Math.sin(a)*r*.8;ctx.beginPath();ctx.moveTo(sx,sy-4);ctx.lineTo(sx+3,sy);ctx.lineTo(sx,sy+4);ctx.lineTo(sx-3,sy);ctx.closePath();ctx.fill();}
  for(const coin of [...(s.groundCoins??[]),...s.forks.map(f=>f.coin)]){if(coin.collected)continue;const dx=coin.x-x,dy=coin.y-y;if(dx*dx+dy*dy<=180*180){ctx.strokeStyle='#ffbf6566';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(coin.x,coin.y);ctx.lineTo(x+dx*.35,y+dy*.35);ctx.stroke();}}
 }
 if(p.gliding){
  // Glide trail: a fan of small feather strokes streaming behind Chikun.
  ctx.strokeStyle='#c2f3bb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-50,y+15);ctx.quadraticCurveTo(x,y+35,x+45,y+15);ctx.stroke();
  for(let i=0;i<5;i++){const t=reduced?i/5:((s.tick*2+i*13)%60)/60;const fx=x-30-t*110,fy=y+8+Math.sin(t*9+i)*10;ctx.globalAlpha=.8*(1-t);ctx.fillStyle='#c1efb7';ctx.beginPath();ctx.ellipse(fx,fy,9,3.5,-.5,0,TAU);ctx.fill();ctx.strokeStyle='#5fae7a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(fx-8,fy+3);ctx.lineTo(fx+8,fy-3);ctx.stroke();}
  ctx.globalAlpha=1;
 }
 // Pickup and expiry cues: expanding rings in the power colour.
 for(const cue of live){const age=s.tick-cue.tick,t=age/40,color=cue.kind==='magnet-end'?'#ffbf65':cue.kind==='shield-pop'?'#70e5f0':'#ffffff';
  ctx.strokeStyle=color;ctx.globalAlpha=Math.max(0,1-t);ctx.lineWidth=cue.kind==='pickup'?3:5;ctx.beginPath();ctx.arc(x,y,30+t*70,0,TAU);ctx.stroke();
  if(cue.kind==='shield-pop'){for(let i=0;i<8;i++){const a=i*TAU/8;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*(40+t*30),y+Math.sin(a)*(40+t*30));ctx.lineTo(x+Math.cos(a)*(52+t*60),y+Math.sin(a)*(52+t*60));ctx.stroke();}}
  ctx.globalAlpha=1;}
 // HUD: chips for ready powers and a magnet timer bar.
 let hx=left+12;const hy=124;
 ctx.font='700 13px system-ui';
 const chip=(kind,label,bar=0)=>{ctx.fillStyle='#102c33de';const w=ctx.measureText(label).width+40;ctx.fillRect(hx,hy,w,30);if(!art?.drawChip?.(ctx,kind,hx+5,hy+4,22)){ctx.fillStyle=colors[kind][0];ctx.beginPath();ctx.arc(hx+16,hy+15,9,0,TAU);ctx.fill();}ctx.fillStyle='#e9f1d6';ctx.textAlign='left';ctx.fillText(label,hx+32,hy+20);
  if(bar>0){ctx.fillStyle='#ffffff33';ctx.fillRect(hx+32,hy+24,w-40,3);ctx.fillStyle=colors[kind][0];ctx.fillRect(hx+32,hy+24,(w-40)*bar,3);}hx+=w+6;};
 if(p.shield)chip('shield','SHIELD');
 if(p.magnetTicks)chip('magnet','MAGNET '+Math.ceil(p.magnetTicks/60)+'s',Math.min(1,p.magnetTicks/480));
 if(p.feather)chip('feather','FEATHER · HOLD TO GLIDE');else if(p.gliding)chip('feather','GLIDING');
 ctx.restore();
}
