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

test('character slot config keeps Lit Commando and Lit Valkyrie as default starters', () => {
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.rosterDecisionStatus, 'resolved-commando-and-valkyrie-starters');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.directionMode, '8-direction-backbone');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId, 'lester');
  assert.deepEqual([...HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.startersLegacyIds], ['lester', 'lilly']);
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.levelOneUnlockLegacyId, null);
});

test('buildCharacterUnlockMap keeps both starter heroes unlocked by default', () => {
  const locked = buildCharacterUnlockMap({ achievements: [] });
  const unlocked = buildCharacterUnlockMap({ achievements: ['getaway-clear'] });

  assert.deepEqual(locked, { lester: true, lilly: true });
  assert.deepEqual(unlocked, { lester: true, lilly: true });
});

test('syncConfiguredCharacterUnlocks initializes both starters and a safe default selection', () => {
  const profile = { achievements: [] };
  const unlocks = syncConfiguredCharacterUnlocks(profile);
  assert.equal(unlocks.lester, true);
  assert.equal(unlocks.lilly, true);
  assert.equal(profile.preferences.selectedCharacterId, 'lester');
});

test('setPreferredCharacter persists either unlocked starter and resolveSelectedCharacterId falls back safely', () => {
  const profile = { achievements: [], preferences: { selectedCharacterId: 'lilly' } };
  syncConfiguredCharacterUnlocks(profile);

  assert.equal(resolveSelectedCharacterId(profile), 'lilly');
  assert.deepEqual(setPreferredCharacter(profile, 'lilly'), { ok: true, selectedCharacterId: 'lilly' });
  assert.deepEqual(setPreferredCharacter(profile, 'lester'), { ok: true, selectedCharacterId: 'lester' });
  profile.preferences.selectedCharacterId = 'unknown-hero';
  assert.equal(resolveSelectedCharacterId(profile), 'lester');
});

test('buildCharacterSelectEntries keeps Lit Commando and Lit Valkyrie playable by default', () => {
  const entries = buildCharacterSelectEntries([
    { id: 'lester', name: 'Lit Commando' },
    { id: 'lilly', name: 'Lit Valkyrie' },
  ], { achievements: [] });
  const lester = entries.find((entry) => entry.legacyId === 'lester');
  const lilly = entries.find((entry) => entry.legacyId === 'lilly');

  assert.equal(lester.locked, false);
  assert.equal(lester.cta.includes('SELECT'), true);
  assert.equal(lilly.locked, false);
  assert.equal(lilly.cta.includes('SELECT'), true);
});

test('playable character visual kit metadata exposes repo-local Lester production manifest and direction mode', () => {
  const lester = playableCharacterVisualKitFor('lester');
  const lilly = playableCharacterVisualKitFor('lilly');
  assert.equal(lester.directionMode, '8-direction-backbone');
  assert.equal(HMH_PLAYABLE_CHARACTER_VISUAL_KITS.lester.states.includes('run'), true);
  assert.equal(lilly.directionMode, '8-direction-backbone');

  for (const kit of [lester, lilly]) {
    const assetPath = fileURLToPath(new URL(`../apps/portal/${kit.manifestPath.replace('./', '')}`, import.meta.url));
    assert.equal(existsSync(assetPath), true, `${kit.legacyId} manifest path exists`);
  }
});
