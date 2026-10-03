// Native Blender obstacle art. This lazy presentation owner never changes the
// course, hit geometry, evidence, RNG or score. One low/medium sheet per kind.
const BASE='/assets/generated/chikun-obstacle-kit-v1/';
const NAMES=Object.freeze(['pipe','drone','canopy','storm','waterfall','gap-lip','town','city','suburb']);
const BUILDINGS=new Set(['town','city','suburb']);
const TAU=Math.PI*2;
export function selectChikunObstacleKitTier({phone=false,density=1}={}){return phone||density<=1?'low':'medium';}
export function validateChikunObstacleKit(value){
 if(value?.schema!=='chikun-obstacle-kit-v1')throw new TypeError('Unsupported obstacle kit');
 const assets={};
 for(const name of NAMES){
  const asset=value.assets?.[name],frames=asset?.frames??1,columns=asset?.columns??1,fps=asset?.fps??12;
  const building=BUILDINGS.has(name);
  if((building?(frames!==3||asset?.variation!=='static-designs'):![1,8].includes(frames))||columns!==(building?3:frames===8?4:1)||fps!==12)throw new TypeError('Unsupported obstacle loop or static designs');
  const tiers={};
  for(const tier of ['low','medium']){
   const s=asset?.tiers?.[tier],fw=s?.frameWidth??s?.width,fh=s?.frameHeight??s?.height;
   if(s?.file!==name+'-'+tier+'.webp'||!Number.isInteger(fw)||!Number.isInteger(fh)||fw<8||fh<8||fw>512||fh>512||s.width!==fw*columns||s.height!==fh*(frames/columns)||s.width>2048||s.height>1024)throw new TypeError('Unbounded obstacle texture');
   tiers[tier]=Object.freeze({file:s.file,width:s.width,height:s.height,frameWidth:fw,frameHeight:fh});
  }
  assets[name]=Object.freeze({frames,columns,fps,variation:building?'static-designs':null,tiers:Object.freeze(tiers)});
 }
 for(const tier of ['low','medium'])if(Object.values(assets).reduce((bytes,a)=>bytes+a.tiers[tier].width*a.tiers[tier].height*4,0)>(tier==='low'?4:12)*1024*1024)throw new TypeError('Obstacle kit exceeds decoded memory cap');
 return Object.freeze({assets:Object.freeze(assets)});
}
export function sampleChikunObstacleKit(asset,tier,tick=0,reduced=false){
 const s=asset.tiers[tier],time=Number.isFinite(tick)?Math.max(0,tick):0,frame=reduced||asset.variation==='static-designs'?0:Math.floor(time/5)%asset.frames;
 return {frame,x:(frame%asset.columns)*s.frameWidth,y:Math.floor(frame/asset.columns)*s.frameHeight,width:s.frameWidth,height:s.frameHeight};
}
export function createChikunObstacleKit({tier='low',ImageClass=globalThis.Image,fetchRef=globalThis.fetch,timeoutMs=12000,onStatus=()=>{}}={}){
 if(!['low','medium'].includes(tier))throw new TypeError('Unsupported obstacle tier');
 const images=new Map(),pending=new Set(),abort=new AbortController();let disposed=false,ready=false,cancel,spec=null;
 const release=()=>{ready=false;for(const img of pending)try{img.src='';}catch{}pending.clear();images.clear();};
 const work=async()=>{
  const response=await fetchRef(BASE+'manifest.json',{credentials:'same-origin',signal:abort.signal});if(!response.ok)throw new Error('Obstacle metadata unavailable');
  const text=await response.text();if(text.length>65536)throw new Error('Obstacle metadata too large');
  spec=validateChikunObstacleKit(JSON.parse(text));if(disposed)return false;
  await Promise.all(NAMES.map(async name=>{
   const s=spec.assets[name].tiers[tier],img=new ImageClass();pending.add(img);img.src=BASE+s.file;await img.decode();
   if(disposed)return;if(img.naturalWidth!==s.width||img.naturalHeight!==s.height)throw new Error('Obstacle dimensions differ');images.set(name,img);
  }));return true;
 };
 onStatus('loading');let timer;
 const loaded=Promise.race([work(),new Promise(resolve=>cancel=resolve),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Obstacle kit timed out')),timeoutMs))])
  .then(ok=>{if(disposed||ok!==true)return false;ready=true;onStatus('ready');return true;})
  .catch(()=>{if(!disposed){disposed=true;abort.abort();release();onStatus('fallback');}return false;})
  .finally(()=>{clearTimeout(timer);cancel=null;});
 const blit=(ctx,name,x,y,w,h,tick=0,reduced=false,design=null)=>{const crop=sampleChikunObstacleKit(spec.assets[name],tier,tick,reduced);if(design!==null){crop.x=design*crop.width;crop.y=0;}ctx.drawImage(images.get(name),crop.x,crop.y,crop.width,crop.height,x,y,w,h);};
 return Object.freeze({ready:loaded,tier,
  draw(ctx,o,tick=0,reduced=false){
   if(!ready||disposed||!o||!['pipe','drone','canopy','storm','waterfall','pit','town'].includes(o.kind))return false;
   const x=o.x,w=o.width,t=reduced?0:Math.max(0,tick)/60;
   ctx.save();
   if(o.kind==='town'){
    const name=BUILDINGS.has(o.variant)?o.variant:'town',index=Number.isInteger(o.index)?Math.max(0,o.index):0;
    // Static variety follows the obstacle identity, never the animation clock.
    // Each facade uses the exact same committed rectangle as the old renderer.
    for(let i=0;i<o.shapes.length;i++){const shape=o.shapes[i];if(shape.type==='rect')blit(ctx,name,shape.x,shape.y,shape.width,shape.height,0,true,(index+i)%3);}
   }else if(o.kind==='pipe')blit(ctx,'pipe',x,690-o.height,w,o.height,tick,reduced);
   else if(o.kind==='drone'){
    const sheet=spec.assets.drone.tiers[tier],h=w*sheet.frameHeight/sheet.frameWidth;
    blit(ctx,'drone',x,o.y-h*.52,w,h,tick,reduced);
    if(!reduced){ctx.strokeStyle='rgba(209,240,244,.48)';ctx.lineWidth=2;for(const px of [x+w*.15,x+w*.85]){ctx.beginPath();ctx.ellipse(px,o.y-h*.43,18,3+Math.sin(t*35)*1.5,0,0,TAU);ctx.stroke();}}
   }else if(o.kind==='canopy')blit(ctx,'canopy',x,0,w,o.height,tick,reduced);
   else if(o.kind==='storm'){
    blit(ctx,'storm',x,0,w,o.height,tick,reduced);
    // Gentle local cloud glow, never a whole-screen lightning flash.
    if(!reduced){ctx.save();ctx.beginPath();ctx.rect(x,0,w,o.height);ctx.clip();ctx.strokeStyle='rgba(190,228,240,.30)';ctx.lineWidth=1.5;
     for(let i=0;i<20;i++){const px=x+(i*47)%w,py=o.height*.24+(i*37+t*190)%(o.height*.72);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-5,py+17);ctx.stroke();}
     const glow=ctx.createRadialGradient(x+w*.54,95,4,x+w*.54,95,65);glow.addColorStop(0,`rgba(211,228,247,${.08+.04*Math.sin(t*3)})`);glow.addColorStop(1,'rgba(211,228,247,0)');ctx.fillStyle=glow;ctx.fillRect(x,30,w,130);ctx.restore();}
   }else{
    const top=o.kind==='waterfall'?690-o.height:690;
    const depth=ctx.createLinearGradient(0,top,0,720);depth.addColorStop(0,'#102936');depth.addColorStop(1,'#071b24');ctx.fillStyle=depth;ctx.fillRect(x,690,w,30);
    if(o.kind==='waterfall'){
     blit(ctx,'waterfall',x+24,top,w-48,720-top,tick,reduced);
     if(!reduced){ctx.save();ctx.beginPath();ctx.rect(x+52,top+8,w-104,710-top);ctx.clip();
      ctx.fillStyle='rgba(226,253,255,.25)';for(let i=0;i<16;i++){const py=top+(i*31+t*140)%(720-top);ctx.fillRect(x+58+i*(w-116)/16,py,2,19+(i%3)*5);}
      ctx.restore();
      for(let i=0;i<5;i++){const px=x+w*.23+i*w*.13+Math.sin(t*2+i)*8,py=711-Math.sin(t*1.5+i)**2*12;const mist=ctx.createRadialGradient(px,py,0,px,py,17);mist.addColorStop(0,'rgba(217,246,247,.22)');mist.addColorStop(1,'rgba(217,246,247,0)');ctx.fillStyle=mist;ctx.fillRect(px-17,py-17,34,34);}
     }
    }
    blit(ctx,'gap-lip',x-16,685,24,35);ctx.save();ctx.translate(x+w+16,0);ctx.scale(-1,1);blit(ctx,'gap-lip',0,685,24,35);ctx.restore();
   }
   ctx.restore();return true;
  },
  dispose(){if(disposed)return;disposed=true;abort.abort();release();cancel?.(false);},
 });
}
