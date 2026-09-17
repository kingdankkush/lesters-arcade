import { createLivingField, LIVING_FIELD_CAPACITY } from './living-field.mjs';
import { createMusicMotion } from './music-motion.mjs';
import { createMusicWorld, MUSIC_WORLD_NAMES, JOURNEY_WORLDS } from './music-worlds.mjs';
import { createWorldForms } from './world-forms.mjs';

// Zone palettes: `color` and `accent` tint points and membranes, `deep` tints
// the far rings and webs so every epoch reads as its own world.
export const STACKED_EPOCHS = Object.freeze([
  { name: 'GENESIS VAULT', color: 0x53e9ef, accent: 0xbacfff, deep: 0x1f6f8f },
  { name: 'MEMPOOL DRIFT', color: 0x777dff, accent: 0xdb7bff, deep: 0x3b3f9e },
  { name: 'HASHRATE FORGE', color: 0xffa763, accent: 0xffd9a1, deep: 0x9a5a2e },
  { name: 'SCRYPT LATTICE', color: 0x68e0ae, accent: 0xb5ffda, deep: 0x2c7a5e },
  { name: 'HALVING ECLIPSE', color: 0xc082ed, accent: 0xffa1b9, deep: 0x6a3f8f },
  { name: 'MAINNET AURORA', color: 0x6de6ff, accent: 0xd8d8ff, deep: 0x2f6f9f },
]);
const boundaries = [0, 10800, 25200, 43200, 64800, 90000];
const mixColor = (a, b, t) => [16, 8, 0].reduce((n, shift) => n | Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift, 0);
export function createStackedAtmosphere({ layer, Graphics, mobile=false }) {
  // Shared immutable geometry avoids rebuilding/triangulating every particle
  // and membrane every frame. Only transforms, tint and alpha change.
  const dot = new Graphics().circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.045 })
    .circle(0, 0, 1.8).fill({ color: 0xffffff, alpha: 0.13 }).circle(0, 0, 0.8).fill(0xffffff);
  const filament = new Graphics().rect(0, -0.5, 1, 1).fill(0xffffff);
  const dotContext = dot.context, filamentContext = filament.context;
  const points = Array.from({ length: mobile ? 432 : LIVING_FIELD_CAPACITY }, (_, i) => i ? dot.clone() : dot);
  const links = Array.from({ length: mobile ? 432 : LIVING_FIELD_CAPACITY }, (_, i) => i ? filament.clone() : filament);
  // Glows, rings and webs sit under the organisms; the vignette frames everything
  // and stays behind the opaque board well like the rest of this layer.
  const forms = createWorldForms({ layer, Graphics, mobile });
  layer.addChild(...links, ...points, ...forms.over);
  const field = createLivingField({mobile});
  const motion = createMusicMotion(), world = createMusicWorld();
  const palette = { color: 0, accent: 0, deep: 0 };
  let mode = '', changedAt = 0;
  return {
    audio(frame, now) { motion.audio(frame, now); },
    draw({ now, tick, lines = 0, width, height, settings, feedback = {} }) {
      const zoneIndex = Math.max(0, boundaries.findLastIndex(value => tick >= value));
      const zone = STACKED_EPOCHS[zoneIndex], previous = STACKED_EPOCHS[Math.max(0, zoneIndex - 1)];
      const mix = Math.min(1, (tick - boundaries[zoneIndex]) / 150);
      const color = palette.color = mixColor(previous.color, zone.color, mix);
      palette.accent = mixColor(previous.accent, zone.accent, mix); palette.deep = mixColor(previous.deep, zone.deep, mix);
      const reduced = settings.accessibility.reduceMotion;
      const { time, available, level, bass, high, beat } = motion.update(now, reduced, settings.video.audioReactive);
      const intensity = settings.video.effectsIntensity ?? 0.7;
      const chosen = settings.video.visualizer ?? 'journey';
      const nextMode = chosen === 'journey' ? JOURNEY_WORLDS[zoneIndex] : MUSIC_WORLD_NAMES[chosen] ? chosen : 'living';
      if (mode !== nextMode) { mode = nextMode; changedAt = time; }
      const fade = reduced ? 1 : Math.min(1, 0.25 + (time - changedAt) * 2.5);
      const living = field.update({ now: time * 1000, width, height, lines, reducedMotion: reduced, reducedEffects: settings.video.reducedEffects, level, bass, high, beat });
      const shapes = mode === 'living' ? living : world.update({ mode, time, width, height, minimal: settings.video.reducedEffects, reducedMotion: reduced, bass, high, level, beat, ...feedback, generation: living.generation });
      const count = intensity > 0 ? shapes.count : 0;
      const cohesion = mode === 'living' ? living.cohesion : 1;
      // Membranes dissolve with the particles, then reappear as new organisms.
      // Everything stays behind the dark board well, never over active pieces.
      for (let i = 0; i < points.length; i++) {
        const point = points[i], link = links[i];
        point.visible = i < count;
        link.visible = i < count && !!shapes.connected[i] && (mode !== 'living' || living.cohesion > 0);
        if (!point.visible) continue;
        if (link.visible) {
          const dx = shapes.x[i] - shapes.x[i - 1], dy = shapes.y[i] - shapes.y[i - 1];
          const distance = Math.hypot(dx, dy);
          if (mode === 'living') link.visible = distance < Math.min(width, height) * 0.095;
          link.position.set(shapes.x[i - 1], shapes.y[i - 1]);
          link.scale.set(distance, mode === 'spectrum' ? (settings.video.reducedEffects ? 5 : 4) : mode === 'aurora' ? 3.6 : 1.4); link.rotation = Math.atan2(dy, dx);
          link.tint = i % 5 ? color : palette.accent;
          link.alpha = intensity * fade * (mode === 'living' ? living.cohesion : shapes.weight[i]) * (0.42 + level * 0.22);
        }
        // Beat onsets scale the organisms and constellations; they never brighten them.
        const size = 1.4 + (i % 3) * 0.55 + (reduced ? 0 : high * 1.4 + beat * 0.5 + (1 - living.cohesion) * 1.2);
        point.position.set(shapes.x[i], shapes.y[i]);
        point.scale.set(mode === 'living' ? size : mode === 'orbit' ? 1.4 + shapes.weight[i] * 0.8 + beat * 0.4 : mode === 'aurora' ? 1.1 + beat * 0.3 : 0.85 + beat * 0.3);
        point.tint = (i + living.generation) % 4 ? color : palette.accent;
        point.alpha = (0.48 + level * 0.25) * intensity * fade;
      }
      const webs = forms.draw({ mode, x: shapes.x, y: shapes.y, weight: mode === 'living' ? null : shapes.weight, count, perOrganism: living.pointsPerOrganism, cohesion, generation: living.generation, width, height, time, level, bass, high, beat, intensity, fade, minimal: !!settings.video.reducedEffects, reduceFlash: !!settings.accessibility.reduceFlash, palette });
      // No full-screen flashes or strobe, including on beat onsets.
      return { name: zone.name, color, particles: count, webs, available: !!available, phase: living.phase, generation: living.generation, organisms: living.organisms, mode, visualizerName: MUSIC_WORLD_NAMES[mode] };
    },
    destroy() {
      for (const visual of [...points, ...links]) visual.destroy();
      forms.destroy();
      dotContext.destroy(); filamentContext.destroy();
    },
  };
}
