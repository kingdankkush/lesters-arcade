// Verbatim copy of the 1.8.1 release (60ea173a) apps/hmh-reboot/src/blocker-bounds.mjs, kept as the
// bit-identical reference for tests/hmh-sim-hot-path.test.mjs. Do not edit.
// Conservative rejection only. Narrow-phase geometry and contact order remain
// authoritative. Cache by immutable shape identity; mutable callers recompute.
const boundsByShape=new WeakMap();
function boundsOf(shape){
  let bounds=boundsByShape.get(shape);if(bounds)return bounds;
  let minX,maxX,minY,maxY,immutable=Object.isFrozen(shape);
  if(shape.type==='circle'){
    minX=shape.x-shape.radius;maxX=shape.x+shape.radius;minY=shape.y-shape.radius;maxY=shape.y+shape.radius;
  }else if(shape.type==='capsule'){
    minX=Math.min(shape.a.x,shape.b.x)-shape.radius;maxX=Math.max(shape.a.x,shape.b.x)+shape.radius;
    minY=Math.min(shape.a.y,shape.b.y)-shape.radius;maxY=Math.max(shape.a.y,shape.b.y)+shape.radius;
    immutable&&=Object.isFrozen(shape.a)&&Object.isFrozen(shape.b);
  }else if(shape.type==='polygon'){
    minX=minY=Infinity;maxX=maxY=-Infinity;
    for(const p of shape.vertices){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);immutable&&=Object.isFrozen(p);}
    immutable&&=Object.isFrozen(shape.vertices);
  }else return null;
  bounds={minX,maxX,minY,maxY};if(immutable)boundsByShape.set(shape,bounds);return bounds;
}
export function blockerSweepMayOverlap(shape,x,y,dx,dy,radius){
  const b=boundsOf(shape);if(!b)return true;
  // The solver accepts contacts up to epsilon beyond a segment endpoint.
  const pad=radius+1e-6+Math.max(Math.abs(dx),Math.abs(dy))*1e-9;
  return Math.max(x,x+dx)+pad>=b.minX&&Math.min(x,x+dx)-pad<=b.maxX
    &&Math.max(y,y+dy)+pad>=b.minY&&Math.min(y,y+dy)-pad<=b.maxY;
}

const indexes=new WeakMap(),cellSize=256;
export function immutableBlockerIndex(blockers){
  if(!Object.isFrozen(blockers))return null;
  if(indexes.has(blockers))return indexes.get(blockers);
  const ordered=[...blockers].sort((a,b)=>a.id.localeCompare(b.id)),cells=new Map();
  for(let i=0;i<ordered.length;i++){
    const b=ordered[i],box=boundsOf(b.shape);
    if(!Object.isFrozen(b)||!boundsByShape.has(b.shape)||!box){indexes.set(blockers,null);return null;}
    for(let y=Math.floor(box.minY/cellSize);y<=Math.floor(box.maxY/cellSize);y++){
      for(let x=Math.floor(box.minX/cellSize);x<=Math.floor(box.maxX/cellSize);x++){
        const key=`${x},${y}`;let bucket=cells.get(key);if(!bucket)cells.set(key,bucket=[]);bucket.push(i);
      }
    }
  }
  const index={ordered,query(x,y,dx,dy,radius){
    const pad=radius+1e-6+Math.max(Math.abs(dx),Math.abs(dy))*1e-9;
    const left=Math.floor((Math.min(x,x+dx)-pad)/cellSize),right=Math.floor((Math.max(x,x+dx)+pad)/cellSize);
    const top=Math.floor((Math.min(y,y+dy)-pad)/cellSize),bottom=Math.floor((Math.max(y,y+dy)+pad)/cellSize);
    // Very long rays are cheaper as a scan; this is never a truncated query.
    if((right-left+1)*(bottom-top+1)>256)return ordered;
    const found=new Set();
    for(let row=top;row<=bottom;row++)for(let col=left;col<=right;col++)for(const i of cells.get(`${col},${row}`)??[])found.add(i);
    return [...found].sort((a,b)=>a-b).map(i=>ordered[i]);
  }};
  indexes.set(blockers,index);return index;
}
