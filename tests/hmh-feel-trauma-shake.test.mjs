// 2.1 HMH-FEEL item 1 (upgrade guide §2.2, §5.1): the shared trauma-squared
// shake and HMH's use of it. Presentation only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import v8 from 'node:v8';
import vm from 'node:vm';

import { TRAUMA_DECAY_PER_SECOND, createTraumaShake, hashSignedUnit, hashUint32 } from '../apps/portal/src/feel/trauma-shake.mjs';
import { HMH_SHAKE_MAX_PX, HMH_SHAKE_SETTLE_TICKS, HMH_TICK_MS, createHmhFeel, hmhShakeTrauma } from '../apps/hmh-reboot/src/hmh-feel.mjs';
import { WEAPON_RECOIL_SHAKE } from '../apps/hmh-reboot/src/combat-feedback.mjs';
import { grenadeBlastShake } from '../apps/hmh-reboot/src/grenade-feedback.mjs';

const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../apps/portal/src/feel/trauma-shake.mjs', import.meta.url), 'utf8');
const ON = { screenShake: true, reduceMotion: false, reduceFlash: false };

test('trauma adds and clamps to 1, decays linearly at the configured rate', () => {
  const shake = createTraumaShake({ maxPx: 10, decayPerSecond: 2 });
  assert.equal(shake.add(0.3, 0), 0.3);
  assert.equal(shake.add(0.3, 0), 0.6);
  assert.equal(shake.add(0.9, 0), 1, 'clamped');
  assert.equal(shake.level(250), 0.5);
  assert.equal(shake.level(500), 0);
  assert.equal(shake.level(10_000), 0);
  // An add after partial decay starts from the decayed level.
  shake.reset();
  shake.add(0.8, 0);
  assert.ok(Math.abs(shake.add(0.1, 100) - 0.7) < 1e-12);
  // Garbage in is ignored.
  for (const bad of [0, -1, Number.NaN, Infinity]) shake.add(bad, 100);
  assert.ok(Math.abs(shake.level(100) - 0.7) < 1e-12);
  assert.equal(TRAUMA_DECAY_PER_SECOND, 1.75);
});

test('offset = trauma squared x max; reduced flash halves it; disabled is zero', () => {
  const shake = createTraumaShake({ maxPx: 12 });
  shake.add(0.5, 0);
  const full = shake.offset(0, 7, true, false);
  assert.equal(full.amplitude, 0.25 * 12);
  assert.ok(Math.abs(full.x) <= full.amplitude && Math.abs(full.y) <= full.amplitude);
  const fx = full.x, fy = full.y;
  const half = shake.offset(0, 7, true, true);
  assert.equal(half.amplitude, 0.25 * 12 * 0.5);
  assert.ok(Math.abs(half.x - fx / 2) < 1e-12 && Math.abs(half.y - fy / 2) < 1e-12);
  const off = shake.offset(0, 7, false, false);
  assert.equal(off.x, 0); assert.equal(off.y, 0); assert.equal(off.amplitude, 0);
  assert.equal(off.trauma, 0.5, 'trauma still tracked while disabled');
});

test('the offset object is reused (no per-frame allocation) and the direction is an integer hash of the frame', () => {
  const shake = createTraumaShake({ maxPx: 7 });
  shake.add(1, 0);
  const a = shake.offset(0, 1, true);
  const b = shake.offset(0, 2, true);
  assert.equal(a, b, 'same object every frame');
  // Deterministic and frame-dependent.
  assert.equal(hashSignedUnit(41, 0), hashSignedUnit(41, 0));
  assert.notEqual(hashSignedUnit(41, 0), hashSignedUnit(42, 0));
  assert.notEqual(hashSignedUnit(41, 0), hashSignedUnit(41, 1));
  for (let frame = 0; frame < 2000; frame += 1) {
    const unit = hashSignedUnit(frame, frame & 1);
    assert.ok(unit >= -1 && unit < 1);
  }
  assert.equal(hashUint32(0), 0);
  assert.equal(typeof hashUint32(123456), 'number');
  // No template strings or string keys in the shared module's hot path.
  assert.doesNotMatch(shared, /\$\{/, 'no template strings');
  assert.doesNotMatch(main, /shake-x:\$\{/, 'the old string-keyed shake seeding is gone');
});

// Retained growth after a forced collection (the guide's heap-diff check).
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');

test('a 600-tick shake loop retains nothing', () => {
  const feel = createHmhFeel();
  for (let tick = 0; tick < 600; tick += 1) {
    if (tick % 7 === 0) feel.addShake(tick, 1.6);
    feel.shakeOffset(tick, ON);
  }
  gc();
  const before = process.memoryUsage().heapUsed;
  let sink = 0;
  for (let tick = 600; tick < 60_600; tick += 1) {
    if (tick % 7 === 0) feel.addShake(tick, 1.6);
    sink += feel.shakeOffset(tick, ON).x;
  }
  gc();
  const grown = process.memoryUsage().heapUsed - before;
  assert.ok(Number.isFinite(sink));
  // 60,000 frames: a single 32-byte object per frame would be ~1.9 MB.
  assert.ok(grown < 64 * 1024, `heap retained ${grown} B over 60,000 frames`);
});

test('HMH magnitudes map linearly to trauma: small hits stay subtle, a big hit dominates', () => {
  assert.equal(hmhShakeTrauma(HMH_SHAKE_MAX_PX), 1);
  assert.equal(hmhShakeTrauma(24), 1);
  assert.equal(hmhShakeTrauma(-3), 0);
  assert.equal(hmhShakeTrauma('x'), 0);
  // Peak of one isolated impulse, in px.
  const peak = (magnitude) => hmhShakeTrauma(magnitude) ** 2 * HMH_SHAKE_MAX_PX;
  assert.ok(peak(WEAPON_RECOIL_SHAKE['auto-miner']) < 0.1, 'auto-miner kick is tiny');
  assert.ok(peak(WEAPON_RECOIL_SHAKE['coin-blaster']) < 0.25, 'pistol kick is small');
  assert.ok(peak(grenadeBlastShake({ mode: 'hand' })) > 8, 'a hand grenade lands near the top');
  assert.equal(peak(12), 12, 'the boss defeat is the ceiling');
  // Auto-miner sustained fire (every 4 ticks for 10 s) stays subtle.
  const feel = createHmhFeel();
  let worst = 0;
  for (let tick = 0; tick < 600; tick += 1) {
    if (tick % 4 === 0) feel.addShake(tick, WEAPON_RECOIL_SHAKE['auto-miner']);
    worst = Math.max(worst, feel.shakeOffset(tick, ON).amplitude);
  }
  assert.ok(worst < 0.5, `auto-miner stream peaked at ${worst} px`);
  // A grenade during that stream dominates it.
  feel.addShake(600, grenadeBlastShake({ mode: 'hand' }));
  assert.ok(feel.shakeOffset(600, ON).amplitude > 8);
  // Overlapping small hits stack a little, they stay under one grenade.
  const small = createHmhFeel();
  for (let i = 0; i < 3; i += 1) small.addShake(10, 3);
  const stacked = small.shakeOffset(10, ON).amplitude;
  assert.ok(stacked > peak(3) && stacked < peak(grenadeBlastShake({ mode: 'hand' })), `three small hits peaked at ${stacked}`);
});

test('HMH shake is bounded: zero HMH_SHAKE_SETTLE_TICKS after the strongest impulse, and gated by settings', () => {
  const feel = createHmhFeel();
  feel.addShake(100, 12);
  assert.ok(feel.shakeOffset(100, ON).amplitude > 11);
  assert.equal(feel.shakeOffset(100 + HMH_SHAKE_SETTLE_TICKS, ON).amplitude, 0);
  assert.equal(HMH_TICK_MS, 1000 / 60);
  feel.addShake(200, 12);
  assert.equal(feel.shakeOffset(200, { ...ON, screenShake: false }).amplitude, 0);
  assert.equal(feel.shakeOffset(200, { ...ON, reduceMotion: true }).amplitude, 0);
  assert.equal(feel.shakeOffset(200, { ...ON, reduceFlash: true }).amplitude, 6);
  // A captured frame is reproducible: same tick, same offset.
  const first = { ...feel.shakeOffset(201, ON) };
  assert.deepEqual({ ...feel.shakeOffset(201, ON) }, first);
  feel.reset();
  assert.equal(feel.shakeOffset(201, ON).amplitude, 0);
});

test('main.mjs routes every impulse through the feel layer and keeps shake on the world container', () => {
  assert.match(main, /const triggerCameraShake = \(tick, magnitude\) => \{ hmhFeel\?\.addShake\(tick, magnitude\); \};/);
  assert.match(main, /import\('\.\/hmh-feel\.mjs'\)/, 'the feel layer is a lazy chunk');
  assert.doesNotMatch(main, /from '\.\/hmh-feel\.mjs'/, 'never a static import');
  assert.doesNotMatch(main, /SHAKE_DECAY_TICKS|shakeStartTick|shakeMagnitude/, 'the linear 9-tick model is gone');
  assert.match(main, /hmhFeel\?\.reset\(\);\n\s*world\.position\.set\(0, 0\);/, 'restart clears trauma');
  // Aim safety: the camera is never shaken.
  assert.doesNotMatch(main, /camera\.shake[XY]\s*=/);
});
