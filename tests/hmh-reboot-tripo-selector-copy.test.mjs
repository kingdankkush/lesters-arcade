import assert from 'node:assert/strict';
import test from 'node:test';
import { HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES as heroes } from '../apps/portal/src/hmh-character-config.mjs';

// GP26-B-6 / H-1: direct observations of the owner's reference PNGs.
// These describe identity, not acceptance of a replacement gameplay model.
test('Commando selector bio preserves the mullet, neckerchief and rolled olive sleeves', () => {
  const bio = heroes['lit-commando'].bio;
  assert.match(bio, /dark mullet/i);
  assert.match(bio, /red neckerchief/i);
  assert.match(bio, /olive.*rolled sleeves/i);
  assert.doesNotMatch(bio, /mohawk|headband|cyan.visor|silver tactical/i);
});

test('Valkyrie selector bio preserves wavy blonde hair, red headband and olive cropped tank', () => {
  const bio = heroes['lit-valkyrie'].bio;
  assert.match(bio, /long wavy blonde hair/i);
  assert.match(bio, /red headband/i);
  assert.match(bio, /olive cropped tank/i);
  assert.doesNotMatch(bio, /short teal hair|ponytail|braid|cape|quiver/i);
});

test('Lester selector bio identifies a spherical mascot head rather than a flat coin or helmet', () => {
  const bio = heroes['lester-original'].bio;
  assert.match(bio, /cobalt-blue spherical mascot head/i);
  assert.match(bio, /Litecoin mark/i);
  assert.match(bio, /blue scarf.*olive vest/i);
  assert.doesNotMatch(bio, /coin head|helmet|permanent wink/i);
});

test('Lilly selector bio preserves her glasses and long gold-trimmed teal coat', () => {
  const bio = heroes.lilly.bio;
  assert.match(bio, /wavy teal hair/i);
  assert.match(bio, /round tinted glasses/i);
  assert.match(bio, /long gold-trimmed teal coat/i);
  assert.doesNotMatch(bio, /cropped jacket|short coat|gold\/teal armor/i);
});
