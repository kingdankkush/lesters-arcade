// Deterministic QA autopilot for the looping course. It reads only the public
// snapshot (what the player sees) and returns whether to flap this tick, so the
// same function drives Node simulations and the browser region smoke.
// Strategy: hug the sky ceiling (clears every tree, building, gap and bird),
// land ahead of each low passage (storm / canopy), run under it, take off again.
// The function is self-contained (no module-scope references) because the
// browser smoke injects coursePilot.toString() into the child frame.
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
export function pilotRun(runtime,maxTicks=Infinity){
 while(!runtime.terminal&&runtime.snapshot().tick<maxTicks)runtime.step({flap:coursePilot(runtime.snapshot())});
 return runtime.snapshot();
}
