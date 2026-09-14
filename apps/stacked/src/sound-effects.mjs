export function stackedSoundForStep(before, after) {
  if(after.terminal&&!before.terminal) return 'terminal';
  if(after.perfectClears>before.perfectClears) return 'perfect';
  const lines=after.lines-before.lines;
  if(lines>0) return lines>=4?'halving':after.comboCount>1?'combo':['','single','double','triple'][lines];
  if(after.level>before.level) return 'level';
  if(after.garbageRowsReceived>before.garbageRowsReceived) return 'ledger';
  if(after.piecesLocked>before.piecesLocked) return after.hardDropCells>before.hardDropCells?'drop':'lock';
  if(after.holdsUsed>before.holdsUsed) return 'hold';
  if(before.active&&after.active&&before.active.kind===after.active.kind) {
    if(before.active.rotation!==after.active.rotation) return 'rotate';
    if(before.active.x!==after.active.x) return 'move';
    if(after.softDropCells>before.softDropCells) return 'soft';
  }
  return null;
}
const CUES=Object.freeze({
  move:[[240],.035,.08,0],soft:[[165],.035,.10,0],rotate:[[420,560],.06,.07,1],hold:[[330,495],.1,.1,1],
  drop:[[90,180],.13,.06,2],lock:[[130],.07,.06,1],single:[[523,659],.18,.12,3],double:[[587,740],.2,.12,3],
  triple:[[659,880],.23,.12,3],halving:[[523,784,1047],.32,.18,4],combo:[[698,1047],.22,.12,3],
  perfect:[[659,988,1318],.4,.2,4],level:[[440,660,880],.25,.2,3],ledger:[[196,147],.2,.2,2],
  terminal:[[220,165,110],.45,.5,4],menu:[[440],.06,.12,1],
});
export function createStackedSoundEffects({contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)()}={}) {
  let context=null,disposed=false; const voices=new Set(),lastCue=new Map();
  const release=voice=>{ if(!voices.delete(voice))return; voice.osc.onended=null; try {voice.osc.stop();}catch{} voice.osc.disconnect(); voice.gain.disconnect(); };
  const stop=()=>{ for(const voice of [...voices]) release(voice); };
  return {
    play(cue,settings) {
      if(disposed||!settings?.audio.sfxEnabled||settings.audio.sfxVolume<=0||!CUES[cue])return;
      try {
        context??=contextFactory(); void context.resume()?.catch?.(()=>{});
        if(context.state!=='running')return;
        const [notes,duration,cooldown,priority]=CUES[cue],now=context.currentTime;
        if(now-(lastCue.get(cue)??-100)<cooldown)return;
        lastCue.set(cue,now);
        notes.forEach((frequency,index)=>{
          if(voices.size>=8) {
            const quiet=[...voices].find(voice=>voice.priority<priority);
            if(!quiet)return; release(quiet);
          }
          const osc=context.createOscillator(),gain=context.createGain(),start=now+index*.024;
          const voice={osc,gain,priority}; voices.add(voice);
          osc.type=priority>=3?'sine':'triangle'; osc.frequency.setValueAtTime(frequency,start);
          osc.frequency.exponentialRampToValueAtTime(frequency*(cue==='drop'?.35:cue==='terminal'?.65:1.02),start+duration);
          gain.gain.setValueAtTime(.0001,now); gain.gain.setValueAtTime(.0001,start);
          gain.gain.exponentialRampToValueAtTime(Math.max(.0001,Math.min(1,settings.audio.sfxVolume)*.09/Math.sqrt(notes.length)),start+.005);
          gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
          osc.connect(gain); gain.connect(context.destination); osc.onended=()=>release(voice); osc.start(start); osc.stop(start+duration+.01);
        });
      }catch { /* Sound failure cannot interrupt a game or its evidence. */ }
    },
    stop,
    get activeVoices(){return voices.size;},
    destroy(){if(disposed)return;disposed=true;stop();void context?.close()?.catch?.(()=>{});context=null;},
  };
}
