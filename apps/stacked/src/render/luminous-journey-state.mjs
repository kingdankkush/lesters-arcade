// Presentation clock and envelopes only. Never reads a board, seed or run RNG.
import {createLivingJourney,LIVING_JOURNEY_SCENES} from './living-journey.mjs';
const clamp=(value,low=0,high=1)=>Number.isFinite(value)?Math.max(low,Math.min(high,value)):low;
export function createLuminousJourneyState(){
  const journey=createLivingJourney();
  const frame={time:0,distance:0,phase:0,from:0,to:0,mix:1,bass:0,high:0,energy:0,beat:0,aspect:1,visible:true,transitions:0,mode:'living',available:false};
  let previous=null,audioFrame=null,audioAt=-Infinity;
  return {frame,journey,
    audio(value,now){audioFrame=value;audioAt=now;},
    nextScene(){journey.nextScene();},
    update({now,lines=0,width=1,height=1,settings,feedback}={}){
      const dt=previous===null?0:clamp((now-previous)/1000,0,.1);
      if(Number.isFinite(now))previous=previous===null?now:Math.max(previous,now);
      const reduced=settings?.accessibility?.reduceMotion===true;
      const available=!!(settings?.video?.audioReactive&&audioFrame?.available&&now>=audioAt&&now-audioAt<500);
      const state=journey.update({now,lines,combo:feedback?.combo,danger:feedback?.danger,reducedMotion:reduced,bpm:available?audioFrame.bpm/10:120});
      frame.aspect=clamp(width/(Number.isFinite(height)&&height>0?height:1),.2,5);
      frame.visible=clamp(settings?.video?.effectsIntensity)>0;
      if(!reduced){frame.time+=dt;frame.distance=state.distance*.06;frame.phase+=dt*.15;}
      const fixed=settings?.video?.visualizer;
      frame.mode=fixed&&fixed!=='journey'?fixed:state.scene;
      frame.from=Math.max(0,LIVING_JOURNEY_SCENES.indexOf(fixed&&fixed!=='journey'?fixed:state.from));
      frame.to=Math.max(0,LIVING_JOURNEY_SCENES.indexOf(fixed&&fixed!=='journey'?fixed:state.to));
      frame.mix=fixed&&fixed!=='journey'?1:state.mix;
      frame.transitions=state.transitionCount;frame.available=available;
      for(const [key,target]of [['bass',audioFrame?.bass],['high',audioFrame?.high],['energy',audioFrame?.level]]){
        const wanted=reduced?0:available?clamp(target/1000):key==='energy'?.07:0;
        frame[key]=reduced?0:frame[key]+(wanted-frame[key])*(1-Math.exp(-dt/.3));
      }
      // No beat-luminance jump under reduced flash. Geometry still follows bass.
      frame.beat=reduced||settings?.accessibility?.reduceFlash?0:clamp(frame.bass*.2,0,.15);
      if(settings?.accessibility?.reduceFlash)frame.energy=Math.min(.3,frame.energy);
      return frame;
    }
  };
}
