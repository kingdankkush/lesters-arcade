import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARCADE_AVATARS, CUSTOM_AVATAR_PATH, customAvatarUrl, customAvatarUrlFor, defaultArcadeAvatar, resolveAvatar,
} from '../apps/portal/src/arcade-avatars.mjs';

/**
 * 1.9.3: one avatar resolver for every surface (boards, podium, profiles, the
 * name editor chip). Custom upload first, then the on-chain preset, then the
 * default; the custom URL is only ever the same-origin /api/avatar path.
 */

const WALLET = `0x${'ab'.repeat(20)}`;
const SHA = 'c0ffee'.repeat(10) + 'c0ff';
const URL_OK = `/api/avatar?wallet=${WALLET}&v=${SHA.slice(0, 12)}`;

test('customAvatarUrlFor builds the versioned same-origin URL', () => {
  assert.equal(CUSTOM_AVATAR_PATH, '/api/avatar');
  assert.equal(customAvatarUrlFor(WALLET.toUpperCase().replace('0X', '0x'), SHA.toUpperCase()), URL_OK);
  for (const [wallet, sha] of [[WALLET, null], [WALLET, 'abc'], ['0x12', SHA], [null, SHA], [WALLET, `${SHA}0`]]) {
    assert.equal(customAvatarUrlFor(wallet, sha), null, `${wallet} ${sha}`);
  }
});

test('customAvatarUrl accepts only the exact same-origin upload path', () => {
  assert.equal(customAvatarUrl(URL_OK), URL_OK);
  for (const value of [
    null, '', 'https://lestersarcade.io' + URL_OK, `//evil.example${URL_OK}`, 'https://evil.example/x.png', 'javascript:alert(1)',
    `${URL_OK}&x=1`, `${URL_OK}#x`, `/api/avatar?v=${SHA.slice(0, 12)}&wallet=${WALLET}`, `/api/avatar?wallet=${WALLET.toUpperCase()}&v=${SHA.slice(0, 12)}`,
    `/api/avatar?wallet=${WALLET}&v=${SHA.slice(0, 11)}`, 'data:image/png;base64,AAAA', './assets/lester-pilot.svg',
  ]) assert.equal(customAvatarUrl(value), null, String(value));
});

test('resolveAvatar prefers the upload, then the preset, then the default', () => {
  const lilly = ARCADE_AVATARS.find((avatar) => avatar.id === 'lilly');
  assert.deepEqual({ ...resolveAvatar({ avatarUrl: URL_OK, avatarUri: 'lestersarcade:avatar/lilly' }) }, { src: URL_OK, alt: 'Player avatar', kind: 'custom' });
  assert.deepEqual({ ...resolveAvatar({ avatarUri: 'lestersarcade:avatar/lilly' }) }, { src: lilly.src, alt: 'Lilly avatar', kind: 'preset' });
  assert.deepEqual({ ...resolveAvatar({ avatarUrl: 'https://evil.example/x.png', avatarUri: 'lestersarcade:avatar/lilly' }) }, { src: lilly.src, alt: 'Lilly avatar', kind: 'preset' }, 'a foreign URL is ignored');
  const fallback = defaultArcadeAvatar();
  assert.equal(fallback.id, 'litecoin-chad');
  for (const entry of [{}, null, undefined, { avatarUri: 'lestersarcade:avatar/mythic-emblem' }, { avatarUri: 'lestersarcade:avatar/lester-pilot' }, { avatarUrl: '/api/avatar' }]) {
    assert.deepEqual({ ...resolveAvatar(entry ?? undefined) }, { src: fallback.src, alt: 'Litecoin Chad avatar', kind: 'default' }, JSON.stringify(entry));
  }
});

test('the four retired presets are gone from the picker', () => {
  const ids = ARCADE_AVATARS.map((avatar) => avatar.id);
  assert.deepEqual(ids, ['litecoin-chad', 'lit-commando', 'lit-valkyrie', 'lester', 'lilly', 'chikun']);
  for (const retired of ['lester-pilot', 'gold-emblem', 'diamond-emblem', 'mythic-emblem']) assert.equal(ids.includes(retired), false, retired);
});
