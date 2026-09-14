// Snapshot deltas produce a bounded presentation state. Rewinds reset it.
export function createGameplayFeedback() {
  const state={ clear:0,impact:0,combo:0,danger:0,label:'',detail:'',labelAge:99,generation:0 };
  let previous=null, lastTime=null;
  return {
    state,
    update(snapshot, now, reducedMotion=false) {
      const dt=lastTime===null?0:Math.max(0,Math.min(.1,(now-lastTime)/1000)); lastTime=now;
      state.clear*=Math.exp(-dt/.65); state.impact*=Math.exp(-dt/.18); state.labelAge+=dt;
      const rewound=previous && (snapshot.tick<previous.tick || snapshot.lines<previous.lines || snapshot.piecesLocked<previous.piecesLocked);
      if(rewound) { state.clear=state.impact=0; state.label=''; state.labelAge=99; state.generation=0; }
      if(previous&&!rewound) {
        const cleared=snapshot.lines-previous.lines;
        if(cleared>0) {
          state.clear=Math.min(1,.45+cleared*.14); state.generation++;
          state.label=snapshot.perfectClears>previous.perfectClears?'ALL CLEAR':cleared>=4?'HALVING':['','SINGLE','DOUBLE','TRIPLE'][cleared];
          state.detail=`+${Math.max(0,snapshot.score-previous.score).toLocaleString()}${snapshot.comboCount>1?' · COMBO '+snapshot.comboCount:''}`;
          state.labelAge=0;
        } else if(snapshot.level>previous.level) { state.label='LEVEL '+snapshot.level; state.detail='THE LEDGER RISES'; state.labelAge=0; }
        else if(snapshot.garbageRowsReceived>previous.garbageRowsReceived) { state.label='LEDGER RISE'; state.detail='CLEAR SPACE BELOW'; state.labelAge=0; }
        if(snapshot.piecesLocked>previous.piecesLocked) state.impact=1;
        if(snapshot.terminal&&!previous.terminal) { state.label='RUN COMPLETE'; state.detail=''; state.labelAge=0; }
      }
      let height=0;
      for(let i=snapshot.board.length-1;i>=0;i--) if(snapshot.board[i]) { height=Math.floor(i/10)+1; break; }
      state.danger=Math.max(0,Math.min(1,(height-13)/6)); state.combo=Math.max(0,snapshot.comboCount??0);
      if(reducedMotion) state.clear=state.impact=0;
      previous=snapshot; return state;
    },
  };
}
