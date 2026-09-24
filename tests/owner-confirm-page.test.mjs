// Owner page apps/portal/owner/confirm-dev-wallet.{html,mjs} (runbook step 4, contract §13): pure
// call encoding, CSP and noindex rules, and the full flow with a fake window.ethereum backed by the
// in-process chain, served from a local static server like the deploy session serves it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';
import { ethers } from 'ethers';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';
import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';
import {
  CONFIRM_DEV_WALLET_SELECTOR,
  LITEFORGE_CHAIN,
  OWNER_WALLET,
  RANKED_GAMES,
  addChainParams,
  buildConfirmCalls,
  createConfirmController,
  explorerTxUrl,
  liteForgeFeeFields,
  mountConfirmPage,
} from '../apps/portal/owner/confirm-dev-wallet.mjs';
import { activateLocalGames, deployLocalSuite, loadArtifact, localContracts, localDeployConfig, startLocalChain } from '../scripts/lib/local-chain.mjs';
import { deployedDeploymentInput, normalizeDeploymentInput, predictedDeploymentInput, writeLitvmAddressModule } from '../scripts/generate-litvm-addresses.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const portalRoot = join(root, 'apps', 'portal');
const html = readFileSync(join(portalRoot, 'owner', 'confirm-dev-wallet.html'), 'utf8');
const pageModule = readFileSync(join(portalRoot, 'owner', 'confirm-dev-wallet.mjs'), 'utf8');
const testnetConfig = JSON.parse(readFileSync(join(root, 'contracts', 'deploy-config.testnet.json'), 'utf8'));
const registryInterface = new ethers.Interface(loadArtifact('GameRegistry').abi);
const vendoredEthers = () => import('../apps/portal/vendor/ethers.min.js');

let chain;

before(async () => {
  chain = await startLocalChain();
});

after(async () => {
  await chain?.close();
});

// A browser wallet (EIP-1193) backed by the local chain: it answers as `account`, starts on
// `chainIdHex`, knows only the chains in `knownChains`, and forwards transactions to the chain.
// `beforeSend(params)` runs when a transaction request arrives (the wallet popup is open); `sendError`
// is thrown instead of sending. `sent` holds each eth_sendTransaction params object; `emit(event)`
// fires the listeners registered with `on`, like a wallet's accountsChanged / chainChanged.
function fakeEthereum({ account, chainIdHex = '0x1159', knownChains = ['0x1', '0x1159'], beforeSend = null, sendError = null }) {
  const calls = [];
  const sent = [];
  const listeners = {};
  let current = chainIdHex;
  const known = new Set(knownChains);
  return {
    calls,
    sent,
    on(event, handler) { (listeners[event] ??= []).push(handler); },
    emit(event, value) { for (const handler of listeners[event] ?? []) handler(value); },
    async request({ method, params = [] }) {
      calls.push(method);
      if (method === 'eth_sendTransaction') {
        sent.push(params[0]);
        if (beforeSend) await beforeSend(params[0]);
        if (sendError) throw sendError;
      }
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account];
        case 'eth_chainId':
          return current;
        case 'wallet_switchEthereumChain':
          if (!known.has(params[0].chainId)) throw Object.assign(new Error('Unrecognized chain ID'), { code: 4902 });
          current = params[0].chainId;
          return null;
        case 'wallet_addEthereumChain':
          known.add(params[0].chainId);
          return null;
        case 'eth_sendTransaction':
          assert.equal(current, '0x1159', 'never sends off LiteForge');
          return chain.eip1193.request({ method, params });
        default:
          throw new Error(`fake wallet does not support ${method}`);
      }
    },
  };
}

// The page's public-RPC reader, pointed at the local chain, built with the vendored ethers the page uses.
const localReader = (ethersLib) => new ethersLib.BrowserProvider(chain.eip1193, 4441, { staticNetwork: true, cacheTimeout: -1 });

function controllerFor({ ethereum, deployment }) {
  return createConfirmController({ ethereum, deployment, loadEthers: vendoredEthers, createReadProvider: localReader, sleep: async () => {}, receiptPollMs: 1 });
}

async function serveStaticPortal(overrides = {}) {
  const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css' };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (overrides[path] !== undefined) {
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }).end(overrides[path]);
      return;
    }
    const file = normalize(join(portalRoot, path));
    if (!file.startsWith(portalRoot + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolveClose) => server.close(() => resolveClose())) };
}

function moduleImports(source) {
  const specifiers = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if ((node.type === 'ImportDeclaration' || node.type === 'ImportExpression' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source?.type === 'Literal') specifiers.push(node.source.value);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  return specifiers;
}

test('confirm calls encode confirmDevWallet for all three games', () => {
  const calls = buildConfirmCalls(LITVM_DEPLOYMENT);
  assert.deepEqual(calls.map((call) => call.gameId), ['lester-blaster', 'chikun', 'stacked']);
  assert.equal(registryInterface.getFunction('confirmDevWallet').selector, CONFIRM_DEV_WALLET_SELECTOR);
  for (const call of calls) {
    assert.equal(call.gameId32, ethers.id(call.gameId));
    assert.equal(call.to, LITVM_DEPLOYMENT.addresses.gameRegistry);
    assert.equal(call.data, registryInterface.encodeFunctionData('confirmDevWallet', [ethers.id(call.gameId)]));
    assert.ok(call.data.startsWith('0x33cf3157'));
  }
  assert.deepEqual(RANKED_GAMES.map((game) => game.gameId32), ['lester-blaster', 'chikun', 'stacked'].map((id) => ethers.id(id)));
  assert.equal(OWNER_WALLET, testnetConfig.developerWallet.toLowerCase(), 'the owner is the configured developer wallet');
  assert.equal(OWNER_WALLET, '0x07cec6fc49caf6528f2f2f796042629cd3f48b26');
  // Chain constants match the portal network definition (the page does not import arcade-core).
  assert.equal(LITEFORGE_CHAIN.chainId, LITVM_LITEFORGE_NETWORK.chainId);
  assert.equal(LITEFORGE_CHAIN.chainIdHex, LITVM_LITEFORGE_NETWORK.chainIdHex);
  assert.equal(LITEFORGE_CHAIN.rpcUrl, LITVM_LITEFORGE_NETWORK.rpcUrls.http);
  assert.equal(LITEFORGE_CHAIN.explorerUrl, LITVM_LITEFORGE_NETWORK.explorerUrl);
  assert.deepEqual({ ...LITEFORGE_CHAIN.nativeCurrency }, { ...LITVM_LITEFORGE_NETWORK.nativeCurrency });
  assert.deepEqual(addChainParams(), { chainId: '0x1159', chainName: 'LitVM LiteForge', nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 }, rpcUrls: ['https://liteforge.rpc.caldera.xyz/http'], blockExplorerUrls: ['https://liteforge.explorer.caldera.xyz'] });
  assert.equal(explorerTxUrl(`0x${'ab'.repeat(32)}`), `https://liteforge.explorer.caldera.xyz/tx/0x${'ab'.repeat(32)}`);
  assert.equal(explorerTxUrl('javascript:alert(1)'), null);
  assert.throws(() => buildConfirmCalls({ addresses: { gameRegistry: null } }), /GameRegistry/);
});

test('page is noindex, CSP-safe and module-only', () => {
  assert.match(html, /<meta name="robots" content="noindex" \/>/);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, 'exactly one script tag');
  assert.match(scripts[0][1], /\btype="module"/);
  assert.match(scripts[0][1], /\bsrc="\.\/confirm-dev-wallet\.mjs"/);
  assert.equal(scripts[0][2].trim(), '', 'no inline script');
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'no inline event handlers');
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /(?:src|href)="(?:https?:)?\/\//i, 'no cross-origin resources');
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i, 'styles are inline only');
  assert.match(html, /<style>[\s\S]+<\/style>/);
  for (const id of ['owner-confirm', 'owner-status', 'owner-games', 'owner-actions', 'owner-account', 'owner-registry', 'owner-wallet', 'owner-last-tx']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  // Module rules (contract §11 rule 6): no innerHTML, eval or Function; same-origin relative imports only.
  assert.doesNotMatch(pageModule, /\.innerHTML\s*=|\beval\s*\(|new Function\s*\(|document\.write/);
  assert.deepEqual(moduleImports(pageModule).sort(), ['../src/generated/litvm-addresses.mjs', '../vendor/ethers.min.js']);
  assert.doesNotMatch(pageModule, /privateKey|mnemonic|eth_sign\b|personal_sign|signTypedData/, 'never touches keys or signs messages');

  // The portal CSP that Vercel applies to /owner/confirm-dev-wallet.html allows this page as is.
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  let csp = null;
  for (const rule of vercel.headers ?? []) {
    let matches = false;
    try {
      matches = new RegExp(`^${rule.source}$`).test('/owner/confirm-dev-wallet.html');
    } catch {
      matches = false;
    }
    const header = matches ? (rule.headers ?? []).find((entry) => entry.key.toLowerCase() === 'content-security-policy') : null;
    if (header) csp = header.value;
  }
  assert.ok(csp, 'a CSP applies to the owner page');
  const directive = (name) => (csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? '').split(/\s+/).slice(1);
  assert.ok(directive('script-src').includes("'self'"), 'module scripts load from self');
  assert.ok(directive('connect-src').includes(new URL(LITEFORGE_CHAIN.rpcUrl).origin), 'public RPC reads are allowed');
  // The page's only styling is one inline <style> block: style-src must allow it, by 'unsafe-inline'
  // or by that block's hash (if the CSP owner tightens style-src, this fails instead of an unstyled page).
  const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const styleHash = `'sha256-${createHash('sha256').update(styleBlock, 'utf8').digest('base64')}'`;
  const styleSrc = directive('style-src').length > 0 ? directive('style-src') : directive('default-src');
  assert.ok(styleSrc.includes("'unsafe-inline'") || styleSrc.includes(styleHash), `style-src allows the inline <style> block ('unsafe-inline' or ${styleHash})`);
});

test('page shows the install-a-wallet state without a wallet', async () => {
  const controller = controllerFor({ ethereum: null, deployment: LITVM_DEPLOYMENT });
  assert.equal(controller.state.phase, 'no-wallet');
  assert.match(controller.state.message, /Install MetaMask or Rabby/);
  await controller.connect();
  assert.equal(controller.state.phase, 'no-wallet');
});

test('page refuses non-owner accounts and undeployed modules', async () => {
  const snapshot = await chain.snapshot();
  try {
    const owner = await chain.impersonate(OWNER_WALLET);
    // 1. Not the owner: refused before any read or transaction.
    const stranger = fakeEthereum({ account: chain.wallets.attacker.address.toLowerCase() });
    const refused = controllerFor({ ethereum: stranger, deployment: LITVM_DEPLOYMENT });
    await refused.connect();
    assert.equal(refused.state.phase, 'wrong-account');
    assert.match(refused.state.message, /only works for the owner wallet/);
    assert.equal(stranger.calls.includes('eth_sendTransaction'), false);

    // 2. The owner, but nothing deployed at the module's addresses (the predicted module before step 3).
    const predicted = normalizeDeploymentInput(predictedDeploymentInput(testnetConfig));
    const wallet = fakeEthereum({ account: await owner.getAddress() });
    const undeployed = controllerFor({ ethereum: wallet, deployment: predicted });
    await undeployed.connect();
    assert.equal(undeployed.state.phase, 'not-deployed');
    assert.match(undeployed.state.message, /not deployed yet/);
    assert.equal(wallet.calls.includes('eth_sendTransaction'), false);

    // 3. A wrong chain gets one explanation first; switching adds LiteForge when the wallet lacks it.
    const elsewhere = fakeEthereum({ account: await owner.getAddress(), chainIdHex: '0x1', knownChains: ['0x1'] });
    const switching = controllerFor({ ethereum: elsewhere, deployment: predicted });
    await switching.connect();
    assert.equal(switching.state.phase, 'wrong-chain');
    assert.match(switching.state.message, /chain 4441/);
    assert.equal(elsewhere.calls.includes('wallet_switchEthereumChain'), false, 'no switch prompt before the explanation');
    await switching.switchChain();
    assert.deepEqual(elsewhere.calls.filter((method) => method.startsWith('wallet_')), ['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain']);
    assert.equal(switching.state.phase, 'not-deployed', 'after the switch it reaches the on-chain gate');

    // 4. A module whose games are not registered by that registry is refused too.
    const bare = await (await new ethers.ContractFactory(loadArtifact('GameRegistry').abi, loadArtifact('GameRegistry').bytecode, chain.wallets.operator).deploy(chain.wallets.operator.address)).waitForDeployment();
    const unregistered = controllerFor({ ethereum: fakeEthereum({ account: await owner.getAddress() }), deployment: { ...predicted, addresses: { ...predicted.addresses, gameRegistry: (await bare.getAddress()).toLowerCase() } } });
    await unregistered.connect();
    assert.equal(unregistered.state.phase, 'not-registered');

    // 5. A public-RPC failure is reported as such, and nothing is sent.
    const offline = fakeEthereum({ account: await owner.getAddress() });
    const unreachable = createConfirmController({ ethereum: offline, deployment: predicted, loadEthers: vendoredEthers, createReadProvider: () => ({ getCode: async () => { throw new Error('fixture RPC down'); } }) });
    await unreachable.connect();
    assert.equal(unreachable.state.phase, 'error');
    assert.match(unreachable.state.message, /Could not read LiteForge over its public RPC \(fixture RPC down\)/);
    assert.equal(offline.calls.includes('eth_sendTransaction'), false);
  } finally {
    await chain.revert(snapshot);
  }
});

test('page loads from a local static server and confirms each game against the local chain with a deployed module', async () => {
  const snapshot = await chain.snapshot();
  const dir = mkdtempSync(join(tmpdir(), 'owner-page-'));
  let server = null;
  try {
    // Runbook step 3 on the local chain: deploy with the owner as developer wallet, then regenerate the
    // address module as `deployed` from the record, exactly as the broadcast does.
    const config = await localDeployConfig(chain.wallets, { developerWallet: OWNER_WALLET });
    config.games = config.games.map((game) => ({ ...game, devWallet: OWNER_WALLET }));
    const record = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets, config });
    const generated = writeLitvmAddressModule({ root, mode: 'deployed', record, outPath: join(dir, 'litvm-addresses.mjs') });
    assert.equal(generated.status, 'deployed');
    const { LITVM_DEPLOYMENT: deployed } = await import(pathToFileURL(generated.path).href);

    // Serve apps/portal as the web root with the regenerated module, like `python -m http.server`.
    server = await serveStaticPortal({ '/src/generated/litvm-addresses.mjs': generated.content });
    const page = await fetch(`${server.origin}/owner/confirm-dev-wallet.html`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const src = (await page.text()).match(/<script type="module" src="([^"]+)"/)[1];
    const moduleUrl = new URL(src, `${server.origin}/owner/confirm-dev-wallet.html`);
    const moduleResponse = await fetch(moduleUrl);
    assert.equal(moduleResponse.status, 200);
    assert.match(moduleResponse.headers.get('content-type'), /javascript/);
    const moduleSource = await moduleResponse.text();
    for (const specifier of moduleImports(moduleSource)) {
      const dependency = await fetch(new URL(specifier, moduleUrl));
      assert.equal(dependency.status, 200, `${specifier} resolves on the static server`);
      const body = await dependency.text();
      if (specifier.includes('litvm-addresses')) assert.match(body, /status: 'deployed'/);
    }

    // The flow: owner wallet on LiteForge, three clicks, three transactions.
    const owner = await chain.impersonate(OWNER_WALLET);
    const wallet = fakeEthereum({ account: (await owner.getAddress()).toLowerCase() });
    const phases = [];
    const controller = createConfirmController({ ethereum: wallet, deployment: deployed, loadEthers: vendoredEthers, createReadProvider: localReader, sleep: async () => {}, receiptPollMs: 1, onChange: (state) => phases.push(state.phase) });
    await controller.connect();
    assert.equal(controller.state.phase, 'ready', controller.state.message);
    assert.equal(controller.state.games.filter((game) => !game.devWalletConfirmed).length, 3);
    const sentBefore = wallet.calls.filter((method) => method === 'eth_sendTransaction').length;
    for (const [index, game] of RANKED_GAMES.entries()) {
      await controller.confirmNext();
      assert.equal(wallet.calls.filter((method) => method === 'eth_sendTransaction').length, sentBefore + index + 1, 'one transaction per click');
      assert.equal(controller.state.lastTx.gameId, game.gameId);
      assert.equal(controller.state.lastTx.url, `https://liteforge.explorer.caldera.xyz/tx/${controller.state.lastTx.hash}`);
      const receipt = await chain.provider.getTransactionReceipt(controller.state.lastTx.hash);
      assert.equal(receipt.from.toLowerCase(), OWNER_WALLET);
      assert.equal(receipt.to.toLowerCase(), deployed.addresses.gameRegistry);
      assert.equal(registryInterface.parseLog(receipt.logs[0]).name, 'DevWalletConfirmed');
      // The page priced the transaction itself: ten times the base fee of the block it read (at least 5 gwei), no tip.
      const sent = wallet.sent.at(-1);
      const block = await chain.provider.getBlock(receipt.blockNumber - 1);
      assert.equal(sent.maxPriorityFeePerGas, '0x0');
      assert.ok(BigInt(sent.maxFeePerGas) >= block.baseFeePerGas * 10n || BigInt(sent.maxFeePerGas) === 5_000_000_000n, 'max fee is 10x the base fee (or the 5 gwei floor)');
    }
    assert.equal(controller.state.phase, 'done');
    assert.match(controller.state.message, /operator now activates them \(runbook step 5\)/);
    assert.match(controller.state.message, /operator-actions\.mjs activate/);
    assert.ok(phases.includes('sending') && phases.includes('checking'));
    const { gameRegistry } = localContracts(record, chain.provider);
    for (const game of RANKED_GAMES) assert.equal((await gameRegistry.getGame(game.gameId32)).devWalletConfirmed, true, game.gameId);

    // Reopening the page skips confirmed games: no further transaction.
    const again = fakeEthereum({ account: OWNER_WALLET });
    const reopened = controllerFor({ ethereum: again, deployment: deployed });
    await reopened.connect();
    assert.equal(reopened.state.phase, 'done');
    await reopened.confirmNext();
    assert.equal(again.calls.includes('eth_sendTransaction'), false);

    // Step 5 then activates the games.
    await activateLocalGames({ provider: chain.provider, record, developer: owner, operator: chain.wallets.operator });
    for (const game of RANKED_GAMES) assert.equal((await gameRegistry.getGame(game.gameId32)).playable, true);
  } finally {
    await server?.close();
    rmSync(dir, { recursive: true, force: true });
    await chain.revert(snapshot);
  }
});

test('page gate also passes with the predicted module once contracts exist at the predicted addresses', async () => {
  const snapshot = await chain.snapshot();
  try {
    // The real operator at nonce 0 (impersonated) lands the suite at the §8.1 predicted addresses.
    const operator = await chain.impersonate(testnetConfig.operator);
    await deployLocalSuite({ provider: chain.provider, wallets: { operator }, config: testnetConfig });
    const predicted = normalizeDeploymentInput(predictedDeploymentInput(testnetConfig));
    assert.equal(predicted.status, 'predicted');
    const owner = await chain.impersonate(OWNER_WALLET);
    const wallet = fakeEthereum({ account: (await owner.getAddress()).toLowerCase() });
    const controller = controllerFor({ ethereum: wallet, deployment: predicted });
    await controller.connect();
    assert.equal(controller.state.phase, 'ready', controller.state.message);
    await controller.confirmNext();
    assert.equal(controller.state.games.filter((game) => game.devWalletConfirmed).length, 1, 'one game per click');
    assert.equal(controller.state.phase, 'ready');
  } finally {
    await chain.revert(snapshot);
  }
});

// The local suite with the owner as every game's developer wallet, and its deployed address module.
async function deployForOwner() {
  const config = await localDeployConfig(chain.wallets, { developerWallet: OWNER_WALLET });
  config.games = config.games.map((game) => ({ ...game, devWallet: OWNER_WALLET }));
  const record = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets, config });
  return { record, deployment: normalizeDeploymentInput(deployedDeploymentInput(record)) };
}

test('a double click or a wallet event mid-send never sends a second transaction', async () => {
  const snapshot = await chain.snapshot();
  try {
    const { deployment } = await deployForOwner();
    const owner = await chain.impersonate(OWNER_WALLET);
    const account = (await owner.getAddress()).toLowerCase();

    // Two quick clicks: one transaction, for the first game only.
    const wallet = fakeEthereum({ account });
    const controller = controllerFor({ ethereum: wallet, deployment });
    await controller.connect();
    assert.equal(controller.state.phase, 'ready', controller.state.message);
    await Promise.all([controller.confirmNext(), controller.confirmNext()]);
    assert.equal(wallet.sent.length, 1, 'one eth_sendTransaction for two quick clicks');
    assert.equal(wallet.sent[0].data, buildConfirmCalls(deployment)[0].data);
    assert.equal(wallet.sent[0].chainId, '0x1159', 'the wallet can refuse a request that races a chain switch');
    assert.equal(controller.state.games.filter((game) => game.devWalletConfirmed).length, 1);
    assert.equal(controller.state.phase, 'ready');

    // accountsChanged / chainChanged while the wallet popup is open: the page stays in 'sending' (no
    // second Confirm button), then re-checks the wallet once the send is over.
    const phasesDuringSend = [];
    let midSend = null;
    let midSendController = null;
    const eventWallet = fakeEthereum({
      account,
      beforeSend: async () => {
        midSend = midSendController.connect();
        phasesDuringSend.push(midSendController.state.phase);
        await midSendController.confirmNext();
        phasesDuringSend.push(midSendController.state.phase);
      },
    });
    midSendController = controllerFor({ ethereum: eventWallet, deployment });
    await midSendController.connect();
    assert.equal(midSendController.state.phase, 'ready');
    const requestsBefore = eventWallet.calls.filter((method) => method === 'eth_requestAccounts').length;
    await midSendController.confirmNext();
    await midSend;
    assert.deepEqual(phasesDuringSend, ['sending', 'sending'], 'no reset to ready while the transaction is in flight');
    assert.equal(eventWallet.sent.length, 1, 'the click during the send did nothing');
    assert.equal(eventWallet.calls.filter((method) => method === 'eth_requestAccounts').length, requestsBefore + 1, 'the deferred re-check ran after the send');
    assert.equal(midSendController.state.phase, 'ready');
    assert.equal(midSendController.state.games.filter((game) => game.devWalletConfirmed).length, 2);
  } finally {
    await chain.revert(snapshot);
  }
});

test('page refuses a registry whose developer wallet is not the owner, and reports rejections, reverts and timeouts', async () => {
  const snapshot = await chain.snapshot();
  try {
    const owner = await chain.impersonate(OWNER_WALLET);
    const account = (await owner.getAddress()).toLowerCase();

    // 1. Games registered with another developer wallet (the local default config): refused, nothing sent.
    const foreign = await deployLocalSuite({ provider: chain.provider, wallets: chain.wallets });
    const foreignWallet = fakeEthereum({ account });
    const mismatch = controllerFor({ ethereum: foreignWallet, deployment: normalizeDeploymentInput(deployedDeploymentInput(foreign)) });
    await mismatch.connect();
    assert.equal(mismatch.state.phase, 'dev-wallet-mismatch');
    assert.match(mismatch.state.message, /registered with developer wallet 0x[0-9a-fA-F]{40}, not the owner wallet/);
    await mismatch.confirmNext();
    assert.deepEqual(foreignWallet.sent, []);

    const { deployment } = await deployForOwner();
    // 2. The owner rejects the request in the wallet (EIP-1193 code 4001).
    const rejecting = fakeEthereum({ account, sendError: Object.assign(new Error('User rejected the request.'), { code: 4001 }) });
    const rejected = controllerFor({ ethereum: rejecting, deployment });
    await rejected.connect();
    await rejected.confirmNext();
    assert.equal(rejected.state.phase, 'error');
    assert.equal(rejected.state.message, 'You rejected the request in your wallet. Nothing was sent.');
    assert.equal(rejected.state.lastTx, null);
    await rejected.connect();
    assert.equal(rejected.state.phase, 'ready', 'connecting again offers the same game');
    assert.equal(rejected.state.games.filter((game) => !game.devWalletConfirmed).length, 3);

    // 3. A receipt with status 0 is reported as a revert, and the game stays unconfirmed.
    const revertingReader = (ethersLib) => {
      const reader = localReader(ethersLib);
      reader.getTransactionReceipt = async () => ({ status: 0 });
      return reader;
    };
    const reverted = createConfirmController({ ethereum: fakeEthereum({ account }), deployment, loadEthers: vendoredEthers, createReadProvider: revertingReader, sleep: async () => {}, receiptPollMs: 1 });
    await reverted.connect();
    await reverted.confirmNext();
    assert.equal(reverted.state.phase, 'error');
    assert.match(reverted.state.message, /The Hard Money Heroes transaction reverted \(0x[0-9a-f]{64}\)/);
    assert.equal(reverted.state.games[0].devWalletConfirmed, false);

    // 4. No receipt before the timeout: the page says so and points at the explorer.
    const silentReader = (ethersLib) => {
      const reader = localReader(ethersLib);
      reader.getTransactionReceipt = async () => null;
      return reader;
    };
    const slow = createConfirmController({ ethereum: fakeEthereum({ account }), deployment, loadEthers: vendoredEthers, createReadProvider: silentReader, sleep: async () => {}, receiptPollMs: 1, receiptTimeoutMs: -1 });
    await slow.connect();
    await slow.confirmNext();
    assert.equal(slow.state.phase, 'error');
    assert.match(slow.state.message, /No receipt for 0x[0-9a-f]{64} yet\. Check it on the explorer/);
    assert.match(slow.state.lastTx.url, /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/);
  } finally {
    await chain.revert(snapshot);
  }
});

// A minimal DOM for mountConfirmPage: getElementById for the page's ids, createElement, append,
// replaceChildren, setAttribute, dataset, disabled and click listeners.
function fakeDocument() {
  class FakeElement {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.textContent = '';
      this.className = '';
      this.dataset = {};
      this.attributes = {};
      this.disabled = false;
      this.listeners = {};
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
    click() { return Promise.all((this.listeners.click ?? []).map((handler) => handler())); }
    get text() { return this.textContent + this.children.map((child) => child.text).join(''); }
  }
  const ids = ['owner-confirm', 'owner-status', 'owner-games', 'owner-actions', 'owner-account', 'owner-registry', 'owner-wallet', 'owner-last-tx'];
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `the page has #${id}`);
  const byId = new Map(ids.map((id) => [id, new FakeElement('div')]));
  const doc = { getElementById: (id) => byId.get(id) ?? null, createElement: (tag) => new FakeElement(tag) };
  const buttons = () => byId.get('owner-actions').children.filter((node) => node.tagName === 'BUTTON');
  return { doc, byId, buttons };
}

test('the mounted page renders every state through the DOM, with the committed module and the default public-RPC reader', async () => {
  // No wallet: the install message, no action buttons, and the committed module's registry address.
  const bare = fakeDocument();
  const idle = mountConfirmPage(bare.doc, {});
  assert.equal(idle.state.phase, 'no-wallet');
  assert.match(bare.byId.get('owner-status').textContent, /No browser wallet found\. Install MetaMask or Rabby/);
  assert.equal(bare.byId.get('owner-status').dataset.phase, 'no-wallet');
  assert.deepEqual(bare.buttons(), []);
  assert.equal(bare.byId.get('owner-registry').textContent, `${LITVM_DEPLOYMENT.addresses.gameRegistry} (address module: ${LITVM_DEPLOYMENT.status})`);
  assert.equal(bare.byId.get('owner-wallet').textContent, OWNER_WALLET);
  assert.equal(bare.byId.get('owner-account').textContent, 'not connected');
  assert.deepEqual(bare.byId.get('owner-games').children.map((item) => item.text), ['Hard Money Heroes · not checked yet', "Chikun's Escape · not checked yet", 'STACKED · not checked yet']);

  // A stranger's wallet: Connect, then the refusal and a Connect again button. Nothing is read or sent.
  const strangerPage = fakeDocument();
  const stranger = fakeEthereum({ account: `0x${'ab'.repeat(20)}` });
  mountConfirmPage(strangerPage.doc, { ethereum: stranger });
  assert.deepEqual(strangerPage.buttons().map((node) => node.textContent), ['Connect owner wallet']);
  await strangerPage.buttons()[0].click();
  assert.equal(strangerPage.byId.get('owner-status').dataset.phase, 'wrong-account');
  assert.match(strangerPage.byId.get('owner-status').textContent, /only works for the owner wallet/);
  assert.deepEqual(strangerPage.buttons().map((node) => node.textContent), ['Connect again']);
  assert.deepEqual(stranger.sent, []);

  // The owner on another chain: the explanation and a Switch to LiteForge button.
  const elsewherePage = fakeDocument();
  const elsewhere = fakeEthereum({ account: OWNER_WALLET, chainIdHex: '0x1' });
  mountConfirmPage(elsewherePage.doc, { ethereum: elsewhere });
  await elsewherePage.buttons()[0].click();
  assert.equal(elsewherePage.byId.get('owner-status').dataset.phase, 'wrong-chain');
  assert.deepEqual(elsewherePage.buttons().map((node) => node.textContent), ['Switch to LiteForge']);

  // The owner on LiteForge: the page's own default reader (vendored ethers, the public LiteForge RPC)
  // checks the committed module's registry address. A fetch fixture stands in for the RPC and reports
  // no code there, so the gate refuses before any transaction; a wallet event re-checks the page.
  const original = globalThis.fetch;
  const rpcRequests = [];
  globalThis.fetch = async (url, init = {}) => {
    const payload = JSON.parse(new TextDecoder().decode(init.body));
    const reply = (request) => {
      rpcRequests.push({ url: String(url), method: request.method, params: request.params });
      const result = request.method === 'eth_chainId' ? '0x1159' : request.method === 'eth_getCode' ? '0x' : null;
      return { jsonrpc: '2.0', id: request.id, result };
    };
    return new Response(JSON.stringify(Array.isArray(payload) ? payload.map(reply) : reply(payload)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const ownerPage = fakeDocument();
    const ownerWallet = fakeEthereum({ account: OWNER_WALLET });
    const controller = mountConfirmPage(ownerPage.doc, { ethereum: ownerWallet });
    await ownerPage.buttons()[0].click();
    const status = ownerPage.byId.get('owner-status');
    assert.equal(status.dataset.phase, 'not-deployed', status.textContent);
    assert.match(status.textContent, /not deployed yet: LiteForge has no contract code at the GameRegistry address/);
    assert.deepEqual(ownerPage.buttons().map((node) => node.textContent), ['Connect again']);
    const getCode = rpcRequests.find((request) => request.method === 'eth_getCode');
    assert.ok(getCode, 'the gate read the registry code');
    assert.equal(getCode.params[0].toLowerCase(), LITVM_DEPLOYMENT.addresses.gameRegistry, 'at the committed module address');
    assert.ok(rpcRequests.every((request) => request.url === LITEFORGE_CHAIN.rpcUrl), 'over the public LiteForge RPC only');
    assert.equal(ownerPage.byId.get('owner-account').textContent, `${OWNER_WALLET.slice(0, 6)}…${OWNER_WALLET.slice(-4)}`);
    assert.deepEqual(ownerWallet.sent, []);
    const requests = ownerWallet.calls.filter((method) => method === 'eth_requestAccounts').length;
    ownerWallet.emit('chainChanged', '0x1159');
    await controller.connect();
    assert.equal(ownerWallet.calls.filter((method) => method === 'eth_requestAccounts').length, requests + 1, 'a wallet event re-checks the page once');
  } finally {
    globalThis.fetch = original;
  }
});

test('the page prices each confirmation from the latest block, not the wallet guess', () => {
  // 2026-09-24: a wallet offered 0.13 gwei while the base fee was about 1.47 gwei, and later the base fee
  // rose from 0.07 to 0.26 gwei while the wallet popup was open. The cap is 10x the base fee, at least 5 gwei.
  assert.deepEqual(liteForgeFeeFields(1_469_367_000n), { maxFeePerGas: `0x${(14_693_670_000n).toString(16)}`, maxPriorityFeePerGas: '0x0' });
  assert.equal(liteForgeFeeFields(71_618_333n).maxFeePerGas, `0x${(5_000_000_000n).toString(16)}`, 'a 0.07 gwei read still offers 5 gwei');
  assert.equal(liteForgeFeeFields('0x5f5e100').maxFeePerGas, `0x${(5_000_000_000n).toString(16)}`);
  assert.equal(liteForgeFeeFields(null).maxFeePerGas, `0x${(5_000_000_000n).toString(16)}`);
});
