import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WAVE2_GAME_FEEL_TARGETS,
  advanceWave2AutoFireCadence,
  buildWave2GameFeelProfile,
  integrateWave2Movement,
  planWave2Dash,
  planWave2KnockbackRecovery,
} from '../apps/portal/src/hmh-game-feel-tuning.mjs';

test('Wave 2 game-feel profile encodes readable acceleration, dash, and recovery bands', () => {
  const profile = buildWave2GameFeelProfile({ hero: 'lester', accessibility: { reducedMotion: false } });

  assert.equal(profile.version, 'wave2-game-feel-v1');
  assert.ok(profile.movement.accelerationSeconds >= 0.12 && profile.movement.accelerationSeconds <= 0.22);
  assert.ok(profile.movement.decelerationSeconds >= 0.08 && profile.movement.decelerationSeconds <= 0.18);
  assert.ok(profile.dash.cooldownSeconds >= 1.05 && profile.dash.cooldownSeconds <= 1.45);
  assert.ok(profile.dash.invulnerabilityFrames >= 6 && profile.dash.invulnerabilityFrames <= 12);
  assert.ok(profile.recovery.hitStopFrames <= WAVE2_GAME_FEEL_TARGETS.maxHitStopFrames);
  assert.equal(profile.readability.minTellFrames >= 18, true);
});

test('integrateWave2Movement eases into input and decelerates without instant stops', () => {
  const profile = buildWave2GameFeelProfile();
  const start = { vx: 0, vy: 0 };
  const first = integrateWave2Movement(start, { x: 1, y: 0 }, { dtSeconds: 1 / 60, profile });
  const second = integrateWave2Movement(first, { x: 1, y: 0 }, { dtSeconds: 1 / 60, profile });
  const coast = integrateWave2Movement(second, { x: 0, y: 0 }, { dtSeconds: 1 / 60, profile });

  assert.ok(first.vx > 0, 'first frame should move toward input');
  assert.ok(first.vx < profile.movement.maxSpeed, 'first frame should not snap to max speed');
  assert.ok(second.vx > first.vx, 'held input should accelerate');
  assert.ok(coast.vx > 0 && coast.vx < second.vx, 'released input should decelerate, not teleport-stop');
  assert.equal(Number.isFinite(coast.vy), true);
});

test('integrateWave2Movement responds faster to deliberate direction reversals than straight acceleration', () => {
  const profile = buildWave2GameFeelProfile();
  let reversed = integrateWave2Movement(
    { vx: profile.movement.maxSpeed, vy: 0 },
    { x: -1, y: 0 },
    { dtSeconds: 1 / 60, profile },
  );
  assert.ok(reversed.vx < profile.movement.maxSpeed * 0.5, 'first reversal frame should shed old-direction momentum quickly');
  reversed = integrateWave2Movement(reversed, { x: -1, y: 0 }, { dtSeconds: 1 / 60, profile });
  reversed = integrateWave2Movement(reversed, { x: -1, y: 0 }, { dtSeconds: 1 / 60, profile });
  assert.ok(reversed.vx < 0, 'hero should face the requested movement direction within three fixed steps');
  assert.ok(profile.movement.turnResponsivenessMultiplier >= 2);
});

test('advanceWave2AutoFireCadence preserves fire-rate ticks under low FPS with bounded catch-up', () => {
  assert.deepEqual(advanceWave2AutoFireCadence({ cooldownSeconds: 0.05, dtSeconds: 0.27, shotsPerSecond: 10 }), {
    dueShots: 3,
    cooldownSeconds: 0.08,
  });
  assert.deepEqual(advanceWave2AutoFireCadence({ cooldownSeconds: 0.08, dtSeconds: 0.02, shotsPerSecond: 10 }), {
    dueShots: 0,
    cooldownSeconds: 0.06,
  });
  assert.deepEqual(advanceWave2AutoFireCadence({ cooldownSeconds: 0, dtSeconds: 2, shotsPerSecond: 20 }), {
    dueShots: 3,
    cooldownSeconds: 0.05,
  });
});

test('planWave2Dash is deterministic and bounded for replay verification', () => {
  const profile = buildWave2GameFeelProfile();
  const a = planWave2Dash({ x: 10, y: 20 }, { x: 3, y: 4 }, { profile, elapsedSeconds: 12.345 });
  const b = planWave2Dash({ x: 10, y: 20 }, { x: 3, y: 4 }, { profile, elapsedSeconds: 12.345 });

  assert.deepEqual(a, b);
  assert.ok(a.distance <= profile.dash.distance);
  assert.ok(a.durationFrames >= 8 && a.durationFrames <= 14);
  assert.equal(a.replayTag, 'wave2-dash-v1');
});

test('planWave2KnockbackRecovery clamps hit-stop and recovery for readable swarms', () => {
  const profile = buildWave2GameFeelProfile({ accessibility: { reducedMotion: true } });
  const light = planWave2KnockbackRecovery({ damage: 8, armored: false, sourceType: 'bullet' }, { profile });
  const heavy = planWave2KnockbackRecovery({ damage: 30, armored: false, sourceType: 'explosion' }, { profile });
  const armored = planWave2KnockbackRecovery({ damage: 30, armored: true, sourceType: 'explosion' }, { profile });

  assert.ok(heavy.knockbackSpeed > light.knockbackSpeed);
  assert.ok(armored.knockbackSpeed < heavy.knockbackSpeed);
  assert.ok(heavy.hitStopFrames <= WAVE2_GAME_FEEL_TARGETS.maxHitStopFrames);
  assert.ok(heavy.screenShake <= profile.recovery.maxScreenShake);
  assert.equal(heavy.replayTag, 'wave2-recovery-v1');
});

test('runtime consumes Wave 2 game-feel profile for live roguelike movement', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /buildWave2GameFeelProfile/);
  assert.match(main, /integrateWave2Movement/);
  assert.match(main, /WAVE2_GAME_FEEL_PROFILE/);
  assert.match(main, /advanceWave2AutoFireCadence/);
  assert.match(main, /combat\.dashFrames = WAVE2_GAME_FEEL_PROFILE\.dash\.durationFrames/);
  assert.match(main, /WAVE2_GAME_FEEL_PROFILE\.dash\.invulnerabilityFrames/);
});
