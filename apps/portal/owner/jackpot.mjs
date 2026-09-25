// Owner page: review and fund the Chikun Weekly Jackpot (design §D.5, runbook §E E5, E8-E11).
//
// Conventions of confirm-dev-wallet.mjs: plain window.ethereum for the wallet (MetaMask or Rabby), the
// same-origin vendored ethers only for public reads and call encoding, switch or add chain 4441, a module
// script with no inline script (CSP), DOM built with createElement and textContent. It never imports the
// Chikun runtime, chikun-cabinet.mjs or anything that imports obstacle-shapes.json (they cannot load
// unbundled): the flap timeline is drawn from the review API's server-computed `timeline`.
//
// Owner pages are publicly served, so all authority is on chain:
//   - the gate reads admin(), keeper(), operator(), paused() and operatorPaused(); any account other
//     than admin() is read-only apart from Fund, a winner's Claim, a funder's Refund and Finalize
//     (anyone, once due);
//   - review data (features, hold codes, the timeline) is read only with a SIWE session through the
//     existing /api/session flow, as a Bearer token kept in memory; the server checks the live admin();
//   - every write is priced with liteForgeFeeOverrides (10 x the base fee, 5 gwei floor, no tip), shows
//     checkEligibility or the state first, then the transaction hash with its explorer link, and
//     refreshes; approve is always the exact amount, never unlimited.
import { LITVM_JACKPOT } from '../src/generated/litvm-jackpot.mjs';
import { liteForgeFeeOverrides } from '../src/liteforge-fees.mjs';
import { buildSiweChallenge } from '../src/wallet-auth.mjs';
import { LITEFORGE_CHAIN, addChainParams, explorerTxUrl, shortAddress } from './confirm-dev-wallet.mjs';
import {
  ERC20_FRAGMENTS, HOLD_CODE_TEXT, JACKPOT_ACTIONS, JACKPOT_FRAGMENTS, MAX_CANDIDATES, REASON_CODES, REVIEW_RUBRIC,
  REVIEW_STATES, SOFT_SIGNAL_TEXT, WEEK_STATUSES, actionAllowed, decodeReason, encodeJackpotCall, extensionRemaining,
  fundPlan, integrityText, isoWeekKeyOf, normalizeReview, timelineGeometry, weekIndexOf,
} from './jackpot-review-model.mjs';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';
const lower = (value) => String(value ?? '').toLowerCase();
export const EXPLORER = LITEFORGE_CHAIN.explorerUrl;
export const explorerAddressUrl = (address) => (ADDRESS.test(String(address ?? '')) ? `${EXPLORER}/address/${address}` : null);

function walletErrorMessage(error) {
  const code = error?.code ?? error?.info?.error?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') return 'You rejected the request in your wallet. Nothing was sent.';
  if (code === -32002) return 'Your wallet already has a request open. Finish or close it in the wallet, then try again.';
  const reason = error?.reason ?? error?.info?.error?.message ?? error?.shortMessage ?? error?.message ?? error;
  return `The wallet reported an error: ${String(reason).slice(0, 160)}`;
}
// The revert string of a simulated call (an ethers CALL_EXCEPTION), for the refusal message.
function revertReason(error) {
  return String(error?.reason ?? error?.revert?.args?.[0] ?? error?.shortMessage ?? 'reverted').slice(0, 80);
}

// Decimal token text (BigInt, truncated) for the page.
export function tokenText(wei, decimals = 18, symbol = '') {
  const value = BigInt(wei ?? 0);
  const base = 10n ** BigInt(decimals);
  const fraction = (value % base).toString().padStart(Number(decimals), '0').slice(0, 4).replace(/0+$/, '');
  return `${(value / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}${symbol ? ` ${symbol}` : ''}`;
}
// "in 3 h 20 min" / "2 h ago" from chain time, for the week's countdowns.
export function countdownText(seconds, nowSeconds) {
  const delta = Number(seconds) - Number(nowSeconds);
  if (!Number.isFinite(delta)) return '';
  const abs = Math.abs(delta);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const span = days ? `${days} d ${hours} h` : hours ? `${hours} h ${minutes} min` : `${minutes} min`;
  return delta >= 0 ? `in ${span}` : `${span} ago`;
}
export function whenText(seconds, timeZone) {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const local = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(ms);
  return `${local} · ${new Date(ms).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

// DOM-free controller. `onChange(state)` runs after every change.
export function createJackpotOwnerController({
  ethereum = null,
  deployment = LITVM_JACKPOT,
  loadEthers = () => import('../vendor/ethers.min.js'),
  createReadProvider = (ethers) => new ethers.JsonRpcProvider(LITEFORGE_CHAIN.rpcUrl, LITEFORGE_CHAIN.chainId, { staticNetwork: true, cacheTimeout: -1 }),
  fetchImpl = (...args) => globalThis.fetch(...args),
  domain = globalThis.location?.hostname || 'lestersarcade.io',
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  receiptPollMs = 1500,
  receiptTimeoutMs = 5 * 60_000,
  onChange = () => {},
} = {}) {
  const instance = deployment?.status === 'deployed' && ADDRESS.test(String(deployment.instances?.chikun?.address ?? '')) ? deployment.instances.chikun : null;
  const state = {
    phase: !ethereum?.request ? 'no-wallet' : instance ? 'idle' : 'undeployed',
    message: !ethereum?.request
      ? 'No browser wallet found. Install MetaMask or Rabby, then reload this page.'
      : instance ? 'Connect a wallet to read the jackpot on LiteForge.' : 'The jackpot contract is not deployed yet (apps/portal/src/generated/litvm-jackpot.mjs is undeployed). Review data can still be read after sign-in.',
    deploymentStatus: deployment?.status ?? 'undeployed',
    contract: instance?.address ? lower(instance.address) : null,
    account: null,
    accountRaw: null,
    chainId: null,
    roles: null,
    isAdmin: false,
    currentWeek: null,
    firstWeek: instance?.firstWeek ?? null,
    endAfterWeek: 0,
    selectedWeek: weekIndexOf(now() / 1000) - 1,
    week: null,
    token: null,
    fundedByMe: 0n,
    fundResult: null,
    session: null,
    review: null,
    reviewWeek: null,
    lastTx: null,
    busy: false,
  };
  let ethersPromise = null;
  let readProvider = null;
  let sending = false;
  const emit = () => onChange(state);
  const set = (patch) => { Object.assign(state, patch); emit(); };
  const ethersLib = () => (ethersPromise ??= Promise.resolve(loadEthers()));
  const reader = async () => (readProvider ??= createReadProvider(await ethersLib()));
  const request = (method, params = []) => ethereum.request({ method, params });
  const contract = async () => {
    const ethers = await ethersLib();
    return new ethers.Contract(state.contract, JACKPOT_FRAGMENTS, await reader());
  };

  async function checkChainAndAccount() {
    const chainId = String(await request('eth_chainId')).toLowerCase();
    state.chainId = chainId;
    if (chainId !== LITEFORGE_CHAIN.chainIdHex) {
      set({ phase: 'wrong-chain', message: `This page sends transactions on ${LITEFORGE_CHAIN.chainName} (chain ${LITEFORGE_CHAIN.chainId}). Your wallet is on chain ${Number.parseInt(chainId, 16) || chainId}. Press "Switch to LiteForge".` });
      return false;
    }
    const accounts = await request('eth_accounts');
    state.accountRaw = accounts?.[0] ?? null;
    state.account = accounts?.[0] ? lower(accounts[0]) : null;
    // The review session belongs to the wallet that signed in: another account (a switch in the
    // extension) drops it and its review data, so the page asks that account to sign in.
    if (state.session && state.session.wallet !== state.account) Object.assign(state, { session: null, review: null, reviewWeek: null });
    if (!state.account) {
      set({ phase: 'idle', message: 'Connect a wallet first.' });
      return false;
    }
    return true;
  }

  // Public reads: the gate, the selected week, its candidates, and the connected account's token state.
  async function refresh() {
    if (!state.contract) return false;
    set({ phase: state.phase === 'sending' ? 'sending' : 'checking', message: state.phase === 'sending' ? state.message : 'Reading the jackpot on LiteForge…' });
    try {
      const ethers = await ethersLib();
      const provider = await reader();
      const jackpot = await contract();
      const [admin, keeper, operator, adminPaused, operatorPaused, currentWeek, firstWeek, endAfterWeek, tokenAddress, latest] = await Promise.all([
        jackpot.admin(), jackpot.keeper(), jackpot.operator(), jackpot.adminPaused(), jackpot.operatorPaused(),
        jackpot.currentWeek(), jackpot.firstWeek(), jackpot.endAfterWeek(), jackpot.token(), provider.getBlock('latest'),
      ]);
      const current = Number(currentWeek);
      const first = Number(firstWeek);
      if (state.currentWeek === null) state.selectedWeek = Math.max(first, current - 1);
      state.selectedWeek = Math.max(first, state.selectedWeek);
      const week = state.selectedWeek;
      const [bounds, pot, weekState, list, leader, rules] = await Promise.all([
        jackpot.weekBounds(week), jackpot.potOf(week), jackpot.weekState(week), jackpot.candidatesOf(week), jackpot.leaderOf(week), jackpot.rulesFor(week),
      ]);
      const candidates = await Promise.all(list.map(async (row) => {
        const [review, adminReviewed, wasListed, blocked] = await Promise.all([jackpot.reviewOf(row.sessionId), jackpot.adminReviewed(row.sessionId), jackpot.wasListed(row.sessionId), jackpot.blocked(row.player)]);
        return { sessionId: lower(row.sessionId), player: lower(row.player), submittedAt: Number(row.submittedAt), score: Number(row.score), review: REVIEW_STATES[Number(review)] ?? 'none', adminReviewed, wasListed, blocked };
      }));
      const token = new ethers.Contract(tokenAddress, ERC20_FRAGMENTS, provider);
      const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
      let balance = 0n;
      let allowance = 0n;
      let fundedByMe = 0n;
      if (state.account) {
        [balance, allowance, fundedByMe] = await Promise.all([token.balanceOf(state.account), token.allowance(state.account, state.contract), jackpot.fundedBy(week, state.account)]);
      }
      const roles = { admin: lower(admin), keeper: lower(keeper), operator: lower(operator), adminPaused, operatorPaused, paused: adminPaused || operatorPaused };
      Object.assign(state, {
        roles,
        isAdmin: Boolean(state.account) && state.account === roles.admin,
        currentWeek: current,
        firstWeek: first,
        endAfterWeek: Number(endAfterWeek),
        chainNow: Number(latest.timestamp),
        week: {
          index: week,
          key: isoWeekKeyOf(week),
          bounds: { start: Number(bounds.start), close: Number(bounds.close), settleCutoff: Number(bounds.settleCutoff), candidateUntil: Number(bounds.candidateUntil), payoutAt: Number(bounds.payoutAt) },
          pot: { funded: pot.funded, carriedIn: pot.carriedIn, total: pot.total },
          state: { status: WEEK_STATUSES[Number(weekState.status)] ?? 'open', held: weekState.held, count: Number(weekState.count), winner: lower(weekState.winner), winningSession: lower(weekState.winningSession), prize: weekState.prize, unclaimed: weekState.unclaimed, finalizedAt: Number(weekState.finalizedAt), extension: Number(weekState.extension) },
          rules: { minPaidWei: rules.minPaidWei, maxPrizeWei: rules.maxPrizeWei, minFundWei: rules.minFundWei, maxSurvivalSeconds: Number(rules.maxSurvivalSeconds), adminClearOnly: rules.adminClearOnly, maxScore: rules.maxScore },
          leader: lower(leader.sessionId) === '0x' + '0'.repeat(64) ? null : { sessionId: lower(leader.sessionId), player: lower(leader.player), score: Number(leader.score), review: REVIEW_STATES[Number(leader.review)] ?? 'none' },
          candidates,
        },
        token: { address: lower(tokenAddress), symbol, decimals: Number(decimals), balance, allowance },
        fundedByMe,
      });
      if (state.phase !== 'sending') {
        const who = state.isAdmin ? 'You are the jackpot admin.' : state.account ? 'Read-only: this account is not the jackpot admin. Fund, Finalize (once due), a winner\'s Claim and a funder\'s Refund stay open.' : 'Read-only until a wallet connects.';
        set({ phase: 'ready', message: who });
      } else emit();
      return true;
    } catch (error) {
      set({ phase: 'error', message: `Could not read the jackpot over LiteForge's public RPC (${String(error?.shortMessage ?? error?.message ?? error).slice(0, 120)}). Nothing was sent; try again.` });
      return false;
    }
  }

  let connecting = null;
  async function connect() {
    if (!ethereum?.request) return state;
    connecting ??= (async () => {
      try {
        set({ phase: 'connecting', message: 'Waiting for your wallet to share the account…' });
        await request('eth_requestAccounts');
        if (!(await checkChainAndAccount())) return state;
        if (!state.contract) {
          set({ phase: 'undeployed', message: 'Connected. The jackpot contract is not deployed yet, so there is nothing on chain to read; you can still sign in to read review data.' });
          return state;
        }
        await refresh();
      } catch (error) {
        set({ phase: 'error', message: walletErrorMessage(error) });
      }
      return state;
    })().finally(() => { connecting = null; });
    return connecting;
  }

  async function switchChain() {
    if (!ethereum?.request) return state;
    try {
      try {
        await request('wallet_switchEthereumChain', [{ chainId: LITEFORGE_CHAIN.chainIdHex }]);
      } catch (error) {
        if ((error?.code ?? error?.data?.originalError?.code) !== 4902) throw error;
        await request('wallet_addEthereumChain', [addChainParams()]);
        await request('wallet_switchEthereumChain', [{ chainId: LITEFORGE_CHAIN.chainIdHex }]);
      }
      return await connect();
    } catch (error) {
      set({ phase: 'error', message: walletErrorMessage(error) });
      return state;
    }
  }

  async function selectWeek(index) {
    const week = Number(index);
    if (!Number.isSafeInteger(week) || week < 1) return state;
    state.selectedWeek = Math.max(Number(state.firstWeek ?? 1), week);
    state.review = null;
    if (state.contract && state.account) await refresh();
    if (state.session) await loadReview();
    emit();
    return state;
  }

  // SIWE through the existing /api/session flow, only to read /api/jackpot/review. The token stays in
  // memory; the server checks the live on-chain admin() (and JACKPOT_ADMIN_WALLET when set).
  async function signIn() {
    if (!ethereum?.request || sending) return state;
    try {
      if (!state.account) await connect();
      if (!state.account) return state;
      set({ phase: 'signing-in', message: 'Getting a sign-in code from the arcade server…' });
      const nonceResponse = await fetchImpl('/api/session/nonce', { cache: 'no-store', headers: { accept: 'application/json' } });
      const nonce = await nonceResponse.json().catch(() => null);
      if (!nonceResponse.ok || !nonce?.ok) {
        set({ phase: 'error', message: 'Sign-in is unavailable right now (the arcade server did not issue a code).' });
        return state;
      }
      const challenge = buildSiweChallenge({ domain, address: state.accountRaw, chainId: LITEFORGE_CHAIN.chainId, nonce: nonce.nonce, issuedAt: nonce.issuedAt });
      set({ message: 'Sign the message in your wallet. Signing in costs nothing and sends no transaction.' });
      const signature = await request('personal_sign', [challenge.message, state.accountRaw]);
      const sessionResponse = await fetchImpl('/api/session', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ challenge, signature }) });
      const session = await sessionResponse.json().catch(() => null);
      if (!sessionResponse.ok || !session?.ok || lower(session.wallet) !== state.account || typeof session.token !== 'string') {
        set({ phase: 'error', message: `Sign-in was refused (${String(session?.error ?? `http-${sessionResponse.status}`).slice(0, 40)}).` });
        return state;
      }
      state.session = { token: session.token, wallet: state.account, expiresAt: session.expiresAt ?? null };
      await loadReview();
    } catch (error) {
      set({ phase: 'error', message: walletErrorMessage(error) });
    }
    return state;
  }

  async function loadReview() {
    if (!state.session) return state;
    const key = isoWeekKeyOf(state.selectedWeek);
    // A sign-in ends here whatever the answer, so its phase never sticks.
    const phase = () => (state.phase === 'signing-in' ? (state.contract ? 'ready' : 'undeployed') : state.phase);
    try {
      const response = await fetchImpl(`/api/jackpot/review?week=${key}`, { cache: 'no-store', headers: { accept: 'application/json', authorization: `Bearer ${state.session.token}` } });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        state.session = null;
        set({ review: null, phase: phase(), message: 'The sign-in expired. Sign in again to read review data.' });
        return state;
      }
      if (response.status === 403) {
        // Dropped, so the sign-in button returns for the admin account.
        state.session = null;
        set({ review: null, phase: phase(), message: 'The arcade server refused review data: this wallet is not the on-chain jackpot admin. Switch to the admin wallet and sign in again.' });
        return state;
      }
      const review = response.ok ? normalizeReview(body) : null;
      set({ review, reviewWeek: key, phase: phase(), message: review ? `Review data for ${key} loaded.` : 'Review data could not be read. Try again in a moment.' });
    } catch {
      set({ review: null, phase: phase(), message: 'Review data could not be read. Try again in a moment.' });
    }
    return state;
  }

  async function waitForReceipt(hash) {
    const provider = await reader();
    const deadline = now() + receiptTimeoutMs;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const receipt = await provider.getTransactionReceipt(hash).catch(() => null);
      if (receipt) return receipt;
      if (now() > deadline) return null;
      // eslint-disable-next-line no-await-in-loop
      await sleep(receiptPollMs);
    }
  }

  // The state read (or checkEligibility) each action shows before anything goes to the wallet.
  // Returns { refuse } to stop, or { note } to show while the wallet is open.
  async function precheck(action, params) {
    const jackpot = await contract();
    const week = state.week;
    const roles = state.roles;
    if (!actionAllowed(action, { account: state.account, admin: roles?.admin, winner: week?.state?.winner, fundedWei: state.fundedByMe })) {
      const role = JACKPOT_ACTIONS[action].role;
      return { refuse: role === 'admin' ? `Only the jackpot admin (${shortAddress(roles?.admin)}) can ${JACKPOT_ACTIONS[action].label.toLowerCase()}. Nothing was sent.` : role === 'winner' ? 'Only the winner of this week can claim its prize. Nothing was sent.' : 'This account funded nothing to refund for this week. Nothing was sent.' };
    }
    if (['clear', 'flag', 'disqualify', 'reinstate'].includes(action)) {
      const [review, adminReviewed] = await Promise.all([jackpot.reviewOf(params.sessionId), jackpot.adminReviewed(params.sessionId)]);
      const current = REVIEW_STATES[Number(review)] ?? 'none';
      const note = `On chain now: ${current}${adminReviewed ? ', admin-reviewed' : ''}.`;
      if (action === 'clear' && current === 'disqualified') return { refuse: `${note} Reinstate it before clearing. Nothing was sent.` };
      if (action === 'flag' && current === 'disqualified') return { refuse: `${note} A disqualified session cannot be flagged. Nothing was sent.` };
      if (action === 'reinstate' && current !== 'disqualified') return { refuse: `${note} Only a disqualified session can be reinstated. Nothing was sent.` };
      return { note };
    }
    if (action === 'adminSubmit') {
      const [ok, runWeek, reason] = await jackpot.checkEligibility(params.sessionId);
      const count = Number((await jackpot.weekState(Number(runWeek) || state.selectedWeek)).count);
      if (count >= MAX_CANDIDATES) return { refuse: `The list already holds ${MAX_CANDIDATES} rows (LIST_FULL). Disqualify a decoy first. Nothing was sent.` };
      if (!ok && reason !== 'WINDOW_CLOSED') return { refuse: `checkEligibility: ${reason}. Nothing was sent.` };
      // checkEligibility runs the permissionless submit checks, which stop at WINDOW_CLOSED once the 12 h
      // candidate window ends, exactly when adminSubmit is used, before the player and payout checks. So
      // adminSubmit itself is simulated from this account (eth_call, nothing sent): the contract's admin
      // checks (TOO_LATE, STAFF_WALLET, WALLET_BLOCKED, DISQUALIFIED, NOT_BETTER, ...) answer first.
      const call = encodeJackpotCall(await ethersLib(), 'adminSubmit', params, { jackpot: state.contract });
      try {
        await (await reader()).call({ from: state.account, to: call.to, data: call.data });
      } catch (error) {
        // A revert is the contract's answer; anything else (the public RPC failing) is not a verdict.
        if (error?.code === 'CALL_EXCEPTION') return { refuse: `adminSubmit would revert: ${revertReason(error)}. Nothing was sent.` };
        return { refuse: `Could not simulate adminSubmit over LiteForge's public RPC (${String(error?.shortMessage ?? error?.message ?? error).slice(0, 80)}). Nothing was sent; try again.` };
      }
      return { note: `checkEligibility: ${ok ? 'eligible' : `${reason} (adminSubmit skips the window)`}; the simulated adminSubmit passes.` };
    }
    if (action === 'block' || action === 'unblock') {
      const blocked = await jackpot.blocked(params.wallet);
      if (blocked === (action === 'block')) return { refuse: `${shortAddress(params.wallet)} is already ${blocked ? 'blocked' : 'unblocked'}. Nothing was sent.` };
      return { note: `${shortAddress(params.wallet)} is ${blocked ? 'blocked' : 'not blocked'} now.` };
    }
    if (['hold', 'release', 'extend', 'finalize', 'claim', 'refund'].includes(action)) {
      const live = await jackpot.weekState(params.week);
      const bounds = await jackpot.weekBounds(params.week);
      const chainNow = Number((await (await reader()).getBlock('latest')).timestamp);
      const status = WEEK_STATUSES[Number(live.status)] ?? 'open';
      if (action === 'hold' && live.held) return { refuse: 'The week is already held. Nothing was sent.' };
      if (action === 'release' && !live.held) return { refuse: 'The week is not held. Nothing was sent.' };
      if (action === 'extend') {
        const left = extensionRemaining(Number(live.extension));
        if (Number(params.extraSeconds) > left) return { refuse: `Only ${Math.floor(left / 3600)} h of the 72 h extension cap remain. Nothing was sent.` };
        if (chainNow >= Number(bounds.payoutAt)) return { refuse: 'The payout time has passed; an extension is no longer possible. Nothing was sent.' };
      }
      if (action === 'finalize') {
        if (status !== 'open') return { refuse: `The week is already ${status}. Nothing was sent.` };
        if (chainNow < Number(bounds.payoutAt)) return { refuse: `Payout is due ${whenText(bounds.payoutAt)}. Nothing was sent.` };
        if (live.held) return { refuse: 'The week is held. Release it first. Nothing was sent.' };
        if (await jackpot.paused()) return { refuse: 'Payouts are paused. Nothing was sent.' };
      }
      if (action === 'claim') {
        if (lower(live.winner) !== state.account || BigInt(live.unclaimed) === 0n) return { refuse: 'Nothing to claim for this account in this week. Nothing was sent.' };
      }
      if (action === 'refund') {
        const end = Number(await jackpot.endAfterWeek());
        if (!end || Number(params.week) <= end || Number(await jackpot.currentWeek()) <= end) return { refuse: 'Refunds open only for weeks after a scheduled end, once the end has passed. Nothing was sent.' };
      }
      return { note: `Week ${isoWeekKeyOf(params.week)}: ${status}${live.held ? ', held' : ''}, extension ${Math.floor(Number(live.extension) / 3600)} h.` };
    }
    if (action === 'pause' || action === 'unpause') {
      const adminPaused = await jackpot.adminPaused();
      if (adminPaused === (action === 'pause')) return { refuse: `The admin pause is already ${adminPaused ? 'on' : 'off'}. Nothing was sent.` };
      return { note: `Admin pause is ${adminPaused ? 'on' : 'off'}; the operator pause is ${state.roles?.operatorPaused ? 'on (only the operator can lift it)' : 'off'}.` };
    }
    return { note: '' };
  }

  async function sendAction(action, params = {}) {
    const ethers = await ethersLib();
    const call = encodeJackpotCall(ethers, action, params, { jackpot: state.contract, token: state.token?.address });
    const fees = await liteForgeFeeOverrides(await reader());
    const hash = await request('eth_sendTransaction', [{ from: state.account, to: call.to, data: call.data, chainId: LITEFORGE_CHAIN.chainIdHex, maxFeePerGas: `0x${fees.maxFeePerGas.toString(16)}`, maxPriorityFeePerGas: `0x${fees.maxPriorityFeePerGas.toString(16)}` }]);
    set({ lastTx: { action, hash, url: explorerTxUrl(hash) }, message: `Sent ${JACKPOT_ACTIONS[action].label}: ${hash}. Waiting for LiteForge to include it…` });
    const receipt = await waitForReceipt(hash);
    if (!receipt) throw new Error(`No receipt for ${hash} yet. Check it on the explorer, then refresh.`);
    if (Number(receipt.status) !== 1) throw new Error(`The ${JACKPOT_ACTIONS[action].label} transaction reverted (${hash}). Nothing changed on chain.`);
    return hash;
  }

  // One action: re-check chain and account, the gate and the state, then one transaction (two for Fund:
  // an exact approve when the allowance is short, then fund), then a refresh.
  async function act(action, params = {}) {
    if (sending || !state.contract || !JACKPOT_ACTIONS[action]) return state;
    sending = true;
    set({ phase: 'sending', busy: true, message: 'Checking the wallet chain and account…' });
    try {
      if (!(await checkChainAndAccount())) return state;
      if (!state.roles) await refresh();
      state.phase = 'sending';
      if (action === 'fund') {
        // `amount` is the typed token amount; `amountWei` an exact integer (tests, the rehearsal).
        const ethers = await ethersLib();
        let amountWei = params.amountWei;
        if (amountWei === undefined) {
          try { amountWei = ethers.parseUnits(String(params.amount ?? '0') || '0', state.token?.decimals ?? 18); } catch { amountWei = 0n; }
        }
        // Fresh reads: the target week's minimum (the contract checks the week it funds), the balance and
        // the allowance, so the approve is exactly what the fund needs.
        const target = Number(params.week);
        const token = new ethers.Contract(state.token.address, ERC20_FRAGMENTS, await reader());
        const [targetRules, balanceWei, allowanceWei] = Number.isSafeInteger(target) && target > 0
          ? await Promise.all([(await contract()).rulesFor(target), token.balanceOf(state.account), token.allowance(state.account, state.contract)])
          : [null, state.token.balance, state.token.allowance];
        const plan = fundPlan({ week: params.week, currentWeek: state.currentWeek, firstWeek: state.firstWeek, endAfterWeek: state.endAfterWeek, amountWei, minFundWei: targetRules?.minFundWei ?? state.week?.rules?.minFundWei ?? 0n, balanceWei, allowanceWei });
        if (!plan.ok) {
          set({ phase: 'ready', message: `${plan.problems.join(' ')} Nothing was sent.` });
          return state;
        }
        set({ message: `${plan.advice ? `${plan.advice} ` : ''}Confirm ${plan.needsApprove ? 'the exact approve, then ' : ''}the fund in your wallet.` });
        if (plan.needsApprove) await sendAction('approve', { amountWei: plan.approveWei });
        await sendAction('fund', { week: params.week, amountWei: plan.amountWei });
        // The resulting pot and prize of the funded week (the prize is the pot, or the week's cap).
        const pot = await (await contract()).potOf(target);
        const cap = BigInt(targetRules?.maxPrizeWei ?? 0n);
        const total = BigInt(pot.total);
        state.fundResult = { week: target, total, prize: cap > 0n && total > cap ? cap : total, capped: cap > 0n && total > cap };
      } else {
        const check = await precheck(action, params);
        if (check.refuse) {
          set({ phase: 'ready', message: check.refuse });
          return state;
        }
        set({ message: `${check.note} Confirm "${JACKPOT_ACTIONS[action].label}" in your wallet.`.trim() });
        await sendAction(action, params);
      }
      const last = state.lastTx;
      await refresh();
      if (state.session) await loadReview();
      const result = action === 'fund' ? state.fundResult : null;
      const tokenLabel = (wei) => tokenText(wei, state.token?.decimals ?? 18, state.token?.symbol ?? '');
      const outcome = result ? ` Week ${isoWeekKeyOf(result.week)} pot is now ${tokenLabel(result.total)}; its prize would be ${tokenLabel(result.prize)}${result.capped ? ' (the prize cap; the rest rolls over)' : ''}.` : '';
      set({ phase: 'ready', lastTx: last, message: `${JACKPOT_ACTIONS[action].label} confirmed: ${last?.hash}.${outcome}` });
    } catch (error) {
      set({ phase: 'error', message: walletErrorMessage(error) });
    } finally {
      sending = false;
      set({ busy: false });
    }
    return state;
  }

  return { state, connect, switchChain, refresh, selectWeek, signIn, loadReview, act };
}

// -------------------------------------------------------------------------------------------------------
// DOM (browser only). Everything through createElement / textContent.

const SVG = 'http://www.w3.org/2000/svg';
function el(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'text') node.textContent = value;
    else if (name === 'className') node.className = value;
    else if (name === 'value') node.value = value;
    else if (name === 'disabled') node.disabled = Boolean(value);
    else if (name === 'checked') node.checked = Boolean(value);
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}
function svg(doc, tag, attrs = {}) {
  const node = doc.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}
const extLink = (doc, href, text) => (href ? el(doc, 'a', { href, target: '_blank', rel: 'noopener noreferrer', text }) : el(doc, 'span', { text }));
const button = (doc, text, onClick, { disabled = false, className = '' } = {}) => {
  const node = el(doc, 'button', { type: 'button', text, className, disabled });
  node.addEventListener('click', onClick);
  return node;
};
const select = (doc, options, label) => el(doc, 'select', { 'aria-label': label }, options.map((option) => el(doc, 'option', { value: option, text: option })));

// The flap timeline: altitude, flaps, fast pairs (changed the trajectory or not) and, per obstacle, the
// tick it became visible against the last flap before its pass; red marks only the server's verdict.
export function renderTimeline(doc, timeline, { label = 'Flap timeline' } = {}) {
  const geometry = timelineGeometry(timeline);
  if (!geometry) return el(doc, 'p', { className: 'jo-note', text: 'No timeline for this run yet.' });
  const root = svg(doc, 'svg', { viewBox: geometry.viewBox, role: 'img', 'aria-label': `${label}: ${geometry.lookAheadCount} unexplained descents`, class: 'jo-timeline', preserveAspectRatio: 'none' });
  const title = svg(doc, 'title');
  title.textContent = `${label}. Blue: altitude. Ticks: flaps. Dashed: obstacle visible at the stock view edge. Dots: the last flap before the obstacle was passed (red only for the server's unexplained descents, S8). Diamonds: fast pairs (orange when they changed the trajectory).`;
  root.append(title);
  root.append(svg(doc, 'path', { d: geometry.altitude, class: 'jo-altitude', fill: 'none' }));
  for (const x of geometry.flaps) root.append(svg(doc, 'line', { x1: x, x2: x, y1: geometry.height - 8, y2: geometry.height, class: 'jo-flap' }));
  for (const row of geometry.obstacles) {
    root.append(svg(doc, 'line', { x1: row.visibleX, x2: row.visibleX, y1: 0, y2: geometry.height, class: 'jo-visible', 'stroke-dasharray': '3 3' }));
    if (row.commitX !== null) root.append(svg(doc, 'circle', { cx: row.commitX, cy: 10, r: 3.5, class: row.lookAhead ? 'jo-commit jo-lookahead' : 'jo-commit' }));
  }
  for (const pair of geometry.fastPairs) root.append(svg(doc, 'rect', { x: pair.x - 2.5, y: 16, width: 5, height: 5, transform: `rotate(45 ${pair.x} 18.5)`, class: pair.changed ? 'jo-fast jo-fast-changed' : 'jo-fast' }));
  return root;
}

function codesList(doc, codes, table) {
  if (!codes?.length) return el(doc, 'span', { text: 'none' });
  return el(doc, 'ul', { className: 'jo-codes' }, codes.map((item) => el(doc, 'li', {}, [el(doc, 'strong', { text: item.code }), ` ${item.text || table[item.code] || ''}${item.value !== null && item.value !== undefined ? ` (${item.value})` : ''}`])));
}

function render(doc, controller) {
  const { state } = controller;
  const byId = (id) => doc.getElementById(id);
  const root = byId('jackpot-owner');
  if (!root) return;
  const week = state.week;
  const token = state.token;
  const busy = state.busy;
  const status = byId('jo-status');
  status.textContent = state.message ?? '';
  status.dataset.phase = state.phase;
  byId('jo-contract').replaceChildren(state.contract ? extLink(doc, explorerAddressUrl(state.contract), state.contract) : `not deployed (module: ${state.deploymentStatus})`);
  byId('jo-account').textContent = state.account ? `${shortAddress(state.account)}${state.isAdmin ? ' (admin)' : ''}` : 'not connected';
  const roles = state.roles;
  byId('jo-roles').replaceChildren(...(roles ? [
    el(doc, 'span', {}, ['Admin ', extLink(doc, explorerAddressUrl(roles.admin), shortAddress(roles.admin))]),
    el(doc, 'span', {}, [' · Keeper ', roles.keeper === ZERO ? 'none' : extLink(doc, explorerAddressUrl(roles.keeper), shortAddress(roles.keeper))]),
    el(doc, 'span', {}, [' · Operator ', extLink(doc, explorerAddressUrl(roles.operator), shortAddress(roles.operator))]),
    el(doc, 'span', { text: ` · Payouts: admin pause ${roles.adminPaused ? 'ON' : 'off'}, operator pause ${roles.operatorPaused ? 'ON (the admin cannot lift it)' : 'off'}` }),
  ] : ['—']));

  const actions = [];
  if (['idle', 'error', 'undeployed'].includes(state.phase) && !state.account) actions.push(button(doc, 'Connect wallet', () => controller.connect()));
  if (state.phase === 'wrong-chain') actions.push(button(doc, 'Switch to LiteForge', () => controller.switchChain()));
  if (state.account && !state.session) actions.push(button(doc, 'Sign in to read review data', () => controller.signIn(), { disabled: busy }));
  if (state.account && state.contract) actions.push(button(doc, 'Refresh', () => controller.refresh(), { disabled: busy }));
  byId('jo-connect').replaceChildren(...actions);

  // Week view.
  const weekBox = byId('jo-week');
  const nav = el(doc, 'div', { className: 'jo-row' }, [
    button(doc, '← Earlier week', () => controller.selectWeek(state.selectedWeek - 1), { disabled: busy }),
    el(doc, 'strong', { text: ` ${isoWeekKeyOf(state.selectedWeek)} (week ${state.selectedWeek}) ` }),
    button(doc, 'Later week →', () => controller.selectWeek(state.selectedWeek + 1), { disabled: busy }),
  ]);
  const weekRows = [];
  if (week) {
    const b = week.bounds;
    const s = week.state;
    const waiting = s.status === 'open' && state.chainNow >= b.payoutAt ? `${Math.floor((state.chainNow - b.payoutAt) / 3600)} h past the payout time` : 'no';
    for (const [term, value] of [
      ['Opens', whenText(b.start)], ['Closes', `${whenText(b.close)} (${countdownText(b.close, state.chainNow)})`], ['Settle cutoff', whenText(b.settleCutoff)], ['Candidates until', whenText(b.candidateUntil)], ['Payout due', `${whenText(b.payoutAt)} (${countdownText(b.payoutAt, state.chainNow)})`],
      ['Status', `${s.status}${s.held ? ', HELD' : ''}${s.status === 'paid' && BigInt(s.unclaimed) > 0n ? ', claim pending' : ''}`],
      ['Pot', token ? `${tokenText(week.pot.total, token.decimals, token.symbol)} (funded ${tokenText(week.pot.funded, token.decimals)}, carried in ${tokenText(week.pot.carriedIn, token.decimals)})` : '—'],
      ['Prize cap', BigInt(week.rules.maxPrizeWei) > 0n && token ? tokenText(week.rules.maxPrizeWei, token.decimals, token.symbol) : 'none'],
      ['Minimum fund', token ? tokenText(week.rules.minFundWei, token.decimals, token.symbol) : '—'],
      ['Admin clear only', week.rules.adminClearOnly ? 'yes (every payout needs your Clear)' : 'no'],
      ['Extension', `${Math.floor(s.extension / 3600)} h used, ${Math.floor(extensionRemaining(s.extension) / 3600)} h of the 72 h cap left`],
      ['Waiting for the admin', waiting],
      ['Winner', s.winner && s.winner !== ZERO ? `${shortAddress(s.winner)}, prize ${token ? tokenText(s.prize, token.decimals, token.symbol) : s.prize}` : 'none yet'],
    ]) weekRows.push(el(doc, 'dt', { text: term }), el(doc, 'dd', { text: value }));
  }
  const weekActions = [];
  if (week) {
    const s = week.state;
    const hours = el(doc, 'input', { type: 'number', min: '1', max: String(Math.floor(extensionRemaining(s.extension) / 3600)), value: '6', 'aria-label': 'Extension hours' });
    weekActions.push(
      button(doc, s.held ? 'Release week' : 'Hold week', () => controller.act(s.held ? 'release' : 'hold', { week: week.index, reason: 'investigation' }), { disabled: busy || !state.isAdmin }),
      el(doc, 'label', {}, ['Extend by (hours) ', hours]),
      button(doc, 'Extend week', () => controller.act('extend', { week: week.index, extraSeconds: Math.round(Number(hours.value) * 3600) }), { disabled: busy || !state.isAdmin }),
      button(doc, state.roles?.adminPaused ? 'Unpause payouts' : 'Pause payouts', () => controller.act(state.roles?.adminPaused ? 'unpause' : 'pause'), { disabled: busy || !state.isAdmin }),
      button(doc, 'Finalize', () => controller.act('finalize', { week: week.index }), { disabled: busy || !state.account || s.status !== 'open' || state.chainNow < week.bounds.payoutAt }),
    );
  }
  weekBox.replaceChildren(nav, el(doc, 'dl', {}, weekRows), el(doc, 'div', { className: 'jo-row' }, weekActions));

  // Candidates: the on-chain list merged with the review API's rows (listed, displaced, disqualified).
  const reviewRows = new Map((state.review?.candidates ?? []).map((row) => [row.sessionId, row]));
  const onChain = week?.candidates ?? [];
  const sessions = [...new Set([...onChain.map((row) => row.sessionId), ...reviewRows.keys()])];
  const rubricLink = () => el(doc, 'a', { href: '#jackpot-rubric', text: 'Rubric' });
  const cards = sessions.map((sessionId, index) => {
    const chain = onChain.find((row) => row.sessionId === sessionId) ?? null;
    const review = reviewRows.get(sessionId) ?? null;
    const wallet = chain?.player ?? review?.wallet;
    const flagReason = select(doc, REASON_CODES.flag, 'Flag reason');
    const dqReason = select(doc, REASON_CODES.disqualify, 'Disqualify reason');
    const wholeWallet = el(doc, 'input', { type: 'checkbox', 'aria-label': 'Also disqualify the wallet for the week' });
    const blockReason = select(doc, REASON_CODES.block, 'Block reason');
    const facts = [
      ['Rank', chain ? `#${index + 1} on chain` : review?.onChain ? `#${review.rank}` : `not listed (${review?.listing ?? 'displaced or disqualified'})`],
      ['Wallet', extLink(doc, explorerAddressUrl(wallet), wallet ?? '—')],
      ['Score', String(chain?.score ?? review?.score ?? '—')],
      ['Survival', review?.survivalSeconds !== null && review?.survivalSeconds !== undefined ? `${review.survivalSeconds} s` : '—'],
      ['Screen', review?.screen ?? 'sign in to read'],
      ['Hold codes', review ? codesList(doc, review.holdCodes, HOLD_CODE_TEXT) : '—'],
      ['Soft signals', review ? codesList(doc, review.softSignals, SOFT_SIGNAL_TEXT) : '—'],
      ['Evidence delay', review?.evidenceDelaySeconds !== null && review?.evidenceDelaySeconds !== undefined ? `${review.evidenceDelaySeconds} s` : '—'],
      ['Integrity', review ? integrityText(review.integrity) ?? 'not screened yet' : 'sign in to read'],
      ['Seed provenance', review?.seedProvenance ?? '—'],
      ['Review on chain', `${chain?.review ?? review?.review ?? 'none'}${(chain?.adminReviewed ?? review?.adminReviewed) ? ' · admin-reviewed' : ''}${chain?.blocked ? ' · wallet BLOCKED' : ''}`],
      ['Listed before', String(chain?.wasListed ?? review?.wasListed ?? false)],
      ['Keeper actions', review?.actions?.length ? el(doc, 'span', {}, review.actions.flatMap((item, at) => [at ? ' · ' : '', `${item.kind ?? 'action'} ${item.status ?? ''}${item.reason ? ` (${item.reason})` : ''} `, item.txHash ? extLink(doc, explorerTxUrl(item.txHash), 'tx') : ''])) : 'none'],
      ['Recent runs', review?.history?.length ? review.history.slice(0, 5).map((run) => `${run.score ?? '—'} pts, ${run.survivalSeconds ?? '—'} s, ${run.weekKey ?? '—'}`).join(' · ') : '—'],
    ];
    const media = [];
    if (review?.replay) {
      media.push(extLink(doc, `/chikun/index.html?replay=${encodeURIComponent(review.replay)}`, 'Watch in cabinet'));
      const download = el(doc, 'a', { href: review.replay, download: `chikun-replay-${sessionId.slice(2, 10)}.json`, text: ' · Download replay' });
      media.push(download);
    }
    const disabled = busy || !state.isAdmin;
    return el(doc, 'article', { className: 'jo-candidate' }, [
      el(doc, 'h3', { text: `Session ${sessionId.slice(0, 10)}…${sessionId.slice(-6)}` }),
      el(doc, 'dl', {}, facts.flatMap(([term, value]) => [el(doc, 'dt', { text: term }), el(doc, 'dd', {}, [value])])),
      review?.timeline ? renderTimeline(doc, review.timeline, { label: `Flap timeline of ${sessionId.slice(0, 10)}` }) : el(doc, 'p', { className: 'jo-note', text: review ? 'No timeline for this run.' : 'Sign in to see the flap timeline.' }),
      el(doc, 'p', { className: 'jo-row' }, media),
      el(doc, 'div', { className: 'jo-row' }, [
        button(doc, 'Clear', () => controller.act('clear', { sessionId }), { disabled }), rubricLink(),
        flagReason, button(doc, 'Flag', () => controller.act('flag', { sessionId, reason: flagReason.value }), { disabled }),
      ]),
      el(doc, 'div', { className: 'jo-row' }, [
        dqReason, el(doc, 'label', {}, [wholeWallet, ' whole wallet for the week']),
        button(doc, 'Disqualify', () => controller.act('disqualify', { sessionId, wholeWalletForWeek: wholeWallet.checked, reason: dqReason.value }), { disabled }), rubricLink(),
        button(doc, 'Reinstate', () => controller.act('reinstate', { sessionId }), { disabled }),
      ]),
      el(doc, 'div', { className: 'jo-row' }, [
        blockReason,
        button(doc, chain?.blocked ? 'Unblock wallet' : 'Block wallet', () => controller.act(chain?.blocked ? 'unblock' : 'block', { wallet, reason: blockReason.value }), { disabled: disabled || !wallet }),
      ]),
    ]);
  });
  byId('jo-candidates').replaceChildren(...(cards.length ? cards : [el(doc, 'p', { className: 'jo-note', text: week ? 'No candidates for this week yet.' : 'Connect a wallet to read the candidates.' })]));

  // Next eligible (review API), with Add to list while the list is short.
  const count = week?.state?.count ?? 0;
  const next = (state.review?.nextEligible ?? []).map((row) => el(doc, 'li', {}, [
    `${shortAddress(row.wallet)} · ${row.score ?? '—'} pts · screen ${row.screen} `,
    button(doc, 'Add to list', () => controller.act('adminSubmit', { sessionId: row.sessionId }), { disabled: busy || !state.isAdmin || count >= MAX_CANDIDATES }),
  ]));
  byId('jo-next').replaceChildren(...(next.length ? [el(doc, 'ol', {}, next), el(doc, 'p', { className: 'jo-note', text: count >= MAX_CANDIDATES ? `The list holds ${MAX_CANDIDATES} rows: Add to list opens when a row is disqualified.` : `The list holds ${count} of ${MAX_CANDIDATES} rows.` })] : [el(doc, 'p', { className: 'jo-note', text: state.review ? 'No other eligible sessions.' : 'Sign in to read the next eligible sessions.' })]));

  // Block or unblock any wallet.
  const blockWallet = el(doc, 'input', { type: 'text', placeholder: '0x…', 'aria-label': 'Wallet to block or unblock', autocomplete: 'off' });
  const blockWhy = select(doc, REASON_CODES.block, 'Block reason');
  byId('jo-block').replaceChildren(el(doc, 'div', { className: 'jo-row' }, [
    blockWallet, blockWhy,
    button(doc, 'Block', () => controller.act('block', { wallet: blockWallet.value.trim(), reason: blockWhy.value }), { disabled: busy || !state.isAdmin }),
    button(doc, 'Unblock', () => controller.act('unblock', { wallet: blockWallet.value.trim(), reason: blockWhy.value }), { disabled: busy || !state.isAdmin }),
  ]));

  // Fund (any wallet): exact approve, then fund, for the current week or up to 8 weeks ahead.
  const fundBox = byId('jo-fund');
  if (token && state.currentWeek !== null) {
    const weekInput = el(doc, 'input', { type: 'number', min: String(Math.max(state.currentWeek, state.firstWeek ?? 1)), max: String(state.currentWeek + 8), value: String(Math.max(state.currentWeek, state.firstWeek ?? 1)), 'aria-label': 'Week index to fund' });
    const amountInput = el(doc, 'input', { type: 'text', inputmode: 'decimal', value: '', placeholder: `amount in ${token.symbol}`, 'aria-label': `Amount in ${token.symbol}` });
    const fund = () => controller.act('fund', { week: Number(weekInput.value), amount: amountInput.value.trim() });
    fundBox.replaceChildren(
      ...(state.fundResult ? [el(doc, 'p', { text: `After your last fund: week ${isoWeekKeyOf(state.fundResult.week)} pot ${tokenText(state.fundResult.total, token.decimals, token.symbol)}, prize ${tokenText(state.fundResult.prize, token.decimals, token.symbol)}${state.fundResult.capped ? ' (capped; the rest rolls over)' : ''}.` })] : []),
      el(doc, 'p', { text: `Balance ${tokenText(token.balance, token.decimals, token.symbol)} · allowance to the jackpot ${tokenText(token.allowance, token.decimals, token.symbol)} · this week's minimum fund ${week ? tokenText(week.rules.minFundWei, token.decimals, token.symbol) : '—'}.` }),
      el(doc, 'p', { className: 'jo-note', text: `Fund only through this form (tokens sent to the contract directly count toward no week). The contract accepts the current week (${state.currentWeek}) to 8 weeks ahead; fund at most 2 weeks ahead, because the rules of a future week can still change before it starts. Approve is always the exact amount.` }),
      el(doc, 'div', { className: 'jo-row' }, [el(doc, 'label', {}, ['Week ', weekInput]), el(doc, 'label', {}, ['Amount ', amountInput]), button(doc, 'Approve and fund', fund, { disabled: busy || !state.account })]),
    );
  } else {
    fundBox.replaceChildren(el(doc, 'p', { className: 'jo-note', text: 'Connect a wallet to fund.' }));
  }

  // Refund after a scheduled end, and a winner's Claim.
  const refundBox = byId('jo-refund');
  refundBox.replaceChildren(...(state.endAfterWeek ? [
    el(doc, 'p', { text: `The jackpot ends after week ${state.endAfterWeek}. You funded ${token ? tokenText(state.fundedByMe, token.decimals, token.symbol) : '0'} into week ${state.selectedWeek}.` }),
    button(doc, 'Refund my contributions', () => controller.act('refund', { week: state.selectedWeek }), { disabled: busy || !state.account || BigInt(state.fundedByMe ?? 0n) === 0n }),
  ] : [el(doc, 'p', { className: 'jo-note', text: 'No end is scheduled; refunds open only for weeks after a scheduled end.' })]));
  const claimBox = byId('jo-claim');
  const won = week?.state;
  if (won && state.account && won.winner === state.account && BigInt(won.unclaimed) > 0n) {
    const to = el(doc, 'input', { type: 'text', value: state.accountRaw ?? state.account, 'aria-label': 'Send the prize to' });
    claimBox.replaceChildren(
      el(doc, 'p', { text: `You won week ${week.key}; ${tokenText(won.unclaimed, token.decimals, token.symbol)} is waiting because the transfer failed. A prize still unclaimed 180 days after the payout returns to the prize pool.` }),
      el(doc, 'div', { className: 'jo-row' }, [el(doc, 'label', {}, ['Send to ', to]), button(doc, 'Claim prize', () => controller.act('claim', { week: week.index, to: to.value.trim() }), { disabled: busy })]),
    );
  } else {
    claimBox.replaceChildren(el(doc, 'p', { className: 'jo-note', text: 'Nothing to claim for this account in this week.' }));
  }

  const rubric = byId('jackpot-rubric-list');
  if (rubric && !rubric.children.length) rubric.replaceChildren(...REVIEW_RUBRIC.map((line) => el(doc, 'li', { text: line })));
  const last = byId('jo-last-tx');
  last.replaceChildren(...(state.lastTx?.url ? [el(doc, 'span', { text: `Last transaction (${state.lastTx.action}): ` }), extLink(doc, state.lastTx.url, state.lastTx.hash)] : []));
}

export function mountJackpotOwnerPage(doc, win, options = {}) {
  let controller = null;
  controller = createJackpotOwnerController({ ethereum: win.ethereum ?? null, onChange: () => render(doc, controller), ...options });
  render(doc, controller);
  if (win.ethereum?.on) {
    const reset = () => { if (controller.state.phase !== 'no-wallet' && controller.state.phase !== 'idle') controller.connect(); };
    win.ethereum.on('accountsChanged', reset);
    win.ethereum.on('chainChanged', reset);
  }
  return controller;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById('jackpot-owner')) {
  mountJackpotOwnerPage(document, window);
}

export { decodeReason };
