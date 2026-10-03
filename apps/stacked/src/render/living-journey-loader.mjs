import {stackedJourneyEnabled} from '../../../portal/src/stacked-presentation-switch.mjs';
// Optional visual download is awaited with boot; closure cannot create resources.
export async function loadLivingJourneyFactory(search,{load=()=>import('./luminous-journey-view.mjs'),isDisposed=()=>false}={}) {
  if(isDisposed())return{factory:null,status:'disposed'};
  if(!stackedJourneyEnabled(search))return{factory:null,status:'off'};
  try {
    const module=await load();
    if(isDisposed())return{factory:null,status:'disposed'};
    if(typeof module?.createLivingJourneyView!=='function')throw new TypeError('invalid presentation module');
    return{factory:module.createLivingJourneyView,status:'ready'};
  } catch {
    return{factory:null,status:isDisposed()?'disposed':'fallback'};
  }
}

export function createPresentationAtmosphere(factory,args,{fallback,onFallback}={}) {
  try{return factory(args);}catch(error){
    if(factory===fallback)throw error;
    onFallback?.(error);return fallback(args);
  }
}
