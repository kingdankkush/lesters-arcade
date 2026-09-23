// On-chain names (contract §7.8, §8.4): the browser's handle rules against a JS
// port of PlayerProfileRegistry._normalizedHandle and against the real contract
// on the in-process chain (chainId 4441, committed bytecode, offline).
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { ethers } from 'ethers';

import {
  HANDLE_MAX_BYTES,
  PROFILE_CHAIN_ABI,
  commitProfileChange,
  estimateSetProfile,
  formatZkLtc,
  handleOwner,
  normalizeHandle,
  prepareProfileChange,
  sendSetProfile,
} from '../apps/portal/src/profile-chain.mjs';
import { ARCADE_AVATARS, avatarUriFor } from '../apps/portal/src/arcade-avatars.mjs';
import { loadArtifact, startLocalChain } from '../scripts/lib/local-chain.mjs';

// An independent port of the Solidity, written over a byte array the way the
// contract reads `bytes(displayName)`. Returns the revert reason or the hash.
function solidityNormalizedHandle(displayName) {
  const raw = [...Buffer.from(displayName, 'utf8')];
  let start = 0;
  while (start < raw.length && raw[start] === 0x20) start++;
  let end = raw.length;
  while (end > start && raw[end - 1] === 0x20) end--;
  const normalized = [];
  let lastWasSpace = false;
  for (let i = start; i < end; i++) {
    let ch = raw[i];
    if (ch >= 0x41 && ch <= 0x5a) ch = ch + 32;
    const valid = (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39) || ch === 0x20 || ch === 0x5f || ch === 0x2d || ch === 0x2e;
    if (!valid) return { revert: 'Invalid handle char' };
    if (ch === 0x20) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    normalized.push(ch);
  }
  if (normalized.length < 3) return { revert: 'Handle too short' };
  if (normalized.length > 18) return { revert: 'Handle too long' };
  return { hash: ethers.keccak256(Uint8Array.from(normalized)) };
}

// Deterministic fuzz: mulberry32, biased toward the interesting bytes.
function fuzzNames(count, seed = 0x51a7e) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _.-';
  const names = [];
  for (let i = 0; i < count; i++) {
    const length = Math.floor(next() * 24);
    let name = '';
    for (let j = 0; j < length; j++) {
      const roll = next();
      if (roll < 0.12) name += ' ';
      else if (roll < 0.16) name += String.fromCharCode(Math.floor(next() * 128)); // any ASCII, tabs and newlines included
      else name += alphabet[Math.floor(next() * alphabet.length)];
    }
    names.push(name);
  }
  return names;
}

const EDGE_NAMES = [
  'Lit Pilot', '  Lit   Pilot  ', 'abc', 'ab', 'a'.repeat(18), 'a'.repeat(19), ' '.repeat(5), '',
  'Tab\tName', 'New\nLine', ' Café Racer', 'Ünïcode', 'x'.repeat(17) + '  ', `${'y'.repeat(18)}   `,
  'UPPER lower', '___', '...', '-_.', 'a  b  c', '\tLeading', 'Trailing\t', 'emoji 😀 name',
];

test('normalizeHandle mirrors the contract for 500 fuzzed names', () => {
  const names = [...fuzzNames(500), ...EDGE_NAMES];
  let valid = 0;
  for (const name of names) {
    const port = solidityNormalizedHandle(name);
    const mine = normalizeHandle(name, { ethers });
    assert.equal(mine.ok, !port.revert, `validity differs for ${JSON.stringify(name)}`);
    if (port.revert) {
      const expected = { 'Invalid handle char': 'invalid-char', 'Handle too short': 'too-short', 'Handle too long': 'too-long' }[port.revert];
      assert.equal(mine.error, expected, `reason differs for ${JSON.stringify(name)}`);
      assert.equal(mine.handleHash, null);
      continue;
    }
    valid += 1;
    assert.equal(mine.handleHash, port.hash, `hash differs for ${JSON.stringify(name)}`);
    // The cleaned string the editor sends normalizes to the same handle.
    assert.equal(solidityNormalizedHandle(mine.cleaned).hash, port.hash);
    assert.equal(mine.cleaned, mine.cleaned.trim());
    assert.doesNotMatch(mine.cleaned, / {2}/);
    assert.equal(mine.cleaned.toLowerCase(), mine.normalized);
    assert.ok(Buffer.byteLength(mine.cleaned) <= HANDLE_MAX_BYTES);
  }
  assert.ok(valid > 100, `the fuzz set exercises valid names too (${valid})`);
  assert.deepEqual(normalizeHandle('  Lit   Pilot  '), { ok: true, cleaned: 'Lit Pilot', normalized: 'lit pilot', handleHash: null, error: null });
  assert.equal(normalizeHandle('Tab\tName').error, 'invalid-char', 'tabs are invalid, not collapsed');
  assert.equal(normalizeHandle(42).error, 'invalid-type');
});

let chain;
let registryAddress;
let player1;
let player2;

before(async () => {
  chain = await startLocalChain();
  const artifact = loadArtifact('PlayerProfileRegistry');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, chain.wallets.operator);
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  registryAddress = (await registry.getAddress()).toLowerCase();
  player1 = (await chain.wallets.player1.getAddress()).toLowerCase();
  player2 = (await chain.wallets.player2.getAddress()).toLowerCase();
});

after(async () => {
  await chain?.close();
});

// The wallet the browser would hand over (EIP-1193), recording every method.
function recordingWallet() {
  const methods = [];
  return {
    methods,
    provider: {
      request: async ({ method, params = [] }) => {
        methods.push(method);
        return chain.eip1193.request({ method, params });
      },
    },
  };
}

test('the module ABI matches the PlayerProfileRegistry artifact', () => {
  const artifact = new ethers.Interface(loadArtifact('PlayerProfileRegistry').abi);
  for (const fragment of new ethers.Interface(PROFILE_CHAIN_ABI).fragments) {
    const found = artifact.getFunction(fragment.name);
    assert.ok(found, `${fragment.name} exists in the artifact`);
    assert.equal(found.format('sighash'), fragment.format('sighash'));
  }
});

test('the contract agrees with normalizeHandle on names it accepts and rejects', async () => {
  const registry = new ethers.Contract(registryAddress, loadArtifact('PlayerProfileRegistry').abi, chain.wallets.attacker);
  const sample = [...fuzzNames(40, 0xbeef), ...EDGE_NAMES];
  for (const name of sample) {
    const mine = normalizeHandle(name, { ethers });
    let reverted = null;
    try {
      await registry.setProfile.staticCall(name, '');
    } catch (error) {
      reverted = error?.reason ?? error?.revert?.args?.[0] ?? 'reverted';
    }
    assert.equal(reverted === null, mine.ok, `contract and module differ for ${JSON.stringify(name)} (${reverted})`);
    if (reverted) assert.equal(reverted, { 'invalid-char': 'Invalid handle char', 'too-short': 'Handle too short', 'too-long': 'Handle too long' }[mine.error]);
  }
});

test('estimate and send return a tx hash and a wait function', async () => {
  const wallet = recordingWallet();
  const avatarUri = avatarUriFor('lilly');
  const fee = await estimateSetProfile(wallet.provider, { displayName: 'Lit Pilot', avatarUri, from: player1, ethers, registryAddress });
  assert.equal(typeof fee.gasLimit, 'bigint');
  assert.ok(fee.gasLimit > 21000n);
  assert.ok(fee.gasWei > 0n);
  assert.match(fee.gasZkLtc, /^\d+\.\d+$/);
  assert.ok(!wallet.methods.includes('eth_sendTransaction') && !wallet.methods.includes('eth_requestAccounts'), 'estimating never prompts');

  const sent = await sendSetProfile(wallet.provider, { displayName: 'Lit Pilot', avatarUri, from: player1, ethers, registryAddress });
  assert.match(sent.txHash, /^0x[0-9a-f]{64}$/);
  assert.equal(typeof sent.wait, 'function');
  const receipt = await sent.wait();
  assert.deepEqual(Object.keys(receipt), ['status', 'blockNumber']);
  assert.equal(receipt.status, 'confirmed');
  assert.ok(Number.isInteger(receipt.blockNumber));
  const onchain = await new ethers.Contract(registryAddress, loadArtifact('PlayerProfileRegistry').abi, chain.provider).getProfile(player1);
  assert.equal(onchain.displayName, 'Lit Pilot');
  assert.equal(onchain.avatarUri, 'lestersarcade:avatar/lilly');
  assert.equal(onchain.handle, normalizeHandle('Lit Pilot', { ethers }).handleHash);

  // A wallet on another chain is stopped before any request that could prompt.
  const elsewhere = { request: async ({ method }) => (method === 'eth_chainId' ? '0x1' : chain.eip1193.request({ method })) };
  await assert.rejects(estimateSetProfile(elsewhere, { displayName: 'Other', from: player1, ethers, registryAddress }), (error) => error.code === 'wrong-network');
});

test('availability check reads handleOwners through the public RPC', async () => {
  const claimed = normalizeHandle('  LIT pilot ', { ethers });
  assert.equal(await handleOwner(claimed.handleHash, { readProvider: chain.provider, ethers, registryAddress }), player1);
  assert.equal(await handleOwner(normalizeHandle('Nobody Yet', { ethers }).handleHash, { readProvider: chain.provider, ethers, registryAddress }), null);

  // Another wallet asking for a taken name is told so before any wallet request.
  const wallet = recordingWallet();
  const taken = await prepareProfileChange({ raw: 'lit PILOT', wallet: player2, walletProvider: wallet.provider, readProvider: chain.provider, ethers, registryAddress });
  assert.deepEqual([taken.ok, taken.step, taken.error], [false, 'availability', 'handle-taken']);
  assert.match(taken.message, /That name is taken/);
  assert.deepEqual(wallet.methods, [], 'no wallet call at all for a taken name');

  // The owner may re-save its own name (for example with a new avatar).
  const own = await prepareProfileChange({ raw: 'Lit Pilot', avatarUri: avatarUriFor('chikun'), wallet: player1, walletProvider: wallet.provider, readProvider: chain.provider, ethers, registryAddress });
  assert.equal(own.ok, true);
  assert.match(own.feeLabel, /^Network fee about \d+(\.\d+)? zkLTC$/);
  assert.ok(!wallet.methods.includes('eth_sendTransaction'));

  // A read failure is reported, never treated as "free".
  const broken = { call: async () => { throw new Error('rpc down'); } };
  const unreachable = await prepareProfileChange({ raw: 'Fresh Name', wallet: player2, walletProvider: wallet.provider, readProvider: broken, ethers, registryAddress });
  assert.deepEqual([unreachable.ok, unreachable.error], [false, 'chain-read-failed']);
});

test('moderation blocks the name before any wallet prompt', async () => {
  const wallet = recordingWallet();
  let reads = 0;
  const readProvider = { call: async () => { reads += 1; throw new Error('must not read'); } };
  for (const [raw, reason] of [['Lester Fan', 'impersonation'], ['Admin', 'impersonation'], ['sh1t head', 'profanity']]) {
    const blocked = await prepareProfileChange({ raw, wallet: player2, walletProvider: wallet.provider, readProvider, ethers, registryAddress });
    assert.deepEqual([blocked.ok, blocked.step, blocked.error], [false, 'moderation', reason], raw);
    assert.equal(blocked.message, 'That name isn’t allowed here. Choose another.');
  }
  const invalid = await prepareProfileChange({ raw: 'Tab\tName', wallet: player2, walletProvider: wallet.provider, readProvider, ethers, registryAddress });
  assert.deepEqual([invalid.ok, invalid.step, invalid.error], [false, 'validate', 'invalid-char']);
  const badAvatar = await prepareProfileChange({ raw: 'Fine Name', avatarUri: 'https://example.com/me.png', wallet: player2, walletProvider: wallet.provider, readProvider, ethers, registryAddress });
  assert.deepEqual([badAvatar.ok, badAvatar.error], [false, 'invalid-avatar']);
  assert.deepEqual(wallet.methods, [], 'the wallet is never touched');
  assert.equal(reads, 0, 'not even the public RPC is read');
});

test('a confirmed change refreshes the index and announces the sanitized profile', async () => {
  const wallet = recordingWallet();
  const prepared = await prepareProfileChange({ raw: '  Ranked  Rookie ', avatarUri: avatarUriFor('lit-valkyrie'), wallet: player2, walletProvider: wallet.provider, readProvider: chain.provider, ethers, registryAddress });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.cleaned, 'Ranked Rookie', 'the cleaned name is what goes on chain');
  assert.ok(!wallet.methods.includes('eth_sendTransaction'), 'preparing never sends');
  const events = [];
  const broadcasts = [];
  const refreshes = [];
  const indexApi = { refreshProfile: async (who) => { refreshes.push(who); return { ok: true, wallet: who, profile: { displayName: 'Ranked Rookie', avatarUri: 'lestersarcade:avatar/lit-valkyrie', hidden: false } }; } };
  const done = await commitProfileChange(prepared, { walletProvider: wallet.provider, ethers, registryAddress, indexApi, dispatch: (name, detail) => events.push([name, detail]), onBroadcast: (hash) => broadcasts.push(hash) });
  assert.equal(done.ok, true);
  assert.equal(broadcasts.length, 1);
  assert.equal(done.txHash, broadcasts[0]);
  assert.deepEqual(refreshes, [player2]);
  assert.deepEqual(events, [['lesters:profile-changed', { wallet: player2, displayName: 'Ranked Rookie', avatarUri: 'lestersarcade:avatar/lit-valkyrie' }]]);
  assert.equal(wallet.methods.filter((method) => method === 'eth_sendTransaction').length, 1, 'exactly one transaction');
  assert.equal(await handleOwner(prepared.handleHash, { readProvider: chain.provider, ethers, registryAddress }), player2);

  // A wallet that refuses is reported plainly and nothing is announced.
  const refusing = { request: async ({ method, params }) => (method === 'eth_sendTransaction' ? Promise.reject(Object.assign(new Error('User rejected'), { code: 4001 })) : chain.eip1193.request({ method, params })) };
  const again = await prepareProfileChange({ raw: 'Second Try', wallet: player2, walletProvider: refusing, readProvider: chain.provider, ethers, registryAddress });
  const refused = await commitProfileChange(again, { walletProvider: refusing, ethers, registryAddress, indexApi, dispatch: (name, detail) => events.push([name, detail]) });
  assert.deepEqual([refused.ok, refused.error], [false, 'rejected']);
  assert.equal(events.length, 1);
});

test('arcade avatars are existing site art with contract-shaped URIs', async () => {
  const { existsSync, statSync } = await import('node:fs');
  assert.ok(ARCADE_AVATARS.length >= 8 && ARCADE_AVATARS.length <= 12);
  const ids = new Set();
  for (const avatar of ARCADE_AVATARS) {
    assert.match(avatar.id, /^[a-z0-9-]{1,32}$/);
    assert.ok(!ids.has(avatar.id));
    ids.add(avatar.id);
    assert.match(avatarUriFor(avatar.id), /^lestersarcade:avatar\/[a-z0-9-]{1,32}$/, 'the server sanitizer keeps the URI');
    const file = new URL(`../apps/portal/${avatar.src.replace(/^\.\//, '')}`, import.meta.url);
    assert.ok(existsSync(file), `${avatar.src} ships with the site`);
    // Boards show up to 25 avatars on a phone: every choice is a small file.
    assert.ok(statSync(file).size <= 32 * 1024, `${avatar.src} is ${statSync(file).size} B; avatars stay under 32 KB`);
    assert.doesNotMatch(avatar.src, /hmh-hero-portraits\//, 'never the 0.5 MB hero portrait strips');
  }
  // Stable ids: players store 'lestersarcade:avatar/<id>' on chain.
  assert.deepEqual(ARCADE_AVATARS.map((avatar) => avatar.id), ['litecoin-chad', 'lester-pilot', 'lit-commando', 'lit-valkyrie', 'lester', 'lilly', 'chikun', 'gold-emblem', 'diamond-emblem', 'mythic-emblem']);
  assert.equal(avatarUriFor('nope'), null);
  assert.equal(formatZkLtc('0.000042318'), '0.0000423');
  assert.equal(formatZkLtc('0.000000'), '0');
  assert.equal(formatZkLtc('1.5'), '1.5');
});
