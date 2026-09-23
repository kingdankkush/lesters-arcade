import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ethers } from 'ethers';

import { EVENT_TOPICS, SERVER_ABIS } from '../server/chain/abis.mjs';
import { createPublicProvider, LITEFORGE_RPC_URL } from '../server/chain/public-rpc.mjs';
import { BOSS_IDS, INDEX_GAMES } from '../server/neon/rows.mjs';

/**
 * Contract §8.2-§8.5: the server's human-readable fragments must match the
 * compiled artifacts exactly (inputs, outputs, mutability, indexed flags), so
 * a contract change cannot silently break decoding.
 */

function artifactInterface(name) {
  const artifact = JSON.parse(readFileSync(new URL(`../contracts/artifacts/${name}.json`, import.meta.url), 'utf8'));
  return new ethers.Interface(artifact.abi);
}

test('every server ABI fragment exists in its contract artifact', () => {
  for (const [name, fragments] of Object.entries(SERVER_ABIS)) {
    const artifact = artifactInterface(name);
    const server = new ethers.Interface(fragments);
    assert.equal(server.fragments.length, fragments.length, `${name} fragments all parse`);
    for (const fragment of server.fragments) {
      if (fragment.type === 'function') {
        const match = artifact.getFunction(fragment.format('sighash'));
        assert.ok(match, `${name}.${fragment.format('sighash')} exists in the artifact`);
        assert.equal(fragment.selector, match.selector);
        assert.deepEqual(fragment.outputs.map((output) => output.format('sighash')), match.outputs.map((output) => output.format('sighash')), `${name}.${fragment.name} outputs`);
        assert.equal(fragment.stateMutability, match.stateMutability, `${name}.${fragment.name} mutability`);
      } else if (fragment.type === 'event') {
        const match = artifact.getEvent(fragment.topicHash);
        assert.ok(match, `${name} event ${fragment.format('sighash')} exists`);
        assert.deepEqual(fragment.inputs.map((input) => Boolean(input.indexed)), match.inputs.map((input) => Boolean(input.indexed)), `${name}.${fragment.name} indexed flags`);
      }
    }
  }
});

test('event topics and the server-used functions match the contract facts', () => {
  const byName = {};
  for (const fragments of Object.values(SERVER_ABIS)) {
    for (const fragment of new ethers.Interface(fragments).fragments) if (fragment.type === 'event') byName[fragment.name] = fragment.topicHash;
  }
  for (const [name, topic] of Object.entries(EVENT_TOPICS)) assert.equal(byName[name], topic, name);
  const entry = new ethers.Interface(SERVER_ABIS.ArcadeRankedEntry);
  assert.deepEqual(entry.getFunction('getPaidSession').outputs[0].components.map((c) => c.name), ['player', 'gameId', 'amountWei', 'openedAt', 'exists']);
  const registry = new ethers.Interface(SERVER_ABIS.ScoreSubmissionRegistry);
  for (const name of ['submitVerifiedSession', 'getSession', 'sessionEnvelopeHash', 'getSessionAchievements', 'relayers', 'rankedEntry', 'trustedVerifier']) assert.ok(registry.getFunction(name), name);
  assert.equal(registry.getFunction('submitVerifiedSession').inputs[0].components.length, 13, 'VerifiedRun has 13 fields');
  const profile = new ethers.Interface(SERVER_ABIS.PlayerProfileRegistry);
  assert.deepEqual(profile.getFunction('getProfile').outputs[0].components.map((c) => c.name), ['handle', 'displayName', 'avatarUri', 'createdAt', 'lastUpdated', 'exists']);
});

test('the index game table matches ethers.id of the contract identifiers', () => {
  for (const game of Object.values(INDEX_GAMES)) {
    assert.equal(ethers.id(game.gameId), game.gameId32, game.gameId);
    assert.equal(ethers.id(game.seasonId), game.seasonId32, game.seasonId);
    assert.equal(ethers.id(game.runtimeId), game.runtimeId32, game.runtimeId);
  }
  assert.deepEqual(BOSS_IDS, { [ethers.id('boss-liquidator')]: 'boss-liquidator' });
});

test('the public provider is pinned to LiteForge without probing the network', async () => {
  const provider = createPublicProvider({ rpcUrl: 'http://127.0.0.1:9/never-called', chainId: 4441 });
  assert.equal((await provider.getNetwork()).chainId, 4441n);
  assert.equal(LITEFORGE_RPC_URL, 'https://liteforge.rpc.caldera.xyz/http');
  assert.equal((await createPublicProvider().getNetwork()).chainId, 4441n);
  provider.destroy();
});
