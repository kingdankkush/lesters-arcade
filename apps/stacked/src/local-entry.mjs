import { localVersusAllowed } from './local-access.mjs';

export function startLocalStackedEntry({ windowRef=window, documentRef=document,
  load=()=>import('./local-app.mjs') }={}) {
  const notice=documentRef.querySelector('#noticeCopy');
  if(!localVersusAllowed(windowRef.location.search,windowRef.top===windowRef)){
    notice.textContent='Open Two Players from the arcade’s Free Mode menu.';
    documentRef.body.dataset.localState='denied';
    return;
  }
  let disposed=false,reloaded=false,application=null;
  const release=handle=>{try{handle?.destroy?.();}catch{ /* A closed page must still release its lifecycle listeners. */ }};
  const dispose=()=>{if(disposed)return;disposed=true;windowRef.removeEventListener('pagehide',dispose);release(application);application=null;};
  const restore=event=>{
    if(!event.persisted||!disposed||reloaded)return;
    reloaded=true;windowRef.removeEventListener('pageshow',restore);windowRef.location.reload();
  };
  // Start ownership before either async boundary. The mounted app also owns
  // its renderer's pagehide cleanup; both destroy operations are idempotent.
  windowRef.addEventListener('pagehide',dispose);
  windowRef.addEventListener('pageshow',restore);
  const ready=Promise.resolve().then(()=>disposed?null:load()).then(module=>{
    if(disposed||!module)return;
    return module.mountLocalStacked();
  }).then(handle=>{
    if(disposed)release(handle);else application=handle;
  }).catch(()=>{
    if(disposed)return;
    notice.textContent='The local game could not load. Reload this page to try again.';
    documentRef.querySelector('#notice').hidden=false;
    documentRef.body.dataset.localState='error';
  });
  return Object.freeze({destroy:dispose,ready});
}

if(typeof window!=='undefined'&&typeof document!=='undefined')startLocalStackedEntry();
