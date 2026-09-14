import { aquaticPoint, AQUATIC_SPECIES } from './aquatic-forms.mjs';
export { AQUATIC_SPECIES };
export const LIVING_FIELD_CAPACITY = 648;
// Bounded render-only particle field. Never reads or advances the game's RNG.
const CAPACITY = LIVING_FIELD_CAPACITY;
const BURST_MS = 360;
const REFORM_MS = 1640;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
const hash = n => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
const mix = (a, b, t) => a + (b - a) * t;

export function createLivingField({mobile=false}={}) {
  const x = new Float32Array(CAPACITY), y = new Float32Array(CAPACITY);
  const fromX = new Float32Array(CAPACITY), fromY = new Float32Array(CAPACITY);
  const scatterX = new Float32Array(CAPACITY), scatterY = new Float32Array(CAPACITY);
  const connected = new Uint8Array(CAPACITY);
  const state = { x, y, connected, count: 0, pointsPerOrganism: 48, organisms: 4, phase: 'swimming', generation: 0, intensity: 0, cohesion: 1 };
  let lastLines = null, eventAt = -10000, initialized = false, lastWidth = 0, lastHeight = 0, wasReduced = false;
  const point={x:0,y:0,connected:0};
  let lastNow=null,swimTime=0;
  return {
    update({ now, width, height, lines = 0, reducedMotion = false, reducedEffects = false, level = 0, bass = 0, high = 0, beat = 0 }) {
      const minimal = reducedEffects || reducedMotion;
      const count = minimal ? 72 : mobile ? 432 : CAPACITY;
      if (state.count !== count || width !== lastWidth || height !== lastHeight || wasReduced !== reducedMotion) initialized = false;
      lastWidth = width; lastHeight = height; wasReduced = reducedMotion;
      state.count = count; state.organisms = minimal ? 3 : 9; state.pointsPerOrganism = minimal ? 24 : mobile ? 48 : 72;
      if (lastLines !== null && lines > lastLines) {
        state.generation++;
        state.intensity = Math.min(4, lines - lastLines);
        eventAt = now;
        for (let i = 0; i < count; i++) {
          fromX[i] = x[i]; fromY[i] = y[i];
          const angle = hash(i + state.generation * 211) * Math.PI * 2;
          const distance = (38 + state.intensity * 19) * (0.5 + hash(i * 3 + 17));
          scatterX[i] = clamp(x[i] + Math.cos(angle) * distance, width * 0.48);
          scatterY[i] = clamp(y[i] + Math.sin(angle) * distance, height * 0.48);
        }
      }
      lastLines = lines;
      if (!initialized || reducedMotion) eventAt = -10000;
      const elapsed = now - eventAt;
      state.phase = reducedMotion ? 'still' : !initialized || elapsed >= BURST_MS + REFORM_MS ? 'swimming' : elapsed < BURST_MS ? 'burst' : 'reforming';
      const burst = 1 - (1 - Math.min(1, Math.max(0, elapsed / BURST_MS))) ** 3;
      const reform = (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, (elapsed - BURST_MS) / REFORM_MS)))) / 2;
      state.cohesion = state.phase === 'burst' ? Math.max(0, 1 - burst * 3) : state.phase === 'reforming' ? Math.max(0, (reform - 0.45) / 0.55) : 1;
      const dt=lastNow===null?0:Math.max(0,Math.min(.1,(now-lastNow)/1000));lastNow=now;
      if(!reducedMotion)swimTime+=dt*(.65+Math.max(0,Math.min(1,level))*.35+beat*.4);
      const time = reducedMotion ? 0 : swimTime;
      const energy = reducedMotion ? 0 : Math.max(0, Math.min(1, bass));
      for (let i = 0; i < count; i++) {
        const organism = Math.floor(i / state.pointsPerOrganism);
        const seed = organism * 19 + state.generation * 7;
        const phase = time + organism * 2.1;
        const radius = Math.min(width * (mobile?.14:.105), height * .095) * (0.8 + hash(seed) * .2) * (1 + energy * .12);
        const side = organism % 2 ? 1 : -1;
        const cx = side * width * ((width < height ? .40 : .34) + Math.sin(time * .3 + organism) * (reducedMotion ? 0 : .025));
        const cy = (Math.floor(organism/2)/Math.max(1,Math.ceil(state.organisms/2)-1)-.5)*height*.72 + Math.sin(time*.6+organism)*(reducedMotion?0:height*.025);
        const species=(state.generation+organism)%AQUATIC_SPECIES.length;
        aquaticPoint(species,i%state.pointsPerOrganism,state.pointsPerOrganism,phase,reducedMotion?0:energy*.7+beat*.3,point);
        connected[i]=point.connected;
        const px=point.x*radius,py=point.y*radius;
        const tilt = side * (0.18 + Math.sin(time * 0.28 + organism) * (reducedMotion ? 0 : 0.18));
        const targetX = clamp(cx + px * Math.cos(tilt) - py * Math.sin(tilt), width * 0.48);
        const targetY = clamp(cy + px * Math.sin(tilt) + py * Math.cos(tilt), height * 0.48);
        if (state.phase === 'burst') {
          x[i] = mix(fromX[i], scatterX[i], burst); y[i] = mix(fromY[i], scatterY[i], burst);
        } else if (state.phase === 'reforming') {
          x[i] = mix(scatterX[i], targetX, reform); y[i] = mix(scatterY[i], targetY, reform);
        } else { x[i] = targetX; y[i] = targetY; }
      }
      initialized = true;
      return state;
    },
  };
}
