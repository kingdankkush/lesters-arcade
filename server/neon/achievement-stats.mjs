// Read-only population statistics. Verification, not publication, earns progress:
// the existing queue atomically inserts its verified row and achievement unlocks.
import {ACHIEVEMENT_GAME_IDS,ACHIEVEMENT_PARENT_ID,catalogFor} from '../../apps/portal/src/achievements/index.mjs';
import {achievementRarity} from '../../apps/portal/src/achievements/rarity.mjs';

// gameId is a cabinet, or ACHIEVEMENT_PARENT_ID ('arcade'): the parent-owned
// entries, whose cohort is every cabinet's verified Ranked players and whose
// unlocks are counted whichever cabinet recorded them (once per wallet).
export async function readAchievementStats(db,{gameId}={}) {
 const parent=gameId===ACHIEVEMENT_PARENT_ID;
 if(!parent&&!ACHIEVEMENT_GAME_IDS.includes(gameId))throw new TypeError('unknown achievement game');
 const catalog=catalogFor(gameId).filter(entry=>entry.available),ids=catalog.map(entry=>entry.id),allowed=new Set(ids);
 // Both cohorts share game, exclusion and provenance checks. One query prevents
 // a newly verified run from appearing in only one half of the snapshot.
 const rows=await db.query(`WITH eligible AS (
   SELECT DISTINCT vs.wallet FROM verified_sessions vs
   WHERE ($1::text IS NULL OR vs.game_id=$1) AND NOT vs.chain_mismatch
     AND NOT EXISTS (SELECT 1 FROM wallet_profiles x WHERE x.wallet=vs.wallet AND x.board_excluded)
 ), earned AS (
   SELECT au.achievement_id,count(DISTINCT au.wallet)::int AS unlocked_players
   FROM achievement_unlocks au
   JOIN eligible e ON e.wallet=au.wallet
   JOIN verified_sessions vs ON vs.session_id32=au.session_id32
     AND vs.wallet=au.wallet AND vs.game_id=au.game_id AND NOT vs.chain_mismatch
   WHERE ($1::text IS NULL OR au.game_id=$1) AND au.achievement_id IN (SELECT jsonb_array_elements_text($2::jsonb))
   GROUP BY au.achievement_id
 ) SELECT (SELECT count(*)::int FROM eligible) AS ranked_players,
   coalesce((SELECT json_agg(json_build_object('achievement_id',achievement_id,'unlocked_players',unlocked_players)
     ORDER BY achievement_id) FROM earned),'[]'::json)::text AS counts`,[parent?null:gameId,JSON.stringify(ids)]);
 if(rows.length!==1||typeof rows[0].counts!=='string')throw new TypeError('invalid achievement aggregate driver row');
 const rankedPlayers=rows[0].ranked_players;
 achievementRarity({unlockedPlayers:0,rankedPlayers});
 const values=JSON.parse(rows[0].counts);
 if(!Array.isArray(values))throw new TypeError('invalid achievement aggregate counts');
 const counts=new Map();
 for(const row of values){
  if(!row||!allowed.has(row.achievement_id)||counts.has(row.achievement_id))throw new TypeError('invalid achievement aggregate id');
  achievementRarity({unlockedPlayers:row.unlocked_players,rankedPlayers});
  counts.set(row.achievement_id,row.unlocked_players);
 }
 return{gameId,rankedPlayers,achievements:catalog.map(entry=>{
  const unlockedPlayers=counts.get(entry.id)??0;
  return{id:entry.id,unlockedPlayers,...achievementRarity({unlockedPlayers,rankedPlayers})};
 })};
}
