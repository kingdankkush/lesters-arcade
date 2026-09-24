// The fixture EIP-1193 wallet (browser-e2e slice): the Node-side request router, the page-side
// provider script and the Playwright installer, all without a browser. The last test sends a real
// transaction to the in-process Hardhat chain (offline).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { inspect } from 'node:util';
import vm from 'node:vm';
import test from 'node:test';
import { ethers } from 'ethers';

import {
  createFixtureWalletRouter,
  fixtureBindingRefusal,
  fixtureWalletPageScript,
  installFixtureWallet,
  FIXTURE_ERRORS,
  FIXTURE_WALLET_BINDING,
  FIXTURE_WALLET_RDNS,
  READ_METHODS,
} from '../scripts/lib/fixture-wallet.mjs';
import { serveJsonRpc, startLocalChain } from '../scripts/lib/local-chain.mjs';

// The public 0x11…11 fixture key the Chikun smoke already uses (contract §11 rule 8).
const FIXTURE_KEY = `0x${'11'.repeat(32)}`;
const FIXTURE_ADDRESS = new ethers.Wallet(FIXTURE_KEY).address.toLowerCase();
const OTHER = '0x000000000000000000000000000000000000dead';

// A fake JSON-RPC node on loopback: canned answers, every call recorded, batches supported.
async function startFakeRpc({ chainIdHex = '0x1159' } = {}) {
  const calls = [];
  const rawTransactions = [];
  const answer = (payload) => {
    calls.push(payload.method);
    const ok = (result) => ({ jsonrpc: '2.0', id: payload.id, result });
    switch (payload.method) {
      case 'eth_chainId': return ok(chainIdHex);
      case 'eth_blockNumber': return ok('0x10');
      case 'eth_getBalance': return ok('0xde0b6b3a7640000');
      case 'eth_call':
        if (payload.params?.[0]?.data === '0xdeadbeef') return { jsonrpc: '2.0', id: payload.id, error: { code: 3, message: 'execution reverted', data: '0x08c379a0' } };
        return ok('0x01');
      case 'eth_getTransactionCount': return ok('0x7');
      case 'eth_estimateGas': return ok('0x5208');
      case 'eth_gasPrice': return ok('0x3b9aca00');
      case 'eth_maxPriorityFeePerGas': return ok('0x0');
      case 'eth_getBlockByNumber': return ok({ number: '0x10', hash: `0x${'ab'.repeat(32)}`, parentHash: `0x${'cd'.repeat(32)}`, timestamp: '0x6500', baseFeePerGas: '0x59682f00', gasLimit: '0x1c9c380', gasUsed: '0x0', miner: OTHER, extraData: '0x', difficulty: '0x0', nonce: '0x0000000000000000', transactions: [] });
      case 'eth_sendRawTransaction':
        rawTransactions.push(payload.params[0]);
        return ok(ethers.keccak256(payload.params[0]));
      default:
        return { jsonrpc: '2.0', id: payload.id, error: { code: -32601, message: `fake RPC has no ${payload.method}` } };
    }
  };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const reply = Array.isArray(body) ? body.map(answer) : answer(body);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    rawTransactions,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function rejectsWithCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `expected code ${code}, got ${error.code} (${error.message})`);
    return true;
  });
}

test('accounts, chain id and connection state behave like an injected wallet', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url });
  t.after(async () => { router.close(); await rpc.close(); });

  assert.equal(router.address, FIXTURE_ADDRESS);
  assert.deepEqual(await router.request({ method: 'eth_accounts' }), [], 'not connected until eth_requestAccounts');
  assert.equal(router.connected, false);
  assert.deepEqual(await router.request({ method: 'eth_requestAccounts' }), [FIXTURE_ADDRESS]);
  assert.deepEqual(await router.request({ method: 'eth_accounts' }), [FIXTURE_ADDRESS]);
  assert.equal(await router.request({ method: 'eth_chainId' }), '0x1159');
  assert.equal(await router.request({ method: 'net_version' }), '4441');
  // None of these reached the node: they are the wallet's own answers.
  assert.deepEqual(rpc.calls, []);

  const preconnected = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true });
  assert.deepEqual(await preconnected.request({ method: 'eth_accounts' }), [FIXTURE_ADDRESS]);
  preconnected.close();
});

test('personal_sign signs text as UTF-8 and 0x data as bytes, for the fixture account only', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url });
  t.after(async () => { router.close(); await rpc.close(); });

  await rejectsWithCode(router.request({ method: 'personal_sign', params: ['hello', FIXTURE_ADDRESS] }), FIXTURE_ERRORS.unauthorized);
  await router.request({ method: 'eth_requestAccounts' });

  const message = '127.0.0.1:8850 wants you to sign in with your Ethereum account:';
  const textSignature = await router.request({ method: 'personal_sign', params: [message, FIXTURE_ADDRESS] });
  assert.equal(ethers.verifyMessage(message, textSignature).toLowerCase(), FIXTURE_ADDRESS);

  const hex = ethers.hexlify(ethers.toUtf8Bytes(message));
  const hexSignature = await router.request({ method: 'personal_sign', params: [hex, ethers.getAddress(FIXTURE_ADDRESS)] });
  assert.equal(ethers.verifyMessage(ethers.getBytes(hex), hexSignature).toLowerCase(), FIXTURE_ADDRESS);
  assert.equal(hexSignature, textSignature, 'hex-encoded UTF-8 signs the same bytes as the text');

  await rejectsWithCode(router.request({ method: 'personal_sign', params: [message, OTHER] }), FIXTURE_ERRORS.unauthorized);
  await rejectsWithCode(router.request({ method: 'personal_sign', params: [42, FIXTURE_ADDRESS] }), FIXTURE_ERRORS.invalidParams);
  assert.deepEqual(rpc.calls, [], 'signing never touches the node');
});

test('eth_sendTransaction signs locally and sends the raw transaction to rpcUrl', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url });
  t.after(async () => { router.close(); await rpc.close(); });
  const tx = { from: FIXTURE_ADDRESS, to: OTHER, value: '0x16a6075a7b1b0000', data: '0x12345678' };

  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [tx] }), FIXTURE_ERRORS.unauthorized);
  await router.request({ method: 'eth_requestAccounts' });

  const hash = await router.request({ method: 'eth_sendTransaction', params: [tx] });
  assert.equal(rpc.rawTransactions.length, 1);
  const raw = rpc.rawTransactions[0];
  assert.equal(hash, ethers.keccak256(raw).toLowerCase());
  const parsed = ethers.Transaction.from(raw);
  assert.equal(parsed.from.toLowerCase(), FIXTURE_ADDRESS, 'signed by the fixture key');
  assert.equal(parsed.chainId, 4441n);
  assert.equal(parsed.to.toLowerCase(), OTHER);
  assert.equal(parsed.value, 0x16a6075a7b1b0000n);
  assert.equal(parsed.data, '0x12345678');
  assert.equal(parsed.nonce, 7, 'nonce read from the node (pending)');
  assert.equal(parsed.gasLimit, 21000n, 'gas estimated by the node when the page gives none');
  assert.equal(router.transactions.length, 1);
  assert.deepEqual({ ...router.transactions[0] }, { hash, to: OTHER, value: String(0x16a6075a7b1b0000n), data: '0x12345678', nonce: 7 });
  assert.ok(rpc.calls.includes('eth_chainId'), 'the node chain is checked before anything signed is sent');
  assert.ok(!rpc.calls.includes('eth_sendTransaction'), 'the node never signs');

  // The page's gas, when given, is used as is.
  await router.request({ method: 'eth_sendTransaction', params: [{ ...tx, gas: '0x30d40' }] });
  assert.equal(ethers.Transaction.from(rpc.rawTransactions[1]).gasLimit, 200000n);

  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [{ ...tx, from: OTHER }] }), FIXTURE_ERRORS.unauthorized);
  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [{ ...tx, chainId: '0x1' }] }), FIXTURE_ERRORS.invalidParams);
  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [{ ...tx, privateKey: '0x00' }] }), FIXTURE_ERRORS.invalidParams);
  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [] }), FIXTURE_ERRORS.invalidParams);
  assert.equal(rpc.rawTransactions.length, 2, 'refused transactions are never sent');
});

test('a node on another chain never receives a signed transaction', async (t) => {
  const rpc = await startFakeRpc({ chainIdHex: '0x1' });
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true });
  t.after(async () => { router.close(); await rpc.close(); });
  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [{ to: OTHER, value: '0x1' }] }), FIXTURE_ERRORS.internal);
  assert.equal(rpc.rawTransactions.length, 0);
});

test('chain switching accepts only the wallet chain', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url });
  t.after(async () => { router.close(); await rpc.close(); });
  assert.equal(await router.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1159' }] }), null);
  await rejectsWithCode(router.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }), FIXTURE_ERRORS.unrecognizedChain);
  assert.equal(await router.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x1159', chainName: 'LitVM LiteForge', rpcUrls: ['https://example.invalid'] }] }), null);
  await rejectsWithCode(router.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x2' }] }), FIXTURE_ERRORS.invalidParams);
  await rejectsWithCode(router.request({ method: 'wallet_switchEthereumChain', params: [] }), FIXTURE_ERRORS.invalidParams);
});

test('reads are proxied to rpcUrl unchanged, node errors included', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url });
  t.after(async () => { router.close(); await rpc.close(); });
  assert.equal(await router.request({ method: 'eth_getBalance', params: [FIXTURE_ADDRESS, 'latest'] }), '0xde0b6b3a7640000');
  assert.equal(await router.request({ method: 'eth_blockNumber' }), '0x10');
  assert.equal(await router.request({ method: 'eth_call', params: [{ to: OTHER, data: '0x01' }, 'latest'] }), '0x01');
  await assert.rejects(router.request({ method: 'eth_call', params: [{ to: OTHER, data: '0xdeadbeef' }, 'latest'] }), (error) => {
    assert.equal(error.code, 3);
    assert.equal(error.data, '0x08c379a0', 'revert data reaches the page');
    return true;
  });
  assert.deepEqual(rpc.calls, ['eth_getBalance', 'eth_blockNumber', 'eth_call', 'eth_call']);
  assert.ok(READ_METHODS.includes('eth_getTransactionReceipt'));
});

test('signing methods other than personal_sign, chain cheats and unknown wallet calls are refused', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true });
  t.after(async () => { router.close(); await rpc.close(); });
  for (const method of ['eth_sign', 'eth_signTypedData_v4', 'eth_signTransaction', 'eth_sendRawTransaction', 'eth_decrypt', 'hardhat_setBalance', 'evm_increaseTime', 'evm_mine', 'debug_traceTransaction', 'wallet_requestPermissions', 'wallet_watchAsset']) {
    // eslint-disable-next-line no-await-in-loop
    await rejectsWithCode(router.request({ method, params: [] }), FIXTURE_ERRORS.unsupportedMethod);
  }
  assert.deepEqual(rpc.calls, [], 'nothing refused reaches the node');
  await rejectsWithCode(router.request({}), FIXTURE_ERRORS.invalidParams);
});

test('rejectMethods simulates the player pressing Reject', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true, rejectMethods: ['eth_sendTransaction'] });
  t.after(async () => { router.close(); await rpc.close(); });
  await rejectsWithCode(router.request({ method: 'eth_sendTransaction', params: [{ to: OTHER, value: '0x1' }] }), FIXTURE_ERRORS.userRejected);
  assert.equal(rpc.rawTransactions.length, 0);
  assert.deepEqual(router.counts(), { eth_sendTransaction: 1 });
  assert.deepEqual(router.log.at(-1), { method: 'eth_sendTransaction', ok: false, code: 4001 });
});

test('handleJson is the page binding: JSON in, { result } or { error: { code } } out', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url });
  t.after(async () => { router.close(); await rpc.close(); });
  assert.deepEqual(JSON.parse(await router.handleJson(JSON.stringify({ method: 'eth_chainId' }))), { result: '0x1159' });
  assert.deepEqual(JSON.parse(await router.handleJson(JSON.stringify({ method: 'eth_sign', params: [] }))).error.code, 4200);
  assert.deepEqual(JSON.parse(await router.handleJson('not json')).error.code, FIXTURE_ERRORS.invalidParams);
});

test('the key never leaves the router: not in its JSON, inspect output or request log', async (t) => {
  const rpc = await startFakeRpc();
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true });
  t.after(async () => { router.close(); await rpc.close(); });
  await router.request({ method: 'personal_sign', params: ['x', FIXTURE_ADDRESS] });
  await router.request({ method: 'eth_sendTransaction', params: [{ to: OTHER, value: '0x1' }] });
  const bare = FIXTURE_KEY.slice(2);
  for (const text of [JSON.stringify(router), inspect(router, { depth: 10, showHidden: true }), JSON.stringify(router.log), JSON.stringify(router.transactions), String(router)]) {
    assert.ok(!text.includes(bare), 'the key must not appear');
  }
  const malformed = 'not-a-key';
  assert.throws(() => createFixtureWalletRouter({ privateKey: malformed, rpcUrl: rpc.url }), TypeError);
  assert.throws(() => createFixtureWalletRouter({ privateKey: FIXTURE_KEY }), TypeError);
});

// Evaluates the page script as Playwright does (serialized with toString) in a fresh context with
// browser-like EventTarget globals and a stand-in for the exposed binding.
function runPageScript(arg, { topFrame = true, binding = null } = {}) {
  const target = new EventTarget();
  const sandbox = {
    CustomEvent,
    Event,
    JSON,
    Object,
    Promise,
    Error,
    Set,
    Map,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  if (binding) sandbox[arg.binding] = binding;
  const context = vm.createContext(sandbox);
  vm.runInContext(topFrame ? 'globalThis.top = globalThis;' : 'globalThis.top = {};', context);
  const announced = [];
  target.addEventListener('eip6963:announceProvider', (event) => announced.push(event.detail));
  vm.runInContext(`(${fixtureWalletPageScript.toString()})(${JSON.stringify(arg)})`, context);
  return { context, target, announced, run: (code) => vm.runInContext(code, context) };
}

const PAGE_ARG = { binding: FIXTURE_WALLET_BINDING, announce: true, legacy: false, info: { uuid: '00000000-0000-4000-8000-00000000f1f1', name: 'Lester Fixture Wallet', icon: 'data:image/svg+xml,x', rdns: FIXTURE_WALLET_RDNS } };

test('the page script announces over EIP-6963 and answers every requestProvider', async () => {
  const calls = [];
  const binding = async (json) => {
    calls.push(JSON.parse(json));
    const { method } = JSON.parse(json);
    if (method === 'eth_sign') return JSON.stringify({ error: { code: 4200, message: 'no', data: 'x' } });
    return JSON.stringify({ result: method === 'eth_chainId' ? '0x1159' : null });
  };
  const page = runPageScript(PAGE_ARG, { binding });
  assert.equal(page.announced.length, 1);
  assert.equal(page.announced[0].info.rdns, 'io.lestersarcade.fixture');
  assert.equal(page.announced[0].info.name, 'Lester Fixture Wallet');
  assert.ok(Object.isFrozen(page.announced[0]));
  page.target.dispatchEvent(new Event('eip6963:requestProvider'));
  assert.equal(page.announced.length, 2, 'a late requestProvider gets the announcement again');
  assert.equal(page.announced[1].provider, page.announced[0].provider);
  assert.equal(page.run('typeof globalThis.ethereum'), 'undefined', 'no window.ethereum unless legacy');

  const provider = page.announced[0].provider;
  assert.equal(await provider.request({ method: 'eth_chainId' }), '0x1159');
  await assert.rejects(provider.request({ method: 'eth_sign', params: ['0x00'] }), (error) => error.code === 4200 && error.data === 'x' && error.message === 'no');
  await assert.rejects(provider.request('eth_chainId'), (error) => error.code === -32600);
  assert.deepEqual(calls.map((call) => call.method), ['eth_chainId', 'eth_sign']);
  assert.deepEqual(calls[1].params, ['0x00']);
  const listener = () => {};
  assert.equal(provider.on('accountsChanged', listener), provider);
  assert.equal(provider.removeListener('accountsChanged', listener), provider);
});

test('the page script can also sit at window.ethereum, and stays out of iframes', async () => {
  const legacy = runPageScript({ ...PAGE_ARG, announce: false, legacy: true }, { binding: async () => JSON.stringify({ result: ['0xabc'] }) });
  assert.equal(legacy.announced.length, 0);
  assert.equal(legacy.run('globalThis.ethereum.isLestersFixture'), true);
  assert.deepEqual(await legacy.run("globalThis.ethereum.request({ method: 'eth_accounts' })"), ['0xabc']);

  const iframe = runPageScript(PAGE_ARG, { topFrame: false, binding: async () => '{}' });
  assert.equal(iframe.announced.length, 0, 'the game iframes get no wallet');

  const unbound = runPageScript(PAGE_ARG);
  await assert.rejects(unbound.announced[0].provider.request({ method: 'eth_chainId' }), (error) => error.code === 4900);
});

// A Playwright-shaped page for installFixtureWallet: exposeBinding hands the callback a source
// ({ context, page, frame }), as Playwright does, so a call can come from any frame.
function fakePlaywrightPage(url = 'http://127.0.0.1:8850/') {
  const bindings = new Map();
  const scripts = [];
  const frame = (frameUrl) => ({ url: () => frameUrl });
  const main = frame(url);
  const page = {
    mainFrame: () => main,
    async exposeBinding(name, fn) { bindings.set(name, fn); },
    async addInitScript(script, arg) { scripts.push({ script, arg }); },
  };
  const call = (source, payload) => Promise.resolve(bindings.get(FIXTURE_WALLET_BINDING)({ context: {}, page, frame: source }, JSON.stringify(payload))).then((json) => JSON.parse(json));
  return { page, main, frame, bindings, scripts, call };
}

test('installFixtureWallet exposes the router and injects only public info', async (t) => {
  const rpc = await startFakeRpc();
  const fake = fakePlaywrightPage();
  const wallet = await installFixtureWallet(fake.page, { rpcUrl: rpc.url, privateKey: FIXTURE_KEY });
  t.after(async () => { wallet.close(); await rpc.close(); });
  assert.equal(wallet.address, FIXTURE_ADDRESS);
  assert.equal(wallet.info.rdns, FIXTURE_WALLET_RDNS);
  assert.ok(fake.bindings.has(FIXTURE_WALLET_BINDING));
  assert.equal(fake.scripts.length, 1);
  assert.equal(fake.scripts[0].script, fixtureWalletPageScript);
  assert.deepEqual(Object.keys(fake.scripts[0].arg).sort(), ['announce', 'binding', 'info', 'legacy']);
  assert.ok(!JSON.stringify(fake.scripts[0].arg).includes(FIXTURE_KEY.slice(2)), 'the key never goes to the page');
  assert.deepEqual(await fake.call(fake.main, { method: 'eth_requestAccounts' }), { result: [FIXTURE_ADDRESS] });
  assert.equal(wallet.router.connected, true);
  assert.deepEqual(wallet.refused, []);

  await assert.rejects(installFixtureWallet({}, { rpcUrl: rpc.url, privateKey: FIXTURE_KEY }), TypeError);
  await assert.rejects(installFixtureWallet({ addInitScript() {}, exposeFunction() {} }, { rpcUrl: rpc.url, privateKey: FIXTURE_KEY }), TypeError, 'exposeFunction alone cannot tell the calling frame');
  await assert.rejects(installFixtureWallet(fakePlaywrightPage().page, { rpcUrl: rpc.url, privateKey: FIXTURE_KEY, announce: false, legacy: false }), TypeError);
  await assert.rejects(installFixtureWallet(fakePlaywrightPage().page, { rpcUrl: rpc.url, privateKey: FIXTURE_KEY, origin: 'not an origin' }), TypeError);
});

test('the binding answers the portal top frame only: child frames and other origins never reach the signer', async (t) => {
  const rpc = await startFakeRpc();
  const fake = fakePlaywrightPage('http://127.0.0.1:8850/?evidenceSafe=1');
  const wallet = await installFixtureWallet(fake.page, { rpcUrl: rpc.url, privateKey: FIXTURE_KEY, origin: 'http://127.0.0.1:8850', connected: true });
  t.after(async () => { wallet.close(); await rpc.close(); });
  const refusedCode = { error: { code: FIXTURE_ERRORS.unauthorized, message: 'The fixture wallet answers the portal top frame only.' } };

  // A game iframe (same origin) and a cross-origin frame (a WalletConnect verify frame) are refused.
  const gameFrame = fake.frame('http://127.0.0.1:8850/chikun/index.html');
  const verifyFrame = fake.frame('https://verify.walletconnect.org/abc');
  for (const frame of [gameFrame, verifyFrame]) {
    // eslint-disable-next-line no-await-in-loop
    assert.deepEqual(await fake.call(frame, { method: 'personal_sign', params: ['hello', FIXTURE_ADDRESS] }), refusedCode);
    // eslint-disable-next-line no-await-in-loop
    assert.deepEqual(await fake.call(frame, { method: 'eth_sendTransaction', params: [{ to: OTHER, value: '0x1' }] }), refusedCode);
  }
  // The top frame of another page in the context, on another origin, is refused too.
  const stranger = fakePlaywrightPage('http://127.0.0.1:57016/');
  assert.deepEqual(JSON.parse(await fake.bindings.get(FIXTURE_WALLET_BINDING)({ context: {}, page: stranger.page, frame: stranger.main }, JSON.stringify({ method: 'eth_accounts' }))), refusedCode);
  assert.deepEqual(wallet.router.log, [], 'no refused call reached the router');
  assert.deepEqual(rpc.rawTransactions, []);
  assert.deepEqual(wallet.refused.map((entry) => ({ ...entry })), [
    { reason: 'not the top frame', origin: 'http://127.0.0.1:8850' },
    { reason: 'not the top frame', origin: 'http://127.0.0.1:8850' },
    { reason: 'not the top frame', origin: 'https://verify.walletconnect.org' },
    { reason: 'not the top frame', origin: 'https://verify.walletconnect.org' },
    { reason: 'another origin', origin: 'http://127.0.0.1:57016' },
  ]);

  // The portal's own top frame is answered.
  assert.deepEqual(await fake.call(fake.main, { method: 'eth_accounts' }), { result: [FIXTURE_ADDRESS] });
  assert.deepEqual(wallet.router.counts(), { eth_accounts: 1 });

  // Without `origin`, any page's top frame is answered and every child frame is still refused.
  assert.equal(fixtureBindingRefusal({ page: stranger.page, frame: stranger.main }), null);
  assert.deepEqual(fixtureBindingRefusal({ page: stranger.page, frame: gameFrame }), { reason: 'not the top frame', origin: 'http://127.0.0.1:8850' });
  assert.deepEqual(fixtureBindingRefusal({}), { reason: 'not the top frame', origin: null });
});

test('allowTransaction vets every send before it is signed', async (t) => {
  const rpc = await startFakeRpc();
  const entry = '0x00000000000000000000000000000000000e0717';
  const seen = [];
  const allowTransaction = (tx) => {
    seen.push(tx);
    if (tx.to !== entry) return 'only the Ranked entry';
    return tx.value <= 102n ? true : 'more than the quoted total';
  };
  const router = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true, allowTransaction });
  t.after(async () => { router.close(); await rpc.close(); });
  await assert.rejects(router.request({ method: 'eth_sendTransaction', params: [{ to: OTHER, value: '0x1' }] }), (error) => error.code === FIXTURE_ERRORS.unauthorized && /only the Ranked entry/.test(error.message));
  await assert.rejects(router.request({ method: 'eth_sendTransaction', params: [{ to: entry, value: '0x67' }] }), /more than the quoted total/);
  await assert.rejects(router.request({ method: 'eth_sendTransaction', params: [{ value: '0x1' }] }), /only the Ranked entry/, 'a contract creation is not the entry');
  assert.equal(rpc.rawTransactions.length, 0, 'nothing refused is signed or sent');
  assert.ok(!rpc.calls.includes('eth_getTransactionCount'), 'refused before the signer populates anything');
  const hash = await router.request({ method: 'eth_sendTransaction', params: [{ to: entry.toUpperCase().replace('0X', '0x'), value: '0x66', data: '0xabcdef01' }] });
  assert.equal(rpc.rawTransactions.length, 1);
  assert.equal(hash, ethers.keccak256(rpc.rawTransactions[0]).toLowerCase());
  assert.deepEqual({ ...seen.at(-1) }, { to: entry, value: 102n, data: '0xabcdef01' }, 'the policy sees the normalized to, value and data');
  const throwing = createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, connected: true, allowTransaction: () => { throw new Error('policy broke'); } });
  await assert.rejects(throwing.request({ method: 'eth_sendTransaction', params: [{ to: entry, value: '0x1' }] }), /policy broke/);
  throwing.close();
  assert.throws(() => createFixtureWalletRouter({ privateKey: FIXTURE_KEY, rpcUrl: rpc.url, allowTransaction: 'yes' }), TypeError);
});

test('a real transaction through the fixture reaches the in-process chain', async (t) => {
  const chain = await startLocalChain();
  const server = await serveJsonRpc(chain.eip1193);
  const player = chain.wallets.player1;
  const router = createFixtureWalletRouter({ privateKey: player.privateKey, rpcUrl: server.url, connected: true });
  t.after(async () => { router.close(); await server.close(); await chain.close(); });
  const recipient = ethers.Wallet.createRandom().address;
  const hash = await router.request({ method: 'eth_sendTransaction', params: [{ from: player.address, to: recipient, value: ethers.toQuantity(ethers.parseEther('0.102')) }] });
  const receipt = await chain.provider.waitForTransaction(hash);
  assert.equal(receipt.status, 1);
  assert.equal(receipt.from.toLowerCase(), player.address.toLowerCase());
  assert.equal(await chain.provider.getBalance(recipient), ethers.parseEther('0.102'));
  assert.equal(await router.request({ method: 'eth_getBalance', params: [recipient, 'latest'] }), ethers.toQuantity(ethers.parseEther('0.102')));
  const fetched = await router.request({ method: 'eth_getTransactionReceipt', params: [hash] });
  assert.equal(fetched.status, '0x1');
});
