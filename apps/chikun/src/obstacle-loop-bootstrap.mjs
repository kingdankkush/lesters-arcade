// This small eager owner downloads the view/atlas only when the exact switch is on.
export function startChikunObstaclePresentation({enabled=false,tier='low',loadModule=()=>import('./obstacle-loop-view.mjs'),fetchRef=globalThis.fetch,onStatus=()=>{},setTimeoutRef=globalThis.setTimeout,clearTimeoutRef=globalThis.clearTimeout}={}) {
 let active=null,usable=false,sealed=false,cancel;
 const abort=new AbortController();
 const release=()=>{const owned=active;active=null;usable=false;try{owned?.dispose();}catch{/* Optional art cleanup preserves static fallback. */}};
 if(!enabled)return Object.freeze({ready:Promise.resolve(false),draw:()=>false,dispose:()=>{sealed=true;}});
 onStatus('loading');
 const work=async()=>{
  const module=await loadModule();if(sealed)return false;
  const response=await fetchRef('/assets/generated/chikun-obstacle-loop-v1/manifest.json',{credentials:'same-origin',signal:abort.signal});if(sealed)return false;
  if(!response.ok)throw new Error('Obstacle metadata download failed');
  const text=await response.text();if(sealed)return false;
  if(text.length>65536)throw new Error('Obstacle metadata exceeds bounded size');
  const metadata=JSON.parse(text);
  active=module.createChikunObstacleLoopView({metadata,tier});
  if(typeof active?.dispose!=='function'||typeof active?.draw!=='function')throw new TypeError('Invalid optional obstacle view');
  const ready=await active.ready;if(sealed)return false;
  if(ready!==true)throw new Error('Obstacle texture not ready');
  return true;
 };
 let timer;
 const ready=Promise.race([work(),new Promise(resolve=>{cancel=resolve;}),new Promise((_,reject)=>{timer=setTimeoutRef(()=>reject(new Error('Obstacle startup timeout')),12000);})])
  .then(value=>{if(sealed)return false;if(value!==true)throw new Error('Obstacle startup cancelled');usable=true;onStatus('ready');return true;})
  .catch(()=>{if(!sealed){sealed=true;abort.abort();release();onStatus('fallback');}return false;})
  .finally(()=>{clearTimeoutRef(timer);cancel=null;});
 return Object.freeze({ready,
  draw(...args){if(!usable||sealed)return false;try{return active.draw(...args)===true;}catch{sealed=true;abort.abort();release();onStatus('fallback');return false;}},
  dispose(){if(sealed)return;sealed=true;abort.abort();release();cancel?.(false);},
 });
}
