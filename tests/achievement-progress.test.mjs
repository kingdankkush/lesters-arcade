import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ACHIEVEMENTS, buildPlayerArcadeSnapshot, createInitialArcadeState, createPlayerProfile, unlockAchievement } from '../apps/portal/src/arcade-core.mjs';
import { restoreArcadeState, snapshotArcadeState } from '../apps/portal/src/persistence.mjs';

const wallet = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const at = '2026-09-10T05:00:00.000Z';
const first = ACHIEVEMENTS.FIRST_1000_POINTS.id;
function setup() {
  const state = createInitialArcadeState();
  const profile = createPlayerProfile(wallet);
  state.profiles[wallet] = profile;
  return { state, profile, progress: profile.progress['lester-blaster'] };
}
const row = (state, id = first) => buildPlayerArcadeSnapshot(state, wallet).achievements.find((a) => a.id === id);

test('parent records the new unlock date once and preserves it on duplicate requests', () => {
  const { state, profile } = setup();
  assert.equal(unlockAchievement(profile, first, { occurredAt: at }), true);
  assert.equal(row(state).unlockedAt, at);
  assert.equal(unlockAchievement(profile, first, { occurredAt: '2026-09-11T00:00:00.000Z' }), false);
  assert.equal(row(state).unlockedAt, at);
  assert.equal(profile.achievements.filter((id) => id === first).length, 1);
});

test('ordinary two-argument parent unlock records a valid current UTC observation', () => {
  const { state, profile } = setup();
  const before = Date.now();
  unlockAchievement(profile, first);
  const date = row(state).unlockedAt;
  assert.ok(typeof date === 'string' && Number.isFinite(Date.parse(date)));
  assert.ok(Date.parse(date) >= before && Date.parse(date) <= Date.now());
});

test('legacy unlocked IDs are not backdated on snapshot, reconnect-style reads, or duplicate unlocks', () => {
  const { state, profile } = setup();
  profile.achievements.push(first);
  assert.equal(row(state).unlockedAt, null);
  assert.equal(unlockAchievement(profile, first, { occurredAt: at }), false);
  assert.equal(row(state).unlockedAt, null);
  assert.equal(profile.achievementUnlockedAt?.[first], undefined);
});

test('invalid explicit unlock timestamps are rejected before any new achievement mutation', () => {
  for (const occurredAt of [null, '', 0, 'today', '2026-02-30T00:00:00.000Z']) {
    const { profile } = setup();
    const before = structuredClone(profile);
    assert.throws(() => unlockAchievement(profile, first, { occurredAt }), /timestamp/i);
    assert.deepEqual(profile, before);
  }
});

test('unlock date metadata survives actual save/restore and cannot unlock another wallet', () => {
  const { state, profile } = setup();
  unlockAchievement(profile, first, { occurredAt: at });
  state.profiles[other] = createPlayerProfile(other);
  const restored = createInitialArcadeState();
  assert.equal(restoreArcadeState(restored, JSON.parse(JSON.stringify(snapshotArcadeState(state)))), true);
  assert.equal(row(restored).unlockedAt, at);
  const otherRow = buildPlayerArcadeSnapshot(restored, other).achievements.find((a) => a.id === first);
  assert.equal(otherRow.unlocked, false);
  assert.equal(otherRow.unlockedAt, null);
});

test('invalid cached date metadata never renders as an observed unlock date', () => {
  const { state, profile } = setup();
  profile.achievements.push(first);
  for (const value of ['bad-date', 0, {}, '2026-02-30T00:00:00.000Z']) {
    profile.achievementUnlockedAt = { [first]: value };
    assert.equal(row(state).unlockedAt, null);
  }
});

test('score meter uses recorded Ranked score and the live catalog threshold, never Free best', () => {
  const { state, progress } = setup();
  progress.bestPaidScore = 250;
  progress.bestFreeScore = 999999;
  assert.deepEqual(row(state).progress, { status: 'measured', value: 250, target: 1000, fraction: 0.25, unit: 'best Ranked score' });
});

test('measured zero is distinct from missing, malformed or nonfinite progress', () => {
  const { state, progress } = setup();
  progress.bestPaidScore = 0;
  assert.equal(row(state).progress.value, 0);
  for (const value of [undefined, null, -1, Infinity, NaN, '500']) {
    progress.bestPaidScore = value;
    assert.deepEqual(row(state).progress, { status: 'unavailable' });
  }
});

test('above-threshold local progress clamps only the meter and never grants an achievement', () => {
  const { state, profile, progress } = setup();
  progress.bestPaidScore = 2000;
  const before = structuredClone(profile);
  const achievement = row(state);
  assert.equal(achievement.progress.fraction, 1);
  assert.equal(achievement.progress.value, 2000);
  assert.equal(achievement.unlocked, false);
  assert.deepEqual(profile, before);
});

test('cumulative meters use real aggregates without estimating from local summary cache', () => {
  const { state, progress } = setup();
  progress.totalKills = 125;
  state.runHistory = [];
  const a = row(state, ACHIEVEMENTS.ENEMY_REAPER_250.id);
  assert.deepEqual(a.progress, { status: 'measured', value: 125, target: 250, fraction: 0.5, unit: 'total kills' });
  assert.deepEqual(row(state, ACHIEVEMENTS.TEN_ENEMY_KILLS.id).progress, { status: 'unavailable' }, 'one-run kills cannot use cumulative kills');
});

test('single survival and combo thresholds use current parent measurements', () => {
  const { state, progress } = setup();
  progress.longestRunSeconds = 150;
  progress.maxCombo = 3;
  assert.equal(row(state, ACHIEVEMENTS.FIVE_MINUTE_RUN.id).progress.fraction, 0.5);
  assert.equal(row(state, ACHIEVEMENTS.COMBO_STARTER.id).progress.value, 3);
});

test('compound, legacy-role and unrecorded conditions are explicitly unavailable', () => {
  const { state, progress } = setup();
  progress.longestRunSeconds = 1000;
  progress.maxCombo = 99;
  progress.totalKills = 999;
  for (const id of [ACHIEVEMENTS.NO_DAMAGE_10_MINUTES.id, ACHIEVEMENTS.GAS_BEAST_HUNTER.id, ACHIEVEMENTS.SPEED_CLEAR.id]) {
    assert.deepEqual(row(state, id).progress, { status: 'unavailable' });
  }
});

test('every catalog projection remains explicit, with no mint or verified-status authority', () => {
  const { state } = setup();
  const rows = buildPlayerArcadeSnapshot(state, wallet).achievements;
  assert.equal(rows.length, Object.keys(ACHIEVEMENTS).length);
  assert.ok(rows.every((a) => a.progress?.status === 'measured' || a.progress?.status === 'unavailable'));
  assert.ok(rows.every((a) => a.unlockedAt === null));
  assert.ok(rows.every((a) => !a.minted && !a.verified));
});

test('completed Ranked volume uses the parent all-game completion counter, not started or Free runs', () => {
  const { state, profile, progress } = setup();
  profile.totalPaidRuns = 3;
  profile.totalFreeRuns = 999;
  progress.paidRuns = 1;
  const a = row(state, ACHIEVEMENTS.TEN_PAID_RUNS.id);
  assert.deepEqual(a.progress, { status: 'measured', value: 3, target: 10, fraction: 0.3, unit: 'completed Ranked runs (all games)' });
});

test('invalid explicit timestamps fail for dated duplicates and legacy unlocks without changing either record', () => {
  for (const legacy of [false, true]) {
    const { profile } = setup();
    const id = first;
    if (legacy) profile.achievements.push(id);
    else unlockAchievement(profile, id, { occurredAt: '2026-09-10T05:00:00.000Z' });
    const before = structuredClone(profile);
    assert.throws(() => unlockAchievement(profile, id, { occurredAt: 'not-a-date' }), /timestamp|date|occurredAt/i);
    assert.deepEqual(profile, before);
  }
});

test('new achievement source and test participate in the explicit syntax gate', () => {
  const source = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('"apps/portal/src/achievement-progress.mjs"'));
  assert.ok(source.includes('"tests/achievement-progress.test.mjs"'));
});
