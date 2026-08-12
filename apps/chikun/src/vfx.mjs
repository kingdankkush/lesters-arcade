export const MAX_CHIKUN_PARTICLES = 24;

const EVENT_STYLES = Object.freeze({
  flap: Object.freeze({ count: 4, color: '#d8f7ff', speed: 2.4, lifeTicks: 24, shake: 0, flash: 0 }),
  coin: Object.freeze({ count: 10, color: '#e7edf5', speed: 3.4, lifeTicks: 34, shake: 1, flash: 0.08 }),
  fork: Object.freeze({ count: 6, color: '#43ef67', speed: 2.8, lifeTicks: 28, shake: 1, flash: 0 }),
  'near-miss': Object.freeze({ count: 16, color: '#ffe138', speed: 4.5, lifeTicks: 42, shake: 5, flash: 0.2 }),
  milestone: Object.freeze({ count: 20, color: '#ff8f2d', speed: 5.2, lifeTicks: 50, shake: 3, flash: 0.12 }),
  crash: Object.freeze({ count: 24, color: '#ff4d65', speed: 6.2, lifeTicks: 58, shake: 9, flash: 0.3 }),
});

function unitRoll(tick, index, salt) {
  let value = Math.imul((Math.floor(tick) >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ salt, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

export function planChikunVfx({ event, x = 0, y = 0, tick = 0, reduceMotion = false } = {}) {
  const style = EVENT_STYLES[event] ?? EVENT_STYLES.fork;
  const count = reduceMotion ? Math.min(2, style.count) : Math.min(MAX_CHIKUN_PARTICLES, style.count);
  const particles = [];
  for (let index = 0; index < count; index += 1) {
    const angle = unitRoll(tick, index, 17) * Math.PI * 2;
    const speed = style.speed * (0.55 + unitRoll(tick, index, 29) * 0.65);
    particles.push(Object.freeze({
      x: Number(x) || 0,
      y: Number(y) || 0,
      vx: Number((Math.cos(angle) * speed).toFixed(4)),
      vy: Number((Math.sin(angle) * speed).toFixed(4)),
      size: Number((3 + unitRoll(tick, index, 43) * 7).toFixed(3)),
      color: style.color,
      bornTick: Math.max(0, Math.floor(Number(tick) || 0)),
      lifeTicks: style.lifeTicks,
    }));
  }
  return Object.freeze({
    event: typeof event === 'string' ? event : 'fork',
    particles: Object.freeze(particles),
    shake: reduceMotion ? 0 : style.shake,
    flash: style.flash,
    bornTick: Math.max(0, Math.floor(Number(tick) || 0)),
    lifeTicks: style.lifeTicks,
  });
}
