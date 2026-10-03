// Four static native ground props, lazy presentation only. No course imports.
const BASE='/assets/generated/chikun-ground-obstacle-kit-v1/';
export const CHIKUN_NATIVE_GROUND_NAMES=Object.freeze(['rock','log','thorn','crate']);
export function selectChikunGroundObstacleTier({phone=false,density=1}={}){return phone||density<=1?'low':'medium';}
export function validateChikunGroundObstacleKit(value){
  if(value?.schema!=='chikun-ground-obstacle-kit-v1'||JSON.stringify(value.names)!==JSON.stringify(CHIKUN_NATIVE_GROUND_NAMES))throw new TypeError('Unsupported ground obstacle atlas');
  const tiers={};
  for(const tier of ['low','medium']){
    const s=value.tiers?.[tier],fw=tier==='low'?256:512,fh=fw/2;
    if(s?.file!==`ground-${tier}.webp`||s.width!==fw*2||s.height!==fh*2||s.frameWidth!==fw||s.frameHeight!==fh)throw new TypeError('Unbounded ground obstacle atlas');
    if(s.width*s.height*4>(tier==='low'?1:2)*1024*1024)throw new TypeError('Ground atlas exceeds decoded cap');
    tiers[tier]=Object.freeze({file:s.file,width:s.width,height:s.height,frameWidth:fw,frameHeight:fh});
  }
  return Object.freeze({tiers:Object.freeze(tiers)});
}
export function createChikunGroundObstacleKit({tier='low',ImageClass=globalThis.Image,fetchRef=globalThis.fetch,timeoutMs=12000,onStatus=()=>{}}={}){
  if(!['low','medium'].includes(tier))throw new TypeError('Unsupported ground tier');
  const abort=new AbortController();let disposed=false,usable=false,spec=null,image=null,cancel,timer;
  const release=()=>{usable=false;if(image)try{image.src='';}catch{}image=null;};
  const work=async()=>{
    const response=await fetchRef(BASE+'manifest.json',{credentials:'same-origin',signal:abort.signal});if(!response.ok)throw new Error('Ground metadata unavailable');
    const text=await response.text();if(text.length>65536)throw new Error('Ground metadata too large');spec=validateChikunGroundObstacleKit(JSON.parse(text));if(disposed)return false;
    const sheet=spec.tiers[tier],pending=new ImageClass();image=pending;pending.src=BASE+sheet.file;await pending.decode();
    if(disposed)return false;if(pending.naturalWidth!==sheet.width||pending.naturalHeight!==sheet.height)throw new Error('Ground dimensions differ');return true;
  };
  onStatus('loading');
  const ready=Promise.race([work(),new Promise(resolve=>cancel=resolve),new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('Ground download timed out')),timeoutMs))])
    .then(ok=>{if(disposed||ok!==true)return false;usable=true;onStatus('ready');return true;})
    .catch(()=>{if(!disposed){disposed=true;abort.abort();release();onStatus('fallback');}return false;})
    .finally(()=>{clearTimeout(timer);cancel=null;});
  return Object.freeze({ready,tier,
    draw(ctx,o){
      if(!usable||disposed||o?.family!=='ground')return false;
      const index=CHIKUN_NATIVE_GROUND_NAMES.indexOf(o.kind);if(index<0)return false;
      const s=spec.tiers[tier];ctx.drawImage(image,(index%2)*s.frameWidth,Math.floor(index/2)*s.frameHeight,s.frameWidth,s.frameHeight,o.x,690-o.height,o.width,o.height);return true;
    },
    dispose(){if(disposed)return;disposed=true;abort.abort();release();cancel?.(false);},
  });
}
