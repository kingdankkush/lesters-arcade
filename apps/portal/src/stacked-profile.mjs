export const stackedInputLabel = value => ({keyboard:'Keyboard',touch:'Touch',gamepad:'Controller',mixed:'Mixed inputs'}[value] ?? 'Input not recorded');
// Archive facts only. Missing older counters stay unknown; other games are excluded.
export function buildStackedProfileFacts(progress, wallet) {
  const rows=Object.entries(progress?.rankedArchive??{}).filter(([id,row])=>row.sessionId===id&&row.gameId==='stacked'&&row.status==='local-replay-preview'&&(!wallet||row.wallet===wallet)&&row.canonical?.gameId==='stacked').map(([,row])=>row);
  const aggregate=(key,max=false)=>rows.length&&rows.every(row=>Number.isSafeInteger(row.canonical[key])&&row.canonical[key]>=0)?rows.reduce((value,row)=>max?Math.max(value,row.canonical[key]):value+row.canonical[key],0):null;
  return {runs:rows.length,bestScore:aggregate('score',true),totalLines:aggregate('lines'),totalPieces:aggregate('pieces'),totalHalvings:aggregate('quadClears'),bestLevel:aggregate('level',true),bestCombo:aggregate('maxCombo',true),bestBackToBack:aggregate('maxBackToBack',true),perfectClears:aggregate('perfectClears'),spins:aggregate('spins'),ledgerReceived:aggregate('garbageRowsReceived'),ledgerCleared:aggregate('garbageRowsCleared'),holds:aggregate('holdsUsed'),longestTicks:aggregate('ticks',true)};
}
