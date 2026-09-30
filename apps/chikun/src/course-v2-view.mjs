// Course-two overlays paint the exact gameplay extents; cosmetic motion never
// feeds the simulation. Reuses the game's canvas and needs no downloaded atlas.
const colors={shield:['#70e5f0','#133e61','S'],magnet:['#ffbf65','#753145','M'],feather:['#c1efb7','#245458','F']};
export function drawCourseV2Obstacle(ctx,o){
 if(o.family!=='fork-route')return false;
 ctx.save();
 const gradient=ctx.createLinearGradient(0,390,0,540);gradient.addColorStop(0,'#80954b');gradient.addColorStop(.15,'#485c35');gradient.addColorStop(1,'#273c29');
 ctx.fillStyle=gradient;ctx.fillRect(o.x,390,o.width,150);
 // A vine-laden timber trellis: the solid crown matches its collision band,
 // with bark, lattice and foliage instead of a flat test rectangle.
 ctx.fillStyle='#554331';ctx.fillRect(o.x,506,o.width,28);ctx.fillStyle='#9a8355';ctx.fillRect(o.x,506,o.width,5);
 for(let i=0;i<8;i++){const x=o.x+i*42;ctx.strokeStyle='#8b774c';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x,502);ctx.lineTo(Math.min(o.x+o.width,x+42),412);ctx.stroke();}
 for(let i=0;i<31;i++){const x=o.x+8+(i*47)%(o.width-16),y=400+(i*31)%95;ctx.fillStyle=['#5e793e','#7b9148','#3d5b36','#95a05a'][i%4];ctx.beginPath();ctx.ellipse(x,y,11+i%5,7+i%4,(i%5)*.6,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle='#a3a766';ctx.lineWidth=2;
 for(let i=0;i<9;i++){const x=o.x+13+i*33;ctx.beginPath();ctx.moveTo(x,532);ctx.bezierCurveTo(x-18,485,x+29,462,x+8,403);ctx.stroke();}
 ctx.fillStyle='#eee5b5';ctx.font='700 16px system-ui';ctx.textAlign='center';
 ctx.fillText('↑ COIN ROUTE',o.x+o.width/2,371);ctx.fillText('SAFE PATH →',o.x+o.width/2,570);
 ctx.restore();return true;
}
export function drawCourseV2(ctx,s,{reduced=false,left=0}={}){
 if(s?.courseVersion!==2)return;
 ctx.save();
 for(const p of s.powerups){if(p.collected)continue;const [edge,base,label]=colors[p.kind],bob=reduced?0:Math.sin(s.tick*.05+p.x*.002)*3;
  ctx.save();ctx.translate(p.x,p.y+bob);ctx.fillStyle=base;ctx.strokeStyle=edge;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffff8c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,18,Math.PI,Math.PI*1.7);ctx.stroke();
  ctx.fillStyle=edge;ctx.strokeStyle=edge;ctx.lineWidth=4;
  if(p.kind==='shield'){ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(11,-7);ctx.lineTo(8,8);ctx.lineTo(0,15);ctx.lineTo(-8,8);ctx.lineTo(-11,-7);ctx.closePath();ctx.stroke();}
  else if(p.kind==='magnet'){ctx.beginPath();ctx.moveTo(-9,-10);ctx.lineTo(-9,5);ctx.quadraticCurveTo(0,19,9,5);ctx.lineTo(9,-10);ctx.stroke();ctx.fillStyle='#fff1d0';ctx.fillRect(-12,-12,6,6);ctx.fillRect(6,-12,6,6);}
  else{ctx.beginPath();ctx.ellipse(2,-2,7,15,.6,0,Math.PI*2);ctx.fill();ctx.strokeStyle=base;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,13);ctx.lineTo(8,-12);ctx.stroke();}ctx.restore();
 }
 const c=s.chase;
 if(c){
  if(c.telegraph){ctx.fillStyle='#241c19df';ctx.fillRect(left+12,170,230,42);ctx.fillStyle='#ffd47d';ctx.font='700 15px system-ui';ctx.textAlign='left';ctx.fillText(c.kind==='tractor'?'TRACTOR BEHIND · FLY UP':'HAWK BEHIND · STAY LOW',left+22,197);}
  else if(c.kind==='tractor'){
   ctx.save();ctx.translate(c.x,c.y);ctx.fillStyle='#172a24';for(const x of [25,111]){ctx.beginPath();ctx.arc(x,69,x===25?25:19,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ad9671';ctx.lineWidth=5;ctx.stroke();}
   const g=ctx.createLinearGradient(0,12,0,64);g.addColorStop(0,'#e9a548');g.addColorStop(1,'#87532b');ctx.fillStyle=g;ctx.fillRect(8,25,122,35);ctx.fillStyle='#d4b883';ctx.fillRect(12,5,53,6);ctx.fillStyle='#244449';ctx.fillRect(20,11,37,30);ctx.fillStyle='#3b3731';ctx.fillRect(92,5,8,24);ctx.fillStyle='#ffe1a3';ctx.fillRect(125,30,8,15);ctx.restore();
  }else{
   ctx.save();ctx.translate(c.x+69,c.y+42);ctx.fillStyle='#664536';ctx.beginPath();ctx.moveTo(-67,-12);ctx.quadraticCurveTo(-25,-42,0,-5);ctx.quadraticCurveTo(35,-41,68,-11);ctx.lineTo(24,17);ctx.lineTo(-22,17);ctx.closePath();ctx.fill();ctx.fillStyle='#ecd5a2';ctx.beginPath();ctx.ellipse(30,1,14,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1b2020';ctx.fillRect(36,-1,3,3);ctx.restore();
  }
 }
 const p=s.powers,x=s.chikun.x,y=s.chikun.y;
 if(p.shield){ctx.strokeStyle='#91e9efaa';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,44,48,0,0,Math.PI*2);ctx.stroke();}
 if(p.magnetTicks){ctx.strokeStyle='#ffc87966';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,56,0,Math.PI*2);ctx.stroke();}
 if(p.gliding){ctx.strokeStyle='#c2f3bb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-50,y+15);ctx.quadraticCurveTo(x,y+35,x+45,y+15);ctx.stroke();}
 const text=[p.shield?'SHIELD READY':'',p.magnetTicks?`MAGNET ${Math.ceil(p.magnetTicks/60)}s`:'',p.feather?'FEATHER · HOLD TO GLIDE':p.gliding?'GLIDING':''].filter(Boolean).join(' · ');
 if(text){ctx.font='700 13px system-ui';ctx.textAlign='left';ctx.fillStyle='#102c33de';ctx.fillRect(left+12,124,Math.min(390,ctx.measureText(text).width+20),30);ctx.fillStyle='#e9f1d6';ctx.fillText(text,left+22,144);}
 ctx.restore();
}
