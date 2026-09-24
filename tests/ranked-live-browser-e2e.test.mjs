// The live-flag browser run's pure parts (browser-e2e slice): argument guards, the throwaway build
// transforms, the entry and share checks, and the browser-side RPC stand-in. The browser run itself
// needs Playwright and Chrome, so it runs outside npm test (docs/qa/ranked-live-browser-e2e-20260923.json).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ethers } from 'ethers';

import {
  checkLiveFlags,
  checkShareLink,
  decodeEntryCall,
  flipFlagsSource,
  GAME_ORDER,
  LIVE_CONFIRM,
  parseGames,
  pointRpcSource,
  redactUrl,
  repoGuardSnapshot,
  runCli,
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
