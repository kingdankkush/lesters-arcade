import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ACHIEVEMENT_GAME_IDS, achievementById, catalogFor } from '../apps/portal/src/achievements/index.mjs';
import {
  CHILD_COSMETIC_KEYS,
  COSMETIC_SLOTS,
  HMH_COSMETIC_TINTS,
  UNLOCKABLES,
  UNLOCKABLE_KINDS,
  childCosmeticsFor,
  deserializeUnlocks,
  emptyUnlocks,
  normalizeCosmeticSelection,
  requirementText,
  resolveCosmeticSelection,
  serializeUnlocks,
  unlockState,
  unlockableById,
  unlocksFromProfileResponse,
} from '../apps/portal/src/unlockables.mjs';
import {
  COSMETICS_SELECTION_PREFIX,
  UNLOCKS_CACHE_PREFIX,
  UNLOCKS_CACHE_TTL_MS,
  createUnlockablesStore,
  readUnlocksCache,
  unlocksCacheKey,
  writeUnlocksCache,
} from '../apps/portal/src/unlockables-store.mjs';
import { LESTER_BLASTER_UNLOCKABLES } from '../apps/portal/src/arcade-core.mjs';

const WALLET = '0x1234567890abcdef1234567890abcdef12345678';
const OTHER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const DAY = 24 * 60 * 60 * 1000;

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    dispatch: (name, detail) => { for (const fn of [...(listeners.get(name) ?? [])]) fn({ type: name, detail }); },
    count: (name) => listeners.get(name)?.size ?? 0,
  };
}

// E6 body (contract §4.3.6) for WALLET.
function profileBody({ achievements = [], confirmedRuns = {}, preferences = null, wallet = WALLET } = {}) {
  return {
    ok: true,
    wallet,
    profile: { displayName: 'Lit Pilot', avatarUri: null, hidden: false, onchainUpdatedAt: null },
    games: Object.fromEntries(ACHIEVEMENT_GAME_IDS.map((gameId) => [gameId, { rankedRuns: confirmedRuns[gameId] ?? 0, confirmedRuns: confirmedRuns[gameId] ?? 0, bestScore: null }])),
    recentSessions: [],
    achievements: achievements.map(([gameId, id, tokenId = null]) => ({ id, gameId, tier: 'gold', nft: false, sessionId32: `0x${'1'.repeat(64)}`, unlockedAt: '2026-09-23T00:00:00.000Z', tokenId, mintTxHash: null })),
    preferences,
    updatedAt: '2026-09-23T00:00:00.000Z',
  };
}

function fakeIndexApi(responses = {}) {
  const calls = [];
  return {
    calls,
    profile: async (wallet, { self = false } = {}) => { calls.push(['profile', wallet, self]); return responses.profile?.(wallet, self) ?? profileBody({ wallet }); },
    savePreferences: async (preferences) => { calls.push(['savePreferences', preferences]); return responses.save?.(preferences) ?? { ok: true, wallet: WALLET, preferences }; },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('every gate names a real available achievement', () => {
  const ids = new Set();
  for (const item of UNLOCKABLES) {
    assert.ok(!ids.has(item.id), `${item.id} is unique`);
    ids.add(item.id);
    assert.ok(item.id.length <= 48 && /^[a-z0-9-]+$/.test(item.id), `${item.id} fits the E7 id rule`);
    assert.ok(ACHIEVEMENT_GAME_IDS.includes(item.gameId), `${item.id} gameId`);
    assert.ok(UNLOCKABLE_KINDS.includes(item.kind), `${item.id} kind`);
    assert.equal(item.artStatus, 'ready', `${item.id} ships working`);
    assert.match(item.preview, /^\/assets\//);
    assert.ok(existsSync(fileURLToPath(new URL(`../apps/portal${item.preview}`, import.meta.url))), `${item.id} preview ${item.preview} is existing art`);
    const keys = Object.keys(item.requires);
    assert.equal(keys.length, 1, `${item.id} has exactly one gate`);
    if (keys[0] === 'achievementId') {
      const achievement = achievementById(item.gameId, item.requires.achievementId);
      assert.ok(achievement, `${item.id} names ${item.requires.achievementId} in the ${item.gameId} catalog`);
      assert.equal(achievement.available, true, `${item.requires.achievementId} is available`);
      assert.ok(catalogFor(item.gameId).includes(achievement));
      assert.equal(requirementText(item), `Earn ${achievement.title}`);
    } else {
      assert.equal(keys[0], 'confirmedRuns');
      assert.ok(Number.isSafeInteger(item.requires.confirmedRuns) && item.requires.confirmedRuns > 0);
      assert.equal(requirementText(item), `Finish ${item.requires.confirmedRuns} verified Ranked runs`);
    }
  }
  // D8 minimums (contract §7.9).
  const countOf = (gameId, kind) => UNLOCKABLES.filter((item) => item.gameId === gameId && item.kind === kind).length;
  for (const [gameId, kind, min] of [
    ['lester-blaster', 'hero-skin', 3], ['lester-blaster', 'weapon-skin', 3],
    ['chikun', 'coat', 4], ['chikun', 'trail', 3], ['chikun', 'hat', 3],
    ['stacked', 'piece-skin', 4], ['stacked', 'scene', 3],
  ]) assert.ok(countOf(gameId, kind) >= min, `${gameId} ${kind} has at least ${min}`);
  // The HMH heroes keep their verified gates (hmh-character-config.mjs).
  assert.deepEqual(UNLOCKABLES.filter((item) => item.kind === 'character').map((item) => [item.characterId, item.requires.confirmedRuns]), [['lester-original', 5], ['lilly', 10]]);
  // Plain achievement ids are unique across the three catalogs, so one Set can hold them.
  const all = ACHIEVEMENT_GAME_IDS.flatMap((gameId) => catalogFor(gameId).map((entry) => entry.id));
  assert.equal(new Set(all).size, all.length);
  // Slots are kinds; child keys cover every cosmetic slot.
  for (const slots of Object.values(COSMETIC_SLOTS)) for (const slot of slots) assert.ok(CHILD_COSMETIC_KEYS[slot]);
});

test('earned server achievements unlock in phase 1; held tokens also unlock', () => {
  const body = profileBody({ achievements: [['chikun', 'chikun-reach-coast'], ['stacked', 'stacked-first-line', '7'], ['chikun', 'not-a-real-id'], ['chikun', 'score-10000']] });
  const unlocks = unlocksFromProfileResponse(body);
  assert.deepEqual([...unlocks.achievementIds].sort(), ['chikun-reach-coast', 'stacked-first-line'], 'unknown ids and ids of another game are ignored');
  assert.deepEqual([...unlocks.heldAchievementIds], ['stacked-first-line'], 'a non-null tokenId marks a held token');
  const glacier = unlockableById('chikun-coat-glacier');
  assert.deepEqual(unlockState(glacier, unlocks), { unlocked: true, reason: 'earned' });
  assert.deepEqual(unlockState(unlockableById('chikun-coat-golden'), unlocks), { unlocked: false, reason: 'achievement-required' });
  // Phase 2: a held soulbound token unlocks with no earned row in view.
  const heldOnly = { ...emptyUnlocks(), heldAchievementIds: new Set(['chikun-reach-coast']) };
  assert.deepEqual(unlockState(glacier, heldOnly), { unlocked: true, reason: 'held' });
  assert.deepEqual(unlockState(glacier, emptyUnlocks()), { unlocked: false, reason: 'achievement-required' });
  assert.deepEqual(unlockState({ ...glacier, id: 'forged' }, unlocks), { unlocked: false, reason: 'unknown' });
  // The cache round trip keeps only catalog ids.
  const copy = deserializeUnlocks(JSON.parse(JSON.stringify({ ...serializeUnlocks(unlocks), achievementIds: ['chikun-reach-coast', 'forged'] })));
  assert.deepEqual([...copy.achievementIds], ['chikun-reach-coast']);
});

test('confirmed-run gates use verified counts', () => {
  const lester = unlockableById('hmh-hero-lester');
  const lilly = unlockableById('hmh-hero-lilly');
  const veteran = unlockableById('hmh-weapon-veteran');
  const runs = (n, gameId = 'lester-blaster') => unlocksFromProfileResponse(profileBody({ confirmedRuns: { [gameId]: n } }));
  assert.deepEqual(unlockState(lester, runs(4)), { unlocked: false, reason: 'verified-runs-required', current: 4, required: 5 });
  assert.deepEqual(unlockState(lester, runs(5)), { unlocked: true, reason: 'verified-runs', current: 5, required: 5 });
  assert.equal(unlockState(lilly, runs(9)).unlocked, false);
  assert.equal(unlockState(lilly, runs(10)).unlocked, true);
  assert.equal(unlockState(veteran, runs(24)).unlocked, false);
  assert.equal(unlockState(veteran, runs(25)).unlocked, true);
  assert.equal(unlockState(lester, runs(50, 'chikun')).unlocked, false, 'another game\'s runs never count');
  for (const bad of [-1, 1.5, '9', Infinity, null]) {
    assert.equal(unlocksFromProfileResponse({ games: { 'lester-blaster': { confirmedRuns: bad } } }).confirmedRuns['lester-blaster'], 0);
  }
});

test('a selection is honoured only while it is unlocked and reaches each child in its own shape', () => {
  const selection = normalizeCosmeticSelection({
    chikun: { coat: 'chikun-coat-glacier', trail: 'chikun-trail-gold', hat: 'stacked-pieces-gold', extra: 'x' },
    stacked: { 'piece-skin': 'stacked-pieces-seafoam', scene: 'stacked-scene-noir' },
    'lester-blaster': { 'hero-skin': 'hmh-hero-silver', 'weapon-skin': 'hmh-weapon-veteran' },
    unknown: { coat: 'chikun-coat-glacier' },
  });
  assert.deepEqual(selection, {
    chikun: { coat: 'chikun-coat-glacier', trail: 'chikun-trail-gold' },
    stacked: { 'piece-skin': 'stacked-pieces-seafoam', scene: 'stacked-scene-noir' },
    'lester-blaster': { 'hero-skin': 'hmh-hero-silver', 'weapon-skin': 'hmh-weapon-veteran' },
  });
  const unlocks = unlocksFromProfileResponse(profileBody({
    achievements: [['chikun', 'chikun-reach-coast'], ['stacked', 'stacked-level-10'], ['lester-blaster', 'score-10000']],
    confirmedRuns: { 'lester-blaster': 25 },
  }));
  assert.deepEqual(childCosmeticsFor('chikun', selection, unlocks), { coat: 'chikun-coat-glacier', trail: null, hat: null });
  assert.deepEqual(childCosmeticsFor('stacked', selection, unlocks), { pieceSkin: 'stacked-pieces-seafoam', scene: null });
  assert.deepEqual(childCosmeticsFor('lester-blaster', selection, unlocks), { heroTint: 0xc9d8ee, weaponTint: 0xb8c8e0 });
  assert.deepEqual(childCosmeticsFor('chikun', selection, emptyUnlocks()), { coat: null, trail: null, hat: null });
  assert.deepEqual(resolveCosmeticSelection('stacked', {}, unlocks), { 'piece-skin': null, scene: null });
  assert.throws(() => resolveCosmeticSelection('pong', selection, unlocks), /unknown unlockables gameId/);
  // The E7 body fits the server rules: slot /^[a-z-]{1,24}$/, id <= 48, <= 2,048 bytes.
  const everything = Object.fromEntries(Object.entries(COSMETIC_SLOTS).map(([gameId, slots]) => [gameId, Object.fromEntries(slots.map((slot) => [slot, UNLOCKABLES.filter((item) => item.gameId === gameId && item.kind === slot).at(-1).id]))]));
  assert.ok(new TextEncoder().encode(JSON.stringify({ cosmetics: everything })).byteLength < 2048);
  for (const slots of Object.values(everything)) for (const slot of Object.keys(slots)) assert.match(slot, /^[a-z-]{1,24}$/);
  // HMH tints stay inside the parent's allowlist.
  for (const [key, tints] of Object.entries(HMH_COSMETIC_TINTS)) {
    assert.ok(tints.length >= 3, key);
    for (const tint of tints) assert.ok(Number.isInteger(tint) && tint >= 0 && tint <= 0xffffff);
  }
});

test('cache survives reload and expires after seven days', async () => {
  let clock = Date.parse('2026-09-23T12:00:00.000Z');
  const now = () => clock;
  const storage = memoryStorage();
  const windowRef = eventTarget();
  const api = fakeIndexApi({ profile: (wallet, self) => profileBody({ wallet, achievements: [['chikun', 'chikun-first-flight']], confirmedRuns: { 'lester-blaster': 10 }, preferences: self ? { cosmetics: { chikun: { hat: 'chikun-hat-cap' } } } : null }) });
  let wallet = WALLET;
  const first = createUnlockablesStore({ hosted: true, storage, indexApi: api, windowRef, getWallet: () => wallet, isAuthenticated: () => true, now });
  await settle();
  assert.deepEqual(api.calls[0], ['profile', WALLET, true], 'a signed-in wallet reads its self view on load');
  assert.equal(first.snapshot().source, 'server');
  assert.equal(first.verifiedRuns(), 10);
  assert.deepEqual(first.cosmeticsFor('chikun'), { coat: null, trail: null, hat: 'chikun-hat-cap' }, 'the self view carries the saved picks');
  const key = unlocksCacheKey(WALLET);
  assert.equal(key, `${UNLOCKS_CACHE_PREFIX}${WALLET}`);
  const stored = JSON.parse(storage.getItem(key));
  assert.deepEqual(stored, { v: 1, wallet: WALLET, savedAt: clock, unlocks: { achievementIds: ['chikun-first-flight'], heldAchievementIds: [], confirmedRuns: { 'lester-blaster': 10, chikun: 0, stacked: 0 } } });
  first.destroy();

  // Reload offline: the cache answers with no request.
  const offline = fakeIndexApi({ profile: () => ({ ok: false, error: 'network' }) });
  clock += 6 * DAY;
  const second = createUnlockablesStore({ hosted: true, storage, indexApi: offline, windowRef, getWallet: () => wallet, isAuthenticated: () => false, now });
  assert.equal(second.snapshot().source, 'cache');
  assert.equal(second.verifiedRuns(), 10);
  assert.deepEqual(second.cosmeticsFor('chikun'), { coat: null, trail: null, hat: 'chikun-hat-cap' }, 'Free Mode and offline keep the unlocked look');
  assert.equal(offline.calls.length, 0, 'no sign-in, no refresh trigger: no request');
  second.destroy();

  // Seven days and a moment later the entry is gone.
  clock += DAY + 1;
  assert.equal(readUnlocksCache(storage, WALLET, { now }), null);
  assert.equal(storage.getItem(key), null, 'the expired entry is removed');
  const third = createUnlockablesStore({ hosted: true, storage, indexApi: offline, windowRef, getWallet: () => wallet, isAuthenticated: () => false, now });
  assert.equal(third.snapshot().source, 'none');
  assert.equal(third.verifiedRuns(), null, 'unknown while nothing is cached');
  assert.deepEqual(third.cosmeticsFor('chikun'), { coat: null, trail: null, hat: null }, 'an expired unlock is no longer honoured');
  // Another wallet never reads this wallet's entry.
  writeUnlocksCache(storage, WALLET, unlocksFromProfileResponse(profileBody({ confirmedRuns: { 'lester-blaster': 7 } })), { now });
  wallet = OTHER;
  assert.equal(third.verifiedRuns(), null);
  wallet = WALLET;
  assert.equal(third.verifiedRuns(), 7);
  third.destroy();
  // A tampered or foreign entry is ignored.
  storage.setItem(key, JSON.stringify({ v: 1, wallet: OTHER, savedAt: clock, unlocks: {} }));
  assert.equal(readUnlocksCache(storage, WALLET, { now }), null);
  storage.setItem(key, '{not json');
  assert.equal(readUnlocksCache(storage, WALLET, { now }), null);
  storage.setItem(key, JSON.stringify({ v: 1, wallet: WALLET, savedAt: clock + DAY, unlocks: {} }));
  assert.equal(readUnlocksCache(storage, WALLET, { now }), null, 'a future timestamp is not trusted');
});

test('preview mode offers defaults only and never fetches', async () => {
  const now = () => Date.parse('2026-09-23T12:00:00.000Z');
  const storage = memoryStorage();
  writeUnlocksCache(storage, WALLET, unlocksFromProfileResponse(profileBody({ achievements: [['chikun', 'chikun-reach-coast']], confirmedRuns: { 'lester-blaster': 99 } })), { now });
  storage.setItem(`${COSMETICS_SELECTION_PREFIX}${WALLET}`, JSON.stringify({ chikun: { coat: 'chikun-coat-glacier' } }));
  const windowRef = eventTarget();
  const api = fakeIndexApi();
  const store = createUnlockablesStore({ hosted: false, storage, indexApi: api, windowRef, getWallet: () => WALLET, isAuthenticated: () => true, now });
  windowRef.dispatch('lesters:wallet-session', { wallet: WALLET, authenticated: true });
  windowRef.dispatch('lesters:profile-changed', { wallet: WALLET, displayName: 'x', avatarUri: null });
  const handle = { state: 'published', snapshot: { state: 'published' }, subscribe: () => () => {} };
  windowRef.dispatch('lesters:ranked-run', { handle, context: { wallet: WALLET } });
  await store.refresh({ force: true });
  await settle();
  assert.equal(api.calls.length, 0, 'no /api request in preview');
  assert.equal(store.snapshot().source, 'none', 'the cache is never read in preview');
  assert.equal(store.verifiedRuns(), null, 'preview keeps the device-local hero gates');
  for (const gameId of Object.keys(COSMETIC_SLOTS)) {
    assert.ok(Object.values(store.cosmeticsFor(gameId)).every((value) => value === null), `${gameId} gets the default looks`);
  }
  assert.deepEqual(await store.select('chikun', 'coat', 'chikun-coat-glacier'), { ok: false, error: 'locked' });
  assert.deepEqual(await store.select('chikun', 'coat', null), { ok: true, saved: 'device' });
  assert.equal(api.calls.length, 0, 'choosing the default look writes nothing to the server');
  store.destroy();
});

test('refreshes follow wallet sign-in, profile changes and published Ranked runs', async () => {
  const storage = memoryStorage();
  const windowRef = eventTarget();
  let achievements = [];
  const api = fakeIndexApi({ profile: (wallet) => profileBody({ wallet, achievements }) });
  let wallet = null;
  let signedIn = false;
  const store = createUnlockablesStore({ hosted: true, storage, indexApi: api, windowRef, getWallet: () => wallet, isAuthenticated: () => signedIn });
  const seen = [];
  store.subscribe((snapshot) => seen.push(snapshot.source));
  await settle();
  assert.equal(api.calls.length, 0, 'no wallet, no request');

  wallet = WALLET;
  windowRef.dispatch('lesters:wallet-session', { wallet: WALLET, authenticated: false });
  await settle();
  assert.equal(api.calls.length, 0, 'an unauthenticated session only switches to the wallet cache');
  signedIn = true;
  achievements = [['chikun', 'chikun-first-flight']];
  windowRef.dispatch('lesters:wallet-session', { wallet: WALLET, authenticated: true });
  await settle();
  assert.deepEqual(api.calls.at(-1), ['profile', WALLET, true]);
  assert.equal(store.stateOf(unlockableById('chikun-hat-cap')).unlocked, true);

  achievements.push(['chikun', 'chikun-survive-4m']);
  windowRef.dispatch('lesters:profile-changed', { wallet: OTHER, displayName: null, avatarUri: null });
  await settle();
  assert.equal(api.calls.length, 1, 'another wallet\'s change is ignored');
  windowRef.dispatch('lesters:profile-changed', { wallet: WALLET.toUpperCase().replace('0X', '0x'), displayName: 'Lit', avatarUri: null });
  await settle();
  assert.equal(api.calls.length, 2);
  assert.equal(store.stateOf(unlockableById('chikun-hat-top')).unlocked, true);

  // A Ranked run refreshes once its settlement handle is published.
  const subscribers = new Set();
  const handle = { state: 'verifying', get snapshot() { return { state: this.state }; }, subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); } };
  windowRef.dispatch('lesters:ranked-run', { handle, context: { wallet: WALLET } });
  assert.equal(subscribers.size, 1);
  handle.state = 'publishing';
  for (const fn of [...subscribers]) fn({ state: 'publishing' });
  await settle();
  assert.equal(api.calls.length, 2, 'not yet published');
  achievements.push(['chikun', 'chikun-loop-2']);
  handle.state = 'published';
  for (const fn of [...subscribers]) fn({ state: 'published' });
  await settle();
  assert.equal(api.calls.length, 3);
  assert.equal(subscribers.size, 0, 'the store lets go of the handle once published');
  assert.equal(store.stateOf(unlockableById('chikun-hat-crown')).unlocked, true);
  // A rejected run lets go without a request.
  const rejected = { state: 'verifying', snapshot: { state: 'verifying' }, subscribe(fn) { this.fn = fn; return () => { this.fn = null; }; } };
  windowRef.dispatch('lesters:ranked-run', { handle: rejected });
  rejected.fn({ state: 'rejected' });
  await settle();
  assert.equal(api.calls.length, 3);
  assert.equal(rejected.fn, null);
  assert.ok(seen.includes('server'));

  store.destroy();
  assert.equal(windowRef.count('lesters:wallet-session'), 0, 'destroy removes every listener');
  assert.equal(windowRef.count('lesters:ranked-run'), 0);
});

test('picks persist to preferences.cosmetics when signed in and to this device otherwise', async () => {
  const storage = memoryStorage();
  const windowRef = eventTarget();
  const api = fakeIndexApi({ profile: (wallet) => profileBody({ wallet, achievements: [['stacked', 'stacked-level-10'], ['stacked', 'stacked-survive-2m']] }) });
  let signedIn = true;
  const store = createUnlockablesStore({ hosted: true, storage, indexApi: api, windowRef, getWallet: () => WALLET, isAuthenticated: () => signedIn });
  await settle();
  assert.deepEqual(await store.select('stacked', 'piece-skin', 'stacked-pieces-seafoam'), { ok: true, saved: 'wallet' });
  assert.deepEqual(api.calls.at(-1), ['savePreferences', { cosmetics: { stacked: { 'piece-skin': 'stacked-pieces-seafoam' } } }], 'PUT /api/profile with the whole cosmetics map');
  assert.deepEqual(JSON.parse(storage.getItem(`${COSMETICS_SELECTION_PREFIX}${WALLET}`)), { stacked: { 'piece-skin': 'stacked-pieces-seafoam' } });
  assert.deepEqual(await store.select('stacked', 'scene', 'stacked-scene-noir'), { ok: true, saved: 'wallet' });
  assert.deepEqual(api.calls.at(-1)[1], { cosmetics: { stacked: { 'piece-skin': 'stacked-pieces-seafoam', scene: 'stacked-scene-noir' } } });
  assert.deepEqual(await store.select('stacked', 'scene', 'stacked-scene-forge'), { ok: false, error: 'locked' });
  assert.deepEqual(await store.select('stacked', 'scene', 'chikun-coat-golden'), { ok: false, error: 'invalid-cosmetic' });
  assert.deepEqual(await store.select('stacked', 'coat', null), { ok: false, error: 'invalid-slot' });
  assert.deepEqual(await store.select('stacked', 'scene', null), { ok: true, saved: 'wallet' });
  assert.deepEqual(api.calls.at(-1)[1], { cosmetics: { stacked: { 'piece-skin': 'stacked-pieces-seafoam' } } });
  signedIn = false;
  const saves = api.calls.filter((call) => call[0] === 'savePreferences').length;
  assert.deepEqual(await store.select('stacked', 'scene', 'stacked-scene-noir'), { ok: true, saved: 'device' });
  assert.equal(api.calls.filter((call) => call[0] === 'savePreferences').length, saves, 'no Bearer, no PUT');
  assert.deepEqual(store.cosmeticsFor('stacked'), { pieceSkin: 'stacked-pieces-seafoam', scene: 'stacked-scene-noir' });
  // A failed PUT keeps the device copy and says so.
  signedIn = true;
  const failing = createUnlockablesStore({ hosted: true, storage, indexApi: { ...api, savePreferences: async () => ({ ok: false, error: 'network' }) }, windowRef, getWallet: () => WALLET, isAuthenticated: () => true, getCachedSelfProfile: () => profileBody({ achievements: [['stacked', 'stacked-level-10']] }) });
  await settle();
  assert.deepEqual(await failing.select('stacked', 'piece-skin', null), { ok: true, saved: 'device', error: 'network' });
  failing.destroy();
  store.destroy();
});

test('every storage access is guarded, so blocked storage leaves the store working', async () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
  const windowRef = eventTarget();
  const api = fakeIndexApi({ profile: (wallet) => profileBody({ wallet, achievements: [['chikun', 'chikun-stack-three']] }) });
  const store = createUnlockablesStore({ hosted: true, storage: throwing, indexApi: api, windowRef, getWallet: () => WALLET, isAuthenticated: () => false });
  await store.refresh({ force: true });
  assert.equal(store.snapshot().source, 'server');
  assert.deepEqual(await store.select('chikun', 'trail', 'chikun-trail-gold'), { ok: true, saved: 'session' });
  assert.deepEqual(store.cosmeticsFor('chikun'), { coat: null, trail: 'chikun-trail-gold', hat: null });
  assert.equal(readUnlocksCache(throwing, WALLET), null);
  assert.equal(writeUnlocksCache(throwing, WALLET, emptyUnlocks()), false);
  store.destroy();
  // No storage at all.
  const bare = createUnlockablesStore({ hosted: true, storage: null, indexApi: null, windowRef: null, getWallet: () => { throw new Error('boom'); } });
  assert.equal(bare.verifiedRuns(), null);
  assert.deepEqual(bare.cosmeticsFor('lester-blaster'), { heroTint: null, weaponTint: null });
});

test('HMH codex lines name real achievements or verified run gates', () => {
  assert.equal(LESTER_BLASTER_UNLOCKABLES.length >= 8, true);
  for (const line of LESTER_BLASTER_UNLOCKABLES) {
    const item = unlockableById(line.unlockableId);
    assert.ok(item, `${line.id} maps to a working unlockable`);
    assert.equal(item.gameId, 'lester-blaster');
    assert.equal(line.unlock, requirementText(item), `${line.id} copy matches its gate`);
    const earn = /^Earn (.+)$/.exec(line.unlock);
    if (earn) {
      assert.ok(catalogFor('lester-blaster').some((entry) => entry.available && entry.title === earn[1]), `${line.unlock} names an available HMH achievement`);
    } else {
      assert.match(line.unlock, /^Finish \d+ verified Ranked runs$/);
    }
  }
  const weapon = LESTER_BLASTER_UNLOCKABLES.find((line) => line.id === 'weapon-hashstorm');
  assert.equal(weapon.unlock, 'Earn Weapon Collector', 'weapon-hashstorm names a real achievement');
  // Every HMH skin has a codex line.
  const covered = new Set(LESTER_BLASTER_UNLOCKABLES.map((line) => line.unlockableId));
  for (const item of UNLOCKABLES.filter((entry) => entry.gameId === 'lester-blaster')) assert.ok(covered.has(item.id), `${item.id} is in the codex`);
});

test('phase 1 copy never says NFT, soulbound or minting', () => {
  const copy = JSON.stringify([UNLOCKABLES.map((item) => [item.title, requirementText(item)]), LESTER_BLASTER_UNLOCKABLES]);
  assert.doesNotMatch(copy, /\bnft\b|soulbound|minting|minted|\bmint\b/i);
});
