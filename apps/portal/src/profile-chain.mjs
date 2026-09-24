// On-chain names and avatars through PlayerProfileRegistry (contract §7.8, §8.4,
// guide §5.7, D3). Loaded lazily by the profile page, only when the portal is
// hosted and the contracts are deployed.
//
// Every check runs before the wallet opens, so no setProfile transaction ever
// reverts: the contract's own handle rules (normalizeHandle mirrors
// PlayerProfileRegistry._normalizedHandle byte for byte), then moderation
// (name-moderation.mjs, which the server also runs, A29), then availability over
// the public RPC (handleOwners), then a fee estimate. ethers, the providers and
// the registry address are injected, so tests drive it with a local chain.

import { moderateName } from './name-moderation.mjs';
import { arcadeAvatarForUri } from './arcade-avatars.mjs';
import { liteForgeFeeOverrides } from './liteforge-fees.mjs';

export const HANDLE_MIN_BYTES = 3;
export const HANDLE_MAX_BYTES = 18;
export const LITEFORGE_CHAIN_ID = 4441;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Only the fragments this module calls; a test pins them against the artifact ABI.
export const PROFILE_CHAIN_ABI = Object.freeze([
  'function setProfile(string displayName, string avatarUri) external',
  'function handleOwners(bytes32) view returns (address)',
]);

export const PROFILE_CHANGE_MESSAGES = Object.freeze({
  'invalid-type': 'Type a name to claim.',
  'invalid-char': 'Use only letters, numbers, spaces and _ - . (no tabs, line breaks or accents).',
  'too-short': `Names need at least ${HANDLE_MIN_BYTES} characters.`,
  'too-long': `Names can be at most ${HANDLE_MAX_BYTES} characters.`,
  profanity: 'That name isn’t allowed here. Choose another.',
  impersonation: 'That name isn’t allowed here. Choose another.',
  'handle-taken': 'That name is taken. Choose another.',
  'invalid-avatar': 'Pick one of the arcade avatars.',
  'wrong-network': 'Switch your wallet to LiteForge (chain 4441), then try again.',
  'no-wallet': 'Connect your wallet first.',
  'chain-read-failed': 'Could not reach LiteForge to check that name. Try again in a moment.',
  'estimate-failed': 'Your wallet could not price this change. Check your zkLTC balance and try again.',
  rejected: 'The wallet request was cancelled. Nothing changed.',
  'tx-failed': 'The name change did not go through. Nothing was charged beyond network gas.',
  'send-failed': 'Your wallet could not send the change. Try again.',
});

const messageFor = (code) => PROFILE_CHANGE_MESSAGES[code] ?? 'Something went wrong. Try again.';

function failure(step, error, extra = {}) {
  return { ok: false, step, error, message: messageFor(error), ...extra };
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

function ascii(bytes) {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

// A port of PlayerProfileRegistry._normalizedHandle over the UTF-8 bytes:
//   1. strip leading and trailing 0x20 only (tabs and newlines are not trimmed);
//   2. lowercase A-Z;
//   3. allow only [a-z0-9 _.-] (anything else, including every non-ASCII byte, is invalid);
//   4. collapse runs of spaces;
//   5. require 3 to 18 bytes.
// `cleaned` is what the editor sends (trimmed, single spaces, original case) and
// `normalized` is what the contract hashes; handleHash = keccak256(normalized)
// when ethers is given.
export function normalizeHandle(raw, { ethers = null } = {}) {
  const empty = { ok: false, cleaned: '', normalized: '', handleHash: null };
  if (typeof raw !== 'string') return { ...empty, error: 'invalid-type' };
  const bytes = utf8(raw);
  let start = 0;
  while (start < bytes.length && bytes[start] === 0x20) start += 1;
  let end = bytes.length;
  while (end > start && bytes[end - 1] === 0x20) end -= 1;
  const cleaned = [];
  const normalized = [];
  let lastWasSpace = false;
  for (let index = start; index < end; index += 1) {
    const original = bytes[index];
    const ch = original >= 0x41 && original <= 0x5a ? original + 32 : original;
    const valid = (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39)
      || ch === 0x20 || ch === 0x5f || ch === 0x2d || ch === 0x2e;
    if (!valid) return { ...empty, error: 'invalid-char' };
    if (ch === 0x20) {
      if (lastWasSpace) continue;
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    cleaned.push(original);
    normalized.push(ch);
  }
  const result = { cleaned: ascii(cleaned), normalized: ascii(normalized) };
  if (normalized.length < HANDLE_MIN_BYTES) return { ...empty, ...result, error: 'too-short' };
  if (normalized.length > HANDLE_MAX_BYTES) return { ...empty, ...result, error: 'too-long' };
  return { ok: true, ...result, handleHash: ethers ? ethers.id(result.normalized) : null, error: null };
}

// A JSON-RPC provider on the public LiteForge RPC, never the wallet's (reads
// must not prompt or depend on the wallet's network).
export function publicReadProvider(ethers, rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl, LITEFORGE_CHAIN_ID, { staticNetwork: true });
}

// handleOwners(handleHash) over the public RPC: the owning wallet (lowercase)
// or null when the handle is free.
export async function handleOwner(handleHash, { readProvider, ethers, registryAddress } = {}) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(handleHash ?? ''))) throw new TypeError('handleHash must be bytes32');
  const registry = new ethers.Contract(registryAddress, PROFILE_CHAIN_ABI, readProvider);
  const owner = String(await registry.handleOwners(handleHash)).toLowerCase();
  return owner === ZERO_ADDRESS ? null : owner;
}

async function walletChain(browserProvider) {
  const network = await browserProvider.getNetwork();
  if (Number(network.chainId) !== LITEFORGE_CHAIN_ID) throw Object.assign(new Error('wrong network'), { code: 'wrong-network' });
}

function isRejection(error) {
  return error?.code === 'ACTION_REJECTED' || error?.code === 4001 || error?.info?.error?.code === 4001;
}

// Gas for setProfile from the player's wallet, priced at the current fee, before
// the wallet opens. Uses only eth_* reads: no account prompt, no signature.
export async function estimateSetProfile(walletProvider, { displayName, avatarUri = '', from, ethers, registryAddress } = {}) {
  if (!walletProvider?.request) throw Object.assign(new Error('no wallet'), { code: 'no-wallet' });
  const browserProvider = new ethers.BrowserProvider(walletProvider);
  await walletChain(browserProvider);
  const iface = new ethers.Interface(PROFILE_CHAIN_ABI);
  const data = iface.encodeFunctionData('setProfile', [displayName, avatarUri]);
  const [gasLimit, feeData] = await Promise.all([
    browserProvider.estimateGas({ from, to: registryAddress, data }),
    browserProvider.getFeeData(),
  ]);
  const price = BigInt(feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n);
  const gasWei = BigInt(gasLimit) * price;
  return { gasLimit: BigInt(gasLimit), gasWei, gasZkLtc: ethers.formatEther(gasWei) };
}

// setProfile from the player's wallet. Resolves right after broadcast with the
// hash and a wait() that settles to { status:'confirmed'|'failed', blockNumber }.
export async function sendSetProfile(walletProvider, { displayName, avatarUri = '', from, ethers, registryAddress } = {}) {
  if (!walletProvider?.request) throw Object.assign(new Error('no wallet'), { code: 'no-wallet' });
  const browserProvider = new ethers.BrowserProvider(walletProvider);
  await walletChain(browserProvider);
  const signer = await browserProvider.getSigner(from);
  const registry = new ethers.Contract(registryAddress, PROFILE_CHAIN_ABI, signer);
  // Priced from the latest block, never the wallet's own fee guess (liteforge-fees.mjs).
  const tx = await registry.setProfile(displayName, avatarUri, await liteForgeFeeOverrides(browserProvider));
  return {
    txHash: tx.hash,
    async wait() {
      try {
        const receipt = await tx.wait();
        return { status: receipt?.status === 1 ? 'confirmed' : 'failed', blockNumber: receipt?.blockNumber ?? null };
      } catch {
        return { status: 'failed', blockNumber: null };
      }
    },
  };
}

// Steps 1-4 of the name change (brief acceptance 4): validate, moderate, check
// availability, price it. Nothing here opens the wallet.
export async function prepareProfileChange({
  raw,
  avatarUri = '',
  wallet,
  walletProvider,
  readProvider,
  ethers,
  registryAddress,
  moderate = moderateName,
} = {}) {
  const handle = normalizeHandle(raw, { ethers });
  if (!handle.ok) return failure('validate', handle.error, { cleaned: handle.cleaned });
  const verdict = moderate(handle.cleaned);
  if (!verdict?.ok) return failure('moderation', verdict?.reason ?? 'profanity', { cleaned: handle.cleaned });
  if (avatarUri && !arcadeAvatarForUri(avatarUri)) return failure('validate', 'invalid-avatar');
  const self = String(wallet ?? '').toLowerCase();
  let owner;
  try {
    owner = await handleOwner(handle.handleHash, { readProvider, ethers, registryAddress });
  } catch {
    return failure('availability', 'chain-read-failed');
  }
  if (owner && owner !== self) return failure('availability', 'handle-taken', { cleaned: handle.cleaned });
  let fee;
  try {
    fee = await estimateSetProfile(walletProvider, { displayName: handle.cleaned, avatarUri, from: self, ethers, registryAddress });
  } catch (error) {
    return failure('estimate', error?.code === 'wrong-network' || error?.code === 'no-wallet' ? error.code : 'estimate-failed');
  }
  return {
    ok: true,
    step: 'ready',
    wallet: self,
    cleaned: handle.cleaned,
    normalized: handle.normalized,
    handleHash: handle.handleHash,
    avatarUri: avatarUri || '',
    fee,
    feeLabel: `Network fee about ${formatZkLtc(fee.gasZkLtc)} zkLTC`,
  };
}

// Steps 5-6: send (the one wallet prompt, from the Confirm click), wait, refresh
// the index, then announce the change. `dispatch(name, detail)` fires the
// window event (lesters:profile-changed, §7.7).
export async function commitProfileChange(prepared, {
  walletProvider,
  ethers,
  registryAddress,
  indexApi,
  dispatch = () => {},
  onBroadcast = () => {},
} = {}) {
  if (!prepared?.ok) throw new TypeError('commitProfileChange needs a prepared change');
  let sent;
  try {
    sent = await sendSetProfile(walletProvider, { displayName: prepared.cleaned, avatarUri: prepared.avatarUri, from: prepared.wallet, ethers, registryAddress });
  } catch (error) {
    if (isRejection(error)) return failure('send', 'rejected');
    return failure('send', error?.code === 'wrong-network' || error?.code === 'no-wallet' ? error.code : 'send-failed');
  }
  onBroadcast(sent.txHash);
  const receipt = await sent.wait();
  if (receipt.status !== 'confirmed') return failure('confirm', 'tx-failed', { txHash: sent.txHash });
  const refreshed = await indexApi?.refreshProfile?.(prepared.wallet);
  const profile = refreshed?.ok ? refreshed.profile ?? {} : null;
  const detail = {
    wallet: prepared.wallet,
    displayName: profile ? profile.displayName ?? null : prepared.cleaned,
    avatarUri: profile ? profile.avatarUri ?? null : (prepared.avatarUri || null),
  };
  dispatch('lesters:profile-changed', detail);
  return { ok: true, step: 'done', txHash: sent.txHash, blockNumber: receipt.blockNumber, refreshed: Boolean(refreshed?.ok), ...detail };
}

// "0.0000423" style: at most 6 significant decimals, never scientific notation.
export function formatZkLtc(value) {
  const text = String(value ?? '0');
  if (!/^\d+(\.\d+)?$/.test(text)) return '0';
  const [whole, fraction = ''] = text.split('.');
  if (!/[1-9]/.test(fraction)) return whole;
  const firstSignificant = fraction.search(/[1-9]/);
  const kept = fraction.slice(0, Math.max(firstSignificant + 3, 6)).replace(/0+$/, '');
  return kept ? `${whole}.${kept}` : whole;
}
