import { PORTAL_COPY, portalPageMeta, portalSchema, gameFor } from './portal-content.mjs';

// Text-only DOM construction keeps even an arbitrary URL slug out of an HTML
// parser. Game facts resolve through the allowlisted public catalog. The copy
// defaults to the committed flags (contract A33); tests pass other flag states.
export function gameDetailsNode(documentRef,slug,copy=PORTAL_COPY) {
  const game=gameFor(slug);
  if(!game)return null;
  const node=(tag,text,className='')=>{const element=documentRef.createElement(tag);element.textContent=text;element.className=className;return element;};
  const section=node('section','','game-detail-story');section.setAttribute('aria-label','About '+game.title);
  const intro=node('div','');
  intro.append(node('p',game.genre,'portal-kicker'),node('h2',game.tag),node('p',game.description));
  const list=node('dl','');
  for(const [label,text] of [['Your goal',game.goal],['How to play',game.controls],['Free or Ranked?',copy.rankedDetail[game.id]]]) {
    const row=node('div','');row.append(node('dt',label),node('dd',text));list.append(row);
  }
  const link=node('a','Explore all games →','portal-text-link');link.setAttribute('href','/games');
  section.append(intro,list,link);return section;
}

export function syncDiscoveryMeta(documentRef, pathname, copy=PORTAL_COPY) {
  const meta=portalPageMeta(pathname,copy);
  documentRef.title=meta.title;
  for(const [selector,value] of [
    ['meta[name="description"]',meta.description], ['meta[name="robots"]',meta.robots],
    ['meta[property="og:title"]',meta.title], ['meta[property="og:description"]',meta.description],
    ['meta[property="og:url"]',meta.canonical], ['meta[property="og:image"]',meta.image],
    ['meta[name="twitter:title"]',meta.title], ['meta[name="twitter:description"]',meta.description],
    ['meta[name="twitter:url"]',meta.canonical], ['meta[name="twitter:image"]',meta.image],
  ]) documentRef.querySelector(selector)?.setAttribute('content',value);
  documentRef.querySelector('link[rel="canonical"]')?.setAttribute('href',meta.canonical);
  const schema=documentRef.querySelector('#portalStructuredData');
  if(schema) schema.textContent=meta.robots.startsWith('noindex') ? '{}' : portalSchema(new URL(meta.canonical).pathname,copy);
}

export function installPortalDiscovery({connectWallet, documentRef=globalThis.document, windowRef=globalThis.window, copy=PORTAL_COPY}={}) {
  const app=documentRef.querySelector('#officialApp');
  if(!app)return;
  const details=documentRef.querySelector('#portalGameDetails');
  const update=()=>{
    syncDiscoveryMeta(documentRef,windowRef.location.pathname,copy);
    const slug=windowRef.location.pathname.split('/')[2] ?? '';
    if(details && details.dataset.game!==slug) {
      const content=gameDetailsNode(documentRef,slug,copy);
      details.replaceChildren(...(content ? [content] : [])); details.dataset.game=slug;
    }
  };
  new MutationObserver(update).observe(app,{attributes:true,attributeFilter:['data-step']});
  windowRef.addEventListener('popstate',update);
  update();
  documentRef.querySelectorAll('[data-portal-connect]').forEach(button=>button.addEventListener('click',connectWallet));
  documentRef.querySelector('[data-open-jukebox]')?.addEventListener('click',()=>{
    const player=documentRef.querySelector('#arcadeMusicPlayer');
    if(player?.dataset.expanded!=='true')documentRef.querySelector('#arcadeMusicExpandButton')?.click();
    player?.scrollIntoView({block:'center',behavior:'auto'});
    documentRef.querySelector('#arcadeMusicPlayButton')?.focus({preventScroll:true});
  });

  const reduced=windowRef.matchMedia('(prefers-reduced-motion: reduce)');
  const videos=[...documentRef.querySelectorAll('[data-portal-video]')];
  const visible=new Set(), manuallyPaused=new Set(), explicitlyPlaying=new Set();
  const buttons=new Map(videos.map(video=>[video,documentRef.querySelector('[data-video-toggle="'+video.id+'"]')]));
  const syncButton=video=>{
    const button=buttons.get(video);
    if(button) { button.textContent=video.paused?'Play film':'Pause film'; button.setAttribute('aria-pressed',String(!video.paused)); }
  };
  const play=async video=>{
    if(!video.getAttribute('src'))video.src=video.dataset.src;
    video.muted=true;
    try{await video.play();}catch{syncButton(video);}
  };
  const reconcile=()=>{
    for(const video of videos){
      const canPlay=visible.has(video) && !documentRef.hidden && !documentRef.querySelector('#officialWalletSplash')?.hidden;
      const wantsPlay=explicitlyPlaying.has(video) || (!manuallyPaused.has(video) && !reduced.matches && !windowRef.navigator.connection?.saveData);
      if(canPlay && wantsPlay)void play(video);else video.pause();
    }
  };
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting && entry.intersectionRatio>.15)visible.add(entry.target);else visible.delete(entry.target);}reconcile();},{threshold:[0,.15]});
  for(const video of videos){
    video.addEventListener('play',()=>syncButton(video));
    video.addEventListener('pause',()=>syncButton(video));
    video.addEventListener('error',()=>{video.pause();syncButton(video);});
    buttons.get(video)?.addEventListener('click',()=>{
      if(video.paused){explicitlyPlaying.add(video);manuallyPaused.delete(video);void play(video);}
      else{explicitlyPlaying.delete(video);manuallyPaused.add(video);video.pause();}
    });
    observer.observe(video);
  }
  documentRef.addEventListener('visibilitychange',reconcile);
  reduced.addEventListener('change',()=>{explicitlyPlaying.clear();reconcile();});
  new MutationObserver(reconcile).observe(app,{attributes:true,attributeFilter:['data-step']});
}
