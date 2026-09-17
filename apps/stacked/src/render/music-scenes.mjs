// Music scene deck (owner direction 2026-09-16): three distinct audio-reactive
// looks that crossfade as the music moves between sections. Presentation only:
// it reads the envelopes the atmosphere already computed and never touches the
// simulation, scoring or the game RNG.
//
//   tunnel    Energy tunnel. Polygon rings fly out of a vanishing point behind
//             the board; level sets the flight speed, beats twist and swell the
//             rings, bass stretches the spokes.
//   particles Particle drift. A radial star field streams outward; energy
//             lengthens the streaks, beats swell the motes, highs brighten.
//   horizon   Synthwave horizon. A perspective grid scrolls toward the viewer at
//             the music's pace under a striped sun that breathes with the bass
//             while the stars twinkle with the highs.
//
// Budget rules: every pool is sized once from SCENE_POOLS, shared Graphics
// contexts are cloned at construction, and draw() only writes transforms,
// tint and alpha. Flash rules (visuals §7.2): normal blend everywhere, alpha
// follows the slow level envelope and the static SCENE_CEILINGS; beat, bass
// and high only move, rotate or scale. reduceMotion arrives as time = beat =
// bands = 0 and turns transitions into instant cuts, so every frame is static.
export const SCENE_ORDER = Object.freeze(['tunnel', 'particles', 'horizon']);
export const SCENE_NAMES = Object.freeze({ tunnel: 'Energy tunnel', particles: 'Particle drift', horizon: 'Synthwave horizon' });
export const SCENE_CHOICES = Object.freeze(['auto', ...SCENE_ORDER, 'off']);
export const SCENE_POOLS = Object.freeze({
  desktop: Object.freeze({ rings: 10, spokes: 16, dots: 160, rows: 14, fans: 14, stars: 40 }),
  mobile: Object.freeze({ rings: 8, spokes: 12, dots: 96, rows: 10, fans: 10, stars: 24 }),
});
export const SCENE_CEILINGS = Object.freeze({ ring: 0.5, spoke: 0.2, dot: 0.7, grid: 0.5, sun: 0.4, star: 0.6 });
export const SECTION_RULES = Object.freeze({ crossfadeSeconds: 1.4, minimumHoldSeconds: 9, energyDelta: 0.16, energyHoldSeconds: 1.2, beatsPerSection: 64, fallbackSeconds: 40 });
const STRIPES = 5;
const POLYGONS = [6, 12];
const unit = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const hash = n => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
const smooth = t => t * t * (3 - 2 * t);
const mixColor = (a, b, t) => [16, 8, 0].reduce((n, shift) => n | Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift, 0);

// Section director: decides which scene shows and drives the crossfade. Pure
// and deterministic for a given signal sequence, so tests can replay it.
export function createSceneDirector() {
  const state = { from: 'tunnel', to: 'tunnel', mix: 1, current: 'tunnel', index: 0, transitions: 0, reason: 'start', slow: 0, fast: 0 };
  let changedAt = 0, beats = 0, driftSince = -1, wasOnBeat = false, previousTime = null;
  const go = (scene, time, reason, instant) => {
    if (scene === state.to) return;
    state.from = state.to; state.to = scene; state.mix = instant ? 1 : 0;
    state.index = SCENE_ORDER.indexOf(scene); state.transitions++; state.reason = reason;
    changedAt = time; beats = 0; driftSince = -1;
  };
  return {
    state,
    next(time = 0, instant = false) { go(SCENE_ORDER[(SCENE_ORDER.indexOf(state.to) + 1) % SCENE_ORDER.length], time, 'manual', instant); },
    update({ mode = 'auto', time = 0, level = 0, beat = 0, cleared = 0, reducedMotion = false }) {
      const dt = previousTime === null ? 0 : Math.max(0, Math.min(0.1, time - previousTime)); previousTime = time;
      if (mode !== 'auto' && mode !== 'off') go(SCENE_ORDER.includes(mode) ? mode : 'tunnel', time, 'chosen', reducedMotion);
      if (mode === 'auto') {
        const l = unit(level);
        state.fast += (l - state.fast) * (1 - Math.exp(-dt / 0.8));
        state.slow += (l - state.slow) * (1 - Math.exp(-dt / 6));
        const onBeat = beat > 0.3; if (onBeat && !wasOnBeat) beats++; wasOnBeat = onBeat;
        const drifted = Math.abs(state.fast - state.slow) > SECTION_RULES.energyDelta;
        if (drifted) { if (driftSince < 0) driftSince = time; } else driftSince = -1;
        const held = time - changedAt;
        if (!reducedMotion && held >= SECTION_RULES.minimumHoldSeconds) {
          const advance = SCENE_ORDER[(state.index + 1) % SCENE_ORDER.length];
          if (cleared >= 4) go(advance, time, 'halving', false);
          else if (drifted && time - driftSince >= SECTION_RULES.energyHoldSeconds) { go(advance, time, 'section', false); state.slow = state.fast; }
          else if (beats >= SECTION_RULES.beatsPerSection) go(advance, time, 'beats', false);
          else if (held >= SECTION_RULES.fallbackSeconds) go(advance, time, 'time', false);
        }
      }
      if (state.mix < 1) state.mix = reducedMotion ? 1 : Math.min(1, state.mix + dt / SECTION_RULES.crossfadeSeconds);
      state.current = state.mix >= 0.5 ? state.to : state.from;
      return state;
    },
  };
}

export function createMusicScenes({ layer, Graphics, mobile = false }) {
  const pool = mobile ? SCENE_POOLS.mobile : SCENE_POOLS.desktop;
  const strand = new Graphics().rect(0, -0.5, 1, 1).fill(0xffffff);
  const dot = new Graphics().circle(0, 0, 1).fill(0xffffff);
  const disc = new Graphics().circle(0, 0, 100).fill(0xffffff);
  const polygons = POLYGONS.map(sides => new Graphics().poly(Array.from({ length: sides * 2 }, (_, k) => (k % 2 ? Math.sin : Math.cos)(Math.floor(k / 2) / sides * Math.PI * 2) * 100), true).stroke({ color: 0xffffff, width: 2.2 }));
  const contexts = [strand, dot, disc, ...polygons].map(owner => owner.context);
  const clones = (source, n, first) => Array.from({ length: n }, (_, i) => (first && i === 0 ? source : source.clone()));
  const rings = Array.from({ length: pool.rings }, (_, k) => (k < 2 ? polygons[k] : polygons[k % 2].clone()));
  const spokes = clones(strand, pool.spokes, true);
  const dots = clones(dot, pool.dots, true);
  const rows = clones(strand, pool.rows, false), fans = clones(strand, pool.fans, false);
  const sun = disc, stripes = clones(strand, STRIPES, false), stars = clones(dot, pool.stars, false);
  const under = [...stars, sun, ...stripes, ...rows, ...fans, ...spokes, ...rings, ...dots];
  for (const node of under) node.visible = false;
  layer?.addChild(...under);
  const director = createSceneDirector();
  const weights = { tunnel: 0, particles: 0, horizon: 0 };
  let lastLines = null;
  const drawTunnel = (w, { time, width, height, level, bass, high, beat, strength, minimal, reduceFlash, palette }) => {
    const spread = Math.min(width, height) * 0.5, phase = time * (0.12 + level * 0.25), cx = 0, cy = -height * 0.04;
    const count = minimal ? Math.ceil(pool.rings / 2) : pool.rings;
    for (let k = 0; k < pool.rings; k++) {
      const ring = rings[k]; ring.visible = w > 0 && k < count; if (!ring.visible) continue;
      const d = (k / count + phase) % 1;
      const radius = spread * (0.12 + d * d * 2.6) * (1 + beat * 0.06);
      ring.position.set(cx + Math.sin(time * 0.3 + d * 4) * spread * 0.05, cy + Math.cos(time * 0.27 + d * 3) * spread * 0.04);
      ring.scale.set(radius / 100); ring.rotation = time * 0.2 * (k % 2 ? -1 : 1) + d * 1.6 + beat * 0.25;
      ring.tint = k % 3 === 0 ? palette.color : k % 3 === 1 ? palette.accent : palette.deep;
      ring.alpha = SCENE_CEILINGS.ring * strength * w * Math.sin(Math.PI * d) * (0.55 + level * 0.45) * (reduceFlash ? 0.75 : 1);
    }
    const spokeCount = minimal ? Math.ceil(pool.spokes / 2) : pool.spokes;
    for (let k = 0; k < pool.spokes; k++) {
      const spoke = spokes[k]; spoke.visible = w > 0 && k < spokeCount; if (!spoke.visible) continue;
      const angle = (k / spokeCount) * Math.PI * 2 + time * 0.08 + beat * 0.1;
      const length = spread * (0.9 + bass * 0.5 + high * 0.2);
      spoke.position.set(cx + Math.cos(angle) * spread * 0.1, cy + Math.sin(angle) * spread * 0.1);
      spoke.scale.set(length, 1.6); spoke.rotation = angle;
      spoke.tint = k % 2 ? palette.deep : palette.accent;
      spoke.alpha = SCENE_CEILINGS.spoke * strength * w * (0.5 + level * 0.5);
    }
  };
  const drawParticles = (w, { time, width, height, level, bass, high, beat, strength, minimal, reduceFlash, palette }) => {
    const spread = Math.min(width, height) * 0.5, count = minimal ? Math.ceil(pool.dots / 2) : pool.dots;
    const speed = 0.06 + level * 0.16 + bass * 0.05;
    for (let i = 0; i < pool.dots; i++) {
      const node = dots[i]; node.visible = w > 0 && i < count; if (!node.visible) continue;
      const angle = hash(i) * Math.PI * 2 + time * 0.03 * (i % 2 ? 1 : -1);
      const d = (hash(i * 7 + 3) + time * speed * (0.6 + hash(i * 3 + 1) * 0.8)) % 1;
      const radius = spread * (0.08 + d * d * 2.5);
      node.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.9 - height * 0.03);
      const size = (1.3 + d * 3.2 + beat * 1.2) * (1 + high * 0.4);
      node.scale.set(size * (1 + (level * 3 + bass) * d * 1.5), size); node.rotation = angle;
      node.tint = i % 5 === 0 ? palette.accent : i % 5 === 1 ? palette.deep : palette.color;
      node.alpha = SCENE_CEILINGS.dot * strength * w * Math.sqrt(Math.sin(Math.PI * d)) * (0.45 + level * 0.55) * (reduceFlash ? 0.75 : 1);
    }
  };
  const drawHorizon = (w, { time, width, height, level, bass, high, beat, strength, minimal, reduceFlash, palette }) => {
    const horizon = height * 0.06, floor = height / 2 - horizon, phase = time * (0.08 + level * 0.22);
    const rowCount = minimal ? Math.ceil(pool.rows / 2) : pool.rows, fanCount = minimal ? Math.ceil(pool.fans / 2) : pool.fans;
    for (let k = 0; k < pool.rows; k++) {
      const row = rows[k]; row.visible = w > 0 && k < rowCount; if (!row.visible) continue;
      const t = (k / rowCount + phase) % 1;
      row.position.set(-width / 2, horizon + floor * t * t); row.scale.set(width, 1.4 + t * 2.2); row.rotation = 0;
      row.tint = k % 2 ? palette.color : palette.accent;
      row.alpha = SCENE_CEILINGS.grid * strength * w * Math.sqrt(t) * (0.55 + level * 0.45);
    }
    for (let k = 0; k < pool.fans; k++) {
      const fan = fans[k]; fan.visible = w > 0 && k < fanCount; if (!fan.visible) continue;
      const u = (k + 0.5) / fanCount - 0.5, x = u * width * 2.4 + Math.sin(time * 0.2 + k) * width * 0.01;
      fan.position.set(0, horizon); fan.scale.set(Math.hypot(x, floor), 1.6); fan.rotation = Math.atan2(floor, x);
      fan.tint = palette.deep;
      fan.alpha = SCENE_CEILINGS.grid * 0.8 * strength * w * (0.6 + level * 0.4);
    }
    const lane = width * (width < height ? 0.34 : 0.3), radius = Math.min(width, height) * 0.17 * (1 + bass * 0.08 + beat * 0.03);
    const sunY = horizon - radius * 0.35 - Math.sin(time * 0.15) * radius * 0.04;
    sun.visible = w > 0; sun.position.set(-lane, sunY); sun.scale.set(radius / 100);
    sun.tint = mixColor(palette.accent, palette.color, 0.35 + high * 0.3);
    sun.alpha = SCENE_CEILINGS.sun * strength * w * (0.7 + level * 0.3) * (reduceFlash ? 0.8 : 1);
    for (let k = 0; k < STRIPES; k++) {
      const stripe = stripes[k]; stripe.visible = w > 0; if (!stripe.visible) continue;
      const t = (k / STRIPES + time * 0.05) % 1, y = sunY + radius * (0.05 + t * 0.9), half = Math.sqrt(Math.max(0, radius * radius - (y - sunY) * (y - sunY)));
      stripe.position.set(-lane - half, y); stripe.scale.set(half * 2, 1.5 + t * radius * 0.08); stripe.rotation = 0;
      stripe.tint = 0x050910; stripe.alpha = w * (0.55 + t * 0.4);
    }
    const starCount = minimal ? Math.ceil(pool.stars / 2) : pool.stars;
    for (let k = 0; k < pool.stars; k++) {
      const star = stars[k]; star.visible = w > 0 && k < starCount; if (!star.visible) continue;
      star.position.set((hash(k * 11 + 5) - 0.5) * width * 0.96, -height / 2 + hash(k * 13 + 9) * (height / 2 + horizon) * 0.9);
      const twinkle = 0.6 + 0.4 * Math.sin(time * (1.5 + hash(k) * 2) + k);
      star.scale.set(1.2 + hash(k * 5) * 1.6 + high * 1.4 + beat * 0.5); star.rotation = 0;
      star.tint = k % 4 ? 0xffffff : palette.accent;
      star.alpha = SCENE_CEILINGS.star * strength * w * (0.5 + level * 0.5) * twinkle;
    }
  };
  const painters = { tunnel: drawTunnel, particles: drawParticles, horizon: drawHorizon };
  return {
    under, pool, director,
    next(time = 0, instant = false) { director.next(time, instant); },
    draw({ mode = 'auto', time = 0, width, height, level = 0, bass = 0, high = 0, beat = 0, lines = 0, intensity = 0.7, fade = 1, minimal = false, reduceFlash = false, reducedMotion = false, palette }) {
      const cleared = lastLines !== null && lines > lastLines ? lines - lastLines : 0; lastLines = lines;
      const s = director.update({ mode, time, level, beat, cleared, reducedMotion });
      // Intensity eases the deck rather than scaling it linearly, so the default 70% still reads; 0 hides it.
      const shown = mode !== 'off' && intensity > 0, strength = shown ? Math.min(1, 0.35 + Math.min(1, intensity) * 0.65) * fade : 0;
      const eased = smooth(s.mix);
      for (const scene of SCENE_ORDER) weights[scene] = !shown ? 0 : scene === s.to ? eased : scene === s.from ? 1 - eased : 0;
      const frame = { time, width, height, level: unit(level), bass: unit(bass), high: unit(high), beat: unit(beat), strength, minimal, reduceFlash, palette };
      for (const scene of SCENE_ORDER) painters[scene](weights[scene], frame);
      return { scene: shown ? s.current : 'off', from: s.from, to: s.to, mix: s.mix, transitions: s.transitions, reason: s.reason, name: shown ? SCENE_NAMES[s.current] : 'Off' };
    },
    destroy() { for (const node of under) node.destroy(); for (const context of contexts) context?.destroy?.(); },
  };
}
