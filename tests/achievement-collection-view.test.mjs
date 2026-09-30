import assert from 'node:assert/strict';
import test from 'node:test';
import {catalogFor} from '../apps/portal/src/achievements/index.mjs';
const load=()=>import('../apps/portal/src/achievements/collection-view.mjs');
const one=catalogFor('chikun')[0];
const owned=Object.freeze([{id:one.id,gameId:'chikun',unlockedAt:'2026-09-29T12:00:00.000Z'}]);
function node(tag,props={}){
 return{tag,children:[],listeners:{},attributes:{},dataset:{...props.dataset},style:{setProperty(key,value){this[key]=value;}},isConnected:true,...props,
  append(...children){this.children.push(...children);},replaceChildren(...children){this.children=[...children];},
  setAttribute(key,value){this.attributes[key]=String(value);},addEventListener(name,callback){this.listeners[name]=callback;},
  remove(){this.isConnected=false;}};
}
const all=root=>[root,...(root.children??[]).flatMap(all)];
const text=root=>all(root).map(item=>item.textContent??'').join(' ');
const byClass=(root,name)=>all(root).filter(item=>String(item.className??'').split(/\s+/).includes(name));
const deps={el:node,appendText:(parent,tag,value,className='')=>{const item=node(tag,{textContent:value,className});parent.append(item);return item;},renderAchievementIcon:props=>node('img',{src:props.iconSrc,alt:props.label}),documentRef:null};
const body=gameId=>({ok:true,gameId,cohort:'verified-ranked-all-time',minimumPlayers:20,rankedPlayers:19,achievements:catalogFor(gameId).filter(item=>item.available).map(item=>({id:item.id,unlockedPlayers:item.id===one.id?1:0}))});
const answer=data=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(data)});

test('collection renders available locked and verified owned badges without claiming tokens or progress',async()=>{
 const {createAchievementCollectionView}=await load();
 const view=createAchievementCollectionView({...deps,fetchImpl:null});
 const card=view.render({unlocks:owned});
 assert.equal(byClass(card,'collection-badge').length,124);assert.equal(byClass(card,'collection-badge-owned').length,1);
 assert.equal(byClass(card,'collection-game-completion').length,3);assert.match(text(card),/1 \/ 124/);
 assert.match(text(card),/13 trophy achievements/);assert.doesNotMatch(text(card),/NFT minted|on-chain token|100% progress/);
 assert.equal(all(card).filter(item=>item.tag==='progress').length,3,'only measured collection completion, no guessed condition progress');
 view.dispose();
});

test('native filter and search events update only results while retaining the control nodes',async()=>{
 const {createAchievementCollectionView}=await load();
 const view=createAchievementCollectionView({...deps,fetchImpl:null}),card=view.render({unlocks:owned});
 const control=name=>all(card).find(item=>item.dataset?.collectionControl===name);
 const game=control('game'),filter=control('filter'),search=control('search');
 game.value='chikun';game.listeners.change();filter.value='locked';filter.listeners.change();
 assert.equal(byClass(card,'collection-badge').length,39);
 search.value='FIRST FLIGHT';search.listeners.input();assert.equal(byClass(card,'collection-badge').length,0);assert.match(text(card),/No matching achievements/);
 filter.value='all';filter.listeners.change();assert.equal(byClass(card,'collection-badge').length,1);
 assert.equal(control('search'),search);assert.equal(control('game'),game);assert.match(text(card),/1 \/ 124/);
 view.dispose();
});

test('population requests are cabinet-bound, coalesced, cached and anonymous',async()=>{
 const {createAchievementCollectionView}=await load();let now=1000;const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});return answer(body(new URL(url,'http://localhost').searchParams.get('game')));};
 const view=createAchievementCollectionView({...deps,fetchImpl,now:()=>now});
 const card=view.render({unlocks:owned});view.render({unlocks:owned});await view.whenStatsReady();
 assert.deepEqual(calls.map(call=>call.url),['/api/achievements/stats?game=lester-blaster','/api/achievements/stats?game=chikun','/api/achievements/stats?game=stacked']);
 for(const call of calls){assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.deepEqual(call.options.headers,{Accept:'application/json'});assert.ok(call.options.signal);}
 assert.match(text(card),/Early/);assert.doesNotMatch(text(card),/rarest.*First Flight/i);
 view.render({unlocks:owned});await view.whenStatsReady();assert.equal(calls.length,3);
 now+=300001;view.render({unlocks:owned});await view.whenStatsReady();assert.equal(calls.length,6);
 view.dispose();
});

test('disposal aborts pending reads and prevents late response from painting or restarting work',async()=>{
 const {createAchievementCollectionView}=await load();const pending=[],calls=[];
 const fetchImpl=(url,options)=>{calls.push(options);return new Promise(resolve=>pending.push(()=>resolve(answer(body(new URL(url,'http://localhost').searchParams.get('game'))))));};
 const view=createAchievementCollectionView({...deps,fetchImpl});const card=view.render({unlocks:owned}),before=text(card);
 const ready=view.whenStatsReady();view.dispose();assert.ok(calls.every(options=>options.signal.aborted));
 pending.forEach(resolve=>resolve());await ready;assert.equal(text(card),before);assert.throws(()=>view.render({unlocks:owned}),/disposed/);assert.equal(calls.length,3);
});

test('malformed successful responses show unavailable rarity without losing earned badges',async()=>{
 const {createAchievementCollectionView}=await load();
 const view=createAchievementCollectionView({...deps,fetchImpl:async()=>answer({ok:true,cohort:'device-local',gameId:'chikun',rankedPlayers:999})});
 const card=view.render({unlocks:owned});await view.whenStatsReady();
 assert.equal(byClass(card,'collection-badge-owned').length,1);assert.match(text(card),/Some population rarity is unavailable/);assert.doesNotMatch(text(card),/Population snapshot/);
 view.dispose();
});

test('stalled population reads time out, abort and do not spin into immediate retries',async()=>{
 const {createAchievementCollectionView}=await load();const calls=[],timers=[],cleared=[];
 const view=createAchievementCollectionView({...deps,fetchImpl:(_url,options)=>{calls.push(options);return new Promise(()=>{});},
  setTimeoutImpl:(callback,ms)=>{timers.push({callback,ms});return timers.length;},clearTimeoutImpl:id=>cleared.push(id)});
 const card=view.render({unlocks:owned}),ready=view.whenStatsReady();assert.equal(timers.length,3);assert.ok(timers.every(timer=>timer.ms===5000));
 timers.forEach(timer=>timer.callback());await ready;assert.ok(calls.every(call=>call.signal.aborted));assert.equal(cleared.length,3);assert.match(text(card),/Some population rarity is unavailable/);
 view.render({unlocks:owned});await view.whenStatsReady();assert.equal(calls.length,3);view.dispose();
});


test('population repaint preserves open requirements and the focused badge identity',async()=>{
 const {createAchievementCollectionView}=await load(),pending=[];
 const documentRef={activeElement:null};
 const el=(tag,props={})=>{
  const result=node(tag,props);result.tagName=tag.toUpperCase();
  result.contains=element=>all(result).includes(element);
  result.querySelectorAll=selector=>all(result).slice(1).filter(element=>{
   const match=selector.match(/^([a-z]+)/);if(match&&element.tag!==match[1])return false;
   for(const [,name,value]of selector.matchAll(/\[data-([\w-]+)="([^"]*)"\]/g)){
    const key=name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());if(element.dataset?.[key]!==value)return false;
   }return true;
  });
  result.focus=options=>{documentRef.activeElement=result;result.focusOptions=options;};return result;
 };
 const view=createAchievementCollectionView({...deps,el,documentRef,fetchImpl:(url)=>new Promise(resolve=>pending.push(()=>resolve(answer(body(new URL(url,'http://localhost').searchParams.get('game'))))))});
 const card=view.render({unlocks:owned});
 const selected=()=>byClass(card,'collection-badge').find(item=>item.dataset.achievement===one.id&&item.dataset.game==='chikun');
 const disclosure=all(selected()).find(item=>item.tag==='details');disclosure.open=true;
 const toggle=all(selected()).find(item=>item.tag==='summary');toggle.focus();
 pending.forEach(resolve=>resolve());await view.whenStatsReady();
 const current=all(selected()).find(item=>item.tag==='summary');
 assert.equal(all(selected()).find(item=>item.tag==='details').open,true,'the opened requirement remains open');
 assert.equal(documentRef.activeElement,current,'keyboard focus remains on the same achievement');
 assert.equal(current.focusOptions.preventScroll,true);view.dispose();
});

test('public collection heading does not claim another wallet as the viewer',async()=>{
 const {createAchievementCollectionView}=await load();
 const view=createAchievementCollectionView({...deps,fetchImpl:null});
 assert.doesNotMatch(text(view.render({unlocks:owned})),/YOUR COLLECTION/);view.dispose();
});


test('collection sets native option and search properties with the portal DOM factory contract',async()=>{
 const {createAchievementCollectionView}=await load();
 const el=(tag,{value,maxLength,placeholder,...props}={})=>node(tag,props);
 const view=createAchievementCollectionView({...deps,el,fetchImpl:null}),card=view.render({unlocks:owned});
 const filter=all(card).find(item=>item.dataset?.collectionControl==='filter');
 assert.deepEqual(filter.children.map(option=>option.value),['all','unlocked','locked','trophies']);
 const search=all(card).find(item=>item.dataset?.collectionControl==='search');
 assert.equal(search.maxLength,120);assert.equal(search.placeholder,'Find an achievement');view.dispose();
});
