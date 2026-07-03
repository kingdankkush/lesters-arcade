import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateRunPlausibility,
  deriveRunCeilings,
  MIN_BOSS_CLEAR_SECONDS,
  INTEGRITY_TOLERANCE,
  buildReplayVerificationEnvelope,
} from '../apps/portal/src/hmh-run-integrity.mjs';
import { HMH_LEVEL_ONE_PLAYTEST_BALANCE } from '../apps/portal/src/arcade-core.mjs';

// --- ceilings track the balance constants, not magic numbers ---------------

test('deriveRunCeilings scales kills with survival time and spawn cap', () => {
  const short = deriveRunCeilings({ survivalSeconds: 60 });
  const full = deriveRunCeilings({ survivalSeconds: 25 * 60 });
  assert.ok(full.maxKills > short.maxKills, 'longer run allows more kills');
  // the standing spawn cap is included as a floor
  assert.ok(short.maxKills >= HMH_LEVEL_ONE_PLAYTEST_BALANCE.director.maxEnemiesCap);
});

test('deriveRunCeilings with zero time still returns finite non-negative bounds', () => {
  const c = deriveRunCeilings({ survivalSeconds: 0 });
  assert.ok(Number.isFinite(c.maxScore) && c.maxScore >= 0);
  assert.ok(Number.isFinite(c.maxKills) && c.maxKills >= 0);
});

// --- a realistic full run passes cleanly ------------------------------------

test('a realistic 8-minute swarm-fighter run is OK', () => {
  // ~20 kills/min over 8 min ≈ 160 kills, a plausible score, cleared the boss.
  const r = validateRunPlausibility({
    score: 42_000,
    kills: 165,
    maxCombo: 40,
    survivalSeconds: 480,
    totalXp: 3200,
    bossDefeated: true,
    level: 1,
  });
  assert.equal(r.verdict, 'ok', `expected ok, got ${r.verdict}: ${JSON.stringify(r.flags)}`);
  assert.equal(r.ok, true);
  assert.equal(r.rankable, true);
  assert.equal(r.flags.length, 0);
});

test('a modest short run is OK', () => {
  const r = validateRunPlausibility({
    score: 1500, kills: 12, maxCombo: 6, survivalSeconds: 90, bossDefeated: false,
  });
  assert.equal(r.verdict, 'ok');
});

// --- hard impossibilities are rejected --------------------------------------

test('score/kills with zero elapsed time is rejected', () => {
  const r = validateRunPlausibility({ score: 5_000_000, kills: 9999, survivalSeconds: 0 });
  assert.equal(r.verdict, 'rejected');
  assert.equal(r.rankable, false);
  assert.ok(r.flags.some((f) => f.code === 'no-time-with-progress'));
});

test('boss clear below the minimum possible time is rejected', () => {
  const r = validateRunPlausibility({
    score: 8000, kills: 40, survivalSeconds: MIN_BOSS_CLEAR_SECONDS - 5, bossDefeated: true,
  });
  assert.equal(r.verdict, 'rejected');
  assert.ok(r.flags.some((f) => f.code === 'boss-clear-too-fast'));
});

test('boss clear at or above the minimum time is not rejected for timing', () => {
  const r = validateRunPlausibility({
    score: 9000, kills: 55, maxCombo: 20, survivalSeconds: MIN_BOSS_CLEAR_SECONDS + 5, bossDefeated: true,
  });
  assert.ok(!r.flags.some((f) => f.code === 'boss-clear-too-fast'));
});

test('a combo far exceeding kills is rejected', () => {
  const r = validateRunPlausibility({
    score: 5000, kills: 10, maxCombo: 5000, survivalSeconds: 120,
  });
  assert.equal(r.verdict, 'rejected');
  assert.ok(r.flags.some((f) => f.code === 'combo-exceeds-kills'));
});

// --- soft implausibilities are flagged suspicious but still rankable --------

test('an implausibly high score for the time is suspicious, not rejected', () => {
  const ceil = deriveRunCeilings({ survivalSeconds: 480 });
  const r = validateRunPlausibility({
    score: Math.ceil(ceil.maxScore * INTEGRITY_TOLERANCE.score) + 1_000_000,
    kills: 150,
    maxCombo: 30,
    survivalSeconds: 480,
    bossDefeated: true,
  });
  assert.equal(r.verdict, 'suspicious');
  assert.equal(r.rankable, true, 'suspicious runs still rank but are flagged');
  assert.ok(r.flags.some((f) => f.code === 'score-implausible'));
});

test('an implausible kill count for the time is suspicious', () => {
  const ceil = deriveRunCeilings({ survivalSeconds: 120 });
  const r = validateRunPlausibility({
    score: 5000,
    kills: Math.ceil(ceil.maxKills * INTEGRITY_TOLERANCE.kills) + 500,
    survivalSeconds: 120,
  });
  assert.equal(r.verdict, 'suspicious');
  assert.ok(r.flags.some((f) => f.code === 'kills-implausible'));
});

test('total XP far exceeding what the kills could yield is suspicious', () => {
  const r = validateRunPlausibility({
    score: 20_000, kills: 100, maxCombo: 25, survivalSeconds: 480,
    totalXp: 999_999, bossDefeated: true,
  });
  assert.equal(r.verdict, 'suspicious');
  assert.ok(r.flags.some((f) => f.code === 'xp-exceeds-kills'));
});

test('omitting totalXp skips the XP check', () => {
  const r = validateRunPlausibility({
    score: 20_000, kills: 100, maxCombo: 25, survivalSeconds: 480, bossDefeated: true,
  });
  assert.ok(!r.flags.some((f) => f.code === 'xp-exceeds-kills'));
});

// --- output shape is frozen + stable ----------------------------------------

test('Wave 2 integrity rejects impossible level claims and suspicious post-cap score without XP proof', () => {
  const overCap = validateRunPlausibility({ score: 20_000, kills: 100, maxCombo: 10, survivalSeconds: 600, level: 81 });
  assert.equal(overCap.verdict, 'rejected');
  assert.ok(overCap.flags.some((f) => f.code === 'level-cap-exceeded'));

  const impossibleCap = validateRunPlausibility({ score: 1_200_000, kills: 10, maxCombo: 5, survivalSeconds: 120, level: 80, postCapScoreBonus: 50_000, totalXp: 800 });
  assert.equal(impossibleCap.verdict, 'suspicious');
  assert.ok(impossibleCap.flags.some((f) => f.code === 'post-cap-score-without-xp'));
});

test('buildReplayVerificationEnvelope freezes deterministic run metadata for future verifier replay', () => {
  const envelope = buildReplayVerificationEnvelope({
    seed: 424242,
    gameVersion: 'hmh-wave2-test',
    survivalSeconds: 1500,
    level: 80,
    totalXp: 64_000,
    postCapScoreBonus: 3000,
    rngDraws: { spawns: 123, drops: 45, draft: 79, boss: 6, crit: 200 },
    inputChecksum: 'abc123',
    eventChecksum: 'def456',
  });

  assert.equal(envelope.version, 'wave2-replay-envelope-v1');
  assert.equal(envelope.seed, 424242);
  assert.equal(envelope.level, 80);
  assert.equal(envelope.postCapScoreBonus, 3000);
  assert.deepEqual(Object.keys(envelope.rngDraws), ['boss', 'crit', 'draft', 'drops', 'spawns']);
  assert.equal(envelope.replayHash.length, 64);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.rngDraws));
});

test('validateRunPlausibility returns a frozen verdict object', () => {
  const r = validateRunPlausibility({ score: 100, kills: 1, survivalSeconds: 10 });
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.flags));
  assert.ok(['ok', 'suspicious', 'rejected'].includes(r.verdict));
});
