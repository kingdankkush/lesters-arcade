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

test('character slot config is explicit about unresolved canon and keeps the default runtime roster decision configurable', () => {
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.rosterDecisionStatus, 'pending-justin-confirmation');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.directionMode, '8-direction-backbone');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId, 'lester');
  assert.equal(HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.levelOneUnlockLegacyId, 'lilly');
});

test('buildCharacterUnlockMap supports flipping starter and Level 1 unlock roles without changing stable legacy ids', () => {
  const alt = {
    ...HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
    starterLegacyId: 'lilly',
    levelOneUnlockLegacyId: 'lester',
  };
  const locked = buildCharacterUnlockMap({ achievements: [] }, alt);
  const unlocked = buildCharacterUnlockMap({ achievements: ['getaway-clear'] }, alt);

  assert.deepEqual(locked, { lilly: true, lester: false });
  assert.deepEqual(unlocked, { lilly: true, lester: true });
});

test('syncConfiguredCharacterUnlocks initializes profile unlocks and selected character preference', () => {
  const profile = { achievements: [] };
  const unlocks = syncConfiguredCharacterUnlocks(profile);
  assert.equal(unlocks.lester, true);
  assert.equal(unlocks.lilly, false);
  assert.equal(profile.preferences.selectedCharacterId, 'lester');
});

test('setPreferredCharacter persists only unlocked characters and resolveSelectedCharacterId falls back safely', () => {
  const profile = { achievements: [], preferences: { selectedCharacterId: 'lilly' } };
  syncConfiguredCharacterUnlocks(profile);

  assert.equal(resolveSelectedCharacterId(profile), 'lester');
  assert.deepEqual(setPreferredCharacter(profile, 'lilly'), { ok: false, reason: 'locked', selectedCharacterId: 'lester' });
  profile.achievements.push('getaway-clear');
  syncConfiguredCharacterUnlocks(profile);
  assert.deepEqual(setPreferredCharacter(profile, 'lilly'), { ok: true, selectedCharacterId: 'lilly' });
  assert.equal(resolveSelectedCharacterId(profile), 'lilly');
});

test('buildCharacterSelectEntries emits level-clear lock copy for the configured unlockable hero', () => {
  const entries = buildCharacterSelectEntries([
    { id: 'lester', name: 'Lit Commando' },
    { id: 'lilly', name: 'Lit Valkyrie' },
  ], { achievements: [] });
  const lester = entries.find((entry) => entry.legacyId === 'lester');
  const lilly = entries.find((entry) => entry.legacyId === 'lilly');

  assert.equal(lester.locked, false);
  assert.equal(lester.cta.includes('SELECT'), true);
  assert.equal(lilly.locked, true);
  assert.equal(lilly.cta, 'CLEAR LEVEL 1 TO UNLOCK');
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
