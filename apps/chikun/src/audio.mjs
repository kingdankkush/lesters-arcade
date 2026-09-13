const BASE='/assets/generated/chikun-flight-v1/audio/';
const CUES=['flap','launch','coin','near','pass','streak','impact','air'];
export function createChikunAudio() {
  const encoded=new Map(),buffers=new Map(),voices=new Set();let context=null,master=null,wind=null,closed=false,enabled=true;
  const loaded=Promise.allSettled(CUES.map(async name=>{try{const r=await fetch(BASE+name+'.wav');if(r.ok)encoded.set(name,await r.arrayBuffer());}catch{/* Optional sound. */}}));
  async function unlock(){
    if(closed)return;
    try{
      const Ctor=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Ctor)return;
      if(!context){context=new Ctor();master=context.createGain();master.gain.value=enabled?.65:0;master.connect(context.destination);}
      await context.resume();await loaded;
      for(const [name,bytes] of encoded)if(!buffers.has(name)){try{buffers.set(name,await context.decodeAudioData(bytes.slice(0)));}catch{/* Keep other cues playable. */}}
    }catch{/* Browser audio permission remains optional. */}
  }
  function play(name,{volume=1,pitch=1}={}) {
    if(closed||!enabled||!context||!buffers.has(name)||voices.size>=8)return false;
    const src=context.createBufferSource(),gain=context.createGain();src.buffer=buffers.get(name);src.playbackRate.value=pitch;gain.gain.value=volume;src.connect(gain).connect(master);voices.add(src);
    src.onended=()=>{voices.delete(src);src.disconnect();gain.disconnect();};src.start();return true;
  }
  return {
    unlock,play,
    setEnabled(value){enabled=Boolean(value);if(master&&context)master.gain.setTargetAtTime(enabled?.65:0,context.currentTime,.03);},
    ambience(running){
      if(closed||!context)return;
      if(!running){if(wind){wind.stop();wind.disconnect();wind=null;}return;}
      if(!wind&&buffers.has('air')){wind=context.createBufferSource();wind.buffer=buffers.get('air');wind.loop=true;wind.connect(master);wind.start();}
    },
    dispose(){closed=true;wind?.stop();wind=null;for(const v of voices){try{v.stop();}catch{}}voices.clear();context?.close();context=null;encoded.clear();buffers.clear();}
  };
}
