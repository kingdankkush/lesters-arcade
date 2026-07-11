// Combat VFX System for Hard Money Heroes
//
// Provides visual effects for combat: muzzle flashes, hit sparks, death bursts,
// bullet trails, and enemy-specific death effects. All VFX are cosmetic and
// render-side only — they do not affect gameplay logic or collision.
//
// VFX types:
// - Muzzle flash: 2-frame yellow/white/blue flash at barrel on gunfire
// - Shell casings: small brass pixels ejected downward on gunfire
// - Hit sparks: silver/orange impact sparks on enemy hit
// - Blood burst: stylized pixel blood on hit (gore toggle)
// - Death burst: enemy-specific death particle effects
// - Bullet trail: cyan beam trail for Hash Rail, tracer for bullets
// - Grenade arc: arc trail and explosion for grenades

const VFX_POOL_SIZE = 200; // max simultaneous VFX particles

const ISO_HERO_DRAW_HEIGHT = 132;
const ISO_PLAYER_SHOT_HEIGHT = 58;

// VFX particle shape
import { HMH_FINAL_COMBAT_VFX_PACK, finalCombatVfxAssetByKey } from '../assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';

function vfxParticle(id, type, x, y, vx, vy, life, color, size, gravity = 0) {
  return { id, type, x, y, vx, vy, life, maxLife: life, color, size, gravity };
}

// The playable 136px roster frames reserve broad transparent margins for
// animation stability. Rendering the whole frame at 88px made the actual actor
// only 12-18 CSS pixels wide. Keep the complete frame so directional weapon
// flashes and throw arcs cannot be clipped, but scale it to a readable footprint
// while preserving the bottom-center foot anchor.
export function buildIsometricHeroDrawPlan({ x, y, bob = 0, frameWidth = 136, frameHeight = 136 }) {
  const source = { x: 0, y: 0, width: frameWidth, height: frameHeight };
  const drawHeight = ISO_HERO_DRAW_HEIGHT;
  const drawWidth = Math.round(drawHeight * (frameWidth / frameHeight));
  return {
    source,
    destination: {
      x: Math.round(x - drawWidth / 2),
      y: Math.round(y + bob - drawHeight),
      width: drawWidth,
      height: drawHeight,
    },
    marker: { x, y: y + 2, radiusX: 28, radiusY: 10 },
  };
}

// Projectile collision stays on the ground plane, but its visual tracer should
// originate at the hero's weapon height rather than between the hero's feet.
export function projectPlayerShotScreenPoint(point, { isometric = true, heightOffset = ISO_PLAYER_SHOT_HEIGHT } = {}) {
  return {
    x: point.x,
    y: point.y - (isometric ? heightOffset : 0),
  };
}

// VFX effect definitions per enemy death effect
const DEATH_VFX_PRESETS = Object.freeze({
  'fud-goblin': { colors: ['#ff476f', '#9b1230', '#ffd27a'], particleCount: 12, spread: 3.5, name: 'red candle smoke + silver sparks' },
  'gas-fee-wisp': { colors: ['#ff9a3d', '#ff7b2f', '#ffd27a'], particleCount: 14, spread: 4, name: 'orange flame pop + pump handle fragments' },
  'paper-hand': { colors: ['#ffffff', '#e0e0e0', '#c0c0c0'], particleCount: 16, spread: 3, name: 'white paper confetti' },
  'crypto-bro': { colors: ['#3dff7f', '#ffd27a', '#74e0d6'], particleCount: 14, spread: 3.5, name: 'shattered phone pixels + green candle confetti' },
  'gas-beast': { colors: ['#ff9a3d', '#3782d9', '#74e0d6'], particleCount: 18, spread: 4.5, name: 'orange/blue gas burst + ETH fee shards' },
  'coyote-pack-runner': { colors: ['#d9a15b', '#a08040', '#ffd27a'], particleCount: 10, spread: 3, name: 'dust skid + bone-chip burst' },
  'wild-boar': { colors: ['#8b6b3d', '#d9a15b', '#ffd27a'], particleCount: 12, spread: 3.5, name: 'dirt spray + tusk-chip burst' },
  'buzzard': { colors: ['#6b5b3d', '#a08040', '#d6c7a2'], particleCount: 14, spread: 4, name: 'feather burst + dust spiral' },
  'rattlesnake': { colors: ['#d9a15b', '#a08040', '#74e0d6'], particleCount: 10, spread: 3, name: 'sand plume + venom mist' },
  'scorpion-ambusher': { colors: ['#4fd4c8', '#74e0d6', '#3782d9'], particleCount: 12, spread: 3.5, name: 'sand plume + neon venom spray' },
  'bandit-captain': { colors: ['#ffd27a', '#c8d3e8', '#d9a15b'], particleCount: 16, spread: 4, name: 'banner shred + brass spark burst' },
  'claim-jumper': { colors: ['#ffd27a', '#c8d3e8', '#d9a15b'], particleCount: 12, spread: 3.5, name: 'hat flip + coin-spur sparks' },
  'ridge-raider': { colors: ['#c8d3e8', '#ffd27a', '#9cb6e9'], particleCount: 14, spread: 4, name: 'scope-glint shards + cliff dust' },
  'scam-cult-zealot': { colors: ['#ff8f5c', '#ffd37d', '#9b1230'], particleCount: 14, spread: 3.5, name: 'flare ash + robe shred' },
  'sybil-drone': { colors: ['#74e0d6', '#3782d9', '#ffffff'], particleCount: 12, spread: 4, name: 'cyan electric shards + wallet-address pixels' },
  'rug-rat': { colors: ['#9b1230', '#d9a15b', '#a08040'], particleCount: 10, spread: 3, name: 'torn carpet scraps + red dust' },
  'mev-reaper': { colors: ['#3b0712', '#74e0d6', '#9cb6e9'], particleCount: 16, spread: 4, name: 'dark cloak tear + sandwich-blade sparks' },
  'slippage-skater': { colors: ['#74e0d6', '#ffd27a', '#ffffff'], particleCount: 14, spread: 4, name: 'ice-trail shards + orange skid sparks' },
  'phishing-angler': { colors: ['#3b0712', '#ffd27a', '#74e0d6'], particleCount: 14, spread: 3.5, name: 'fake popup shatter + cloak smoke' },
  'honeypot-turret': { colors: ['#ffd27a', '#3782d9', '#74e0d6'], particleCount: 16, spread: 4, name: 'golden hex shards + blue reveal sparks' },
  'liquidation-cascade-golem': { colors: ['#ff1f4f', '#9b1230', '#ff7b2f'], particleCount: 24, spread: 5, name: 'stacked red ticker blocks collapse into chain shockwave' },
  'whale-dumper-boss': { colors: ['#3782d9', '#74e0d6', '#ffd27a'], particleCount: 30, spread: 6, name: 'massive whale burst + coin cascade' },
  'chain-reaper-boss': { colors: ['#74e0d6', '#3b0712', '#ffffff'], particleCount: 28, spread: 5.5, name: 'chain-scythe shatter + cyan soul release' },
});

// Default death VFX for unlisted enemies
const DEFAULT_DEATH_VFX = Object.freeze({
  colors: ['#ffd27a', '#ff7b2f', '#ffffff'],
  particleCount: 12,
  spread: 3.5,
  name: 'generic dust + spark burst',
});

// Muzzle flash VFX: a single tiny static flash at the weapon barrel. Keep this
// readable and minimal so player bullets/tracers don't get lost in a particle spray.
export function createMuzzleFlash(x, y, direction = 'east') {
  const color = direction === 'rail' ? '#19f7ff' : '#fff5cc';
  const size = direction === 'rail' ? 10 : 7;
  return [vfxParticle(
    `mf-${Date.now()}`,
    'muzzle-flash',
    x,
    y,
    0,
    0,
    direction === 'rail' ? 8 : 6,
    color,
    size,
    0,
  )];
}

// Shell casing VFX: small brass pixel ejected downward
export function createShellCasing(x, y) {
  return [vfxParticle(
    `sc-${Date.now()}`,
    'shell-casing',
    x, y,
    (Math.random() - 0.5) * 1.5,
    -1 - Math.random(),
    20,
    '#d4a838',
    2,
    0.15,
  )];
}

// Hit sparks: silver/orange impact sparks on enemy hit
export function createHitSparks(x, y, count = 8) {
  const sparks = [];
  const colors = ['#ffffff', '#ffd27a', '#ff9a3d', '#c8d3e8'];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 1.5 + Math.random() * 2.5;
    sparks.push(vfxParticle(
      `hs-${Date.now()}-${i}`,
      'hit-spark',
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      8 + Math.random() * 6,
      colors[i % colors.length],
      2 + Math.random() * 2,
      0.08,
    ));
  }
  return sparks;
}

// Blood burst: stylized pixel blood on hit (only if gore enabled)
export function createBloodBurst(x, y, count = 10) {
  const blood = [];
  const colors = ['#ff1f4f', '#9b1230', '#ff7b2f'];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    blood.push(vfxParticle(
      `bb-${Date.now()}-${i}`,
      'blood-burst',
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 1,
      12 + Math.random() * 8,
      colors[i % colors.length],
      2 + Math.random() * 3,
      0.2,
    ));
  }
  return blood;
}

// Death burst: enemy-specific death particle effect
export function createDeathBurst(x, y, enemyId) {
  const preset = DEATH_VFX_PRESETS[enemyId] ?? DEFAULT_DEATH_VFX;
  const particles = [];
  for (let i = 0; i < preset.particleCount; i++) {
    const angle = (i / preset.particleCount) * Math.PI * 2 + Math.random() * 0.5;
    const speed = preset.spread * (0.5 + Math.random() * 0.8);
    particles.push(vfxParticle(
      `db-${Date.now()}-${i}`,
      'death-burst',
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 0.5,
      14 + Math.random() * 12,
      preset.colors[i % preset.colors.length],
      2 + Math.random() * 3,
      0.12,
    ));
  }
  return particles;
}

// Bullet trail: cyan/white tracer line for bullets
export function createBulletTrail(x1, y1, x2, y2, weaponType = 'pistol') {
  const trails = [];
  const colors = weaponType === 'rail'
    ? ['#74e0d6', '#3782d9', '#ffffff']
    : ['#ffd27a', '#ffffff', '#ff9a3d'];

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(2, Math.floor(dist / 8));

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    trails.push(vfxParticle(
      `bt-${Date.now()}-${i}`,
      'bullet-trail',
      x1 + dx * t,
      y1 + dy * t,
      0, 0,
      4 + Math.random() * 3,
      colors[i % colors.length],
      weaponType === 'rail' ? 4 : 2,
      0,
    ));
  }
  return trails;
}

// Grenade explosion VFX
export function createExplosion(x, y, radius = 30) {
  const particles = [];
  const colors = ['#ffff66', '#ff9a3d', '#ff476f', '#ffffff', '#9b1230'];
  const count = Math.min(30, Math.floor(radius / 2));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push(vfxParticle(
      `ex-${Date.now()}-${i}`,
      'explosion',
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      10 + Math.random() * 10,
      colors[i % colors.length],
      3 + Math.random() * 4,
      0.15,
    ));
  }
  return particles;
}

// Update VFX particles (call each frame)
export function updateVfxParticles(particles, dt) {
  const updated = [];
  for (const p of particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.gravity ?? 0) * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    updated.push(p);
  }
  return updated;
}

// Draw VFX particles to a canvas context
export function drawVfxParticles(ctx, particles, frame) {
  ctx.save();
  for (const p of particles) {
    const alpha = Math.min(1, p.life / p.maxLife);
    const size = p.size * alpha;
    if (size < 0.5) continue;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.imageSmoothingEnabled = false;

    if (p.type === 'muzzle-flash') {
      // Star-shaped flash
      ctx.fillRect(p.x - size, p.y - 1, size * 2, 2);
      ctx.fillRect(p.x - 1, p.y - size, 2, size * 2);
      ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
    } else if (p.type === 'shell-casing') {
      ctx.fillRect(p.x - 1, p.y - 1, 2, 3);
    } else if (p.type === 'hit-spark' || p.type === 'death-burst') {
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), Math.ceil(size), Math.ceil(size));
    } else if (p.type === 'blood-burst') {
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), Math.ceil(size), Math.ceil(size));
    } else if (p.type === 'bullet-trail') {
      ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - 1), Math.ceil(size), 2);
    } else if (p.type === 'explosion') {
      ctx.fillRect(Math.round(p.x - size), Math.round(p.y - size), Math.ceil(size * 2), Math.ceil(size * 2));
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Get death VFX preset name for an enemy
export function getDeathVfxName(enemyId) {
  return (DEATH_VFX_PRESETS[enemyId] ?? DEFAULT_DEATH_VFX).name;
}

// Get all registered death VFX enemy IDs
export function getRegisteredDeathVfxIds() {
  return Object.freeze(Object.keys(DEATH_VFX_PRESETS));
}


// Final combat VFX spritesheet metadata for runtime/UI consumers. Normal bullets
// remain coded projectile/tracer primitives; this pack is for readable large FX.
export function getFinalCombatVfxAsset(key) {
  return finalCombatVfxAssetByKey(key);
}

export function getFinalCombatVfxPack() {
  return HMH_FINAL_COMBAT_VFX_PACK;
}
