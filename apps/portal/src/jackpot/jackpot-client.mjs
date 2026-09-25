// Chikun's Escape Weekly Jackpot: the client every lazy jackpot surface shares (design §C.5, §D.1, §D.2).
//
// Pure: no DOM, and no window or process at import time. fetch and the clocks are injected. Every
// surface reads GET /api/jackpot through fetchJackpot() and shows only what the honesty rules of
// design §D.1 allow:
//   - an amount appears only when `live === true` and `current.pot.funded === true` (the pot reached
//     the week's minFundWei), and it is `current.pot.prizeWei`, what the winner can actually receive;
//   - every amount carries the token symbol of its own week, and the first mention on a surface adds
//     "(testnet token, no value)" while that token is a testnet token;
//   - the open week's leader is a score only, and always "(provisional)";
//   - a failed, late (4 s) or malformed answer shows nothing: parseJackpot() returns null for anything
//     that deviates from the design §C.5 rev. 2 shape;
//   - amounts are formatted with BigInt only, never floats.
// The API is CDN-cached (s-maxage 30, stale-while-revalidate 120), so an answer can be about 150 s old.
// serverClock() corrects the viewer's clock from serverTime and the Age header, and phaseOf() decides
// that a week closed from closesAt on that clock, never from the cached status.

export const JACKPOT_API_PATH = '/api/jackpot';
// JACKPOT_RULES_PATH of jackpot-config.mjs as a literal (tests pin them equal): the lazy chunks do not
// import jackpot-config.mjs, so it never becomes a shared chunk the portal entry and the Chikun child load.
export const JACKPOT_RULES_URL = '/jackpot/chikun';
export const JACKPOT_FETCH_TIMEOUT_MS = 4_000;
export const JACKPOT_MEMO_MS = 30_000;
export const CLOCK_SKEW_THRESHOLD_MS = 5_000;
export const JACKPOT_CHAIN_ID = 4441;
export const JACKPOT_EXPLORER = 'https://liteforge.explorer.caldera.xyz';
export const TESTNET_TOKEN_NOTE = '(testnet token, no value)';
// Design §C.5: the replay link of a candidate or a winner, same origin only.
export const JACKPOT_REPLAY_PATH = /^\/api\/jackpot\/replay\?session=0x[0-9a-f]{64}$/;

const WEEK_MS = 7 * 86_400_000;
const WEEK_SHIFT_MS = 3 * 86_400_000;
const MAX_SCORE = 10_000_000_000;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const WEI = /^[0-9]{1,78}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const WEEK_KEY = /^\d{4}-W\d{2}$/;
const SYMBOL = /^[A-Za-z0-9$]{1,16}$/;
const WALLET_SHORT = /^0x[0-9a-f]{4}…[0-9a-f]{4}$/;
const REASON = /^[a-z][a-z0-9-]{0,31}$/;
const WEEK_STATUSES = new Set(['open', 'closed', 'selecting', 'review', 'awaiting-admin', 'finalizing', 'paid', 'claim-pending', 'rolled', 'unfunded', 'failed']);
const PUBLIC_STATUSES = new Set(['open', 'review', 'awaiting-admin', 'paid', 'claim-pending', 'rolled', 'unfunded']);
const PUBLIC_REVIEWS = new Set(['cleared', 'in-review', 'disqualified']);

// ---------------------------------------------------------------------------------------------------
// Week math (design §A.2): Monday 00:00 UTC boundaries, ISO week keys, contract week indexes.

// The ISO week key ('2026-W40') of a UTC instant.
export function isoWeekKey(ms) {
  const date = new Date(ms);
  const day = date.getUTCDay() || 7;
  const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 4 - day);
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / WEEK_MS) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Monday 00:00 UTC (ms) of an ISO week key, or null for a key that does not round-trip.
export function weekStartOfKey(key) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(key ?? ''));
  if (!match) return null;
  const jan4 = Date.UTC(Number(match[1]), 0, 4);
  const monday = jan4 - ((new Date(jan4).getUTCDay() || 7) - 1) * 86_400_000 + (Number(match[2]) - 1) * WEEK_MS;
  return isoWeekKey(monday) === key ? monday : null;
}

// Contract week index of a UTC instant: weekOf(ts) = (ts + 3 days) / 1 week.
export function weekIndexOfMs(ms) {
  return Math.floor((ms + WEEK_SHIFT_MS) / WEEK_MS);
}

// ---------------------------------------------------------------------------------------------------
// parseJackpot: the design §C.5 rev. 2 shape, strictly. Unknown keys, wrong types, inconsistent pot
// arithmetic, a named open-week leader or a mismatched week all return null.

const BAD = Symbol('bad jackpot answer');
function check(condition) {
  if (!condition) throw BAD;
}
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function shape(value, required, optional = []) {
  check(isObject(value));
  for (const key of required) check(Object.hasOwn(value, key));
  for (const key of Object.keys(value)) check(required.includes(key) || optional.includes(key));
  return value;
}
const iso = (value) => check(typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value)));
const wei = (value) => check(typeof value === 'string' && WEI.test(value));
const weiOrNull = (value) => value === null || wei(value);
const int = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => check(Number.isSafeInteger(value) && value >= min && value <= max);
const hashOrNull = (value) => check(value === null || (typeof value === 'string' && TX_HASH.test(value)));
const replayOrNull = (value) => check(value === null || (typeof value === 'string' && JACKPOT_REPLAY_PATH.test(value)));
const name = (value) => check(value === null || (typeof value === 'string' && value.length > 0 && value.length <= 64));

function weekToken(value, { withAddress = false } = {}) {
  shape(value, withAddress ? ['address', 'symbol', 'decimals', 'testnet'] : ['symbol', 'decimals', 'testnet']);
  if (withAddress) check(typeof value.address === 'string' && ADDRESS.test(value.address));
  check(typeof value.symbol === 'string' && SYMBOL.test(value.symbol));
  int(value.decimals, 0, 36);
  check(typeof value.testnet === 'boolean');
}

// Design §C.5 "Pot fields (rev. 2)": prizeWei = min(total, cap) (or total without a cap), carryOverWei
// = total - prize, funded = total >= the week's minFundWei.
function pot(value, minFundWei = null) {
  shape(value, ['fundedWei', 'carriedInWei', 'totalWei', 'prizeCapWei', 'prizeWei', 'carryOverWei', 'funded']);
  for (const key of ['fundedWei', 'carriedInWei', 'totalWei', 'prizeWei', 'carryOverWei']) wei(value[key]);
  weiOrNull(value.prizeCapWei);
  check(typeof value.funded === 'boolean');
  const total = BigInt(value.totalWei);
  check(BigInt(value.fundedWei) + BigInt(value.carriedInWei) === total);
  const cap = value.prizeCapWei === null ? null : BigInt(value.prizeCapWei);
  const prize = cap !== null && cap < total ? cap : total;
  check(BigInt(value.prizeWei) === prize && BigInt(value.carryOverWei) === total - prize);
  if (minFundWei !== null) check(value.funded === total >= BigInt(minFundWei));
}

function winner(value) {
  if (value === null) return;
  shape(value, ['walletShort', 'wallet', 'displayName']);
  check(typeof value.walletShort === 'string' && WALLET_SHORT.test(value.walletShort));
  check(typeof value.wallet === 'string' && ADDRESS.test(value.wallet));
  name(value.displayName);
}

// A winner exactly for a paid (or claim-pending) week with a prize; claim-pending owes the prize.
function outcome(value) {
  check(PUBLIC_STATUSES.has(value.status));
  winner(value.winner);
  weiOrNull(value.prizeWei);
  wei(value.unclaimedWei);
  hashOrNull(value.finalizeTx);
  const won = value.status === 'paid' || value.status === 'claim-pending';
  check(won === (value.winner !== null));
  if (won) check(value.prizeWei !== null && BigInt(value.prizeWei) > 0n);
  check((value.status === 'claim-pending') === (BigInt(value.unclaimedWei) > 0n));
}

function candidate(value) {
  shape(value, ['rank', 'walletShort', 'displayName', 'score', 'review', 'replay'], ['reason']);
  check(value.rank === null || (Number.isSafeInteger(value.rank) && value.rank >= 1 && value.rank <= 5));
  check(typeof value.walletShort === 'string' && WALLET_SHORT.test(value.walletShort));
  name(value.displayName);
  int(value.score, 0, MAX_SCORE);
  check(PUBLIC_REVIEWS.has(value.review));
  replayOrNull(value.replay);
  // Reasons are public only for disqualified rows, as the coarse code (design §C.5).
  if (value.reason !== undefined && value.reason !== null) check(value.review === 'disqualified' && typeof value.reason === 'string' && REASON.test(value.reason));
}

function current(value) {
  shape(value, ['weekKey', 'weekIndex', 'status', 'startsAt', 'closesAt', 'settleCutoffAt', 'candidateUntil', 'payoutAt', 'rules', 'pot', 'leader']);
  check(typeof value.weekKey === 'string' && WEEK_KEY.test(value.weekKey));
  int(value.weekIndex, 1);
  check(WEEK_STATUSES.has(value.status));
  for (const key of ['startsAt', 'closesAt', 'settleCutoffAt', 'candidateUntil', 'payoutAt']) iso(value[key]);
  const start = Date.parse(value.startsAt);
  check(Date.parse(value.closesAt) === start + WEEK_MS && isoWeekKey(start) === value.weekKey && weekIndexOfMs(start) === value.weekIndex);
  check(Date.parse(value.settleCutoffAt) > Date.parse(value.closesAt) && Date.parse(value.payoutAt) >= Date.parse(value.candidateUntil));
  shape(value.rules, ['minPaidWei', 'maxSurvivalSeconds', 'minFundWei', 'adminClearOnly']);
  wei(value.rules.minPaidWei);
  wei(value.rules.minFundWei);
  int(value.rules.maxSurvivalSeconds, 0);
  check(typeof value.rules.adminClearOnly === 'boolean');
  pot(value.pot, value.rules.minFundWei);
  // The open week's leader is unscreened: a score only, never a wallet or a name (design §C.5, F9).
  if (value.leader !== null) {
    shape(value.leader, ['score', 'provisional', 'screened']);
    int(value.leader.score, 0, MAX_SCORE);
    check(value.leader.provisional === true && typeof value.leader.screened === 'boolean');
  }
}

function previous(value) {
  if (value === null) return;
  shape(value, ['weekKey', 'status', 'payoutAt', 'token', 'pot', 'candidates', 'winner', 'prizeWei', 'unclaimedWei', 'finalizeTx'], ['startsAt', 'closesAt', 'contract']);
  check(typeof value.weekKey === 'string' && weekStartOfKey(value.weekKey) !== null);
  iso(value.payoutAt);
  check(Date.parse(value.payoutAt) >= weekStartOfKey(value.weekKey) + WEEK_MS + 86_400_000);
  if (value.startsAt !== undefined) check(typeof value.startsAt === 'string' && Date.parse(value.startsAt) === weekStartOfKey(value.weekKey));
  if (value.closesAt !== undefined) check(typeof value.closesAt === 'string' && Date.parse(value.closesAt) === weekStartOfKey(value.weekKey) + WEEK_MS);
  if (value.contract !== undefined) check(typeof value.contract === 'string' && ADDRESS.test(value.contract));
  weekToken(value.token);
  pot(value.pot);
  check(Array.isArray(value.candidates) && value.candidates.length <= 10);
  value.candidates.forEach(candidate);
  outcome(value);
}

function historyRow(value) {
  shape(value, ['weekKey', 'startsAt', 'closesAt', 'status', 'token', 'contract', 'winner', 'score', 'prizeWei', 'unclaimedWei', 'finalizeTx', 'replay', 'rolledTo']);
  check(typeof value.weekKey === 'string' && WEEK_KEY.test(value.weekKey));
  iso(value.startsAt);
  iso(value.closesAt);
  check(Date.parse(value.startsAt) === weekStartOfKey(value.weekKey) && Date.parse(value.closesAt) === Date.parse(value.startsAt) + WEEK_MS);
  weekToken(value.token);
  check(typeof value.contract === 'string' && ADDRESS.test(value.contract));
  check(value.score === null || (Number.isSafeInteger(value.score) && value.score >= 0 && value.score <= MAX_SCORE));
  replayOrNull(value.replay);
  check(value.rolledTo === null || (typeof value.rolledTo === 'string' && WEEK_KEY.test(value.rolledTo)));
  outcome(value);
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function parseJackpot(json) {
  try {
    check(isObject(json) && json.ok === true && json.game === 'chikun' && typeof json.live === 'boolean');
    if (json.live === false) {
      shape(json, ['ok', 'live', 'game']);
      return deepFreeze({ ok: true, live: false, game: 'chikun' });
    }
    shape(json, ['ok', 'live', 'game', 'chainId', 'contract', 'explorer', 'token', 'serverTime', 'indexedBlock', 'current', 'previous', 'history', 'rulesUrl']);
    check(json.chainId === JACKPOT_CHAIN_ID && json.explorer === JACKPOT_EXPLORER && json.rulesUrl === '/jackpot/chikun');
    check(typeof json.contract === 'string' && ADDRESS.test(json.contract));
    weekToken(json.token, { withAddress: true });
    iso(json.serverTime);
    check(json.indexedBlock === null || (Number.isSafeInteger(json.indexedBlock) && json.indexedBlock >= 0));
    if (json.current !== null) current(json.current);
    previous(json.previous);
    check(Array.isArray(json.history) && json.history.length <= 26);
    json.history.forEach(historyRow);
    return deepFreeze(JSON.parse(JSON.stringify(json)));
  } catch {
    // BAD (a deviation) or anything a malformed value throws on the way (BigInt of a non-number).
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------
// The corrected clock (design §D.2, F8).

// The server's time at receipt is serverTime plus the Age header (seconds the CDN held the answer), or
// the Date header when Age is absent and Date is later. The skew is applied only beyond 5 s, so a
// fresh answer never nudges a correct clock.
export function serverClock({ serverTime = null, age = null, date = null } = {}, receivedAtMs = Date.now()) {
  const origin = Date.parse(String(serverTime ?? ''));
  let skewMs = 0;
  if (Number.isFinite(origin) && Number.isFinite(receivedAtMs)) {
    let serverNow = origin;
    const ageSeconds = age === null || age === undefined || String(age).trim() === '' ? NaN : Number(age);
    if (Number.isFinite(ageSeconds) && ageSeconds >= 0) serverNow = origin + ageSeconds * 1000;
    else {
      const dated = Date.parse(String(date ?? ''));
      if (Number.isFinite(dated) && dated > serverNow) serverNow = dated;
    }
    skewMs = serverNow - receivedAtMs;
    if (Math.abs(skewMs) <= CLOCK_SKEW_THRESHOLD_MS) skewMs = 0;
  }
  return Object.freeze({ skewMs, now: (localMs = Date.now()) => localMs + skewMs });
}

// 'open' or 'closed', from closesAt on the corrected clock (never from the cached status).
export function phaseOf(week, correctedNowMs) {
  const closes = Date.parse(String(week?.closesAt ?? ''));
  if (!Number.isFinite(closes) || !Number.isFinite(correctedNowMs)) return 'closed';
  return correctedNowMs < closes ? 'open' : 'closed';
}

// The same arithmetic as leaderboard-view.mjs formatResetCountdown, so the jackpot countdown and the
// board's "resets in" never disagree on one page (tests pin the equality).
export function countdownParts(targetIso, correctedNowMs) {
  const at = Date.parse(String(targetIso ?? ''));
  if (!Number.isFinite(at) || !Number.isFinite(correctedNowMs)) return null;
  const ms = Math.max(0, at - correctedNowMs);
  const minutes = Math.floor(ms / 60_000);
  return Object.freeze({ ms, done: at <= correctedNowMs, minutes, days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), mins: minutes % 60 });
}

// "2d 4h", "5h 12m", "9m", "under a minute".
export function formatCountdown(parts) {
  if (!parts) return '';
  if (parts.minutes < 1) return 'under a minute';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.mins}m`;
  return `${parts.mins}m`;
}

// ---------------------------------------------------------------------------------------------------
// fetchJackpot: GET /api/jackpot?game=chikun, 4 s timeout, a 30 s in-memory memo per game.

const defaultMemo = new Map();

export function resetJackpotMemo(memo = defaultMemo) {
  memo.clear();
}

async function readJackpot({ fetchImpl, url, timeoutMs, localNow, setTimeoutImpl, clearTimeoutImpl }) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeoutImpl(() => { controller?.abort(); resolve(null); }, timeoutMs);
  });
  const request = (async () => {
    const response = await fetchImpl(url, { headers: { accept: 'application/json' }, ...(controller ? { signal: controller.signal } : {}) });
    if (!response?.ok) return null;
    const api = parseJackpot(await response.json());
    if (!api) return null;
    const header = (key) => response.headers?.get?.(key) ?? null;
    const clock = api.live ? serverClock({ serverTime: api.serverTime, age: header('age'), date: header('date') }, localNow()) : serverClock({}, localNow());
    return Object.freeze({ api, clock });
  })().catch(() => null);
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeoutImpl(timer);
  }
}

// Resolves { api, clock } or null (network failure, timeout, a non-2xx answer or a malformed body).
export function fetchJackpot({
  fetchImpl = globalThis.fetch,
  game = 'chikun',
  timeoutMs = JACKPOT_FETCH_TIMEOUT_MS,
  memoMs = JACKPOT_MEMO_MS,
  now = () => Date.now(),
  memo = defaultMemo,
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeoutImpl = (id) => globalThis.clearTimeout(id),
} = {}) {
  if (typeof fetchImpl !== 'function' || game !== 'chikun') return Promise.resolve(null);
  const at = now();
  const cached = memo.get(game);
  if (cached && at - cached.at < memoMs) return cached.promise;
  const url = `${JACKPOT_API_PATH}?game=${game}`;
  const promise = readJackpot({ fetchImpl, url, timeoutMs, localNow: now, setTimeoutImpl, clearTimeoutImpl });
  memo.set(game, { at, promise });
  return promise;
}

// ---------------------------------------------------------------------------------------------------
// Ranked entries seen by the entry-modal row (jackpot-entry-line.mjs), keyed by session handle, so the
// results line can check the run's own paid amount and week (design §D.3). Bounded; in memory only.

const entries = new Map();
export function noteJackpotEntry(sessionId, record) {
  if (typeof sessionId !== 'string' || !sessionId || !record) return;
  entries.delete(sessionId);
  entries.set(sessionId, record);
  while (entries.size > 20) entries.delete(entries.keys().next().value);
}
export function jackpotEntryFor(sessionId) {
  return entries.get(String(sessionId ?? '')) ?? null;
}

// ---------------------------------------------------------------------------------------------------
// Honest presentation helpers.

// A decimal token amount, truncated (never rounded up), grouped with commas: "10,000", "1,234.5".
export function formatTokenAmount(amountWei, decimals = 18, { fractionDigits = 2 } = {}) {
  let value;
  try { value = BigInt(String(amountWei)); } catch { return null; }
  if (value < 0n || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = decimals === 0 ? '' : (value % base).toString().padStart(decimals, '0').slice(0, fractionDigits).replace(/0+$/, '');
  const text = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
  if (value > 0n && text === '0') return fractionDigits > 0 ? `<0.${'0'.repeat(fractionDigits - 1)}1` : '<1';
  return text;
}

// "10,000 tCHIKUN", with "(testnet token, no value)" on the first mention of a testnet token.
export function tokenAmountText(amountWei, token, { first = false } = {}) {
  const amount = formatTokenAmount(amountWei, token?.decimals);
  if (amount === null || !token?.symbol) return '';
  return `${amount} ${token.symbol}${first && token.testnet ? ` ${TESTNET_TOKEN_NOTE}` : ''}`;
}

// This week's prize, or null: shown only for a live, funded week with a prize above zero.
export function currentPrize(api) {
  const week = api?.live === true ? api.current : null;
  if (!week || week.pot?.funded !== true) return null;
  const prize = BigInt(week.pot.prizeWei);
  if (prize <= 0n) return null;
  const carryOver = BigInt(week.pot.carryOverWei);
  return Object.freeze({
    wei: week.pot.prizeWei,
    token: api.token,
    text: (options) => tokenAmountText(week.pot.prizeWei, api.token, options),
    capped: carryOver > 0n,
    // "up to {cap}; the rest rolls over" (design §D.1), for surfaces with room.
    capNote: carryOver > 0n ? `up to ${tokenAmountText(week.pot.prizeCapWei, api.token)}; the rest rolls over` : null,
  });
}

// "top score 48,213 (provisional)": the open week's leader is a score only.
export function leaderScoreText(leader) {
  return Number.isSafeInteger(leader?.score) ? `top score ${leader.score.toLocaleString('en-US')} (provisional)` : '';
}

// Plain words for a past week's public status. A winner is "pending review" until the week is paid.
export function weekStatusText(status) {
  return ({
    paid: 'Paid',
    'claim-pending': 'Claim pending',
    rolled: 'Rolled over',
    unfunded: 'No prize funded',
  })[status] ?? 'Pending review';
}

// "Sep 28 – Oct 4" (", 2026" with `year`): the week's Monday-to-Sunday calendar days, which are UTC
// days because the week is UTC-bound, in the viewer's own date format. The exact local boundary is
// shown next to it with localAndUtcTime(). Never the ISO week key.
export function weekRangeText(startsAt, closesAt, { year = false, locale } = {}) {
  const start = Date.parse(String(startsAt ?? ''));
  const end = Date.parse(String(closesAt ?? '')) - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
  const format = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${format.format(start)} – ${format.format(end)}${year ? `, ${new Date(end).getUTCFullYear()}` : ''}`;
}

// "Sun 8:00 PM EDT · Mon 00:00 UTC": the viewer's local time next to UTC.
export function localAndUtcTime(isoTime, { locale, timeZone } = {}) {
  const at = Date.parse(String(isoTime ?? ''));
  if (!Number.isFinite(at)) return '';
  const local = new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', ...(timeZone ? { timeZone } : {}) })
    .formatToParts(at).map((part) => (part.type === 'literal' ? part.value.replace(/^,\s*/, ' ') : part.value)).join('').replace(/[\u00a0\u202f]/g, ' ');
  const utc = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(at);
  return `${local} · ${utc} UTC`;
}

// Explorer and replay links, only for well-formed values.
export function explorerTxUrl(hash) {
  return typeof hash === 'string' && TX_HASH.test(hash) ? `${JACKPOT_EXPLORER}/tx/${hash}` : null;
}
export function explorerAddressUrl(address) {
  return typeof address === 'string' && ADDRESS.test(address) ? `${JACKPOT_EXPLORER}/address/${address}` : null;
}
// "Watch" opens the replay in the Chikun cabinet (apps/chikun/src/main.mjs ?replay= deep link).
export function watchReplayUrl(replay) {
  return typeof replay === 'string' && JACKPOT_REPLAY_PATH.test(replay) ? `/chikun/index.html?replay=${encodeURIComponent(replay)}` : null;
}
