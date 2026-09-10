export function createWorldDesignPacing() {
  return { arenaId:null, engaged:false, clearSince:-1, recoveryUntil:-1, recovered:new Set(), lastTick:-1 };
}
export function stepWorldDesignPacing(state,{tick,player,enemies,arenas}) {
  if(!Number.isInteger(tick)||tick<0||tick<=state.lastTick) throw new TypeError('pacing ticks must be monotonic');
  state.lastTick=tick;
  const arena=arenas.find(a=>Math.hypot(player.x-a.anchor.x,player.y-a.anchor.y)<=a.radius+180);
  if(!arena || arena.id!==state.arenaId) {
    state.arenaId=arena?.id??null; state.engaged=false; state.clearSince=-1; state.recoveryUntil=-1;
  }
  if(!arena) return {phase:'exploration',recovery:false};
  const threatened=enemies.some(e=>e.active&&e.health>0&&Math.hypot(player.x-e.x,player.y-e.y)<650);
  if(threatened) {state.engaged=true;state.clearSince=-1;return {phase:'combat',recovery:false};}
  if(state.engaged&&!state.recovered.has(arena.id)) {
    if(state.clearSince<0) state.clearSince=tick;
    if(tick-state.clearSince>=120) {
      state.recovered.add(arena.id);state.recoveryUntil=tick+480;state.engaged=false;
    }
  }
  const recovery=tick<state.recoveryUntil;
  return {phase:recovery?'recovery':'exploration',recovery};
}
