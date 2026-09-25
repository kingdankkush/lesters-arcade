// Chikun Weekly Jackpot, jackpot-ui slice: the import-free flag module and the shared client
// (design §D.1, §D.2): strict parsing of the §C.5 rev. 2 answer, BigInt amounts, the Age-corrected
// clock, the close on the client, and the honesty helpers every surface uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'acorn';

import { JACKPOT_GAMES, JACKPOT_LIVE, JACKPOT_RULES_PATH } from '../apps/portal/src/jackpot-config.mjs';
import { SETTLEMENT_LIVE } from '../apps/portal/src/settlement.mjs';
import { LITVM_JACKPOT } from '../apps/portal/src/generated/litvm-jackpot.mjs';
import { formatResetCountdown } from '../apps/portal/src/leaderboard-view.mjs';
import {
  CLOCK_SKEW_THRESHOLD_MS, JACKPOT_API_PATH, JACKPOT_FETCH_TIMEOUT_MS, JACKPOT_MEMO_MS, TESTNET_TOKEN_NOTE,
  countdownParts, currentPrize, explorerTxUrl, fetchJackpot, formatCountdown, formatTokenAmount, isoWeekKey,
  jackpotEntryFor, leaderScoreText, localAndUtcTime, noteJackpotEntry, parseJackpot, phaseOf, serverClock,
  tokenAmountText, watchReplayUrl, weekIndexOfMs, weekRangeText, weekStartOfKey, weekStatusText,
} from '../apps/portal/src/jackpot/jackpot-client.mjs';

const fixtureDir = new URL('./fixtures/jackpot/', import.meta.url);
export const fixture = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, fixtureDir), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const E18 = 10n ** 18n;

function responseOf(body, { status = 200, headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { ok: status >= 200 && status < 300, status, headers: { get: (key) => lower[String(key).toLowerCase()] ?? null }, json: async () => clone(body) };
}

test('jackpot flag is false, the config imports nothing, and true implies settlement and a deployed jackpot module', () => {
  assert.equal(JACKPOT_LIVE, false, 'committed literal false until the owner-approved flip (design §E E10)');
  assert.deepEqual([...JACKPOT_GAMES], ['chikun']);
  assert.equal(JACKPOT_RULES_PATH, '/jackpot/chikun');
  const source = readFileSync(new URL('../apps/portal/src/jackpot-config.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  assert.deepEqual(ast.body.filter((node) => /^(Import|ExportAll)/.test(node.type) || node.source), [], 'no imports or re-exports');
  assert.doesNotMatch(source, /import\s*\(|LITVM_JACKPOT\s*[,}]|\bwindow\b|\bprocess\b/, 'no dynamic import, no generated module, no globals');
  assert.match(source, /^export const JACKPOT_LIVE = false;$/m, 'the literal the build and the release facts read');
  // Invariant (design §D.1): JACKPOT_LIVE => SETTLEMENT_LIVE && LITVM_JACKPOT.status === 'deployed'.
  assert.ok(!JACKPOT_LIVE || (SETTLEMENT_LIVE && LITVM_JACKPOT.status === 'deployed'), 'the jackpot never goes live ahead of settlement or its contract');
});

test('parseJackpot accepts the documented shape and rejects deviations', () => {
  for (const name of readdirSync(fixtureDir).filter((file) => file.endsWith('.json') && !file.startsWith('review-api'))) {
    const api = parseJackpot(fixture(name.replace(/\.json$/, '')));
    assert.ok(api, `${name} is the documented shape`);
    assert.ok(Object.isFrozen(api) && (api.live === false || Object.isFrozen(api.current.pot)), `${name} is frozen`);
  }
  assert.deepEqual({ ...parseJackpot(fixture('not-live')) }, { ok: true, live: false, game: 'chikun' });
  const base = fixture('open-funded');
  const mutations = {
    'an unknown top-level key': (api) => { api.extra = 1; },
    'another game': (api) => { api.game = 'stacked'; },
    'not ok': (api) => { api.ok = false; },
    'another chain': (api) => { api.chainId = 1; },
    'another explorer': (api) => { api.explorer = 'https://evil.example'; },
    'a rules url elsewhere': (api) => { api.rulesUrl = 'https://evil.example/rules'; },
    'a bad contract': (api) => { api.contract = '0x1234'; },
    'a float amount': (api) => { api.current.pot.prizeWei = '1e22'; },
    'a numeric amount': (api) => { api.current.pot.totalWei = 1; },
    'a total that is not funded + carried': (api) => { api.current.pot.totalWei = '1'; },
    'a prize above the pot': (api) => { api.current.pot.prizeWei = (10001n * E18).toString(); },
    'funded below the minimum fund': (api) => { api.current.rules.minFundWei = (20000n * E18).toString(); },
    'unfunded above the minimum fund': (api) => { api.current.pot.funded = false; },
    'a named open-week leader': (api) => { api.current.leader.displayName = 'Solver'; },
    'a wallet on the open-week leader': (api) => { api.current.leader.wallet = `0x${'ab'.repeat(20)}`; },
    'a leader that is not provisional': (api) => { api.current.leader.provisional = false; },
    'a week index that is not the key': (api) => { api.current.weekIndex += 1; },
    'a close that is not a week later': (api) => { api.current.closesAt = '2026-10-06T00:00:00.000Z'; },
    'a non-ISO server time': (api) => { api.serverTime = 'yesterday'; },
    'a token symbol with markup': (api) => { api.token.symbol = '<b>X</b>'; },
    'a cross-origin replay link': (api) => { api.previous.candidates[0].replay = 'https://evil.example/replay'; },
    'a reason on a cleared row': (api) => { api.previous.candidates[0].reason = 'automation'; },
    'an unknown review value': (api) => { api.previous.candidates[0].review = 'flagged'; },
    'a winner on an unpaid week': (api) => { api.previous.winner = { walletShort: '0xa1a1…a1a1', wallet: `0x${'a1'.repeat(20)}`, displayName: null }; },
    'a paid history row without a winner': (api) => { api.history[0].winner = null; },
    'a claim-pending week that owes nothing': (api) => { api.history[0].status = 'claim-pending'; },
    'a history row keyed off its dates': (api) => { api.history[0].weekKey = '2026-W30'; },
    'a history row without its own token': (api) => { delete api.history[0].token; },
    'a malformed transaction hash': (api) => { api.history[0].finalizeTx = '0x12'; },
    'more than 26 history rows': (api) => { api.history = Array.from({ length: 27 }, () => api.history[0]); },
    'a not-live answer with data': (api) => { api.live = false; },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const api = clone(base);
    mutate(api);
    assert.equal(parseJackpot(api), null, label);
  }
  for (const junk of [null, undefined, 'x', 42, [], {}, { ok: true, live: true, game: 'chikun' }]) assert.equal(parseJackpot(junk), null);
});

test('token amounts format exactly with 18 decimals', () => {
  assert.equal(formatTokenAmount((10000n * E18).toString(), 18), '10,000');
  assert.equal(formatTokenAmount('1234567890123456789012345', 18), '1,234,567.89', 'truncated, never rounded up');
  assert.equal(formatTokenAmount('1999999999999999999', 18), '1.99');
  assert.equal(formatTokenAmount('1500000000000000000', 18), '1.5');
  assert.equal(formatTokenAmount('0', 18), '0');
  assert.equal(formatTokenAmount('1', 18), '<0.01', 'dust never reads as zero or rounds up');
  assert.equal(formatTokenAmount('115792089237316195423570985008687907853269984665640564039457584007913129639935', 18).slice(0, 12), '115,792,089,', 'uint256 max stays exact');
  assert.equal(formatTokenAmount('12345', 0), '12,345');
  assert.equal(formatTokenAmount('12345', 2), '123.45');
  for (const bad of ['1.5', '-1', 'abc', '1e18']) assert.equal(formatTokenAmount(bad, 18), null, bad);
  assert.equal(formatTokenAmount('1', 99), null, 'decimals out of range');
  const source = readFileSync(new URL('../apps/portal/src/jackpot/jackpot-client.mjs', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export function formatTokenAmount'), source.indexOf('export function tokenAmountText'));
  assert.doesNotMatch(body, /parseFloat|Number\(|toFixed|Math\./, 'BigInt only');
  assert.equal(tokenAmountText((5000n * E18).toString(), { symbol: 'tCHIKUN', decimals: 18, testnet: true }, { first: true }), `5,000 tCHIKUN ${TESTNET_TOKEN_NOTE}`);
  assert.equal(tokenAmountText((5000n * E18).toString(), { symbol: 'tCHIKUN', decimals: 18, testnet: true }), '5,000 tCHIKUN');
  assert.equal(tokenAmountText((5000n * E18).toString(), { symbol: 'CHIKUN', decimals: 18, testnet: false }, { first: true }), '5,000 CHIKUN', 'a real token carries no testnet note');
});

test('the corrected clock accounts for CDN age and the week closes on the client', () => {
  const serverTime = '2026-10-01T12:00:00.000Z';
  const origin = Date.parse(serverTime);
  // A response the CDN held for 140 s, read by a viewer whose clock agrees with the server.
  const aged = serverClock({ serverTime, age: '140' }, origin + 140_000);
  assert.equal(aged.skewMs, 0, 'an accurate viewer clock is left alone');
  // The same stale answer read by a viewer clock 3 minutes slow: the raw serverTime would make it
  // 40 s fast instead; the Age header gives the true server time.
  const slow = serverClock({ serverTime, age: '140' }, origin + 140_000 - 180_000);
  assert.equal(slow.skewMs, 180_000);
  assert.equal(slow.now(origin), origin + 180_000);
  // Without Age, a later Date header is the server's time at receipt.
  assert.equal(serverClock({ serverTime, date: 'Thu, 01 Oct 2026 12:02:00 GMT' }, origin).skewMs, 120_000);
  assert.equal(serverClock({ serverTime, date: 'Thu, 01 Oct 2026 11:00:00 GMT' }, origin - 60_000).skewMs, 60_000, 'an older Date never moves time back past serverTime');
  // Skews within 5 s are ignored.
  assert.equal(serverClock({ serverTime, age: '0' }, origin - CLOCK_SKEW_THRESHOLD_MS).skewMs, 0);
  assert.equal(serverClock({ serverTime, age: '0' }, origin - CLOCK_SKEW_THRESHOLD_MS - 1).skewMs, CLOCK_SKEW_THRESHOLD_MS + 1);
  assert.equal(serverClock({ serverTime: 'garbage', age: '10' }, origin).skewMs, 0);

  const week = parseJackpot(fixture('open-funded')).current;
  const close = Date.parse(week.closesAt);
  assert.equal(week.status, 'open', 'the cached answer still says open');
  assert.equal(phaseOf(week, close - 1), 'open');
  assert.equal(phaseOf(week, close), 'closed', 'the client closes the week at closesAt, whatever the cached status says');
  assert.equal(phaseOf(week, slow.now(close - 60_000)), 'closed', 'a slow viewer clock still sees the close on time');
  assert.equal(phaseOf(null, close), 'closed');

  // countdownParts is the arithmetic of the board's "resets in" (formatResetCountdown).
  for (const offset of [-5_000, 0, 30_000, 59_999, 60_000, 9 * 60_000 + 5, 5 * 3_600_000 + 12 * 60_000, 2 * 86_400_000 + 4 * 3_600_000 + 59_000, 6 * 86_400_000]) {
    const parts = countdownParts(week.closesAt, close - offset);
    assert.equal(`in ${formatCountdown(parts)}`, formatResetCountdown(week.closesAt, close - offset), `offset ${offset}`);
  }
  assert.equal(formatCountdown(countdownParts(week.closesAt, close - (2 * 86_400_000 + 4 * 3_600_000 + 30_000))), '2d 4h');
  assert.equal(countdownParts(week.closesAt, close + 1).done, true);
  assert.equal(countdownParts('nope', close), null);
});

test('fetchJackpot reads /api/jackpot once per 30 s, times out after 4 s and returns nothing on failure', async () => {
  assert.equal(JACKPOT_API_PATH, '/api/jackpot');
  assert.equal(JACKPOT_FETCH_TIMEOUT_MS, 4_000);
  assert.equal(JACKPOT_MEMO_MS, 30_000);
  const calls = [];
  let clock = Date.parse('2026-10-01T12:02:00.000Z');
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return responseOf(fixture('open-funded'), { headers: { Age: '120' } }); };
  const memo = new Map();
  const first = await fetchJackpot({ fetchImpl, now: () => clock, memo });
  assert.equal(calls[0].url, '/api/jackpot?game=chikun');
  assert.equal(calls[0].options.headers.accept, 'application/json');
  assert.equal(first.api.current.weekKey, '2026-W40');
  assert.equal(first.clock.skewMs, 0, 'serverTime + Age matches this viewer');
  clock += 29_000;
  await fetchJackpot({ fetchImpl, now: () => clock, memo });
  assert.equal(calls.length, 1, 'memoized for 30 s');
  clock += 2_000;
  await fetchJackpot({ fetchImpl, now: () => clock, memo });
  assert.equal(calls.length, 2, 'read again after 30 s');

  assert.equal(await fetchJackpot({ fetchImpl: async () => responseOf({}, { status: 503 }), memo: new Map() }), null);
  assert.equal(await fetchJackpot({ fetchImpl: async () => { throw new TypeError('offline'); }, memo: new Map() }), null);
  assert.equal(await fetchJackpot({ fetchImpl: async () => responseOf({ ...fixture('open-funded'), extra: true }), memo: new Map() }), null);
  let aborted = false;
  const hanging = (url, { signal } = {}) => new Promise(() => { signal?.addEventListener?.('abort', () => { aborted = true; }); });
  assert.equal(await fetchJackpot({ fetchImpl: hanging, timeoutMs: 5, memo: new Map() }), null, 'a 4 s timeout renders nothing');
  assert.equal(aborted, true, 'the late request is aborted');
  assert.equal(await fetchJackpot({ fetchImpl, game: 'stacked', memo: new Map() }), null, 'only games with a jackpot');
  const notLive = await fetchJackpot({ fetchImpl: async () => responseOf(fixture('not-live')), memo: new Map() });
  assert.equal(notLive.api.live, false);
  assert.equal(notLive.clock.skewMs, 0);
});

test('no surface shows an amount for an unfunded, below-minimum or unavailable week', () => {
  assert.ok(currentPrize(parseJackpot(fixture('open-funded'))));
  for (const name of ['open-unfunded', 'open-below-min-fund', 'not-live']) assert.equal(currentPrize(parseJackpot(fixture(name))), null, name);
  assert.equal(currentPrize(null), null);
  const noCurrent = clone(fixture('open-funded'));
  noCurrent.current = null;
  assert.equal(currentPrize(parseJackpot(noCurrent)), null);
});

test('surfaces show the capped prize and the rollover note', () => {
  const capped = currentPrize(parseJackpot(fixture('open-funded-capped')));
  assert.equal(capped.wei, (5000n * E18).toString(), 'the prize is min(pot, cap), not the 12,000 pot');
  assert.equal(capped.text({ first: true }), `5,000 tCHIKUN ${TESTNET_TOKEN_NOTE}`);
  assert.equal(capped.capNote, 'up to 5,000 tCHIKUN; the rest rolls over');
  const uncapped = currentPrize(parseJackpot(fixture('open-funded')));
  assert.equal(uncapped.capped, false);
  assert.equal(uncapped.capNote, null);
  assert.equal(uncapped.text(), '10,000 tCHIKUN');
});

test('testnet token amounts are labelled as having no value, per week', () => {
  const api = parseJackpot(fixture('paid-history-two-tokens'));
  assert.equal(api.token.symbol, 'CHIKUN');
  assert.equal(currentPrize(api).text({ first: true }), '10,000 CHIKUN', 'the real token has no testnet note');
  const [real, test] = api.history;
  assert.equal(tokenAmountText(real.prizeWei, real.token, { first: true }), '1,500 CHIKUN');
  assert.equal(tokenAmountText(test.prizeWei, test.token, { first: true }), `9,000 tCHIKUN ${TESTNET_TOKEN_NOTE}`, 'a tCHIKUN week keeps its own symbol after a token swap');
});

test('leader wording stays provisional until the week is paid and the open-week leader shows no name', () => {
  const api = parseJackpot(fixture('open-funded'));
  assert.equal(leaderScoreText(api.current.leader), 'top score 48,213 (provisional)');
  assert.deepEqual(Object.keys(api.current.leader).sort(), ['provisional', 'score', 'screened']);
  assert.equal(leaderScoreText(null), '');
  for (const status of ['open', 'review', 'awaiting-admin']) assert.equal(weekStatusText(status), 'Pending review');
  assert.equal(weekStatusText('paid'), 'Paid');
  assert.equal(weekStatusText('claim-pending'), 'Claim pending');
  assert.equal(weekStatusText('rolled'), 'Rolled over');
  assert.equal(weekStatusText('unfunded'), 'No prize funded');
});

test('weeks read as date ranges with local and UTC close times, never ISO keys', () => {
  const week = parseJackpot(fixture('open-funded')).current;
  assert.equal(weekRangeText(week.startsAt, week.closesAt, { locale: 'en-US' }), 'Sep 28 – Oct 4');
  assert.equal(weekRangeText(week.startsAt, week.closesAt, { locale: 'en-US', year: true }), 'Sep 28 – Oct 4, 2026');
  assert.equal(localAndUtcTime(week.closesAt, { locale: 'en-US', timeZone: 'America/New_York' }), 'Sun 8:00 PM EDT · Mon 00:00 UTC');
  assert.equal(localAndUtcTime(week.closesAt, { locale: 'en-US', timeZone: 'UTC' }), 'Mon 12:00 AM UTC · Mon 00:00 UTC');
  assert.doesNotMatch(weekRangeText(week.startsAt, week.closesAt), /W\d\d/);
  // Week math agrees with the contract (design §A.2 examples).
  assert.equal(isoWeekKey(Date.UTC(2026, 8, 28)), '2026-W40');
  assert.equal(weekIndexOfMs(Date.UTC(2026, 8, 28)), 2961);
  assert.equal(weekIndexOfMs(Date.UTC(2026, 8, 21)), 2960);
  assert.equal(weekIndexOfMs(Date.UTC(2026, 8, 27, 23, 59, 59)), 2960);
  assert.equal(isoWeekKey(Date.UTC(2027, 0, 1)), '2026-W53');
  assert.equal(weekIndexOfMs(Date.UTC(2027, 0, 1)), 2974);
  assert.equal(weekStartOfKey('2026-W53'), Date.UTC(2026, 11, 28));
  assert.equal(weekStartOfKey('2027-W01'), Date.UTC(2027, 0, 4));
  assert.equal(weekStartOfKey('2026-W54'), null);
});

test('links are same-origin replays and well-formed explorer transactions only', () => {
  const session = `0x${'ab'.repeat(32)}`;
  assert.equal(watchReplayUrl(`/api/jackpot/replay?session=${session}`), `/chikun/index.html?replay=${encodeURIComponent(`/api/jackpot/replay?session=${session}`)}`);
  for (const bad of ['https://evil.example/api/jackpot/replay?session=' + session, '//evil.example/x', `/api/jackpot/replay?session=${session}&x=1`, null]) assert.equal(watchReplayUrl(bad), null);
  assert.equal(explorerTxUrl(`0x${'cd'.repeat(32)}`), `https://liteforge.explorer.caldera.xyz/tx/0x${'cd'.repeat(32)}`);
  assert.equal(explorerTxUrl('javascript:alert(1)'), null);
});

test('the entry registry keeps the last Ranked entries in memory, bounded', () => {
  for (let index = 0; index < 25; index += 1) noteJackpotEntry(`game-session-${index}`, { index });
  assert.equal(jackpotEntryFor('game-session-0'), null, 'the oldest entries drop out');
  assert.deepEqual(jackpotEntryFor('game-session-24'), { index: 24 });
  noteJackpotEntry('', { index: -1 });
  assert.equal(jackpotEntryFor(''), null);
});
