// Locate a committed placement by matching board cells, including row compaction
// and ledger rise. This is bounded inverse geometry, never a second simulation.
export function locateCommittedLock(before, after, geometry) {
  if(!before.active) return null;
  const kind=after.holdsUsed>before.holdsUsed?(before.hold??before.queue?.[0]):before.active.kind;
  if(!kind)return null;
  const id='IJLOSTZ'.indexOf(kind)+1,cleared=after.lines-before.lines;
  const raised=Math.max(0,(after.garbageRowsReceived??0)-(before.garbageRowsReceived??0));
  const match=cells=>{
    if(geometry.collides(before.board,cells))return null;
    const at=(x,y)=>before.board[y*10+x]||(cells.some(([cx,cy])=>cx===x&&cy===y)?id:0);
    const rows=[];
    for(let y=0;y<24;y++){let full=true;for(let x=0;x<10;x++)if(!at(x,y)){full=false;break;}if(full)rows.push(y);}
    if(rows.length!==cleared)return null;
    let dest=raised;
    for(let y=0;y<24;y++) {
      if(rows.includes(y))continue;
      if(dest<24)for(let x=0;x<10;x++)if(after.board[dest*10+x]!==at(x,y))return null;
      dest++;
    }
    for(;dest<24;dest++)for(let x=0;x<10;x++)if(after.board[dest*10+x])return null;
    return {cells,rows};
  };
  const a=before.active;
  if(kind===a.kind) {
    let y=a.y;while(y>-4&&!geometry.collides(before.board,geometry.cellsFor(kind,a.rotation,a.x,y-1)))y--;
    const usual=match(geometry.cellsFor(kind,a.rotation,a.x,y));if(usual)return usual;
  }
  // A rotate + move + drop chord can lock a different footprint in the same tick.
  // Search legal grounded footprints only; at most 4 × 12 × 27 candidates.
  for(let rotation=0;rotation<4;rotation++)for(let x=-2;x<10;x++)for(let y=-3;y<24;y++) {
    const cells=geometry.cellsFor(kind,rotation,x,y);
    if(geometry.collides(before.board,cells)||!geometry.collides(before.board,geometry.cellsFor(kind,rotation,x,y-1)))continue;
    const result=match(cells);if(result)return result;
  }
  return null;
}
