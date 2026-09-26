import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ethers } from 'ethers';

import { jsonRpcProvider, startLocalStack, writeLocalAddressModule } from '../scripts/lib/local-stack.mjs';
import { startLocalHttp, startRpcProxy, withConnectSrc } from '../scripts/lib/local-http.mjs';
import { localWalletKeys } from '../scripts/lib/local-chain.mjs';
import { DEFAULT_GAMES, createFetchApi, runRankedE2E } from '../scripts/lib/rehearsal-driver.mjs';
import { checkLiveFlags, LIVE_CONFIRM, negativeSourceGame, parseGames, parseSite, runRehearsalCli } from '../scripts/rehearse-ranked-e2e.mjs';
import { renderLitvmAddressModule, resolveDeploymentInput } from '../scripts/generate-litvm-addresses.mjs';

/**
 * Rehearsal slice, acceptance 3-4: the SAME driver over real HTTP and JSON-RPC. The local stack is
 * served by scripts/lib/local-http.mjs (node:http, the vercel.json rewrites, each module's A30 seam)
 * and its chain by the JSON-RPC proxy, and the run goes through the CLI's `--target live` path exactly
 * as runbook step 9 will: keys and the cron secret read from fixture files under the OS temp
 * directory through key-source.mjs, the plan printed first, `--yes` required, the local-only negative
 * checks skipped. The only stand-in allowance is the loopback one the CLI grants itself: a
 * `--deployment` module for the local chain and chain time advanced over the proxy instead of waited.
 */

const state = { stack: null, http: null, rpc: null, dir: null, module: null };
before(async () => {
  state.stack = await startLocalStack();
  state.http = await startLocalHttp(state.stack);
  state.rpc = await startRpcProxy(state.stack);
  state.dir = mkdtempSync(join(tmpdir(), 'lesters-rehearsal-http-'));
  state.module = writeLocalAddressModule(state.stack.record, state.dir);
});
after(async () => {
  await state.http?.close();
  await state.rpc?.close();
  await state.stack?.close();
  if (state.dir) rmSync(state.dir, { recursive: true, force: true });
});

const refusingReadFile = () => { throw new Error('a secret file was read before the flags were validated'); };

test('the live CLI refuses to start without every flag, and reads no secret before it has them all', async () => {
  const full = ['--target', 'live', '--site', 'https://lestersarcade.io', '--rpc', 'https://liteforge.rpc.caldera.xyz/http', '--player-key-file', 'C:/nowhere/player.key', '--cron-secret-file', 'C:/nowhere/cron.txt', '--confirm-live', LIVE_CONFIRM];
  assert.equal(checkLiveFlags(full).ok, true);
  for (const flag of ['--site', '--rpc', '--player-key-file', '--cron-secret-file', '--confirm-live']) {
    const index = full.indexOf(flag);
    const argv = [...full.slice(0, index), ...full.slice(index + 2)];
    const logs = [];
    // eslint-disable-next-line no-await-in-loop
    const exit = await runRehearsalCli({ argv, log: (line) => logs.push(line), readFile: refusingReadFile, providerFactory: () => { throw new Error('no provider before the flags'); } });
    assert.equal(exit, 2, flag);
    assert.match(logs.join('\n'), flag === '--cron-secret-file' ? /missing --cron-secret-file \| --cron-secret-env/ : new RegExp(`missing ${flag}`), flag);
  }
  const wrongPhrase = [...full.slice(0, -1), 'yes please'];
  assert.equal(checkLiveFlags(wrongPhrase).ok, false);
  assert.equal(await runRehearsalCli({ argv: wrongPhrase, log: () => {}, readFile: refusingReadFile }), 2);
  assert.equal(checkLiveFlags([...full, '--cron-secret-env', 'CRON']).ok, false, 'one cron secret source only');
  // A `predicted` address module (before runbook step 3): the live run stops before reading any key.
  const predicted = join(state.dir, 'predicted-addresses.mjs');
  writeFileSync(predicted, renderLitvmAddressModule(resolveDeploymentInput({ mode: 'predicted' })), 'utf8');
  const loopback = full.map((arg) => (arg === 'https://liteforge.rpc.caldera.xyz/http' ? 'http://127.0.0.1:9' : arg));
  const logs = [];
  assert.equal(await runRehearsalCli({ argv: [...loopback, '--deployment', predicted], log: (line) => logs.push(line), readFile: refusingReadFile, providerFactory: () => { throw new Error('no provider'); } }), 2);
  assert.match(logs.join('\n'), /address module is 'predicted', not 'deployed'/);
  // A local address module is accepted only with a loopback RPC.
  assert.equal(await runRehearsalCli({ argv: [...full, '--deployment', state.module], log: () => {}, readFile: refusingReadFile }), 2);
  // --games: a subset of the three, in the driver's order; anything else is refused before any key is read.
  assert.deepEqual(parseGames(null), DEFAULT_GAMES);
  assert.deepEqual(parseGames('stacked,chikun'), ['chikun', 'stacked']);
  for (const bad of ['', 'tetris', 'chikun,tetris']) assert.throws(() => parseGames(bad), /--games takes/);
  assert.deepEqual([negativeSourceGame(DEFAULT_GAMES), negativeSourceGame(['stacked', 'lester-blaster'])], ['chikun', 'stacked']);
  const badGames = [];
  assert.equal(await runRehearsalCli({ argv: [...full, '--games', 'tetris'], log: (line) => badGames.push(line), readFile: refusingReadFile, providerFactory: () => { throw new Error('no provider'); } }), 2);
  assert.match(badGames.join('\n'), /--games takes/);
  // The local target never takes live flags; live origins must be https (http only on loopback).
  assert.equal(await runRehearsalCli({ argv: ['--player-key-file', 'x'], log: () => {} }), 2);
  assert.equal(await runRehearsalCli({ argv: ['--second-key-file', 'x'], log: () => {} }), 2);
  assert.equal(parseSite('https://lestersarcade.io'), 'https://lestersarcade.io');
  assert.equal(parseSite('http://127.0.0.1:8842'), 'http://127.0.0.1:8842');
  for (const bad of ['http://lestersarcade.io', 'https://lestersarcade.io/api', 'https://user:pw@lestersarcade.io']) assert.throws(() => parseSite(bad), bad);
});

test('local-http serves the handlers behind the vercel.json rewrites and a static web root with the vercel.json headers', async () => {
  const api = createFetchApi(state.http.origin);
  const nonce = await api('GET', '/api/session/nonce');
  assert.equal(nonce.status, 200);
  assert.match(nonce.body.nonce, /^[0-9a-f]{72}$/);
  const missing = await api('GET', `/api/session/${'ab'.repeat(32)}`);
  assert.deepEqual([missing.status, missing.body.error], [404, 'session-not-found'], 'E9 through the /api/session/:id rewrite');
  const query = await api('GET', '/api/leaderboard?game=chikun&utm_source=x');
  assert.deepEqual([query.status, query.body.error], [400, 'invalid-query']);
  assert.equal((await api('GET', '/api/does-not-exist')).status, 404);
  assert.match(state.stack.env.SESSION_ALLOWED_DOMAINS, new RegExp(`127\\.0\\.0\\.1:${state.http.port}`), 'the served host may sign in');

  const web = await startLocalHttp(state.stack, { staticRoot: fileURLToPath(new URL('../apps/portal/', import.meta.url)), applyVercelHeaders: true, extraConnectSrc: [state.rpc.url], allowSignInHost: false });
  try {
    const home = await fetch(`${web.origin}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(await home.text(), /<html/i);
    const csp = home.headers.get('content-security-policy');
    assert.match(csp, /frame-ancestors 'none'/);
    assert.ok(csp.split('; ').find((directive) => directive.startsWith('connect-src ')).endsWith(state.rpc.url), 'the proxy origin is appended to connect-src');
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    const discover = await fetch(`${web.origin}/games/chikun`);
    assert.equal(discover.status, 200, '/games/chikun rewrites to the discover page');
    const share = await fetch(`${web.origin}/s/${'ab'.repeat(32)}`);
    assert.equal(share.status, 404, 'an unknown share id is the 404 page of the share-page function, not a static miss');
    assert.match(await share.text(), /og:image/);
    assert.match(share.headers.get('x-robots-tag'), /^noindex/);
    assert.equal((await fetch(`${web.origin}/..%2Fpackage.json`)).status, 404);
  } finally {
    await web.close();
  }
  assert.equal(withConnectSrc("default-src 'self'; connect-src 'self' https://a", ['http://127.0.0.1:1']), "default-src 'self'; connect-src 'self' https://a http://127.0.0.1:1");
});

test('the live CLI plays one Ranked session per game over HTTP and JSON-RPC: plan first, --yes to spend, no secret printed', async () => {
  const keys = localWalletKeys();
  const playerKeyFile = join(state.dir, 'player.key');
  const secondKeyFile = join(state.dir, 'second.json');
  const cronFile = join(state.dir, 'cron-secret.txt');
  writeFileSync(playerKeyFile, `${keys.player1}\n`, 'utf8');
  writeFileSync(secondKeyFile, JSON.stringify({ copier: { privateKey: keys.player2 } }), 'utf8');
  writeFileSync(cronFile, `${state.stack.cronSecret()}\n`, 'utf8');
  const provider = jsonRpcProvider(state.rpc.url);
  const player = state.stack.wallets.player1.address;
  const second = state.stack.wallets.player2.address;
  const base = ['--target', 'live', '--site', state.http.origin, '--rpc', state.rpc.url, '--player-key-file', playerKeyFile, '--confirm-live', LIVE_CONFIRM, '--deployment', state.module];
  const withSecond = ['--second-key-file', secondKeyFile, '--second-key-field', 'copier'];
  const secrets = [keys.player1, keys.player1.slice(2), keys.player2, keys.player2.slice(2), state.stack.cronSecret(), state.stack.env.SESSION_SECRET, keys.relayer, keys.verifier];
  try {
    // Plan only: the cron secret from an environment variable NAME this time; nothing is sent.
    const planLogs = [];
    const nonceBefore = await provider.getTransactionCount(player, 'latest');
    const planExit = await runRehearsalCli({ argv: [...base, ...withSecond, '--cron-secret-env', 'REHEARSAL_CRON_SECRET'], env: { REHEARSAL_CRON_SECRET: state.stack.cronSecret() }, log: (line) => planLogs.push(line) });
    assert.equal(planExit, 0);
    const plan = planLogs.join('\n');
    for (const gameId of DEFAULT_GAMES) assert.match(plan, new RegExp(`entry ${gameId}: 0\\.102 zkLTC \\(fee 0\\.1 \\+ reserve 0\\.002\\)`));
    assert.match(plan, /total 0\.306 zkLTC in entries/);
    assert.match(plan, new RegExp(`Second wallet ${second.toLowerCase()}, balance [0-9.]+ zkLTC: one chikun entry of 0\\.102 zkLTC for the evidence-copy check`));
    assert.doesNotMatch(plan, /WARNING/, 'a fresh wallet has no earlier runs');
    assert.match(plan, /Owner checkpoint O2/);
    assert.match(plan, /PLAN ONLY\. Nothing was signed or sent/);
    assert.equal(await provider.getTransactionCount(player, 'latest'), nonceBefore, 'the plan sends nothing');
    // --games (a retry of what failed) plans only those; without a second wallet the copy check is announced as skipped.
    const oneLogs = [];
    assert.equal(await runRehearsalCli({ argv: [...base, '--games', 'chikun', '--cron-secret-file', cronFile], env: {}, log: (line) => oneLogs.push(line) }), 0);
    assert.match(oneLogs.join('\n'), /entry chikun: 0\.012 zkLTC/);
    assert.doesNotMatch(oneLogs.join('\n'), /entry (stacked|lester-blaster)/);
    assert.match(oneLogs.join('\n'), /total 0\.012 zkLTC in entries/);
    assert.match(oneLogs.join('\n'), /the evidence-copy check is skipped, as it needs a second funded wallet/);
    // A wallet that cannot pay is refused after the plan, before anything is signed.
    const brokeFile = join(state.dir, 'broke.key');
    writeFileSync(brokeFile, `${ethers.Wallet.createRandom().privateKey}\n`, 'utf8');
    const brokeLogs = [];
    const brokeArgv = base.map((arg) => (arg === playerKeyFile ? brokeFile : arg));
    assert.equal(await runRehearsalCli({ argv: [...brokeArgv, '--cron-secret-file', cronFile, '--yes'], env: {}, log: (line) => brokeLogs.push(line) }), 2);
    assert.match(brokeLogs.join('\n'), /Live run refused: the player balance does not cover the 3 entries and the gas margin/);
    // The player cannot double as the second wallet.
    const sameLogs = [];
    assert.equal(await runRehearsalCli({ argv: [...base, '--second-key-file', playerKeyFile, '--cron-secret-file', cronFile], env: {}, log: (line) => sameLogs.push(line) }), 2);
    assert.match(sameLogs.join('\n'), /the second wallet must differ from the player/);

    // The run: the cron secret from a file, a second funded wallet for the evidence copy, the report to a temp path.
    const out = join(state.dir, 'live-report.json');
    const runLogs = [];
    const exit = await runRehearsalCli({ argv: [...base, ...withSecond, '--cron-secret-file', cronFile, '--yes', '--out', out], env: {}, log: (line) => runLogs.push(line) });
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(exit, 0, JSON.stringify(report.failures));
    assert.equal(report.ok, true);
    assert.deepEqual([report.target, report.transport, report.site, report.signInDomain], ['live', 'http', state.http.origin, `127.0.0.1:${state.http.port}`]);
    assert.equal(report.player, player.toLowerCase());
    assert.deepEqual(Object.keys(report.games), DEFAULT_GAMES);
    for (const gameId of DEFAULT_GAMES) {
      const game = report.games[gameId];
      assert.ok(game.ok && game.checks.every((check) => check.ok), gameId);
      assert.equal(game.settle.status, 'confirmed');
      assert.equal(game.runWait.mode, 'increaseTime', 'loopback stand-in: chain time advanced over the proxy');
      assert.match(game.share.url, /^https:\/\/lestersarcade\.io\/s\/[0-9a-f]{64}$/);
      assert.ok(game.share.cardBytes > 10_000, `${gameId}: a real PNG over HTTP`);
    }
    const negatives = Object.fromEntries(report.negatives.map((check) => [check.id, check]));
    assert.deepEqual([negatives['fees-disabled-entry'].skipped, negatives['settlement-paused'].skipped], ['local-only', 'local-only'], 'the local-only negatives are skipped on a live target');
    assert.deepEqual(negatives['unpaid-entry'].got, { status: 402, error: 'entry-not-paid', e4: 404 });
    // With the second funded wallet the copy reaches the verifier (a paid entry at another seed).
    assert.deepEqual([negatives['evidence-copied-to-another-wallet'].ok, negatives['evidence-copied-to-another-wallet'].copier, negatives['evidence-copied-to-another-wallet'].got], [true, 'second funded wallet (paid)', { status: 400, error: 'evidence-seed-mismatch' }]);
    assert.deepEqual(negatives['ephemeral-wallet-token'].got.full, [403, 'wallet-mismatch']);
    assert.ok(negatives['tampered-chikun-claim'].ok);
    assert.equal(report.plan.entries.length, 3);
    assert.deepEqual([report.plan.second.wallet, report.plan.second.gameId], [second.toLowerCase(), 'chikun']);
    assert.match(report.o2Reminder, /board/);

    // A second plan for the same wallet warns before anything is spent again.
    const againLogs = [];
    assert.equal(await runRehearsalCli({ argv: [...base, '--cron-secret-file', cronFile], env: {}, log: (line) => againLogs.push(line) }), 0);
    for (const gameId of DEFAULT_GAMES) assert.match(againLogs.join('\n'), new RegExp(`WARNING: the player already has 1 confirmed ${gameId} run\\(s\\)`));

    const text = `${planLogs.join('\n')}\n${oneLogs.join('\n')}\n${brokeLogs.join('\n')}\n${sameLogs.join('\n')}\n${runLogs.join('\n')}\n${againLogs.join('\n')}\n${readFileSync(out, 'utf8')}`;
    for (const secret of secrets) assert.equal(text.includes(secret), false, 'no key or secret is printed or reported');
    assert.doesNotMatch(text, /Bearer|"mac"|"token"/);
  } finally {
    provider.destroy();
  }
});

// Runs last: it moves the stand-in's server clock ahead of its chain.
test('the live path settles on a chain that makes no blocks while it waits (LiteForge), and skips the evidence copy without a second wallet', async () => {
  const { stack } = state;
  const provider = jsonRpcProvider(state.rpc.url);
  try {
    const player = new ethers.Wallet(stack.chain.wallets.player2.privateKey, provider);
    const blockBefore = await provider.getBlockNumber();
    // No advanceTime: the driver waits "real" time. Its clock is the server's, and its sleep moves only
    // the server's clock, as wall time passes on Orbit while the latest block stays the entry's.
    const report = await runRankedE2E({
      target: 'live', transport: 'http', api: createFetchApi(state.http.origin),
      chain: { provider, deployment: stack.deployment, relayer: stack.record.relayer },
      wallets: { player }, games: ['chikun'], evidence: { chikun: { profile: 'expert', maxMinutes: 0.25 } },
      cronSecret: stack.cronSecret(), site: state.http.origin,
      now: () => stack.nowMs(), sleep: async (ms) => { stack.advanceServerClock(ms / 1000); },
    });
    assert.equal(report.ok, true, JSON.stringify(report.failures));
    const game = report.games.chikun;
    assert.ok(game.run.survivalSeconds > 1, 'a real (short) run');
    assert.equal(game.runWait.mode, 'real-time');
    assert.ok(game.runWait.waitedSeconds >= game.run.survivalSeconds - 1, JSON.stringify(game.runWait));
    assert.deepEqual(game.runWait.latestBlockTimestamp, { before: game.entry.openedAt, after: game.entry.openedAt }, 'no block was made while the driver waited');
    assert.equal(game.entry.blockNumber, blockBefore + 1, 'the entry was the only block before the settle');
    assert.equal(game.settle.status, 'confirmed');
    const negatives = Object.fromEntries(report.negatives.map((check) => [check.id, check]));
    assert.deepEqual(negatives['evidence-copied-to-another-wallet'], { id: 'evidence-copied-to-another-wallet', ok: true, skipped: 'needs a second funded wallet' });
    assert.deepEqual([negatives['fees-disabled-entry'].skipped, negatives['settlement-paused'].skipped], ['local-only', 'local-only']);
    assert.deepEqual(negatives['ephemeral-wallet-token'].got.full, [403, 'wallet-mismatch']);
    assert.deepEqual(report.failures, []);
  } finally {
    provider.destroy();
  }
});
