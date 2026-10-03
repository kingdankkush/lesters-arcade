// Native sky loops, lazy and presentation-only. No course or simulation imports.
const BASE='/assets/generated/chikun-sky-kit-v1/';
const NAMES=Object.freeze(['hawk','pelican','plane']);
export function selectChikunSkyTier({phone=false,density=1}={}){return phone||density<=1?'low':'medium';}
export function validateChikunSkyKit(value){
 if(value?.schema!=='chikun-sky-kit-v1'||value.frames!==8||value.columns!==4||value.fps!==12)throw new TypeError('Unsupported sky kit');
 const assets={};
 for(const name of NAMES){
  const tiers={};
  for(const tier of ['low','medium']){
   const s=value.assets?.[name]?.tiers?.[tier];
   if(s?.file!==name+'-'+tier+'.webp'||!Number.isInteger(s.frameWidth)||!Number.isInteger(s.frameHeight)||s.frameWidth<16||s.frameWidth>256||s.frameHeight<16||s.frameHeight>128||s.width!==s.frameWidth*4||s.height!==s.frameHeight*2)throw new TypeError('Unbounded sky sheet');
   tiers[tier]=Object.freeze({file:s.file,width:s.width,height:s.height,frameWidth:s.frameWidth,frameHeight:s.frameHeight});
  }
  assets[name]=Object.freeze({tiers:Object.freeze(tiers)});
 }
 for(const tier of ['low','medium'])if(Object.values(assets).reduce((bytes,a)=>bytes+a.tiers[tier].width*a.tiers[tier].height*4,0)>(tier==='low'?1:2)*1024*1024)throw new TypeError('Sky kit exceeds decoded cap');
 return Object.freeze({assets:Object.freeze(assets)});
}
export function createChikunSkyKit({tier='low',ImageClass=globalThis.Image,fetchRef=globalThis.fetch,timeoutMs=12000,onStatus=()=>{}}={}){
 if(!['low','medium'].includes(tier))throw new TypeError('Unsupported sky tier');
 const images=new Map(),owned=new Set(),abort=new AbortController();let disposed=false,usable=false,spec=null,cancel,timer;
 const release=()=>{usable=false;for(const image of owned)try{image.src='';}catch{}owned.clear();images.clear();};
 const work=async()=>{
  const response=await fetchRef(BASE+'manifest.json',{credentials:'same-origin',signal:abort.signal});if(!response.ok)throw new Error('Sky metadata unavailable');
  const text=await response.text();if(text.length>65536)throw new Error('Sky metadata too large');spec=validateChikunSkyKit(JSON.parse(text));if(disposed)return false;
  await Promise.all(NAMES.map(async name=>{
   const s=spec.assets[name].tiers[tier],image=new ImageClass();owned.add(image);image.src=BASE+s.file;await image.decode();
   if(disposed)return;if(image.naturalWidth!==s.width||image.naturalHeight!==s.height)throw new Error('Sky dimensions differ');images.set(name,image);
  }));return true;
 };
 onStatus('loading');
 const ready=Promise.race([work(),new Promise(resolve=>cancel=resolve),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Sky download timed out')),timeoutMs))])
  .then(ok=>{if(disposed||ok!==true)return false;usable=true;onStatus('ready');return true;})
  .catch(()=>{if(!disposed){disposed=true;abort.abort();release();onStatus('fallback');}return false;}).finally(()=>{clearTimeout(timer);cancel=null;});
 return Object.freeze({ready,tier,
  draw(ctx,o,tick=0,reduced=false){
   if(!usable||disposed||o?.family!=='sky'||!NAMES.includes(o.kind))return false;
   const s=spec.assets[o.kind].tiers[tier],time=Number.isFinite(tick)?Math.max(0,tick):0,frame=reduced?0:Math.floor(time/5)%8,h=o.kind==='plane'?72:70;
   ctx.drawImage(images.get(o.kind),(frame%4)*s.frameWidth,Math.floor(frame/4)*s.frameHeight,s.frameWidth,s.frameHeight,o.x,o.y-h*.60,o.width,h);return true;
  },
  dispose(){if(disposed)return;disposed=true;abort.abort();release();cancel?.(false);},
 });
}
