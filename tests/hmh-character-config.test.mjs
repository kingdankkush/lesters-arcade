import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
  HMH_PLAYABLE_CHARACTER_VISUAL_KITS,
  HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES,
  buildCharacterSelectEntries,
  buildCharacterStatIdentityRoster,
  buildCharacterUnlockMap,
  playableCharacterStatIdentityFor,
  playableCharacterVisualKitFor,
  resolveSelectedCharacterId,
  setPreferredCharacter,
  syncConfiguredCharacterUnlocks,
} from '../apps/portal/src/hmh-character-config.mjs';

import {
  HERO_STARTING_STAT_MODIFIERS,
  createRoguelikeRunState,
} from '../apps/portal/src/arcade-core.mjs';

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

test('WO-53 playable character stat identities are data-driven and map to sim multipliers', () => {
  const ids = Object.keys(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES);
  assert.deepEqual(ids, ['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);

  const roster = buildCharacterStatIdentityRoster();
  assert.equal(roster.length, 4);
  assert.equal(roster.every((entry) => entry.statTruthSource === 'hmh-character-config'), true);
  assert.equal(roster.every((entry) => entry.stats.length === 4), true);
  assert.equal(roster.every((entry) => entry.simMultipliers && entry.combatStats && entry.viability.ok === true), true);

  assert.equal(playableCharacterStatIdentityFor('lit-commando').simMultipliers.maxHealth, 1.2);
  assert.equal(playableCharacterStatIdentityFor('lit-valkyrie').simMultipliers.movementSpeed, 1.15);
  assert.equal(playableCharacterStatIdentityFor('lester').id, 'lester-original');
  assert.equal(playableCharacterStatIdentityFor('unknown-character'), null);
});

test('WO-53 select entries override stale card data with truthful central stats and unlock state', () => {
  const entries = buildCharacterSelectEntries([
    { id: 'lit-commando', name: 'Wrong Name', tagline: 'Wrong', bio: 'Wrong', stats: [['Power', 1]] },
    { id: 'lit-valkyrie' },
    { id: 'lester-original' },
    { id: 'lilly' },
  ], { achievements: ['getaway-clear'], preferences: { selectedCharacterId: 'lester-original' } });
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));

  assert.equal(byId['lit-commando'].name, playableCharacterStatIdentityFor('lit-commando').name);
  assert.deepEqual(byId['lit-commando'].stats, playableCharacterStatIdentityFor('lit-commando').stats);
  assert.deepEqual(byId['lit-valkyrie'].simMultipliers, playableCharacterStatIdentityFor('lit-valkyrie').simMultipliers);
  assert.equal(byId['lester-original'].locked, false);
  assert.equal(byId['lester-original'].selected, true);
  assert.equal(byId.lilly.locked, true);
  assert.equal(byId.lilly.unlockDescription.includes('10 ranked'), true);
});

test('WO-53 unlock persistence and roguelike sim stats resolve from the same character identity source', () => {
  const profile = { achievements: [], totalPaidRuns: 10, preferences: { selectedCharacterId: 'lilly' } };
  syncConfiguredCharacterUnlocks(profile);
  assert.equal(profile.unlocks.characters.lilly, true);
  assert.equal(resolveSelectedCharacterId(profile), 'lilly');
  assert.deepEqual(setPreferredCharacter(profile, 'lilly'), { ok: true, selectedCharacterId: 'lilly' });

  for (const identity of buildCharacterStatIdentityRoster()) {
    assert.deepEqual(HERO_STARTING_STAT_MODIFIERS[identity.id], identity.simMultipliers);
    const run = createRoguelikeRunState({ characterId: identity.id, seed: 53 });
    for (const [stat, multiplier] of Object.entries(identity.simMultipliers)) {
      assert.equal(Number(run.stats[stat].toFixed(4)), Number(multiplier.toFixed(4)), `${identity.id}/${stat} should match identity sim multiplier`);
    }
    assert.equal(run.statTruthSource, 'hmh-character-config');
  }
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

  assert.equal(HMH_PLAYABLE_CHARACTER_VISUAL_KITS['lester-original'].source, 'animated-roster');
  assert.equal(HMH_PLAYABLE_CHARACTER_VISUAL_KITS['lester-original'].manifestPath, './assets/generated/hmh-animated-roster/hmh-animated-roster.mjs');
  assert.equal(HMH_PLAYABLE_CHARACTER_VISUAL_KITS.lilly.productionStatus.includes('Justin reference sprites'), true);
});
