// Owner page apps/portal/owner/confirm-dev-wallet.{html,mjs} (runbook step 4, contract §13): pure
// call encoding, CSP and noindex rules, and the full flow with a fake window.ethereum backed by the
// in-process chain, served from a local static server like the deploy session serves it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
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
} from '../apps/portal/owner/confirm-dev-wallet.mjs';
import { activateLocalGames, deployLocalSuite, loadArtifact, localContracts, localDeployConfig, startLocalChain } from '../scripts/lib/local-chain.mjs';
import { normalizeDeploymentInput, predictedDeploymentInput, writeLitvmAddressModule } from '../scripts/generate-litvm-addresses.mjs';

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
function fakeEthereum({ account, chainIdHex = '0x1159', knownChains = ['0x1', '0x1159'] }) {
  const calls = [];
  let current = chainIdHex;
  const known = new Set(knownChains);
  return {
    calls,
    async request({ method, params = [] }) {
      calls.push(method);
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
