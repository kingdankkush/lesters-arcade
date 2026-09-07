import assert from 'node:assert/strict';
import test from 'node:test';
import { HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES as heroes } from '../apps/portal/src/hmh-character-config.mjs';

test('selector bios describe the supplied textured hero identities, not retired concept appearances', () => {
  assert.match(heroes['lit-commando'].bio, /mohawk.*olive/i);
  assert.doesNotMatch(heroes['lit-commando'].bio, /cyan.visor|silver tactical/i);
  assert.match(heroes['lit-valkyrie'].bio, /long blonde hair/i);
  assert.doesNotMatch(heroes['lit-valkyrie'].bio, /short teal hair/i);
  assert.match(heroes['lester-original'].bio, /blue coin head/i);
  assert.match(heroes.lilly.bio, /teal hair.*long coat/i);
  assert.doesNotMatch(heroes.lilly.bio, /glasses|gold\/teal armor/i);
});
