import { readWorldV2LocalAccess } from './world-v2-local-access.mjs';
import { createGreyboxPreviewLaunch } from './greybox-preview-launch.mjs';
const root=document.querySelector('[data-world-root]');
const access=readWorldV2LocalAccess({url:location.href,topLevel:window.self===window.top});
let abandoned=false,reloaded=false;
const launch=createGreyboxPreviewLaunch({access,root,load:()=>import('./world-v2-local-scene.mjs')});
window.addEventListener('pagehide',()=>{abandoned=true;launch.dispose();root.dataset.worldState='disposed';});
window.addEventListener('pageshow',event=>{if(abandoned&&event.persisted&&!reloaded){reloaded=true;window.location.reload();}});
Object.defineProperty(window,'__HMH_WORLD_LOCAL__',{value:Object.freeze({snapshot:()=>Object.freeze({access,...launch.snapshot()})}),writable:false});
if(!access.allowed){root.dataset.worldState='denied';root.textContent='This is a local Free world test. Open its explicit loopback link in its own tab. No score or rewards.';}
else{
  root.dataset.worldState='loading';root.textContent='Preparing the local world test…';
  launch.ready.then(()=>{const state=launch.snapshot();if(!abandoned&&state.phase==='failed'){root.dataset.worldState='failed';root.textContent=`Local world could not open: ${state.failure}. Reload to retry.`;console.error('Local world failed',state.failure);}});
}
