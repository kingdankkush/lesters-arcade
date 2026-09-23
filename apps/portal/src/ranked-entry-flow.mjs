// Sign-in and Ranked-entry flow helpers (guide §3.1, §3.2; contract A17, A25,
// §7.6, §7.7). Pure: the wallet, fetch, clock and event target are injected,
// so main.js stays glue and every branch is unit-tested.

export const RANKED_ENTRY_EVENT = 'lesters:ranked-entry';
export const RANKED_SEED_ENDPOINT = '/api/ranked/seed';
export const RANKED_PAUSED_MESSAGE = 'Ranked is paused right now. Free Mode is open.';
// E3 rejects a ticket used more than 30 minutes after issue (A26); a ticket
// fetched when the modal opened is fetched again after 10 minutes.
export const SEED_TICKET_MAX_AGE_MS = 10 * 60 * 1000;

const LITEFORGE_CHAIN_ID = 4441;

function chainNumber(value) {
  try { return Number(BigInt(String(value))); } catch { return null; }
}

// Sign-in chain step: after accounts are granted, one explainer, then the
// switch (the add falls back inside requestNetwork on 4902). A refusal keeps
// the player signed in for Free play; the Ranked modal still offers the switch.
export async function ensureLiteForgeAtSignIn({ readChainId, explain, requestNetwork, chainId = LITEFORGE_CHAIN_ID } = {}) {
  let current = null;
  try { current = chainNumber(await readChainId()); } catch { current = null; }
  if (current === chainId) return Object.freeze({ onChain: true, explained: false, switched: false, declined: false, chainId: current });
  let proceed = false;
  try { proceed = Boolean(await explain()); } catch { proceed = false; }
  if (!proceed) return Object.freeze({ onChain: false, explained: true, switched: false, declined: true, chainId: current });
  let switched = false;
  try { switched = Boolean(await requestNetwork()); } catch { switched = false; }
  return Object.freeze({ onChain: switched, explained: true, switched, declined: !switched, chainId: switched ? chainId : current });
}

// E15 (A25): a server seed ticket for the pending Ranked session. Never
// prompts the wallet. 503 means Ranked is paused (or not configured) and the
// entry must stop before any payment; 401 means the token is dead.
export async function fetchSeedTicket({ fetchImpl = globalThis.fetch, token, session, now = () => Date.now(), endpoint = RANKED_SEED_ENDPOINT } = {}) {
  if (!session?.sessionId) return Object.freeze({ ok: false, status: 0, error: 'no-session' });
  if (!token) return Object.freeze({ ok: false, status: 401, error: 'invalid-session' });
  if (typeof fetchImpl !== 'function') return Object.freeze({ ok: false, status: 0, error: 'no-fetch' });
  const body = {
    gameId: session.canonicalContext?.gameId ?? session.gameId,
    sessionId: session.sessionId,
    seasonId: session.seasonId,
    buildHash: session.canonicalContext?.buildHash ?? session.buildHash,
  };
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    return Object.freeze({ ok: false, status: 0, error: 'network' });
  }
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (response.ok && payload?.ok && payload.seedTicket && Number.isSafeInteger(payload.seed)) {
    return Object.freeze({ ok: true, status: response.status, seed: payload.seed, seedTicket: payload.seedTicket, fetchedAt: now(), sessionId: session.sessionId });
  }
  return Object.freeze({ ok: false, status: response.status, error: payload?.error ?? `http-${response.status}` });
}

export function isRankedPaused(result) {
  return result?.status === 503 || result?.error === 'settlement-paused' || result?.error === 'settlement-not-configured';
}

export function seedTicketUsable(ticket, { sessionId, nowMs, maxAgeMs = SEED_TICKET_MAX_AGE_MS } = {}) {
  return Boolean(ticket?.ok && ticket.sessionId === sessionId && Number.isFinite(ticket.fetchedAt) && nowMs - ticket.fetchedAt <= maxAgeMs);
}

function dispatchEntry(eventTarget, detail) {
  try {
    const event = typeof globalThis.CustomEvent === 'function'
      ? new globalThis.CustomEvent(RANKED_ENTRY_EVENT, { detail })
      : Object.assign(new Event(RANKED_ENTRY_EVENT), { detail });
    eventTarget?.dispatchEvent?.(event);
  } catch { /* no event target */ }
}

// After sendRankedEntry broadcasts: record the receipt on the session exactly
// as contract §7.6 says, announce `broadcast`, and announce `confirmed` or
// `failed` when wait() settles. Returns the session.
export function recordEntryBroadcast(pendingSession, sent, { eventTarget = globalThis.window, gameId = null } = {}) {
  const sessionId = pendingSession.sessionId;
  const game = gameId ?? pendingSession.canonicalContext?.gameId ?? pendingSession.gameId ?? null;
  pendingSession.entryReceipt = { txHash: sent.txHash, sessionId32: sent.sessionId32, amountWei: String(sent.amountWei ?? '0'), status: 'pending' };
  pendingSession.entryConfirmed = Promise.resolve()
    .then(() => sent.wait())
    .catch(() => ({ status: 'failed', blockNumber: null }))
    .then((result) => {
      const status = result?.status === 'confirmed' ? 'confirmed' : 'failed';
      pendingSession.entryReceipt.status = status;
      dispatchEntry(eventTarget, { sessionId, gameId: game, status, txHash: sent.txHash });
      return status;
    });
  dispatchEntry(eventTarget, { sessionId, gameId: game, status: 'broadcast', txHash: sent.txHash });
  return pendingSession;
}

const WEI_PER_ZKLTC = 1_000_000_000_000_000_000n;

// zkLTC with 4 decimals, rounded down for balances and up for amounts owed.
export function formatZkLtc4(wei, { roundUp = false } = {}) {
  let value;
  try { value = BigInt(String(wei ?? 0)); } catch { value = 0n; }
  if (value < 0n) value = 0n;
  const unit = WEI_PER_ZKLTC / 10_000n;
  const units = roundUp ? (value + unit - 1n) / unit : value / unit;
  return `${units / 10_000n}.${(units % 10_000n).toString().padStart(4, '0')}`;
}
