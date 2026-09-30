// Cosmetic obstacle sheets only. No canonical runtime, evidence or random stream.
const TIERS=Object.freeze(['low','medium','high']);
const SIZES=Object.freeze({low:128,medium:192,high:256});
const ACTORS=new Set(['eagle','hawk','pelican','shiba']);
export function validateChikunObstacleLoop(input){
  if(input?.schema!=='chikun-obstacle-loop-v1'||!ACTORS.has(input.actor)||input.frames!==8||input.columns!==4||input.fps!==12)throw new TypeError('unsupported obstacle loop');
  const tiers={};
  for(const tier of TIERS){const source=input.tiers?.[tier],width=SIZES[tier];
    if(source?.file!==`${input.actor}-${tier}.webp`||source.frameWidth!==width||source.frameHeight!==width/2||source.width!==width*4||source.height!==width)throw new TypeError('invalid obstacle texture sheet');
    tiers[tier]=Object.freeze({file:source.file,frameWidth:width,frameHeight:width/2,width:width*4,height:width});
  }
  return Object.freeze({schema:input.schema,actor:input.actor,frames:8,columns:4,fps:12,tiers:Object.freeze(tiers)});
}
export function sampleChikunObstacleLoop(metadata,seconds,tier,{reducedMotion=false}={}){
  const sheet=metadata.tiers[tier];if(!sheet)throw new TypeError('unsupported texture tier');
  const time=Number.isFinite(seconds)?Math.max(0,seconds):0;
  const frame=reducedMotion?0:Math.floor((time%(metadata.frames/metadata.fps))*metadata.fps);
  return {frame,x:(frame%metadata.columns)*sheet.frameWidth,y:Math.floor(frame/metadata.columns)*sheet.frameHeight,width:sheet.frameWidth,height:sheet.frameHeight};
}
export function selectChikunObstacleTextureTier({quality='auto',density=1}={}){
  if(TIERS.includes(quality))return quality;
  const value=Number.isFinite(density)?density:1;return value>=3?'high':value>=2?'medium':'low';
}
export function createChikunObstacleLoopLoader({metadata,tier,ImageClass=globalThis.Image}={}){
  const spec=validateChikunObstacleLoop(metadata),sheet=spec.tiers[tier];if(!sheet)throw new TypeError('unsupported texture tier');
  let image=null,pending=null,ready=false,disposed=false,cancel=null;
  const release=()=>{const owned=image;image=null;ready=false;if(owned)try{owned.src='';}catch{/* Native cleanup cannot mask the optional fallback. */}};
  return Object.freeze({
    metadata:spec,tier,get ready(){return ready;},get image(){return ready?image:null;},
    load(){
      if(disposed)return Promise.resolve(false);
      if(pending)return pending;
      pending=(async()=>{
        let timer;
        try{
          image=new ImageClass();image.src='/assets/generated/chikun-obstacle-loop-v1/'+sheet.file;
          await Promise.race([image.decode(),new Promise(resolve=>{cancel=resolve;}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Obstacle texture timeout')),12000);})]);
          if(disposed||image.naturalWidth!==sheet.width||image.naturalHeight!==sheet.height){release();return false;}
          ready=true;return true;
        }catch{release();return false;}
        finally{clearTimeout(timer);cancel=null;}
      })();return pending;
    },
    dispose(){if(disposed)return;disposed=true;cancel?.();release();},
  });
}
