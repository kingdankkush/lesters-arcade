import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildProfilePersistenceParityReport,
  normalizeProfileIdentity,
  validateProfilePersistenceParity,
} from '../apps/portal/src/hmh-profile-parity.mjs';
import {
  buildPlayerArcadeSnapshot,
  createInitialArcadeState,
  createPlayerProfile,
} from '../apps/portal/src/arcade-core.mjs';
import { loadArcadeState, saveArcadeState } from '../apps/portal/src/persistence.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test('WO-35 profile identity normalizes local and chain avatar/name parity', () => {
  const identity = normalizeProfileIdentity({
    wallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
    localProfile: {
      wallet: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      handle: 'LitChad',
      usernameSet: true,
      avatarDataUrl: 'data:image/jpeg;base64,abc',
      preferences: { selectedCharacterId: 'lit-valkyrie' },
    },
    chainProfile: { displayName: 'ChainName', avatarUri: 'ipfs://avatar' },
  });

  assert.equal(identity.wallet, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(identity.displayName, 'LitChad');
  assert.equal(identity.avatarDataUrl, 'data:image/jpeg;base64,abc');
  assert.equal(identity.avatarUri, 'ipfs://avatar');
  assert.equal(identity.selectedCharacterId, 'lit-valkyrie');
  assert.equal(identity.source.displayName, 'local');
});

test('WO-35 arcade snapshot exposes persisted avatar and selected-character parity', () => {
  const state = createInitialArcadeState();
  const wallet = '0x1111111111111111111111111111111111111111';
  const profile = createPlayerProfile(wallet, { avatarDataUrl: 'data:image/jpeg;base64,avatar' });
  profile.handle = 'RoadRunner';
  profile.usernameSet = true;
  profile.preferences.selectedCharacterId = 'lit-valkyrie';
  state.profiles[wallet] = profile;

  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  assert.equal(snapshot.profile.displayName, 'RoadRunner');
  assert.equal(snapshot.profile.avatarDataUrl, 'data:image/jpeg;base64,avatar');
  assert.equal(snapshot.profile.selectedCharacterId, 'lit-valkyrie');
  assert.equal(snapshot.profile.profileParity.hasAvatar, true);
  assert.equal(snapshot.profile.profileParity.hasSelectedCharacter, true);
});

test('WO-35 local persistence round-trips avatar/profile fields', () => {
  const storage = memoryStorage();
  const wallet = '0x2222222222222222222222222222222222222222';
  const state = createInitialArcadeState();
  state.profiles[wallet] = createPlayerProfile(wallet, { avatarDataUrl: 'data:image/png;base64,xyz', avatarUri: 'ipfs://stored-avatar' });
  state.profiles[wallet].handle = 'PersistedName';
  state.profiles[wallet].usernameSet = true;
  state.profiles[wallet].preferences.selectedCharacterId = 'lit-valkyrie';

  const saved = saveArcadeState(state, storage);
  assert.equal(saved.ok, true);

  const restored = createInitialArcadeState();
  assert.equal(loadArcadeState(restored, storage), true);
  const snapshot = buildPlayerArcadeSnapshot(restored, wallet);
  assert.equal(snapshot.profile.displayName, 'PersistedName');
  assert.equal(snapshot.profile.avatarDataUrl, 'data:image/png;base64,xyz');
  assert.equal(snapshot.profile.avatarUri, 'ipfs://stored-avatar');
  assert.equal(snapshot.profile.selectedCharacterId, 'lit-valkyrie');
});

test('WO-35 profile parity report validates profile persistence readiness', () => {
  const wallet = '0x3333333333333333333333333333333333333333';
  const state = createInitialArcadeState();
  state.profiles[wallet] = createPlayerProfile(wallet, { avatarDataUrl: 'data:image/jpeg;base64,abc' });
  const report = buildProfilePersistenceParityReport({ state, wallet, chainProfile: { displayName: 'ChainName', avatarUri: 'ipfs://avatar' } });
  const validation = validateProfilePersistenceParity(report);
  assert.equal(validation.ok, true, validation.gaps.join('\n'));
  assert.equal(report.summary.status, 'PASS');
});

test('WO-35 runtime and syntax gate consume profile parity helper', () => {
  const arcadeCore = repoText('apps/portal/src/arcade-core.mjs');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(arcadeCore.includes("./hmh-profile-parity.mjs"), true);
  assert.equal(arcadeCore.includes('normalizeProfileIdentity('), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-profile-parity.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-profile-parity.test.mjs'), true);
});
