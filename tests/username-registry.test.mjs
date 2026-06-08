import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateUsername,
  isUsernameAvailable,
  setPlayerUsername,
  resolveDisplayName,
  containsBlockedTerm,
  normalizeForModeration,
  normalizeForUniqueness,
  USERNAME_RULES,
} from '../apps/portal/src/username-registry.mjs';

const WALLET_A = '0x' + 'a'.repeat(40);
const WALLET_B = '0x' + 'b'.repeat(40);

function fakeEnsureProfile(state, wallet) {
  state.profiles ??= {};
  state.profiles[wallet] ??= { wallet, handle: `Player ${wallet.slice(-4)}`, usernameSet: false };
  return state.profiles[wallet];
}

test('username length bounds enforced (3-18)', () => {
  assert.equal(validateUsername('ab').valid, false);
  assert.equal(validateUsername('ab').error, 'too-short');
  assert.equal(validateUsername('a'.repeat(19)).valid, false);
  assert.equal(validateUsername('a'.repeat(19)).error, 'too-long');
  assert.equal(validateUsername('abc').valid, true);
  assert.equal(validateUsername('a'.repeat(18)).valid, true);
  assert.equal(USERNAME_RULES.maxLength, 18);
});

test('username charset restricted to letters/digits/space/_-.', () => {
  assert.equal(validateUsername('Cool Player_1').valid, true);
  assert.equal(validateUsername('bad/name').valid, false);
  assert.equal(validateUsername('emoji😀name').valid, false);
  assert.equal(validateUsername('semi;colon').valid, false);
});

test('vulgar / hate-speech names blocked, including leetspeak + separators', () => {
  assert.equal(validateUsername('fuckface').error, 'blocked-term');
  assert.equal(validateUsername('n1gg3r').error, 'blocked-term');
  assert.equal(validateUsername('f.u.c.k').error, 'blocked-term');
  assert.equal(validateUsername('Hitler88').error, 'blocked-term');
  assert.equal(validateUsername('CleanGamer').valid, true);
  assert.equal(validateUsername('Litecoin Lester').valid, true);
});

test('normalizeForModeration strips separators and maps leetspeak', () => {
  assert.equal(normalizeForModeration('n.1.g.g.3.r'), 'nigger');
  assert.equal(normalizeForModeration('Sh1t_Storm'), 'shitstorm');
  assert.ok(containsBlockedTerm('5h1t'));
});

test('uniqueness is case- and space-insensitive', () => {
  const state = { usernames: {}, profiles: {} };
  const r1 = setPlayerUsername(state, WALLET_A, 'CoolName', { ensureProfile: fakeEnsureProfile });
  assert.equal(r1.ok, true);

  assert.equal(isUsernameAvailable(state, 'coolname', WALLET_B), false);
  // owner can re-claim its own name (idempotent / re-case)
  assert.equal(isUsernameAvailable(state, 'coolname', WALLET_A), true);
  assert.equal(normalizeForUniqueness('COOL  NAME'), 'cool name');
});

test('second wallet cannot take a taken name', () => {
  const state = { usernames: {}, profiles: {} };
  setPlayerUsername(state, WALLET_A, 'Champion', { ensureProfile: fakeEnsureProfile });
  const r = setPlayerUsername(state, WALLET_B, 'champion', { ensureProfile: fakeEnsureProfile });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'name-taken');
});

test('setting a new name releases the old one for reuse', () => {
  const state = { usernames: {}, profiles: {} };
  setPlayerUsername(state, WALLET_A, 'FirstName', { ensureProfile: fakeEnsureProfile });
  setPlayerUsername(state, WALLET_A, 'SecondName', { ensureProfile: fakeEnsureProfile });
  // old name now free for wallet B
  const r = setPlayerUsername(state, WALLET_B, 'FirstName', { ensureProfile: fakeEnsureProfile });
  assert.equal(r.ok, true);
  assert.equal(state.profiles[WALLET_A].handle, 'SecondName');
  assert.equal(state.profiles[WALLET_A].usernameSet, true);
});

test('resolveDisplayName: username when set, truncated wallet otherwise', () => {
  const set = { wallet: WALLET_A, handle: 'AcePilot', usernameSet: true };
  const unset = { wallet: WALLET_A, handle: 'Player aaaa', usernameSet: false };
  assert.equal(resolveDisplayName(set), 'AcePilot');
  assert.equal(resolveDisplayName(unset), `${WALLET_A.slice(0, 6)}…${WALLET_A.slice(-4)}`);
});
