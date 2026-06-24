import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
  HMH_PLAYABLE_CHARACTER_VISUAL_KITS,
  buildCharacterSelectEntries,
  buildCharacterUnlockMap,
  playableCharacterVisualKitFor,
  resolveSelectedCharacterId,
  setPreferredCharacter,
  syncConfiguredCharacterUnlocks,
} from '../apps/portal/src/hmh-character-config.mjs';

test('character slot config keeps Lit Commando and Lit Valkyrie as starters, Lester and Lilly as unlockables', () => {
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.rosterDecisionStatus, 'resolved-commando-valkyrie-starters-lester-lilly-unlockables');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.directionMode, '8-direction-backbone');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId, 'lit-commando');
  assert.deepEqual([...HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.startersLegacyIds], ['lit-commando', 'lit-valkyrie']);
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.levelOneUnlockCharacterId, 'lester-original');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.levelOneUnlockAchievementId, 'getaway-clear');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.levelOneUnlockTitle, 'Lester');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.tenRankedUnlockCharacterId, 'lilly');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.tenRankedUnlockAchievementId, 'ten-paid-runs');
});

test('buildCharacterUnlockMap keeps starters unlocked and gates Lester/Lilly behind their requirements', () => {
  const locked = buildCharacterUnlockMap({ achievements: [] });
  const levelOneUnlocked = buildCharacterUnlockMap({ achievements: ['getaway-clear'] });
  const rankedUnlocked = buildCharacterUnlockMap({ achievements: ['ten-paid-runs'] });
  const rankedByProgress = buildCharacterUnlockMap({ achievements: [], totalPaidRuns: 10 });

  // Starters always unlocked.
  assert.equal(locked['lit-commando'], true);
  assert.equal(locked['lit-valkyrie'], true);

  // Unlockables are gated separately.
  assert.equal(locked['lester-original'], false);
  assert.equal(locked.lilly, false);
  assert.equal(levelOneUnlocked['lester-original'], true);
  assert.equal(levelOneUnlocked.lilly, false);
  assert.equal(rankedUnlocked.lilly, true);
  assert.equal(rankedByProgress.lilly, true);
});

test('syncConfiguredCharacterUnlocks initializes starters and a safe default selection', () => {
  const profile = { achievements: [] };
  const unlocks = syncConfiguredCharacterUnlocks(profile);
  assert.equal(unlocks['lit-commando'], true);
  assert.equal(unlocks['lit-valkyrie'], true);
  assert.equal(profile.preferences.selectedCharacterId, 'lit-commando');
});

test('setPreferredCharacter persists unlocked characters and rejects locked unlockables', () => {
  const profile = { achievements: [], preferences: { selectedCharacterId: 'lit-valkyrie' } };
  syncConfiguredCharacterUnlocks(profile);

  assert.equal(resolveSelectedCharacterId(profile), 'lit-valkyrie');
  assert.deepEqual(setPreferredCharacter(profile, 'lit-valkyrie'), { ok: true, selectedCharacterId: 'lit-valkyrie' });
  assert.deepEqual(setPreferredCharacter(profile, 'lit-commando'), { ok: true, selectedCharacterId: 'lit-commando' });
  assert.deepEqual(setPreferredCharacter(profile, 'lilly'), { ok: false, reason: 'locked', selectedCharacterId: 'lit-commando' });

  profile.achievements.push('ten-paid-runs');
  assert.deepEqual(setPreferredCharacter(profile, 'lilly'), { ok: true, selectedCharacterId: 'lilly' });
});

test('buildCharacterSelectEntries keeps starters playable and shows unlock CTAs for Lester/Lilly', () => {
  const entries = buildCharacterSelectEntries([
    { id: 'lit-commando', name: 'Lit Commando' },
    { id: 'lit-valkyrie', name: 'Lit Valkyrie' },
    { id: 'lester-original', name: 'Lester' },
    { id: 'lilly', name: 'Lilly' },
  ], { achievements: [] });
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));

  assert.equal(byId['lit-commando'].locked, false);
  assert.equal(byId['lit-commando'].cta.includes('SELECT'), true);
  assert.equal(byId['lit-valkyrie'].locked, false);
  assert.equal(byId['lit-valkyrie'].cta.includes('SELECT'), true);
  assert.equal(byId['lester-original'].locked, true);
  assert.equal(byId['lester-original'].cta, 'CLEAR LEVEL 1 TO UNLOCK');
  assert.equal(byId.lilly.locked, true);
  assert.equal(byId.lilly.cta, 'PLAY 10 RANKED MATCHES TO UNLOCK');
});

test('playable character visual kit metadata exposes repo-local manifests and direction mode', () => {
  for (const id of ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']) {
    const kit = playableCharacterVisualKitFor(id);
    assert.equal(kit.directionMode, '8-direction-backbone');
    assert.equal(kit.states.includes('run'), true);
    const assetPath = fileURLToPath(new URL(`../apps/portal/${kit.manifestPath.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${id} manifest path exists`);
  }

  assert.equal(HMH_PLAYABLE_CHARACTER_VISUAL_KITS['lester-original'].productionStatus.includes('reference locked'), true);
  assert.equal(HMH_PLAYABLE_CHARACTER_VISUAL_KITS.lilly.productionStatus.includes('Justin reference sprites'), true);
});
