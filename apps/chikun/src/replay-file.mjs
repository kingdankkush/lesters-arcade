import {replayChikunRun} from '../../portal/src/chikun-cabinet.mjs';
// Sized for a 60-minute v6 replay (12,000 flap deltas) with room to spare.
export const REPLAY_FILE_LIMIT=262144;
export function exportChikunReplay(result){
 const verified=replayChikunRun(result?.evidence);
 return JSON.stringify({format:'chikun-replay-file-v1',game:'chikun',evidence:verified.evidence});
}
export function importChikunReplay(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>REPLAY_FILE_LIMIT)throw new Error('Replay file must be smaller than 256 KB.');
 let data;try{data=JSON.parse(text);}catch{throw new Error('This file is not valid replay JSON.');}
 if(data?.format!=='chikun-replay-file-v1'||data.game!=='chikun'||Object.keys(data).some(k=>!['format','game','evidence'].includes(k)))throw new Error('This is not a supported Chikun replay.');
 const e=data.evidence;
 // v6 files carry flapDeltas; historical v1-v5 files carry flapSteps.
 const flapKey=e&&Object.hasOwn(e,'flapDeltas')?'flapDeltas':'flapSteps';
 if(!e||Object.keys(e).some(k=>!['version','seed','fixedStepHz','maxTicks',flapKey].includes(k))||!Number.isInteger(e.seed)||e.seed<0||e.seed>0xffffffff)throw new Error('Replay metadata is invalid.');
 // Imports run locally and never call the bridge, storage or score submission.
 return replayChikunRun(e);
}
