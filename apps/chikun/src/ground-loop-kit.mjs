// Native cosmetic loops; no simulation imports or state mutation.
const BASE='/assets/generated/chikun-ground-loop-kit-v1/';
export function validateChikunGroundLoopKit(value){
 if(value?.schema!=='chikun-ground-loop-kit-v1'||JSON.stringify(value.names)!=='["shiba","hurdle"]'||value.frames!==8||value.fps!==12)throw new TypeError('Unsupported ground loop atlas');
 const tiers={};for(const tier of ['low','medium']){
  const s=value.tiers?.[tier],fw=tier==='low'?128:256,fh=fw/2;
  if(s?.file!==`loops-${tier}.webp`||s.width!==fw*8||s.height!==fh*2||s.frameWidth!==fw||s.frameHeight!==fh)throw new TypeError('Unbounded loop atlas');
  tiers[tier]=Object.freeze({file:s.file,width:s.width,height:s.height,frameWidth:fw,frameHeight:fh});
 }return Object.freeze({tiers:Object.freeze(tiers)});
}
export function createChikunGroundLoopKit({tier='low',ImageClass=globalThis.Image,fetchRef=globalThis.fetch,timeoutMs=12000,onStatus=()=>{}}={}){
 if(!['low','medium'].includes(tier))throw new TypeError('Unsupported loop tier');
 const abort=new AbortController();let disposed=false,usable=false,spec=null,image=null,cancel,timer;
 const release=()=>{usable=false;if(image)try{image.src='';}catch{}image=null;};
 const work=async()=>{
  const response=await fetchRef(BASE+'manifest.json',{credentials:'same-origin',signal:abort.signal});if(!response.ok)throw new Error('Loop metadata unavailable');
  const text=await response.text();if(text.length>65536)throw new Error('Loop metadata too large');spec=validateChikunGroundLoopKit(JSON.parse(text));if(disposed)return false;
  const sheet=spec.tiers[tier],pending=new ImageClass();image=pending;pending.src=BASE+sheet.file;await pending.decode();
  if(disposed)return false;if(pending.naturalWidth!==sheet.width||pending.naturalHeight!==sheet.height)throw new Error('Loop dimensions differ');return true;
 };
 onStatus('loading');const ready=Promise.race([work(),new Promise(r=>cancel=r),new Promise((_,r)=>timer=setTimeout(()=>r(new Error('Loop download timed out')),timeoutMs))])
  .then(ok=>{if(disposed||ok!==true)return false;usable=true;onStatus('ready');return true;})
  .catch(()=>{if(!disposed){disposed=true;abort.abort();release();onStatus('fallback');}return false;}).finally(()=>{clearTimeout(timer);cancel=null;});
 return Object.freeze({ready,tier,draw(ctx,o,tick=0,reduced=false){
  if(!usable||disposed||o?.family!=='ground')return false;const row=['shiba','hurdle'].indexOf(o.kind);if(row<0)return false;
  const frame=reduced?0:Math.floor(Math.max(0,Number.isFinite(tick)?tick:0)/5)%8,s=spec.tiers[tier],y=690-o.height,bounce=!reduced&&o.kind==='shiba'?Math.abs(Math.sin(tick*.19))*3:0;
  ctx.drawImage(image,frame*s.frameWidth,row*s.frameHeight,s.frameWidth,s.frameHeight,o.x,y-bounce,o.width,o.height);
  if(o.kind==='shiba'){ctx.fillStyle='#edd7a3';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText('SHIBA!',o.x+o.width/2,y-11);}return true;
 },dispose(){if(disposed)return;disposed=true;abort.abort();release();cancel?.(false);}});
}
