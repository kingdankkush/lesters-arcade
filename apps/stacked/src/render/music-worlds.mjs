const CAPACITY = 192;
const clamp = (n, extent) => Math.max(-extent, Math.min(extent, n));
const unit = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export const MUSIC_WORLD_NAMES = Object.freeze({ living:'Living field', aurora:'Aurora', orbit:'Orbit', spectrum:'Spectrum' });
export const JOURNEY_WORLDS = Object.freeze(['living','aurora','spectrum','orbit','orbit','aurora']);

// Fixed-size geometry, shared by the three new worlds. Coordinates live behind
// the opaque board; no emitters, timers, textures or event lists can accumulate.
export function createMusicWorld() {
  const state = { x:new Float32Array(CAPACITY), y:new Float32Array(CAPACITY), connected:new Uint8Array(CAPACITY), weight:new Float32Array(CAPACITY), count:0 };
  return {
    update({ mode, time=0, width, height, minimal=false, reducedMotion=false, bass=0, high=0, level=0, beat=0, clear=0, impact=0, combo=0, danger=0, generation=0 }) {
      const count = minimal || reducedMotion ? 72 : CAPACITY;
      state.count=count;
      const t=reducedMotion?0:time, b=reducedMotion?0:unit(bass), h=reducedMotion?0:unit(high);
      const pulse=reducedMotion?0:unit(beat)*.12+unit(clear)*.26+unit(impact)*.06;
      const spread=Math.min(width*.19,height*.2), comboLift=Math.min(8,Math.max(0,combo))*.012;
      for(let i=0;i<count;i++) {
        const side=i<count/2?-1:1;
        let x,y,connected=1,weight=1;
        if(mode==='aurora') {
          const strands=6, per=count/strands, strand=Math.floor(i/per), u=(i%per)/(per-1);
          const s=strand<3?-1:1, band=strand%3;
          const sway=Math.sin(u*5.3+t*.4+band*.8+generation*.5);
          x=s*width*(width<height?.42:.34)+s*(band-1)*spread*.28+sway*spread*(.3+b*.22+pulse);
          y=(u-.5)*height*.9+Math.sin(u*9-t*.7+band)*spread*(.13+h*.13);
          connected=i%per!==0; weight=.65+Math.sin(u*Math.PI)*.7+band*.18;
        } else if(mode==='orbit') {
          const rings=6, per=count/rings, ring=Math.floor(i/per), u=(i%per)/(per-1), s=ring<3?-1:1;
          const a=u*Math.PI*2+t*(.12+(ring%3)*.035)*(ring%2?-1:1)+generation*.38;
          const radius=spread*(.52+(ring%3)*.24)*(1+b*.12+pulse+comboLift);
          const tilt=(ring%3)*.85+Math.sin(t*.15+ring)*.16;
          const px=Math.cos(a)*radius, py=Math.sin(a)*radius*.42;
          x=s*width*(width<height?.4:.33)+px*Math.cos(tilt)-py*Math.sin(tilt);
          y=Math.sin(t*.17+ring)*height*.06+px*Math.sin(tilt)+py*Math.cos(tilt);
          connected=i%per!==0; weight=.5+(Math.sin(a)+1)*.55;
        } else {
          // Paired segments form equalizer towers; lows spread below, highs above.
          const per=count/2, local=i%per, bar=Math.floor(local/2), u=bar/(per/2-1);
          const band=b*(1-u)+h*u;
          const wave=.5+.5*Math.sin(u*17+t*(1.2+band)+generation*.7);
          const length=spread*(.18+band*.65+wave*.28+pulse+comboLift);
          x=side*(width*(width<height?.48:.47)-(local%2?length:0));
          y=(.5-u)*height*.8+Math.sin(t*.25)*height*.025;
          connected=local%2===1; weight=.7+band*.8+wave*.4;
        }
        state.x[i]=clamp(x,width*.49); state.y[i]=clamp(y,height*.49);
        state.connected[i]=connected?1:0; state.weight[i]=weight;
      }
      return state;
    },
  };
}
