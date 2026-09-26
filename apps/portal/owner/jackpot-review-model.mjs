// Owner review and funding page model (Chikun Weekly Jackpot design §D.5): pure, no DOM, no network, no
// wallet. `ethers` is passed in: the page passes the vendored /vendor/ethers.min.js, the tests and the
// jackpot-rehearsal slice's admin, funder and claim helpers pass the npm package. Everything here reads or
// encodes; nothing signs or sends.
//
// It covers: the WeeklyJackpot and ERC-20 fragments (tests/owner-jackpot-page.test.mjs checks each one
// against contracts/artifacts), call encoding for every page action, the role each action needs (authority
// is on chain: the page only mirrors admin()), reason codes (design §A.8), hold-code and soft-signal text
// (design §B.4), week math (design §A.2), the fund plan (exact approve, at most 8 weeks ahead, the
// "fund at most 2 weeks ahead" advice, the week's minFundWei), the review payload of GET
// /api/jackpot/review (design §C.6), and the flap-timeline SVG geometry drawn from the server's `timeline`
// (the page never loads the Chikun runtime, which cannot load unbundled).

export const JACKPOT_FRAGMENTS = Object.freeze([
  // Views
  'function admin() view returns (address)',
  'function keeper() view returns (address)',
  'function operator() view returns (address)',
  'function paused() view returns (bool)',
  'function adminPaused() view returns (bool)',
  'function operatorPaused() view returns (bool)',
  'function currentWeek() view returns (uint64)',
  'function firstWeek() view returns (uint64)',
  'function endAfterWeek() view returns (uint64)',
  'function token() view returns (address)',
  'function weekBounds(uint64 week) view returns (uint64 start, uint64 close, uint64 settleCutoff, uint64 candidateUntil, uint64 payoutAt)',
  'function potOf(uint64 week) view returns (uint256 funded, uint256 carriedIn, uint256 total)',
  'function weekState(uint64 week) view returns (uint8 status, bool held, uint8 count, address winner, bytes32 winningSession, uint256 prize, uint256 unclaimed, uint64 finalizedAt, uint32 extension)',
  'function candidatesOf(uint64 week) view returns ((bytes32 sessionId, address player, uint64 submittedAt, uint64 score)[] list)',
  'function leaderOf(uint64 week) view returns (bytes32 sessionId, address player, uint256 score, uint8 review)',
  'function rulesFor(uint64 week) view returns ((uint64 fromWeek, uint64 maxSurvivalSeconds, bool adminClearOnly, uint128 minPaidWei, uint128 maxPrizeWei, uint128 minFundWei, uint256 maxScore, bytes32 seasonId, bytes32 altSeasonId))',
  'function checkEligibility(bytes32 sessionId) view returns (bool ok, uint64 week, string reason)',
  'function reviewOf(bytes32) view returns (uint8)',
  'function adminReviewed(bytes32) view returns (bool)',
  'function wasListed(bytes32) view returns (bool)',
  'function blocked(address) view returns (bool)',
  'function fundedBy(uint64, address) view returns (uint256)',
  // Admin writes
  'function clear(bytes32 sessionId)',
  'function flag(bytes32 sessionId, bytes32 reason)',
  'function disqualify(bytes32 sessionId, bool wholeWalletForWeek, bytes32 reason)',
  'function reinstate(bytes32 sessionId)',
  'function adminSubmit(bytes32 sessionId)',
  'function setBlocked(address wallet, bool isBlocked, bytes32 reason)',
  'function holdWeek(uint64 week, bytes32 reason)',
  'function releaseWeek(uint64 week)',
  'function extendWeek(uint64 week, uint32 extraSeconds)',
  'function pause()',
  'function unpause()',
  // Anyone, a funder, or the winner
  'function finalize(uint64 week)',
  'function fund(uint64 week, uint256 amount)',
  'function refundAfterEnd(uint64 week)',
  'function claim(uint64 week, address to)',
]);

export const ERC20_FRAGMENTS = Object.freeze([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
]);

// Design §A.2 and §A.8 constants.
export const WEEK_SECONDS = 7 * 24 * 3600;
export const WEEK_SHIFT_SECONDS = 3 * 24 * 3600;
export const MAX_EXTENSION_SECONDS = 72 * 3600;
export const MAX_CANDIDATES = 5;
export const MAX_FUND_AHEAD_WEEKS = 8;
export const ADVISED_FUND_AHEAD_WEEKS = 2;
export const REVIEW_STATES = Object.freeze(['none', 'cleared', 'flagged', 'disqualified']);
export const WEEK_STATUSES = Object.freeze(['open', 'paid', 'rolled-over']);

// Public, coarse reason codes (design §A.8).
export const REASON_CODES = Object.freeze({
  flag: Object.freeze(['screen-hold', 'integrity', 'excluded-wallet', 'late-evidence']),
  disqualify: Object.freeze(['automation', 'integrity', 'rules', 'excluded-wallet', 'multi-wallet', 'other']),
  block: Object.freeze(['staff', 'test-wallet', 'funder', 'cheating', 'other']),
  hold: Object.freeze(['investigation']),
});

// Who may send each action. Authority is on chain; this only decides which buttons the page enables.
export const JACKPOT_ACTIONS = Object.freeze({
  clear: Object.freeze({ method: 'clear', role: 'admin', label: 'Clear' }),
  flag: Object.freeze({ method: 'flag', role: 'admin', label: 'Flag' }),
  disqualify: Object.freeze({ method: 'disqualify', role: 'admin', label: 'Disqualify' }),
  reinstate: Object.freeze({ method: 'reinstate', role: 'admin', label: 'Reinstate' }),
  adminSubmit: Object.freeze({ method: 'adminSubmit', role: 'admin', label: 'Add to list' }),
  block: Object.freeze({ method: 'setBlocked', role: 'admin', label: 'Block' }),
  unblock: Object.freeze({ method: 'setBlocked', role: 'admin', label: 'Unblock' }),
  hold: Object.freeze({ method: 'holdWeek', role: 'admin', label: 'Hold week' }),
  release: Object.freeze({ method: 'releaseWeek', role: 'admin', label: 'Release week' }),
  extend: Object.freeze({ method: 'extendWeek', role: 'admin', label: 'Extend week' }),
  pause: Object.freeze({ method: 'pause', role: 'admin', label: 'Pause payouts' }),
  unpause: Object.freeze({ method: 'unpause', role: 'admin', label: 'Unpause payouts' }),
  finalize: Object.freeze({ method: 'finalize', role: 'anyone', label: 'Finalize' }),
  approve: Object.freeze({ method: 'approve', role: 'anyone', label: 'Approve exact amount', token: true }),
  fund: Object.freeze({ method: 'fund', role: 'anyone', label: 'Fund' }),
  refund: Object.freeze({ method: 'refundAfterEnd', role: 'funder', label: 'Refund my contributions' }),
  claim: Object.freeze({ method: 'claim', role: 'winner', label: 'Claim prize' }),
});

// Design §B.4 hold rules and soft signals, in plain words (the thresholds live on the server).
export const HOLD_CODE_TEXT = Object.freeze({
  H1: 'The run reached the time limit or the flap limit, which no player model or stock human play reaches.',
  H2: 'The survival time is far beyond the human envelope.',
  H3: 'The score is far beyond the human envelope.',
  H4: 'Many 1-2 tick flap pairs (naive scripts only; never grounds to disqualify on its own).',
  H5: 'Very regular flap timing (a repeated interval, long runs of equal intervals, or low entropy).',
  H6: 'A very high flap rate over several minutes.',
  H7: 'Integrity failure: missing evidence, a replay or chain mismatch, a non-stock client (maxTicks) or a seed-ticket MAC or seed mismatch.',
  H8: 'The wallet is excluded from the boards.',
  H9: 'Late evidence: the run reached the server long after it could have ended (a long pause, or play after the close).',
  H10: 'No seed-ticket log row for this session.',
  H11: 'Route commitments before obstacles were visible (look-ahead), for real-value or admin-clear-only weeks.',
});
export const SOFT_SIGNAL_TEXT = Object.freeze({
  S1: "The wallet's first Ranked run is less than 7 days old.",
  S2: "The best score is more than 1.5 times the wallet's previous best.",
  S3: 'More than 40 settled Chikun Ranked runs this week.',
  S4: 'The flap rate is outside 35-75 per minute.',
  S5: 'Many consecutive intervals within one tick of each other.',
  S6: 'Many near misses per minute.',
  S7: 'The wallet was flagged or disqualified before.',
  S8: 'Unexplained descents: route commitments before the obstacle was visible.',
  S9: 'Evidence arrived 5 to 20 minutes after the run could have ended.',
  S10: 'Another candidate or flagged wallet got its first zkLTC from the same address.',
  S11: 'Many seed tickets per settled Ranked run this week (seed shopping).',
});

// The review rubric (design §E), shown on the page next to Clear and Disqualify.
export const REVIEW_RUBRIC = Object.freeze([
  'Always check: integrity results (replay, chain, maxTicks, seed provenance); every hold code; the look-ahead overlay and S8; the evidence delay (H9/S9); the wallet history and previous flags; the cross-wallet funding result (S10); other candidate wallets with similar timing.',
  'Clear only when integrity passes and every hold is explained by the evidence (a long run by a player with a history of long runs, fast pairs that never changed the trajectory, a documented pause).',
  'Disqualify when integrity fails, when the look-ahead overlay shows route commitments before obstacles were visible on more than one obstacle, or when several wallets are shown to belong to one person (multi-wallet, all of them).',
  'Never disqualify on H4 alone, on one soft signal alone, or on a gut feeling about a score.',
  'Videos and "proof" recordings are never evidence: the replay renders exactly, so anyone can record one. Live verification, if wanted, is a fresh Ranked run on a new seed under observation.',
  'Record the reason code on chain and a one-line note in the ops log. Against listed decoys, disqualify with the whole wallet for the week first (it frees the slots), then block.',
]);

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SESSION = /^0x[0-9a-fA-F]{64}$/;
const lower = (value) => String(value ?? '').toLowerCase();

// ---------------------------------------------------------------------------------------------------
// Week math (design §A.2).

export function weekStartOf(index) {
  return Number(index) * WEEK_SECONDS - WEEK_SHIFT_SECONDS;
}
export function weekIndexOf(seconds) {
  return Math.floor((Number(seconds) + WEEK_SHIFT_SECONDS) / WEEK_SECONDS);
}
export function isoWeekKeyOf(index) {
  const date = new Date(weekStartOf(index) * 1000);
  const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3);
  const year = new Date(thursday).getUTCFullYear();
  return `${year}-W${String(Math.floor((thursday - Date.UTC(year, 0, 1)) / (WEEK_SECONDS * 1000)) + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------------
// Encoding.

const interfaces = new WeakMap();
function iface(ethers, fragments) {
  let cache = interfaces.get(ethers);
  if (!cache) interfaces.set(ethers, (cache = new Map()));
  if (!cache.has(fragments)) cache.set(fragments, new ethers.Interface(fragments));
  return cache.get(fragments);
}
export const jackpotInterface = (ethers) => iface(ethers, JACKPOT_FRAGMENTS);
export const tokenInterface = (ethers) => iface(ethers, ERC20_FRAGMENTS);

export function reasonBytes32(ethers, code, kind) {
  if (kind && !REASON_CODES[kind]?.includes(code)) throw new Error(`Unknown ${kind} reason: ${code}`);
  return ethers.encodeBytes32String(String(code));
}
export function decodeReason(ethers, bytes32) {
  try { return ethers.decodeBytes32String(bytes32); } catch { return null; }
}

// { to, data } for one page action. `params` names follow JACKPOT_ACTIONS; the token address is the
// week's prize token for `approve`.
export function encodeJackpotCall(ethers, action, params = {}, { jackpot, token = null } = {}) {
  const spec = JACKPOT_ACTIONS[action];
  if (!spec) throw new Error(`Unknown jackpot action: ${action}`);
  if (!ADDRESS.test(String(jackpot ?? ''))) throw new Error('The jackpot contract address is missing.');
  const session = () => {
    if (!SESSION.test(String(params.sessionId ?? ''))) throw new Error('A session id is 0x followed by 64 hex characters.');
    return params.sessionId;
  };
  const week = () => {
    const value = Number(params.week);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Choose a week.');
    return value;
  };
  const address = (value, label) => {
    if (!ADDRESS.test(String(value ?? ''))) throw new Error(`${label} must be an address.`);
    return value;
  };
  const amount = () => {
    const value = BigInt(params.amountWei ?? 0);
    if (value <= 0n) throw new Error('Enter an amount above zero.');
    return value;
  };
  const args = {
    clear: () => [session()],
    flag: () => [session(), reasonBytes32(ethers, params.reason, 'flag')],
    disqualify: () => [session(), Boolean(params.wholeWalletForWeek), reasonBytes32(ethers, params.reason, 'disqualify')],
    reinstate: () => [session()],
    adminSubmit: () => [session()],
    block: () => [address(params.wallet, 'The wallet'), true, reasonBytes32(ethers, params.reason, 'block')],
    unblock: () => [address(params.wallet, 'The wallet'), false, reasonBytes32(ethers, params.reason ?? 'other', 'block')],
    hold: () => [week(), reasonBytes32(ethers, params.reason ?? 'investigation', 'hold')],
    release: () => [week()],
    extend: () => {
      const seconds = Number(params.extraSeconds);
      if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > MAX_EXTENSION_SECONDS) throw new Error('An extension is 1 second to 72 hours.');
      return [week(), seconds];
    },
    pause: () => [],
    unpause: () => [],
    finalize: () => [week()],
    approve: () => [address(jackpot, 'The jackpot'), amount()],
    fund: () => [week(), amount()],
    refund: () => [week()],
    claim: () => [week(), address(params.to, 'The address')],
  }[action]();
  if (spec.token) {
    return { to: lower(address(token, 'The token')), data: tokenInterface(ethers).encodeFunctionData(spec.method, args) };
  }
  return { to: lower(jackpot), data: jackpotInterface(ethers).encodeFunctionData(spec.method, args) };
}

// Whether the connected account may send an action (the chain has the last word either way).
export function actionAllowed(action, { account, admin, winner = null, fundedWei = 0n } = {}) {
  const role = JACKPOT_ACTIONS[action]?.role;
  const me = lower(account);
  if (!ADDRESS.test(me)) return false;
  if (role === 'anyone') return true;
  if (role === 'admin') return me === lower(admin);
  if (role === 'winner') return me === lower(winner);
  if (role === 'funder') return BigInt(fundedWei ?? 0) > 0n;
  return false;
}

export function extensionRemaining(extensionSeconds) {
  return Math.max(0, MAX_EXTENSION_SECONDS - Number(extensionSeconds ?? 0));
}

// The fund plan for `amountWei` into `week`: exact approve (never unlimited), <= 8 weeks ahead, the
// week's minFundWei, and the advice to fund at most 2 weeks ahead (future rules can still change).
export function fundPlan({ week, currentWeek, firstWeek = 1, endAfterWeek = 0, amountWei, minFundWei, balanceWei, allowanceWei }) {
  const target = Number(week);
  const now = Number(currentWeek);
  let amount;
  try { amount = BigInt(amountWei ?? 0); } catch { amount = 0n; }
  const problems = [];
  if (!Number.isSafeInteger(target) || target < Math.max(Number(firstWeek), now)) problems.push('Fund the current week or a later one.');
  if (target > now + MAX_FUND_AHEAD_WEEKS) problems.push(`The contract accepts at most ${MAX_FUND_AHEAD_WEEKS} weeks ahead.`);
  if (Number(endAfterWeek) > 0 && target > Number(endAfterWeek)) problems.push('The jackpot ends before that week.');
  if (amount < BigInt(minFundWei ?? 0)) problems.push("The amount is below the week's minimum fund.");
  if (amount > BigInt(balanceWei ?? 0)) problems.push('The wallet holds less than that.');
  return Object.freeze({
    ok: problems.length === 0,
    problems: Object.freeze(problems),
    amountWei: amount,
    needsApprove: BigInt(allowanceWei ?? 0) < amount,
    approveWei: amount, // exactly the amount, never unlimited
    advice: target > now + ADVISED_FUND_AHEAD_WEEKS ? 'Fund at most 2 weeks ahead: the rules of a future week can still change before it starts.' : null,
  });
}

// ---------------------------------------------------------------------------------------------------
// GET /api/jackpot/review (design §C.6). Lenient on extra fields, strict on the ones the page renders.
// Field names follow the jackpot-server review model (server/jackpot/review-model.mjs): sessionId32,
// chainRank, listing, soft ({ S4: { value, on }, ... }), provenance ({ status }), features
// (evidenceDelaySeconds, survivalSeconds), recentRuns, and the timeline of reviewTimeline() (firstFlapTick
// + intervals, obstacles with an 'unexplained' look-ahead verdict). The design-document spellings
// (sessionId, rank, softSignals, seedProvenance, history, flapTicks) are read as fallbacks.

const text = (value, max = 200) => (typeof value === 'string' ? value.slice(0, max) : null);
const int = (value) => (Number.isSafeInteger(value) ? value : null);
const finite = (...values) => values.find((value) => Number.isFinite(value)) ?? null;
const REPLAY_PATH = /^\/api\/jackpot\/replay\?session=0x[0-9a-f]{64}$/;

function normalizeTimeline(value) {
  if (!value || typeof value !== 'object') return null;
  const numbers = (list) => (Array.isArray(list) ? list.filter((item) => Number.isFinite(item)) : []);
  let flapTicks = numbers(value.flapTicks);
  if (!flapTicks.length && Number.isFinite(value.firstFlapTick)) {
    // reviewTimeline(): the first flap tick, then the interval to each next flap.
    let tick = value.firstFlapTick;
    flapTicks = [tick];
    for (const interval of numbers(value.intervals)) flapTicks.push((tick += interval));
  }
  return Object.freeze({
    survivalTicks: int(value.survivalTicks) ?? 0,
    sampleEveryTicks: int(value.sampleEveryTicks) ?? 6,
    altitude: Object.freeze(numbers(value.altitude)),
    flapTicks: Object.freeze(flapTicks),
    fastPairs: Object.freeze((Array.isArray(value.fastPairs) ? value.fastPairs : []).filter((pair) => Number.isFinite(pair?.tick)).map((pair) => Object.freeze({ tick: pair.tick, gap: int(pair.gap), changedTrajectory: pair.changedTrajectory === true }))),
    obstacles: Object.freeze((Array.isArray(value.obstacles) ? value.obstacles : []).filter((row) => Number.isFinite(row?.visibleTick)).map((row) => {
      const commitTick = Number.isFinite(row.commitTick) ? row.commitTick : null;
      return Object.freeze({
        index: int(row.index),
        kind: text(row.kind, 24),
        visibleTick: row.visibleTick,
        commitTick,
        passTick: Number.isFinite(row.passTick) ? row.passTick : null,
        // Only the server's verdict (S8, an unexplained descent) marks a look-ahead. The commit tick is
        // the last flap before the pass (reviewTimeline), so an honest run that passes under or glides
        // past an obstacle without a new flap after it came into view also has commitTick < visibleTick:
        // that is drawn as neutral data, never as a look-ahead.
        lookAhead: row.unexplained === true || row.lookAhead === true,
      });
    })),
    viewEdge: int(value.viewEdge) ?? 1280,
  });
}

// Hold codes: [{ code, text }] or ['H2']. Soft signals: the server's { S9: { value, on } } object (only
// the signals that are on), or a list like the hold codes.
function codeList(list) {
  return Object.freeze((Array.isArray(list) ? list : []).map((item) => (typeof item === 'string' ? { code: item } : item)).filter((item) => /^[HS]\d{1,2}$/.test(String(item?.code ?? ''))).map((item) => Object.freeze({
    code: item.code,
    text: text(item.text) ?? (HOLD_CODE_TEXT[item.code] ?? SOFT_SIGNAL_TEXT[item.code] ?? ''),
    value: ['number', 'string', 'boolean'].includes(typeof item.value) ? item.value : null,
  })));
}
function softList(row) {
  if (Array.isArray(row.softSignals)) return codeList(row.softSignals);
  const soft = row.soft && typeof row.soft === 'object' ? row.soft : {};
  return codeList(Object.entries(soft).filter(([, signal]) => signal && typeof signal === 'object' && signal.on === true).map(([code, signal]) => ({ code, value: signal.value })));
}
function reviewState(value) {
  if (REVIEW_STATES.includes(value)) return value;
  const index = Number(value);
  return Number.isInteger(index) && REVIEW_STATES[index] ? REVIEW_STATES[index] : 'none';
}

function normalizeCandidate(row) {
  const sessionId = lower(row?.sessionId32 ?? row?.sessionId);
  if (!row || !SESSION.test(sessionId) || !ADDRESS.test(String(row.wallet ?? ''))) return null;
  const features = row.features && typeof row.features === 'object' ? row.features : null;
  const provenance = typeof row.seedProvenance === 'string' ? row.seedProvenance : row.provenance?.status;
  const replay = REPLAY_PATH.test(String(row.replay ?? '')) ? row.replay : '/api/jackpot/replay?session=' + sessionId;
  return Object.freeze({
    sessionId,
    wallet: lower(row.wallet),
    displayName: text(row.displayName, 64),
    score: int(row.score),
    survivalSeconds: finite(row.survivalSeconds, features?.survivalSeconds),
    rank: int(row.rank ?? row.chainRank),
    listing: text(row.listing, 16),
    onChain: row.onChain === true,
    wasListed: row.wasListed === true,
    review: reviewState(row.review),
    reviewReason: text(row.reviewReason, 32),
    adminReviewed: row.adminReviewed === true,
    source: text(row.source, 16),
    screen: text(row.screen, 16) ?? 'pending',
    holdCodes: codeList(row.holdCodes),
    softSignals: softList(row),
    evidenceDelaySeconds: finite(row.evidenceDelaySeconds, features?.evidenceDelaySeconds, row.soft?.S9?.value),
    seedProvenance: text(provenance, 32),
    integrity: row.integrity && typeof row.integrity === 'object' ? row.integrity : null,
    features,
    actions: Object.freeze(Array.isArray(row.actions) ? row.actions.filter((action) => action && typeof action === 'object') : []),
    history: Object.freeze((Array.isArray(row.recentRuns) ? row.recentRuns : Array.isArray(row.history) ? row.history : []).slice(0, 20)),
    replay,
    timeline: normalizeTimeline(row.timeline),
  });
}

export function normalizeReview(json) {
  if (!json || json.ok !== true) return null;
  const candidates = (Array.isArray(json.candidates) ? json.candidates : []).map(normalizeCandidate).filter(Boolean);
  const nextEligible = (Array.isArray(json.nextEligible) ? json.nextEligible : []).slice(0, 10).map((row) => {
    const sessionId = lower(row?.sessionId32 ?? row?.sessionId);
    return row && SESSION.test(sessionId) && ADDRESS.test(String(row.wallet ?? ''))
      ? Object.freeze({ sessionId, wallet: lower(row.wallet), score: int(row.score), screen: text(row.screen, 16) ?? 'pending' })
      : null;
  }).filter(Boolean);
  return Object.freeze({ weekKey: text(json.weekKey, 8), week: json.week && typeof json.week === 'object' ? json.week : null, candidates: Object.freeze(candidates), nextEligible: Object.freeze(nextEligible) });
}

// The screen's integrity result (design §C.6: replay, chain, maxTicks, seed ticket) in plain words, or
// null before the run is screened. The server sends { ok, code, detail?, chain? } (server/jackpot/screen).
const INTEGRITY_TEXT = Object.freeze({
  'evidence-missing': 'the recorded evidence is missing',
  'replay-mismatch': 'the server replay does not match the recorded result',
  'chain-mismatch': 'the on-chain record does not match the run',
  'non-stock-client': 'the run came from a non-stock client (maxTicks)',
  'ticket-invalid': 'the seed ticket is invalid (MAC or seed mismatch)',
});
export function integrityText(integrity) {
  if (!integrity || typeof integrity !== 'object' || typeof integrity.ok !== 'boolean') return null;
  if (integrity.ok) return 'passed: the server replay, the on-chain record, the stock client (maxTicks) and the seed ticket agree';
  const code = text(integrity.code, 32);
  const detail = text(integrity.detail, 60);
  return `FAILED (H7): ${INTEGRITY_TEXT[code] ?? code ?? 'unknown failure'}${detail ? ` (${detail})` : ''}`;
}

// ---------------------------------------------------------------------------------------------------
// The flap timeline (design §D.5): x is the run's tick, y the altitude (0 at the top of the 720 px
// world). Obstacles show the tick each became visible at the stock view edge and the tick Chikun
// committed to its route (the last flap before the pass, neutral data); the look-ahead overlay marks
// only the server's unexplained descents (S8). Fast pairs are marked by whether they changed the
// trajectory.
export function timelineGeometry(timeline, { width = 720, height = 180, worldHeight = 720 } = {}) {
  const t = normalizeTimeline(timeline);
  if (!t || t.survivalTicks <= 0) return null;
  const x = (tick) => Math.round((Math.max(0, Math.min(t.survivalTicks, tick)) / t.survivalTicks) * width * 10) / 10;
  const y = (altitude) => Math.round((Math.max(0, Math.min(worldHeight, altitude)) / worldHeight) * height * 10) / 10;
  const altitude = t.altitude.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index * t.sampleEveryTicks)} ${y(value)}`).join(' ');
  return Object.freeze({
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    altitude,
    flaps: Object.freeze(t.flapTicks.map((tick) => x(tick))),
    fastPairs: Object.freeze(t.fastPairs.map((pair) => Object.freeze({ x: x(pair.tick), changed: pair.changedTrajectory }))),
    obstacles: Object.freeze(t.obstacles.map((row) => Object.freeze({
      kind: row.kind,
      visibleX: x(row.visibleTick),
      commitX: row.commitTick === null ? null : x(row.commitTick),
      passX: row.passTick === null ? null : x(row.passTick),
      lookAhead: row.lookAhead,
    }))),
    lookAheadCount: t.obstacles.filter((row) => row.lookAhead).length,
  });
}
