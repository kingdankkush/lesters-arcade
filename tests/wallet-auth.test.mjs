import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIWE_STATEMENT,
  generateNonce,
  buildSiweMessage,
  buildSiweChallenge,
  isValidLogin,
  normalizeProviderDetail,
  createProviderRegistry,
  classifyWalletError,
} from '../apps/portal/src/wallet-auth.mjs';

const ADDR = '0x1e57e21e57e21e57e21e57e21e57e21e57e21e57';

test('generateNonce returns unique hex strings', () => {
  const a = generateNonce();
  const b = generateNonce();
  assert.match(a, /^[0-9a-f]+$/);
  assert.equal(a.length, 32); // 16 bytes -> 32 hex chars
  assert.notEqual(a, b);
});

test('buildSiweMessage is deterministic + canonical EIP-4361 shape', () => {
  const msg = buildSiweMessage({
    domain: 'lestersarcade.io',
    address: ADDR,
    chainId: 4441,
    nonce: 'abc123',
    issuedAt: '2026-06-20T00:00:00.000Z',
  });
  assert.ok(msg.includes('lestersarcade.io wants you to sign in'));
  assert.ok(msg.includes(ADDR));
  assert.ok(msg.includes('Chain ID: 4441'));
  assert.ok(msg.includes('Nonce: abc123'));
  assert.ok(msg.includes('Issued At: 2026-06-20T00:00:00.000Z'));
  assert.ok(msg.includes(SIWE_STATEMENT));
  // Deterministic: same inputs -> identical bytes (verifier can reconstruct).
  const msg2 = buildSiweMessage({
    domain: 'lestersarcade.io', address: ADDR, chainId: 4441, nonce: 'abc123', issuedAt: '2026-06-20T00:00:00.000Z',
  });
  assert.equal(msg, msg2);
});

test('buildSiweMessage rejects bad inputs', () => {
  assert.throws(() => buildSiweMessage({ domain: '', address: ADDR, chainId: 1, nonce: 'n', issuedAt: 'x' }));
  assert.throws(() => buildSiweMessage({ domain: 'd', address: '0xnope', chainId: 1, nonce: 'n', issuedAt: 'x' }));
  assert.throws(() => buildSiweMessage({ domain: 'd', address: ADDR, chainId: 1, nonce: '', issuedAt: 'x' }));
});

test('buildSiweChallenge lowercases address + bundles the message', () => {
  const ch = buildSiweChallenge({ domain: 'lestersarcade.io', address: ADDR.toUpperCase().replace('0X', '0x'), chainId: 4441, nonce: 'n1', issuedAt: '2026-06-20T00:00:00.000Z' });
  assert.equal(ch.address, ADDR.toLowerCase());
  assert.equal(ch.chainId, 4441);
  assert.ok(ch.message.includes('Nonce: n1'));
  assert.equal(Object.isFrozen(ch), true);
});

test('isValidLogin binds signature to the challenged address', () => {
  const challenge = buildSiweChallenge({ domain: 'lestersarcade.io', address: ADDR, chainId: 4441, nonce: 'n', issuedAt: '2026-06-20T00:00:00.000Z' });
  const goodSig = `0x${'a'.repeat(130)}`; // 65-byte sig hex
  assert.equal(isValidLogin({ challenge, signature: goodSig, signingAddress: ADDR }), true);
  // wrong signer address
  assert.equal(isValidLogin({ challenge, signature: goodSig, signingAddress: '0x' + 'b'.repeat(40) }), false);
  // malformed / too-short signature
  assert.equal(isValidLogin({ challenge, signature: '0x1234', signingAddress: ADDR }), false);
  assert.equal(isValidLogin({ challenge, signature: 'not-hex', signingAddress: ADDR }), false);
  // missing challenge
  assert.equal(isValidLogin({ signature: goodSig, signingAddress: ADDR }), false);
});

test('normalizeProviderDetail validates EIP-6963 announce shape', () => {
  const good = normalizeProviderDetail({
    info: { uuid: 'u1', name: 'MetaMask', rdns: 'io.metamask', icon: 'data:image/svg+xml;...' },
    provider: { request: () => {} },
  });
  assert.equal(good.name, 'MetaMask');
  assert.equal(good.rdns, 'io.metamask');
  // missing provider.request
  assert.equal(normalizeProviderDetail({ info: { uuid: 'u', name: 'X' }, provider: {} }), null);
  // missing info
  assert.equal(normalizeProviderDetail({ provider: { request: () => {} } }), null);
  assert.equal(normalizeProviderDetail(null), null);
});

test('createProviderRegistry de-dupes and picks a sensible default', () => {
  const reg = createProviderRegistry();
  const mm = { info: { uuid: 'u-mm', name: 'MetaMask', rdns: 'io.metamask' }, provider: { request: () => {} } };
  const rabby = { info: { uuid: 'u-rabby', name: 'Rabby Wallet', rdns: 'io.rabby' }, provider: { request: () => {} } };

  assert.equal(reg.add(rabby), true);
  assert.equal(reg.add(mm), true);
  // duplicate uuid ignored
  assert.equal(reg.add(mm), false);
  // duplicate rdns ignored
  assert.equal(reg.add({ info: { uuid: 'u-mm2', name: 'MetaMask', rdns: 'io.metamask' }, provider: { request: () => {} } }), false);
  assert.equal(reg.size(), 2);

  // MetaMask preferred even though Rabby was added first.
  assert.equal(reg.preferred().name, 'MetaMask');
});

test('createProviderRegistry falls back to first when no MetaMask/Rabby', () => {
  const reg = createProviderRegistry();
  reg.add({ info: { uuid: 'u-other', name: 'Coinbase Wallet', rdns: 'com.coinbase' }, provider: { request: () => {} } });
  assert.equal(reg.preferred().name, 'Coinbase Wallet');
  // empty registry -> null
  assert.equal(createProviderRegistry().preferred(), null);
});

test('classifyWalletError treats user rejection as cancellation, not failure', () => {
  const rejected = classifyWalletError({ code: 4001, message: 'User rejected the request.' });
  assert.equal(rejected.kind, 'user-cancelled');
  assert.equal(rejected.userCancelled, true);
  assert.equal(rejected.recoverable, true);
  assert.equal(rejected.severity, 'info');

  const ethersRejected = classifyWalletError({ code: 'ACTION_REJECTED', shortMessage: 'user rejected action' });
  assert.equal(ethersRejected.kind, 'user-cancelled');
});

test('classifyWalletError exposes wrong-network, missing-wallet, and funds states for UI copy', () => {
  assert.equal(classifyWalletError(new Error('Wrong network: wallet is on chain 1, expected 4441')).kind, 'wrong-network');
  assert.equal(classifyWalletError(new Error('A connected wallet is required.')).kind, 'missing-wallet');
  assert.equal(classifyWalletError(new Error('insufficient funds for intrinsic transaction cost')).kind, 'insufficient-funds');
  assert.equal(classifyWalletError(new Error('replacement transaction underpriced')).kind, 'wallet-error');
});
