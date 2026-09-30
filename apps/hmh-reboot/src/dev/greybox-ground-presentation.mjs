import { freezeDeep } from '../value-guards.mjs';

// Cache the local preview's polygons once. The last paint must be the same
// surface chosen first by the existing ground query, including equal-priority ids.
export function createGreyboxGroundPaint(surfaces) {
  return freezeDeep([...surfaces].sort((a,b) => a.priority-b.priority || b.id.localeCompare(a.id)).map(surface => {
    const area=surface.area;
    const vertices=area.type==='polygon' ? area.vertices.map(({x,y}) => ({x,y}))
      : [{x:area.minX,y:area.minY},{x:area.maxX,y:area.minY},{x:area.maxX,y:area.maxY},{x:area.minX,y:area.maxY}];
    const water=surface.kind==='water',bridge=surface.kind==='bridge';
    return {
      surfaceId:surface.id,vertices,
      fill:water?'#385c67':bridge?'#b5a47e':surface.priority===15?'#949b97':surface.kind==='ramp'?'#d1d4cb':surface.groundZ>0?'#d9ded5':'#bcc4bb',
      stroke:water?'#203e46':bridge?'#e0d3af':null,
    };
  }));
}
