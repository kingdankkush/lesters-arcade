import {createChikunRuntime,replayChikunRun} from '../apps/portal/src/chikun-cabinet.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
export function auditInput(s){
 const b=s.chikun,next=s.forks.find(o=>!o.passed&&o.x+o.width>250);
 let target=660;
 if(next&&next.x-280<s.difficulty.scrollPixelsPerTick*190){
  if(next.family==='tree')target=Math.max(85,690-next.height-80);
  else if(next.family==='sky')target=640;
  else target=next.family==='gap'?535:690-next.height-85;
 }
 return (b.y>target+10 && b.velocityY>-.6)||(b.velocityY>2.0&&b.y>target-15);
}
export function auditRun(seed,ticks=36000){
 const run=createChikunRuntime({seed,maxTicks:ticks});const kinds=new Set();
 while(!run.terminal){const s=run.snapshot();for(const o of s.forks)if(o.passed)kinds.add(o.variant);run.step({flap:auditInput(s)});}
 const result=run.result();return {seed,seconds:result.survivalTime,passed:result.forksPassed,reason:result.finalState.terminalReason,nearMisses:result.nearMisses,inputs:result.evidence.flapSteps.length,kinds:[...kinds],evidence:result.evidence};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/chikun-course-audit.mjs')){
 const reports=[];for(let seed=1;seed<=24;seed++){const row=auditRun(seed);reports.push(row);console.log(JSON.stringify({...row,evidence:undefined}));}
 await mkdir('../../outputs/qa',{recursive:true});await writeFile('../../outputs/qa/course-audit.json',JSON.stringify(reports,null,2));
 process.exitCode=reports.every(r=>r.reason==='run-complete')?0:1;
}
