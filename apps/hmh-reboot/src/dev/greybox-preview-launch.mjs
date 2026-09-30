// One local preview lifetime. Promise completion cannot resurrect a closed tab.
export function createGreyboxPreviewLaunch({access,root,load}={}){
  if(typeof load!=='function')throw new TypeError('preview module loader required');
  let phase=access?.allowed===true?'loading':'denied',disposed=false,mounted=null,cleaned=false,failure=null,cleanupFailure=null;
  const cleanup=()=>{if(!mounted||cleaned)return;cleaned=true;try{mounted.dispose();}catch(error){cleanupFailure=String(error.message);}};
  const ready=(async()=>{
    if(phase==='denied')return;
    try{const module=await load();if(disposed)return;mounted=module.mountGreyboxPlaytest(root);await mounted.ready;if(!disposed)phase='ready';}
    catch(error){failure=String(error.message);phase=disposed?'disposed':'failed';cleanup();}
  })();
  return Object.freeze({ready,dispose(){if(disposed)return;disposed=true;phase='disposed';cleanup();},snapshot:()=>Object.freeze({phase,disposed,failure,cleanupFailure,playtest:mounted?.snapshot()??null})});
}
