import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES,
  playableCharacterStatIdentityFor,
} from '../apps/portal/src/hmh-character-config.mjs';
import { createRoguelikeRunState } from '../apps/portal/src/arcade-core.mjs';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
const playRoutesSource = readFileSync(new URL('../apps/portal/src/routes/official-play-routes.mjs', import.meta.url), 'utf8');

const EXPECTED_LOADOUTS = Object.freeze({
  'lit-commando': 'auto-miner',
  'lit-valkyrie': 'spread-ltc',
  'lester-original': 'coin-blaster',
  lilly: 'scatter-shotgun',
});

test('all four heroes expose distinct starting loadouts passive copy and signature mechanics', () => {
  const identities = Object.values(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES);
  assert.equal(identities.length, 4);
  assert.equal(new Set(identities.map((identity) => identity.startingWeaponId)).size, 4);

  for (const identity of identities) {
    assert.equal(identity.startingWeaponId, EXPECTED_LOADOUTS[identity.id]);
    assert.equal(typeof identity.startingWeaponDurationSeconds, 'number');
    assert.equal(typeof identity.passive?.id, 'string');
    assert.equal(typeof identity.passive?.description, 'string');
    assert.equal(typeof identity.signature?.id, 'string');
    assert.equal(typeof identity.signature?.description, 'string');
  }
});

test('hero passive multipliers flow into the canonical roguelike run state', () => {
  const commando = createRoguelikeRunState({ characterId: 'lit-commando', seed: 1 });
  const valkyrie = createRoguelikeRunState({ characterId: 'lit-valkyrie', seed: 1 });
  const lester = createRoguelikeRunState({ characterId: 'lester-original', seed: 1 });
  const lilly = createRoguelikeRunState({ characterId: 'lilly', seed: 1 });

  assert.equal(commando.stats.maxHealth, 1.2);
  assert.equal(commando.stats.incomingDamage, 0.9);
  assert.equal(valkyrie.stats.movingFireRate, 1.12);
  assert.equal(lester.stats.xpGain, 1.12);
  assert.equal(lilly.stats.luck, 1.15);
});

test('live runtime consumes hero health loadout and signature hooks', () => {
  assert.match(mainSource, /playableCharacterStatIdentityFor/);
  assert.match(mainSource, /combat\.maxHealth = Math\.round\(PLAYER_MAX_HEALTH \* \(combat\.roguelikeRun\.stats\.maxHealth/);
  assert.match(mainSource, /combat\.weaponId = carryOver\?\.weaponId \?\? heroIdentity\.startingWeaponId/);
  assert.match(mainSource, /combat\.powerUpTimers\.weapon = carryOver\?\.weaponId \? 0 : heroIdentity\.startingWeaponDurationSeconds/);
  assert.match(mainSource, /incomingDamageMultiplier = combat\.roguelikeRun\?\.stats\?\.incomingDamage/);
  assert.match(mainSource, /movingFireRateMultiplier/);
  assert.match(mainSource, /bossRecoveryFraction/);
  assert.match(mainSource, /bossScoreMultiplier/);
  assert.match(playRoutesSource, /hero-loadout/);
  assert.match(playRoutesSource, /hero\.passive\.description/);
});

test('Lester aliases resolve to the same gameplay identity', () => {
  assert.equal(playableCharacterStatIdentityFor('lester').id, 'lester-original');
  assert.equal(playableCharacterStatIdentityFor('lester').startingWeaponId, 'coin-blaster');
});
