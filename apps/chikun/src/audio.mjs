const BASE='/assets/generated/chikun-flight-v2/audio/';
const CUES=['flap','launch','coin','near','pass','streak','impact'];
export function createChikunAudio() {
  const encoded=new Map(),buffers=new Map(),voices=new Set();let context=null,master=null,closed=false,enabled=true,volume=1;
  function syncMaster(){if(!master||!context)return;const value=enabled?.65*volume:0;master.gain.cancelScheduledValues?.(context.currentTime);if(master.gain.setValueAtTime)master.gain.setValueAtTime(value,context.currentTime);else master.gain.value=value;}
  const loaded=Promise.allSettled(CUES.map(async name=>{try{const r=await fetch(BASE+name+'.wav');if(r.ok)encoded.set(name,await r.arrayBuffer());}catch{/* Optional sound. */}}));
  async function unlock(){
    if(closed)return;
    try{
      const Ctor=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Ctor)return;
      if(!context){context=new Ctor();master=context.createGain();syncMaster();master.connect(context.destination);}
      await context.resume();await loaded;
      for(const [name,bytes] of encoded)if(!buffers.has(name)){try{buffers.set(name,await context.decodeAudioData(bytes.slice(0)));}catch{/* Keep other cues playable. */}}
    }catch{/* Browser audio permission remains optional. */}
  }
  function play(name,{volume=1,pitch=1}={}) {
    if(closed||!enabled||volume===0||!context||!buffers.has(name)||voices.size>=8)return false;
    const src=context.createBufferSource(),gain=context.createGain();src.buffer=buffers.get(name);src.playbackRate.value=pitch;gain.gain.value=volume;src.connect(gain).connect(master);voices.add(src);
    src.onended=()=>{voices.delete(src);src.disconnect();gain.disconnect();};src.start();return true;
  }
  return {
    unlock,play,
    // Preserve only the cabinet's existing fallback tones. They share the same
    // eight-voice cap and master as decoded cues, so mute also silences tails.
    playLegacyTone(frequency,duration=.08,gainValue=.035,type='triangle',pitch=1){
      if(closed||!enabled||volume===0||!context||!master||voices.size>=8)return false;
      let oscillator,gain;
      try{
        oscillator=context.createOscillator();gain=context.createGain();oscillator.type=type;oscillator.frequency.value=frequency*pitch;
        gain.gain.setValueAtTime(gainValue,context.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+duration);oscillator.connect(gain).connect(master);
        oscillator.addEventListener('ended',()=>{voices.delete(oscillator);try{oscillator.disconnect();gain.disconnect();}catch{}},{once:true});oscillator.start();voices.add(oscillator);oscillator.stop(context.currentTime+duration);return true;
      }catch{voices.delete(oscillator);try{oscillator?.disconnect();gain?.disconnect();}catch{}return false;}
    },
    setEnabled(value){enabled=Boolean(value);syncMaster();},
    setVolume(value){const n=Number(value);volume=Number.isFinite(n)?Math.max(0,Math.min(1,n)):1;syncMaster();},
    // Kept as a compatibility seam for the render loop; flight atmosphere is
    // intentionally silent so the old repeating white-noise cue cannot return.
    ambience(){},
    dispose(){closed=true;for(const v of voices){try{v.stop();}catch{}}voices.clear();context?.close();context=null;encoded.clear();buffers.clear();}
  };
}
