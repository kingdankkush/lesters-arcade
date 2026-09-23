import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

import {
  applyVercelRewrites, compileVercelRewrites, createVercelRouter, listApiModules, LOCAL_ALLOWED_DOMAINS, readVercelConfig, startLocalStack, vercelAppendedParams,
} from '../scripts/lib/local-stack.mjs';
import { localContracts, localWalletKeys } from '../scripts/lib/local-chain.mjs';
import { DEFAULT_GAMES, profileNameFor, runRankedE2E } from '../scripts/lib/rehearsal-driver.mjs';
import { buildSiweChallenge } from '../apps/portal/src/wallet-auth.mjs';
import { RANKED_GAMES } from '../apps/portal/src/ranked-identity.mjs';

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
  ];
  for (const [url, module, routed] of cases) assert.deepEqual([router.route(url).kind, router.route(url).module, router.route(url).url], ['api', module, routed], url);
  for (const url of [`/s/${HEX64}0`, `/api/share-card/${HEX64}.jpg`, '/api/nope', `/api/session/${HEX64.slice(1)}`]) assert.equal(router.route(url).kind, 'none', url);
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
  const perGame = ['siwe', 'seed-ticket', 'session-handle', 'ticket-seed-applied', 'session-key', 'entry-quote', 'entry-paid', 'settle-body', 'settle-confirmed', 'server-score',
    'settle-tx', 'status-owner-view', 'status-public-view', 'chain-session', 'chain-envelope', 'relayer-published', 'duplicate-post', 'leaderboard-row', 'profile-stats',
    'profile-achievements', 'share-session', 'share-page', 'share-card', 'profile-name-valid', 'profile-set', 'profile-refresh', 'profile-name', 'index-cron', 'index-cron-idempotent'];
  for (const gameId of DEFAULT_GAMES) {
    const game = report.games[gameId];
    assert.deepEqual(game.checks.map((check) => check.id), gameId === 'chikun' ? [...perGame.slice(0, 10), 'tampered-claim-ignored', ...perGame.slice(10)] : perGame, gameId);
    assert.ok(game.checks.every((check) => check.ok), gameId);
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
  assert.deepEqual(Object.keys(negatives), ['tampered-chikun-claim', 'unpaid-entry', 'fees-disabled-entry', 'evidence-copied-to-another-wallet', 'ephemeral-wallet-token', 'settlement-paused']);
  for (const check of report.negatives) assert.deepEqual([check.ok, check.skipped ?? null], [true, null], check.id);
  assert.deepEqual(negatives['unpaid-entry'].got, { status: 402, error: 'entry-not-paid', e4: 404 });
  assert.deepEqual([negatives['fees-disabled-entry'].got.status, negatives['fees-disabled-entry'].got.error], [402, 'entry-underpaid']);
  assert.deepEqual(negatives['evidence-copied-to-another-wallet'].got, { status: 400, error: 'evidence-seed-mismatch' });
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
