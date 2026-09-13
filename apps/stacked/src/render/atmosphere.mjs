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
  const graphic = new Graphics(); layer.addChild(graphic);
  let audio = null, receivedAt = -10000, level = 0, bass = 0, high = 0;
  return {
    audio(frame, now) { audio = frame; receivedAt = now; },
    draw({ now, tick, width, height, settings }) {
      const zoneIndex = Math.max(0, boundaries.findLastIndex(value => tick >= value));
      const zone = STACKED_EPOCHS[zoneIndex], previous = STACKED_EPOCHS[Math.max(0, zoneIndex - 1)];
      const mix = Math.min(1, (tick - boundaries[zoneIndex]) / 150);
      const color = mixColor(previous.color, zone.color, mix);
      const reduced = settings.accessibility.reduceMotion;
      const available = audio?.available && now - receivedAt < 500 && settings.video.audioReactive;
      level += ((available ? audio.level / 1000 : 0.08) - level) * 0.13;
      bass += ((available ? audio.bass / 1000 : 0.05) - bass) * 0.15;
      high += ((available ? audio.high / 1000 : 0.02) - high) * 0.1;
      const t = reduced ? 0 : now * 0.000075, radius = Math.min(width, height) * (0.31 + bass * (reduced ? 0.015 : 0.10));
      const count = settings.video.reducedEffects || reduced ? 44 : 144;
      graphic.clear();
      // Dark well is rendered above these bounded, low-contrast effects.
      for (let ring = 0; ring < 5; ring++) {
        const r = radius * (1 + ring * 0.35);
        graphic.ellipse(0, 0, r, r * (0.5 + zoneIndex * 0.025)).stroke({ color, width: 1 + level, alpha: 0.13 - ring * 0.019 });
      }
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399963 + t * ((i % 3) - 1), orbit = 0.22 + ((i * 137) % 1000) / 1000;
        const x = Math.cos(angle) * width * orbit * 0.54, y = Math.sin(angle) * height * orbit * 0.62;
        const size = 0.7 + (i % 4) * 0.45 + high * 1.8;
        graphic.circle(x, y, size).fill({ color: i % 4 ? color : zone.accent, alpha: 0.2 + level * 0.34 });
      }
      // No full-screen flashes or strobe, including on beat onsets.
      return { name: zone.name, color, particles: count, available: !!available };
    },
    destroy() { graphic.destroy(); },
  };
}
