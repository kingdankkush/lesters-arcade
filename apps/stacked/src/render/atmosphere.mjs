import { createLivingField } from './living-field.mjs';

export const STACKED_EPOCHS = Object.freeze([
  { name: 'GENESIS VAULT', color: 0x53e9ef, accent: 0xbacfff },
  { name: 'MEMPOOL DRIFT', color: 0x777dff, accent: 0xdb7bff },
  { name: 'HASHRATE FORGE', color: 0xffa763, accent: 0xffd9a1 },
  { name: 'SCRYPT LATTICE', color: 0x68e0ae, accent: 0xb5ffda },
  { name: 'HALVING ECLIPSE', color: 0xc082ed, accent: 0xffa1b9 },
  { name: 'MAINNET AURORA', color: 0x6de6ff, accent: 0xd8d8ff },
]);
const boundaries = [0, 10800, 25200, 43200, 64800, 90000];
const mixColor = (a, b, t) => [16, 8, 0].reduce((n, shift) => n | Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift, 0);
export function createStackedAtmosphere({ layer, Graphics }) {
  // Shared immutable geometry avoids rebuilding/triangulating every particle
  // and membrane every frame. Only transforms, tint and alpha change.
  const dot = new Graphics().circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.045 })
    .circle(0, 0, 1.8).fill({ color: 0xffffff, alpha: 0.13 }).circle(0, 0, 0.8).fill(0xffffff);
  const filament = new Graphics().rect(0, -0.5, 1, 1).fill(0xffffff);
  const dotContext = dot.context, filamentContext = filament.context;
  const points = Array.from({ length: 192 }, (_, i) => i ? dot.clone() : dot);
  const links = Array.from({ length: 192 }, (_, i) => i ? filament.clone() : filament);
  layer.addChild(...links, ...points);
  const field = createLivingField();
  let audio = null, receivedAt = -10000, level = 0, bass = 0, high = 0;
  return {
    audio(frame, now) { audio = frame; receivedAt = now; },
    draw({ now, tick, lines = 0, width, height, settings }) {
      const zoneIndex = Math.max(0, boundaries.findLastIndex(value => tick >= value));
      const zone = STACKED_EPOCHS[zoneIndex], previous = STACKED_EPOCHS[Math.max(0, zoneIndex - 1)];
      const mix = Math.min(1, (tick - boundaries[zoneIndex]) / 150);
      const color = mixColor(previous.color, zone.color, mix);
      const reduced = settings.accessibility.reduceMotion;
      const available = audio?.available && now - receivedAt < 500 && settings.video.audioReactive;
      level += ((available ? audio.level / 1000 : 0.08) - level) * 0.13;
      bass += ((available ? audio.bass / 1000 : 0.05) - bass) * 0.15;
      high += ((available ? audio.high / 1000 : 0.02) - high) * 0.1;
      const living = field.update({ now, width, height, lines, reducedMotion: reduced, reducedEffects: settings.video.reducedEffects, level, bass, high });
      // Membranes dissolve with the particles, then reappear as new organisms.
      // Everything stays behind the dark board well, never over active pieces.
      for (let i = 0; i < points.length; i++) {
        const point = points[i], link = links[i];
        point.visible = i < living.count;
        link.visible = i < living.count && !!living.connected[i] && living.cohesion > 0;
        if (!point.visible) continue;
        if (link.visible) {
          const dx = living.x[i] - living.x[i - 1], dy = living.y[i] - living.y[i - 1];
          const distance = Math.hypot(dx, dy);
          link.visible = distance < Math.min(width, height) * 0.095;
          link.position.set(living.x[i - 1], living.y[i - 1]);
          link.scale.set(distance, 1.4); link.rotation = Math.atan2(dy, dx);
          link.tint = color; link.alpha = living.cohesion * (0.32 + level * 0.22);
        }
        const size = 1.4 + (i % 3) * 0.55 + (reduced ? 0 : high * 1.4 + (1 - living.cohesion) * 1.2);
        point.position.set(living.x[i], living.y[i]); point.scale.set(size);
        point.tint = (i + living.generation) % 4 ? color : zone.accent;
        point.alpha = 0.48 + level * 0.25;
      }
      // No full-screen flashes or strobe, including on beat onsets.
      return { name: zone.name, color, particles: living.count, available: !!available, phase: living.phase, generation: living.generation, organisms: living.organisms };
    },
    destroy() {
      for (const visual of [...points, ...links]) visual.destroy();
      dotContext.destroy(); filamentContext.destroy();
    },
  };
}
