import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

import {
  applyVercelRewrites, compileVercelRewrites, createVercelRouter, listApiModules, LOCAL_ALLOWED_DOMAINS, readVercelConfig, startLocalStack, vercelAppendedParams,
} from '../scripts/lib/local-stack.mjs';
import { localContracts, localWalletKeys } from '../scripts/lib/local-chain.mjs';
import {
  DEFAULT_GAMES, DEFAULT_TIMEOUTS, profileNameFor, REHEARSAL_REPORT_SCHEMA, runRankedE2E, settleUntilConfirmed, waitRunLength,
} from '../scripts/lib/rehearsal-driver.mjs';
import { REHEARSAL_SUMMARY_SCHEMA } from '../scripts/rehearse-ranked-e2e.mjs';
import { buildSiweChallenge } from '../apps/portal/src/wallet-auth.mjs';
import { RANKED_GAMES } from '../apps/portal/src/ranked-identity.mjs';
import {
  ADDRESS_COMMAND, applyTextEdit, checkGuards, CHECKLIST_END, CHECKLIST_START, DRY_RUN_ENV, FLAG_EDITS, lineChanges, parseGateErrors, pathScrubber, renderChecklist, sha256Text, splitNpmScript,
  STEP3_TEST_EDITS, STEP7_REPORT_SCHEMA, STEP7_SCRIPT_RELATIVE_PATH, STEP7_TEST_EDITS, testLineFromStack, upsertChecklist,
} from '../scripts/rehearse-step7-dry-run.mjs';

/**
 * Rehearsal slice, acceptance 1-2 (the in-process target): the local stack (in-process Hardhat chain
 * 4441, UNMIGRATED PGlite, every api/*.mjs module mounted through its A30 seam behind the rewrites
 * read from vercel.json) and the rehearsal driver playing one Ranked session per game with every
 * negative check. The same driver over real HTTP and JSON-RPC (the live code path) is
 * tests/local-chain-rehearsal-http.test.mjs, split out so each file stays well inside 60 s.
 * Keys: the public Hardhat test mnemonic and random per-process secrets only.
 */

const HEX64 = 'ab'.repeat(32);
const WALLET = `0x${'Cd'.repeat(20)}`;
// The per-game checks every run records, in order (Chikun adds the tampered-claim check after the score).
const PER_GAME_CHECKS = Object.freeze(['siwe', 'seed-ticket', 'session-handle', 'ticket-seed-applied', 'session-key', 'entry-quote', 'entry-paid', 'settle-body', 'settle-confirmed', 'server-score',
  'settle-tx', 'status-owner-view', 'status-public-view', 'chain-session', 'chain-envelope', 'relayer-published', 'duplicate-post', 'leaderboard-row', 'profile-stats',
  'profile-achievements', 'share-session', 'share-page', 'share-card', 'profile-name-valid', 'profile-set', 'profile-refresh', 'profile-name', 'index-cron', 'index-cron-idempotent']);
const checksFor = (gameId) => (gameId === 'chikun' ? [...PER_GAME_CHECKS.slice(0, 10), 'tampered-claim-ignored', ...PER_GAME_CHECKS.slice(10)] : [...PER_GAME_CHECKS]);
const NEGATIVE_CHECKS = Object.freeze(['tampered-chikun-claim', 'unpaid-entry', 'fees-disabled-entry', 'evidence-copied-to-another-wallet', 'ephemeral-wallet-token', 'settlement-paused']);

// A driver context with a fake wall clock whose sleep() moves it (no real waiting).
function fakeClockContext({ startMs = 1_790_000_000_000, provider, api = null, timeouts = {} } = {}) {
  const ctx = {
    target: 'live', chain: {}, provider, api, log: () => {}, timeouts: { ...DEFAULT_TIMEOUTS, ...timeouts }, sleeps: [], clockMs: startMs,
  };
  ctx.now = () => ctx.clockMs;
  ctx.sleep = async (ms) => { ctx.sleeps.push(ms); ctx.clockMs += ms; };
  return ctx;
}

test('the live path waits wall-clock time for the run length while the chain makes no blocks (LiteForge is Arbitrum Orbit)', async () => {
  const openedAt = 1_790_000_000;
  // Orbit makes blocks only for transactions: the latest block stays the entry's while nobody sends one.
  const quietChain = { async getBlock() { return { timestamp: openedAt }; } };
  const ctx = fakeClockContext({ startMs: openedAt * 1000 + 400, provider: quietChain });
  const waited = await waitRunLength(ctx, { openedAt, runSeconds: 180 });
  assert.equal(waited.mode, 'real-time');
  assert.ok(ctx.clockMs >= (openedAt + 181) * 1000, 'the wall clock passed openedAt + the run length');
  assert.ok(waited.waitedSeconds >= 180 && waited.waitedSeconds <= 182, String(waited.waitedSeconds));
  assert.deepEqual(waited.latestBlockTimestamp, { before: openedAt, after: openedAt }, 'the chain clock stood still and the wait did not depend on it');
  assert.ok(ctx.sleeps.every((ms) => ms >= 250 && ms <= 5000), 'polls at most every 5 s');
  // Already past the run length: no wait.
  assert.equal((await waitRunLength(ctx, { openedAt, runSeconds: 60 })).mode, 'none');
  // A run ending beyond maxRunWaitMs is reported at once instead of slept through.
  const short = fakeClockContext({ startMs: openedAt * 1000, provider: quietChain, timeouts: { maxRunWaitMs: 60_000 } });
  await assert.rejects(waitRunLength(short, { openedAt, runSeconds: 180 }), /run-length-wait failed: the run length ends 181 s from now/);
  assert.deepEqual(short.sleeps, []);
  // A local chain is advanced instead (never slept).
  const advanced = [];
  const local = { ...fakeClockContext({ provider: quietChain }), chain: { advanceTime: async (seconds) => { advanced.push(seconds); } } };
  assert.deepEqual(await waitRunLength(local, { openedAt, runSeconds: 30 }), { waitedSeconds: 31, mode: 'increaseTime' });
  assert.deepEqual([advanced, local.sleeps], [[31], []]);
});

test('the settle loop honours a 409 run-timing-early, then walks pending, submitted and confirmed through E3 and E4', async () => {
  const sessionId32 = `0x${HEX64}`;
  const txHash = `0x${'cd'.repeat(32)}`;
  const answers = [
    { status: 409, body: { ok: false, error: 'run-timing-early', retryable: true, retryAfterMs: 4000 } },
    { status: 200, body: { status: 'pending', pollAfterMs: 1500 } },
    { status: 503, body: { ok: false, error: 'rpc-unavailable' } },
    { status: 200, body: { status: 'submitted', pollAfterMs: 2000 } },
    { status: 200, body: { status: 'confirmed', txHash } },
  ];
  const calls = [];
  const api = async (method, path, init = {}) => {
    calls.push([method, path, init.body?.retry ?? null, init.headers?.authorization === 'Bearer t']);
    return answers.shift();
  };
  const ctx = fakeClockContext({ api });
  const settled = await settleUntilConfirmed(ctx, { body: { sessionId32, evidence: {} }, token: 't' });
  assert.equal(settled.view.status, 'confirmed');
  assert.equal(settled.view.txHash, txHash);
  assert.deepEqual(calls, [
    ['POST', '/api/settle', null, true], // 409: wait retryAfterMs, then the same body again
    ['POST', '/api/settle', null, true], // 200 pending
    ['POST', '/api/settle', true, true], // queued: a retry POST (503, tried again)
    ['POST', '/api/settle', true, true], // 200 submitted
    ['GET', `/api/settle/status?sessionId32=${sessionId32}`, null, true], // submitted: E4 until confirmed
  ]);
  assert.deepEqual(ctx.sleeps, [4000, 1500, 1500, 2000], 'retryAfterMs, then the pollAfterMs of the last answer');
  assert.deepEqual(settled.attempts.map((attempt) => [attempt.status, attempt.error, attempt.state]), [[409, 'run-timing-early', null], [200, null, 'pending'], [503, 'rpc-unavailable', null], [200, null, 'submitted'], [200, null, 'confirmed']]);

  // The 409 budget is time, not a count: it covers an HMH run (about 180 s) many times over, then stops.
  let early = 0;
  const alwaysEarly = async () => { early += 1; return { status: 409, body: { ok: false, error: 'run-timing-early', retryable: true, retryAfterMs: 5000 } }; };
  const budget = fakeClockContext({ api: alwaysEarly });
  await assert.rejects(settleUntilConfirmed(budget, { body: { sessionId32 }, token: 't' }), /settle failed: E3 answered 409 run-timing-early/);
  assert.equal(early, DEFAULT_TIMEOUTS.maxRunWaitMs / 5000 + 1);
  // A dead letter stops the loop.
  const dead = fakeClockContext({ api: async () => ({ status: 200, body: { status: 'failed', retryable: false, lastError: 'reverted' } }) });
  await assert.rejects(settleUntilConfirmed(dead, { body: { sessionId32 }, token: 't' }), /dead-lettered/);
});

test('the local router applies vercel.json exactly: filesystem functions first, then the rewrites, query strings carried', () => {
  const router = createVercelRouter();
  const cases = [
    ['/api/settle', 'api/settle.mjs', '/api/settle'],
    ['/api/cron/index-chain', 'api/cron/index-chain.mjs', '/api/cron/index-chain'],
    ['/api/session', 'api/session.mjs', '/api/session'],
    ['/api/session/nonce', 'api/session-nonce.mjs', '/api/session-nonce'],
    [`/api/session/0x${HEX64}`, 'api/verified-session.mjs', `/api/verified-session?id=0x${HEX64}`],
    [`/api/session/${HEX64}`, 'api/verified-session.mjs', `/api/verified-session?id=${HEX64}`],
    [`/api/settle/status?sessionId32=0x${HEX64}`, 'api/settle-status.mjs', `/api/settle-status?sessionId32=0x${HEX64}`],
    [`/api/profile/refresh?wallet=${WALLET}`, 'api/profile-refresh.mjs', `/api/profile-refresh?wallet=${WALLET}`],
    [`/api/profile?wallet=${WALLET}&self=1`, 'api/profile.mjs', `/api/profile?wallet=${WALLET}&self=1`],
    ['/api/ranked/seed', 'api/ranked-seed.mjs', '/api/ranked-seed'],
    [`/s/${HEX64}`, 'api/share-page.mjs', `/api/share-page?id=${HEX64}`],
    [`/api/share-card/${HEX64}.png?v=0123456789ab`, 'api/share-card.mjs', `/api/share-card?id=${HEX64}&v=0123456789ab`],
    // free-share (E12, E13): slug and token only; the query string is carried (the page redirects fbclid to the canonical URL).
    [`/f/chikun/ac${'0'.repeat(38)}`, 'api/free-share-page.mjs', `/api/free-share-page?game=chikun&token=ac${'0'.repeat(38)}`],
    [`/f/hard-money-heroes/ah${'0'.repeat(28)}?fbclid=abc`, 'api/free-share-page.mjs', `/api/free-share-page?game=hard-money-heroes&token=ah${'0'.repeat(28)}&fbclid=abc`],
    [`/api/free-card/stacked/as${'0'.repeat(32)}.png`, 'api/free-card.mjs', `/api/free-card?game=stacked&token=as${'0'.repeat(32)}`],
  ];
  for (const [url, module, routed] of cases) assert.deepEqual([router.route(url).kind, router.route(url).module, router.route(url).url], ['api', module, routed], url);
  for (const url of [`/s/${HEX64}0`, `/api/share-card/${HEX64}.jpg`, '/api/nope', `/api/session/${HEX64.slice(1)}`, `/api/free-card/pinball/as${'0'.repeat(32)}.png`, `/api/free-card/stacked/as${'0'.repeat(32)}.jpg`, `/api/free-card/stacked/as${'0'.repeat(27)}.png`]) assert.equal(router.route(url).kind, 'none', url);
  // Every rewrite into /api/ reaches an existing function, and Vercel appends no undeclared query key.
  const modules = listApiModules();
  for (const rule of compileVercelRewrites().filter((entry) => entry.destination.startsWith('/api/'))) {
    assert.ok(modules.includes(`${rule.destination.split('?')[0].slice(1)}.mjs`), rule.source);
    assert.deepEqual(rule.appended, [], `${rule.source} appends nothing`);
  }
  // The model reproduces Vercel's param append (the pre-fix `:shareId` naming would add shareId=…).
  assert.deepEqual(vercelAppendedParams({ source: '/api/session/:shareId((?:0x)?[0-9a-fA-F]{64})', destination: '/api/verified-session?id=:shareId' }), ['shareId']);
  // Static paths route only when a web root is served (local-http), through the SPA rewrites.
  const withRoot = createVercelRouter({ staticRoot: fileURLToPath(new URL('../apps/portal/', import.meta.url)) });
  assert.equal(withRoot.route('/').kind, 'static');
  assert.equal(withRoot.route('/games/chikun').file.endsWith('chikun.html'), true);
  assert.equal(withRoot.route(`/profile/${WALLET}`).file.endsWith('index.html'), true);
  assert.equal(withRoot.route('/../package.json').kind, 'none', 'no path escapes the web root');
});

test('routing drift between vercel.json and the handlers fails the local stack', () => {
  const config = readVercelConfig();
  const drifted = structuredClone(config);
  drifted.rewrites.find((rule) => rule.source === '/api/ranked/seed').destination = '/api/ranked-seeds';
  const router = createVercelRouter({ config: drifted });
  assert.equal(router.route('/api/ranked/seed').kind, 'none', 'a rewrite to a missing function is a 404, not a silent pass');
  const renamed = structuredClone(config);
  renamed.rewrites.find((rule) => rule.source.startsWith('/api/session/:id')).source = '/api/session/:shareId((?:0x)?[0-9a-fA-F]{64})';
  renamed.rewrites.find((rule) => rule.source.startsWith('/api/session/:shareId')).destination = '/api/verified-session?id=:shareId';
  assert.equal(applyVercelRewrites(`/api/session/${HEX64}`, compileVercelRewrites(renamed)).destination, `/api/verified-session?id=${HEX64}&shareId=${HEX64}`,
    'the handler would see the undeclared shareId and answer 400 invalid-query');
});

test('the step-7 dry run refuses without --confirm-throwaway and in the main worktree, and parses the gate', () => {
  assert.equal(checkGuards({ argv: [], gitDir: 'C:/repo/.git/worktrees/x', commonDir: 'C:/repo/.git' }).ok, false);
  assert.match(checkGuards({ argv: ['--confirm-throwaway'], gitDir: 'C:/repo/.git', commonDir: 'C:/repo/.git' }).error, /main worktree/);
  assert.equal(checkGuards({ argv: ['--confirm-throwaway'], gitDir: 'C:/repo/.git/worktrees/x', commonDir: 'C:/repo/.git' }).ok, true);
  assert.deepEqual(parseGateErrors(['unexpected failure: tests/a.test.mjs :: pins false', 'missing ledger failure: tests/b.test.mjs :: old', 'raw test process exit must be 1']), {
    unexpected: [{ file: 'tests/a.test.mjs', name: 'pins false' }], missing: [{ file: 'tests/b.test.mjs', name: 'old' }], other: ['raw test process exit must be 1'],
  });
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(splitNpmScript(pkg.scripts['vercel:build']).map((step) => step.id), ['assets:hmh:curated-level-kit-runtime', 'assets:verify', 'test:release', 'check', 'contracts:check', 'build']);
  assert.equal(testLineFromStack('Error\n    at TestContext.<anonymous> (file:///C:/tmp/wt/tests/settlement.test.mjs:16:10)', 'tests/settlement.test.mjs'), 16);
  assert.deepEqual(applyTextEdit('a = false;\nb = false;', { find: 'b = false;', replace: 'b = true;' }), { ok: true, text: 'a = false;\nb = true;', error: null });
  assert.equal(applyTextEdit('x x', { find: 'x', replace: 'y' }).ok, false, 'an ambiguous edit is refused');
  const doc = readFileSync(new URL('../docs/web3/contract-overhaul-20260916.md', import.meta.url), 'utf8');
  assert.equal(doc.split(CHECKLIST_START).length, 2, 'the doc carries exactly one generated step-7 checklist block');
  assert.ok(doc.indexOf(CHECKLIST_END) > doc.indexOf(CHECKLIST_START));
  const gate = { status: 'FAIL', unexpected: 1, missing: 0 };
  const block = renderChecklist({
    head: 'abc1234', generatedAt: '2026-09-23T00:00:00.000Z', scriptSha256: 'f'.repeat(64), fullVerify: null,
    step3: { gate, failures: { caused: [{ file: 'tests/n.test.mjs', name: 'n' }], preExisting: [] }, edits: [{ file: 'tests/n.test.mjs', line: 9, before: 'a', after: 'b', verified: true }], unexplainedFailures: [], generatedDocs: [] },
    step7: {
      flagEdits: [{ line: 28, before: 'export const SETTLEMENT_LIVE = false;', after: 'export const SETTLEMENT_LIVE = true;' }], generated: { changedByPortalPages: ['apps/portal/index.html'] },
      edits: [{ file: 'tests/settlement.test.mjs', line: 16, before: 'false', after: 'true', verified: true }], unexplainedFailures: [], steps: [], failures: { caused: [], preExisting: [] },
      generatedDocs: [{ path: 'docs/releases/hmh-fact-sheet.md', by: 'node scripts/hmh-release-facts.mjs --write', removed: ['SETTLEMENT_LIVE=false'], added: ['SETTLEMENT_LIVE=true'] }],
    },
  });
  assert.ok(block.startsWith(CHECKLIST_START) && block.endsWith(CHECKLIST_END));
  assert.ok(block.indexOf('**Step 3 (the deploy commit).**') < block.indexOf('**Step 7 (the flag flip).**'));
  assert.ok(block.includes(`\`${ADDRESS_COMMAND}\``), 'the checklist names the command the dry run proved (--deployed, never the auto mode)');
  assert.match(block, /`node scripts\/hmh-release-facts\.mjs --write` rewrites `docs\/releases\/hmh-fact-sheet\.md`/);
  assert.equal(upsertChecklist(`x\n${CHECKLIST_START}\nold\n${CHECKLIST_END}\ny`, block), `x\n${block}\ny`);
  // Local paths are scrubbed in every spelling, the throwaway before the home directory.
  const scrubbed = pathScrubber([['C:\\Users\\me\\AppData\\Local\\Temp\\lesters-step7-x\\wt', '<throwaway>'], ['C:\\Users\\me', '~']]);
  assert.equal(scrubbed('C:\\Users\\me\\AppData\\Local\\Temp\\lesters-step7-x\\wt\\docs\\a.json | C:/Users/me/AppData/Local/Temp/lesters-step7-x/wt/b | "C:\\\\Users\\\\me\\\\AppData\\\\Local\\\\Temp\\\\lesters-step7-x\\\\wt\\\\c" | c:\\users\\me\\x'), '<throwaway>\\docs\\a.json | <throwaway>/b | "<throwaway>\\\\c" | ~\\x');
  assert.deepEqual(lineChanges('a\nstate: simulated\nb', 'a\nstate: gated\nb'), { removed: ['state: simulated'], added: ['state: gated'], removedCount: 1, addedCount: 1 });
  assert.deepEqual(FLAG_EDITS.map((edit) => edit.file), ['apps/portal/src/settlement.mjs', 'apps/portal/src/settlement.mjs']);
});

test('the committed step-3/step-7 dry run is current: made by this script, unedited, and proving every edit', (t) => {
  // Inside the dry run's own throwaway worktree the report is still being produced (the committed one
  // is the previous run's), so there is nothing to hold it to yet.
  if (process.env[DRY_RUN_ENV] === '1') return;
  const doc = readFileSync(new URL('../docs/web3/contract-overhaul-20260916.md', import.meta.url), 'utf8');
  const text = readFileSync(new URL('../docs/qa/step7-dry-run-20260923.json', import.meta.url), 'utf8');
  const report = JSON.parse(text);
  assert.equal(report.schema, STEP7_REPORT_SCHEMA);
  assert.equal(report.scriptSha256, sha256Text(readFileSync(new URL(`../${STEP7_SCRIPT_RELATIVE_PATH}`, import.meta.url), 'utf8')), 'the dry-run script changed since the committed run: re-run node scripts/rehearse-step7-dry-run.mjs --confirm-throwaway');
  assert.equal(report.throwawayRemoved, true);
  assert.ok(doc.includes(renderChecklist(report)), 'the doc checklist is the one rendered from the committed report');
  assert.equal(report.partial ?? null, null, 'a --tests (partial) dry run is never committed');
  assert.equal(report.ok, true);
  // No local absolute path (the throwaway, the repo, the home directory) reaches the committed evidence.
  assert.doesNotMatch(text, /(?<![A-Za-z])[A-Za-z]:(\\\\|\/)|AppData|lesters-step7-[A-Za-z0-9]{6}(?![A-Za-z0-9-])|\/home\/|\/Users\//);
  // Step 3 (the record and the deployed module, flags off) and step 7 (the flip) proved their own edits.
  const proven = (edits) => edits.map((edit) => [edit.file, edit.before, edit.after, edit.applied, edit.verified]);
  assert.deepEqual(proven(report.step3.edits), STEP3_TEST_EDITS.map((edit) => [edit.file, edit.find, edit.replace, true, true]));
  assert.deepEqual(proven(report.step7.edits), STEP7_TEST_EDITS.map((edit) => [edit.file, edit.find, edit.replace, true, true]));
  assert.deepEqual([report.step3.unexplainedFailures, report.step7.unexplainedFailures], [[], []]);
  assert.ok(report.step3.failures.caused.length > 0 && report.step3.failures.caused.every((failure) => STEP3_TEST_EDITS.some((edit) => edit.file === failure.file)), 'the deployed module alone breaks tests, and the step-3 edits cover them');
  assert.deepEqual([report.addressModule.status, report.addressModule.deployer, report.addressModule.command], ['deployed', '0x6ac08bed727a6951d755f0674f096e6a8ac06bff', ADDRESS_COMMAND], 'the rehearsed record comes from the real deploy config');
  // The fact sheet records SETTLEMENT_LIVE, so the flip changes it (even though its checker may already fail at the base).
  assert.ok(report.step7.generatedDocs.some((entry) => entry.path === 'docs/releases/hmh-fact-sheet.json'), 'the flip regenerates the release fact sheet');
  assert.ok(report.step7.generated.changedBySteps.length > 0, 'the files the build steps and audits rewrote are recorded');
  const preExisting = new Set(report.step7.failures.preExisting.map((failure) => `${failure.file} :: ${failure.name}`));
  assert.equal(report.fullVerify.missing, 0);
  assert.ok(report.fullVerify.unexpectedFailures.every((failure) => preExisting.has(`${failure.file} :: ${failure.name}`)), 'after both commits\' edits only failures already present before the flip remain');
  // Every edit still applies to exactly one place (or has been applied, after its runbook step).
  for (const edit of [...STEP3_TEST_EDITS, ...STEP7_TEST_EDITS]) {
    const source = readFileSync(new URL(`../${edit.file}`, import.meta.url), 'utf8');
    const pending = applyTextEdit(source, edit).ok;
    const done = !source.includes(edit.find) && applyTextEdit(source, { find: edit.replace, replace: edit.replace }).ok;
    assert.ok(pending || done, `${edit.file}: an edit no longer matches; re-run the dry run and update the script's edits`);
  }
  t.diagnostic(`dry run at ${report.head}, ${report.generatedAt}`);
});

const state = { stack: null };
before(async () => { state.stack = await startLocalStack(); });
after(async () => { await state.stack?.close(); });

test('the local stack starts unmigrated with fixture env, and its first requests migrate through the handlers (A34)', async () => {
  const { stack } = state;
  const tables = async () => (await stack.db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('schema_migrations','verified_sessions')"))[0].n;
  assert.equal(await tables(), 0, 'PGlite starts unmigrated');
  // Fixture env (§11 rule 12): development, RANKED_* names only, random secrets, the local registry.
  const keys = localWalletKeys();
  assert.equal(stack.env.VERCEL_ENV, 'development');
  assert.equal(stack.env.SESSION_ALLOWED_DOMAINS, LOCAL_ALLOWED_DOMAINS.join(','));
  assert.match(stack.env.SESSION_SECRET, /^[0-9a-f]{64}$/);
  assert.match(stack.env.CRON_SECRET, /^[0-9a-f]{64}$/);
  assert.equal(stack.env.RANKED_VERIFIER_PRIVATE_KEY, keys.verifier);
  assert.equal(stack.env.RANKED_RELAYER_PRIVATE_KEY, keys.relayer);
  assert.equal(stack.env.RANKED_SCORE_REGISTRY_ADDRESS, stack.record.addresses.scoreSubmissionRegistry.toLowerCase());
  for (const legacy of ['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']) assert.equal(Object.hasOwn(stack.env, legacy), false, legacy);
  // The chain: suite deployed, dev wallets confirmed, every game playable, fees on.
  const contracts = localContracts(stack.record, stack.chain.provider);
  assert.equal(await contracts.rankedEntry.entryFeeEnabled(), true);
  for (const gameId of DEFAULT_GAMES) {
    const game = await contracts.gameRegistry.getGame(ethers.id(gameId));
    assert.deepEqual([game.exists, game.playable, game.devWalletConfirmed], [true, true, true], gameId);
    assert.equal((await contracts.rankedEntry.quoteEntry(ethers.id(gameId))).totalWei, 102_000_000_000_000_000n, `${gameId} entry is 0.102 zkLTC`);
  }

  // A board read on the empty database: the handler migrates it first.
  const board = await stack.api('GET', '/api/leaderboard?game=chikun&period=weekly');
  assert.deepEqual([board.status, board.body.total, board.body.rows], [200, 0, []]);
  assert.equal(board.headers['cache-control'], 'public, s-maxage=15, stale-while-revalidate=60');
  assert.equal(await tables(), 2, 'the first request migrated the schema');
  // E1, E2 and E15 through the same routes the browser uses.
  const wallet = stack.wallets.player2;
  const nonce = await stack.api('GET', '/api/session/nonce');
  assert.equal(nonce.status, 200);
  const challenge = buildSiweChallenge({ domain: '127.0.0.1', address: wallet.address, chainId: 4441, nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt });
  const login = await stack.api('POST', '/api/session', { body: { challenge, signature: await wallet.signMessage(challenge.message) } });
  assert.deepEqual([login.status, login.body.wallet], [200, wallet.address.toLowerCase()]);
  const reused = await stack.api('POST', '/api/session', { body: { challenge, signature: await wallet.signMessage(challenge.message) } });
  assert.deepEqual([reused.status, reused.body.error], [401, 'nonce-used'], 'a server nonce is single-use');
  const seed = await stack.api('POST', '/api/ranked/seed', {
    headers: { authorization: `Bearer ${login.body.token}` },
    body: { gameId: 'stacked', sessionId: 'game-session-11111111-1111-4111-8111-111111111111', seasonId: RANKED_GAMES.stacked.seasonId, buildHash: 'site-1.7.0:game-1.7.0:cabinet-0.2.0' },
  });
  assert.equal(seed.status, 200);
  assert.equal(seed.body.seedTicket.issuedAt, Math.floor(stack.nowMs() / 1000), 'the server clock follows the chain clock');
  // The production adapter is what runs: an undeclared parameter, a wrong method, a missing Bearer.
  assert.deepEqual([(await stack.api('GET', '/api/leaderboard?game=chikun&cachebust=1')).body.error], ['invalid-query']);
  assert.equal((await stack.api('GET', '/api/settle')).status, 405);
  assert.deepEqual([(await stack.api('POST', '/api/settle', { body: { v: 'x' } })).status], [401]);
});

test('the driver plays one Ranked session per game in process, and every negative check holds', async () => {
  const { stack } = state;
  const player = stack.wallets.player1;
  const logs = [];
  const report = await runRankedE2E({
    target: 'local', transport: 'in-process', api: stack.api, chain: stack.driverChain(), wallets: { player, second: stack.wallets.player2 },
    cronSecret: stack.cronSecret(), domain: '127.0.0.1', local: stack.localControls, log: (line) => logs.push(line),
  });
  assert.equal(report.ok, true, JSON.stringify(report.failures));
  assert.deepEqual(Object.keys(report.games), DEFAULT_GAMES);
  for (const gameId of DEFAULT_GAMES) {
    const game = report.games[gameId];
    assert.deepEqual(game.checks.map((check) => check.id), checksFor(gameId), gameId);
    assert.ok(game.checks.every((check) => check.ok), gameId);
    assert.deepEqual([game.prior.confirmedRuns, game.prior.achievements], [0, []], `${gameId}: a fresh wallet`);
    assert.equal(game.leaderboard.walletBest, true, `${gameId}: a first run is the wallet's best`);
    assert.equal(game.entry.totalWei, '102000000000000000');
    assert.equal(game.settle.status, 'confirmed');
    assert.equal(game.settle.score, game.run.expectedScore, `${gameId}: the server replayed the same score`);
    assert.ok(game.profile.achievements.length > 0, `${gameId}: a first run earns achievements`);
    assert.equal(game.share.ogImage, `https://lestersarcade.io/api/share-card/${game.shareId}.png?v=${game.share.cardRev}`);
    assert.equal(game.runWait.mode, 'increaseTime', 'chain time was advanced, never slept');
    assert.ok(game.runWait.waitedSeconds >= game.run.survivalSeconds - 1, `${gameId}: the run length passed on the chain clock`);
    assert.deepEqual(game.indexCron.second, { scores: 0, achievements: 0, profiles: 0 }, `${gameId}: the index cron is idempotent`);
  }
  assert.ok(report.games.chikun.run.survivalSeconds >= 60 && report.games.chikun.run.survivalSeconds <= 150, 'Chikun is a 1-2 minute bot run');
  assert.equal(report.games.chikun.run.claimScore, report.games.chikun.settle.score * 1000 + 7);
  assert.equal(report.games.stacked.run.ticks >= 3600, true, 'STACKED tops out after tick 3600');

  const negatives = Object.fromEntries(report.negatives.map((check) => [check.id, check]));
  assert.deepEqual(Object.keys(negatives), NEGATIVE_CHECKS);
  for (const check of report.negatives) assert.deepEqual([check.ok, check.skipped ?? null], [true, null], check.id);
  assert.deepEqual(negatives['unpaid-entry'].got, { status: 402, error: 'entry-not-paid', e4: 404 });
  assert.deepEqual([negatives['fees-disabled-entry'].got.status, negatives['fees-disabled-entry'].got.error], [402, 'entry-underpaid']);
  assert.deepEqual([negatives['evidence-copied-to-another-wallet'].copier, negatives['evidence-copied-to-another-wallet'].got], ['second funded wallet (paid)', { status: 400, error: 'evidence-seed-mismatch' }]);
  assert.deepEqual(negatives['ephemeral-wallet-token'].got.full, [403, 'wallet-mismatch']);
  assert.deepEqual(negatives['settlement-paused'].got, { seed: [503, 'settlement-paused'], settle: [503, 'settlement-paused'], retryCron: [503, 'settlement-paused'], resumed: 200 });
  assert.equal(await localContracts(stack.record, stack.chain.provider).rankedEntry.entryFeeEnabled(), true, 'fees are back on');
  assert.equal(stack.env.SETTLEMENT_PAUSED, undefined, 'settlement is resumed');

  // The records the run left: three confirmed sessions for the player and nothing from any negative.
  const sessions = await stack.db.query('SELECT wallet, game_id, status FROM verified_sessions ORDER BY game_id');
  assert.deepEqual(sessions.map((row) => [row.wallet, row.game_id, row.status]), [
    [player.address.toLowerCase(), 'chikun', 'confirmed'], [player.address.toLowerCase(), 'lester-blaster', 'confirmed'], [player.address.toLowerCase(), 'stacked', 'confirmed'],
  ]);
  assert.equal((await stack.db.query('SELECT count(*)::int AS n FROM session_evidence'))[0].n, 3);
  const [profile] = await stack.db.query('SELECT display_name, avatar_uri FROM wallet_profiles WHERE wallet = $1', [player.address.toLowerCase()]);
  assert.deepEqual(profile, { display_name: profileNameFor('stacked', player.address), avatar_uri: 'lestersarcade:avatar/gold-emblem' });

  // No secret reaches the report or the log.
  const text = `${JSON.stringify(report)}\n${logs.join('\n')}`;
  const keys = localWalletKeys();
  for (const secret of [stack.env.SESSION_SECRET, stack.env.CRON_SECRET, keys.verifier, keys.relayer, keys.player1, keys.player2, keys.operator]) {
    assert.equal(text.includes(secret) || text.includes(secret.slice(2)), false, 'a secret leaked into the report or the log');
  }
  assert.doesNotMatch(text, /Bearer|"mac"|"token"/);
});

test('a second run by the same wallet passes as "not the wallet\'s best", and a rejected request that CHANGES a row fails its negative check', async () => {
  const { stack } = state;
  // player1 already holds this week's Chikun best (a 1-2 minute run) and its first-run achievements.
  const player = stack.wallets.player1;
  // A server that answers 403 or 503 correctly but also UPDATEs the targeted session (no row added or
  // removed): the content snapshot must catch it.
  const tampered = [];
  const api = async (method, path, init) => {
    const response = await stack.api(method, path, init);
    if (method === 'POST' && path === '/api/settle' && [403, 503].includes(response.status) && init?.body?.sessionId32) {
      const rows = await stack.db.query("UPDATE verified_sessions SET attempts = attempts + 9, last_error = 'tampered' WHERE session_id32 = $1 RETURNING session_id32", [init.body.sessionId32]);
      tampered.push(`${response.status} ${response.body?.error} updated ${rows.length}`);
    }
    return response;
  };
  const report = await runRankedE2E({
    target: 'local', transport: 'in-process', api, chain: stack.driverChain(), wallets: { player, second: stack.wallets.player2 }, games: ['chikun'],
    evidence: { chikun: { profile: 'expert', maxMinutes: 0.25 } }, cronSecret: stack.cronSecret(), domain: '127.0.0.1', local: stack.localControls,
  });
  const game = report.games.chikun;
  assert.equal(game.ok, true, JSON.stringify(game.checks.filter((check) => !check.ok)));
  assert.deepEqual(game.checks.map((check) => check.id), checksFor('chikun'));
  assert.ok(game.prior.confirmedRuns >= 1 && game.prior.achievements.length > 0, 'the wallet had played before');
  // E5 shows the earlier, better row (D1); the check records it instead of failing.
  const board = game.checks.find((check) => check.id === 'leaderboard-row');
  assert.equal(game.leaderboard.walletBest, false);
  assert.ok(board.detail.walletBest.score > game.settle.score && board.detail.walletBest.sessionId32 !== game.sessionId32, JSON.stringify(board.detail));
  assert.match(board.detail.note, /not the wallet's best/);
  // This run is still confirmed on E9 with its own transaction.
  assert.ok(game.checks.find((check) => check.id === 'share-session').ok);
  const achievementsCheck = game.checks.find((check) => check.id === 'profile-achievements');
  assert.ok(achievementsCheck.ok && (game.settle.achievements.length > 0 || /nothing new/.test(achievementsCheck.detail.note)), JSON.stringify(achievementsCheck));

  // The tampering: both 403 POSTs of the ephemeral-wallet check and the paused 503 changed a row.
  assert.deepEqual(tampered, ['403 wallet-mismatch updated 1', '403 wallet-mismatch updated 1', '503 settlement-paused updated 1']);
  const negatives = Object.fromEntries(report.negatives.map((check) => [check.id, check]));
  assert.deepEqual(Object.keys(negatives), NEGATIVE_CHECKS);
  assert.deepEqual([negatives['ephemeral-wallet-token'].ok, negatives['settlement-paused'].ok], [false, false], 'a changed row fails the check although the answers were right');
  assert.deepEqual([negatives['ephemeral-wallet-token'].got.full, negatives['settlement-paused'].got.settle], [[403, 'wallet-mismatch'], [503, 'settlement-paused']]);
  for (const id of ['tampered-chikun-claim', 'unpaid-entry', 'fees-disabled-entry', 'evidence-copied-to-another-wallet']) assert.equal(negatives[id].ok, true, id);
  assert.deepEqual(report.failures, ['negative:ephemeral-wallet-token', 'negative:settlement-paused']);
  assert.equal(report.ok, false);
});

test('the driver reports a broken endpoint as a failed check instead of passing or throwing', async () => {
  const { stack } = state;
  // E3 answers 503 settlement-paused for every call: the run stops at the settle step, the report says
  // why, and the negative checks that need a settled run are reported as not run.
  const api = (method, path, init) => (method === 'POST' && path === '/api/settle'
    ? Promise.resolve({ status: 503, headers: { 'content-type': 'application/json' }, body: { ok: false, error: 'settlement-paused' } })
    : stack.api(method, path, init));
  const report = await runRankedE2E({
    target: 'local', api, chain: stack.driverChain(), wallets: { player: stack.wallets.player2 }, games: ['chikun'],
    evidence: { chikun: { profile: 'expert', maxMinutes: 0.25 } }, cronSecret: stack.cronSecret(), domain: '127.0.0.1', local: stack.localControls,
  });
  assert.equal(report.ok, false);
  const game = report.games.chikun;
  assert.equal(game.ok, false);
  assert.deepEqual(game.checks.at(-1), { id: 'settle', ok: false, detail: 'settle failed: E3 answered 503 settlement-paused' });
  assert.ok(game.checks.slice(0, -1).every((check) => check.ok), 'every step before the settle passed');
  assert.deepEqual(report.failures, ['chikun:settle', 'negative:negatives']);
  await assert.rejects(runRankedE2E({ api, chain: stack.driverChain(), wallets: { player: stack.wallets.player2 }, games: ['tetris'], domain: 'x' }), /unknown ranked game/);
  await assert.rejects(runRankedE2E({ api, chain: { provider: stack.chain.provider, deployment: stack.deployment }, wallets: { player: stack.wallets.player2 }, domain: 'x' }), /relayer address/);
});

test('the committed rehearsal report records a passing local rehearsal on both transports and phase 2', () => {
  const path = new URL('../docs/qa/pre-deployment-rehearsal-20260923.json', import.meta.url);
  assert.ok(existsSync(path), 'node scripts/rehearse-ranked-e2e.mjs --target local writes the report');
  const report = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(report.schema, REHEARSAL_SUMMARY_SCHEMA);
  assert.equal(report.ok, true);
  assert.deepEqual(report.runs.map((run) => [run.schema, run.transport, run.target, run.ok]), [[REHEARSAL_REPORT_SCHEMA, 'in-process', 'local', true], [REHEARSAL_REPORT_SCHEMA, 'http', 'live', true]]);
  // The report matches the CURRENT driver: a driver change that adds, drops or renames a check makes
  // this fail until the report is regenerated (node scripts/rehearse-ranked-e2e.mjs --target local).
  for (const run of report.runs) {
    assert.deepEqual(Object.keys(run.games), DEFAULT_GAMES);
    for (const gameId of DEFAULT_GAMES) assert.deepEqual(run.games[gameId].checks.map((check) => [check.id, check.ok]), checksFor(gameId).map((id) => [id, true]), `${run.transport} ${gameId}`);
    assert.deepEqual(run.negatives.map((check) => check.id), NEGATIVE_CHECKS, run.transport);
    assert.ok(run.negatives.every((check) => check.ok), run.transport);
  }
  // The HTTP run had a second funded wallet, so the evidence copy was checked, not skipped.
  const copied = Object.fromEntries(report.runs.map((run) => [run.transport, run.negatives.find((check) => check.id === 'evidence-copied-to-another-wallet')]));
  assert.deepEqual([copied['in-process'].got, copied.http.got, copied.http.skipped ?? null], [{ status: 400, error: 'evidence-seed-mismatch' }, { status: 400, error: 'evidence-seed-mismatch' }, null]);
  assert.deepEqual(report.phase2.steps.map((step) => step.id), ['settled-run', 'phase1-proposal', 'test-setup-rows', 'define-approved-subset', 'backfill-plan', 'resync-flags', 'backfill-mint', 'index-stamps-token', 'profile-token', 'profile-approved-catalog', 'token-uri', 'second-backfill-mints-nothing']);
  assert.equal(report.phase2.ok, true);
  assert.doesNotMatch(JSON.stringify(report), /Bearer|"mac"|"token"|PRIVATE_KEY/);
});
