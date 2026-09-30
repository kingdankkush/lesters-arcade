const KEY='lestersarcade:stacked:tutorial-v1';
export function tutorialEnabled(search,mode){const values=new URLSearchParams(search).getAll('stackedTutorial');return mode==='free'&&(values.length===0||(values.length===1&&values[0]==='tutorial-v1'));}
export function createTutorialEntry({search,mode,button,overlay,canOpen=()=>true,onActive=()=>{},onStatus=()=>{},storage,load=()=>import('./tutorial-view.mjs'),timeoutMs=5000}){
 if(!tutorialEnabled(search,mode))return null;
 let disposed=false,active=false,view=null,timer=null,cancelLoad;
 button.hidden=false;
 const seen=()=>{try{return ['completed','skipped'].includes(storage?.getItem(KEY));}catch{return false;}};
 async function open(){
  if(disposed||active||!canOpen())return;active=true;button.disabled=true;onActive(true);onStatus('Opening quick start…');
  try{
   const loaded=await Promise.race([load(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),timeoutMs);}),new Promise(resolve=>cancelLoad=()=>resolve(null))]);
   if(disposed)return;
   if(typeof loaded?.mountTutorial!=='function')throw new Error('Tutorial unavailable');
   view=loaded.mountTutorial({overlay,onExit(completed){view=null;active=false;button.disabled=false;try{storage?.setItem(KEY,completed?'completed':'skipped');}catch{}onActive(false);onStatus(completed?'Quick start complete. Start whenever you’re ready.':'Tutorial closed. You can return with Learn to play.');button.focus({preventScroll:true});}});
  }catch{if(!disposed){active=false;button.disabled=false;onActive(false);onStatus('Quick start is unavailable. You can still start the game.');}}
  finally{clearTimeout(timer);timer=null;cancelLoad=null;}
 }
 button.addEventListener('click',open);
 if(!seen())queueMicrotask(open);
 return{get active(){return active;},open,destroy(){if(disposed)return;disposed=true;cancelLoad?.();clearTimeout(timer);button.removeEventListener('click',open);view?.destroy();view=null;active=false;}};
}
