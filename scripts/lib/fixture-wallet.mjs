// Fixture EIP-1193 wallet for Playwright (browser-e2e slice; contract §11 rules 8 and 13, guide §5.15).
//
// installFixtureWallet(page, { rpcUrl, privateKey, chainId: 4441, announce: true }) gives a Playwright
// page (or browser context) a browser wallet that behaves like MetaMask or Rabby for the portal:
//   - an EIP-1193 provider is injected into the top frame with page.addInitScript, and announced over
//     EIP-6963 (rdns 'io.lestersarcade.fixture'), answering every later eip6963:requestProvider too;
//     `legacy: true` also puts it at window.ethereum;
//   - every request crosses to Node through page.exposeFunction, where an ethers Wallet answers:
//       eth_accounts / eth_requestAccounts   the fixture account (eth_accounts is [] until connected)
//       eth_chainId / net_version            the wallet's chain (4441)
//       personal_sign                        signs the message (hex data as bytes, text as UTF-8)
//       eth_sendTransaction                  populates, signs and sends the RAW transaction to rpcUrl
//       wallet_switchEthereumChain / wallet_addEthereumChain   accepted for the wallet's own chain only
//     and the read methods in READ_METHODS are proxied to rpcUrl unchanged;
//   - anything else (other signing methods, chain cheats such as evm_* or hardhat_*, unknown wallet_*
//     calls) is refused with 4200, exactly as a wallet refuses a method it does not support.
//
// The private key never enters the page: the init script receives only the wallet's public info, and
// the key lives in a closure of the Node-side router. Nothing here prints or logs a key, and the
// request log records method names and transaction hashes only.
import { randomUUID } from 'node:crypto';
import { ethers } from 'ethers';

export const FIXTURE_WALLET_RDNS = 'io.lestersarcade.fixture';
export const FIXTURE_WALLET_NAME = 'Lester Fixture Wallet';
export const FIXTURE_WALLET_BINDING = '__lestersFixtureWallet';
export const DEFAULT_FIXTURE_CHAIN_ID = 4441;
// A tiny inline SVG, so the announcement needs no network (EIP-6963 requires a data URI icon).
export const FIXTURE_WALLET_ICON = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Crect width=%2216%22 height=%2216%22 fill=%22%23f5b83d%22/%3E%3C/svg%3E';

// Reads the fixture forwards to rpcUrl as they are. Everything else that is not handled below is
// refused, so the page can never reach a signing or cheat method of the node behind rpcUrl.
export const READ_METHODS = Object.freeze([
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
  'eth_syncing',
  'web3_clientVersion',
]);
export const WALLET_METHODS = Object.freeze(['eth_accounts', 'eth_requestAccounts', 'eth_chainId', 'net_version', 'personal_sign', 'eth_sendTransaction', 'wallet_switchEthereumChain', 'wallet_addEthereumChain']);

// EIP-1193 / EIP-1474 error codes.
export const FIXTURE_ERRORS = Object.freeze({
  userRejected: 4001,
  unauthorized: 4100,
  unsupportedMethod: 4200,
  unrecognizedChain: 4902,
  invalidParams: -32602,
  internal: -32603,
});

export class FixtureWalletError extends Error {
  constructor(code, message, data = undefined) {
    super(message);
    this.name = 'FixtureWalletError';
    this.code = code;
    if (data !== undefined) this.data = data;
  }
}

const HEX_DATA = /^0x([0-9a-fA-F]{2})*$/;
const TX_FIELDS = new Set(['from', 'to', 'value', 'data', 'input', 'gas', 'gasLimit', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'nonce', 'type', 'chainId', 'accessList']);

function chainHex(chainId) {
  return `0x${Number(chainId).toString(16)}`;
}

function sameAddress(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

function quantity(value, field) {
  if (value === undefined || value === null) return undefined;
  try {
    return BigInt(value);
  } catch {
    throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, `${field} is not a quantity`);
  }
}

// An ethers read/write provider for a JSON-RPC URL (the local proxy or LiteForge).
export function fixtureRpcProvider(rpcUrl, chainId = DEFAULT_FIXTURE_CHAIN_ID) {
  return new ethers.JsonRpcProvider(rpcUrl, Number(chainId), { staticNetwork: true, cacheTimeout: -1, pollingInterval: 250 });
}

// A raw JSON-RPC call over HTTP. The node's own error object ({ code, message, data }) is passed on
// unchanged, as a wallet passes on a revert from its RPC.
export async function jsonRpcCall(rpcUrl, method, params = [], { fetchImpl = globalThis.fetch, timeoutMs = 30_000 } = {}) {
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new FixtureWalletError(FIXTURE_ERRORS.internal, `the RPC answered HTTP ${response.status}`);
  const reply = await response.json();
  if (reply?.error) throw new FixtureWalletError(Number.isInteger(reply.error.code) ? reply.error.code : FIXTURE_ERRORS.internal, String(reply.error.message ?? 'RPC error').slice(0, 300), reply.error.data);
  return reply?.result ?? null;
}

// The Node-side request router, usable without a browser.
//   privateKey      the fixture key (kept in this closure; never returned, logged or sent to the page)
//   rpcUrl          JSON-RPC endpoint for reads and for the raw transactions
//   provider        (tests) an ethers provider used instead of rpcUrl
//   chainId         the only chain this wallet knows (default 4441)
//   connected       start already connected (eth_accounts answers without eth_requestAccounts)
//   rejectMethods   methods to refuse with 4001, as if the player pressed Reject in the wallet
// → { address, chainId, request({ method, params }), handleJson(json) → json, log, transactions, close() }
export function createFixtureWalletRouter({ privateKey, rpcUrl = null, provider = null, chainId = DEFAULT_FIXTURE_CHAIN_ID, connected = false, rejectMethods = [], fetchImpl = globalThis.fetch } = {}) {
  if (typeof privateKey !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new TypeError('createFixtureWalletRouter needs a 0x-prefixed 32-byte private key');
  if (!provider && !rpcUrl) throw new TypeError('createFixtureWalletRouter needs an rpcUrl or a provider');
  const ownsProvider = !provider;
  const ethersProvider = provider ?? fixtureRpcProvider(rpcUrl, chainId);
  // Reads, the chain check and the raw send go through rpcCall, so node errors reach the page as is.
  const rpcCall = rpcUrl
    ? (method, params) => jsonRpcCall(rpcUrl, method, params, { fetchImpl })
    : (method, params) => ethersProvider.send(method, params);
  const signer = new ethers.Wallet(privateKey, ethersProvider);
  const address = signer.address.toLowerCase();
  const refused = new Set(rejectMethods);
  const log = [];
  const transactions = [];
  let isConnected = Boolean(connected);
  let sendQueue = Promise.resolve();
  let rpcChainChecked = false;

  const requireAccount = (claimed, field) => {
    if (claimed !== undefined && claimed !== null && !sameAddress(String(claimed), address)) {
      throw new FixtureWalletError(FIXTURE_ERRORS.unauthorized, `${field} is not the fixture account`);
    }
  };

  // The node behind rpcUrl must be on the wallet's chain before anything signed goes to it.
  const assertRpcChain = async () => {
    if (rpcChainChecked) return;
    const reported = Number(BigInt(await rpcCall('eth_chainId', [])));
    if (reported !== Number(chainId)) throw new FixtureWalletError(FIXTURE_ERRORS.internal, `the RPC reports chain ${reported}, expected ${chainId}`);
    rpcChainChecked = true;
  };

  const personalSign = async (params) => {
    const [data, account] = Array.isArray(params) ? params : [];
    if (typeof data !== 'string') throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, 'personal_sign needs a message');
    requireAccount(account, 'personal_sign account');
    // MetaMask reads 0x-hex data as bytes and anything else as UTF-8 text.
    return signer.signMessage(HEX_DATA.test(data) && data.length > 2 ? ethers.getBytes(data) : data);
  };

  const sendTransaction = async (params) => {
    const tx = Array.isArray(params) ? params[0] : null;
    if (!tx || typeof tx !== 'object') throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, 'eth_sendTransaction needs a transaction object');
    for (const key of Object.keys(tx)) {
      if (!TX_FIELDS.has(key)) throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, `eth_sendTransaction does not take ${key}`);
    }
    requireAccount(tx.from, 'transaction from');
    if (tx.chainId !== undefined && Number(BigInt(tx.chainId)) !== Number(chainId)) throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, `transaction chainId ${tx.chainId} is not ${chainId}`);
    const request = {
      to: tx.to ?? null,
      value: quantity(tx.value, 'value') ?? 0n,
      data: tx.data ?? tx.input ?? '0x',
      chainId: BigInt(chainId),
    };
    const gasLimit = quantity(tx.gas ?? tx.gasLimit, 'gas');
    if (gasLimit !== undefined) request.gasLimit = gasLimit;
    for (const field of ['gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas']) {
      const value = quantity(tx[field], field);
      if (value !== undefined) request[field] = value;
    }
    const nonce = quantity(tx.nonce, 'nonce');
    if (nonce !== undefined) request.nonce = Number(nonce);
    if (tx.type !== undefined) request.type = Number(BigInt(tx.type));
    if (tx.accessList !== undefined) request.accessList = tx.accessList;
    // One transaction at a time, so two sends never race for the same nonce.
    const run = sendQueue.then(async () => {
      await assertRpcChain();
      const populated = await signer.populateTransaction(request);
      const raw = await signer.signTransaction(populated);
      const hash = String(await rpcCall('eth_sendRawTransaction', [raw])).toLowerCase();
      const expected = ethers.keccak256(raw).toLowerCase();
      if (hash !== expected) throw new FixtureWalletError(FIXTURE_ERRORS.internal, 'the RPC answered another transaction hash');
      transactions.push(Object.freeze({ hash, to: populated.to ? String(populated.to).toLowerCase() : null, value: BigInt(populated.value ?? 0n).toString(), data: String(populated.data ?? '0x'), nonce: Number(populated.nonce) }));
      return hash;
    });
    sendQueue = run.catch(() => {});
    return run;
  };

  const switchChain = (params) => {
    const requested = Array.isArray(params) ? params[0]?.chainId : undefined;
    if (typeof requested !== 'string') throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, 'wallet_switchEthereumChain needs { chainId }');
    if (Number(BigInt(requested)) !== Number(chainId)) throw new FixtureWalletError(FIXTURE_ERRORS.unrecognizedChain, `Unrecognized chain ID ${requested}. The fixture wallet knows only ${chainHex(chainId)}.`);
    return null;
  };

  const addChain = (params) => {
    const requested = Array.isArray(params) ? params[0]?.chainId : undefined;
    if (typeof requested !== 'string') throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, 'wallet_addEthereumChain needs { chainId }');
    if (Number(BigInt(requested)) !== Number(chainId)) throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, `the fixture wallet only adds ${chainHex(chainId)}`);
    return null;
  };

  const dispatch = async (method, params) => {
    if (refused.has(method)) throw new FixtureWalletError(FIXTURE_ERRORS.userRejected, 'User rejected the request.');
    switch (method) {
      case 'eth_accounts':
        return isConnected ? [address] : [];
      case 'eth_requestAccounts':
        isConnected = true;
        return [address];
      case 'eth_chainId':
        return chainHex(chainId);
      case 'net_version':
        return String(chainId);
      case 'personal_sign':
        if (!isConnected) throw new FixtureWalletError(FIXTURE_ERRORS.unauthorized, 'personal_sign before eth_requestAccounts');
        return personalSign(params);
      case 'eth_sendTransaction':
        if (!isConnected) throw new FixtureWalletError(FIXTURE_ERRORS.unauthorized, 'eth_sendTransaction before eth_requestAccounts');
        return sendTransaction(params);
      case 'wallet_switchEthereumChain':
        return switchChain(params);
      case 'wallet_addEthereumChain':
        return addChain(params);
      default:
        if (READ_METHODS.includes(method)) return rpcCall(method, Array.isArray(params) ? params : []);
        throw new FixtureWalletError(FIXTURE_ERRORS.unsupportedMethod, `The fixture wallet does not support ${method}.`);
    }
  };

  const request = async ({ method, params = [] } = {}) => {
    if (typeof method !== 'string' || !method) throw new FixtureWalletError(FIXTURE_ERRORS.invalidParams, 'request needs a method');
    try {
      const result = await dispatch(method, params);
      log.push(Object.freeze({ method, ok: true }));
      return result;
    } catch (error) {
      const code = error instanceof FixtureWalletError ? error.code : (Number.isInteger(error?.code) ? error.code : FIXTURE_ERRORS.internal);
      log.push(Object.freeze({ method, ok: false, code }));
      if (error instanceof FixtureWalletError) throw error;
      // Node or RPC failures become an EIP-1193 internal error. The ethers short message names the
      // failing call, never the key (the signer holds it in a closure).
      throw new FixtureWalletError(code, String(error?.shortMessage ?? error?.message ?? 'fixture wallet error').slice(0, 300), error?.data);
    }
  };

  // The page-side binding: a JSON string in, a JSON string out. Errors travel as { error: { code,
  // message } } because an exception thrown through exposeFunction would lose its code.
  const handleJson = async (json) => {
    let payload;
    try {
      payload = JSON.parse(String(json));
    } catch {
      return JSON.stringify({ error: { code: FIXTURE_ERRORS.invalidParams, message: 'malformed request' } });
    }
    try {
      const result = await request({ method: payload?.method, params: payload?.params ?? [] });
      return JSON.stringify({ result: result === undefined ? null : result });
    } catch (error) {
      return JSON.stringify({ error: { code: error.code, message: error.message, ...(error.data !== undefined ? { data: error.data } : {}) } });
    }
  };

  return Object.freeze({
    address,
    chainId: Number(chainId),
    request,
    handleJson,
    get connected() { return isConnected; },
    log,
    transactions,
    // Counts of the methods the page asked for (for reports: signatures, prompts, sends).
    counts() {
      const out = {};
      for (const entry of log) out[entry.method] = (out[entry.method] ?? 0) + 1;
      return out;
    },
    close() {
      if (ownsProvider) ethersProvider.destroy();
    },
    toJSON() {
      return { address, chainId: Number(chainId), connected: isConnected };
    },
  });
}

// The page-side provider. Runs in the page (serialized by addInitScript), so it may use only its
// argument and browser globals. The argument carries public wallet info, never the key.
export function fixtureWalletPageScript({ binding, announce, legacy, info }) {
  if (globalThis.top !== globalThis) return; // the portal's frame only, never the game iframes
  const listeners = new Map();
  const provider = {
    isLestersFixture: true,
    isMetaMask: false,
    async request(args) {
      if (!args || typeof args !== 'object' || typeof args.method !== 'string') {
        const error = new Error('Invalid request: a method is required.');
        error.code = -32600;
        throw error;
      }
      const call = globalThis[binding];
      if (typeof call !== 'function') {
        const error = new Error('The fixture wallet is disconnected.');
        error.code = 4900;
        throw error;
      }
      const reply = JSON.parse(await call(JSON.stringify({ method: args.method, params: args.params ?? [] })));
      if (reply.error) {
        const error = new Error(reply.error.message);
        error.code = reply.error.code;
        if (reply.error.data !== undefined) error.data = reply.error.data;
        throw error;
      }
      return reply.result;
    },
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return provider;
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
      return provider;
    },
  };
  provider.off = provider.removeListener;
  provider.addListener = provider.on;
  if (announce) {
    const detail = Object.freeze({ info: Object.freeze({ ...info }), provider });
    const fire = () => globalThis.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
    globalThis.addEventListener('eip6963:requestProvider', fire);
    fire();
  }
  if (legacy) Object.defineProperty(globalThis, 'ethereum', { value: provider, configurable: true, enumerable: true, writable: false });
}

// Installs the fixture wallet on a Playwright Page or BrowserContext (both have addInitScript and
// exposeFunction). Call it before page.goto. Returns the router (address, log, transactions) and the
// announced info.
export async function installFixtureWallet(target, {
  rpcUrl,
  privateKey,
  chainId = DEFAULT_FIXTURE_CHAIN_ID,
  announce = true,
  legacy = false,
  name = FIXTURE_WALLET_NAME,
  rdns = FIXTURE_WALLET_RDNS,
  connected = false,
  rejectMethods = [],
  provider = null,
  binding = FIXTURE_WALLET_BINDING,
} = {}) {
  if (!target || typeof target.addInitScript !== 'function' || typeof target.exposeFunction !== 'function') throw new TypeError('installFixtureWallet needs a Playwright Page or BrowserContext');
  if (!announce && !legacy) throw new TypeError('installFixtureWallet needs announce (EIP-6963) or legacy (window.ethereum)');
  const router = createFixtureWalletRouter({ privateKey, rpcUrl, provider, chainId, connected, rejectMethods });
  const info = Object.freeze({ uuid: randomUUID(), name, icon: FIXTURE_WALLET_ICON, rdns });
  await target.exposeFunction(binding, (json) => router.handleJson(json));
  await target.addInitScript(fixtureWalletPageScript, { binding, announce: Boolean(announce), legacy: Boolean(legacy), info });
  return Object.freeze({ router, address: router.address, info, close: () => router.close() });
}
