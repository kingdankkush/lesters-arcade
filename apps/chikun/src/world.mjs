// All scenery is seeded, cached and cosmetic. No scene data enters the replay.
const TAU=Math.PI*2;
const propArt = new Map();
function loadPropArt() {
  if(propArt.size || typeof Image==='undefined')return;
  for(const kind of ['tree','drone']) {
    const img=new Image();img.src='/assets/generated/chikun-open-air-v1/'+kind+'.webp';
    propArt.set(kind,img);img.decode().catch(()=>{});
  }
}
function drawProp(ctx,obstacle,tick,reduced) {
  const r=obstacle.render,img=propArt.get(obstacle.kind);
  if(img?.complete && img.naturalWidth) {
    if(obstacle.kind==='tree')ctx.drawImage(img,r.x,r.y,r.width,r.height);
    else {const frame=reduced?0:Math.floor(tick*24/60)%8;ctx.drawImage(img,frame%4*256,Math.floor(frame/4)*128,256,128,r.x,r.y,r.width,r.height);}
    return;
  }
  // The bounded silhouette remains legible if a sprite fails to load.
  for(const shape of obstacle.shapes) {
    ctx.fillStyle=obstacle.kind==='tree'?'#3b7250':'#c3cecc';
    if(shape.type==='circle'){ctx.beginPath();ctx.arc(shape.x,shape.y,shape.radius,0,TAU);ctx.fill();}
    else if(shape.type==='capsule'){ctx.strokeStyle=obstacle.kind==='tree'?'#846347':'#bdc9c9';ctx.lineWidth=shape.radius*2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(shape.ax,shape.ay);ctx.lineTo(shape.bx,shape.by);ctx.stroke();ctx.lineCap='butt';}
  }
}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>a.map((v,i)=>Math.round(lerp(v,b[i],t)));
const rgb=(a,alpha=1)=>`rgba(${a.join(',')},${alpha})`;
const noise=(n)=>{let x=Math.imul(n+17,2654435761)>>>0;x^=x>>>13;return (Math.imul(x,2246822519)>>>0)/4294967296;};
export function chikunSkyState(seconds=0,reduced=false) {
  const t=reduced?0:(Number.isFinite(seconds)?Math.max(0,seconds):0);
  const phase=(t%180)/180;
  const altitude=Math.cos(phase*TAU);
  const d=clamp((altitude+.32)/.84);const day=d*d*(3-2*d);const night=1-day;
  const dusk=Math.exp(-altitude*altitude*14);
  return {phase,day,night,dusk,altitude,top:mix([10,18,48],[48,119,155],day),horizon:mix(mix([42,59,105],[249,215,167],day),[231,136,139],dusk*.7)};
}
function glow(ctx,x,y,r,color,alpha=1) {
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgb(color,alpha));g.addColorStop(1,rgb(color,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function polygon(ctx,points,fill) {ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function makeCity(depth,night) {
  const c=document.createElement('canvas');c.width=1600;c.height=420;const ctx=c.getContext('2d');
  const palettes=night?['#293352','#1a2b42','#102333']:['#648b9b','#456e80','#284c61'];
  let x=0,index=0;
  while(x<c.width) {
    const seed=index+depth*71;const w=34+Math.floor(noise(seed)*62);const h=45+noise(seed+84)*(130+depth*34);const y=420-h;
    const g=ctx.createLinearGradient(x,y,x+w,420);g.addColorStop(0,palettes[depth]);g.addColorStop(1,night?'#111c30':'#315367');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
    polygon(ctx,[[x+w,y],[x+w+10,y+7],[x+w+10,420],[x+w,420]],night?'#102032':'#34576b');
    ctx.fillStyle=night?'#455475':'#99b3b8';ctx.fillRect(x,y,w,2);
    if(index%4===0) {
      ctx.fillStyle=palettes[depth];ctx.fillRect(x+w*.28,y-14,w*.44,14);
      ctx.strokeStyle=night?'#687993':'#a7b7bc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+w/2,y-14);ctx.lineTo(x+w/2,y-32);ctx.stroke();
      if(night){ctx.fillStyle='#ee9c89';ctx.fillRect(x+w/2-1,y-33,2,3);}
    }
    if(index%7===2){
      polygon(ctx,[[x+3,y],[x+w*.50,y-34],[x+w-3,y]],palettes[depth]);
      ctx.fillStyle=night?'#8fe7df':'#a5c4c7';ctx.fillRect(x+w*.48,y-29,2,h+29);
    }
    for(let wy=y+12;wy<411;wy+=11)for(let wx=x+7;wx<x+w-5;wx+=10){
      const lit=noise(Math.round(wx*3+wy)+seed)>.40;
      ctx.fillStyle=night?(lit?(noise(seed+wy)>.5?'#eab890':'#82b6c3'):'#20384c'):(lit?'#97b6bf':'#537b90');
      ctx.globalAlpha=night?.70:.40;ctx.fillRect(wx,wy,3,5);
    }
    ctx.globalAlpha=1;
    if(depth===2 && index%3===0){
      ctx.fillStyle=night?'#7ee0d2':'#a2cac3';ctx.fillRect(x+5,y+19,w-10,2);
      ctx.fillStyle=night?'#182e41':'#3e697c';ctx.fillRect(x+7,y+22,w-14,12);
    }
    x+=w+12+noise(seed+8)*18;index++;
  }
  return c;
}
export function createChikunWorld() {
  loadPropArt();
  const city=[0,1,2].map(depth=>[makeCity(depth,false),makeCity(depth,true)]);
  function tile(ctx,img,offset,y,alpha=1) {
    const x=-((offset%img.width)+img.width)%img.width;ctx.globalAlpha=alpha;ctx.drawImage(img,x,y);ctx.drawImage(img,x+img.width,y);ctx.globalAlpha=1;
  }
  function mountains(ctx,t,night) {
    for(let layer=0;layer<3;layer++) {
      const base=477+layer*42;const offset=(t*(1+layer*.7))%1600;
      const colors=[mix([94,132,157],[38,49,84],night),mix([92,139,157],[32,48,79],night),mix([72,123,142],[26,46,69],night)];
      for(let repeat=-1;repeat<2;repeat++) {
        const start=repeat*1600-offset;const pts=[[start,720]];
        for(let i=0;i<=16;i++)pts.push([start+i*100,base-38-noise(i+layer*79)*125]);
        pts.push([start+1600,720]);polygon(ctx,pts,rgb(colors[layer]));
        if(layer===0)for(let i=1;i<16;i++){
          const px=start+i*100,py=base-38-noise(i)*125;
          if(py<340)polygon(ctx,[[px,py],[px-27,py+35],[px-9,py+27],[px+9,py+43],[px+22,py+27]],rgb(mix([194,208,205],[76,88,116],night),.58));
        }
      }
    }
  }
  return {
    draw(ctx,snapshot,{reduced=false,mode='free',idleTime=0}={}) {
      const tick=snapshot?.tick??0;const t=reduced?0:tick/60+(tick===0?idleTime*.3:0);const sky=chikunSkyState(t,reduced);
      const g=ctx.createLinearGradient(0,0,0,720);g.addColorStop(0,rgb(sky.top));g.addColorStop(.65,rgb(sky.horizon));g.addColorStop(1,rgb(mix([85,139,154],[15,35,62],sky.night)));ctx.fillStyle=g;ctx.fillRect(0,0,1280,720);
      // Stars fade in before the sun reaches the horizon.
      for(let i=0;i<74;i++){
        const x=noise(i+812)*1280,y=40+noise(i+1034)*340;
        ctx.fillStyle=rgb([217,236,242],sky.night*(.35+.4*noise(i)));
        const size=i%11===0?2:1;ctx.fillRect(x,y,size,size);
      }
      const sx=955+Math.sin(sky.phase*TAU)*135,sy=390-sky.altitude*217;
      if(sky.day>.001){glow(ctx,sx,sy,230,[255,207,138],.32*sky.day);glow(ctx,sx,sy,105,[255,224,174],.3*sky.day);ctx.fillStyle=rgb([255,241,203],sky.day);ctx.beginPath();ctx.arc(sx,sy,34,0,TAU);ctx.fill();}
      const mx=970-Math.sin(sky.phase*TAU)*140,my=390+sky.altitude*225;
      if(sky.night>.001){glow(ctx,mx,my,170,[125,199,226],.18*sky.night);ctx.fillStyle=rgb([211,228,225],sky.night);ctx.beginPath();ctx.arc(mx,my,27,0,TAU);ctx.fill();ctx.fillStyle=rgb([122,159,179],.24*sky.night);for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(mx-13+noise(i+12)*28,my-13+noise(i+29)*28,3+noise(i+90)*4,0,TAU);ctx.fill();}}
      // Stretched translucent cloud banks preserve open space around the flight lane.
      for(let i=0;i<8;i++){
        const x=((i*233-t*(3+i*.4))%1700+1700)%1700-190;const y=85+(i*67)%270;
        ctx.fillStyle=rgb(mix([255,236,212],[93,107,148],sky.night),.14);
        ctx.beginPath();ctx.ellipse(x,y,110+(i%3)*25,9+i%4,0,0,TAU);ctx.ellipse(x+30,y-9,61,15,0,0,TAU);ctx.fill();
      }
      mountains(ctx,t,sky.night);
      tile(ctx,city[0][0],t*5,111);tile(ctx,city[0][1],t*5,111,sky.night);
      // Water separates the skyline layers and takes the sky color.
      const water=ctx.createLinearGradient(0,528,0,690);water.addColorStop(0,rgb(mix([104,153,160],[28,61,87],sky.night)));water.addColorStop(1,rgb(mix([39,86,105],[12,31,54],sky.night)));ctx.fillStyle=water;ctx.fillRect(0,528,1280,192);
      for(let i=0;i<46;i++){
        const y=532+i*3.4,x=((i*193-t*(6+i*.13))%1450+1450)%1450;
        ctx.strokeStyle=rgb(mix([245,208,154],[125,169,191],sky.night),.1+noise(i+15)*.12);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+22+noise(i+54)*85,y);ctx.stroke();
      }
      // Landmark suspension bridge: shallow curves and evenly spaced hangers.
      const bx=620-(t*8)%1900;
      ctx.strokeStyle=rgb(mix([62,93,112],[32,53,78],sky.night));ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(bx-360,582);ctx.lineTo(bx+580,582);ctx.stroke();
      for(const tower of [bx-150,bx+350]){ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(tower-5,478,10,170);ctx.fillRect(tower-13,487,26,4);}
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx-350,579);ctx.quadraticCurveTo(bx-245,565,bx-150,484);ctx.quadraticCurveTo(bx+100,655,bx+350,484);ctx.quadraticCurveTo(bx+450,565,bx+575,579);ctx.stroke();
      for(let i=0;i<21;i++){const x=bx-150+i*25,unit=i/20,y=484+342*unit*(1-unit);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,580);ctx.stroke();}
      tile(ctx,city[1][0],t*13,238);tile(ctx,city[1][1],t*13,238,sky.night);
      // A few distant aircraft are subtle depth cues, with no gameplay colliders.
      for(let i=0;i<3;i++){const x=((100+i*469+t*(5+i))%1550)-80,y=235+i*76;ctx.fillStyle=rgb([210,227,224],.55);ctx.fillRect(x,y,15,2);ctx.fillStyle=rgb([252,162,111],sky.night*.8);ctx.fillRect(x-3,y,2,2);}
      const haze=ctx.createLinearGradient(0,430,0,650);haze.addColorStop(0,rgb(sky.horizon,0));haze.addColorStop(.6,rgb(sky.horizon,.10));haze.addColorStop(1,rgb(sky.horizon,0));ctx.fillStyle=haze;ctx.fillRect(0,430,1280,220);
      tile(ctx,city[2][0],t*29,358);tile(ctx,city[2][1],t*29,358,sky.night);
      // Foreground park curb matches the canonical floor exactly (y=690).
      ctx.fillStyle='#203c32';ctx.fillRect(0,690,1280,30);ctx.fillStyle='#a1b798';ctx.fillRect(0,690,1280,3);
      for(let i=0;i<26;i++){const x=i*56-(t*100)%56;ctx.fillStyle='#263d4a';ctx.fillRect(x,698,46,8);ctx.fillStyle='#aabb9d';ctx.fillRect(x+7,689,9,2);}
      ctx.fillStyle=rgb([6,20,36],.35);ctx.fillRect(0,0,1280,30);ctx.fillStyle=rgb([191,222,220],.22);ctx.fillRect(0,29,1280,1);
      ctx.font='600 11px system-ui';ctx.textAlign='left';ctx.fillStyle=rgb([227,237,231],.65);ctx.fillText('LITE CITY  /  '+(sky.night>.65?'MOONLIGHT':sky.dusk>.4?'GOLDEN HOUR':'AFTERLIGHT'),30,675);
      ctx.textAlign='right';ctx.fillStyle=mode==='ranked'?'#e8ca89':'#9fcabc';ctx.fillText(mode==='ranked'?'RANKED FLIGHT':'FREE FLIGHT',1250,675);
    },
    dispose(){for(const pair of city)for(const c of pair){c.width=0;c.height=0;}}
  };
}

export function drawChikunObstacle(ctx,fork,tick=0,reduced=false) {

  const {x,width:w,gapTop:top,gapBottom:bottom}=fork;
  const metal=ctx.createLinearGradient(x,0,x+w,0);metal.addColorStop(0,'#142a3a');metal.addColorStop(.12,'#5f7a85');metal.addColorStop(.20,'#263f51');metal.addColorStop(.72,'#192f40');metal.addColorStop(.87,'#456879');metal.addColorStop(1,'#102534');
  function column(y,h,edge,upper) {
    ctx.fillStyle=metal;ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='#0b1c2a';ctx.lineWidth=2;ctx.strokeRect(x+1,y,w-2,h);
    ctx.fillStyle='rgba(171,209,213,.23)';ctx.fillRect(x+9,y,2,h);ctx.fillStyle='#0d2334';ctx.fillRect(x+w-13,y,5,h);
    // Inset ribs and rivets fit within the collision rectangle.
    for(let yy=y+25;yy<y+h-18;yy+=48){
      ctx.fillStyle='#153143';ctx.fillRect(x+15,yy,w-31,22);ctx.fillStyle='rgba(165,197,199,.16)';ctx.fillRect(x+16,yy,w-32,1);
      ctx.fillStyle='#91a9ab';for(const xx of [x+7,x+w-8]){ctx.beginPath();ctx.arc(xx,yy+7,1.7,0,TAU);ctx.fill();}
    }
    const capY=upper?edge-24:edge;
    const cap=ctx.createLinearGradient(0,capY,0,capY+24);cap.addColorStop(0,'#9caca5');cap.addColorStop(.16,'#344e5d');cap.addColorStop(.8,'#1c3547');cap.addColorStop(1,'#a0b8b4');ctx.fillStyle=cap;ctx.fillRect(x,capY,w,24);
    ctx.save();ctx.beginPath();ctx.rect(x+5,capY+5,w-10,9);ctx.clip();ctx.fillStyle='#cdb47e';ctx.fillRect(x+5,capY+5,w-10,9);ctx.fillStyle='#2a3a42';
    for(let sx=x-10;sx<x+w;sx+=19)polygon(ctx,[[sx,capY+5],[sx+9,capY+5],[sx+19,capY+14],[sx+10,capY+14]],'#2a3a42');ctx.restore();
    ctx.fillStyle='#72ead3';ctx.shadowColor='#69e9d3';ctx.shadowBlur=9;ctx.fillRect(x+3,upper?edge-2:edge,w-6,2);ctx.shadowBlur=0;
    const lampY=upper?edge-39:edge+38;ctx.fillStyle='#f3a27a';ctx.beginPath();ctx.arc(x+w/2,lampY,3,0,TAU);ctx.fill();
    if(!reduced)glow(ctx,x+w/2,lampY,14,[246,151,104],.12+.06*Math.sin(tick*.04));
  }
  const gate=!fork.kind || fork.kind==='gate';
  if(gate){column(0,top,top,true);column(bottom,720-bottom,bottom,false);}
  else drawProp(ctx,fork,tick,reduced);
  if(gate && top>125){
    ctx.save();ctx.translate(x+w/2,Math.max(55,top*.45));ctx.fillStyle='#111f2b';ctx.fillRect(-43,-22,86,44);ctx.strokeStyle='#617784';ctx.lineWidth=1;ctx.strokeRect(-43,-22,86,44);ctx.font='800 12px system-ui';ctx.fillStyle='#b7c6c6';ctx.textAlign='center';ctx.fillText('BIG CORP',0,-3);ctx.font='8px system-ui';ctx.fillStyle='#7899a2';ctx.fillText('AIRSPACE CONTROL',0,11);ctx.restore();
  }
  if(!fork.coin.collected){
    const c=fork.coin;ctx.save();ctx.translate(c.x,c.y);const spin=reduced?1:.77+.23*Math.cos(tick*.05+fork.index);glow(ctx,0,0,46,[249,220,158],.16);ctx.scale(spin,1);
    const coin=ctx.createLinearGradient(-24,-24,24,24);coin.addColorStop(0,'#fff5d7');coin.addColorStop(.5,'#e7c786');coin.addColorStop(1,'#ad793d');ctx.fillStyle=coin;ctx.beginPath();ctx.arc(0,0,c.radius,0,TAU);ctx.fill();ctx.strokeStyle='#fff2c7';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle='#a67a42';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,c.radius-5,0,TAU);ctx.stroke();ctx.font='bold 31px Georgia';ctx.fillStyle='#79542f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Ł',0,2);ctx.restore();
  }
}
