// Static painted rectangles, not just ground anchors. This keeps large roofs
// and bridge decks visible across chunk edges and elevated camera moves.
export function createWorldDesignSpatialIndex(rectangles, cellSize=512) {
  const buckets=new Map();
  for(let index=0;index<rectangles.length;index++) {
    const r=rectangles[index];
    for(let y=Math.floor(r.top/cellSize);y<=Math.floor(r.bottom/cellSize);y++) for(let x=Math.floor(r.left/cellSize);x<=Math.floor(r.right/cellSize);x++) {
      const key=`${x}:${y}`;
      if(!buckets.has(key)) buckets.set(key,[]);
      buckets.get(key).push(index);
    }
  }
  return {query(rect){
    const found=new Set();
    for(let y=Math.floor(rect.top/cellSize);y<=Math.floor(rect.bottom/cellSize);y++) for(let x=Math.floor(rect.left/cellSize);x<=Math.floor(rect.right/cellSize);x++) {
      for(const index of buckets.get(`${x}:${y}`)??[]) {
        const r=rectangles[index];
        if(r.right>=rect.left&&r.left<=rect.right&&r.bottom>=rect.top&&r.top<=rect.bottom) found.add(index);
      }
    }
    return [...found].sort((a,b)=>a-b);
  }};
}
