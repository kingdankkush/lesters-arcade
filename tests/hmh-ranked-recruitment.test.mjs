import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterUnlockMap, buildCharacterSelectEntries, syncConfiguredCharacterUnlocks } from '../apps/portal/src/hmh-character-config.mjs';
import { createInitialArcadeState, createPlayerProfile, startPlaySession, recordScore } from '../apps/portal/src/arcade-core.mjs';

test('recruitment counts only completed HMH Ranked games at 5 and 10', () => {
  for (const count of [0, 4, 5, 9, 10, 11]) {
    const profile = { totalPaidRuns: 500, progress: { stacked: { paidRuns: 250 }, chikun: { paidRuns: 240 }, 'lester-blaster': { paidRuns: count, freeRuns: 1000 } } };
    const unlocks = buildCharacterUnlockMap(profile);
    assert.equal(unlocks['lester-original'], count >= 5, `Lester at ${count}`);
    assert.equal(unlocks.lilly, count >= 10, `Lilly at ${count}`);
    const entries = buildCharacterSelectEntries([{ id: 'lester-original' }, { id: 'lilly' }], profile);
    assert.equal(entries[0].unlockProgress.current, Math.min(5, count));
    assert.equal(entries[1].unlockProgress.current, Math.min(10, count));
  }
  assert.equal(buildCharacterUnlockMap({ totalPaidRuns: 500 }).lilly, false, 'unscoped history cannot grant a fresh HMH unlock');
  assert.equal(buildCharacterUnlockMap({ progress: { 'lester-blaster': { paidRuns: Infinity } } }).lilly, false);
});

test('completed games stay wallet-bound and a repeated result cannot earn another game', () => {
  const state = createInitialArcadeState(), wallet = `0x${'a'.repeat(40)}`, secondWallet = `0x${'b'.repeat(40)}`;
  let last;
  for (let i = 0; i < 5; i++) {
    last = startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' });
    recordScore(state, last, 300, { elapsedSeconds: 60 });
  }
  assert.equal(state.profiles[wallet].unlocks.characters['lester-original'], true);
  assert.equal(state.profiles[wallet].unlocks.characters.lilly, false);
  assert.throws(() => recordScore(state, last, 300, { elapsedSeconds: 60 }), /already recorded/);
  assert.equal(state.profiles[wallet].progress['lester-blaster'].paidRuns, 5);
  const other = createPlayerProfile(secondWallet);
  assert.equal(other.unlocks.characters['lester-original'], false);
  const restored = JSON.parse(JSON.stringify(state.profiles[wallet]));
  syncConfiguredCharacterUnlocks(restored);
  assert.equal(restored.unlocks.characters['lester-original'], true);
});

test('earned characters survive migration when older scoped counts are absent', () => {
  const profile = { unlocks: { characters: { 'lester-original': true, lilly: true } }, preferences: { selectedCharacterId: 'lilly' } };
  syncConfiguredCharacterUnlocks(profile);
  assert.equal(profile.unlocks.characters.lilly, true);
  assert.equal(profile.preferences.selectedCharacterId, 'lilly');
});

// Hosted mode (contract §7.9, D4): only verified Ranked runs from the index count.
const TAMPERED = Object.freeze({
  achievements: ['getaway-clear', 'ten-paid-runs'],
  progress: { 'lester-blaster': { paidRuns: 500 } },
  unlocks: { characters: { 'lester-original': true, lilly: true } },
  preferences: { selectedCharacterId: 'lilly' },
});

test('hosted recruitment counts verified runs at 5 and 10 and ignores local flags and migrations', () => {
  for (const verifiedRuns of [0, 4, 5, 9, 10, 11]) {
    const profile = structuredClone(TAMPERED);
    const unlocks = buildCharacterUnlockMap(profile, undefined, { verifiedRuns });
    assert.equal(unlocks['lester-original'], verifiedRuns >= 5, `Lester at ${verifiedRuns} verified runs`);
    assert.equal(unlocks.lilly, verifiedRuns >= 10, `Lilly at ${verifiedRuns} verified runs`);
    assert.equal(unlocks['lit-commando'], true);
    const entries = buildCharacterSelectEntries([{ id: 'lester-original' }, { id: 'lilly' }], profile, undefined, { verifiedRuns });
    assert.equal(entries[0].unlockProgress.current, Math.min(5, verifiedRuns));
    assert.equal(entries[1].unlockProgress.current, Math.min(10, verifiedRuns));
    assert.equal(entries[1].unlockProgress.source, 'verified');
    assert.match(entries[1].unlockProgress.note, /Verified HMH Ranked games/);
  }
  // Preview keeps today's device-local logic for the very same profile.
  const preview = buildCharacterUnlockMap(structuredClone(TAMPERED));
  assert.deepEqual([preview['lester-original'], preview.lilly], [true, true]);
});

test('hosted mode before the profile loads locks both heroes and repairs a locked selection', () => {
  for (const options of [{ verifiedRuns: null }, { hosted: true }, { verifiedRuns: 'many' }, { verifiedRuns: -3 }]) {
    const unlocks = buildCharacterUnlockMap(structuredClone(TAMPERED), undefined, options);
    assert.deepEqual([unlocks['lester-original'], unlocks.lilly], [false, false], JSON.stringify(options));
  }
  const profile = structuredClone(TAMPERED);
  const synced = syncConfiguredCharacterUnlocks(profile, undefined, { verifiedRuns: 6 });
  assert.deepEqual([synced['lester-original'], synced.lilly], [true, false]);
  assert.equal(profile.preferences.selectedCharacterId, 'lit-commando', 'a locked Lilly selection falls back to a starter');
  // hosted:false wins over a stray count and keeps the local path.
  assert.equal(buildCharacterUnlockMap(structuredClone(TAMPERED), undefined, { hosted: false, verifiedRuns: 0 }).lilly, true);
});

test('hosted mode with no cached count yet never falls back to local unlocks', () => {
  // The unlockables cache is empty on a first visit, offline, or before E6
  // loads: `{ verifiedRuns: cache?.count }` is undefined. That is 0 verified
  // runs in hosted mode, never the sticky local flags or the getaway-clear
  // migration (D4, §7.9), so a paid Ranked run cannot start with a hero E3
  // refuses as hero-locked.
  const cache = undefined;
  for (const options of [
    { verifiedRuns: cache?.count },
    { hosted: true, verifiedRuns: cache?.count },
    { hosted: true, verifiedRuns: undefined },
    { hosted: true, verifiedRuns: true },
    { hosted: true, verifiedRuns: '7 runs' },
  ]) {
    const profile = structuredClone(TAMPERED);
    const unlocks = buildCharacterUnlockMap(profile, undefined, options);
    assert.deepEqual([unlocks['lester-original'], unlocks.lilly], [false, false], `locked for ${JSON.stringify(options)} (undefined keys dropped)`);
    const entries = buildCharacterSelectEntries([{ id: 'lester-original' }, { id: 'lilly' }], profile, undefined, options);
    assert.deepEqual(entries.map((entry) => [entry.unlocked, entry.unlockProgress.current, entry.unlockProgress.source]), [[false, 0, 'verified'], [false, 0, 'verified']]);
    assert.equal(syncConfiguredCharacterUnlocks(profile, undefined, options).lilly, false);
    assert.equal(profile.preferences.selectedCharacterId, 'lit-commando', 'the tampered Lilly selection is repaired');
  }
  // A numeric string from a cache is still a count.
  assert.equal(buildCharacterUnlockMap(structuredClone(TAMPERED), undefined, { hosted: true, verifiedRuns: '10' }).lilly, true);
  // Preview (no hosted flag, no verifiedRuns key) keeps today's local logic.
  assert.deepEqual(Object.entries(buildCharacterUnlockMap(structuredClone(TAMPERED), undefined, {})).filter(([id]) => id !== 'lit-commando' && id !== 'lit-valkyrie'), [['lester-original', true], ['lilly', true]]);
});

test('cached verified runs unlock Lester and Lilly before the profile loads', async () => {
  // Unlockables slice (contract §7.9): the hero select reads the A7 cache's
  // games['lester-blaster'].confirmedRuns, so a wallet that earned both heroes
  // on another device sees them unlocked here before E6 answers and offline.
  const { createUnlockablesStore, writeUnlocksCache } = await import('../apps/portal/src/unlockables-store.mjs');
  const { unlocksFromProfileResponse } = await import('../apps/portal/src/unlockables.mjs');
  const { createOfficialPlayRoutes } = await import('../apps/portal/src/routes/official-play-routes.mjs');
  const { HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG, resolveSelectedCharacterId, setPreferredCharacter } = await import('../apps/portal/src/hmh-character-config.mjs');
  const wallet = `0x${'c'.repeat(40)}`;
  const map = new Map();
  const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
  writeUnlocksCache(storage, wallet, unlocksFromProfileResponse({ games: { 'lester-blaster': { confirmedRuns: 10 } } }));
  let profileRequests = 0;
  const pending = { profile: () => { profileRequests += 1; return new Promise(() => {}); } }; // E6 never answers (slow or offline)
  const store = createUnlockablesStore({ hosted: true, storage, indexApi: pending, windowRef: null, getWallet: () => wallet, isAuthenticated: () => true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(profileRequests, 1, 'the refresh is in flight, not answered');
  const options = { hosted: true, verifiedRuns: store.verifiedRuns() };
  assert.equal(options.verifiedRuns, 10);
  // This device has no local Ranked history at all.
  const local = createPlayerProfile(wallet);
  const entries = buildCharacterSelectEntries([{ id: 'lit-commando' }, { id: 'lester-original' }, { id: 'lilly' }], local, undefined, options);
  assert.deepEqual(entries.map((entry) => [entry.id, entry.unlocked]), [['lit-commando', true], ['lester-original', true], ['lilly', true]]);
  assert.deepEqual(setPreferredCharacter(local, 'lilly', undefined, options), { ok: true, selectedCharacterId: 'lilly' });
  assert.equal(resolveSelectedCharacterId(local, undefined, options), 'lilly');
  // Without the cache (first visit on this device) both stay locked.
  const empty = createUnlockablesStore({ hosted: true, storage: null, indexApi: null, windowRef: null, getWallet: () => wallet });
  assert.equal(empty.verifiedRuns(), null);
  const locked = buildCharacterSelectEntries([{ id: 'lester-original' }, { id: 'lilly' }], createPlayerProfile(wallet), undefined, { hosted: true, verifiedRuns: empty.verifiedRuns() });
  assert.deepEqual(locked.map((entry) => entry.unlocked), [false, false]);

  // The hero select route passes the same options through to the gates.
  const nodeOf = (tag, props = {}) => ({ tag, children: [], dataset: {}, style: {}, attrs: {}, disabled: false, ...props, classList: { add() {}, remove() {}, contains: () => false }, append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = [...children]; }, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener() {} });
  const roster = nodeOf('roster');
  const combat = { characterId: 'lit-commando' };
  const routes = createOfficialPlayRoutes({
    dom: { officialCharacterSelect: nodeOf('select'), officialCharacterRoster: roster },
    getContext: () => ({ connectedWallet: wallet, state: { profiles: { [wallet]: createPlayerProfile(wallet) } }, combat }),
    appendText: (parent, tag, text, className = '') => parent.append(nodeOf(tag, { textContent: text, className })),
    applyHardMoneyHeroScreenBackground: () => {},
    buildCharacterSelectEntries,
    characterUnlockOptions: () => ({ hosted: true, verifiedRuns: store.verifiedRuns() }),
    el: (tag, props = {}) => nodeOf(tag, props),
    HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
    HERO_ROSTER_BASE: [{ id: 'lit-commando' }, { id: 'lester-original' }, { id: 'lilly' }],
    heroRotationSprite: () => null,
    renderHeroStatBars: () => {},
    resolveSelectedCharacterId,
    setPreferredCharacter,
    weaponById: () => ({ title: 'Coin Blaster' }),
  });
  routes.renderCharacterSelect();
  const cards = roster.children.filter((child) => child.dataset.characterId);
  assert.deepEqual(cards.map((card) => [card.dataset.characterId, card.disabled]), [['lit-commando', false], ['lester-original', false], ['lilly', false]], 'the cached count unlocks both cards');
  store.destroy();
});

test('a hero picked through the cached verified count survives reconnects, recorded runs and the arcade snapshot', async () => {
  // arcade-core syncs the profile on every connect, recorded run and snapshot
  // without options; main.js registers the hero select's options for the
  // connected wallet so those syncs use the same verified gates (§7.9).
  const { setCharacterUnlockOptionsProvider, setPreferredCharacter, resolveSelectedCharacterId } = await import('../apps/portal/src/hmh-character-config.mjs');
  const { buildPlayerArcadeSnapshot, connectPlayerAccount } = await import('../apps/portal/src/arcade-core.mjs');
  const wallet = `0x${'d'.repeat(40)}`;
  const connect = (state) => connectPlayerAccount(state, wallet, { handle: 'LitVM Pilot' });
  let verifiedRuns = 10;
  setCharacterUnlockOptionsProvider((profile) => (profile?.wallet === wallet ? { hosted: true, verifiedRuns } : {}));
  try {
    const state = createInitialArcadeState();
    connect(state);
    const profile = state.profiles[wallet];
    assert.equal(profile.progress['lester-blaster']?.paidRuns ?? 0, 0, 'no Ranked history on this device');
    assert.deepEqual(setPreferredCharacter(profile, 'lilly', undefined, { hosted: true, verifiedRuns }), { ok: true, selectedCharacterId: 'lilly' });
    connect(state);
    assert.equal(profile.preferences.selectedCharacterId, 'lilly', 'a reconnect keeps the pick');
    recordScore(state, startPlaySession({ wallet, gameId: 'lester-blaster', mode: 'paid' }), 300, { elapsedSeconds: 60 });
    assert.equal(profile.preferences.selectedCharacterId, 'lilly', 'a recorded run keeps it');
    assert.equal(buildPlayerArcadeSnapshot(state, wallet).profile.selectedCharacterId, 'lilly', 'the arcade snapshot shows it');
    assert.equal(profile.unlocks.characters.lilly, true);
    // The count is unknown again (the store has not loaded, nothing cached):
    // the pick waits for it, while a run still starts as a starter.
    verifiedRuns = null;
    connect(state);
    assert.equal(profile.preferences.selectedCharacterId, 'lilly');
    assert.equal(resolveSelectedCharacterId(profile), 'lit-commando');
    verifiedRuns = 10;
    assert.equal(resolveSelectedCharacterId(profile), 'lilly');
    // A verified count below the gate repairs it.
    verifiedRuns = 3;
    connect(state);
    assert.equal(profile.preferences.selectedCharacterId, 'lit-commando');
    // Another wallet's profile keeps the device-local logic.
    assert.equal(buildCharacterUnlockMap(createPlayerProfile(`0x${'e'.repeat(40)}`)).lilly, false);
  } finally {
    setCharacterUnlockOptionsProvider(null);
  }
  // Without the provider the same reconnect falls back to the local gates.
  const state = createInitialArcadeState();
  connect(state);
  setPreferredCharacter(state.profiles[wallet], 'lilly', undefined, { hosted: true, verifiedRuns: 10 });
  connect(state);
  assert.equal(state.profiles[wallet].preferences.selectedCharacterId, 'lit-commando');
});
