// Display verified profile records and population counts. Never evaluate an
// earning rule, grant ownership, write preferences or infer missing progress.
import {ACHIEVEMENT_GAME_IDS,ACHIEVEMENT_PARENT_ID,catalogFor,parentCatalog} from './index.mjs';
import {achievementRarity,ACHIEVEMENT_RARITY_MIN_PLAYERS} from './rarity.mjs';
import {normalizeAchievementUnlockDate} from '../achievement-progress.mjs';

// The three cabinets, then the parent-owned section (achievements/arcade.mjs):
// its entries are earned by any cabinet's verified run and recorded under that
// cabinet, so an unlock row of a parent-owned id belongs here whatever its gameId.
export const COLLECTION_GAMES = Object.freeze([
 Object.freeze({gameId:'lester-blaster',title:'Hard Money Heroes',shortTitle:'HMH'}),
 Object.freeze({gameId:'chikun',title:"Chikun’s Escape",shortTitle:'Chikun'}),
 Object.freeze({gameId:'stacked',title:'STACKED',shortTitle:'STACKED'}),
 Object.freeze({gameId:ACHIEVEMENT_PARENT_ID,title:'Lester’s Arcade',shortTitle:'Arcade'}),
]);
const PARENT_IDS=new Set(parentCatalog().map(entry=>entry.id));
const SECTION_IDS=new Set([...ACHIEVEMENT_GAME_IDS,ACHIEVEMENT_PARENT_ID]);
const FILTERS=['all','unlocked','locked','trophies'];
const SORTS=['catalog','recent','rarity','game'];
const key=(gameId,id)=>`${gameId}:${id}`;

export function achievementCollectionPreview(search='') {
 const values=new URLSearchParams(search).getAll('achievementCollection');
 return values.length===1&&values[0]==='collection-v1';
}

function populationFor(gameId,snapshot,catalog) {
 if(snapshot?.ok!==true||snapshot.gameId!==gameId||snapshot.cohort!=='verified-ranked-all-time'
  ||snapshot.minimumPlayers!==ACHIEVEMENT_RARITY_MIN_PLAYERS||!Array.isArray(snapshot.achievements)
  ||snapshot.achievements.length!==catalog.length)return null;
 const allowed=new Set(catalog.map(entry=>entry.id)),counts=new Map();
 try{
  achievementRarity({unlockedPlayers:0,rankedPlayers:snapshot.rankedPlayers});
  for(const row of snapshot.achievements){
   if(!row||!allowed.has(row.id)||counts.has(row.id))return null;
   const rarity=achievementRarity({unlockedPlayers:row.unlockedPlayers,rankedPlayers:snapshot.rankedPlayers});
   counts.set(row.id,Object.freeze({...rarity,unlockedPlayers:row.unlockedPlayers,rankedPlayers:snapshot.rankedPlayers}));
  }
 }catch{return null;}
 return counts;
}

export function buildAchievementCollection({unlocks=[],statsByGame={},gameId='all',filter='all',sort='catalog',query=''}={}) {
 if(gameId!=='all'&&!SECTION_IDS.has(gameId))throw new TypeError('unknown collection game');
 if(!FILTERS.includes(filter)||!SORTS.includes(sort))throw new TypeError('unknown collection filter or sort');
 const owned=new Map();
 for(const unlock of Array.isArray(unlocks)?unlocks:[]){
  if(!unlock||!SECTION_IDS.has(unlock.gameId)||typeof unlock.id!=='string')continue;
  const id=key(PARENT_IDS.has(unlock.id)?ACHIEVEMENT_PARENT_ID:unlock.gameId,unlock.id),date=normalizeAchievementUnlockDate(unlock.unlockedAt);
  // The earliest recorded valid unlock wins, independent of duplicate order.
  if(!owned.has(id)||(date&&(!owned.get(id)||date<owned.get(id))))owned.set(id,date);
 }
 const allRows=[],games=[];
 for(const game of COLLECTION_GAMES){
  const catalog=catalogFor(game.gameId).filter(entry=>entry.available);
  const stats=statsByGame&&Object.hasOwn(statsByGame,game.gameId)?statsByGame[game.gameId]:null;
  const population=populationFor(game.gameId,stats,catalog),rows=catalog.map(entry=>{
   const id=key(game.gameId,entry.id),unlocked=owned.has(id);
   return Object.freeze({id:entry.id,gameId:game.gameId,gameTitle:game.title,title:entry.title,
    description:entry.description,tier:entry.tier,category:entry.category,nft:entry.nft,
    image:unlocked?entry.image:entry.lockedImage,unlocked,unlockedAt:unlocked?owned.get(id):null,
    rarity:population?.get(entry.id)??null,order:allRows.length+catalog.indexOf(entry)});
  });
  allRows.push(...rows);
  const unlocked=rows.filter(row=>row.unlocked).length;
  games.push(Object.freeze({...game,total:rows.length,unlocked,fraction:unlocked/rows.length,
   trophies:Object.freeze({total:rows.filter(row=>row.nft).length,unlocked:rows.filter(row=>row.nft&&row.unlocked).length})}));
 }
 const byRarity=(a,b)=>{
  const ar=a.rarity,br=b.rarity;
  if(ar?.percentage==null||br?.percentage==null)return Number(ar?.percentage==null)-Number(br?.percentage==null)||a.order-b.order;
  // Cohorts can differ: compare integer ratios without rounding near ties.
  const difference=BigInt(ar.unlockedPlayers)*BigInt(br.rankedPlayers)-BigInt(br.unlockedPlayers)*BigInt(ar.rankedPlayers);
  return difference<0n?-1:difference>0n?1:a.order-b.order;
 };
 const rarest=allRows.filter(row=>row.unlocked&&row.rarity?.percentage!=null).sort(byRarity)[0]??null;
 const needle=String(query).trim().slice(0,120).toLowerCase();
 const rows=allRows.filter(row=>(gameId==='all'||row.gameId===gameId)
  &&(filter==='all'||filter==='unlocked'&&row.unlocked||filter==='locked'&&!row.unlocked||filter==='trophies'&&row.nft)
  &&(!needle||`${row.title} ${row.description} ${row.category}`.toLowerCase().includes(needle)));
 if(sort==='rarity')rows.sort(byRarity);
 else if(sort==='recent')rows.sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)
  ||(b.unlockedAt?Date.parse(b.unlockedAt):-Infinity)-(a.unlockedAt?Date.parse(a.unlockedAt):-Infinity)||a.order-b.order);
 // Catalog order already groups cabinets; it is the deterministic tie-breaker.
 const unlocked=allRows.filter(row=>row.unlocked).length;
 return Object.freeze({rows:Object.freeze(rows),games:Object.freeze(games),total:allRows.length,unlocked,rarest,
  trophies:Object.freeze({total:allRows.filter(row=>row.nft).length,unlocked:allRows.filter(row=>row.nft&&row.unlocked).length})});
}
