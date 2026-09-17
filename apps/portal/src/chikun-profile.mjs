// Parent-owned, game-scoped projections; missing historical fields stay unknown.
const definitions=Object.freeze([
 {id:'chikun-first-flight',title:'First Flight',field:'survivalTicks',target:10},
 {id:'chikun-stack-three',title:'Stack Three',field:'coinsCollected',target:3},
 {id:'chikun-fork-runner',title:'Fork Runner',field:'forksPassed',target:5},
 {id:'chikun-thread-needle',title:'Thread the Needle',field:'nearMisses',target:3},
]);
const numeric=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export function chikunCourseVersion(run={}){return run.runStats?.evidenceVersion??run.parentSync?.replayClaim?.evidence?.version??run.replayClaim?.evidence?.version??null;}
export function chikunAchievements(run={}){
 const stats=run.runStats??run;
 return definitions.map(d=>{const value=numeric(stats[d.field]);return Object.freeze({...d,value,progress:value==null?null:Math.min(1,value/d.target),unlocked:value!=null&&value>=d.target});});
}
export function buildChikunProfile(sessions,wallet){
 const owner=String(wallet??'').trim().toLowerCase();
 const runs=Object.values(sessions??{}).filter(r=>r.gameId==='chikun'&&String(r.wallet??'').trim().toLowerCase()===owner&&r.runStats&&(['paid','ranked'].includes(r.mode)||r.leaderboardEligible===true));
 const unique=new Map(runs.map(r=>[r.sessionId,r]));
 const current=[...unique.values()].filter(r=>chikunCourseVersion(r)==='chikun-flap-evidence-v5');
 const sums={coins:null,forks:null,nearMisses:null,bestCombo:null,flaps:null,awards:0};const earned=new Map();
 let bestScore=null,longest=null;
 for(const run of current){
  for(const [out,field]of [['coins','coinsCollected'],['forks','forksPassed'],['nearMisses','nearMisses'],['flaps','flapCount']]){const n=numeric(run.runStats[field]);if(n!=null)sums[out]=(sums[out]??0)+n;}
  const combo=numeric(run.runStats.bestCombo);if(combo!=null)sums.bestCombo=Math.max(sums.bestCombo??0,combo);
  const score=numeric(run.score??run.runStats.score);if(score!=null)bestScore=Math.max(bestScore??0,score);
  const seconds=numeric(run.runStats.survivalTime);if(seconds!=null)longest=Math.max(longest??0,seconds);
  for(const a of chikunAchievements(run))if(a.unlocked){const when=run.recordedAt??run.completedAt??null;if(!earned.has(a.id)||when&&when<earned.get(a.id).when)earned.set(a.id,{...a,when});}
 }
 sums.awards=earned.size;
 return Object.freeze({...sums,bestScore,longest,runs:current.length,historicalRuns:unique.size-current.length,achievements:Object.freeze([...earned.values()]),history:Object.freeze(current.sort((a,b)=>String(b.completedAt??b.createdAt??'').localeCompare(String(a.completedAt??a.createdAt??''))).slice(0,20))});
}
