export const SILVER_DROP_CAP=64;
export const SILVER_LIFETIME_TICKS=1800;
export function createSilverDropState(){return {drops:Array.from({length:SILVER_DROP_CAP},()=>({active:false,value:0})),lastSequence:0,lastTick:-1,dropped:0,collected:0,expired:0};}

export function addSilverDrop(state,{sequence,tick,x,y,value=1}) {
  if(![sequence,tick,value].every(Number.isSafeInteger)||sequence<1||tick<0||value<1||value>100||![x,y].every(Number.isFinite))throw new TypeError('bounded silver drop required');
  if(sequence<=state.lastSequence)return false;
  state.lastSequence=sequence;state.dropped+=value;
  let slot=state.drops.find(d=>!d.active);
  if(!slot){
    slot=state.drops.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<=Math.hypot(b.x-x,b.y-y)?a:b);
    slot.value+=value;
    // Aggregation conserves value and retains the original expiry; a crowd
    // cannot extend an old pile indefinitely.
  }else Object.assign(slot,{active:true,x,y,value,tick});
  return true;
}

export function stepSilverDrops(state,{tick,player,canReach=()=>true}) {
  if(!Number.isSafeInteger(tick)||tick<0||tick<=state.lastTick)throw new TypeError('silver tick must be monotonic');
  if(![player?.x,player?.y].every(Number.isFinite))throw new TypeError('finite player required');
  state.lastTick=tick;let collected=0;
  for(const d of state.drops){
    if(!d.active)continue;
    if(tick-d.tick>=SILVER_LIFETIME_TICKS){state.expired+=d.value;d.active=false;continue;}
    if(Math.hypot(player.x-d.x,player.y-d.y)>62||!canReach(d))continue;
    collected+=d.value;d.active=false;
  }
  state.collected+=collected;return collected;
}

export function silverDropAccounting(state){return {dropped:state.dropped,collected:state.collected,expired:state.expired,active:state.drops.reduce((n,d)=>n+(d.active?d.value:0),0)};}
