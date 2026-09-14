import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterUnlockMap, buildCharacterSelectEntries, syncConfiguredCharacterUnlocks } from '../apps/portal/src/hmh-character-config.mjs';
import { createInitialArcadeState, createPlayerProfile, startPlaySession, recordScore } from '../apps/portal/src/arcade-core.mjs';

test('recruitment counts only completed HMH Ranked games at 5 and 10', () => {
  for (const count of [0, 4, 5, 9, 10, 11]) {
    const profile = { totalPaidRuns: 500, progress: { stacked: { paidRuns: 250 }, chikun: { paidRuns: 240 }, 'lester-blaster': { paidRuns: count, freeRuns: 1000 } } };
    const unlocks = buildCharacterUnlockMap(profile);
    assert.equal(unlocks['lester-original'], count >= 5, `Lester at ${count}`);
    assert.equal(unlocks.lilly, count >= 10, `Lilly at ${count}`);
    const entries = buildCharacterSelectEntries([{ id: 'lester-original' }, { id: 'lilly' }], profile);
    assert.equal(entries[0].unlockProgress.current, Math.min(5, count));
    assert.equal(entries[1].unlockProgress.current, Math.min(10, count));
  }
  assert.equal(buildCharacterUnlockMap({ totalPaidRuns: 500 }).lilly, false, 'unscoped history cannot grant a fresh HMH unlock');
  assert.equal(buildCharacterUnlockMap({ progress: { 'lester-blaster': { paidRuns: Infinity } } }).lilly, false);
});

test('completed games stay wallet-bound and a repeated result cannot earn another game', () => {
  const state = createInitialArcadeState(), wallet = `0x${'a'.repeat(40)}`, secondWallet = `0x${'b'.repeat(40)}`;
  let last;
  for (let i = 0; i < 5; i++) {
    last = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
    recordScore(state, last, 300, { elapsedSeconds: 60 });
  }
  assert.equal(state.profiles[wallet].unlocks.characters['lester-original'], true);
  assert.equal(state.profiles[wallet].unlocks.characters.lilly, false);
  assert.throws(() => recordScore(state, last, 300, { elapsedSeconds: 60 }), /already recorded/);
  assert.equal(state.profiles[wallet].progress['lester-blaster'].paidRuns, 5);
  const other = createPlayerProfile(secondWallet);
  assert.equal(other.unlocks.characters['lester-original'], false);
  const restored = JSON.parse(JSON.stringify(state.profiles[wallet]));
  syncConfiguredCharacterUnlocks(restored);
  assert.equal(restored.unlocks.characters['lester-original'], true);
});

test('earned characters survive migration when older scoped counts are absent', () => {
  const profile = { unlocks: { characters: { 'lester-original': true, lilly: true } }, preferences: { selectedCharacterId: 'lilly' } };
  syncConfiguredCharacterUnlocks(profile);
  assert.equal(profile.unlocks.characters.lilly, true);
  assert.equal(profile.preferences.selectedCharacterId, 'lilly');
});
