// Hosted mode never resets a hero pick through the device-local gates (contract §7.9, A7, D4).
//
// arcade-core syncs a profile without options on every connect, recorded run and arcade snapshot
// (createPlayerProfile, connectPlayerAccount/ensureProfile, recordScore, buildPlayerArcadeSnapshot).
// main.js registers the hero select's options for the CONNECTED wallet; any other profile on this
// device (the wallet a Ranked run was opened with, finishing after an account switch, or an earlier
// wallet) used to fall back to the device-local gates, which in hosted mode reset a Lester or Lilly
// pick unlocked only by verified runs to the starter. With the provider registered as hosted, such a
// profile gets the hosted gates with an unknown count: the saved pick waits, and a run still starts
// as a starter until the count is known (resolveSelectedCharacterId refuses a locked pick at use).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildCharacterUnlockMap,
  resolveSelectedCharacterId,
  setCharacterUnlockOptionsProvider,
  setPreferredCharacter,
} from '../apps/portal/src/hmh-character-config.mjs';
import { buildPlayerArcadeSnapshot, connectPlayerAccount, createInitialArcadeState, recordScore, startPlaySession } from '../apps/portal/src/arcade-core.mjs';

const walletA = `0x${'a1'.repeat(20)}`;
const walletB = `0x${'b2'.repeat(20)}`;
const counts = { [walletA]: 10, [walletB]: 0 };

// The main.js provider: the hero select's options for the connected wallet only.
function register(connected, { hosted }) {
  setCharacterUnlockOptionsProvider((profile) => (profile?.wallet === connected.wallet ? { hosted, verifiedRuns: counts[connected.wallet] } : {}), { hosted });
}

test('hosted: a verified-only Lilly pick survives syncs of that profile while another wallet is connected', () => {
  const connected = { wallet: walletA };
  register(connected, { hosted: true });
  try {
    const state = createInitialArcadeState();
    connectPlayerAccount(state, walletA, { handle: 'LitVM Pilot' });
    const session = startPlaySession({ wallet: walletA, gameId: 'lester-blaster', mode: 'paid' });
    assert.deepEqual(setPreferredCharacter(state.profiles[walletA], 'lilly', undefined, { hosted: true, verifiedRuns: 10 }), { ok: true, selectedCharacterId: 'lilly' });

    // The player switches to wallet B; the Ranked run opened with A finishes and is recorded for A.
    connected.wallet = walletB;
    connectPlayerAccount(state, walletB, { handle: 'LitVM Pilot' });
    recordScore(state, session, 300, { elapsedSeconds: 60 });
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lilly', 'the recorded run keeps A\'s pick');
    buildPlayerArcadeSnapshot(state, walletA);
    connectPlayerAccount(state, walletA);
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lilly', 'snapshots and syncs keep it');
    // Hosted gates for A while its count is unknown: no local flag or local run count unlocks Lilly,
    // so a run would start as a starter.
    assert.equal(state.profiles[walletA].unlocks.characters.lilly, false);
    assert.equal(resolveSelectedCharacterId(state.profiles[walletA]), 'lit-commando');

    // A signs back in and its verified count is known again: the pick is still there.
    connected.wallet = walletA;
    connectPlayerAccount(state, walletA);
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lilly');
    assert.equal(resolveSelectedCharacterId(state.profiles[walletA]), 'lilly');
    assert.equal(state.profiles[walletA].unlocks.characters.lilly, true);
  } finally {
    setCharacterUnlockOptionsProvider(null);
  }
});

test('hosted: a verified-only pick with no local unlock flag survives a sync while another wallet is connected', () => {
  // The failure the fix is for: A's Lilly pick came from the server's preferences (or was made while
  // A's verified count was known) and A's profile on this device carries no sticky local unlock flag.
  // The device-local gates then see Lilly locked and reset the pick to the starter; the hosted gates
  // with an unknown count keep the pick and only refuse it at use.
  register({ wallet: walletB }, { hosted: true });
  try {
    const state = createInitialArcadeState();
    connectPlayerAccount(state, walletA, { handle: 'LitVM Pilot' });
    const profileA = state.profiles[walletA];
    profileA.preferences.selectedCharacterId = 'lilly';
    profileA.unlocks.characters.lilly = false;
    assert.equal(profileA.progress?.['lester-blaster']?.paidRuns ?? 0, 0, 'no local run count unlocks Lilly either');

    connectPlayerAccount(state, walletA);
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lilly', 'a sync keeps the pick');
    const session = startPlaySession({ wallet: walletA, gameId: 'lester-blaster', mode: 'paid' });
    recordScore(state, session, 120, { elapsedSeconds: 30 });
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lilly', 'a recorded run keeps the pick');
    buildPlayerArcadeSnapshot(state, walletA);
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lilly', 'a snapshot keeps the pick');
    assert.equal(state.profiles[walletA].unlocks.characters.lilly, false, 'no sticky local flag was written');
    // While A's count is unknown a run starts as the starter.
    assert.equal(resolveSelectedCharacterId(state.profiles[walletA]), 'lit-commando');
  } finally {
    setCharacterUnlockOptionsProvider(null);
  }
});

test('hosted: a profile the provider does not name never uses the device-local gates', () => {
  register({ wallet: walletB }, { hosted: true });
  try {
    // Ten local Ranked runs and a sticky local flag unlock Lilly on the device-local path only.
    const tampered = { wallet: walletA, progress: { 'lester-blaster': { paidRuns: 10 } }, unlocks: { characters: { lilly: true } }, preferences: { selectedCharacterId: 'lilly' } };
    const unlocks = buildCharacterUnlockMap(structuredClone(tampered));
    assert.deepEqual([unlocks['lester-original'], unlocks.lilly], [false, false]);
    assert.equal(resolveSelectedCharacterId(structuredClone(tampered)), 'lit-commando');
  } finally {
    setCharacterUnlockOptionsProvider(null);
  }
});

test('preview: other profiles keep today\'s device-local logic, repair included', () => {
  const connected = { wallet: walletB };
  register(connected, { hosted: false });
  try {
    const state = createInitialArcadeState();
    connectPlayerAccount(state, walletA);
    state.profiles[walletA].preferences.selectedCharacterId = 'lilly';
    connectPlayerAccount(state, walletA);
    assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lit-commando', 'a locked local pick is repaired in preview');
  } finally {
    setCharacterUnlockOptionsProvider(null);
  }
  // Without any provider, the local gates as before.
  const state = createInitialArcadeState();
  connectPlayerAccount(state, walletA);
  state.profiles[walletA].preferences.selectedCharacterId = 'lilly';
  connectPlayerAccount(state, walletA);
  assert.equal(state.profiles[walletA].preferences.selectedCharacterId, 'lit-commando');
});

test('main.js registers the provider with the hosted flag', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(/setCharacterUnlockOptionsProvider\(\(profile\) => [^\n]*characterUnlockOptions\(\) : \{\}\), \{ hosted: HOSTED_PROFILE_SYNC \}\);/.test(main), 'main.js must pass { hosted: HOSTED_PROFILE_SYNC } when it registers the provider');
});
