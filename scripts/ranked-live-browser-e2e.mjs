// Live-flag browser Ranked run (browser-e2e slice; contract C3, A17, A18, A25, A33, §9.1, §11 rules 9
// and 13, §13 step 9; guide §5.15, §7 step 9).
//
// Local (default; offline, public Hardhat fixture keys only, nothing in the repository changes):
//   PLAYWRIGHT_PACKAGE_PATH=<playwright/index.mjs> node scripts/ranked-live-browser-e2e.mjs [--target local]
//       [--games chikun,stacked,lester-blaster] [--out <path>] [--no-write] [--keep-root] [--no-unlockables]
// 1. starts the rehearsal's local stack (in-process Hardhat chain 4441, unmigrated PGlite, every
//    api/*.mjs handler behind the vercel.json rewrites) and its JSON-RPC proxy;
// 2. builds a THROWAWAY portal in the OS temp directory: apps/portal (large folders junctioned, files
//    copied), the `npm run build` output (apps/portal/dist, built first when missing), the launch-copy
//    pages (buildPortalPages with --flags live), and a fresh dist/main.js bundle in which
//    settlement.mjs has both flags true, the address module is regenerated `deployed` from the local
//    deployment record, and LITVM_LITEFORGE_NETWORK's public RPC points at a loopback JSON-RPC proxy
//    (reads only, CORS for the throwaway origin). The committed files are never written;
// 3. serves that copy with scripts/lib/local-http.mjs as the web root, together with the API routes
//    and the vercel.json headers (the CSP gains only the loopback proxy origin);
// 4. per game, in a fresh browser context with the fixture wallet (scripts/lib/fixture-wallet.mjs,
//    EIP-6963, Hardhat account player1): Sign in (server nonce, one signature), open Ranked, confirm
//    the 0.102 zkLTC entry, play a short run (Chikun: start and let it fall; STACKED: hard drops to a
//    top-out; HMH: the evidence-safe terminal pilot), then assert:
//      - the entry's sessionId32 on chain equals the sessionId32 the settle request used;
//      - the results screen reaches `published` with the explorer link to the relayed transaction;
//      - the share row points at /s/<shareId>, and its text has no address, no `session-`, no `#`;
//      - the share page /s/<shareId> and its card render through the local http layer;
//      - zero console errors, zero page errors and zero failed requests (4xx/5xx or network);
// 5. with Chikun (unless --no-unlockables): the achievement the run earned unlocks a look through E6,
//    picking it PUTs preferences.cosmetics (E7), and the look reaches the Chikun child in a Free run
//    and in a second Ranked run.
// The JSON report is written to docs/qa/ranked-live-browser-e2e-20260923.json.
//
// Live (runbook step 9, OPTIONAL, OWNER APPROVAL REQUIRED; spends testnet zkLTC; never run by the slice):
//   node scripts/ranked-live-browser-e2e.mjs --live --site https://lestersarcade.io \
//       --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> [--player-key-field <field>] \
//       --confirm-live SPEND_TESTNET_ZKLTC --yes [--games <id,id>] [--out <path>]
// drives the same flow against the real site. The player key is read inside this process through
// scripts/lib/key-source.mjs, never printed, and never enters the page (the fixture wallet signs in
// Node). Without --yes it prints the plan and stops. WalletConnect cannot run on localhost (it is not a
// Reown-allowed host); the fixture wallet covers the EIP-6963 path and WalletConnect is checked by hand
// at runbook step 9.
//
// Needs Playwright (PLAYWRIGHT_PACKAGE_PATH, default benchmarks/hmh-engine-bakeoff/node_modules/
// playwright/index.mjs) and Chrome (CHROME_EXECUTABLE_PATH), so it is not part of `npm test`;
// tests/ranked-live-browser-e2e.test.mjs covers its pure parts.

import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ethers } from 'ethers';

import { flagValue, hasFlag, readSecret, SecretSourceError } from './lib/key-source.mjs';
import { installFixtureWallet, READ_METHODS } from './lib/fixture-wallet.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export const REPORT_SCHEMA = 'lesters-ranked-live-browser-e2e-v1';
export const LOCAL_REPORT_RELATIVE_PATH = 'docs/qa/ranked-live-browser-e2e-20260923.json';
export const LIVE_CONFIRM = 'SPEND_TESTNET_ZKLTC';
export const LIVE_REQUIRED_FLAGS = Object.freeze(['--site', '--rpc', '--player-key-file', '--confirm-live']);
export const GAME_ORDER = Object.freeze(['chikun', 'stacked', 'lester-blaster']);
export const GAME_TITLES = Object.freeze({ chikun: "Chikun's Escape", stacked: 'STACKED', 'lester-blaster': 'Hard Money Heroes' });
export const SHARE_ORIGIN = 'https://lestersarcade.io';
export const EXPLORER_TX_PREFIX = 'https://liteforge.explorer.caldera.xyz/tx/';
export const LITEFORGE_PUBLIC_RPC = 'https://liteforge.rpc.caldera.xyz/http';
export const MIN_PAID_WEI = 102_000_000_000_000_000n;
// Live: gas headroom on top of the entries (LiteForge base fees near 1.5 gwei).
export const LIVE_GAS_MARGIN_WEI = 5_000_000_000_000_000n;
// The fixture look the Chikun run unlocks: `chikun-first-flight` gates the Arcade Cap (unlockables.mjs).
export const UNLOCK_CHECK = Object.freeze({ gameId: 'chikun', slot: 'hat', unlockableId: 'chikun-hat-cap', achievementId: 'chikun-first-flight', childKey: 'hat' });
export const SETTLEMENT_SOURCE = 'apps/portal/src/settlement.mjs';
export const ADDRESS_MODULE_SOURCE = 'apps/portal/src/generated/litvm-addresses.mjs';
export const FLAG_LINES = Object.freeze([
  Object.freeze({ find: 'export const SETTLEMENT_LIVE = false;', replace: 'export const SETTLEMENT_LIVE = true;' }),
  Object.freeze({ find: 'export const HOSTED_PROFILE_SYNC = false;', replace: 'export const HOSTED_PROFILE_SYNC = true;' }),
]);
const ENTRY_INTERFACE = new ethers.Interface(['function openSession(bytes32 sessionId, bytes32 gameId) payable']);
const HEX32 = /^0x[0-9a-f]{64}$/;
const ADDRESS_RE = /0x[0-9a-fA-F]{40}/;
const DEFAULT_PLAYWRIGHT = join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const DEFAULT_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const USAGE = [
  'usage: node scripts/ranked-live-browser-e2e.mjs [--target local] [--games <id,id>] [--out <path>] [--no-write] [--keep-root] [--no-unlockables]',
  '       node scripts/ranked-live-browser-e2e.mjs --live --site <https origin> --rpc <url> --player-key-file <path> [--player-key-field <field>]',
  '            --confirm-live SPEND_TESTNET_ZKLTC [--yes] [--games <id,id>] [--out <path>]',
].join('\n');

// ---------------------------------------------------------------------------
// Pure helpers (tested in tests/ranked-live-browser-e2e.test.mjs).

// --games a,b: a subset of the three Ranked games, in the run order (Chikun first).
export function parseGames(value) {
  if (value === null || value === undefined) return [...GAME_ORDER];
  const wanted = String(value).split(',').map((id) => id.trim()).filter(Boolean);
  const unknown = wanted.filter((id) => !GAME_ORDER.includes(id));
  if (!wanted.length || unknown.length) throw new Error(`--games takes a comma list of ${GAME_ORDER.join(', ')}${unknown.length ? ` (unknown: ${unknown.join(', ')})` : ''}`);
  return GAME_ORDER.filter((id) => wanted.includes(id));
}

// The live target: every flag, and the exact confirm phrase. Reads no secret. → { ok, missing, problems }
export function checkLiveFlags(argv) {
  const missing = LIVE_REQUIRED_FLAGS.filter((flag) => flagValue(argv, flag) === null);
  const problems = [];
  const confirm = flagValue(argv, '--confirm-live');
  if (confirm !== null && confirm !== LIVE_CONFIRM) problems.push(`--confirm-live must be exactly ${LIVE_CONFIRM}`);
  const site = flagValue(argv, '--site');
  if (site !== null) {
    try {
      const url = new URL(site);
      if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) problems.push('--site must be a bare https origin such as https://lestersarcade.io');
    } catch {
      problems.push('--site must be a bare https origin such as https://lestersarcade.io');
    }
  }
  return { ok: missing.length === 0 && problems.length === 0, missing, problems };
}

export function targetOf(argv) {
  if (hasFlag(argv, '--live')) return 'live';
  return flagValue(argv, '--target') ?? 'local';
}

// settlement.mjs of the throwaway build: both literal flags true, or an error when either line moved.
export function flipFlagsSource(text) {
  let out = String(text);
  for (const line of FLAG_LINES) {
    const count = out.split(line.find).length - 1;
    if (count !== 1) throw new Error(`${SETTLEMENT_SOURCE} must hold exactly one "${line.find}" (found ${count}); the throwaway flag flip would be wrong`);
    out = out.replace(line.find, line.replace);
  }
  return out;
}

// arcade-core.mjs of the throwaway build: LITVM_LITEFORGE_NETWORK.rpcUrls.http → the loopback proxy.
export function pointRpcSource(text, rpcUrl) {
  const needle = `http: '${LITEFORGE_PUBLIC_RPC}',`;
  const count = String(text).split(needle).length - 1;
  if (count !== 1) throw new Error(`expected exactly one "${needle}" in arcade-core.mjs (found ${count})`);
  if (!/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(rpcUrl)) throw new Error('the throwaway RPC must be a loopback http URL');
  return String(text).replace(needle, `http: '${rpcUrl}',`);
}

// The openSession call inside an entry transaction's data → { sessionId32, gameId32 } or null.
export function decodeEntryCall(data) {
  try {
    const parsed = ENTRY_INTERFACE.parseTransaction({ data });
    if (!parsed || parsed.name !== 'openSession') return null;
    return { sessionId32: String(parsed.args[0]).toLowerCase(), gameId32: String(parsed.args[1]).toLowerCase() };
  } catch {
    return null;
  }
}

// The results screen's "Share on X" link → { ok, problems, url, text }. The url must be the share page
// of this session; the text must carry no wallet address, no `session-` handle and no `#`.
export function checkShareLink(href, sessionId32) {
  const problems = [];
  let url = null;
  let text = null;
  try {
    const intent = new URL(String(href));
    if (intent.origin !== 'https://x.com' || intent.pathname !== '/intent/post') problems.push('not an X post intent');
    url = intent.searchParams.get('url');
    text = intent.searchParams.get('text');
    if (intent.searchParams.has('hashtags')) problems.push('hashtags parameter present');
  } catch {
    problems.push('not a URL');
  }
  const shareId = String(sessionId32 ?? '').toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(shareId)) problems.push('no session id to compare');
  if (url !== `${SHARE_ORIGIN}/s/${shareId}`) problems.push(`share url is ${url}`);
  if (text === null || text === '') problems.push('no share text');
  else {
    if (ADDRESS_RE.test(text)) problems.push('share text contains an address');
    if (/session-/i.test(text)) problems.push('share text contains session-');
    if (text.includes('#')) problems.push('share text contains #');
  }
  return { ok: problems.length === 0, problems, url, text };
}

// A same-origin GET of a static file that the browser aborted (net::ERR_ABORTED): the page dropped the
// element or navigated away. API calls and anything off the site never qualify.
export function isCancelledStaticLoad({ failure, method, url, origin }) {
  if (!/ERR_ABORTED/.test(String(failure)) || String(method).toUpperCase() !== 'GET') return false;
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return false;
  }
  return parsed.origin === origin && !parsed.pathname.startsWith('/api/') && !parsed.pathname.startsWith('/s/');
}

// Request URLs the report may show: the path and the parameter names only (values can carry wallets).
export function redactUrl(value) {
  try {
    const url = new URL(String(value));
    const keys = [...new Set([...url.searchParams.keys()])];
    return `${url.pathname}${keys.length ? `?${keys.map((key) => `${key}=…`).join('&')}` : ''}`;
  } catch {
    return String(value).split('?')[0];
  }
}

// ---------------------------------------------------------------------------
// The throwaway live-flag portal.

// Generated pages rebuilt with the launch copy (never junctioned: buildPortalPages writes them).
const PORTAL_GENERATED = new Set(['index.html', 'discover', 'trust.html', 'manifest.webmanifest', 'sitemap.xml', 'robots.txt', 'llms.txt']);

function readFlags(text) {
  return {
    settlementLive: /export const SETTLEMENT_LIVE = true;/.test(text),
    hostedProfileSync: /export const HOSTED_PROFILE_SYNC = true;/.test(text),
  };
}

// A snapshot of the committed files a flip could touch, so the run can prove it left them alone.
export function repoGuardSnapshot(repoRoot = root) {
  const settlement = readFileSync(join(repoRoot, SETTLEMENT_SOURCE), 'utf8');
  const addresses = readFileSync(join(repoRoot, ADDRESS_MODULE_SOURCE), 'utf8');
  return {
    flags: readFlags(settlement),
    settlementSha: ethers.id(settlement),
    addressModuleSha: ethers.id(addresses),
    addressStatus: /status: '([a-z]+)'/.exec(addresses)?.[1] ?? null,
    indexSha: ethers.id(readFileSync(join(repoRoot, 'apps/portal/index.html'), 'utf8')),
  };
}

function ensurePortalBuild(repoRoot, log) {
  const needed = ['dist/main.js', 'dist/hmh-reboot/game.js', 'dist/chikun/game.js', 'dist/stacked/game.js'];
  if (needed.every((file) => existsSync(join(repoRoot, 'apps/portal', file)))) return false;
  log('throwaway portal: apps/portal/dist is missing, running node build.mjs (npm run build) first');
  const result = spawnSync(process.execPath, ['build.mjs'], { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('npm run build failed; the throwaway portal needs its output');
  return true;
}

// esbuild plugin for the throwaway main bundle: flags, address module, public RPC; the Reown vendor stays
// the external file the regular build emits (build.mjs createReownAppKitExternalPlugin).
export function throwawayBundlePlugin({ addressModuleSource, rpcUrl }) {
  const seen = { settlement: false, addresses: false, rpc: false };
  return {
    seen,
    plugin: {
      name: 'ranked-live-throwaway',
      setup(build) {
        build.onResolve({ filter: /reown-appkit-vendor\.mjs$/ }, () => ({ path: '../reown/appkit.js', external: true }));
        build.onLoad({ filter: /apps[\\/]portal[\\/]src[\\/]settlement\.mjs$/ }, (args) => {
          seen.settlement = true;
          return { contents: flipFlagsSource(readFileSync(args.path, 'utf8')), loader: 'js' };
        });
        build.onLoad({ filter: /apps[\\/]portal[\\/]src[\\/]generated[\\/]litvm-addresses\.mjs$/ }, () => {
          seen.addresses = true;
          return { contents: addressModuleSource, loader: 'js' };
        });
        build.onLoad({ filter: /apps[\\/]portal[\\/]src[\\/]arcade-core\.mjs$/ }, (args) => {
          seen.rpc = true;
          return { contents: pointRpcSource(readFileSync(args.path, 'utf8'), rpcUrl), loader: 'js', resolveDir: dirname(args.path) };
        });
      },
    },
  };
}

// Builds the throwaway web root. Returns { webRoot, base, cleanup(), links }.
export async function prepareThrowawayPortal({ repoRoot = root, record, rpcUrl, log = () => {} }) {
  ensurePortalBuild(repoRoot, log);
  const before = repoGuardSnapshot(repoRoot);
  if (before.flags.settlementLive || before.flags.hostedProfileSync) throw new Error('settlement.mjs already has a flag on; this run expects the committed preview flags');
  const base = mkdtempSync(join(tmpdir(), 'lesters-live-e2e-'));
  const webRoot = join(base, 'web');
  const portal = join(repoRoot, 'apps/portal');
  if (resolve(webRoot).startsWith(resolve(repoRoot) + sep)) throw new Error('the throwaway portal must live outside the repository');
  mkdirSync(webRoot, { recursive: true });
  const links = [];
  const cleanup = () => {
    // Junctions first (unlink never follows them), then the tree.
    for (const link of links) {
      try { unlinkSync(link); } catch { /* already gone */ }
    }
    rmSync(base, { recursive: true, force: true });
  };
  try {
    for (const name of readdirSync(portal)) {
      if (name === 'dist' || PORTAL_GENERATED.has(name)) continue;
      const source = join(portal, name);
      const target = join(webRoot, name);
      if (statSync(source).isDirectory()) {
        symlinkSync(realpathSync(source), target, 'junction');
        links.push(target);
      } else {
        copyFileSync(source, target);
      }
    }
    // Launch copy (contract A33): the committed pages stay the preview ones.
    const { buildPortalPages } = await import(pathToFileURL(join(repoRoot, 'scripts/build-portal-pages.mjs')).href);
    buildPortalPages({ flags: 'live', outDir: webRoot });
    // The regular build output, then the live-flag portal bundle over it (dist/main.js + its chunks).
    cpSync(join(portal, 'dist'), join(webRoot, 'dist'), { recursive: true });
    const { renderLitvmAddressModule, deployedDeploymentInput } = await import(pathToFileURL(join(repoRoot, 'scripts/generate-litvm-addresses.mjs')).href);
    const addressModuleSource = renderLitvmAddressModule(deployedDeploymentInput(record));
    const { build } = await import('esbuild');
    const bundle = throwawayBundlePlugin({ addressModuleSource, rpcUrl });
    await build({
      entryPoints: { main: join(portal, 'main.js') },
      absWorkingDir: repoRoot,
      plugins: [bundle.plugin],
      bundle: true,
      splitting: true,
      format: 'esm',
      minify: true,
      treeShaking: true,
      target: ['es2020'],
      outdir: join(webRoot, 'dist'),
      entryNames: '[dir]/[name]',
      chunkNames: 'chunks/[name]-[hash]',
      legalComments: 'none',
      logLevel: 'warning',
    });
    if (!bundle.seen.settlement || !bundle.seen.addresses || !bundle.seen.rpc) throw new Error(`the throwaway bundle did not load every patched module: ${JSON.stringify(bundle.seen)}`);
    const after = repoGuardSnapshot(repoRoot);
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('the repository changed while building the throwaway portal');
    log(`throwaway portal: ${webRoot} (live flags, deployed local addresses, public RPC → ${rpcUrl})`);
    return { webRoot, base, links, cleanup, guard: before };
  } catch (error) {
    cleanup();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// The browser-side public RPC: reads only, CORS for the throwaway origin, on loopback.

export async function startBrowserRpcProxy(eip1193, { host = '127.0.0.1' } = {}) {
  const allowed = new Set([...READ_METHODS, 'eth_chainId', 'net_version']);
  const calls = [];
  const refused = [];
  let allowOrigin = null;
  const answer = async (payload) => {
    const id = payload?.id ?? null;
    const method = String(payload?.method ?? '');
    calls.push(method);
    if (!allowed.has(method)) {
      refused.push(method);
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `the public RPC stand-in serves reads only (${method})` } };
    }
    try {
      const result = await eip1193.request({ method, params: payload.params ?? [] });
      return { jsonrpc: '2.0', id, result: result === undefined ? null : result };
    } catch (error) {
      return { jsonrpc: '2.0', id, error: { code: Number.isInteger(error?.code) ? error.code : -32000, message: String(error?.message ?? error).slice(0, 300), data: error?.data } };
    }
  };
  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && origin === allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
      res.setHeader('Access-Control-Max-Age', '600');
      res.writeHead(204).end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }));
        return;
      }
      const reply = Array.isArray(body) ? await Promise.all(body.map(answer)) : await answer(body);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
    });
  });
  await new Promise((resolveListen) => server.listen(0, host, resolveListen));
  const url = `http://${host}:${server.address().port}`;
  return {
    url,
    origin: url,
    calls,
    refused,
    allowOrigin(origin) { allowOrigin = origin; },
    close: () => new Promise((resolveClose) => { server.closeAllConnections?.(); server.close(() => resolveClose()); }),
  };
}

// ---------------------------------------------------------------------------
// Browser instrumentation (runs in the portal frame; test-only).

function portalProbe() {
  if (globalThis.top !== globalThis) return;
  const probe = { events: [], rankedRuns: [], entries: [], walletSessions: [], cosmetics: [] };
  Object.defineProperty(globalThis, '__rankedE2E', { value: probe, configurable: true });
  for (const type of ['lesters:ranked-run', 'lesters:ranked-entry', 'lesters:wallet-session', 'lesters:ranked-pending', 'lesters:profile-changed']) {
    globalThis.addEventListener(type, (event) => {
      const detail = event.detail ?? {};
      probe.events.push(type);
      if (type === 'lesters:ranked-run') probe.rankedRuns.push({ gameId: detail.context?.gameId ?? null, sessionId32: detail.context?.sessionId32 ?? null, state: detail.handle?.state ?? null });
      if (type === 'lesters:ranked-entry') probe.entries.push({ gameId: detail.gameId ?? null, status: detail.status ?? null, txHash: detail.txHash ?? null });
      if (type === 'lesters:wallet-session') probe.walletSessions.push({ wallet: detail.wallet ?? null, authenticated: Boolean(detail.authenticated) });
    });
  }
  // The look each child receives: the settings the parent posts over the bridge ports.
  const findCosmetics = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 4) return null;
    if (value.cosmetics && typeof value.cosmetics === 'object') return value.cosmetics;
    for (const key of Object.keys(value)) {
      const found = findCosmetics(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  };
  const post = MessagePort.prototype.postMessage;
  MessagePort.prototype.postMessage = function postMessageProbe(message, ...rest) {
    try {
      const found = findCosmetics(message);
      if (found) probe.cosmetics.push({ type: String(message?.type ?? ''), cosmetics: JSON.parse(JSON.stringify(found)) });
    } catch { /* never break the bridge */ }
    return post.call(this, message, ...rest);
  };
}

// ---------------------------------------------------------------------------
// Chain facts.

function chainContracts(deployment, provider) {
  const abi = (name) => JSON.parse(readFileSync(join(root, 'contracts/artifacts', `${name}.json`), 'utf8')).abi;
  return {
    entry: new ethers.Contract(deployment.addresses.arcadeRankedEntry, abi('ArcadeRankedEntry'), provider),
    scores: new ethers.Contract(deployment.addresses.scoreSubmissionRegistry, abi('ScoreSubmissionRegistry'), provider),
  };
}

// ---------------------------------------------------------------------------
// One game.

function createRunRecorder(page, origin, { allowedOrigins = [] } = {}) {
  const known = [origin, ...allowedOrigins];
  const issues = [];
  const api = [];
  const settleBodies = [];
  const offOrigin = [];
  const cancelled = [];
  page.on('pageerror', (error) => issues.push(`pageerror: ${String(error?.message ?? error).slice(0, 300)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console: ${message.text().slice(0, 300)}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed';
    // The browser cancels a static load when the view that asked for it is replaced (a cabinet image
    // while the profile repaints the grid, media on navigation): a cancellation, not a failed
    // request. Every other network failure, and every /api/ or RPC request, counts.
    if (isCancelledStaticLoad({ failure, method: request.method(), url: request.url(), origin })) {
      cancelled.push(`${request.method()} ${redactUrl(request.url())}`);
      return;
    }
    issues.push(`requestfailed: ${request.method()} ${redactUrl(request.url())} ${failure}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith('data:') && !url.startsWith('blob:') && !known.some((allowed) => url.startsWith(allowed))) offOrigin.push(`${request.method()} ${new URL(url).origin}${redactUrl(url)}`);
    if (url.startsWith(origin) && new URL(url).pathname.startsWith('/api/')) {
      if (request.method() === 'POST' && new URL(url).pathname === '/api/settle') {
        try {
          const body = request.postDataJSON();
          if (body && typeof body === 'object' && body.sessionId32 && !body.retry) settleBodies.push({ sessionId32: String(body.sessionId32).toLowerCase(), entryTxHash: body.entryTxHash ? String(body.entryTxHash).toLowerCase() : null, gameId: body.identity?.gameId ?? body.gameId ?? null });
        } catch { /* not JSON */ }
      }
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.startsWith(origin) && new URL(url).pathname.startsWith('/api/')) api.push(`${response.request().method()} ${redactUrl(url)} ${response.status()}`);
    if (response.status() >= 400) issues.push(`http ${response.status()} ${response.request().method()} ${redactUrl(url)}`);
  });
  return { issues, api, settleBodies, offOrigin, cancelled };
}

async function signInWithFixture(page, { timeoutMs }) {
  await page.locator('#officialConnectButton').click();
  await page.waitForFunction(() => globalThis.__rankedE2E?.walletSessions.some((entry) => entry.authenticated), null, { timeout: timeoutMs });
  await page.locator('.official-cabinet-card.playable').first().waitFor({ state: 'visible', timeout: timeoutMs });
}

async function openRankedModal(page, gameId, { timeoutMs }) {
  const card = page.locator('.official-cabinet-card.playable').filter({ hasText: GAME_TITLES[gameId] }).first();
  await card.click();
  await page.locator('#officialModeSelect:not([hidden])').waitFor({ state: 'visible', timeout: timeoutMs });
  const modeSelect = await page.evaluate(() => ({
    rankedTitle: document.querySelector('#officialRankedModeTitle')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    rankedCopy: document.querySelector('#officialRankedModeCopy')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  }));
  await page.locator('#officialRankedModeButton').click();
  await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible', timeout: timeoutMs });
  // The fresh public-RPC readiness check enables the button with the live label.
  await page.waitForFunction(() => {
    const button = document.querySelector('#rankedEntryApprove');
    return button && !button.disabled && /confirm entry/i.test(button.textContent ?? '');
  }, null, { timeout: timeoutMs });
  return page.evaluate((mode) => {
    const read = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    return {
      ...mode,
      eyebrow: read('#rankedEntryModal .ranked-entry-eyebrow') ?? read('#rankedEntryModal [class*="eyebrow"]'),
      fee: read('#rankedEntryFee'),
      reserve: read('#rankedEntryReserve'),
      total: read('#rankedEntryTotal'),
      balance: read('#rankedEntryBalance'),
      network: read('#rankedEntryNetwork'),
      copy: read('#rankedEntryCopy'),
      footnote: read('#rankedEntryFootnote'),
      approve: read('#rankedEntryApprove'),
    };
  }, modeSelect);
}

// Preview-only wording that must not survive in a launch (flags on) build (contract A33).
export const PREVIEW_ONLY_COPY = /device-local Ranked|Ranked preview|No fees, prizes or online ranking|Local Only|not charged until verified settlement|no score transaction is sent/i;

async function readLaunchCopy(page) {
  return page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
    faq: document.querySelector('#portalFaqList')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  }));
}

async function confirmEntry(page, { timeoutMs }) {
  const before = await page.evaluate(() => globalThis.__rankedE2E?.entries.filter((entry) => entry.status === 'broadcast').length ?? 0);
  await page.locator('#rankedEntryApprove').click();
  await page.waitForFunction((count) => (globalThis.__rankedE2E?.entries.filter((entry) => entry.status === 'broadcast').length ?? 0) > count, before, { timeout: timeoutMs });
  await page.locator('#rankedEntryModal').waitFor({ state: 'hidden', timeout: timeoutMs });
}

async function playChikun(page, { timeoutMs }) {
  const frame = page.frameLocator('iframe.chikun-game-frame');
  await frame.locator('#liveStatus').filter({ hasText: 'Ready for Ranked Mode.' }).waitFor({ state: 'visible', timeout: timeoutMs });
  await frame.locator('#startButton').click();
  await frame.locator('#chikunCanvas').click({ position: { x: 80, y: 100 } });
}

async function playStacked(page, { timeoutMs }) {
  const handle = await page.waitForSelector('iframe.stacked-game-frame', { timeout: timeoutMs });
  const frame = await handle.contentFrame();
  await frame.waitForSelector('#stackedStage[data-assets-ready="true"]', { timeout: timeoutMs });
  await frame.locator('#continueButton').focus();
  await page.keyboard.press('Space');
  await frame.waitForFunction(() => Number(document.querySelector('#stackedStage')?.dataset.simulationTick) > 30, null, { timeout: timeoutMs });
  await frame.locator('#stackedStage canvas').focus();
  for (let index = 0; index < 120 && await frame.locator('#restartButton').isHidden(); index += 1) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(80);
  }
}

async function playHmh(page, { timeoutMs }) {
  await page.locator('#officialCharacterSelect:not([hidden])').waitFor({ state: 'visible', timeout: timeoutMs });
  await page.locator('#officialCharacterRoster .hero-card.active').first().click();
  await page.locator('#officialLevelIntro:not([hidden])').waitFor({ state: 'visible', timeout: timeoutMs });
  await page.locator('#officialBeginLevelButton').click();
}

const PLAYERS = { chikun: playChikun, stacked: playStacked, 'lester-blaster': playHmh };

async function waitForPublished(page, { timeoutMs }) {
  await page.waitForFunction(() => globalThis.__rankedE2E?.rankedRuns.length > 0, null, { timeout: timeoutMs });
  const results = page.locator('[data-ranked-results]');
  await results.waitFor({ state: 'visible', timeout: 30_000 });
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await results.getAttribute('data-state');
    if (state === 'published' || state === 'rejected' || state === 'practice') break;
    await page.waitForTimeout(500);
  }
  return page.evaluate(() => {
    const root = document.querySelector('[data-ranked-results]');
    const read = (selector) => root?.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    const link = (step) => root?.querySelector(`li[data-step="${step}"] a.rr-step-link:not([hidden])`)?.getAttribute('href') ?? null;
    return {
      state: root?.dataset.state ?? null,
      eyebrow: read('.rr-eyebrow'),
      score: read('.rr-score-value'),
      handle: read('.rr-handle'),
      standing: read('.rr-standing'),
      banner: read('.rr-banner-text'),
      timeline: [...(root?.querySelectorAll('li[data-step]') ?? [])].map((node) => ({ step: node.dataset.step, status: node.dataset.status })),
      entryHref: link('entry'),
      publishedHref: link('published'),
      shareHref: root?.querySelector('a[data-share="x"]')?.getAttribute('href') ?? null,
      achievements: [...(root?.querySelectorAll('[data-achievement-id]') ?? [])].map((node) => node.dataset.achievementId),
    };
  });
}

async function closeResults(page) {
  await page.keyboard.press('Escape');
  await page.locator('[data-ranked-results]').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
}

// Fetches the share page and its card from the site (the local http layer or the live site).
async function checkSharePage(api, shareId) {
  const out = { page: null, card: null };
  const page = await api('GET', `/s/${shareId}`);
  const html = typeof page.body === 'string' ? page.body : '';
  const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? null;
  out.page = {
    status: page.status,
    ogUrl: /<meta property="og:url" content="([^"]+)"/.exec(html)?.[1] ?? null,
    ogImage: image ? redactUrl(image) : null,
    verified: /Verified on LitVM/.test(html),
    noindex: /noindex/.test(html),
  };
  if (image) {
    const path = new URL(image).pathname + new URL(image).search;
    let card = await api('GET', path);
    if (card.status === 302 && card.headers.location) card = await api('GET', card.headers.location);
    const buffer = Buffer.isBuffer(card.body) ? card.body : Buffer.alloc(0);
    out.card = { status: card.status, contentType: card.headers['content-type'] ?? null, png: buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', bytes: buffer.length };
  }
  return out;
}

// One Ranked run in a fresh context. Returns the per-game report.
async function runGame({ browser, gameId, origin, allowedOrigins = [], wallet, chain, api, timeouts, log, afterPublished = null, extraPath = '', shotsDir = null }) {
  const started = Date.now();
  const checks = [];
  const expect = (id, ok, detail = null) => {
    checks.push({ id, ok: Boolean(ok), ...(detail === null ? {} : { detail }) });
    if (!ok) log(`  FAIL ${gameId} ${id}${detail === null ? '' : ` ${JSON.stringify(detail).slice(0, 300)}`}`);
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const out = { gameId, ok: false, checks, durationMs: 0 };
  let fixture = null;
  try {
    fixture = await installFixtureWallet(context, { rpcUrl: wallet.rpcUrl, privateKey: wallet.privateKey, chainId: 4441, announce: true });
    await context.addInitScript(portalProbe);
    const page = await context.newPage();
    page.setDefaultTimeout(timeouts.stepMs);
    const recorder = createRunRecorder(page, origin, { allowedOrigins });
    const path = gameId === 'lester-blaster' ? '/?evidenceSafe=1&terminalPilot=1' : '/';
    await page.goto(`${origin}${path}${extraPath}`, { waitUntil: 'networkidle', timeout: timeouts.navigationMs });
    const landing = await readLaunchCopy(page);
    await signInWithFixture(page, { timeoutMs: timeouts.stepMs });
    const counts = fixture.router.counts();
    expect('sign-in-one-signature', counts.personal_sign === 1 && counts.eth_requestAccounts >= 1, counts);
    const modal = await openRankedModal(page, gameId, { timeoutMs: timeouts.stepMs });
    out.modal = modal;
    expect('entry-modal-quote', /0\.102/.test(modal.total ?? '') && /0\.1\b/.test(modal.fee ?? '') && /0\.002/.test(modal.reserve ?? ''), { fee: modal.fee, reserve: modal.reserve, total: modal.total });
    // The launch copy (contract A33): the landing meta and FAQ, the mode select and the entry modal.
    const copyText = [landing.description, landing.faq, modal.rankedTitle, modal.rankedCopy, modal.copy, modal.footnote].join(' \n ');
    expect('launch-copy', /0\.102 testnet zkLTC per run/.test(landing.description ?? '') && /0\.102/.test(landing.faq) && !PREVIEW_ONLY_COPY.test(copyText), { description: landing.description, rankedTitle: modal.rankedTitle, rankedCopy: modal.rankedCopy, previewHit: PREVIEW_ONLY_COPY.exec(copyText)?.[0] ?? null });
    await confirmEntry(page, { timeoutMs: timeouts.stepMs });
    const entryEvent = await page.evaluate(() => globalThis.__rankedE2E.entries.find((entry) => entry.status === 'broadcast'));
    await PLAYERS[gameId](page, { timeoutMs: timeouts.stepMs });
    const results = await waitForPublished(page, { timeoutMs: timeouts.publishMs });
    out.results = { state: results.state, eyebrow: results.eyebrow, score: results.score, standing: results.standing, banner: results.banner, timeline: results.timeline, achievements: results.achievements };
    expect('results-published', results.state === 'published', { state: results.state, banner: results.banner });

    // Entry ↔ settle: the key the chain recorded is the key the settle request carried.
    const settle = recorder.settleBodies[0] ?? null;
    const entryTx = fixture.router.transactions.find((tx) => tx.hash === String(entryEvent?.txHash ?? '').toLowerCase()) ?? null;
    const decoded = entryTx ? decodeEntryCall(entryTx.data) : null;
    out.sessionId32 = settle?.sessionId32 ?? null;
    out.entryTxHash = entryTx?.hash ?? null;
    expect('settle-request', Boolean(settle) && HEX32.test(settle.sessionId32), { settleRequests: recorder.settleBodies.length });
    expect('entry-transaction', Boolean(entryTx) && Boolean(decoded) && entryTx.to === chain.deployment.addresses.arcadeRankedEntry.toLowerCase() && BigInt(entryTx.value) >= MIN_PAID_WEI, { to: entryTx?.to ?? null, value: entryTx?.value ?? null });
    expect('entry-session-matches-settle', Boolean(decoded) && Boolean(settle) && decoded.sessionId32 === settle.sessionId32 && settle.entryTxHash === entryTx.hash && decoded.gameId32 === ethers.id(gameId).toLowerCase(), { entry: decoded?.sessionId32 ?? null, settle: settle?.sessionId32 ?? null });
    if (settle && HEX32.test(settle.sessionId32)) {
      const contracts = chainContracts(chain.deployment, chain.provider);
      const paid = await contracts.entry.getPaidSession(settle.sessionId32);
      expect('chain-entry', String(paid.player).toLowerCase() === fixture.address && BigInt(paid.amountWei) >= MIN_PAID_WEI, { amountWei: BigInt(paid.amountWei).toString() });
      const onChain = await contracts.scores.getSession(settle.sessionId32);
      expect('chain-session', onChain.exists === true && String(onChain.player).toLowerCase() === fixture.address && onChain.gameId === ethers.id(gameId), { exists: onChain.exists });
      const status = await api('GET', `/api/settle/status?id=${settle.sessionId32.slice(2)}`);
      const txHash = status.body?.txHash ?? null;
      out.settleTxHash = txHash;
      expect('settle-status-confirmed', status.status === 200 && status.body?.status === 'confirmed' && HEX32.test(String(txHash)), { status: status.status, state: status.body?.status ?? null });
      expect('explorer-link', results.publishedHref === `${EXPLORER_TX_PREFIX}${txHash}`, { href: results.publishedHref });
      expect('entry-link', results.entryHref === `${EXPLORER_TX_PREFIX}${entryTx?.hash}`, { href: results.entryHref });
      if (HEX32.test(String(txHash))) {
        const relayed = await chain.provider.getTransactionReceipt(txHash);
        expect('relayed-transaction', relayed?.status === 1 && String(relayed.to).toLowerCase() === chain.deployment.addresses.scoreSubmissionRegistry.toLowerCase(), { status: relayed?.status ?? null });
      }
      const share = checkShareLink(results.shareHref, settle.sessionId32);
      out.share = { url: share.url, text: share.text, problems: share.problems };
      expect('share-row', share.ok, share.problems);
      const sharePage = await checkSharePage(api, settle.sessionId32.slice(2));
      out.sharePage = sharePage;
      expect('share-page', sharePage.page?.status === 200 && sharePage.page.ogUrl === `${SHARE_ORIGIN}/s/${settle.sessionId32.slice(2)}` && sharePage.page.verified && sharePage.card?.status === 200 && sharePage.card.png, sharePage);
    }
    if (afterPublished) out.unlockables = await afterPublished({ page, fixture, recorder, expect });
    await page.waitForTimeout(500);
    out.walletCalls = fixture.router.counts();
    out.api = recorder.api;
    out.offOrigin = recorder.offOrigin;
    out.cancelledStaticLoads = recorder.cancelled.length;
    out.issues = recorder.issues;
    expect('clean-console-and-network', recorder.issues.length === 0, recorder.issues.slice(0, 20));
    expect('no-off-origin-requests', recorder.offOrigin.length === 0, recorder.offOrigin.slice(0, 20));
  } catch (error) {
    expect('flow', false, String(error?.message ?? error).split('\n')[0].slice(0, 400));
    if (shotsDir) {
      for (const page of context.pages()) {
        // eslint-disable-next-line no-await-in-loop
        await page.screenshot({ path: join(shotsDir, `${gameId}-failure.png`), fullPage: false }).catch(() => {});
      }
    }
  } finally {
    fixture?.close();
    await context.close().catch(() => {});
    out.durationMs = Date.now() - started;
    out.ok = checks.length > 0 && checks.every((check) => check.ok);
  }
  log(`${gameId}: ${out.ok ? 'PASS' : 'FAIL'} ${checks.filter((check) => check.ok).length}/${checks.length} checks in ${out.durationMs} ms`);
  return out;
}

// Chikun only: the run's achievement unlocks a look (E6), a pick PUTs preferences.cosmetics (E7), and the
// look reaches the child in a Free run and in a second Ranked run.
function unlockablesCheck({ timeouts, shotsDir = null }) {
  return async ({ page, recorder, expect }) => {
    const out = { steps: [] };
    const step = async (name, run) => {
      out.steps.push(name);
      try {
        return await run();
      } catch (error) {
        if (shotsDir) await page.screenshot({ path: join(shotsDir, `chikun-unlockables-${name.replaceAll(' ', '-')}.png`) }).catch(() => {});
        throw new Error(`unlockables step "${name}": ${String(error?.message ?? error).split('\n')[0]}`);
      }
    };
    const frame = () => page.frameLocator('iframe.chikun-game-frame');
    const childLooks = () => page.evaluate(() => globalThis.__rankedE2E.cosmetics.slice());
    const optionId = `unlockables-${UNLOCK_CHECK.gameId}-${UNLOCK_CHECK.slot}-${UNLOCK_CHECK.unlockableId}`;

    // 1. E6 unlocks the look: the results screen's "View profile" opens the profile and its panel.
    await step('open profile', async () => {
      await page.locator('[data-ranked-results] button', { hasText: 'View profile' }).click();
      await page.locator(`#${optionId}`).waitFor({ state: 'attached', timeout: timeouts.stepMs });
    });
    await step('look unlocked', () => page.waitForFunction((id) => {
      const item = document.getElementById(id)?.closest('li');
      return Boolean(item) && item.dataset.state !== 'locked';
    }, optionId, { timeout: timeouts.stepMs }));
    out.stateBefore = await page.locator(`li.unlockables-option:has(#${optionId})`).getAttribute('data-state');
    expect('unlock-from-e6', out.stateBefore !== 'locked' && out.stateBefore !== 'coming-soon', { state: out.stateBefore });
    // The first-Ranked name prompt (profile-boards) can open over the lower-left of the page at any
    // moment after the run: a player answers it (Not now) before clicking what it covers.
    out.namePrompt = false;
    const namePrompt = page.locator('button.name-claim-later');
    await page.addLocatorHandler(namePrompt, async (later) => {
      out.namePrompt = true;
      // The toast can close on its own while this runs; a vanished button is fine.
      await later.click({ timeout: 5_000 }).catch(() => {});
    }, { noWaitAfter: true });

    // 2. The pick is saved with E7 (PUT /api/profile carrying preferences.cosmetics).
    const response = await step('pick look', async () => {
      const put = page.waitForResponse((answer) => answer.request().method() === 'PUT' && new URL(answer.url()).pathname === '/api/profile' && /cosmetics/.test(answer.request().postData() ?? ''), { timeout: timeouts.stepMs });
      put.catch(() => {}); // settled below; never an unhandled rejection when the click fails
      try {
        // The radio covers its card (the card is its label), so the player's click lands on the input.
        await page.locator(`#${optionId}`).check({ timeout: 10_000 });
      } catch (error) {
        const diag = await page.evaluate((id) => new Promise((done) => {
          const label = document.querySelector(`label[for="${id}"]`);
          const rect = label?.getBoundingClientRect();
          const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
          let mutations = 0;
          const observer = new MutationObserver((list) => { mutations += list.length; });
          const panel = document.getElementById('unlockablesPanel') ?? label?.closest('section.unlockables-panel');
          if (panel) observer.observe(panel, { childList: true, subtree: true, attributes: true });
          setTimeout(() => {
            observer.disconnect();
            done({ rect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null, vh: innerHeight, hit: hit ? `${hit.tagName}.${hit.className}` : null, mutations });
          }, 1000);
        }), optionId);
        throw new Error(`${error.message.split('\n')[0]} ${JSON.stringify(diag)}`);
      }
      return put;
    });
    let body = null;
    try { body = JSON.parse(response.request().postData() ?? 'null'); } catch { body = null; }
    const cosmetics = body?.preferences?.cosmetics ?? body?.cosmetics ?? null;
    out.put = { status: response.status(), cosmetics };
    expect('pick-puts-cosmetics', response.status() === 200 && cosmetics?.[UNLOCK_CHECK.gameId]?.[UNLOCK_CHECK.slot] === UNLOCK_CHECK.unlockableId, out.put);

    // 3. Free: the child is mounted with the look.
    const seenBeforeFree = (await childLooks()).length;
    await step('free run', async () => {
      await page.locator('#officialNavTabs a.official-nav-tab[href="/games"]').click(); // "Play"
      const card = page.locator('.official-cabinet-card.playable').filter({ hasText: GAME_TITLES.chikun }).first();
      await card.waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await card.click();
      await page.locator('#officialModeSelect:not([hidden])').waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await page.locator('#officialFreeModeButton').click();
      await frame().locator('#startButton').waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await page.waitForFunction(({ key, count }) => globalThis.__rankedE2E.cosmetics.slice(count).some((entry) => entry.cosmetics?.[key]), { key: UNLOCK_CHECK.childKey, count: seenBeforeFree }, { timeout: timeouts.stepMs });
    }).catch((error) => { out.freeError = error.message; });
    out.free = (await childLooks()).slice(seenBeforeFree).find((entry) => entry.cosmetics?.[UNLOCK_CHECK.childKey]) ?? null;
    expect('look-reaches-free-child', Boolean(out.free), { free: out.free, error: out.freeError ?? null });

    // 4. Ranked: a second paid entry mounts the child with the same look; that run publishes too.
    const seenBeforeRanked = (await childLooks()).length;
    const runsBefore = await page.evaluate(() => globalThis.__rankedE2E.rankedRuns.length);
    await step('ranked run', async () => {
      // Leave the Free run from its pause menu (a Free run's length depends on its seed).
      await frame().locator('#startButton').click();
      await frame().locator('#pauseButton').click();
      await frame().locator('#pauseExitButton').click();
      const card = page.locator('.official-cabinet-card.playable').filter({ hasText: GAME_TITLES.chikun }).first();
      await card.waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await card.click();
      await page.locator('#officialModeSelect:not([hidden])').waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await page.locator('#officialRankedModeButton').click();
      await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await page.waitForFunction(() => {
        const button = document.querySelector('#rankedEntryApprove');
        return button && !button.disabled && /confirm entry/i.test(button.textContent ?? '');
      }, null, { timeout: timeouts.stepMs });
      await confirmEntry(page, { timeoutMs: timeouts.stepMs });
      await frame().locator('#startButton').waitFor({ state: 'visible', timeout: timeouts.stepMs });
      await page.waitForFunction(({ key, count }) => globalThis.__rankedE2E.cosmetics.slice(count).some((entry) => entry.cosmetics?.[key]), { key: UNLOCK_CHECK.childKey, count: seenBeforeRanked }, { timeout: timeouts.stepMs });
    }).catch((error) => { out.rankedError = error.message; });
    out.ranked = (await childLooks()).slice(seenBeforeRanked).find((entry) => entry.cosmetics?.[UNLOCK_CHECK.childKey]) ?? null;
    expect('look-reaches-ranked-child', Boolean(out.ranked), { ranked: out.ranked, error: out.rankedError ?? null });
    if (!out.rankedError) {
      await step('second ranked run publishes', async () => {
        await frame().locator('#liveStatus').filter({ hasText: 'Ready for Ranked Mode.' }).waitFor({ state: 'visible', timeout: timeouts.stepMs });
        await frame().locator('#startButton').click();
        await frame().locator('#chikunCanvas').click({ position: { x: 80, y: 100 } });
        await page.waitForFunction((count) => globalThis.__rankedE2E.rankedRuns.length > count, runsBefore, { timeout: timeouts.publishMs });
        await page.waitForFunction(() => ['published', 'rejected', 'saved-locally'].includes(document.querySelector('[data-ranked-results]')?.dataset.state), null, { timeout: timeouts.publishMs });
      }).catch((error) => { out.secondError = error.message; });
      out.secondRankedState = await page.locator('[data-ranked-results]').getAttribute('data-state').catch(() => null);
      expect('second-ranked-published', out.secondRankedState === 'published', { state: out.secondRankedState, error: out.secondError ?? null });
    }
    await page.removeLocatorHandler(namePrompt).catch(() => {});
    out.putRequests = recorder.api.filter((line) => line.startsWith('PUT /api/profile')).length;
    return out;
  };
}

// ---------------------------------------------------------------------------
// Targets.

async function loadChromium() {
  const path = process.env.PLAYWRIGHT_PACKAGE_PATH ?? DEFAULT_PLAYWRIGHT;
  if (!existsSync(path)) throw new Error(`Playwright not found at ${path}; set PLAYWRIGHT_PACKAGE_PATH`);
  const { chromium } = await import(pathToFileURL(path).href);
  return chromium;
}

export async function runLocal({ games = GAME_ORDER, unlockables = true, keepRoot = false, shotsDir = null, log = console.log } = {}) {
  const { startLocalStack } = await import('./lib/local-stack.mjs');
  const { startLocalHttp, startRpcProxy } = await import('./lib/local-http.mjs');
  const { createFetchApi } = await import('./lib/rehearsal-driver.mjs');
  const started = Date.now();
  // A Playwright promise that rejects outside an awaited step fails the run instead of killing it.
  const unhandled = [];
  const onUnhandled = (reason) => { unhandled.push(String(reason?.message ?? reason).split('\n')[0].slice(0, 300)); };
  process.on('unhandledRejection', onUnhandled);
  const stack = await startLocalStack({ log });
  const cleanups = [async () => stack.close()];
  let throwaway = null;
  try {
    const nodeRpc = await startRpcProxy(stack);
    cleanups.unshift(() => nodeRpc.close());
    const browserRpc = await startBrowserRpcProxy(stack.eip1193);
    cleanups.unshift(() => browserRpc.close());
    throwaway = await prepareThrowawayPortal({ record: stack.record, rpcUrl: browserRpc.url, log });
    if (!keepRoot) cleanups.push(async () => throwaway.cleanup());
    const http = await startLocalHttp(stack, { staticRoot: throwaway.webRoot, applyVercelHeaders: true, extraConnectSrc: [browserRpc.origin], allowSignInHost: true });
    cleanups.unshift(() => http.close());
    browserRpc.allowOrigin(http.origin);
    log(`local site ${http.origin} (API + throwaway live portal), browser RPC ${browserRpc.url}`);

    const chromium = await loadChromium();
    const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH ?? DEFAULT_CHROME, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
    cleanups.unshift(() => browser.close());
    const api = createFetchApi(http.origin);
    const chain = { provider: stack.chain.provider, deployment: stack.deployment };
    const wallet = { rpcUrl: nodeRpc.url, privateKey: stack.wallets.player1.privateKey };
    const timeouts = { navigationMs: 60_000, stepMs: 60_000, publishMs: 180_000 };
    const results = {};
    for (const gameId of games) {
      log(`== ${gameId} ==`);
      // eslint-disable-next-line no-await-in-loop
      results[gameId] = await runGame({ browser, gameId, origin: http.origin, allowedOrigins: [browserRpc.origin], wallet, chain, api, timeouts, log, shotsDir, afterPublished: gameId === 'chikun' && unlockables ? unlockablesCheck({ timeouts, shotsDir }) : null });
    }
    const repoUnchanged = JSON.stringify(repoGuardSnapshot()) === JSON.stringify(throwaway.guard);
    return {
      schema: REPORT_SCHEMA,
      generatedAt: new Date().toISOString(),
      target: 'local',
      note: 'Local only: in-process Hardhat chain 4441, PGlite for Neon, public Hardhat fixture keys, and a throwaway live-flag portal in the OS temp directory served by scripts/lib/local-http.mjs with the vercel.json headers. Nothing touched LiteForge, Vercel or production Neon, and no committed file changed.',
      commands: {
        local: 'PLAYWRIGHT_PACKAGE_PATH=<playwright/index.mjs> node scripts/ranked-live-browser-e2e.mjs --target local',
        live: 'node scripts/ranked-live-browser-e2e.mjs --live --site https://lestersarcade.io --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> --confirm-live SPEND_TESTNET_ZKLTC --yes',
      },
      walletConnect: 'not exercised: localhost is not a Reown-allowed host; checked by hand at runbook step 9',
      throwaway: { flags: { settlementLive: true, hostedProfileSync: true }, addressModule: 'deployed (local deployment record)', publicRpc: 'loopback proxy (reads only)', launchCopy: true, csp: 'vercel.json headers, plus the loopback proxy origin in connect-src' },
      repoUnchanged,
      browserRpc: { calls: browserRpc.calls.length, refused: browserRpc.refused },
      unhandledRejections: unhandled,
      ok: repoUnchanged && browserRpc.refused.length === 0 && unhandled.length === 0 && games.every((gameId) => results[gameId].ok),
      durationMs: Date.now() - started,
      games: results,
    };
  } finally {
    for (const cleanup of cleanups) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve().then(cleanup).catch((error) => log(`cleanup: ${error?.message ?? error}`));
    }
    if (keepRoot && throwaway) log(`kept the throwaway portal at ${throwaway.base}`);
    process.off('unhandledRejection', onUnhandled);
  }
}

export async function runLiveCli({ argv, env = process.env, log = console.log, readFile = undefined }) {
  const flags = checkLiveFlags(argv);
  if (!flags.ok) {
    log('Live run refused: every live flag is required.');
    for (const flag of flags.missing) log(`  missing ${flag}`);
    for (const problem of flags.problems) log(`  ${problem}`);
    log(USAGE);
    return 2;
  }
  let games;
  try {
    games = parseGames(flagValue(argv, '--games'));
  } catch (error) {
    log(`Live run refused: ${error.message}.`);
    return 2;
  }
  const site = new URL(flagValue(argv, '--site')).origin;
  const rpcUrl = flagValue(argv, '--rpc');
  const { loadLitvmDeployment } = await import('./generate-litvm-addresses.mjs');
  const deployment = await loadLitvmDeployment();
  if (deployment.status !== 'deployed') {
    log(`Live run refused: the address module is '${deployment.status}', not 'deployed'. Runbook steps 3-8 come first.`);
    return 2;
  }
  // Read inside this process, never printed (contract §11 rule 13).
  const privateKey = readSecret({ env, argv, shape: 'private-key', envFlag: '--player-key-env', fileFlag: '--player-key-file', fieldFlag: '--player-key-field', label: 'player key', readFile });
  const provider = new ethers.JsonRpcProvider(rpcUrl, 4441, { staticNetwork: true, cacheTimeout: -1, pollingInterval: 1000 });
  try {
    const chainId = Number(BigInt(await provider.send('eth_chainId', [])));
    if (chainId !== deployment.chainId) {
      log(`Live run refused: the RPC reports chain ${chainId}, expected ${deployment.chainId}.`);
      return 2;
    }
    const player = new ethers.Wallet(privateKey).address.toLowerCase();
    const contracts = chainContracts(deployment, provider);
    let totalWei = 0n;
    for (const gameId of games) {
      // eslint-disable-next-line no-await-in-loop
      const quote = await contracts.entry.quoteEntry(ethers.id(gameId));
      totalWei += BigInt(quote.totalWei);
      log(`  entry ${gameId}: ${ethers.formatEther(quote.totalWei)} zkLTC`);
    }
    const balance = await provider.getBalance(player);
    log(`Live browser Ranked run on ${site} (chain ${chainId}); player ${player}, balance ${ethers.formatEther(balance)} zkLTC, entries ${ethers.formatEther(totalWei)} zkLTC.`);
    log('Owner checkpoint O2 (contract §10.1) applies to this wallet\'s rows. WalletConnect is not exercised here; check it by hand.');
    if (!hasFlag(argv, '--yes')) {
      log('PLAN ONLY. Nothing was signed or sent. Re-run with --yes to spend testnet zkLTC.');
      return 0;
    }
    if (balance < totalWei + LIVE_GAS_MARGIN_WEI) {
      log('Live run refused: the balance does not cover the entries and gas.');
      return 2;
    }
    const { createFetchApi } = await import('./lib/rehearsal-driver.mjs');
    const chromium = await loadChromium();
    const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH ?? DEFAULT_CHROME, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
    const results = {};
    try {
      const timeouts = { navigationMs: 90_000, stepMs: 120_000, publishMs: 600_000 };
      for (const gameId of games) {
        log(`== ${gameId} ==`);
        // eslint-disable-next-line no-await-in-loop
        results[gameId] = await runGame({ browser, gameId, origin: site, allowedOrigins: [new URL(LITEFORGE_PUBLIC_RPC).origin], wallet: { rpcUrl, privateKey }, chain: { provider, deployment }, api: createFetchApi(site), timeouts, log });
      }
    } finally {
      await browser.close();
    }
    const report = { schema: REPORT_SCHEMA, generatedAt: new Date().toISOString(), target: 'live', site, ok: games.every((gameId) => results[gameId].ok), games: results, walletConnect: 'not exercised; checked by hand at runbook step 9' };
    const out = resolve(root, flagValue(argv, '--out') ?? `docs/qa/ranked-live-browser-e2e-live-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`);
    if (!hasFlag(argv, '--no-write')) writeJson(out, report);
    log(`${report.ok ? 'PASS' : 'FAIL'}: report ${hasFlag(argv, '--no-write') ? 'not written' : `written to ${out}`}.`);
    return report.ok ? 0 : 1;
  } finally {
    provider.destroy();
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runCli({ argv = process.argv.slice(2), env = process.env, log = console.log } = {}) {
  const target = targetOf(argv);
  if (target === 'live') {
    try {
      return await runLiveCli({ argv, env, log });
    } catch (error) {
      // Key-source errors name the flag or file, never the value.
      if (error instanceof SecretSourceError) log(`Live run refused: ${error.message}`);
      else log(`Live run failed: ${error?.name ?? 'Error'}: ${error?.shortMessage ?? error?.message ?? error}`);
      return error instanceof SecretSourceError ? 2 : 1;
    }
  }
  if (target !== 'local') {
    log(USAGE);
    return 2;
  }
  for (const flag of ['--site', '--rpc', '--player-key-file', '--player-key-env', '--player-key-field', '--confirm-live', '--yes']) {
    if (argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`))) {
      log(`${flag} belongs to --live; the local target uses Hardhat fixture keys only.`);
      return 2;
    }
  }
  let games;
  try {
    games = parseGames(flagValue(argv, '--games'));
  } catch (error) {
    log(error.message);
    return 2;
  }
  const shotsDir = flagValue(argv, '--shots');
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  const report = await runLocal({ games, unlockables: !hasFlag(argv, '--no-unlockables'), keepRoot: hasFlag(argv, '--keep-root'), shotsDir, log });
  for (const gameId of games) {
    const game = report.games[gameId];
    log(`  ${gameId}: ${game.ok ? 'PASS' : 'FAIL'} ${game.checks.filter((check) => check.ok).length}/${game.checks.length}${game.settleTxHash ? `, published ${game.settleTxHash}` : ''}`);
  }
  if (!hasFlag(argv, '--no-write')) {
    const out = resolve(root, flagValue(argv, '--out') ?? LOCAL_REPORT_RELATIVE_PATH);
    writeJson(out, report);
    log(`report written to ${out}`);
  }
  log(report.ok ? 'PASS' : 'FAIL');
  return report.ok ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  process.exitCode = await runCli();
}
