// Public read-only rarity snapshot. No wallet, earning or minting endpoint.
import {makeHandler} from '../../server/http.mjs';
import {buildBaseDeps} from '../../server/config.mjs';
import {ensureSchema} from '../../server/neon/migrations.mjs';
import {resolveGameId} from '../../server/neon/rows.mjs';
import {readAchievementStats} from '../../server/neon/achievement-stats.mjs';
import {ACHIEVEMENT_RARITY_MIN_PLAYERS} from '../../apps/portal/src/achievements/rarity.mjs';
import {ACHIEVEMENT_PARENT_ID} from '../../apps/portal/src/achievements/index.mjs';
export const ACHIEVEMENT_STATS_CACHE='public, s-maxage=300, stale-while-revalidate=300';
const cache={};
export async function buildDeps(env=process.env,overrides={}) {return buildBaseDeps(env,overrides,cache);}
const fail=(status,error)=>({status,body:{ok:false,error},headers:{'Cache-Control':'no-store'}});
export async function achievementStatsRequest({query={}}={},deps) {
 // A cabinet alias, or the parent-owned catalog ('arcade': every cabinet's cohort).
 const requested=String(query.game??'').trim().toLowerCase();
 const gameId=requested===ACHIEVEMENT_PARENT_ID?ACHIEVEMENT_PARENT_ID:resolveGameId(requested);
 if(!gameId)return fail(400,'invalid-game');
 if(!deps.db)return fail(503,'index-not-configured');
 await ensureSchema(deps.db);
 const snapshot=await readAchievementStats(deps.db,{gameId});
 return{status:200,body:{ok:true,...snapshot,cohort:'verified-ranked-all-time',minimumPlayers:ACHIEVEMENT_RARITY_MIN_PLAYERS,generatedAt:new Date(deps.nowMs()).toISOString()},headers:{'Cache-Control':ACHIEVEMENT_STATS_CACHE}};
}
const adapter=makeHandler({label:'achievement-stats',methods:['GET'],query:['game'],run:achievementStatsRequest});
export function createHandler(depsFactory) {return adapter(depsFactory);}
export default createHandler(()=>buildDeps());
