// Course-two art (chikun-course-two-v1): projection only. main.mjs imports this
// module lazily, and only while course two is the active Free preview. Nothing
// here reads or feeds the simulation; every sprite is drawn at the exact
// collision geometry the course-two runtime snapshot exposes.
const BASE='/assets/generated/chikun-course-two-v1/';
const EAGLE='/assets/generated/chikun-obstacle-loop-v1/';
const SCHEMA='chikun-course-two-art-v1';
const PICKUP_INDEX=Object.freeze({shield:0,magnet:1,feather:2});
const HAWK_TINT='rgba(74,18,22,0.62)';
// Desktop at 1x and every phone use the half-res (1x logical) sheets; only a
// dense desktop (DPR above 1.3) decodes the 2x sheets.
export function courseTwoArtTier({density=1,phone=false}={}){return phone||!(Number.isFinite(density)&&density>1.3)?'half':'full';}
export function courseTwoSheetFile(asset,tier){return tier==='full'?asset.file:asset.half.file;}
// 12 fps loops on the 60 Hz simulation tick; reduced motion holds frame zero.
export function courseTwoLoopFrame(tick,reduced=false,frames=8){return reduced?0:Math.floor(Math.max(0,tick)/5)%frames;}
export function validateCourseTwoArt(input){
 if(input?.schema!==SCHEMA||!Array.isArray(input.assets))throw new TypeError('unsupported course-two art');
 const assets={};
 for(const a of input.assets){
  if(!['tractor','trellis','pickups'].includes(a?.name)||typeof a.file!=='string'||typeof a.half?.file!=='string'||!(a.width>0&&a.height>0&&a.frames>0&&a.columns>0))throw new TypeError('invalid course-two sheet');
  assets[a.name]=Object.freeze({name:a.name,file:a.file,width:a.width,height:a.height,frames:a.frames,columns:a.columns,half:Object.freeze({file:a.half.file,width:a.half.width,height:a.half.height})});
 }
 for(const name of ['tractor','trellis','pickups'])if(!assets[name])throw new TypeError('missing course-two sheet '+name);
 return Object.freeze({schema:SCHEMA,assets:Object.freeze(assets)});
}
function loadImage(url,ImageClass,timeoutMs){
 return new Promise((resolve,reject)=>{
  if(typeof ImageClass!=='function'){reject(new Error('no Image'));return;}
  const img=new ImageClass();let timer=setTimeout(()=>{try{img.src='';}catch{}reject(new Error('timeout'));},timeoutMs);
  img.onerror=()=>{clearTimeout(timer);reject(new Error('error'));};
  img.src=url;
  const done=()=>{clearTimeout(timer);resolve(img);};
  if(typeof img.decode==='function')img.decode().then(done,()=>{img.onload=done;if(img.complete&&img.naturalWidth)done();});else img.onload=done;
 });
}
function defaultMakeCanvas(w,h){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function createCourseTwoArt({tier='half',eagleTier='low',ImageClass=globalThis.Image,fetchRef=globalThis.fetch,makeCanvas=defaultMakeCanvas,timeoutMs=12000}={}){
 const sheets={};let spec=null,hawk=null,ready=false,disposed=false,pending=null;
 const sheetScale=()=>tier==='full'?2:1;
 const release=()=>{for(const k of Object.keys(sheets)){try{sheets[k].src='';}catch{}delete sheets[k];}if(hawk){hawk.width=0;hawk.height=0;hawk=null;}ready=false;};
 async function work(){
  const response=await fetchRef(BASE+'manifest.json',{credentials:'same-origin'});
  if(!response?.ok)throw new Error('course-two art manifest failed');
  const text=await response.text();if(text.length>65536)throw new Error('course-two art manifest too large');
  spec=validateCourseTwoArt(JSON.parse(text));if(disposed)return false;
  const loaded=await Promise.all(Object.values(spec.assets).map(a=>loadImage(BASE+courseTwoSheetFile(a,tier),ImageClass,timeoutMs)));
  if(disposed)return false;
  Object.keys(spec.assets).forEach((name,i)=>{sheets[name]=loaded[i];});
  // The hawk reuses the refined eagle loop sheet, pre-tinted once into a canvas.
  try{
   const eagle=await loadImage(EAGLE+'eagle-'+eagleTier+'.webp',ImageClass,timeoutMs);
   if(disposed){try{eagle.src='';}catch{}return false;}
   const canvas=makeCanvas(eagle.naturalWidth||eagle.width,eagle.naturalHeight||eagle.height);
   if(canvas){const cx=canvas.getContext('2d');cx.drawImage(eagle,0,0);cx.globalCompositeOperation='source-atop';cx.fillStyle=HAWK_TINT;cx.fillRect(0,0,canvas.width,canvas.height);hawk=canvas;}
   try{eagle.src='';}catch{}
  }catch{hawk=null;}
  ready=true;return true;
 }
 return Object.freeze({
  get ready(){return ready;},get tier(){return tier;},get hawkReady(){return Boolean(hawk);},
  load(){if(disposed)return Promise.resolve(false);if(!pending)pending=work().catch(()=>{release();return false;});return pending;},
  // Raised vine trellis: the sheet covers the exact 300x150 collision rect.
  drawTrellis(ctx,o){if(!ready||o?.family!=='fork-route')return false;const img=sheets.trellis;ctx.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,o.x,390,o.width,150);return true;},
  // Pickup badge centred on the runtime pickup (radius 23 -> 48 logical).
  drawPickup(ctx,p,bob=0){if(!ready)return false;const idx=PICKUP_INDEX[p?.kind];if(idx===undefined)return false;const s=sheetScale(),cell=48*s;ctx.drawImage(sheets.pickups,idx*cell,0,cell,cell,p.x-24,p.y+bob-24,48,48);return true;},
  // HUD chip for a power state.
  drawChip(ctx,kind,x,y,size=22){if(!ready)return false;const idx=PICKUP_INDEX[kind];if(idx===undefined)return false;const s=sheetScale(),cell=48*s;ctx.drawImage(sheets.pickups,idx*cell,0,cell,cell,x,y,size,size);return true;},
  // Chase actors at the runtime body box (138x94); solid rects sit inside it.
  drawChase(ctx,c,tick=0,reduced=false){
   if(!ready||!c||c.telegraph)return false;
   if(c.kind==='tractor'){const a=spec.assets.tractor,s=sheetScale(),fw=138*s,fh=94*s,f=courseTwoLoopFrame(tick,reduced,a.frames);ctx.drawImage(sheets.tractor,(f%a.columns)*fw,Math.floor(f/a.columns)*fh,fw,fh,c.x,c.y,c.width,c.height);return true;}
   if(c.kind==='hawk'&&hawk){const fw=hawk.width/4,fh=hawk.height/2,f=courseTwoLoopFrame(tick,reduced,8);ctx.drawImage(hawk,(f%4)*fw,Math.floor(f/4)*fh,fw,fh,c.x,c.y+4,c.width,c.width/2);return true;}
   return false;
  },
  dispose(){if(disposed)return;disposed=true;release();},
 });
}
