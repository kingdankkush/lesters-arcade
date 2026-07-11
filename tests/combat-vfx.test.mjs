import test from 'node:test';
import assert from 'node:assert/strict';

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HMH_FINAL_COMBAT_VFX_PACK, finalCombatVfxAssetByKey } from '../apps/portal/assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs';

import {
  createMuzzleFlash,
  createShellCasing,
  createHitSparks,
  createBloodBurst,
  createDeathBurst,
  createBulletTrail,
  createExplosion,
  buildIsometricHeroDrawPlan,
  projectPlayerShotScreenPoint,
  updateVfxParticles,
  drawVfxParticles,
  getDeathVfxName,
  getFinalCombatVfxAsset,
  getRegisteredDeathVfxIds,
} from '../apps/portal/src/combat-vfx.mjs';


test('final combat VFX pack ships original spritesheets for readable large effects only', () => {
  assert.equal(HMH_FINAL_COMBAT_VFX_PACK.id, 'hmh-final-combat-vfx-v1');
  assert.match(HMH_FINAL_COMBAT_VFX_PACK.sourcePolicy, /original repo-owned/i);
  assert.equal(HMH_FINAL_COMBAT_VFX_PACK.assetCount >= 10, true);
  assert.equal(HMH_FINAL_COMBAT_VFX_PACK.excludesNormalBulletSprites, true);

  const required = [
    'muzzle-flash-pistol',
    'muzzle-flash-rail',
    'hit-spark-metal',
    'hit-spark-flesh',
    'shell-casing-brass',
    'coin-pickup-pop',
    'grenade-explosion-ring',
    'death-dust-burst',
    'gore-pixel-splatter',
    'level-up-burst',
  ];

  for (const key of required) {
    const asset = finalCombatVfxAssetByKey(key);
    assert.ok(asset, `${key} exists`);
    assert.equal(asset.animated, true, `${key} animated`);
    assert.equal(asset.frames >= 4, true, `${key} frame count`);
    assert.equal(asset.sheetWidth, asset.frameWidth * asset.frames, `${key} sheet width`);
    assert.equal(existsSync(fileURLToPath(new URL(`../apps/portal/${asset.src.replace(/^\.\//, '')}`, import.meta.url))), true, `${asset.src} exists`);
  }
});


test('combat VFX module exposes final spritesheet metadata for runtime/UI consumers', () => {
  const explosion = getFinalCombatVfxAsset('grenade-explosion-ring');
  assert.ok(explosion);
  assert.equal(explosion.role, 'explosion');
  assert.equal(explosion.animated, true);
  assert.equal(getFinalCombatVfxAsset('normal-bullet-sprite'), null);
});

test('createMuzzleFlash produces one readable barrel flash instead of an invisible particle spray', () => {
  const flashes = createMuzzleFlash(100, 200, 'east');
  assert.equal(flashes.length, 1);
  const flash = flashes[0];
  assert.equal(flash.type, 'muzzle-flash');
  assert.equal(flash.x, 100);
  assert.equal(flash.y, 200);
  assert.equal(flash.vx, 0);
  assert.equal(flash.vy, 0);
  assert.equal(flash.gravity, 0);
  assert.ok(flash.life >= 6 && flash.life <= 10);
  assert.ok(flash.color.startsWith('#'));
  assert.ok(flash.size >= 7 && flash.size <= 10);
});

test('isometric hero draw plan preserves complete animation frames at a readable grounded scale', () => {
  const plan = buildIsometricHeroDrawPlan({ x: 400, y: 300, bob: 2, frameWidth: 136, frameHeight: 136 });
  assert.deepEqual(plan.source, { x: 0, y: 0, width: 136, height: 136 });
  assert.deepEqual(plan.destination, { x: 334, y: 170, width: 132, height: 132 });
  assert.equal(plan.destination.y + plan.destination.height, 302);
  assert.ok(plan.marker.radiusX >= 24);
  assert.ok(plan.marker.radiusY >= 8);
});

test('player projectiles and muzzle effects render above the isometric ground plane', () => {
  assert.deepEqual(
    projectPlayerShotScreenPoint({ x: 500, y: 320 }),
    { x: 500, y: 262 },
  );
  assert.deepEqual(
    projectPlayerShotScreenPoint({ x: 500, y: 320 }, { isometric: false }),
    { x: 500, y: 320 },
  );
});

test('createShellCasing produces a brass-colored casing particle', () => {
  const casings = createShellCasing(100, 200);
  assert.equal(casings.length, 1);
  assert.equal(casings[0].type, 'shell-casing');
  assert.ok(casings[0].color.startsWith('#'));
  assert.ok(casings[0].gravity > 0);
});

test('createHitSparks produces multiple spark particles radiating outward', () => {
  const sparks = createHitSparks(100, 200, 8);
  assert.equal(sparks.length, 8);
  for (const s of sparks) {
    assert.equal(s.type, 'hit-spark');
    assert.ok(s.life > 0);
    assert.ok(s.color.startsWith('#'));
  }
});

test('createBloodBurst produces blood particles with gore palette colors', () => {
  const blood = createBloodBurst(100, 200, 10);
  assert.equal(blood.length, 10);
  for (const b of blood) {
    assert.equal(b.type, 'blood-burst');
    assert.ok(b.gravity > 0);
  }
});

test('createDeathBurst produces enemy-specific death particles', () => {
  const goblinDeath = createDeathBurst(100, 200, 'fud-goblin');
  assert.ok(goblinDeath.length >= 10);
  for (const p of goblinDeath) {
    assert.equal(p.type, 'death-burst');
  }

  const golemDeath = createDeathBurst(100, 200, 'liquidation-cascade-golem');
  assert.ok(golemDeath.length >= 20, 'Golem should have more particles than grunt');
});

test('createDeathBurst uses default preset for unknown enemy IDs', () => {
  const unknownDeath = createDeathBurst(100, 200, 'unknown-enemy');
  assert.ok(unknownDeath.length >= 8);
  for (const p of unknownDeath) {
    assert.equal(p.type, 'death-burst');
  }
});

test('createBulletTrail produces trail particles along a line', () => {
  const trail = createBulletTrail(0, 0, 100, 0, 'pistol');
  assert.ok(trail.length >= 2);
  for (const t of trail) {
    assert.equal(t.type, 'bullet-trail');
  }
});

test('createBulletTrail rail type uses cyan colors', () => {
  const trail = createBulletTrail(0, 0, 100, 0, 'rail');
  const hasCyan = trail.some((t) => t.color.includes('74e0d6') || t.color.includes('3782d9'));
  assert.equal(hasCyan, true);
});

test('createExplosion produces radial explosion particles', () => {
  const explosion = createExplosion(100, 200, 30);
  assert.ok(explosion.length >= 10);
  for (const e of explosion) {
    assert.equal(e.type, 'explosion');
    assert.ok(e.size > 0);
  }
});

test('updateVfxParticles decreases life and moves particles, removing dead ones', () => {
  const particles = [
    ...createHitSparks(100, 200, 4),
  ];
  const updated = updateVfxParticles(particles, 1);
  assert.ok(updated.length <= particles.length);
  for (const p of updated) {
    assert.ok(p.life > 0);
  }
});

test('updateVfxParticles removes all particles when life expires', () => {
  const particles = createMuzzleFlash(100, 200, 'east');
  const updated = updateVfxParticles(particles, 1000);
  assert.equal(updated.length, 0);
});

test('getDeathVfxName returns descriptive name for known enemies', () => {
  const name = getDeathVfxName('fud-goblin');
  assert.ok(name.length > 0);
  assert.ok(name.includes('red candle'));
});

test('getDeathVfxName returns default name for unknown enemies', () => {
  const name = getDeathVfxName('unknown-enemy');
  assert.ok(name.length > 0);
  assert.ok(name.includes('generic'));
});

test('getRegisteredDeathVfxIds includes all major enemy types', () => {
  const ids = getRegisteredDeathVfxIds();
  assert.ok(ids.includes('fud-goblin'));
  assert.ok(ids.includes('crypto-bro'));
  assert.ok(ids.includes('gas-beast'));
  assert.ok(ids.includes('whale-dumper-boss'));
  assert.ok(ids.includes('chain-reaper-boss'));
  assert.ok(ids.includes('coyote-pack-runner'));
  assert.ok(ids.includes('scorpion-ambusher'));
  assert.ok(ids.includes('liquidation-cascade-golem'));
});

test('drawVfxParticles does not throw with valid context stub', () => {
  const particles = createHitSparks(100, 200, 4);
  const ctxStub = {
    save() {}, restore() {},
    globalAlpha: 1, fillStyle: '', imageSmoothingEnabled: true,
    fillRect() {},
  };
  assert.doesNotThrow(() => drawVfxParticles(ctxStub, particles, 0));
});
