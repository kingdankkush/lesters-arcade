import {buildAchievementCollection,COLLECTION_GAMES} from './collection-model.mjs';
import {renderKeepingFocus} from '../focus-keeper.mjs';

const CACHE_MS=300_000,FAILURE_CACHE_MS=60_000,READ_TIMEOUT_MS=5_000;
const percent=rate=>rate===0?'0%':rate<.1?'Less than 0.1%':`${rate.toFixed(1).replace(/\.0$/,'')}%`;

// One static collection grid per Profile controller. No WebGL context, wallet
// prompt, ownership write or earning-rule evaluation is created by this view.
export function createAchievementCollectionView({el,appendText,renderAchievementIcon,
 documentRef=globalThis.document,fetchImpl=globalThis.fetch,now=()=>Date.now(),
 setTimeoutImpl=globalThis.setTimeout,clearTimeoutImpl=globalThis.clearTimeout,
 loadDetail=()=>import('./detail-view.mjs')}={}) {
 let disposed=false,card=null,inputs={unlocks:[]},inFlight=null;
 let detail=null,detailEpoch=0;const detailButtons=new Map();
 const statsByGame={},expires=new Map(),requests=new Set(),disclosures=new Map();
 const selection={gameId:'all',filter:'all',sort:'catalog',query:''};
 let summary,resultCount,results,populationNote;

 function ensureStyle(){
  if(!documentRef?.head||!documentRef.createElement||documentRef.getElementById?.('achievement-collection-css'))return;
  const link=documentRef.createElement('link');link.id='achievement-collection-css';link.rel='stylesheet';link.href='/src/styles/achievement-collection.css?v=collection-detail-v2';documentRef.head.append(link);
 }
 function field(label,name,options){
  const wrapper=el('label',{className:'collection-control'});appendText(wrapper,'span',label);
  const control=options?el('select',{dataset:{collectionControl:name}}):el('input',{type:'search',maxLength:120,placeholder:'Find an achievement',dataset:{collectionControl:name}});
  if(options)for(const[value,title]of options){const option=el('option',{textContent:title});option.value=value;control.append(option);}
  else{control.maxLength=120;control.placeholder='Find an achievement';}
  const property={game:'gameId',filter:'filter',sort:'sort',search:'query'}[name];control.value=selection[property];
  control.addEventListener(options?'change':'input',()=>{selection[property]=control.value;paint();});
  wrapper.append(control);return wrapper;
 }
 function createCard(){
  ensureStyle();card=el('article',{className:'official-info-card achievement-collection-v1'});
  const head=el('div',{className:'collection-heading'});appendText(head,'span','COLLECTION','cabinet-status-label');appendText(head,'h2','Every run has a story.');
  appendText(head,'p','Achievements recorded from verified Ranked runs. Select a badge to read its requirement.','collection-intro');card.append(head);
  summary=el('div',{className:'collection-summary'});card.append(summary);
  const controls=el('div',{className:'collection-controls'});
  controls.append(field('Cabinet','game',[['all','All games'],...COLLECTION_GAMES.map(game=>[game.gameId,game.title])]),
   field('Show','filter',[['all','All achievements'],['unlocked','Unlocked'],['locked','To earn'],['trophies','Trophy achievements']]),
   field('Sort','sort',[['catalog','Collection order'],['recent','Recently earned'],['rarity','Population rarity'],['game','Game']]),field('Search','search'));
  card.append(controls);
  const bar=el('div',{className:'collection-results-heading'});resultCount=el('p',{className:'collection-result-count'});resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');
  populationNote=el('small',{className:'collection-population-note'});bar.append(resultCount,populationNote);card.append(bar);
  results=el('div',{className:'collection-badge-grid'});card.append(results);
 }
 function paint(){
  if(disposed||!card)return;
  const opened=new Set([...disclosures].filter(([,details])=>details.open).map(([key])=>key));
  return renderKeepingFocus(results,()=>paintContents(opened),{documentRef});
 }
 function paintContents(opened){
  disclosures.clear();detailButtons.clear();
  const model=buildAchievementCollection({...selection,unlocks:inputs.unlocks,statsByGame});
  const overview=el('div',{className:'collection-overview'});
  appendText(overview,'strong',`${model.unlocked} / ${model.total}`,'collection-total');appendText(overview,'span','achievements earned');
  appendText(overview,'small',`${model.trophies.unlocked} / ${model.trophies.total} trophy achievements`);
  const cabinets=el('div',{className:'collection-completion-grid'});
  for(const game of model.games){
   const pane=el('div',{className:'collection-game-completion',dataset:{game:game.gameId}});
   appendText(pane,'strong',game.shortTitle);appendText(pane,'span',`${game.unlocked} / ${game.total}`);
   const progress=el('progress');progress.setAttribute('value',game.unlocked);progress.setAttribute('max',game.total);progress.setAttribute('aria-label',`${game.title}: ${game.unlocked} of ${game.total} achievements earned`);pane.append(progress);appendText(pane,'small',game.unlocked===game.total?'Collection complete':`${game.total-game.unlocked} to earn`,'collection-game-remaining');cabinets.append(pane);
  }
  const rarity=el('div',{className:'collection-rarest'});
  if(model.rarest){appendText(rarity,'span','Rarest earned achievement');appendText(rarity,'strong',model.rarest.title);appendText(rarity,'small',`${model.rarest.gameTitle} · ${percent(model.rarest.rarity.percentage)} of its Ranked players`);}
  else{appendText(rarity,'span','Population rarity');appendText(rarity,'small','Rarity appears once a cabinet has at least 20 verified Ranked players. Early cabinets show counts.');}
  summary.replaceChildren(overview,cabinets,rarity);
  const badges=[];
  for(const row of model.rows){
   const badge=el('article',{className:`collection-badge tier-${row.tier}${row.unlocked?' collection-badge-owned':' collection-badge-locked'}`,dataset:{achievement:row.id,game:row.gameId}});
   const badgeHeading=el('div',{className:'collection-badge-heading'});
   appendText(badgeHeading,'span',row.tier,'collection-tier');appendText(badgeHeading,'span',row.unlocked?'Earned':'To earn','collection-ownership');badge.append(badgeHeading);
   const details=el('details'),toggle=el('summary',{dataset:{achievement:row.id,game:row.gameId}});
   const disclosureKey=`${row.gameId}:${row.id}`;details.open=opened.has(disclosureKey);disclosures.set(disclosureKey,details);toggle.setAttribute('aria-label',`${row.title}. ${row.unlocked?'Earned':'Locked'}. Show requirement`);
   toggle.append(renderAchievementIcon({iconSrc:row.image,icon:row.unlocked?'🏅':'🔒',label:row.title}));
   appendText(toggle,'span',row.title,'collection-badge-title');appendText(toggle,'small',row.gameTitle,'collection-badge-game');details.append(toggle);
   appendText(details,'p',row.description,'collection-requirement');
   const inspect=el('button',{className:'collection-detail-button',textContent:'Inspect badge',dataset:{achievement:row.id,game:row.gameId}});inspect.type='button';
   const detailStatus=el('small');detailStatus.setAttribute('role','status');detailButtons.set(disclosureKey,inspect);
   inspect.addEventListener('click',async()=>{
    const epoch=++detailEpoch;detailStatus.textContent='';
    try{const module=await loadDetail();if(disposed||epoch!==detailEpoch)return;
     detail??=module.createAchievementDetail({documentRef});
     detail.open(row,{returnFocus:()=>detailButtons.get(disclosureKey)?.focus?.({preventScroll:true})});
    }catch{if(!disposed&&epoch===detailEpoch)detailStatus.textContent='Preview unavailable. You can still read the requirement here.';}
   });details.append(inspect,detailStatus);badge.append(details);
   const record=el('div',{className:'collection-badge-record'});
   if(row.nft)appendText(record,'small','Trophy achievement','collection-trophy-label');
   if(row.rarity){const label=el('small',{className:`collection-rarity rarity-${row.rarity.rarity}`});label.textContent=row.rarity.percentage===null?`Early · ${row.rarity.unlockedPlayers} players`:`${row.rarity.label} · ${percent(row.rarity.percentage)}`;label.setAttribute('title',`${row.rarity.unlockedPlayers} of ${row.rarity.rankedPlayers} eligible Ranked players in this cabinet`);record.append(label);}
   else appendText(record,'small','Rarity unavailable','collection-rarity-unavailable');
   if(row.unlockedAt){const time=el('time',{textContent:row.unlockedAt.slice(0,10),className:'collection-unlock-date'});time.setAttribute('datetime',row.unlockedAt);record.append(time);}
   badge.append(record);if(row.unlocked)inputs.decorateOwnedBadge?.(badge,row);badges.push(badge);
  }
  if(!badges.length)badges.push(el('p',{className:'collection-empty',textContent:'No matching achievements. Try a different filter or search.'}));
  results.replaceChildren(...badges);resultCount.textContent=`${model.rows.length} matching achievements`;
  const available=COLLECTION_GAMES.filter(game=>Object.hasOwn(statsByGame,game.gameId)).length;
  populationNote.textContent=inFlight?'Population rarity loading…':available===COLLECTION_GAMES.length?'Population snapshot · cached for five minutes':'Some population rarity is unavailable. Earned achievements remain visible.';
 }
 async function readPopulation(gameId){
  const controller=new AbortController();let timer,rejectCancel;
  const cancelled=new Promise((_,reject)=>{rejectCancel=reject;});
  const request={controller,cancel:()=>{controller.abort();rejectCancel(new Error('collection read cancelled'));}};requests.add(request);
  timer=setTimeoutImpl(()=>request.cancel(),READ_TIMEOUT_MS);
  try{
   const fetch=Promise.resolve(fetchImpl(`/api/achievements/stats?game=${gameId}`,{method:'GET',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal})).then(async response=>{
    if(!response.ok)throw new Error('population unavailable');const text=await response.text();if(new TextEncoder().encode(text).length>65_536)throw new Error('population too large');return JSON.parse(text);
   });
   const data=await Promise.race([fetch,cancelled]);if(disposed)return;
   const population=buildAchievementCollection({gameId,statsByGame:{[gameId]:data}});
   if(!population.rows.length||population.rows.some(row=>row.rarity===null))throw new Error('invalid population snapshot');
   statsByGame[gameId]=data;expires.set(gameId,now()+CACHE_MS);
  }catch{if(!disposed){delete statsByGame[gameId];expires.set(gameId,now()+FAILURE_CACHE_MS);}}
  finally{clearTimeoutImpl(timer);requests.delete(request);}
 }
 function hydrate(){
  if(disposed||typeof fetchImpl!=='function'||inFlight)return inFlight??Promise.resolve();
  const due=COLLECTION_GAMES.filter(game=>(expires.get(game.gameId)??-Infinity)<=now());if(!due.length)return Promise.resolve();
  inFlight=Promise.all(due.map(game=>readPopulation(game.gameId))).finally(()=>{inFlight=null;paint();});return inFlight;
 }
 function render(options={}){
  if(disposed)throw new Error('achievement collection disposed');detailEpoch++;detail?.dispose();detail=null;inputs={unlocks:options.unlocks??[],decorateOwnedBadge:options.decorateOwnedBadge};if(!card)createCard();void hydrate();paint();return card;
 }
 function dispose(){if(disposed)return;disposed=true;detailEpoch++;detail?.dispose();detail=null;detailButtons.clear();for(const request of requests)request.cancel();}
 return Object.freeze({render,dispose,whenStatsReady:()=>inFlight??Promise.resolve()});
}
