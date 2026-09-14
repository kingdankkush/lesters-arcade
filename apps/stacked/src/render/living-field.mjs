// Bounded render-only particle field. Never reads or advances the game's RNG.
const CAPACITY = 192;
const BURST_MS = 360;
const REFORM_MS = 1640;
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
const hash = n => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
const mix = (a, b, t) => a + (b - a) * t;

export function createLivingField() {
  const x = new Float32Array(CAPACITY), y = new Float32Array(CAPACITY);
  const fromX = new Float32Array(CAPACITY), fromY = new Float32Array(CAPACITY);
  const scatterX = new Float32Array(CAPACITY), scatterY = new Float32Array(CAPACITY);
  const connected = new Uint8Array(CAPACITY);
  const state = { x, y, connected, count: 0, pointsPerOrganism: 48, organisms: 4, phase: 'swimming', generation: 0, intensity: 0, cohesion: 1 };
  let lastLines = null, eventAt = -10000, initialized = false, lastWidth = 0, lastHeight = 0, wasReduced = false;
  return {
    update({ now, width, height, lines = 0, reducedMotion = false, reducedEffects = false, level = 0, bass = 0, high = 0 }) {
      const minimal = reducedEffects || reducedMotion;
      const count = minimal ? 72 : CAPACITY;
      if (state.count !== count || width !== lastWidth || height !== lastHeight || wasReduced !== reducedMotion) initialized = false;
      lastWidth = width; lastHeight = height; wasReduced = reducedMotion;
      state.count = count; state.organisms = minimal ? 3 : 4; state.pointsPerOrganism = minimal ? 24 : 48;
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
      const time = reducedMotion ? 0 : now * 0.001;
      const energy = reducedMotion ? 0 : Math.max(0, Math.min(1, bass));
      for (let i = 0; i < count; i++) {
        const organism = Math.floor(i / state.pointsPerOrganism);
        const seed = organism * 19 + state.generation * 7;
        const u = (i % state.pointsPerOrganism) / (state.pointsPerOrganism - 1);
        const phase = time * (0.7 + energy * 0.35) + organism * 2.1;
        const radius = Math.min(width * 0.16, height * 0.14) * (0.78 + hash(seed) * 0.2) * (1 + energy * 0.16);
        const side = organism % 2 ? 1 : -1;
        const cx = side * width * ((width < height ? 0.39 : 0.31) + Math.sin(time * 0.18 + organism) * (reducedMotion ? 0 : 0.035));
        const cy = (Math.floor(organism / 2) ? 1 : -1) * height * 0.24 + Math.sin(time * 0.24 + organism) * (reducedMotion ? 0 : height * 0.04);
        const species = (state.generation + organism) % 3;
        const index = i % state.pointsPerOrganism;
        connected[i] = index !== 0 && (species !== 0 || index < state.pointsPerOrganism / 2 || index % (state.pointsPerOrganism / 6) !== 0) ? 1 : 0;
        let px, py;
        if (species === 0) {
          // Medusa: contracting bell followed by three independently waving tendrils.
          if (u < 0.5) {
            const angle = u * 2 * Math.PI;
            px = Math.cos(angle) * radius;
            py = -Math.sin(angle) * radius * (0.52 + Math.sin(phase) * 0.08);
          } else {
            const strand = Math.min(2, Math.floor((u - 0.5) * 6));
            const v = Math.min(1, (u - 0.5) * 6 - strand);
            px = (strand - 1) * radius * 0.48 + Math.sin(v * 5 - phase * 1.8 + strand) * radius * 0.18 * v;
            py = v * radius * (1.3 + energy * 0.18);
          }
        } else if (species === 1) {
          // Ribbon swimmer: a looping body with a traveling lateral wave.
          const angle = u * Math.PI * 2;
          px = Math.cos(angle) * radius;
          py = Math.sin(angle) * radius * (0.30 + 0.16 * Math.cos(angle))
            + Math.sin(u * 9 - phase * 2) * radius * (0.10 + energy * 0.05);
        } else {
          // Living rosette: a soft cellular membrane, never a rigid spinning gear.
          const angle = u * Math.PI * 2;
          const membrane = 0.75 + 0.15 * Math.sin(angle * 3 + phase) + 0.08 * Math.cos(angle * 5 - phase * 0.6);
          px = Math.cos(angle) * radius * membrane;
          py = Math.sin(angle) * radius * membrane * 1.08;
        }
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
