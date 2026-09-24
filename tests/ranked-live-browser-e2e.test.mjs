// The live-flag browser run's pure parts (browser-e2e slice): argument guards, the throwaway build
// transforms, the entry and share checks, and the browser-side RPC stand-in. The browser run itself
// needs Playwright and Chrome, so it runs outside npm test (docs/qa/ranked-live-browser-e2e-20260923.json).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ethers } from 'ethers';

import {
  checkLiveFlags,
  checkShareLink,
  cleanupOnSignal,
  decodeEntryCall,
  flipFlagsSource,
  GAME_ORDER,
  LIVE_CONFIRM,
  LIVE_GAS_MARGIN_WEI,
  linkPortalTree,
  parseGames,
  pointRpcSource,
  rankedEntryOnly,
  redactUrl,
  removeThrowaway,
  repoGuardSnapshot,
  runCli,
  SEED_TICKET_OK,
  seedTicketCalls,
  sourceRevision,
  startBrowserRpcProxy,
  targetOf,
  throwawayBundlePlugin,
} from '../scripts/ranked-live-browser-e2e.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SESSION = `0x${'ab'.repeat(32)}`;
const SHARE_URL = `https://lestersarcade.io/s/${'ab'.repeat(32)}`;
const intent = (text, url = SHARE_URL, extra = '') => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&related=LestersArcade${extra}`;

test('games run in the brief order (Chikun first) and --games takes a subset', () => {
  assert.deepEqual(GAME_ORDER, ['chikun', 'stacked', 'lester-blaster']);
  assert.deepEqual(parseGames(null), ['chikun', 'stacked', 'lester-blaster']);
  assert.deepEqual(parseGames('lester-blaster,chikun'), ['chikun', 'lester-blaster']);
  assert.throws(() => parseGames('chikun,pong'), /unknown: pong/);
  assert.throws(() => parseGames(''), /comma list/);
});

test('the live target needs every flag and the exact confirm phrase', () => {
  assert.equal(targetOf([]), 'local');
  assert.equal(targetOf(['--live']), 'live');
  assert.equal(targetOf(['--target', 'live']), 'live');
  const missing = checkLiveFlags(['--live']);
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.missing, ['--site', '--rpc', '--player-key-file', '--confirm-live']);
  const full = ['--live', '--site', 'https://lestersarcade.io', '--rpc', 'https://liteforge.rpc.caldera.xyz/http', '--player-key-file', 'C:/keys/player.json', '--confirm-live', LIVE_CONFIRM];
  assert.equal(checkLiveFlags(full).ok, true);
  assert.equal(checkLiveFlags(full.map((arg) => (arg === LIVE_CONFIRM ? 'yes' : arg))).ok, false);
  assert.deepEqual(checkLiveFlags(full.map((arg) => (arg === 'https://lestersarcade.io' ? 'http://lestersarcade.io' : arg))).problems, ['--site must be a bare https origin such as https://lestersarcade.io']);
});

test('the CLI refuses before starting anything or reading a key', async () => {
  const lines = [];
  const log = (line) => lines.push(line);
  assert.equal(await runCli({ argv: ['--target', 'local', '--player-key-file', 'x.json'], log }), 2);
  assert.match(lines.join('\n'), /--player-key-file belongs to --live/);
  lines.length = 0;
  assert.equal(await runCli({ argv: ['--live', '--site', 'https://lestersarcade.io'], log }), 2);
  assert.match(lines.join('\n'), /missing --rpc/);
  lines.length = 0;
  assert.equal(await runCli({ argv: ['--games', 'pong'], log }), 2);
  lines.length = 0;
  // Every flag, but the address module is `predicted` (the committed one until runbook step 3): refused
  // before the key file (which does not exist) is read. The deployment is injected, so the check holds
  // before and after step 3.
  const argv = ['--live', '--site', 'https://lestersarcade.io', '--rpc', 'http://127.0.0.1:9', '--player-key-file', 'C:/does-not-exist/player.json', '--confirm-live', LIVE_CONFIRM];
  assert.equal(await runCli({ argv, log, loadDeployment: async () => ({ status: 'predicted', chainId: 4441 }) }), 2);
  assert.match(lines.join('\n'), /address module is 'predicted', not 'deployed'/);
  assert.doesNotMatch(lines.join('\n'), /player key|cannot read/);
  lines.length = 0;
  // Deployed (after step 3): the missing key file refuses before any RPC is contacted (port 9 is closed).
  assert.equal(await runCli({ argv, log, loadDeployment: async () => ({ status: 'deployed', chainId: 4441 }) }), 2);
  assert.match(lines.join('\n'), /Live run refused: .*--player-key-file/);
  assert.doesNotMatch(lines.join('\n'), /RPC reports|balance/);
});

test('a flag without a value is a refusal (exit 2), never an uncaught stack trace', async () => {
  const lines = [];
  const log = (line) => lines.push(String(line));
  for (const argv of [['--target'], ['--shots'], ['--games', 'chikun', '--out'], ['--live', '--site', 'https://lestersarcade.io', '--rpc', 'http://127.0.0.1:9', '--player-key-file', 'C:/does-not-exist/player.json', '--confirm-live']]) {
    lines.length = 0;
    // eslint-disable-next-line no-await-in-loop
    assert.equal(await runCli({ argv, log }), 2, argv.join(' '));
    assert.match(lines.join('\n'), /refused: --[a-z-]+ needs a value/, argv.join(' '));
  }
});

test('the Chikun --live smoke refuses through runCli: exit 2 and a message, no stack trace', () => {
  const script = fileURLToPath(new URL('../scripts/chikun-ranked-browser-smoke.mjs', import.meta.url));
  const base = ['--live', '--site', 'https://lestersarcade.io', '--rpc', 'http://127.0.0.1:9', '--player-key-file', join(tmpdir(), 'lesters-no-such-key.json')];
  for (const extra of [['--confirm-live'], ['--confirm-live', LIVE_CONFIRM]]) {
    const result = spawnSync(process.execPath, [script, ...base, ...extra], { cwd: root, encoding: 'utf8', timeout: 60_000 });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 2, output);
    assert.match(result.stdout, /Live run refused: /, output);
    assert.doesNotMatch(output, /SecretSourceError|\n\s+at /, 'no uncaught exception');
  }
});

test('--live, offline: plan only without --yes, wrong chain and short balance refuse before the browser, and no key is printed', async (t) => {
  const { bootLocalChain } = await import('./helpers/settle-fixtures.mjs');
  const { serveJsonRpc } = await import('../scripts/lib/local-chain.mjs');
  const local = await bootLocalChain();
  const rpc = await serveJsonRpc(local.chain.eip1193);
  // A node on another chain (eth_chainId 0x1), for the chain refusal.
  const otherChain = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const answer = (payload) => ({ jsonrpc: '2.0', id: payload.id, ...(payload.method === 'eth_chainId' ? { result: '0x1' } : { error: { code: -32601, message: 'not here' } }) });
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(Array.isArray(parsed) ? parsed.map(answer) : answer(parsed)));
    });
  });
  await new Promise((resolve) => otherChain.listen(0, '127.0.0.1', resolve));
  const dir = mkdtempSync(join(tmpdir(), 'lesters-live-cli-'));
  t.after(async () => {
    rmSync(dir, { recursive: true, force: true });
    await new Promise((resolve) => otherChain.close(resolve));
    await rpc.close();
    await local.chain.close();
  });

  // Public Hardhat fixture key (player1), and a fresh key with no balance, in files under the OS temp dir.
  const player = local.chain.wallets.player1;
  const funded = join(dir, 'player.json');
  writeFileSync(funded, JSON.stringify({ player: { privateKey: player.privateKey } }), 'utf8');
  const poorWallet = ethers.Wallet.createRandom();
  const poor = join(dir, 'poor.txt');
  writeFileSync(poor, poorWallet.privateKey, 'utf8');
  const secrets = [player.privateKey, poorWallet.privateKey].flatMap((key) => [key.slice(2).toLowerCase(), key.slice(2).toUpperCase()]);

  const lines = [];
  const log = (line) => lines.push(String(line));
  let browserLoads = 0;
  const loadBrowser = async () => { browserLoads += 1; throw new Error('no browser in this test'); };
  const loadDeployment = async () => local.deployment;
  const argv = (rpcUrl, keyArgs, extra = []) => ['--live', '--site', 'https://lestersarcade.io', '--rpc', rpcUrl, ...keyArgs, '--confirm-live', LIVE_CONFIRM, '--games', 'chikun,stacked', ...extra];
  const fundedKey = ['--player-key-file', funded, '--player-key-field', 'player'];

  // 1. Without --yes: the plan, exit 0, nothing signed or sent (the player's nonce is unchanged).
  const nonceBefore = await local.chain.provider.getTransactionCount(player.address, 'latest');
  assert.equal(await runCli({ argv: argv(rpc.url, fundedKey), log, loadDeployment, loadBrowser }), 0);
  const plan = lines.join('\n');
  assert.match(plan, /entry chikun: 0\.102 zkLTC/);
  assert.match(plan, /entry stacked: 0\.102 zkLTC/);
  assert.match(plan, new RegExp(`player ${player.address.toLowerCase()}`));
  assert.match(plan, /PLAN ONLY\. Nothing was signed or sent\./);
  assert.equal(await local.chain.provider.getTransactionCount(player.address, 'latest'), nonceBefore);
  assert.equal(browserLoads, 0);

  // 2. An RPC on another chain: refused (exit 2) before any quote or balance is read.
  lines.length = 0;
  const otherUrl = `http://127.0.0.1:${otherChain.address().port}`;
  assert.equal(await runCli({ argv: argv(otherUrl, fundedKey, ['--yes']), log, loadDeployment, loadBrowser }), 2);
  assert.match(lines.join('\n'), /Live run refused: the RPC reports chain 1, expected 4441\./);
  assert.equal(browserLoads, 0);

  // 3. --yes with a balance below the entries plus the gas margin: refused before the browser loads.
  lines.length = 0;
  assert.ok(LIVE_GAS_MARGIN_WEI > 0n);
  assert.equal(await runCli({ argv: argv(rpc.url, ['--player-key-file', poor], ['--yes']), log, loadDeployment, loadBrowser }), 2);
  assert.match(lines.join('\n'), /Live run refused: the balance does not cover the entries and gas\./);
  assert.equal(browserLoads, 0, 'the balance gate runs before Playwright is loaded');

  // 4. --yes with the funded key passes every gate and only then loads the browser (here: a stand-in
  // that fails, so nothing is signed).
  lines.length = 0;
  assert.equal(await runCli({ argv: argv(rpc.url, fundedKey, ['--yes']), log, loadDeployment, loadBrowser }), 1);
  assert.equal(browserLoads, 1);
  assert.match(lines.join('\n'), /Live run failed: Error: no browser in this test/);
  assert.equal(await local.chain.provider.getTransactionCount(player.address, 'latest'), nonceBefore, 'still nothing sent');

  // No key, in any case, ever reached the log.
  const everything = lines.join('\n') + plan;
  for (const secret of secrets) assert.ok(!everything.includes(secret), 'a key reached the log');
});

test('the run signs only the Ranked entry of its games, for at most the quote', () => {
  const entryAddress = '0x00000000000000000000000000000000000e0717';
  const policy = rankedEntryOnly({ entryAddress: entryAddress.toUpperCase().replace('0X', '0x'), quotes: { chikun: 102n, stacked: '102' } });
  const iface = new ethers.Interface(['function openSession(bytes32 sessionId, bytes32 gameId) payable']);
  const open = (gameId) => iface.encodeFunctionData('openSession', [SESSION, ethers.id(gameId)]);
  assert.equal(policy({ to: entryAddress, value: 102n, data: open('chikun') }), true);
  assert.equal(policy({ to: entryAddress, value: 101n, data: open('stacked') }), true);
  assert.match(policy({ to: entryAddress, value: 103n, data: open('chikun') }), /more than the quoted/);
  assert.match(policy({ to: entryAddress, value: 102n, data: open('lester-blaster') }), /not a game of this run/);
  assert.match(policy({ to: '0x000000000000000000000000000000000000dead', value: 1n, data: open('chikun') }), /only ArcadeRankedEntry\.openSession/);
  assert.match(policy({ to: entryAddress, value: 0n, data: '0x12345678' }), /only ArcadeRankedEntry\.openSession/);
  assert.match(policy({ to: null, value: 0n, data: open('chikun') }), /only ArcadeRankedEntry\.openSession/);
  assert.throws(() => rankedEntryOnly({ entryAddress, quotes: {} }), TypeError);
  assert.throws(() => rankedEntryOnly({ entryAddress: 'nope', quotes: { chikun: 1n } }), TypeError);
});

test('seed-ticket calls are read from the recorded /api lines', () => {
  const lines = ['GET /api/session/nonce 200', 'POST /api/session 200', SEED_TICKET_OK, 'GET /api/profile?wallet=… 200'];
  assert.deepEqual(seedTicketCalls(lines), ['POST /api/ranked/seed 200']);
  assert.deepEqual(seedTicketCalls([...lines, 'POST /api/ranked/seed 503']), ['POST /api/ranked/seed 200', 'POST /api/ranked/seed 503']);
  assert.deepEqual(seedTicketCalls([]), []);
});

test('reports carry the git head they ran at, and whether tracked files differed', () => {
  const calls = [];
  const fake = (answers) => (command, args, options) => {
    calls.push([command, ...args].join(' '));
    assert.equal(options.cwd, root);
    const answer = answers[args[0]];
    return answer === undefined ? { status: 1, stdout: '' } : { status: 0, stdout: answer };
  };
  assert.deepEqual(sourceRevision(root, { run: fake({ 'rev-parse': 'd3d8d38e\n', status: '' }) }), { head: 'd3d8d38e', dirty: false });
  assert.deepEqual(calls, ['git rev-parse --short=8 HEAD', 'git status --porcelain --untracked-files=no']);
  const report = 'docs/qa/ranked-live-browser-e2e-20260923.json';
  assert.deepEqual(sourceRevision(root, { ignore: [report], run: fake({ 'rev-parse': 'abc12345\n', status: ` M ${report}\n` }) }), { head: 'abc12345', dirty: false }, 'the report itself does not make the run dirty');
  assert.deepEqual(sourceRevision(root, { ignore: [report], run: fake({ 'rev-parse': 'abc12345\n', status: ' M scripts/ranked-live-browser-e2e.mjs\n' }) }), { head: 'abc12345', dirty: true, changed: ['scripts/ranked-live-browser-e2e.mjs'] });
  assert.deepEqual(sourceRevision(root, { run: fake({}) }), { head: null, dirty: null }, 'no git: unknown, not clean');
  // A git checkout answers with an 8-character head; a copy without git metadata (the Vercel build,
  // which runs this suite through test:release) answers with nulls, never a made-up head.
  const real = sourceRevision(root);
  if (real.head === null) assert.equal(real.dirty, null);
  else assert.match(real.head, /^[0-9a-f]{8}$/);
});

test('the throwaway tree junctions folders, copies files, and cleanup never touches the repository', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'lesters-live-e2e-test-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  // A fake repository's apps/portal: a folder, a file, the build output and a launch-copy page.
  const portal = join(base, 'repo', 'apps', 'portal');
  mkdirSync(join(portal, 'assets', 'icons'), { recursive: true });
  mkdirSync(join(portal, 'dist'), { recursive: true });
  writeFileSync(join(portal, 'assets', 'icons', 'coin.svg'), '<svg/>');
  writeFileSync(join(portal, 'styles.css'), 'body{}');
  writeFileSync(join(portal, 'index.html'), '<!doctype html>');
  writeFileSync(join(portal, 'dist', 'main.js'), '//');
  const throwaway = join(base, 'throwaway');
  const webRoot = join(throwaway, 'web');
  mkdirSync(webRoot, { recursive: true });

  const links = linkPortalTree(portal, webRoot, []);
  assert.deepEqual(links, [join(webRoot, 'assets')]);
  assert.ok(lstatSync(join(webRoot, 'assets')).isSymbolicLink(), 'folders are junctioned, not copied');
  assert.equal(readFileSync(join(webRoot, 'assets', 'icons', 'coin.svg'), 'utf8'), '<svg/>');
  assert.equal(readFileSync(join(webRoot, 'styles.css'), 'utf8'), 'body{}');
  assert.deepEqual(readdirSync(webRoot).sort(), ['assets', 'styles.css'], 'dist and the launch-copy pages are left out');

  removeThrowaway(throwaway, links);
  assert.equal(existsSync(throwaway), false);
  assert.equal(readFileSync(join(portal, 'assets', 'icons', 'coin.svg'), 'utf8'), '<svg/>', 'the repository files behind the junction survive');
  removeThrowaway(throwaway, links); // a second call (the signal handler, then the finally) is harmless
});

test('an interrupted run cleans up before it exits, and a finished run removes the handlers', () => {
  const proc = new EventEmitter();
  const exits = [];
  let cleaned = 0;
  const dispose = cleanupOnSignal(() => { cleaned += 1; }, { proc, exit: (code) => exits.push(code) });
  assert.deepEqual(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => proc.listenerCount(signal)), [1, 1, 1]);
  proc.emit('SIGINT', 'SIGINT');
  assert.deepEqual([cleaned, exits], [1, [130]]);
  proc.emit('SIGTERM', 'SIGTERM');
  assert.deepEqual([cleaned, exits], [2, [130, 143]]);
  dispose();
  assert.deepEqual(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => proc.listenerCount(signal)), [0, 0, 0]);
  // A cleanup that throws still exits.
  const failing = cleanupOnSignal(() => { throw new Error('busy'); }, { proc, exit: (code) => exits.push(code) });
  proc.emit('SIGHUP', 'SIGHUP');
  assert.deepEqual(exits, [130, 143, 143]);
  failing();
});

test('the throwaway flag flip turns exactly the two literal flags on, and only in memory', () => {
  const committed = readFileSync(`${root}apps/portal/src/settlement.mjs`, 'utf8');
  // The preview file (the committed one until runbook step 7), whatever the committed flags are now.
  const source = committed
    .replace('export const SETTLEMENT_LIVE = true;', 'export const SETTLEMENT_LIVE = false;')
    .replace('export const HOSTED_PROFILE_SYNC = true;', 'export const HOSTED_PROFILE_SYNC = false;');
  const flipped = flipFlagsSource(source);
  assert.match(flipped, /export const SETTLEMENT_LIVE = true;/);
  assert.match(flipped, /export const HOSTED_PROFILE_SYNC = true;/);
  assert.equal(flipped.length, source.length - 2, 'false → true twice, nothing else');
  assert.equal(flipFlagsSource(flipped), flipped, 'flags already on (after step 7) stay as they are');
  assert.equal(flipFlagsSource(source.replace('export const HOSTED_PROFILE_SYNC = false;', 'export const HOSTED_PROFILE_SYNC = true;')), flipped);
  assert.throws(() => flipFlagsSource(`${source}\nexport const SETTLEMENT_LIVE = false;`), /exactly one/);
  assert.throws(() => flipFlagsSource(`${flipped}\nexport const SETTLEMENT_LIVE = false;`), /exactly one/);
  assert.throws(() => flipFlagsSource(source.replace('export const SETTLEMENT_LIVE = false;', 'export const SETTLEMENT_LIVE = !0;')), /exactly one/);
  // Only in memory: the committed file is untouched, and the guard reads what the files say.
  assert.equal(readFileSync(`${root}apps/portal/src/settlement.mjs`, 'utf8'), committed);
  const guard = repoGuardSnapshot(root);
  assert.deepEqual(guard.flags, {
    settlementLive: committed.includes('export const SETTLEMENT_LIVE = true;'),
    hostedProfileSync: committed.includes('export const HOSTED_PROFILE_SYNC = true;'),
  });
  const addresses = readFileSync(`${root}apps/portal/src/generated/litvm-addresses.mjs`, 'utf8');
  assert.equal(guard.addressStatus, /status: '([a-z]+)'/.exec(addresses)[1]);
  assert.ok(['predicted', 'deployed'].includes(guard.addressStatus));
});

test('the throwaway public RPC points LITVM_LITEFORGE_NETWORK at a loopback proxy only', () => {
  const source = readFileSync(`${root}apps/portal/src/arcade-core.mjs`, 'utf8');
  const pointed = pointRpcSource(source, 'http://127.0.0.1:61064');
  assert.match(pointed, /http: 'http:\/\/127\.0\.0\.1:61064',/);
  assert.doesNotMatch(pointed, /http: 'https:\/\/liteforge\.rpc\.caldera\.xyz\/http'/);
  assert.match(pointed, /websocket: 'wss:\/\/liteforge\.rpc\.caldera\.xyz\/ws'/, 'only the http URL changes');
  assert.throws(() => pointRpcSource(source, 'https://liteforge.rpc.caldera.xyz/http'), /loopback/);
  assert.throws(() => pointRpcSource('no url here', 'http://127.0.0.1:1'), /exactly one/);
});

test('the bundle plugin patches settlement, the address module and arcade-core, and keeps Reown external', async () => {
  const bundle = throwawayBundlePlugin({ addressModuleSource: "export const LITVM_DEPLOYMENT = Object.freeze({ status: 'deployed' });", rpcUrl: 'http://127.0.0.1:61064' });
  const loads = [];
  const resolves = [];
  bundle.plugin.setup({
    onLoad: (options, callback) => loads.push({ filter: options.filter, callback }),
    onResolve: (options, callback) => resolves.push({ filter: options.filter, callback }),
  });
  const load = (path) => {
    const hit = loads.find((entry) => entry.filter.test(path));
    return hit ? hit.callback({ path }) : null;
  };
  const settlement = load(`${root}apps/portal/src/settlement.mjs`);
  assert.match(settlement.contents, /SETTLEMENT_LIVE = true;/);
  assert.equal(load(`${root}apps/portal/src/generated/litvm-addresses.mjs`).contents, "export const LITVM_DEPLOYMENT = Object.freeze({ status: 'deployed' });");
  assert.match(load(`${root}apps/portal/src/arcade-core.mjs`).contents, /http: 'http:\/\/127\.0\.0\.1:61064',/);
  assert.equal(load(`${root}apps/portal/src/share-links.mjs`), null, 'every other module loads unchanged');
  assert.deepEqual(bundle.seen, { settlement: true, addresses: true, rpc: true });
  assert.deepEqual(resolves[0].callback({ path: './reown-appkit-vendor.mjs' }), { path: '../reown/appkit.js', external: true });
});

test('decodeEntryCall reads the session key out of an openSession transaction', () => {
  const iface = new ethers.Interface(['function openSession(bytes32 sessionId, bytes32 gameId) payable']);
  const data = iface.encodeFunctionData('openSession', [SESSION, ethers.id('chikun')]);
  assert.deepEqual(decodeEntryCall(data), { sessionId32: SESSION, gameId32: ethers.id('chikun') });
  assert.equal(decodeEntryCall('0x12345678'), null);
  assert.equal(decodeEntryCall('0x'), null);
});

test('checkShareLink wants the session share page and a clean text', () => {
  const good = checkShareLink(intent('🐔 RANKED · Chikun\'s Escape\n460 pts · Rank 1 this week\n⛓ Verified on LitVM\nBeat my flight @LestersArcade'), SESSION);
  assert.equal(good.ok, true, good.problems.join(', '));
  assert.equal(good.url, SHARE_URL);
  assert.equal(checkShareLink(intent('460 pts by 0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a'), SESSION).ok, false);
  assert.deepEqual(checkShareLink(intent('game-session-000000001 460 pts'), SESSION).problems, ['share text contains session-']);
  assert.deepEqual(checkShareLink(intent('#3 this week'), SESSION).problems, ['share text contains #']);
  assert.match(checkShareLink(intent('460 pts', 'https://lestersarcade.io'), SESSION).problems[0], /share url is/);
  assert.deepEqual(checkShareLink(intent('460 pts', SHARE_URL, '&hashtags=LTC'), SESSION).problems, ['hashtags parameter present']);
  assert.equal(checkShareLink('https://www.facebook.com/sharer/sharer.php?u=x', SESSION).ok, false);
  assert.equal(checkShareLink(null, SESSION).ok, false);
});

test('report URLs keep the path and the parameter names only', () => {
  assert.equal(redactUrl('http://127.0.0.1:5/api/profile?wallet=0xabc&self=1'), '/api/profile?wallet=…&self=…');
  assert.equal(redactUrl('http://127.0.0.1:5/api/settle'), '/api/settle');
});

test('the browser RPC stand-in serves reads with CORS for the site origin and refuses the rest', async (t) => {
  const seen = [];
  const eip1193 = { request: async ({ method }) => { seen.push(method); return method === 'eth_chainId' ? '0x1159' : '0x10'; } };
  const proxy = await startBrowserRpcProxy(eip1193);
  t.after(() => proxy.close());
  proxy.allowOrigin('http://127.0.0.1:4000');
  const preflight = await fetch(proxy.url, { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:4000', 'access-control-request-method': 'POST' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4000');
  const other = await fetch(proxy.url, { method: 'OPTIONS', headers: { origin: 'http://evil.invalid' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  const post = (body) => fetch(proxy.url, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4000' }, body: JSON.stringify(body) }).then((response) => response.json());
  assert.deepEqual(await post({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), { jsonrpc: '2.0', id: 1, result: '0x1159' });
  const batch = await post([{ jsonrpc: '2.0', id: 2, method: 'eth_blockNumber' }, { jsonrpc: '2.0', id: 3, method: 'evm_increaseTime', params: [60] }, { jsonrpc: '2.0', id: 4, method: 'eth_sendRawTransaction', params: ['0x00'] }]);
  assert.equal(batch[0].result, '0x10');
  assert.equal(batch[1].error.code, -32601);
  assert.equal(batch[2].error.code, -32601);
  assert.deepEqual(seen, ['eth_chainId', 'eth_blockNumber'], 'refused methods never reach the chain');
  assert.deepEqual(proxy.refused, ['evm_increaseTime', 'eth_sendRawTransaction']);
});

test('the launch-copy check tells the launch copy from the preview copy (contract A33)', async () => {
  const { PREVIEW_ONLY_COPY } = await import('../scripts/ranked-live-browser-e2e.mjs');
  const { portalCopyFor } = await import('../apps/portal/src/portal-content.mjs');
  const launch = JSON.stringify(portalCopyFor({ settlementLive: true, hostedProfileSync: true }));
  const preview = JSON.stringify(portalCopyFor({ settlementLive: false, hostedProfileSync: false }));
  assert.equal(PREVIEW_ONLY_COPY.test(launch), false);
  assert.equal(PREVIEW_ONLY_COPY.test(preview), true);
});

test('only an aborted same-origin static GET counts as a cancellation, never an API or RPC call', async () => {
  const { isCancelledStaticLoad } = await import('../scripts/ranked-live-browser-e2e.mjs');
  const origin = 'http://127.0.0.1:5000';
  assert.equal(isCancelledStaticLoad({ failure: 'net::ERR_ABORTED', method: 'GET', url: `${origin}/assets/icons/arcade-ui.svg`, origin }), true);
  assert.equal(isCancelledStaticLoad({ failure: 'net::ERR_ABORTED', method: 'GET', url: `${origin}/api/profile?wallet=0x1`, origin }), false);
  assert.equal(isCancelledStaticLoad({ failure: 'net::ERR_ABORTED', method: 'POST', url: `${origin}/assets/x.png`, origin }), false);
  assert.equal(isCancelledStaticLoad({ failure: 'net::ERR_CONNECTION_REFUSED', method: 'GET', url: `${origin}/assets/x.png`, origin }), false);
  assert.equal(isCancelledStaticLoad({ failure: 'net::ERR_ABORTED', method: 'GET', url: 'http://127.0.0.1:5001/', origin }), false);
});

test('the Ranked title and the signed-out profile checks follow the launch copy in the source', async () => {
  const { HOSTED_GUEST_PROFILE_TITLE, LIVE_STACKED_MODE_TITLE, rankedModeTitleOk } = await import('../scripts/ranked-live-browser-e2e.mjs');
  assert.equal(rankedModeTitleOk('stacked', LIVE_STACKED_MODE_TITLE), true);
  assert.equal(rankedModeTitleOk('stacked', 'STACKED // Local Ranked Preview'), false, 'the preview STACKED title fails the live run');
  assert.equal(rankedModeTitleOk('stacked', 'STACKED // Free Mode'), false);
  assert.equal(rankedModeTitleOk('chikun', 'Chikun’s Escape // Ranked Mode'), true);
  assert.equal(rankedModeTitleOk('chikun', "Chikun's Escape // Ranked Testnet"), true);
  assert.equal(rankedModeTitleOk('chikun', 'Chikun’s Escape // Free Mode'), false);
  assert.equal(rankedModeTitleOk('lester-blaster', 'Hard Money Heroes: Top-Down Reboot // Ranked Testnet'), true);
  assert.equal(rankedModeTitleOk('lester-blaster', 'Level 1: The Crypto Wasteland // Free Mode'), false, 'the static index.html title is not a Ranked one');
  assert.equal(rankedModeTitleOk('lester-blaster', null), false);
  // The strings the run expects are the ones the portal renders.
  const routes = readFileSync(new URL('../apps/portal/src/routes/official-play-routes.mjs', import.meta.url), 'utf8');
  assert.match(routes, /'STACKED \/\/ ' \+ \(officialSelectedMode === 'ranked' \? \(SETTLEMENT_LIVE \? modeLabel : 'Local Ranked Preview'\)/);
  assert.match(routes, /const modeLabel = officialSelectedMode === 'ranked' \? 'Ranked Testnet' : 'Free Mode';/);
  const hosted = readFileSync(new URL('../apps/portal/src/routes/hosted-profile-view.mjs', import.meta.url), 'utf8');
  assert.ok(hosted.includes(`appendText(card, 'strong', '${HOSTED_GUEST_PROFILE_TITLE}');`));
});
