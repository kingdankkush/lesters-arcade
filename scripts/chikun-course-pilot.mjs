// Deterministic QA autopilots for the looping course. Each reads only the public
// snapshot (what the player sees) and returns whether to flap this tick, so the
// same function drives Node simulations and the browser region smoke.
// Both functions are self-contained (no module-scope references) because the
// browser smoke injects their toString() into the child frame.

// coursePilot is the "hover at y <= 100" exploit: hug the sky ceiling (clears
// every tree, building, gap and bird), land ahead of each low passage (storm /
// canopy), run under it, take off again. On the v6 course planes patrol the top
// band, so this lane is no longer safe (tests/chikun-difficulty.test.mjs).
export function coursePilot(snapshot){
 const HOVER_CEILING=100,DESCENT_TICKS=112,LANDING_MARGIN=140; // fall ≈112 ticks, land 140 px early
 const b=snapshot.chikun,scroll=snapshot.difficulty?.scrollPixelsPerTick??2.4;
 const low=snapshot.forks.find(o=>!o.passed&&o.route==='ground'&&o.x+o.width>250);
 const descendAt=scroll*DESCENT_TICKS+LANDING_MARGIN;
 if(low&&low.x-280<descendAt)return false;          // fall, land, run under it
 if(b.locomotion==='run'||b.locomotion==='jump')return true; // take off (jump, then flight)
 if(b.locomotion==='fall')return true;                // ran off an edge: fly
 return b.y>HOVER_CEILING&&b.velocityY>=0;             // hover just under the ceiling
}

// routePilot flies the same high line but drops under the top-band planes, so
// it can cover a full lap for the region smoke and the region tests.
export function routePilot(snapshot){
 const HOVER_CEILING=100,DESCENT_TICKS=112,LANDING_MARGIN=140,PLANE_LEAD_TICKS=80,PLANE_MARGIN=230;
 const b=snapshot.chikun,scroll=snapshot.difficulty?.scrollPixelsPerTick??2.4;
 const low=snapshot.forks.find(o=>!o.passed&&o.route==='ground'&&o.x+o.width>250);
 if(low&&low.x-280<scroll*DESCENT_TICKS+LANDING_MARGIN)return false;
 if(b.locomotion==='run'||b.locomotion==='jump'||b.locomotion==='fall')return true;
 // Hover band is [ceiling - 96, ceiling]: keep its top 40 px under the plane's belly.
 const plane=snapshot.forks.find(o=>!o.passed&&o.kind==='plane'&&o.x+o.width>220&&o.x-280<scroll*PLANE_LEAD_TICKS+PLANE_MARGIN);
 const ceiling=plane?plane.y+plane.height/2+12+30+40+96:HOVER_CEILING;
 return b.y>ceiling&&b.velocityY>=0;
}

export function pilotRun(runtime,maxTicks=Infinity,pilot=routePilot){
 while(!runtime.terminal&&runtime.snapshot().tick<maxTicks)runtime.step({flap:pilot(runtime.snapshot())});
 return runtime.snapshot();
}
