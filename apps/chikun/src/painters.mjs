// Code-drawn region painters: the fallback for the Blender scenery (and the
// whole backdrop when art is unavailable). Each region owns three parallax
// silhouette layers painted once into offscreen canvases. Placements that can
// cross the tile edge are drawn at x and x +- W so the strip wraps without a
// seam.
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>a.map((v,i)=>Math.round(lerp(v,b[i],t)));
const rgb=(a,alpha=1)=>`rgba(${a.join(',')},${alpha})`;
const noise=(n)=>{let x=Math.imul(n+17,2654435761)>>>0;x^=x>>>13;return (Math.imul(x,2246822519)>>>0)/4294967296;};
function polygon(ctx,points,fill) {ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}

// ---- Region silhouette layers -------------------------------------------------
// depth 0: far ridge / skyline band (screen y 300–580, scrolls slowest)
// depth 1: mid ground with the region's landmarks (screen y 460–690)
// depth 2: near foreground details (screen y 530–690)
export const REGION_LAYERS=Object.freeze([
  Object.freeze({width:1600,height:280,top:300,rate:.045,base:200}),
  Object.freeze({width:1600,height:230,top:460,rate:.11,base:230}),
  Object.freeze({width:1280,height:160,top:530,rate:.3,base:160}),
]);
const NIGHT=[22,32,64];
// Small painter kit shared by every region. Colours are RGB triplets so the
// same painter renders the day and the lamp-lit night variant.
function kit(ctx,W,H,night){
  const c=(a,alpha=1)=>night?rgb(mix(a,NIGHT,.68),alpha):rgb(a,alpha);
  const lit=(a,alpha=1)=>night?rgb([246,206,124],alpha):rgb(a,alpha);
  const R=(x,y,w,h,fill)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);};
  const E=(x,y,rx,ry,fill,rot=0)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rot,0,TAU);ctx.fill();};
  const P=(pts,fill)=>polygon(ctx,pts,fill);
  const L=(x1,y1,x2,y2,stroke,w=1)=>{ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  const C=(x,y,r,fill)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();};
  // Seamless periodic ridge: heights repeat every W so tiling has no seam.
  const ridge=(baseY,amp,seed,fill,segments=16)=>{
    const pts=[[0,H]];
    for(let i=0;i<=segments;i++)pts.push([i*W/segments,baseY-noise(seed+i%segments)*amp]);
    pts.push([W,H]);P(pts,fill);
  };
  // Draw an item at x and again shifted by ±W when it crosses the seam.
  const wrap=(x,size,draw)=>{draw(x);if(x+size>W)draw(x-W);if(x<0)draw(x+W);};
  // Centred variant: items reaching `reach` px either side of x repeat across the seam.
  const wrapC=(x,reach,draw)=>{draw(x);if(x-reach<0)draw(x+W);if(x+reach>W)draw(x-W);};
  const windows=(x,y,w,h,cols,rows,dark,glass,litProb=.6,seed=0)=>{
    const cw=w/cols,rh=h/rows;
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
      const on=noise(seed+i*7+j*13)<litProb;
      R(x+i*cw+cw*.25,y+j*rh+rh*.2,cw*.5,rh*.55,night?(on?lit(glass):c(dark)):c(on?glass:dark));
    }
  };
  const tree=(x,base,kind,s)=>{
    R(x-3*s,base-26*s,6*s,26*s,c([104,78,52]));
    if(kind==='willow'){E(x,base-36*s,20*s,16*s,c([126,164,96]));ctx.strokeStyle=c([110,150,86]);ctx.lineWidth=1.2*s;for(let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(x+i*3*s,base-36*s);ctx.quadraticCurveTo(x+i*4.2*s,base-18*s,x+i*4.6*s,base-4*s);ctx.stroke();}}
    else if(kind==='cherry'){for(const [dx,dy,r,col] of [[0,-40,17,[238,176,196]],[-14,-30,12,[246,206,220]],[14,-32,13,[232,160,186]]])E(x+dx*s,base+dy*s,r*s,r*.9*s,c(col));}
    else if(kind==='pine'){P([[x-14*s,base-10*s],[x,base-56*s],[x+14*s,base-10*s]],c([58,96,66]));P([[x-10*s,base-30*s],[x,base-62*s],[x+10*s,base-30*s]],c([70,112,74]));}
    else {for(const [dx,dy,r,col] of [[0,-42,19,[74,122,66]],[-16,-30,14,[90,142,74]],[16,-32,15,[64,110,60]],[0,-26,16,[96,150,80]]])E(x+dx*s,base+dy*s,r*s,r*.85*s,c(col));}
  };
  return {c,lit,R,E,P,L,C,ridge,wrap,wrapC,windows,tree};
}
const painters={
  farmland(ctx,depth,W,H,night,k){
    const {c,R,E,P,L,C,ridge,wrap,tree}=k;
    if(depth===0){
      ridge(H-120,70,11,c([150,168,110]));ridge(H-88,52,23,c([196,170,96]));ridge(H-70,24,37,c([176,150,82]),24);
      for(let i=0;i<9;i++){k.wrapC((i*181+noise(i+40)*90)%W,70,x=>{E(x,H-92-noise(i+3)*16,14+noise(i+9)*10,9,c([110,132,84]));});}
      wrap(1100,60,x=>{P([[x-10,H-60],[x-5,H-135],[x+5,H-135],[x+10,H-60]],c([104,92,76]));for(let b=0;b<4;b++){const a=b*Math.PI/2+.4;L(x,H-140,x+Math.cos(a)*34,H-140+Math.sin(a)*34,c([104,92,76]),3);}});
      wrap(420,30,x=>{R(x,H-104,30,16,c([150,60,52]));P([[x-2,H-104],[x+15,H-114],[x+32,H-104]],c([110,44,40]));});
    }else if(depth===1){
      R(0,30,W,H-30,c([128,158,82]));R(0,36,W,34,c([206,178,98]));R(0,70,W,28,c([150,120,178]));R(0,98,W,26,c([214,84,96]));R(0,124,W,36,c([120,150,76]));
      ctx.globalAlpha=.35;for(let y=40;y<H;y+=9)L(0,y,W,y,c([60,70,40]),1);ctx.globalAlpha=1;
      for(let i=0;i<W;i+=17){E(i+4,84,3,4,c([120,90,160]));if(i%34===0)E(i+9,108,4,4,c([236,120,140]));}
      const barn=(x,base,s)=>{R(x,base-90*s,150*s,90*s,c([176,52,44]));P([[x-6*s,base-90*s],[x+30*s,base-124*s],[x+120*s,base-124*s],[x+156*s,base-90*s]],c([96,32,28]));R(x+58*s,base-56*s,34*s,56*s,c([70,26,24]));L(x+58*s,base-56*s,x+92*s,base,c([236,230,220]),2*s);L(x+92*s,base-56*s,x+58*s,base,c([236,230,220]),2*s);R(x+66*s,base-108*s,18*s,14*s,c([236,230,220]));R(x+160*s,base-120*s,36*s,120*s,c([196,196,186]));E(x+178*s,base-120*s,18*s,10*s,c([160,160,150]));};
      wrap(180,200,x=>barn(x,H-30,1));wrap(1010,140,x=>barn(x,H-46,.7));
      wrap(620,90,x=>{C(x+18,H-40,22,c([42,42,46]));C(x+18,H-40,9,c([120,120,116]));C(x+70,H-30,13,c([42,42,46]));R(x+22,H-72,50,22,c([58,120,60]));R(x+34,H-100,30,30,c([70,130,70]));R(x+38,H-96,22,16,c([200,220,230]));R(x+66,H-104,5,32,c([50,50,54]));});
      for(let x=0;x<W;x+=34){R(x,H-62,4,22,c([122,96,66]));}L(0,H-56,W,H-56,c([122,96,66]),2);L(0,H-46,W,H-46,c([122,96,66]),2);
      const cow=(x,y,s)=>{E(x,y,22*s,13*s,c([236,234,226]));E(x-6*s,y-3*s,8*s,6*s,c([40,40,44]));E(x+9*s,y+4*s,6*s,4*s,c([40,40,44]));E(x+24*s,y-8*s,8*s,6*s,c([236,234,226]));for(const dx of [-14,-6,6,14])R(x+dx*s-2*s,y+10*s,4*s,10*s,c([236,234,226]));};
      const goat=(x,y,s)=>{E(x,y,14*s,8*s,c([214,196,166]));E(x+15*s,y-8*s,6*s,5*s,c([214,196,166]));L(x+17*s,y-12*s,x+21*s,y-20*s,c([120,100,80]),1.5);for(const dx of [-8,8])R(x+dx*s-1.5*s,y+6*s,3*s,9*s,c([214,196,166]));};
      cow(430,H-84,.9);cow(500,H-90,.8);cow(1290,H-86,.9);cow(1360,H-80,.85);goat(880,H-78,1);goat(930,H-82,.9);goat(1470,H-84,1);
      for(let i=0;i<6;i++){k.wrapC((340+i*240+noise(i+77)*100)%W,70,x=>{C(x,H-18,14,c([214,182,102]));C(x,H-18,8,c([196,160,86]));C(x,H-18,3,c([214,182,102]));});}
    }else{
      const sun=(x)=>{const h=54+noise(x)*36;L(x,H,x,H-h,c([72,112,52]),2.5);E(x+8,H-h*.5,7,3,c([80,128,60]),-.5);for(let a=0;a<8;a++)E(x+Math.cos(a*TAU/8)*11,H-h+Math.sin(a*TAU/8)*11,6,3.4,c([242,196,52]),a*TAU/8);C(x,H-h,8,c([96,64,32]));};
      for(let x=40;x<420;x+=26)sun(x);
      const lav=(x)=>{const h=30+noise(x+5)*20;L(x,H,x,H-h,c([100,130,70]),1.6);for(let i=0;i<3;i++)E(x,H-h+i*7,3.2,7,c([154,110,200]));};
      for(let x=520;x<800;x+=11)lav(x);
      const tulip=(x,i)=>{const h=34+noise(x+9)*18;L(x,H,x,H-h,c([80,130,60]),2);const col=[[226,60,80],[244,150,170],[246,214,80]][i%3];P([[x-7,H-h+2],[x-5,H-h-12],[x,H-h-6],[x+5,H-h-12],[x+7,H-h+2]],c(col));};
      let i=0;for(let x=880;x<1180;x+=16)tulip(x,i++);
      for(const x of [10,470,850,1225]){R(x,H-40,6,40,c([110,86,60]));R(x-14,H-30,34,4,c([110,86,60]));}
      for(let x=0;x<W;x+=7){if(noise(x)>.5)L(x,H,x-2,H-8,c([94,130,62]),1);}
    }
  },
  forest(ctx,depth,W,H,night,k){
    const {c,R,E,P,L,C,ridge,wrap,tree}=k;
    if(depth===0){
      ridge(H-140,60,51,c([58,86,68]));
      for(let i=0;i<40;i++){const x=i*W/40+noise(i+300)*20;tree(x,H-120+noise(i+2)*20,'pine',.55+noise(i+3)*.35);}
      ridge(H-80,40,67,c([70,104,72]),20);
      wrap(1180,120,x=>{P([[x,H],[x+10,H-150],[x+70,H-160],[x+120,H-140],[x+130,H]],c([98,92,84]));P([[x+34,H-150],[x+58,H-154],[x+66,H-60],[x+30,H-60]],c([118,112,104]));const g=ctx.createLinearGradient(0,H-150,0,H-40);g.addColorStop(0,c([214,238,244]));g.addColorStop(1,c([150,196,214],.85));ctx.fillStyle=g;ctx.fillRect(x+40,H-150,18,110);ctx.globalAlpha=.7;for(let s=0;s<5;s++)L(x+43+s*3,H-148+s*8,x+43+s*3,H-70-s*6,c([246,252,254]),1);ctx.globalAlpha=1;E(x+50,H-38,30,10,c([214,234,240],.7));});
      for(let i=0;i<14;i++){k.wrapC((i*117+noise(i+8)*80)%W,160,x=>{tree(x,H-64,'oak',.5+noise(i+4)*.3);});}
    }else if(depth===1){
      R(0,30,W,H-30,c([86,110,60]));ctx.globalAlpha=.25;for(let i=0;i<W;i+=23)E(i,44+noise(i)*60,16,6,c([60,90,50]));ctx.globalAlpha=1;
      R(0,H-72,W,34,c([92,150,170]));ctx.globalAlpha=.5;for(let x=0;x<W;x+=40){L(x,H-62,x+22,H-62,c([210,236,240]),1.2);L(x+15,H-48,x+35,H-48,c([210,236,240]),1);}ctx.globalAlpha=1;
      for(let i=0;i<20;i++){k.wrapC((i*83+noise(i+400)*40)%W,70,x=>{E(x,H-38+noise(i+2)*4,8+noise(i)*8,4,c([150,150,140]));});}
      wrap(700,160,x=>{ctx.fillStyle=c([140,104,70]);ctx.beginPath();ctx.moveTo(x,H-72);ctx.quadraticCurveTo(x+80,H-104,x+160,H-72);ctx.lineTo(x+160,H-60);ctx.quadraticCurveTo(x+80,H-92,x,H-60);ctx.closePath();ctx.fill();for(let p=0;p<8;p++)L(x+8+p*20,H-72,x+8+p*20,H-94,c([120,88,58]),3);L(x,H-94,x+160,H-94,c([120,88,58]),2.5);L(x+8,H-84,x+152,H-84,c([120,88,58]),1.5);});
      const kinds=['oak','willow','cherry','oak','cherry','willow','oak','oak','cherry'];
      for(let i=0;i<9;i++){k.wrapC((60+i*175+noise(i+30)*60)%W,160,x=>{tree(x,H-76,kinds[i],1.1+noise(i+50)*.5);});}
      for(let i=0;i<5;i++){k.wrapC((300+i*330+noise(i+60)*120)%W,70,x=>{const _wx=0,s=1+noise(i+70)*.8;P([[x-24*s,H-40],[x-18*s,H-40-24*s],[x+4*s,H-40-30*s],[x+26*s,H-40-18*s],[x+30*s,H-40]],c([130,132,128]));P([[x-10*s,H-40],[x+4*s,H-40-30*s],[x+30*s,H-40]],c([108,110,106]));});}
    }else{
      const fern=(x,s)=>{for(let a=-3;a<=3;a++){ctx.strokeStyle=c([70,120,60]);ctx.lineWidth=1.6*s;ctx.beginPath();ctx.moveTo(x,H);ctx.quadraticCurveTo(x+a*8*s,H-24*s,x+a*16*s,H-30*s);ctx.stroke();}};
      const bush=(x,s)=>{for(const [dx,dy,r] of [[0,-14,16],[-14,-8,12],[14,-9,12],[0,-4,14]])E(x+dx*s,H+dy*s,r*s,r*.8*s,c([60,100,56]));};
      for(let i=0;i<10;i++){k.wrapC((i*128+noise(i+500)*60)%W,70,x=>{if(i%3===0)bush(x,1+noise(i)*.6);else fern(x,1+noise(i+1)*.5);});}
      for(const [x,s] of [[150,1.2],[700,.9],[1100,1.4]])P([[x-20*s,H],[x-14*s,H-22*s],[x+6*s,H-28*s],[x+24*s,H-14*s],[x+28*s,H]],c([112,116,112]));
      wrap(880,90,x=>{R(x,H-22,90,18,c([104,78,52]));E(x+90,H-13,6,9,c([140,110,80]));L(x+10,H-16,x+80,H-14,c([90,66,44]),1);});
      for(const [x,col] of [[420,[190,60,60]],[436,[190,60,60]],[1240,[220,140,60]]]){R(x-2,H-10,4,10,c([230,224,210]));E(x,H-11,8,5,c(col));C(x-3,H-12,1.4,c([250,250,240]));C(x+3,H-13,1.2,c([250,250,240]));}
      for(let x=560;x<640;x+=14){L(x,H,x,H-40,c([90,120,60]),1.5);E(x,H-36,2.5,7,c([110,80,50]));}
    }
  },
  town(ctx,depth,W,H,night,k){
    const {c,lit,R,E,P,L,C,ridge,wrap,windows,tree}=k;
    if(depth===0){
      ridge(H-110,50,81,c([140,160,104]));ridge(H-80,30,97,c([124,146,96]),20);
      wrap(500,40,x=>{R(x,H-130,26,70,c([180,172,160]));P([[x-3,H-130],[x+13,H-176],[x+29,H-130]],c([120,110,100]));R(x+9,H-118,8,12,lit([80,80,90]));});
      wrap(1200,60,x=>{for(const dx of [6,26,46])L(x+dx,H-70,x+dx,H-126,c([120,110,100]),2.5);R(x-4,H-150,62,30,c([150,140,130]));E(x+27,H-150,31,8,c([170,160,150]));});
      for(let i=0;i<18;i++){k.wrapC((i*89+noise(i+600)*40)%W,70,x=>{const _wx=0,h=18+noise(i+2)*20;R(x,H-72-h,30,h+12,c([170,150,140]));P([[x-2,H-72-h],[x+15,H-84-h],[x+32,H-72-h]],c([120,90,84]));});}
      for(let i=0;i<10;i++){k.wrapC((i*160+noise(i+700)*90)%W,160,x=>{tree(x,H-62,'oak',.55);});}
    }else if(depth===1){
      R(0,30,W,H-30,c([150,140,124]));ctx.globalAlpha=.3;for(let y=36;y<H;y+=12)L(0,y,W,y,c([90,84,74]),1);ctx.globalAlpha=1;
      const faces=[[178,110,90],[222,206,170],[110,150,150],[214,180,110],[190,150,140],[160,170,190]];
      let x=20,i=0;
      while(x<W-40){
        const w=150+Math.floor(noise(i+800)*80),h=100+Math.floor(noise(i+801)*70),base=H-24,f=faces[i%faces.length];
        R(x,base-h,w,h,c(f));R(x,base-h-8,w,8,c([80,70,66]));R(x-4,base-h-6,w+8,4,c([96,84,80]));
        windows(x+10,base-h+18,w-20,h-70,Math.max(2,Math.floor(w/44)),2,[52,58,70],[212,226,230],.55,i*31);
        R(x+w*.4,base-44,26,44,c([70,50,44]));R(x+w*.45,base-24,4,4,lit([220,200,120]));
        for(let s=0;s<Math.floor((w-10)/16);s++)R(x+5+s*16,base-58,16,10,c(s%2?[210,70,70]:[240,240,236]));R(x+5,base-48,w-10,3,c([110,60,60]));
        R(x+w*.1,base-h+30,w*.5,14,c([60,60,70]));
        if(i%4===1){R(x+w*.3,base-h-50,w*.4,50,c(f));P([[x+w*.3-4,base-h-50],[x+w*.5,base-h-76],[x+w*.7+4,base-h-50]],c([80,70,66]));C(x+w*.5,base-h-26,12,c([240,236,220]));L(x+w*.5,base-h-26,x+w*.5,base-h-34,c([40,40,40]),1.5);L(x+w*.5,base-h-26,x+w*.5+6,base-h-24,c([40,40,40]),1.5);}
        else if(i%3===0)R(x+w-30,base-h-24,12,24,c([90,70,60]));
        x+=w+26;i++;
      }
    }else{
      const lamp=(x)=>{R(x-2,H-78,4,78,c([50,54,60]));R(x-7,H-90,14,14,lit([200,214,220]));R(x-9,H-92,18,3,c([50,54,60]));};
      for(const x of [90,530,980,1230])lamp(x);
      const bench=(x)=>{R(x,H-22,60,5,c([110,80,56]));R(x,H-34,60,4,c([110,80,56]));for(const dx of [4,52])R(x+dx,H-22,4,22,c([60,60,64]));};
      bench(300);bench(760);
      const hedge=(x,w)=>{for(let i=0;i<w;i+=18)E(x+i,H-14,14,14,c([76,120,70]));};
      hedge(140,120);hedge(600,110);hedge(1060,130);
      for(const x of [420,880]){R(x,H-20,40,20,c([150,110,90]));for(let i=0;i<5;i++)C(x+6+i*7,H-24,3,c([[230,80,90],[240,200,70],[250,140,160]][i%3]));}
    }
  },
  city(ctx,depth,W,H,night,k){
    const {c,lit,R,E,P,L,C,wrap,windows}=k;
    if(depth===0){
      R(0,H-70,W,70,c([64,88,104]));
      let x=0,i=0;
      while(x<W){
        const w=34+Math.floor(noise(i+900)*62),h=90+noise(i+84)*170,y=H-70-h;
        const g=ctx.createLinearGradient(x,y,x+w,H);g.addColorStop(0,c([100,139,155]));g.addColorStop(1,c([49,83,103]));ctx.fillStyle=g;ctx.fillRect(x,y,w,h+70);
        P([[x+w,y],[x+w+10,y+7],[x+w+10,H],[x+w,H]],c([52,87,107]));R(x,y,w,2,c([153,179,184]));
        if(i%4===0){R(x+w*.28,y-14,w*.44,14,c([100,139,155]));L(x+w/2,y-14,x+w/2,y-32,c([167,183,188]),1);if(night)R(x+w/2-1,y-33,2,3,rgb([238,156,137]));}
        if(i%7===2)P([[x+3,y],[x+w*.5,y-34],[x+w-3,y]],c([100,139,155]));
        for(let wy=y+12;wy<H-76;wy+=11)for(let wx=x+7;wx<x+w-5;wx+=10){const on=noise(Math.round(wx*3+wy)+i)>.40;ctx.globalAlpha=night?.7:.4;R(wx,wy,3,5,night?(on?rgb(noise(i+wy)>.5?[234,184,144]:[130,182,195]):rgb([32,56,76])):(on?rgb([151,182,191]):rgb([83,123,144])));}
        ctx.globalAlpha=1;x+=w+12+noise(i+8)*18;i++;
      }
    }else if(depth===1){
      R(0,20,W,H-20,c([96,104,110]));
      const faces=[[128,140,150],[100,112,124],[150,130,120],[118,124,140]];
      let x=10,i=0;
      while(x<W-30){
        const w=140+Math.floor(noise(i+1000)*120),h=120+Math.floor(noise(i+1001)*70),base=H-20,f=faces[i%faces.length];
        R(x,base-h,w,h,c(f));R(x,base-h,w,6,c([70,74,80]));
        windows(x+8,base-h+14,w-16,h-40,Math.floor(w/28),Math.floor((h-40)/24),[40,48,60],[206,226,236],.62,i*17);
        if(i%3===0){R(x+w-46,base-h-30,30,30,c([90,80,76]));E(x+w-31,base-h-30,15,5,c([110,100,96]));for(const dx of [-42,-20])R(x+w+dx,base-h-42,2,12,c([90,80,76]));}
        if(i%3===1){R(x+w*.2,base-h-40,w*.6,32,c([40,44,50]));const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,lit([220,120,160]));g.addColorStop(1,lit([120,170,230]));ctx.fillStyle=g;ctx.fillRect(x+w*.22,base-h-38,w*.56,28);for(const dx of [.28,.68])R(x+w*dx,base-h-8,3,8,c([40,44,50]));}
        if(i%4===2)for(let f2=0;f2<4;f2++)R(x+w-40,base-h+26+f2*26,32,3,c([60,64,72]));
        x+=w+18;i++;
      }
      R(0,H-92,W,14,c([80,86,92]));R(0,H-80,W,4,c([60,64,70]));for(let px=60;px<W;px+=200)R(px,H-78,16,58,c([80,86,92]));L(0,H-96,W,H-96,c([130,136,142]),2);for(let px=0;px<W;px+=22)R(px,H-104,2,8,c([130,136,142]));
    }else{
      const lamp=(x)=>{R(x-2,H-110,4,110,c([50,54,60]));L(x,H-110,x+34,H-118,c([50,54,60]),4);R(x+26,H-124,20,8,lit([214,224,230]));};
      for(const x of [60,560,1060])lamp(x);
      const light=(x)=>{R(x-2,H-82,4,82,c([50,54,60]));R(x-8,H-108,16,30,c([40,40,44]));C(x,H-100,4,night?rgb([240,70,60]):rgb([120,50,50]));C(x,H-91,4,c([200,150,40]));C(x,H-82,4,night?rgb([80,220,110]):rgb([50,120,70]));};
      light(300);light(880);
      wrap(680,120,x=>{R(x,H-90,120,6,c([60,64,70]));for(const dx of [4,110])R(x+dx,H-84,6,84,c([60,64,70]));R(x+10,H-82,100,60,night?rgb([150,190,210],.35):rgb([200,220,230],.4));R(x+14,H-74,92,12,lit([220,200,140]));});
      for(let s=0;s<3;s++){const x=1160+s*40;R(x,H-16,8,16,c([200,60,50]));R(x-2,H-20,12,5,c([200,60,50]));}
      for(let x=380;x<520;x+=18){R(x,H-30,3,30,c([90,96,104]));}L(380,H-30,520,H-30,c([90,96,104]),3);L(380,H-18,520,H-18,c([90,96,104]),2);
      for(let x=0;x<W;x+=40)R(x,H-6,22,6,c([220,222,214]));
    }
  },
  industrial(ctx,depth,W,H,night,k){
    const {c,lit,R,E,P,L,C,ridge,wrap}=k;
    if(depth===0){
      ridge(H-90,30,111,c([120,116,110]),20);
      const stack=(x,h,w)=>{R(x,H-70-h,w,h+70,c([110,104,100]));R(x,H-70-h,w,10,c([190,70,60]));R(x,H-60-h,w,8,c([230,230,224]));for(let s=0;s<5;s++)E(x+w/2+s*22+8,H-86-h-s*16,18+s*6,10+s*3,c([200,200,200],.42-s*.06));};
      wrap(220,40,x=>stack(x,150,24));wrap(300,40,x=>stack(x,120,20));wrap(1200,40,x=>stack(x,170,28));
      wrap(560,120,x=>{P([[x,H],[x+22,H-130],[x+98,H-130],[x+120,H]],c([150,146,140]));P([[x+30,H-130],[x+90,H-130],[x+84,H-150],[x+36,H-150]],c([150,146,140]));E(x+60,H-142,28,10,c([210,210,206],.5));});
      for(const [x,w] of [[760,70],[850,70],[940,50]]){R(x,H-100,w,100,c([140,138,130]));E(x+w/2,H-100,w/2,10,c([164,162,154]));L(x+w-8,H-100,x+w-8,H-40,c([90,90,86]),2);}
      wrap(1400,140,x=>{R(x,H-160,10,160,c([140,110,60]));R(x-40,H-160,180,6,c([140,110,60]));for(let s=0;s<6;s++)L(x-40+s*30,H-154,x-25+s*30,H-140,c([140,110,60]),2);L(x+120,H-154,x+120,H-100,c([90,90,86]),1);R(x+114,H-100,12,10,c([90,90,86]));});
    }else if(depth===1){
      R(0,30,W,H-30,c([110,108,100]));
      let x=20,i=0;
      while(x<W-60){
        const w=200+Math.floor(noise(i+1200)*140),h=70+Math.floor(noise(i+1201)*50),base=H-40;
        R(x,base-h,w,h,c([140,140,132]));const teeth=Math.max(2,Math.floor(w/48));
        for(let t=0;t<teeth;t++){const tx=x+t*w/teeth,tw=w/teeth;P([[tx,base-h],[tx+tw*.6,base-h-26],[tx+tw,base-h]],c([124,126,118]));R(tx+tw*.62,base-h-24,tw*.36,22,lit([190,210,220]));}
        R(x+20,base-40,44,40,c([80,84,80]));R(x+w-70,base-40,44,40,c([80,84,80]));for(let d=0;d<5;d++)L(x+20,base-32+d*7,x+64,base-32+d*7,c([110,110,104]),1);
        R(x+w-30,base-h-50,12,50,c([120,110,104]));
        x+=w+40;i++;
      }
      for(const [y,r] of [[64,5],[82,4],[H-70,6]]){R(0,y-r,W,r*2,c([150,150,146]));R(0,y-r,W,2,c([190,190,186]));for(let f=0;f<W;f+=140){R(f,y-r-3,8,r*2+6,c([90,96,90]));}for(let v=70;v<W;v+=380){C(v,y,9,c([90,96,90]));R(v-2,y-16,4,10,c([200,60,50]));}}
      for(let v=200;v<W;v+=520)R(v,64,10,H-134,c([150,150,146]));
      wrap(1040,90,x=>{R(x,H-150,80,110,c([160,148,120]));E(x+40,H-150,40,10,c([180,168,140]));for(let d=0;d<8;d++)L(x+66,H-140+d*12,x+74,H-140+d*12,c([90,90,86]),1.5);L(x+66,H-140,x+66,H-50,c([90,90,86]),1.5);L(x+74,H-140,x+74,H-50,c([90,90,86]),1.5);});
      wrap(480,160,x=>{P([[x,H-40],[x+160,H-110],[x+160,H-100],[x,H-30]],c([90,90,92]));for(let s=0;s<8;s++)L(x+s*20,H-40+s*-8.7,x+s*20,H-40,c([90,90,92]),2);});
    }else{
      for(let x=0;x<W;x+=150){P([[x+10,H],[x+22,H-92],[x+34,H]],c([70,72,70]));}
      for(const [y,r] of [[H-90,7],[H-70,5]]){R(0,y-r,W,r*2,c([150,150,146]));R(0,y-r,W,2,c([196,196,190]));for(let f=0;f<W;f+=90)R(f,y-r-2,6,r*2+4,c([90,96,90]));}
      const barrel=(x,col)=>{R(x,H-30,22,30,c(col));E(x+11,H-30,11,3,c([200,200,196],.6));R(x,H-22,22,3,c([60,60,60],.5));R(x,H-12,22,3,c([60,60,60],.5));};
      for(const [x,col] of [[120,[180,80,50]],[144,[70,90,120]],[168,[200,170,60]],[820,[70,90,120]],[844,[180,80,50]]])barrel(x,col);
      for(let x=380;x<640;x+=60){R(x,H-60,4,60,c([110,110,106]));}L(380,H-58,640,H-58,c([110,110,106]),2);ctx.globalAlpha=.35;for(let d=380;d<640;d+=10){L(d,H-56,d+10,H-46,c([170,170,166]),1);L(d,H-46,d+10,H-56,c([170,170,166]),1);L(d,H-36,d+10,H-26,c([170,170,166]),1);L(d,H-26,d+10,H-36,c([170,170,166]),1);L(d,H-16,d+10,H-6,c([170,170,166]),1);L(d,H-6,d+10,H-16,c([170,170,166]),1);}ctx.globalAlpha=1;
      for(let s=0;s<8;s++)P([[960+s*12,H-10],[970+s*12,H-10],[964+s*12,H],[954+s*12,H]],s%2?c([230,200,40]):c([40,40,40]));
      for(const x of [1080,1120]){R(x,H-8,34,8,c([150,120,80]));for(let p=0;p<4;p++)R(x+p*9,H-8,5,8,c([120,96,60]));}
    }
  },
  suburbs(ctx,depth,W,H,night,k){
    const {c,lit,R,E,P,L,C,ridge,wrap,tree}=k;
    if(depth===0){
      ridge(H-110,50,131,c([150,178,118]));ridge(H-84,30,147,c([130,160,104]),20);
      wrap(900,60,x=>{for(const dx of [6,26,46])L(x+dx,H-70,x+dx,H-130,c([150,140,130]),2.5);R(x-4,H-154,62,30,c([190,180,170]));E(x+27,H-154,31,8,c([210,200,190]));});
      for(let i=0;i<22;i++){k.wrapC((i*73+noise(i+1300)*40)%W,70,x=>{const _wx=0,h=14+noise(i+2)*10;R(x,H-72-h,26,h+12,c([210,196,180]));P([[x-2,H-72-h],[x+13,H-82-h],[x+28,H-72-h]],c([120,90,84]));});}
      for(let i=0;i<14;i++){k.wrapC((i*114+noise(i+1400)*70)%W,160,x=>{tree(x,H-62,'oak',.5+noise(i)*.2);});}
    }else if(depth===1){
      R(0,30,W,H-30,c([128,168,90]));R(0,H-50,W,22,c([120,120,124]));for(let x=0;x<W;x+=40)R(x,H-40,20,2,c([230,220,150]));
      const cols=[[236,220,196],[196,214,230],[228,196,180],[214,230,200],[240,232,210]];
      let x=30,i=0;
      while(x<W-60){
        const w=110+Math.floor(noise(i+1500)*50),h=66+Math.floor(noise(i+1501)*34),base=H-56,f=cols[i%cols.length];
        R(x,base-h,w,h,c(f));P([[x-8,base-h],[x+w/2,base-h-40],[x+w+8,base-h]],c(i%2?[120,86,74]:[96,80,90]));
        R(x+w*.7,base-h-30,10,22,c([120,90,84]));
        R(x+w*.42,base-32,20,32,c([100,70,60]));C(x+w*.42+16,base-16,1.5,c([220,200,120]));
        for(const dx of [.12,.72])R(x+w*dx,base-h+14,20,18,lit([200,220,236]));for(const dx of [.12,.72])L(x+w*dx+10,base-h+14,x+w*dx+10,base-h+32,c([90,90,96]),1);
        if(i%2===0){R(x+w,base-46,48,46,c(f));P([[x+w-4,base-46],[x+w+24,base-62],[x+w+52,base-46]],c([120,86,74]));R(x+w+6,base-36,36,36,c([160,150,140]));for(let d=1;d<4;d++)L(x+w+6,base-36+d*9,x+w+42,base-36+d*9,c([120,110,100]),1);R(x+w+8,base,32,10,c([150,150,152]));}
        R(x+w+58,base-12,3,12,c([60,60,70]));R(x+w+54,base-18,12,7,c([60,60,70]));R(x+w+63,base-24,2,8,c([220,60,60]));
        tree(x+w+90,base+4,i%3===0?'cherry':'oak',.9+noise(i+1600)*.4);
        x+=w+130;i++;
      }
    }else{
      const picket=(x,w)=>{for(let i=0;i<w;i+=12){P([[x+i,H],[x+i,H-26],[x+i+3,H-31],[x+i+6,H-26],[x+i+6,H]],c([240,236,224]));}L(x,H-20,x+w,H-20,c([220,216,200]),3);L(x,H-8,x+w,H-8,c([220,216,200]),3);};
      picket(40,200);picket(560,180);picket(1000,220);
      const hedge=(x,w)=>{for(let i=0;i<w;i+=16)E(x+i,H-12,13,13,c([70,120,64]));};
      hedge(300,120);hedge(800,100);
      for(const x of [270,780]){R(x,H-40,4,40,c([70,70,80]));R(x-8,H-50,20,12,c([60,60,70]));R(x+12,H-56,2,8,c([220,60,60]));}
      wrap(460,40,x=>{R(x,H-90,5,90,c([80,84,90]));R(x-16,H-100,38,24,c([230,230,226]));E(x+3,H-78,8,3,c([230,110,50]));});
      wrap(1260,40,x=>{C(x,H-12,12,c([40,44,50]));C(x+30,H-12,12,c([40,44,50]));C(x,H-12,7,c([200,200,200]));C(x+30,H-12,7,c([200,200,200]));L(x,H-12,x+16,H-30,c([220,80,80]),2.5);L(x+16,H-30,x+30,H-12,c([220,80,80]),2.5);L(x+8,H-14,x+16,H-30,c([220,80,80]),2);});
      for(let x=0;x<W;x+=9){if(noise(x+3)>.6)L(x,H,x-2,H-6,c([100,150,70]),1);}
      for(const x of [150,660,1130])for(let i=0;i<6;i++)C(x+i*8,H-3,2.5,c([[240,90,110],[250,210,80],[240,240,240]][i%3]));
    }
  },
  coast(ctx,depth,W,H,night,k){
    const {c,lit,R,E,P,L,C,wrap}=k;
    if(depth===0){
      const g=ctx.createLinearGradient(0,H-150,0,H);g.addColorStop(0,c([70,140,180]));g.addColorStop(1,c([40,100,150]));ctx.fillStyle=g;ctx.fillRect(0,H-150,W,150);L(0,H-150,W,H-150,c([200,230,240],.6),1);
      ctx.globalAlpha=.35;for(let i=0;i<60;i++){k.wrapC((i*173+noise(i+1700)*90)%W,70,x=>{const _wx=0,y=H-140+noise(i+1)*100;L(x,y,x+20+noise(i+2)*50,y,c([220,240,246]),1);});}ctx.globalAlpha=1;
      E(700,H-150,90,12,c([90,110,110]));
      wrap(1250,140,x=>{P([[x-40,H-60],[x-10,H-140],[x+60,H-150],[x+120,H-130],[x+140,H-60],[x+140,H],[x-40,H]],c([110,100,92]));P([[x+30,H-150],[x+40,H-236],[x+64,H-236],[x+74,H-150]],c([236,232,220]));R(x+34,H-210,36,10,c([200,60,60]));R(x+36,H-180,32,10,c([200,60,60]));R(x+38,H-252,28,16,c([60,60,66]));R(x+42,H-249,20,10,lit([200,220,230]));if(night){const beam=ctx.createLinearGradient(x+52,0,x+330,0);beam.addColorStop(0,rgb([250,230,160],.32));beam.addColorStop(1,rgb([250,230,160],0));P([[x+52,H-244],[x+330,H-310],[x+330,H-180]],beam);}});
      for(const [x,s] of [[300,1],[520,.7],[980,.85]]){P([[x-18*s,H-100],[x+18*s,H-100],[x+12*s,H-94],[x-12*s,H-94]],c([80,90,100]));P([[x-2*s,H-100],[x-2*s,H-100-34*s],[x+14*s,H-100]],c([240,240,236]));P([[x-4*s,H-100],[x-16*s,H-100],[x-4*s,H-100-24*s]],c([240,240,236]));}
      for(let i=0;i<7;i++){k.wrapC((i*230+noise(i+1800)*100)%W,70,x=>{const _wx=0,y=30+noise(i+3)*60;ctx.strokeStyle=c([250,250,250]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-6,y);ctx.quadraticCurveTo(x-3,y-4,x,y);ctx.quadraticCurveTo(x+3,y-4,x+6,y);ctx.stroke();});}
    }else if(depth===1){
      R(0,20,W,H-20,c([222,200,150]));
      for(let i=0;i<9;i++){k.wrapC((i*190+noise(i+1900)*80)%W,160,x=>{const _wx=0,rx=90+noise(i)*60;E(x,H-40,rx,30+noise(i+4)*16,c(i%2?[232,212,160]:[214,190,140]));for(let g=0;g<12;g++){const gx=x-rx*.7+g*rx*.12;L(gx,H-56-noise(g+i)*14,gx+(noise(g)-.5)*10,H-76-noise(g+i+2)*10,c([150,160,90]),1.4);}});}
      wrap(300,420,x=>{for(let p=0;p<14;p++)R(x+p*30,H-70,6,70,c([110,88,64]));R(x-6,H-80,420,12,c([130,104,76]));for(let p=0;p<14;p++)R(x+p*30,H-96,3,16,c([120,96,70]));L(x-6,H-96,x+414,H-96,c([120,96,70]),2);R(x+200,H-126,80,46,c([210,190,160]));P([[x+194,H-126],[x+240,H-146],[x+286,H-126]],c([180,70,60]));R(x+230,H-104,16,24,c([90,110,130]));R(x+206,H-118,14,12,lit([190,220,230]));});
      wrap(900,120,x=>{P([[x,H-20],[x+20,H-48],[x+110,H-48],[x+120,H-20]],c([80,110,140]));R(x+10,H-40,100,6,c([230,230,224]));R(x+50,H-88,4,40,c([120,100,80]));P([[x+54,H-86],[x+54,H-52],[x+90,H-52]],c([236,236,230]));});
      for(const [x,s] of [[1300,1.2],[1360,.8],[1420,1]])P([[x-24*s,H-20],[x-16*s,H-20-24*s],[x+6*s,H-20-28*s],[x+26*s,H-20]],c([120,118,110]));
    }else{
      R(0,H-46,W,46,c([124,190,210],.62));
      ctx.strokeStyle=c([244,250,252],.9);ctx.lineWidth=2;for(let i=0;i<8;i++){const y=H-40+i*4.6,ph=noise(i+2000)*W;ctx.beginPath();for(let x=0;x<=W;x+=40){const yy=y+Math.sin((x+ph)/60)*3;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy);}ctx.stroke();}
      const umbrella=(x,col)=>{R(x-1,H-80,3,80,c([200,200,196]));for(let s=0;s<6;s++){ctx.fillStyle=c(s%2?col:[250,250,240]);ctx.beginPath();ctx.moveTo(x,H-80);ctx.arc(x,H-80,32,Math.PI+s*Math.PI/6,Math.PI+(s+1)*Math.PI/6);ctx.closePath();ctx.fill();}};
      umbrella(180,[230,70,70]);umbrella(760,[60,120,200]);umbrella(1120,[240,180,60]);
      for(const x of [230,810]){R(x,H-30,30,6,c([230,220,200]));R(x-2,H-24,4,24,c([230,220,200]));R(x+30,H-24,4,24,c([230,220,200]));P([[x+2,H-30],[x+2,H-52],[x+18,H-30]],c([200,90,90]));}
      wrap(480,60,x=>{ctx.save();ctx.translate(x,H-10);ctx.rotate(-.15);R(0,-6,60,10,c([150,120,90]));ctx.restore();});
      for(let i=0;i<10;i++){k.wrapC((i*140+noise(i+2100)*60)%W,70,x=>{ctx.strokeStyle=c([250,246,230]);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,H-52,4,Math.PI,TAU);ctx.stroke();});}
      wrap(1000,30,x=>{R(x,H-22,20,22,c([230,90,60]));E(x+10,H-22,10,3,c([250,140,110]));ctx.strokeStyle=c([230,90,60]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+10,H-22,10,Math.PI,TAU);ctx.stroke();});
    }
  },
};
export function paintRegionLayer(ctx,regionId,depth,night=false,size=REGION_LAYERS[depth]){
  const painter=painters[regionId];if(!painter)return false;
  ctx.clearRect(0,0,size.width,size.height);
  painter(ctx,depth,size.width,size.height,night,kit(ctx,size.width,size.height,night));
  return true;
}
