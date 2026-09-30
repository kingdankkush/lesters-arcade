// Local greybox authoring only. Fill the complement with actual visible convex
// solids; never substitute water flags or edit the canonical navigation rules.
import { freezeDeep } from '../value-guards.mjs';
const epsilon=1e-8;
const ordinate=(edge,x)=>edge.a.y+(edge.b.y-edge.a.y)*(x-edge.a.x)/(edge.b.x-edge.a.x);
const horizontal=y=>({a:{x:0,y},b:{x:1,y}});
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<=epsilon&&p.x>=Math.min(a.x,b.x)-epsilon&&p.x<=Math.max(a.x,b.x)+epsilon&&p.y>=Math.min(a.y,b.y)-epsilon&&p.y<=Math.max(a.y,b.y)+epsilon;
function intersect(a,b,c,d){
  const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
  return(ac>epsilon&&ad< -epsilon||ac< -epsilon&&ad>epsilon)&&(ca>epsilon&&cb< -epsilon||ca< -epsilon&&cb>epsilon)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
export function createClosedMassPolygons({bounds,floors}={}){
  if(!bounds||!['minX','minY','maxX','maxY'].every(key=>Number.isFinite(bounds[key]))||bounds.minX>=bounds.maxX||bounds.minY>=bounds.maxY)throw new TypeError('finite positive bounds required');
  if(!Array.isArray(floors)||floors.length>128)throw new TypeError('bounded floor polygon array required');
  const polygons=floors.map(vertices=>{
    if(!Array.isArray(vertices)||vertices.length<3||vertices.length>8||!vertices.every(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)))throw new TypeError('finite convex floor vertices required');
    const copied=vertices.map(({x,y})=>({x,y}));
    if(copied.some(p=>p.x<bounds.minX||p.x>bounds.maxX||p.y<bounds.minY||p.y>bounds.maxY))throw new TypeError('floor vertices must be inside bounds');
    for(let i=0;i<copied.length;i++)for(let j=i+1;j<copied.length;j++)if(Math.hypot(copied[i].x-copied[j].x,copied[i].y-copied[j].y)<=epsilon)throw new TypeError('duplicate vertex or zero-length floor edge');
    for(let i=0;i<copied.length;i++)for(let j=i+1;j<copied.length;j++){
      if(j===i+1||i===0&&j===copied.length-1)continue;
      if(intersect(copied[i],copied[(i+1)%copied.length],copied[j],copied[(j+1)%copied.length]))throw new TypeError('floor polygon must be simple');
    }
    let direction=0,area=0;
    for(let i=0;i<copied.length;i++){const a=copied[i],b=copied[(i+1)%copied.length],c=copied[(i+2)%copied.length];area+=a.x*b.y-a.y*b.x;const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)>epsilon){const sign=Math.sign(cross);if(direction&&sign!==direction)throw new TypeError('floor polygon must be convex');direction=sign;}}
    if(Math.abs(area)<=epsilon)throw new TypeError('convex floor must have positive area');
    return copied;
  });
  const edges=polygons.map(vertices=>vertices.flatMap((a,i)=>{const b=vertices[(i+1)%vertices.length];return Math.abs(a.x-b.x)>epsilon?[{a,b,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x)}]:[];}));
  const all=edges.flat(),breaks=[bounds.minX,bounds.maxX,...polygons.flatMap(vertices=>vertices.map(p=>p.x))];
  // A union boundary can change where two sloped edges cross, as well as at
  // vertices. Omitting crossings leaves plausible but overlapping/holey masses.
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const a=all[i],b=all[j],left=Math.max(a.minX,b.minX),right=Math.min(a.maxX,b.maxX);
    if(right-left<=epsilon)continue;
    const da=ordinate(a,right)-ordinate(a,left),db=ordinate(b,right)-ordinate(b,left),slope=(da-db)/(right-left);
    if(Math.abs(slope)<=epsilon)continue;
    const x=left+(ordinate(b,left)-ordinate(a,left))/slope;
    if(x>left+epsilon&&x<right-epsilon)breaks.push(x);
  }
  breaks.sort((a,b)=>a-b);const xs=breaks.filter((x,i)=>i===0||x-breaks[i-1]>epsilon),closed=[];
  for(let slab=1;slab<xs.length;slab++){
    const left=xs[slab-1],right=xs[slab],middle=(left+right)/2;
    const intervals=edges.flatMap(polygon=>{const crossing=polygon.filter(edge=>middle>edge.minX&&middle<edge.maxX).sort((a,b)=>ordinate(a,middle)-ordinate(b,middle));return crossing.length?[{lower:crossing[0],upper:crossing.at(-1)}]:[];}).sort((a,b)=>ordinate(a.lower,middle)-ordinate(b.lower,middle));
    const union=[];
    for(const interval of intervals){const previous=union.at(-1);if(previous&&ordinate(interval.lower,middle)<=ordinate(previous.upper,middle)+epsilon){if(ordinate(interval.upper,middle)>ordinate(previous.upper,middle))previous.upper=interval.upper;}else union.push({...interval});}
    let lower=horizontal(bounds.minY);
    for(const gapUpper of [...union.map(interval=>interval.lower),horizontal(bounds.maxY)]){
      if(ordinate(gapUpper,middle)-ordinate(lower,middle)>epsilon){
        const vertices=[{x:left,y:ordinate(lower,left)},{x:right,y:ordinate(lower,right)},{x:right,y:ordinate(gapUpper,right)},{x:left,y:ordinate(gapUpper,left)}].filter((p,i,points)=>Math.hypot(p.x-points[(i+points.length-1)%points.length].x,p.y-points[(i+points.length-1)%points.length].y)>epsilon);
        if(vertices.length>=3)closed.push(vertices);
      }
      const index=union.findIndex(interval=>interval.lower===gapUpper);if(index>=0)lower=union[index].upper;
    }
    if(closed.length>8192)throw new RangeError('closed-mass authoring partition exceeds bounded piece count');
  }
  return freezeDeep(closed);
}
