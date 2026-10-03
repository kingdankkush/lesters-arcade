// Authored walk-through dressing close enough to read from the arrival view.
// All assets already belong to the district's loaded pages. Never place a
// blocking-class card here: tall structures belong to a versioned map slice.
import { createPlacementGuard, pointInPolygon } from '../world-v2-area-art-schema.mjs';
import { cardBlocks, cardGroundFootprint } from './card-footprints.mjs';

const POCKETS = {
  'mweb-meadows': { sources:['detail:meadow-clover','detail:meadow-grass','detail:meadow-flowers','detail:meadow-pebbles'], heights:[32,36,30,24], tint:0xf5f3e7, centres:[[-330,-245],[320,245],[-325,280],[355,-265]] },
  'halving-farms': { sources:['b1-07','b1-05','b1-01'], heights:[54,62,68], tint:0xe1dbc5, centres:[[-350,265],[375,-280],[-435,-275]] },
  'hollow-pines': { sources:['b1-04','b1-02','b2-79'], heights:[78,60,38], tint:0xd4dec7, centres:[[-360,285],[380,-280],[440,330]] },
  'rugpull-woods': { sources:['b1-04','b1-02','b1-05'], heights:[72,66,56], tint:0xd2d9c1, centres:[[-360,-275],[380,295],[-420,335]] },
  'scrypt-bayou': { sources:['b1-04','b1-09','b1-02'], heights:[70,58,62], tint:0xd4dbcb, centres:[[-330,-280],[40,-340],[-320,-420]] },
  'hashwood-river': { sources:['b1-04','b1-02','b1-05'], heights:[58,56,48], tint:0xe0e2d1, centres:[[-360,-280],[370,275],[-460,335]] },
  'silver-coast': { sources:['b1-05','b1-02','b1-42'], heights:[64,54,42], tint:0xe9e2c8, centres:[[-350,280],[365,-275],[455,325]] },
  'ledger-ridge': { sources:['b1-42','b1-05','b2-79'], heights:[42,52,38], tint:0xd2d2c8, support:'lower-cut', centres:[[-350,340],[300,340],[0,400]] },
  'litecoin-city': { sources:['b2-49','b2-61','b2-47'], heights:[24,48,64], tint:0xd8dad2, centres:[[-355,295],[385,-290],[455,355]] },
  'fork-fortress': { sources:['b1-42','b2-49','b2-61'], heights:[42,24,48], tint:0xcbd0c8, centres:[[-375,-285],[370,295],[-450,345]] },
};
// Unequal, deliberately clustered offsets leave broad gaps between pockets.
const OFFSETS = [[0,0],[-46,12],[48,9],[-23,-35],[28,-41],[-72,-27],[75,-20],[-56,47],[48,53],[1,63],[-90,30],[92,31]];

// The portrait arrival camera sees only ~234 world units across. Broad garden
// corners cannot provide its composition. These low patches frame the relay
// path's east verge and the southern lawn inside that real camera framing.
// The north-west strip is deliberately empty: the garden-return path runs there.
const MEADOW_ARRIVAL_BEDS = [[84,-140],[84,-220],[-58,114],[58,142]];
const MEADOW_BED_OFFSETS = [[0,0],[-14,-26],[12,24],[-8,48],[10,-52],[26,-6]];
const MEADOW_BED_SOURCES = ['detail:meadow-clover','detail:meadow-grass','detail:meadow-clover','detail:meadow-flowers','detail:meadow-grass','detail:meadow-pebbles'];

function appendMeadowArrivalBeds(world, area, plan) {
  // An area-centre marker is a navigation label, not an interactable. Ground
  // vegetation may frame it; actual objectives and exits keep their 150-unit
  // clearance, roads retain their full widths, and solids/water stay excluded.
  // This guard affects only these nonblocking decals, never simulation geometry.
  const guard = createPlacementGuard({world:{...world,sites:world.sites.filter(s=>s.id!==`${area.id}-area`)},areaId:area.id,routeClearance:20,siteClearance:150,spawnClearance:60});
  let id=0;
  for(const [cx,cy] of MEADOW_ARRIVAL_BEDS) for(const [dx,dy] of MEADOW_BED_OFFSETS) {
    const n=id++, x=area.center.x+cx+dx, y=area.center.y+cy+dy;
    const scale=0.84+(n%3)*0.08, half=256*0.32*scale/2;
    // Check the entire transparent frame, not just its root; the taller stems
    // are still below 16 cm in the baked mesh and never cover the hero's body.
    if(![[x-half,y-half],[x+half,y-half],[x+half,y+half],[x-half,y+half]].every(([px,py])=>guard.clear(px,py))) continue;
    plan.ground.decals.push({id:`${area.id}-centre-arrival-${n}`,source:MEADOW_BED_SOURCES[n%MEADOW_BED_SOURCES.length],x,y,scale,rotation:0,alpha:0.97,tint:0xffffff,flip:n%2===0});
  }
}

export function appendCentrePockets({world, area, plan}) {
  const design = POCKETS[area.id];
  if (!design) return;
  // The 560-unit simulation spawn exclusion stays intact. Small walk-through
  // plants can frame its edges without consuming that whole first screen.
  const support = design.support ? world.pieces.find(p=>p.id===`${area.id}-${design.support}`) : null;
  const guard = createPlacementGuard({world:support?{...world,pieces:world.pieces.filter(p=>p!==support)}:world,areaId:area.id,routeClearance:74,siteClearance:150,spawnClearance:150});
  let id = 0;
  for (const [cx,cy] of design.centres) for (const [dx,dy] of OFFSETS) {
    const n = id++, source = design.sources[n % design.sources.length];
    const height = design.heights[n % design.heights.length], x = area.center.x+cx+dx, y = area.center.y+cy+dy;
    if (cardBlocks(source,height)) throw new Error(`centre pocket cannot add collision: ${source}`);
    const nativeMeadow = source.startsWith('detail:meadow-');
    const footprint = nativeMeadow ? {minX:x-37,maxX:x+37,minY:y-37,maxY:y+37} : cardGroundFootprint(source,x,y,height);
    if (!guard.clear(x,y,10) || !footprint || ![[footprint.minX,footprint.minY],[footprint.maxX,footprint.minY],[footprint.maxX,footprint.maxY],[footprint.minX,footprint.maxY]].every(([px,py])=>guard.clear(px,py))) continue;
    if (support && ![[footprint.minX,footprint.minY],[footprint.maxX,footprint.minY],[footprint.maxX,footprint.maxY],[footprint.minX,footprint.maxY]].every(([px,py])=>pointInPolygon(px,py,support.blocker.shape.vertices))) continue;
    // Explicit IDs keep every existing art/card/blocker identity unchanged.
    if (nativeMeadow) plan.ground.decals.push({id:`${area.id}-centre-${n}`,source,x,y,scale:0.88,rotation:0,alpha:0.94,tint:design.tint,flip:n%3===0});
    else plan.props.push({id:`${area.id}-centre-${n}`,source,x,y,height,tint:design.tint,flip:n%3===0,shadow:source!=='b2-47',...(support?{groundZ:support.visible.height}: {})});
  }
  if(area.id==='mweb-meadows') appendMeadowArrivalBeds(world,area,plan);
}
