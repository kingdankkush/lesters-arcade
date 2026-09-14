const TAU=Math.PI*2;
const propNames=['willow','cherry','maple','oak','rock','log','crate','hurdle','thorn','shiba','hawk','eagle','pelican','plane'];
const art=new Map();
export function loadGroundArt(){
 if(typeof Image==='undefined')return Promise.resolve();
 return Promise.allSettled(propNames.filter(n=>!art.has(n)).map(async name=>{const img=new Image();img.src='/assets/generated/chikun-ground-props-v1/'+name+'.webp';try{await img.decode();art.set(name,img);}catch{}}));
}
const colors={grass:['#576c32','#8da54b','#423522'],dirt:['#aa8051','#d2a96b','#67432e'],sand:['#cfb878','#f0dba0','#a58153'],asphalt:['#343e43','#727b78','#202b32'],concrete:['#777b71','#bdbeaa','#424b4e']};
export function drawGround(ctx,snapshot,{reduced=false}={}){
 const distance=snapshot.distancePixels??0,[base,edge,under]=colors[snapshot.terrain]??colors.grass;
 ctx.fillStyle=under;ctx.fillRect(0,690,1280,30);ctx.fillStyle=base;ctx.fillRect(0,690,1280,13);ctx.fillStyle=edge;ctx.fillRect(0,690,1280,3);
 for(let i=0;i<35;i++){
  const world=Math.floor(distance/43)+i,x=world*43-distance;
  if(snapshot.forks?.some(o=>o.family==='gap'&&x>o.x-8&&x<o.x+o.width+8))continue;
  const urban=['asphalt','concrete'].includes(snapshot.terrain);
  if(urban){ctx.strokeStyle=under;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,705);ctx.lineTo(x+16,707);ctx.lineTo(x+19,720);ctx.stroke();if(world%5===0){ctx.fillStyle=edge;ctx.fillRect(x,714,32,2);}}
  else{
   ctx.strokeStyle=world%3===0?'#9aad53':'#527542';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,690);ctx.lineTo(x-4,681);ctx.moveTo(x+2,690);ctx.lineTo(x+5,680);ctx.stroke();
   if(world%4===0){ctx.fillStyle=['#f0c865','#e8a4bc','#d5d5b2'][world%3];ctx.beginPath();ctx.arc(x+5,680,2.4,0,TAU);ctx.fill();}
   ctx.fillStyle=under;ctx.fillRect(x+12,702,5+world%7,2);
  }
 }
 const c=snapshot.chikun;
 if(c&&!snapshot.terminal){const altitude=690-c.y;ctx.fillStyle='rgba(10,25,24,.20)';ctx.beginPath();ctx.ellipse(c.x,693,Math.max(9,25-altitude*.028),3,0,0,TAU);ctx.fill();}
 for(const coin of snapshot.groundCoins??[])if(!coin.collected)drawGroundCoin(ctx,coin,snapshot.tick,reduced);
}
export function drawGroundCoin(ctx,c,tick=0,reduced=false){
 ctx.save();ctx.translate(c.x,c.y);ctx.scale(reduced?1:.86+.14*Math.cos(tick*.07+c.x*.01),1);ctx.fillStyle='#d8e4e2';ctx.strokeStyle='#7caaa8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,c.radius,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#35656b';ctx.font=`800 ${c.radius*1.35}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Ł',0,1);ctx.restore();
}
function shapeFallback(ctx,o){
 ctx.fillStyle=o.family==='tree'?'#507642':'#a59572';ctx.strokeStyle=ctx.fillStyle;
 for(const s of o.shapes){if(s.type==='rect')ctx.fillRect(s.x,s.y,s.width,s.height);else if(s.type==='circle'){ctx.beginPath();ctx.arc(s.x,s.y,s.radius,0,TAU);ctx.fill();}else{ctx.lineWidth=s.radius*2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(s.ax,s.ay);ctx.lineTo(s.bx,s.by);ctx.stroke();}}ctx.lineCap='butt';
}
export function drawGroundObstacle(ctx,o,tick=0,reduced=false){
 const img=art.get(o.variant),x=o.x,w=o.width;
 if(o.family==='gap'){
  const water=o.kind==='waterfall';ctx.fillStyle=water?'#195164':'#142d35';ctx.fillRect(x,690,w,30);
  if(water){ctx.fillStyle='#73c2c9';ctx.fillRect(x+6,691,w-12,29);ctx.strokeStyle='#cce6db';ctx.lineWidth=2;for(let i=0;i<12;i++){const px=x+10+i*(w-20)/12;const shift=reduced?0:(tick*1.5+i*6)%32;ctx.beginPath();ctx.moveTo(px,682+shift);ctx.lineTo(px,696+shift);ctx.stroke();}}
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
