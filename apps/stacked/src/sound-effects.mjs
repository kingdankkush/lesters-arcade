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
// Two-primitive synth kit (1.9.0 sound pass), zero asset bytes: a tone
// (oscillator) and filtered noise (one shared buffer through a biquad), mixed
// through one master DynamicsCompressor so stacked cues never clip. A cue is
// [notes, duration, cooldown, priority, wave, glide, noise], where noise is
// [filterType, hz, q, duration, level] or null. Lock, clear, combo and
// HALVING each get their own noise colour; clears climb a semitone per combo
// step. The one Game sounds slider scales every voice.
const CUES=Object.freeze({
  move:[[240],.035,.08,0,'triangle',1.02,null],soft:[[165],.035,.10,0,'triangle',1.02,null],
  rotate:[[420,560],.06,.07,1,'triangle',1.02,['highpass',5200,.7,.03,.18]],
  hold:[[330,495],.1,.1,1,'triangle',1.02,['bandpass',2400,1.2,.08,.2]],
  lock:[[130],.07,.06,1,'triangle',.7,['lowpass',900,.9,.06,.55]],
  drop:[[90,180],.13,.06,2,'triangle',.35,['lowpass',1600,1.4,.1,.8]],
  single:[[523,659],.18,.12,3,'sine',1.02,['highpass',4200,.8,.12,.16]],
  double:[[587,740],.2,.12,3,'sine',1.02,['highpass',4200,.8,.14,.2]],
  triple:[[659,880],.23,.12,3,'sine',1.02,['highpass',4200,.8,.16,.24]],
  combo:[[698,1047],.22,.12,3,'sine',1.02,['bandpass',3200,2,.14,.24]],
  halving:[[523,784,1047,65],.32,.18,4,'sine',1.02,['bandpass',900,1.6,.34,.6]],
  perfect:[[659,988,1318],.4,.2,4,'sine',1.02,['highpass',6000,.7,.3,.22]],
  level:[[440,660,880],.25,.2,3,'sine',1.02,null],
  ledger:[[196,147],.2,.2,2,'triangle',1.02,['lowpass',320,1,.22,.7]],
  terminal:[[220,165,110],.45,.5,4,'sine',.65,['lowpass',600,.8,.5,.5]],
  menu:[[440],.06,.12,1,'triangle',1.02,null],
});
const CLIMBS=new Set(['single','double','triple','combo']);
export const STACKED_SFX_COMPRESSOR=Object.freeze({threshold:-16,knee:10,ratio:3.5,attack:.003,release:.22});
export const stackedSfxTimbre=cue=>CUES[cue]?Object.freeze({wave:CUES[cue][4],noise:CUES[cue][6]?.[0]??null,noiseHz:CUES[cue][6]?.[1]??0}):null;
export const stackedSfxPitch=(cue,combo=0)=>CLIMBS.has(cue)?2**(Math.max(0,Math.min(10,Number(combo)||0))/12):1;
export function createStackedSoundEffects({contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)()}={}) {
  let context=null,master=null,noiseBuffer=null,disposed=false; const voices=new Set(),lastCue=new Map();
  const release=voice=>{ if(!voices.delete(voice))return; voice.src.onended=null; try {voice.src.stop();}catch{} for(const node of voice.nodes) node.disconnect(); };
  const stop=()=>{ for(const voice of [...voices]) release(voice); };
  // Master bus: the compressor where the context has one, else straight out.
  const bus=()=>{
    if(master)return master;
    if(typeof context.createDynamicsCompressor!=='function')return context.destination;
    master=context.createDynamicsCompressor();
    for(const [key,value] of Object.entries(STACKED_SFX_COMPRESSOR)) master[key].setValueAtTime(value,context.currentTime);
    master.connect(context.destination);
    return master;
  };
  const noise=()=>{
    if(noiseBuffer||typeof context.createBuffer!=='function')return noiseBuffer;
    const length=Math.round(context.sampleRate*.5); noiseBuffer=context.createBuffer(1,length,context.sampleRate);
    // Fixed LCG white noise: the same buffer every session.
    const data=noiseBuffer.getChannelData(0); let seed=0x2f6b1d;
    for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
    return noiseBuffer;
  };
  const admit=priority=>{
    if(voices.size<8)return true;
    const quiet=[...voices].find(voice=>voice.priority<priority);
    if(!quiet)return false; release(quiet); return true;
  };
  const envelope=(gain,now,start,peak,duration)=>{
    gain.gain.setValueAtTime(.0001,now); gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,peak),start+.005);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  };
  const tone=(frequency,start,now,duration,peak,wave,glide,priority)=>{
    if(!admit(priority))return;
    const osc=context.createOscillator(),gain=context.createGain(),voice={src:osc,nodes:[osc,gain],priority}; voices.add(voice);
    osc.type=wave; osc.frequency.setValueAtTime(frequency,start);
    osc.frequency.exponentialRampToValueAtTime(frequency*glide,start+duration);
    envelope(gain,now,start,peak,duration);
    osc.connect(gain); gain.connect(bus()); osc.onended=()=>release(voice); osc.start(start); osc.stop(start+duration+.01);
  };
  const filtered=([type,hz,q,duration,level],now,peak,priority)=>{
    if(typeof context.createBufferSource!=='function'||typeof context.createBiquadFilter!=='function'||!noise()||!admit(priority))return;
    const src=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),voice={src,nodes:[src,filter,gain],priority}; voices.add(voice);
    src.buffer=noiseBuffer; filter.type=type; filter.frequency.setValueAtTime(hz,now); filter.Q.setValueAtTime(q,now);
    envelope(gain,now,now,peak*level,duration);
    src.connect(filter); filter.connect(gain); gain.connect(bus()); src.onended=()=>release(voice); src.start(now); src.stop(now+duration+.01);
  };
  return {
    play(cue,settings,combo=0) {
      if(disposed||!settings?.audio.sfxEnabled||settings.audio.sfxVolume<=0||!CUES[cue])return;
      try {
        context??=contextFactory(); void context.resume()?.catch?.(()=>{});
        if(context.state!=='running')return;
        const [notes,duration,cooldown,priority,wave,glide,burst]=CUES[cue],now=context.currentTime;
        if(now-(lastCue.get(cue)??-100)<cooldown)return;
        lastCue.set(cue,now);
        const volume=Math.min(1,settings.audio.sfxVolume)*.09,pitch=stackedSfxPitch(cue,combo);
        if(burst)filtered(burst,now,volume,priority);
        notes.forEach((frequency,index)=>tone(frequency*pitch,now+index*.024,now,duration,volume/Math.sqrt(notes.length),frequency<100?'sine':wave,glide,priority));
      }catch { /* Sound failure cannot interrupt a game or its evidence. */ }
    },
    stop,
    get activeVoices(){return voices.size;},
    destroy(){if(disposed)return;disposed=true;stop();master?.disconnect();master=null;void context?.close()?.catch?.(()=>{});context=null;},
  };
}
