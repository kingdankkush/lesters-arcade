import {createStackedSoundEffects, stackedSoundForStep} from './sound-effects.mjs';

// Read-only feedback for the two local boards. The existing synth owns one
// compressed, eight-voice mix; simultaneous identical cues share its cooldown.
export function createLocalStackedAudio({sound=createStackedSoundEffects(),volume=.35}={}) {
  let previous=null,disposed=false;
  const settings={audio:{sfxEnabled:false,sfxVolume:0}};
  const safe=fn=>{try{fn();}catch{/* Audio failure must never interrupt the match. */}};
  const stop=()=>{if(!disposed)safe(()=>sound.stop());};
  const setVolume=value=>{
    if(disposed)return;
    settings.audio.sfxVolume=typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
    settings.audio.sfxEnabled=settings.audio.sfxVolume>0;
    if(!settings.audio.sfxEnabled)stop();
  };
  // Initial mute does not need a device or a stop call.
  settings.audio.sfxVolume=typeof volume==='number'&&Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0;
  settings.audio.sfxEnabled=settings.audio.sfxVolume>0;
  const play=(cue,combo=0)=>{if(!disposed&&settings.audio.sfxEnabled&&cue)safe(()=>sound.play(cue,settings,combo));};
  return Object.freeze({
    present(state){
      if(disposed)return;
      const before=previous;previous=state.match;
      if(!before||previous.tick<=before.tick||!['running','complete'].includes(state.phase))return;
      previous.boards.forEach((board,i)=>play(stackedSoundForStep(before.boards[i],board),board.comboCount));
    },
    unlock(){play('menu');},setVolume,stop,
    reset(){if(disposed)return;stop();previous=null;},
    destroy(){if(disposed)return;disposed=true;previous=null;safe(()=>sound.destroy());},
  });
}
