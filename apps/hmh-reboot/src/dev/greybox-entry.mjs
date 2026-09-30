import { readGreyboxAccess } from './greybox-access.mjs';
import { createGreyboxPreviewLaunch } from './greybox-preview-launch.mjs';
const root=document.querySelector('[data-greybox-root]');
const access=readGreyboxAccess({url:location.href,topLevel:window.self===window.top});
const launch=createGreyboxPreviewLaunch({access,root,load:()=>import('./greybox-playtest.mjs')});
window.addEventListener('pagehide',()=>{launch.dispose();root.dataset.preview='disposed';},{once:true});
Object.defineProperty(window,'__HMH_GREYBOX__',{value:Object.freeze({snapshot:()=>Object.freeze({access,...launch.snapshot()})}),writable:false});
if(!access.allowed){root.dataset.preview='denied';root.textContent='This greybox is a local Free navigation preview. Open its explicit local Free link in its own tab.';}
else{
  root.dataset.preview='loading';root.textContent='Opening the ten-area greybox…';
  launch.ready.then(()=>{const snapshot=launch.snapshot();if(snapshot.phase==='failed'){root.dataset.preview='failed';root.textContent=`Greybox could not open: ${snapshot.failure}`;console.error('Local greybox preview failed',snapshot.failure);}});
}
