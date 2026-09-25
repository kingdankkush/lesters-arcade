// Chikun Weekly Jackpot, jackpot-ui slice: the Chikun child's start-screen lines (design §D.3) and the
// review deep link ?replay=/api/jackpot/replay?session=0x… (same origin only). The child is flag-blind
// by protocol (portal:init is exact-keys), so it imports the import-free jackpot-config.mjs and reads
// the API itself; with the flag off it keeps its rewards tease and asks nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

import { JACKPOT_LIVE } from '../apps/portal/src/jackpot-config.mjs';
import { JACKPOT_REPLAY_PATH, watchReplayUrl } from '../apps/portal/src/jackpot/jackpot-client.mjs';
import { CHIKUN_JACKPOT_DETAIL, CHIKUN_REWARDS_TEASE, buildChikunJackpotTease, buildChikunModeTease } from '../apps/chikun/src/presentation.mjs';
import { exportChikunReplay, importChikunReplay } from '../apps/chikun/src/replay-file.mjs';
import { simulateChikunRun } from '../apps/portal/src/chikun-cabinet.mjs';
import { fakeDocument, flush, visibleText } from './helpers/jackpot-fake-dom.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/jackpot/${name}.json`, import.meta.url), 'utf8'));
const source = readFileSync(new URL('../apps/chikun/src/main.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const declaration = (name) => {
  const node = ast.body.find((entry) => (entry.type === 'FunctionDeclaration' && entry.id.name === name)
    || (entry.type === 'VariableDeclaration' && entry.declarations.some((item) => item.id.name === name)));
  assert.ok(node, `main.mjs declares ${name}`);
  return source.slice(node.start, node.end);
};
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const responseOf = (body, headers = {}) => ({ ok: true, status: 200, headers: { get: (key) => headers[String(key).toLowerCase()] ?? null }, json: async () => JSON.parse(JSON.stringify(body)), text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

// renderModeTease and loadJackpotTease, VM-executed with fakes for the DOM, fetch and the clock.
function teaseHarness({ live, mode = 'ranked', answer = fixture('open-funded'), headers = {}, now = NOW } = {}) {
  const documentRef = fakeDocument();
  const modeTease = documentRef.body.appendChild(documentRef.createElement('ul'));
  const calls = [];
  const context = {
    JACKPOT_LIVE: live, mode, modeTease, document: documentRef, jackpotTease: undefined,
    buildChikunModeTease, buildChikunJackpotTease, AbortSignal: { timeout: () => undefined },
    Date: { now: () => now, parse: Date.parse },
    Number, Math,
    fetch: async (url, init) => { calls.push({ url, init }); return responseOf(answer, headers); },
  };
  const render = runInNewContext(`${declaration('loadJackpotTease')}\n${declaration('renderModeTease')}\n;renderModeTease`, context);
  return { render, modeTease, calls, context };
}

test('chikun child keeps the rewards tease while the flag is false', async () => {
  assert.equal(JACKPOT_LIVE, false);
  const { render, modeTease, calls } = teaseHarness({ live: JACKPOT_LIVE });
  render();
  await flush(10);
  assert.deepEqual(calls, [], 'no request to /api/jackpot');
  const items = modeTease.querySelectorAll('li').map((item) => visibleText(item));
  assert.equal(items.length, 2);
  assert.match(items[1], new RegExp(`^${CHIKUN_REWARDS_TEASE}`));
  assert.match(items[1], /First to a set Ranked score, plus the top Ranked score of the week, month and year\./, 'the pinned detail line (tests/chikun-regions.test.mjs) is unchanged');
  // The Free start screen never mentions the jackpot, whatever the flag.
  const free = teaseHarness({ live: true, mode: 'free' });
  free.render();
  await flush(10);
  assert.deepEqual(free.calls, []);
  assert.doesNotMatch(visibleText(free.modeTease), /jackpot|rewards/i);
  // The rewards tease itself is unchanged (buildChikunModeTease is untouched).
  assert.equal(buildChikunModeTease('ranked').rewards, 'High-score rewards coming soon');
  assert.match(source, /if \(JACKPOT_LIVE && mode === 'ranked'\) \{\n\s+loadJackpotTease\(\);/, 'the child asks only in Ranked while the flag is on');
});

test('chikun child shows the jackpot detail copy when live, funded or not', async () => {
  // Pure lines, from the fixtures.
  assert.deepEqual({ ...buildChikunJackpotTease(fixture('open-funded'), NOW) }, { rewards: 'Weekly Jackpot: 10,000 tCHIKUN (testnet token, no value) · closes in 3d 12h', rewardsDetail: CHIKUN_JACKPOT_DETAIL });
  assert.equal(CHIKUN_JACKPOT_DETAIL, 'Top verified Ranked score of the week wins. See the rules.');
  assert.equal(buildChikunJackpotTease(fixture('open-funded-capped'), NOW).rewards, 'Weekly Jackpot: 5,000 tCHIKUN (testnet token, no value) · closes in 3d 12h', 'the capped prize, never the pot');
  for (const name of ['open-unfunded', 'open-below-min-fund']) {
    assert.deepEqual({ ...buildChikunJackpotTease(fixture(name), NOW) }, { rewards: 'Weekly Jackpot: no prize funded this week', rewardsDetail: CHIKUN_JACKPOT_DETAIL }, name);
  }
  assert.equal(buildChikunJackpotTease(fixture('not-live'), NOW), null);
  assert.equal(buildChikunJackpotTease(fixture('open-funded'), Date.parse('2026-10-05T00:00:00.000Z')), null, 'nothing once the week closed');
  assert.equal(buildChikunJackpotTease(null, NOW), null);
  const real = fixture('paid-history-two-tokens');
  assert.equal(buildChikunJackpotTease(real, NOW).rewards, 'Weekly Jackpot: 10,000 CHIKUN · closes in 3d 12h', 'no testnet note for a real token');
  const odd = fixture('open-funded');
  odd.current.pot.prizeWei = '1e22';
  assert.equal(buildChikunJackpotTease(odd, NOW), null, 'an amount that is not decimal wei shows nothing');
  odd.current.pot.prizeWei = (10n ** 22n).toString();
  odd.token.decimals = 1.5;
  assert.throws(() => buildChikunJackpotTease(odd, NOW), 'an answer it cannot read throws, and the child shows nothing');
  const dust = fixture('open-funded');
  dust.current.pot.prizeWei = '1234567890123456789';
  assert.match(buildChikunJackpotTease(dust, NOW).rewards, /^Weekly Jackpot: 1\.23 tCHIKUN/, 'BigInt, truncated');

  // The child reads the API itself, corrects its clock with Age, and replaces the rewards lines.
  const live = teaseHarness({ live: true, headers: { age: '0' }, now: NOW });
  live.render();
  await flush(10);
  assert.equal(live.calls.length, 1);
  assert.equal(live.calls[0].url, '/api/jackpot?game=chikun');
  const items = live.modeTease.querySelectorAll('li').map((item) => visibleText(item));
  assert.equal(items[1], `Weekly Jackpot: 10,000 tCHIKUN (testnet token, no value) · closes in 3d 12h${CHIKUN_JACKPOT_DETAIL}`);
  assert.doesNotMatch(visibleText(live.modeTease), /month and year|High-score rewards/, 'the old detail would promise prizes that do not exist');
  live.render();
  await flush(5);
  assert.equal(live.calls.length, 1, 'one request per page');
  // A clock 2 hours slow is corrected from serverTime + Age.
  const slow = teaseHarness({ live: true, headers: { age: '30' }, now: NOW + 30_000 - 2 * 3_600_000 });
  slow.render();
  await flush(10);
  assert.match(visibleText(slow.modeTease), /closes in 3d 11h/);
  // Unfunded: the unfunded line with the same detail; a failed read: no rewards line at all.
  const unfunded = teaseHarness({ live: true, answer: fixture('open-unfunded') });
  unfunded.render();
  await flush(10);
  assert.match(visibleText(unfunded.modeTease), /Weekly Jackpot: no prize funded this weekTop verified Ranked score of the week wins\. See the rules\./);
  const failed = teaseHarness({ live: true });
  failed.context.fetch = async () => { throw new TypeError('offline'); };
  failed.render();
  await flush(10);
  assert.equal(failed.modeTease.querySelectorAll('li').length, 1, 'only the daily tease');
});

test('chikun child imports only same-origin jackpot replays', async () => {
  const pattern = new RegExp(declaration('JACKPOT_REPLAY_LINK').match(/=\s*\/(.+)\/;$/)[1]);
  assert.equal(pattern.source, JACKPOT_REPLAY_PATH.source, 'the child accepts exactly the links the API and the owner page produce');
  const session = `0x${'ab'.repeat(32)}`;
  // What GET /api/jackpot/replay serves: a replay-file-v1 body the child's own importer accepts.
  const replayText = exportChikunReplay(simulateChikunRun({ seed: 7, taps: [12, 25, 40], maxTicks: 240 }));
  const evidence = JSON.parse(replayText);
  const run = (search, body = evidence, fetchImpl = null) => {
    const calls = [];
    const shown = [];
    const documentRef = fakeDocument();
    const overlay = () => { const node = documentRef.createElement('div'); node.className = 'overlay is-hidden'; return node; };
    const context = {
      URLSearchParams, location: { search }, phase: 'waiting',
      startOverlay: overlay(), resultOverlay: overlay(), resultCopy: documentRef.createElement('p'),
      importChikunReplay,
      showImportedReplay: (imported) => shown.push(imported),
      setLive: () => {},
      Promise, Error,
      fetch: async (url, init) => { calls.push({ url, init }); return fetchImpl ? fetchImpl(url, init) : responseOf(body); },
    };
    context.startOverlay.classList.remove('is-hidden');
    const open = runInNewContext(`${declaration('JACKPOT_REPLAY_LINK')}\n${declaration('openJackpotReplayLink')}\n;openJackpotReplayLink`, context);
    open(search);
    return { calls, shown, context };
  };
  // The owner page's "Watch in cabinet" link, as the browser hands it to the child.
  const watch = new URL(watchReplayUrl(`/api/jackpot/replay?session=${session}`), 'https://lestersarcade.io');
  const good = run(watch.search);
  await flush(10);
  assert.deepEqual(good.calls.map((call) => call.url), [`/api/jackpot/replay?session=${session}`]);
  assert.equal(good.shown.length, 1, 'the replay opens in the existing viewer');
  assert.equal(good.context.phase, 'game-over');
  assert.equal(good.context.startOverlay.classList.contains('is-hidden'), true);
  assert.equal(good.context.resultOverlay.classList.contains('is-hidden'), false);
  for (const search of [
    '',
    '?replay=',
    `?replay=https://evil.example/api/jackpot/replay?session=${session}`,
    `?replay=//evil.example/api/jackpot/replay?session=${session}`,
    `?replay=/api/jackpot/replay?session=${session}%26next=1`,
    `?replay=/api/jackpot/replay?session=0x${'AB'.repeat(32)}`,
    `?replay=/api/jackpot/replay?session=0x${'ab'.repeat(31)}`,
    `?replay=/api/jackpot/review?week=2026-W40`,
    `?replay=/api/jackpot/replay?session=${session}%0a`,
    `?replay=%2F%2Fevil.example%2Fapi%2Fjackpot%2Freplay%3Fsession%3D${session}`,
  ]) {
    const bad = run(search);
    await flush(2);
    assert.deepEqual(bad.calls, [], `${search} never reaches the network`);
    assert.equal(bad.shown.length, 0);
  }
  // A 404 or a file that is not a replay shows the error and nothing else.
  const missing = run(watch.search, null, async () => ({ ok: false, status: 404, text: async () => '' }));
  await flush(10);
  assert.equal(missing.shown.length, 0);
  assert.equal(missing.context.resultCopy.textContent, 'This file is not valid replay JSON.', 'the importer refuses the error answer');
  assert.equal(missing.context.phase, 'waiting');
});
