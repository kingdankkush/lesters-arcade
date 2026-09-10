// Presentation geometry only. Elevation and traversal remain in level-one-world.
const cache = new WeakMap();
export function waterVertices(area) {
  return area.type === 'rect'
    ? [{x:area.minX,y:area.minY},{x:area.maxX,y:area.minY},{x:area.maxX,y:area.maxY},{x:area.minX,y:area.maxY}]
    : area.vertices;
}
function inside(p, poly) {
  let result = false;
  for (let i=0,j=poly.length-1; i<poly.length; j=i++) {
    const a=poly[i], b=poly[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) result=!result;
  }
  return result;
}
export function waterAreaContains(area, x, y) {
  if (area.type === 'rect') return x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY;
  const points = waterVertices(area), point = { x, y };
  if (inside(point, points)) return true;
  return points.some((a, index) => {
    const b = points[(index + 1) % points.length];
    return Math.abs((x-a.x)*(b.y-a.y)-(y-a.y)*(b.x-a.x)) <= 1e-8
      && x >= Math.min(a.x,b.x)-1e-8 && x <= Math.max(a.x,b.x)+1e-8
      && y >= Math.min(a.y,b.y)-1e-8 && y <= Math.max(a.y,b.y)+1e-8;
  });
}
const cross = (a,b) => a.x*b.y-a.y*b.x;
const subtract = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
export function exposedWaterEdges(surfaces) {
  if (cache.has(surfaces)) return cache.get(surfaces);
  const water=surfaces.filter(s=>s.kind==='water').map(s=>({surface:s,vertices:waterVertices(s.area)}));
  const edges=[];
  for (const entry of water) for (let i=0;i<entry.vertices.length;i++) {
    const a=entry.vertices[i], b=entry.vertices[(i+1)%entry.vertices.length], d=subtract(b,a), cuts=[0,1];
    for (const other of water) if (other!==entry) for (let j=0;j<other.vertices.length;j++) {
      const c=other.vertices[j], e=other.vertices[(j+1)%other.vertices.length], v=subtract(e,c), den=cross(d,v);
      if (Math.abs(den)<1e-9) continue;
      const ac=subtract(c,a), t=cross(ac,v)/den, u=cross(ac,d)/den;
      if(t>0&&t<1&&u>=0&&u<=1) cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let j=1;j<cuts.length;j++) {
      const lo=cuts[j-1],hi=cuts[j]; if(hi-lo<1e-9) continue;
      const mid={x:a.x+d.x*(lo+hi)/2,y:a.y+d.y*(lo+hi)/2};
      if(water.some(other=>other!==entry&&inside(mid,other.vertices))) continue;
      edges.push(Object.freeze({surfaceId:entry.surface.id,z:entry.surface.waterLevel??0,a:{x:a.x+d.x*lo,y:a.y+d.y*lo},b:{x:a.x+d.x*hi,y:a.y+d.y*hi}}));
    }
  }
  const result=Object.freeze(edges); cache.set(surfaces,result); return result;
}
export function clipHorizontalWaterLine(points,y) {
  const xs=[];
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[j],b=points[i];
    if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y)) xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
  }
  xs.sort((a,b)=>a-b); const spans=[];
  for(let i=0;i+1<xs.length;i+=2) spans.push([xs[i],xs[i+1]]);
  return spans;
}
