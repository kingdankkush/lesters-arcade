// Cosmetic clock only. No simulation, game RNG, evidence, settings writes or timers.
export const LIVING_JOURNEY_SCENES=Object.freeze(['living','aurora','orbit','spectrum','tunnel','particles','horizon','matrix']);
const unit=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const smooth=value=>value*value*(3-2*value);
export function createLivingJourney({seed=0x4c544332}={}) {
  let random=(Number.isInteger(seed)?seed:0x4c544332)>>>0;if(random===0)random=0x4c544332;
  const deck=[...LIVING_JOURNEY_SCENES];
  for(let index=deck.length-1;index>0;index-=1){random^=random<<13;random^=random>>>17;random^=random<<5;const other=(random>>>0)%(index+1);[deck[index],deck[other]]=[deck[other],deck[index]];}
  Object.freeze(deck);
  const state={from:deck[0],to:deck[0],scene:deck[0],mix:1,portalRadius:0,phase:'ambient',reason:'start',transitionCount:0,distance:0,bpm:120,speed:12,brightness:.18};
  let previousTime=null,beats=0,changedAtBeat=0,portalProgress=1,index=0,previousLines=null,previousCombo=0,pending=null;
  const go=reason=>{state.from=state.to;index=(index+1)%deck.length;state.to=deck[index];state.mix=0;state.portalRadius=.06;state.phase='portal';state.reason=reason;state.transitionCount+=1;portalProgress=0;changedAtBeat=beats;pending=null;};
  return {
    state,deck,
    nextScene(){if(portalProgress===1)go('manual');else pending='manual';},
    update({now,bpm=120,lines=0,combo=0,danger=0,reducedMotion=false}={}) {
      const validTime=Number.isFinite(now);
      const dt=validTime&&previousTime!==null?Math.max(0,Math.min(.1,(now-previousTime)/1000)):0;
      if(validTime)previousTime=previousTime===null?now:Math.max(previousTime,now);
      const currentLines=Number.isInteger(lines)&&lines>=0?lines:0;
      const currentCombo=Number.isFinite(combo)?Math.max(0,combo):0;
      const cleared=previousLines===null||currentLines<previousLines?0:currentLines-previousLines;
      const comboRise=currentCombo>=4&&currentCombo>previousCombo;
      previousLines=currentLines;previousCombo=currentCombo;
      if(reducedMotion){pending=null;state.phase='still';return state;}
      state.phase=portalProgress<1?'portal':'ambient';
      const targetBpm=Number.isFinite(bpm)&&bpm>=60&&bpm<=200?bpm:120;
      state.bpm+=(targetBpm-state.bpm)*(1-Math.exp(-dt/1));
      const targetSpeed=(8+state.bpm/30)*(1+Math.min(8,currentCombo)*.04);
      state.speed+=(targetSpeed-state.speed)*(1-Math.exp(-dt/.6));
      state.distance+=state.speed*dt;beats+=state.bpm/60*dt;
      // Beats and clears move geometry, never flash its brightness. Danger
      // slowly dims it. Final rendered luminance still requires image review.
      state.brightness+=(.18*(1-unit(danger)*.4)-state.brightness)*(1-Math.exp(-dt/.8));
      if(cleared>=4)pending='halving';else if(comboRise&&pending!=='halving')pending='combo';
      if(portalProgress<1){portalProgress=Math.min(1,portalProgress+dt*state.bpm/60/4);state.mix=smooth(portalProgress);state.portalRadius=.06+3.5*state.mix*state.mix;if(portalProgress===1)state.phase='ambient';}
      // Four-beat portal duration and four-beat hold prevent repeated events
      // from interrupting a transition. Automatic cycling needs no gameplay.
      if(portalProgress===1&&beats-changedAtBeat>=4){if(pending)go(pending);else if(beats-changedAtBeat>=64)go('beats');}
      state.scene=state.mix>=.5?state.to:state.from;
      return state;
    },
  };
}
