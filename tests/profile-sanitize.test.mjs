import assert from 'node:assert/strict';
import test from 'node:test';
import { ethers } from 'ethers';

import { PREFERENCES_MAX_BYTES, sanitizeOnchainProfile, sanitizePreferences } from '../server/profile/sanitize.mjs';

/**
 * Contract §8.4, §4.3.6 and A29: on-chain names and avatars are re-checked on
 * the server, and preferences are the only profile field the browser writes.
 */

const profileAbi = new ethers.Interface(['function getProfile(address wallet) view returns ((bytes32 handle, string displayName, string avatarUri, uint256 createdAt, uint256 lastUpdated, bool exists))']);

test('on-chain profiles are mirrored through the charset, moderation and avatar rules', () => {
  const handle = ethers.id('lit pilot');
  const encoded = profileAbi.encodeFunctionResult('getProfile', [[handle, 'Lit  Pilot', 'lestersarcade:avatar/lester', 1n, 2n, true]]);
  const [result] = profileAbi.decodeFunctionResult('getProfile', encoded);
  assert.deepEqual(sanitizeOnchainProfile(result), { displayName: 'Lit Pilot', nameBlocked: null, handleHash: handle, avatarUri: 'lestersarcade:avatar/lester' }, 'an ethers Result is accepted');
  const cases = [
    [{ displayName: 'ab', exists: true }, null, null],
    [{ displayName: 'x'.repeat(19), exists: true }, null, null],
    [{ displayName: 'emoji 🎮', exists: true }, null, null],
    [{ displayName: 'Official Lester', exists: true }, null, 'impersonation'],
    [{ displayName: 'b1tch', exists: true }, null, 'profanity'],
    [{ displayName: ' Ace_Pilot.99 ', exists: true }, 'Ace_Pilot.99', null],
  ];
  for (const [input, displayName, nameBlocked] of cases) {
    const out = sanitizeOnchainProfile({ handle: `0x${'00'.repeat(32)}`, avatarUri: 'lestersarcade:avatar/UPPER', ...input });
    assert.deepEqual([out.displayName, out.nameBlocked, out.handleHash, out.avatarUri], [displayName, nameBlocked, null, null], input.displayName);
  }
  assert.equal(sanitizeOnchainProfile({ displayName: 'Lit Pilot', avatarUri: 'javascript:alert(1)', exists: true }).avatarUri, null);
  assert.equal(sanitizeOnchainProfile(null).displayName, null);
});

test('preferences keep only the declared keys and fit in 2 KB', () => {
  assert.deepEqual(sanitizePreferences({
    selectedCharacterId: 'lit-valkyrie',
    cosmetics: { chikun: { coat: 'gold-coat', hat: 'crown', 'Bad Slot': 'x', trail: 42 }, stacked: { 'piece-skin': 'neon' }, tetris: { a: 'b' } },
    nameClaimDismissed: true,
    displayName: 'Hacker',
    avatarUri: 'lestersarcade:avatar/x',
    stats: { score: 1e9 },
  }), {
    selectedCharacterId: 'lit-valkyrie',
    cosmetics: { chikun: { coat: 'gold-coat', hat: 'crown' }, stacked: { 'piece-skin': 'neon' } },
    nameClaimDismissed: true,
  });
  assert.deepEqual(sanitizePreferences({ selectedCharacterId: 'Bad Id!', nameClaimDismissed: 'yes' }), {});
  assert.deepEqual(sanitizePreferences({ selectedCharacterId: 'x'.repeat(33) }), {});
  assert.equal(sanitizePreferences(null), null);
  assert.equal(sanitizePreferences([]), null);
  assert.equal(sanitizePreferences('prefs'), null);
  const slots = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`slot-${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, `cosmetic-${'x'.repeat(30)}`]));
  const oversized = sanitizePreferences({ cosmetics: { chikun: slots } });
  assert.equal(oversized, null, `a result above ${PREFERENCES_MAX_BYTES} bytes is rejected`);
});
