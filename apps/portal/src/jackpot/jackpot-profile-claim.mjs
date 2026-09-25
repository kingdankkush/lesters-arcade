// The profile's Claim form for a `claim-pending` jackpot win (design §A.9, §D.3), loaded by
// jackpot-profile-wins.mjs only for the connected winner of such a week, so other profile views never
// download it. claim(week, to) goes to that week's own jackpot contract, `to` defaulting to the connected
// wallet and editable, with the 180-day notice. The contract must be a known instance of the generated
// module (never an address from the API alone), and the transaction is priced like every player
// transaction (liteforge-fees: ten times the base fee, a 5 gwei floor, no tip).
import { LITVM_JACKPOT } from '../generated/litvm-jackpot.mjs';
import { liteForgeMaxFeePerGas } from '../liteforge-fees.mjs';
import { explorerTxUrl, weekIndexOfMs } from './jackpot-client.mjs';
import { link, node } from './jackpot-view.mjs';

export const CLAIM_SELECTOR = '0x881a1ce0'; // claim(uint64,address)
export const LITEFORGE_CHAIN_HEX = '0x1159';
export const UNCLAIMED_NOTICE = 'A prize that is still unclaimed 180 days after the payout returns to the prize pool.';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// The jackpot contracts this client knows (the active instance and every retired one), lowercase.
export function knownJackpotContracts(deployment = LITVM_JACKPOT) {
  if (deployment?.status !== 'deployed') return new Set();
  const chikun = deployment.instances?.chikun;
  return new Set([chikun?.address, ...(chikun?.retired ?? []).map((entry) => entry.address)].filter((value) => typeof value === 'string' && ADDRESS.test(value)).map((value) => value.toLowerCase()));
}

// Pure: the claim(week, to) call for a win, or null when anything is off.
export function claimCall({ contract, startsAt, to }, deployment = LITVM_JACKPOT) {
  const target = String(contract ?? '').toLowerCase();
  if (!knownJackpotContracts(deployment).has(target) || !ADDRESS.test(String(to ?? ''))) return null;
  const start = Date.parse(String(startsAt ?? ''));
  if (!Number.isFinite(start)) return null;
  const week = weekIndexOfMs(start);
  if (!Number.isSafeInteger(week) || week < 1) return null;
  const word = (hex) => hex.padStart(64, '0');
  return Object.freeze({ to: target, data: `${CLAIM_SELECTOR}${word(week.toString(16))}${word(String(to).slice(2).toLowerCase())}`, week });
}

const claims = new Map(); // `${contract}:${weekKey}` -> { to, busy, message, tone, txHash }

async function sendClaim({ provider, from, call }) {
  const request = (method, params = []) => provider.request({ method, params });
  try {
    await request('wallet_switchEthereumChain', [{ chainId: LITEFORGE_CHAIN_HEX }]);
  } catch (error) {
    if ((error?.code ?? error?.data?.originalError?.code) !== 4902) throw error;
    await request('wallet_addEthereumChain', [{ chainId: LITEFORGE_CHAIN_HEX, chainName: 'LitVM LiteForge', nativeCurrency: { name: 'zkLTC', symbol: 'zkLTC', decimals: 18 }, rpcUrls: ['https://liteforge.rpc.caldera.xyz/http'], blockExplorerUrls: ['https://liteforge.explorer.caldera.xyz'] }]);
    await request('wallet_switchEthereumChain', [{ chainId: LITEFORGE_CHAIN_HEX }]);
  }
  if (String(await request('eth_chainId')).toLowerCase() !== LITEFORGE_CHAIN_HEX) throw new Error('Switch your wallet to LitVM LiteForge (chain 4441), then claim again.');
  const latest = await request('eth_getBlockByNumber', ['latest', false]).catch(() => null);
  const maxFee = liteForgeMaxFeePerGas(latest?.baseFeePerGas ?? null);
  return request('eth_sendTransaction', [{ from, to: call.to, data: call.data, chainId: LITEFORGE_CHAIN_HEX, maxFeePerGas: `0x${maxFee.toString(16)}`, maxPriorityFeePerGas: '0x0' }]);
}

function walletMessage(error) {
  const code = error?.code ?? error?.info?.error?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') return 'You cancelled in your wallet. Nothing was sent.';
  return String(error?.shortMessage ?? error?.message ?? 'The wallet could not send the claim.').slice(0, 160);
}

export function claimForm(documentRef, win, { wallet, walletProviderForAction, deployment = LITVM_JACKPOT, rerender }) {
  const key = `${String(win.contract).toLowerCase()}:${win.weekKey}`;
  const state = claims.get(key) ?? { to: wallet, busy: false, message: '', tone: '', txHash: null };
  claims.set(key, state);
  const form = node(documentRef, 'form');
  form.noValidate = true;
  const label = node(documentRef, 'label', '', 'Send the prize to');
  const input = node(documentRef, 'input');
  input.type = 'text';
  input.name = 'to';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = state.to;
  input.addEventListener('input', () => { state.to = input.value.trim(); });
  label.append(input);
  const button = node(documentRef, 'button', '', state.busy ? 'Check your wallet…' : 'Claim prize');
  button.type = 'submit';
  button.disabled = state.busy;
  const status = node(documentRef, 'p', 'jackpot-status', state.message);
  status.setAttribute('role', 'status');
  status.dataset.tone = state.tone;
  const tx = explorerTxUrl(state.txHash);
  if (tx) status.append(' ', link(documentRef, tx, 'View transaction'));
  const submit = async (event) => {
    event?.preventDefault?.();
    if (state.busy) return;
    const call = claimCall({ contract: win.contract, startsAt: win.startsAt, to: state.to }, deployment);
    if (!call) {
      Object.assign(state, { message: ADDRESS.test(state.to) ? 'This prize cannot be claimed from here. Use the owner page.' : 'Enter a wallet address (0x followed by 40 hex characters).', tone: 'error' });
      rerender();
      return;
    }
    Object.assign(state, { busy: true, message: 'Confirm the claim in your wallet.', tone: '' });
    rerender();
    try {
      const provider = await walletProviderForAction();
      if (!provider?.request) throw new Error('Connect your wallet to claim.');
      const hash = await sendClaim({ provider, from: wallet, call });
      Object.assign(state, { txHash: hash, message: 'Claim sent. The prize arrives once LitVM includes it.', tone: 'ok' });
    } catch (error) {
      Object.assign(state, { message: walletMessage(error), tone: 'error' });
    } finally {
      state.busy = false;
      rerender();
    }
  };
  form.addEventListener('submit', submit);
  button.addEventListener('click', submit);
  form.append(label, button, status, node(documentRef, 'p', 'jackpot-note', UNCLAIMED_NOTICE));
  return form;
}
