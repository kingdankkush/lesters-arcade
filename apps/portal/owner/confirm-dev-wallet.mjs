// Owner page: confirm the developer wallet of each Ranked game (runbook step 4, contract §13).
//
// GameRegistry.confirmDevWallet(gameId32) must come from the developer wallet itself, so nobody can
// redirect a game's fees. This page is the owner's one-off tool for it. It uses plain window.ethereum
// for the wallet (MetaMask or Rabby), and the same-origin vendored ethers only for public reads.
//
// Flow: eth_requestAccounts -> explain, then switch or add chain 4441 -> refuse any account but the
// owner wallet -> gate on on-chain facts over the public RPC (code at the GameRegistry address and
// getGame(id).exists for every game), never on the module status alone -> skip games already
// confirmed -> one confirmDevWallet transaction per click, with its explorer link -> a summary that
// hands over to the operator (runbook step 5).
//
// Hosting (runbook step 4): production still serves 1.7.0 at that step, so the deploy session serves
// the step-3 commit locally: `python -m http.server 8791 --directory apps/portal`, then the owner opens
// http://127.0.0.1:8791/owner/confirm-dev-wallet.html. CSP-safe: module script, same origin only, no
// inline script, DOM built with createElement and textContent.
import { LITVM_DEPLOYMENT } from '../src/generated/litvm-addresses.mjs';

export const OWNER_WALLET = '0x07cec6fc49caf6528f2f2f796042629cd3f48b26';
export const CONFIRM_DEV_WALLET_SELECTOR = '0x33cf3157'; // confirmDevWallet(bytes32)
export const LITEFORGE_CHAIN = Object.freeze({
  chainId: 4441,
  chainIdHex: '0x1159',
  chainName: 'LitVM LiteForge',
  nativeCurrency: Object.freeze({ name: 'zkLTC', symbol: 'zkLTC', decimals: 18 }),
  rpcUrl: 'https://liteforge.rpc.caldera.xyz/http',
  explorerUrl: 'https://liteforge.explorer.caldera.xyz',
});
// Contract §2.1: gameId32 = ethers.id(gameId).
export const RANKED_GAMES = Object.freeze([
  Object.freeze({ gameId: 'lester-blaster', title: 'Hard Money Heroes', gameId32: '0x545dd61662e9dc794369142dd2768078f04eb05c60daec6fe35ec6b9f854205e' }),
  Object.freeze({ gameId: 'chikun', title: "Chikun's Escape", gameId32: '0xe293f354d567ca05ed272162a4f9056216cf9f40e9fe59bbf8b6227c0ce4f385' }),
  Object.freeze({ gameId: 'stacked', title: 'STACKED', gameId32: '0xf59739dcdad762dcc1b5c107223be71d49deb6bb5c775307196190123630d7f5' }),
]);
export const OPERATOR_ACTIVATE_COMMAND = 'node scripts/operator-actions.mjs activate --key-file <vault path> --key-field operator --broadcast --confirm ACTIVATE_GAMES_4441';

const GAME_REGISTRY_READ_ABI = [
  'function getGame(bytes32) view returns ((bytes32 gameId,string title,address devWallet,uint16 devBps,uint16 platformBps,uint16 liquidityBps,uint16 treasuryBps,uint256 entryFeeWei,bool devWalletConfirmed,bool playable,bool exists,uint256 registeredAt))',
];
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export function shortAddress(address) {
  const value = String(address ?? '');
  return ADDRESS_RE.test(value) ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

export function explorerTxUrl(hash) {
  return TX_HASH_RE.test(String(hash ?? '')) ? `${LITEFORGE_CHAIN.explorerUrl}/tx/${hash}` : null;
}

// Pure: the three confirmDevWallet calls for a deployment module ({ gameId, gameId32, to, data }).
export function buildConfirmCalls(deployment) {
  const to = deployment?.addresses?.gameRegistry;
  if (typeof to !== 'string' || !ADDRESS_RE.test(to)) throw new Error('The address module has no valid GameRegistry address.');
  return RANKED_GAMES.map(({ gameId, gameId32 }) => ({
    gameId,
    gameId32,
    to: to.toLowerCase(),
    data: `${CONFIRM_DEV_WALLET_SELECTOR}${gameId32.slice(2)}`,
  }));
}

export function addChainParams() {
  return {
    chainId: LITEFORGE_CHAIN.chainIdHex,
    chainName: LITEFORGE_CHAIN.chainName,
    nativeCurrency: { ...LITEFORGE_CHAIN.nativeCurrency },
    rpcUrls: [LITEFORGE_CHAIN.rpcUrl],
    blockExplorerUrls: [LITEFORGE_CHAIN.explorerUrl],
  };
}

function walletErrorMessage(error) {
  const code = error?.code ?? error?.info?.error?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') return 'You rejected the request in your wallet. Nothing was sent.';
  if (code === -32002) return 'Your wallet already has a request open. Finish or close it in the wallet, then try again.';
  return `The wallet reported an error: ${String(error?.message ?? error).slice(0, 160)}`;
}

// On-chain gate over the public RPC (readProvider): code at the registry address, and every game
// registered with the owner as its developer wallet. Returns per-game facts when it passes.
export async function readOnChainGate({ ethers, readProvider, deployment, ownerWallet = OWNER_WALLET }) {
  const registryAddress = deployment?.addresses?.gameRegistry;
  if (!registryAddress || !ADDRESS_RE.test(registryAddress)) {
    return { ok: false, reason: 'no-address', message: 'The address module has no GameRegistry address, so there is nothing to confirm.' };
  }
  const code = await readProvider.getCode(registryAddress);
  if (!code || code === '0x') {
    return {
      ok: false,
      reason: 'not-deployed',
      message: `The Ranked contracts are not deployed yet: LiteForge has no contract code at the GameRegistry address ${registryAddress} (address module status: ${deployment.status}). Nothing was sent.`,
    };
  }
  const registry = new ethers.Contract(registryAddress, GAME_REGISTRY_READ_ABI, readProvider);
  const games = [];
  for (const game of RANKED_GAMES) {
    // eslint-disable-next-line no-await-in-loop
    const onChain = await registry.getGame(game.gameId32);
    if (!onChain.exists) {
      return { ok: false, reason: 'not-registered', message: `${game.title} is not registered in the GameRegistry at ${registryAddress}. The deploy did not finish; nothing was sent.` };
    }
    if (String(onChain.devWallet).toLowerCase() !== ownerWallet) {
      return { ok: false, reason: 'dev-wallet-mismatch', message: `${game.title} is registered with developer wallet ${onChain.devWallet}, not the owner wallet. Only that wallet can confirm it; nothing was sent.` };
    }
    games.push({ ...game, devWalletConfirmed: Boolean(onChain.devWalletConfirmed), playable: Boolean(onChain.playable), txHash: null });
  }
  return { ok: true, reason: null, message: null, games };
}

async function loadVendorEthers() {
  return import('../vendor/ethers.min.js');
}

// DOM-free controller. `onChange(state)` runs after every state change.
export function createConfirmController({
  ethereum = null,
  deployment = LITVM_DEPLOYMENT,
  loadEthers = loadVendorEthers,
  createReadProvider = (ethers) => new ethers.JsonRpcProvider(LITEFORGE_CHAIN.rpcUrl, LITEFORGE_CHAIN.chainId, { staticNetwork: true, cacheTimeout: -1 }),
  ownerWallet = OWNER_WALLET,
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  receiptPollMs = 1500,
  receiptTimeoutMs = 5 * 60_000,
  onChange = () => {},
} = {}) {
  const owner = String(ownerWallet).toLowerCase();
  const calls = buildConfirmCalls(deployment);
  const state = {
    phase: ethereum?.request ? 'idle' : 'no-wallet',
    message: ethereum?.request ? null : 'No browser wallet found. Install MetaMask or Rabby, then reload this page.',
    account: null,
    chainId: null,
    games: RANKED_GAMES.map((game) => ({ ...game, devWalletConfirmed: null, playable: null, txHash: null })),
    lastTx: null,
    deploymentStatus: deployment.status,
    registry: calls[0].to,
  };
  let ethersPromise = null;
  let readProvider = null;
  const confirmedByReceipt = new Set();
  const emit = () => onChange(state);
  const set = (patch) => {
    Object.assign(state, patch);
    emit();
  };
  const ethersLib = () => {
    ethersPromise ??= Promise.resolve(loadEthers());
    return ethersPromise;
  };
  const reader = async () => {
    readProvider ??= createReadProvider(await ethersLib());
    return readProvider;
  };
  const request = (method, params = []) => ethereum.request({ method, params });

  async function currentChainId() {
    return String(await request('eth_chainId')).toLowerCase();
  }

  async function checkChainAndAccount() {
    const chainId = await currentChainId();
    state.chainId = chainId;
    if (chainId !== LITEFORGE_CHAIN.chainIdHex) {
      set({
        phase: 'wrong-chain',
        message: `This page sends transactions on ${LITEFORGE_CHAIN.chainName} (chain ${LITEFORGE_CHAIN.chainId}). Your wallet is on chain ${Number.parseInt(chainId, 16) || chainId}. Press "Switch to LiteForge": your wallet asks to switch, or to add the network first (RPC ${LITEFORGE_CHAIN.rpcUrl}, explorer ${LITEFORGE_CHAIN.explorerUrl}).`,
      });
      return false;
    }
    const accounts = await request('eth_accounts');
    const account = String(accounts?.[0] ?? '').toLowerCase();
    state.account = account || null;
    if (account !== owner) {
      set({
        phase: 'wrong-account',
        message: `This page only works for the owner wallet ${ownerWallet}. The connected account is ${account || 'none'}. Switch to the owner account in your wallet, then press Connect again.`,
      });
      return false;
    }
    return true;
  }

  async function refreshGates() {
    set({ phase: 'checking', message: 'Reading the GameRegistry on LiteForge…' });
    let gate;
    try {
      const ethers = await ethersLib();
      gate = await readOnChainGate({ ethers, readProvider: await reader(), deployment, ownerWallet: owner });
    } catch (error) {
      set({ phase: 'error', message: `Could not read LiteForge over its public RPC (${String(error?.shortMessage ?? error?.message ?? error).slice(0, 120)}). Nothing was sent; try again.` });
      return false;
    }
    if (!gate.ok) {
      set({ phase: gate.reason, message: gate.message });
      return false;
    }
    const txHashes = new Map(state.games.map((game) => [game.gameId, game.txHash]));
    // A successful receipt is proof even if a load-balanced RPC node still serves the older state.
    state.games = gate.games.map((game) => ({ ...game, devWalletConfirmed: game.devWalletConfirmed || confirmedByReceipt.has(game.gameId), txHash: txHashes.get(game.gameId) ?? null }));
    const pending = state.games.filter((game) => !game.devWalletConfirmed);
    if (pending.length === 0) {
      set({ phase: 'done', message: summaryMessage() });
    } else {
      set({ phase: 'ready', message: `${pending.length} of ${state.games.length} games still need your confirmation. Each click sends one transaction for the next game.` });
    }
    return true;
  }

  function summaryMessage() {
    return `All ${state.games.length} games have a confirmed developer wallet. The operator now activates them (runbook step 5): ${OPERATOR_ACTIVATE_COMMAND}`;
  }

  // One flow at a time. While a transaction is in flight (`sending`), a connect (a wallet
  // accountsChanged/chainChanged event, say) must not re-render 'ready' and offer a second
  // transaction for the same game: it is deferred until the send finishes.
  let sending = false;
  let recheckAfterSend = false;
  let connecting = null;

  async function connectOnce() {
    try {
      set({ phase: 'connecting', message: 'Waiting for your wallet to share the account…' });
      await request('eth_requestAccounts');
      if (!(await checkChainAndAccount())) return state;
      await refreshGates();
    } catch (error) {
      set({ phase: 'error', message: walletErrorMessage(error) });
    }
    return state;
  }

  async function connect() {
    if (!ethereum?.request) return state;
    if (sending) {
      recheckAfterSend = true;
      return state;
    }
    connecting ??= connectOnce().finally(() => { connecting = null; });
    return connecting;
  }

  async function switchChain() {
    if (!ethereum?.request) return state;
    try {
      try {
        await request('wallet_switchEthereumChain', [{ chainId: LITEFORGE_CHAIN.chainIdHex }]);
      } catch (error) {
        const code = error?.code ?? error?.data?.originalError?.code;
        if (code !== 4902) throw error;
        // Unknown chain: add it, then switch (not every wallet switches on add).
        await request('wallet_addEthereumChain', [addChainParams()]);
        await request('wallet_switchEthereumChain', [{ chainId: LITEFORGE_CHAIN.chainIdHex }]);
      }
      return await connect();
    } catch (error) {
      set({ phase: 'error', message: walletErrorMessage(error) });
      return state;
    }
  }

  async function waitForReceipt(hash) {
    const provider = await reader();
    const deadline = Date.now() + receiptTimeoutMs;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const receipt = await provider.getTransactionReceipt(hash).catch(() => null);
      if (receipt) return receipt;
      if (Date.now() > deadline) return null;
      // eslint-disable-next-line no-await-in-loop
      await sleep(receiptPollMs);
    }
  }

  // One confirmDevWallet transaction for the next unconfirmed game. Re-checks chain and account first.
  // Re-entrancy: `sending` and the 'sending' phase are set before the first await, so a double click
  // (or a click during a wallet-event re-render) never sends a second transaction.
  async function confirmNext() {
    if (sending || state.phase !== 'ready') return state;
    const game = state.games.find((entry) => !entry.devWalletConfirmed);
    if (!game) return state;
    sending = true;
    set({ phase: 'sending', message: 'Checking the wallet chain and account…' });
    try {
      if (!(await checkChainAndAccount())) return state;
      const call = calls.find((entry) => entry.gameId === game.gameId);
      set({ message: `Confirm "${game.title}" in your wallet (confirmDevWallet, no zkLTC is transferred beyond gas).` });
      // chainId lets the wallet refuse the request if it switched chains after the check above.
      const hash = await request('eth_sendTransaction', [{ from: state.account, to: call.to, data: call.data, chainId: LITEFORGE_CHAIN.chainIdHex }]);
      game.txHash = hash;
      set({ lastTx: { gameId: game.gameId, hash, url: explorerTxUrl(hash) }, message: `Sent ${game.title}: ${hash}. Waiting for LiteForge to include it…` });
      const receipt = await waitForReceipt(hash);
      if (!receipt) {
        set({ phase: 'error', message: `No receipt for ${hash} yet. Check it on the explorer, then reload this page: confirmed games are skipped.` });
        return state;
      }
      if (Number(receipt.status) !== 1) {
        set({ phase: 'error', message: `The ${game.title} transaction reverted (${hash}). Nothing changed on chain; reload and try again.` });
        return state;
      }
      confirmedByReceipt.add(game.gameId);
      await refreshGates();
    } catch (error) {
      set({ phase: 'error', message: walletErrorMessage(error) });
    } finally {
      sending = false;
      // A wallet event arrived mid-send: re-check the account and chain now that the send is over.
      if (recheckAfterSend) {
        recheckAfterSend = false;
        await connect();
      }
    }
    return state;
  }

  return { state, connect, switchChain, confirmNext, refresh: refreshGates };
}

// ---------------------------------------------------------------------------------------------
// DOM (browser only).

function el(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'text') node.textContent = value;
    else if (name === 'className') node.className = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function render(doc, state, controller) {
  const root = doc.getElementById('owner-confirm');
  if (!root) return;
  const status = doc.getElementById('owner-status');
  status.textContent = state.message ?? '';
  status.dataset.phase = state.phase;
  doc.getElementById('owner-account').textContent = state.account ? shortAddress(state.account) : 'not connected';

  const list = doc.getElementById('owner-games');
  list.replaceChildren(...state.games.map((game) => {
    const label = game.devWalletConfirmed === null ? 'not checked yet' : game.devWalletConfirmed ? 'confirmed' : 'needs confirmation';
    const url = explorerTxUrl(game.txHash);
    return el(doc, 'li', { className: game.devWalletConfirmed ? 'done' : '' }, [
      el(doc, 'strong', { text: game.title }),
      el(doc, 'span', { className: 'game-state', text: ` · ${label}` }),
      url ? el(doc, 'a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: ` · view transaction ${shortAddress(game.txHash)}` }) : null,
    ]);
  }));

  const actions = doc.getElementById('owner-actions');
  const button = (text, onClick, disabled = false) => {
    const node = el(doc, 'button', { type: 'button', text });
    node.disabled = disabled;
    node.addEventListener('click', onClick);
    return node;
  };
  const buttons = [];
  if (state.phase === 'idle' || state.phase === 'wrong-account' || state.phase === 'error' || state.phase === 'not-deployed' || state.phase === 'not-registered' || state.phase === 'dev-wallet-mismatch') {
    buttons.push(button(state.phase === 'idle' ? 'Connect owner wallet' : 'Connect again', () => controller.connect()));
  }
  if (state.phase === 'wrong-chain') buttons.push(button('Switch to LiteForge', () => controller.switchChain()));
  if (state.phase === 'ready') {
    const next = state.games.find((game) => !game.devWalletConfirmed);
    buttons.push(button(`Confirm ${next.title}`, () => controller.confirmNext()));
  }
  if (state.phase === 'sending' || state.phase === 'connecting' || state.phase === 'checking') buttons.push(button('Working…', () => {}, true));
  actions.replaceChildren(...buttons);

  const tx = doc.getElementById('owner-last-tx');
  const lastUrl = explorerTxUrl(state.lastTx?.hash);
  tx.replaceChildren(...(lastUrl ? [el(doc, 'span', { text: 'Last transaction: ' }), el(doc, 'a', { href: lastUrl, target: '_blank', rel: 'noopener noreferrer', text: state.lastTx.hash })] : []));
}

export function mountConfirmPage(doc, win) {
  doc.getElementById('owner-registry').textContent = `${LITVM_DEPLOYMENT.addresses.gameRegistry} (address module: ${LITVM_DEPLOYMENT.status})`;
  doc.getElementById('owner-wallet').textContent = OWNER_WALLET;
  let controller = null;
  controller = createConfirmController({
    ethereum: win.ethereum ?? null,
    onChange: (state) => render(doc, state, controller),
  });
  render(doc, controller.state, controller);
  if (win.ethereum?.on) {
    const reset = () => {
      if (controller.state.phase !== 'no-wallet' && controller.state.phase !== 'idle') controller.connect();
    };
    win.ethereum.on('accountsChanged', reset);
    win.ethereum.on('chainChanged', reset);
  }
  return controller;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById('owner-confirm')) {
  mountConfirmPage(document, window);
}
