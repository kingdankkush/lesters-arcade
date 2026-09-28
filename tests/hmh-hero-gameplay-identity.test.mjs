import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES,
  playableCharacterStatIdentityFor,
} from '../apps/portal/src/hmh-character-config.mjs';
import { createRoguelikeRunState } from '../apps/portal/src/arcade-core.mjs';

const playRoutesSource = readFileSync(new URL('../apps/portal/src/routes/official-play-routes.mjs', import.meta.url), 'utf8');

// 1.9.2 (owner 2026-09-27): every hero starts with the Pistol and has one
// unique perk; stats are the runtime table in apps/hmh-reboot/src/hero-loadout.mjs.
const EXPECTED_PERKS = Object.freeze({
  'lit-commando': 'reserve-plating',
  'lit-valkyrie': 'velocity-trigger',
  'lester-original': 'block-time',
  lilly: 'zero-knowledge-crits',
});

test('all four heroes start with the Pistol and carry one distinct perk', () => {
  const identities = Object.values(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES);
  assert.equal(identities.length, 4);
  assert.equal(new Set(identities.map((identity) => identity.passive.id)).size, 4);
  for (const identity of identities) {
    assert.equal(identity.startingWeaponId, 'coin-blaster');
    assert.equal(identity.startingWeaponTitle, 'The Pistol');
    assert.equal(identity.passive.id, EXPECTED_PERKS[identity.id]);
    assert.equal(typeof identity.passive.description, 'string');
    assert.ok(identity.bio.includes('Forked Frontier'), `${identity.id} bio tells how they reached Level 1`);
  }
});

test('hero stat multipliers still flow into the legacy roguelike run state', () => {
  const commando = createRoguelikeRunState({ characterId: 'lit-commando', seed: 1 });
  const valkyrie = createRoguelikeRunState({ characterId: 'lit-valkyrie', seed: 1 });
  assert.equal(commando.stats.maxHealth, 1.2);
  assert.equal(commando.stats.incomingDamage, 0.9);
  assert.equal(valkyrie.stats.movementSpeed, 1.08);
});

test('the hero select shows the loadout and perk', () => {
  assert.match(playRoutesSource, /hero-loadout/);
  assert.match(playRoutesSource, /hero\.passive\.description/);
  assert.match(playRoutesSource, /STARTING STATS/);
});

test('Lester aliases resolve to the same gameplay identity', () => {
  assert.equal(playableCharacterStatIdentityFor('lester').id, 'lester-original');
  assert.equal(playableCharacterStatIdentityFor('lester').startingWeaponId, 'coin-blaster');
});
