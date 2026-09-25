// Hosted Scores and profile layout smoke for the game version (version-column,
// owner decision 2026-09-25: no testnet season resets; every verified score
// shows the game version it was played on).
//
//   npm run build   # apps/portal/index.html loads dist/main.js
//   PLAYWRIGHT_PACKAGE_PATH=<path to playwright/index.mjs> node scripts/hosted-scores-version-layout-smoke.mjs
//
// Offline: it serves apps/portal itself as the web root on 127.0.0.1 (an
// extensionless path such as /scores or /profile/0x… gets index.html, the way
// the Vercel rewrites answer it) and stubs every /api/ call in the browser, so
// nothing reaches Neon, LiteForge or production. Options (environment):
//   VERSION_LAYOUT_PORT       port for the in-process server (default 0: any free port)
//   VERSION_LAYOUT_ORIGIN     an already running server for apps/portal instead
//   CHROME_EXECUTABLE_PATH    Chrome to drive (default: the installed Chrome; else Playwright's Chromium)
//
// For each hosted board (HMH, Chikun and STACKED) at phone, tablet, laptop and
// desktop widths, and for the hosted profile, it checks in real Chromium that:
//   - no row runs past its card, no cell past its row, and the page never
//     scrolls sideways;
//   - every row has its version, and no version text is clipped;
//   - Published shows from 761 px up (as before the version cell existed),
//     the Version column header from 1200 px up;
//   - an unknown version ('v?', or a body without the field) is muted;
//   - the console stays clean.
// It prints one JSON summary and exits 1 on any failure.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { leaderboardScoresPath } from '../apps/portal/src/leaderboard-view.mjs';

const PORTAL_ROOT = fileURLToPath(new URL('../apps/portal/', import.meta.url));
const HOST = '127.0.0.1';
export const BOARD_WIDTHS = Object.freeze([320, 390, 600, 601, 700, 760, 761, 900, 1024, 1080, 1081, 1100, 1152, 1199, 1200, 1280, 1440]);
export const PROFILE_WIDTHS = Object.freeze([320, 390, 761, 1280]);
const GAMES = Object.freeze(['lester-blaster', 'chikun', 'stacked']);
const EPSILON = 0.5;
const PROFILE_WALLET = `0x${'5a'.repeat(20)}`;

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
});

// apps/portal as the web root; extensionless paths answer index.html (SPA routes).
export function startPortalServer({ port = 0, root = PORTAL_ROOT } = {}) {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, `http://${HOST}`).pathname);
    let file = normalize(join(root, pathname));
    if (!file.startsWith(normalize(root)) && `${file}${sep}` !== normalize(root)) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) && !extname(pathname)) file = join(root, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => resolveServer({ server, origin: `http://${HOST}:${server.address().port}` }));
  });
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const path = process.env.PLAYWRIGHT_PACKAGE_PATH;
    if (!path) throw new Error('Set PLAYWRIGHT_PACKAGE_PATH to Playwright (playwright/index.mjs) when it is not installed at the repository root.');
    return import(pathToFileURL(resolve(path)).href);
  }
}

const hex = (n, width = 64) => n.toString(16).padStart(width, '0').slice(-width);
const walletFor = (n) => `0x${hex(n * 7919 + 17, 40)}`;

// Today's labels, a generous widest one (a label shows only a version the
// deploy has shipped, game-version-labels.mjs; anything wider is cut with an
// ellipsis and keeps its tooltip), one unknown ('v?') and one row without the
// field (an E5 body cached before it existed).
export const WIDEST_LABELS = Object.freeze({ 'lester-blaster': 'HMH v99.99', chikun: 'Chikun v999', stacked: 'STACKED v99.99' });
const LABELS = Object.freeze({
  'lester-blaster': ['HMH v0.5', WIDEST_LABELS['lester-blaster'], 'HMH v?', 'HMH v0.5', null],
  chikun: ['Chikun v7', WIDEST_LABELS.chikun, 'Chikun v?', 'Chikun v6', null],
  stacked: ['STACKED v0.2', WIDEST_LABELS.stacked, 'STACKED v?', 'STACKED v0.2', null],
});
const STATS = Object.freeze({
  'lester-blaster': { kills: 1_234_567, survivalSeconds: 35_999, maxCombo: 9_999, level: 12, bossKills: 1 },
  chikun: { forksPassed: 123_456, nearMisses: 98_765, coinsCollected: 43_210, bestCombo: 9_999, survivalSeconds: 35_999 },
  stacked: { lines: 123_456, level: 15, quadClears: 9_999, perfectClears: 3, maxCombo: 999, survivalSeconds: 35_999 },
});

export function e5Body(url) {
  const params = new URL(url).searchParams;
  const game = params.get('game');
  const gameId = { 'hard-money-heroes': 'lester-blaster', 'lester-blaster': 'lester-blaster', chikun: 'chikun', 'chikuns-escape': 'chikun', stacked: 'stacked' }[game] ?? game;
  const labels = LABELS[gameId] ?? LABELS.chikun;
  const rows = Array.from({ length: 10 }, (_, index) => {
    const rank = index + 1;
    const wallet = walletFor(rank);
    const label = labels[index % labels.length];
    return {
      rank, wallet, walletShort: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
      // Long names, a hidden name (null) and a short one.
      displayName: rank % 4 === 2 ? null : rank % 4 === 3 ? 'Lo' : `Satoshi's Longest Name ${rank}`,
      avatarUri: rank === 1 ? 'lestersarcade:avatar/lilly' : null,
      score: 987_654_321 - rank * 1_111,
      stats: STATS[gameId] ?? {},
      ...(label === null ? {} : { versionLabel: label }),
      sessionId32: `0x${hex(rank)}`, shareId: hex(rank), txHash: `0x${hex(rank + 99)}`,
      explorerUrl: `https://liteforge.explorer.caldera.xyz/tx/0x${hex(rank + 99)}`,
      confirmedAt: '2026-09-24T12:00:00.000Z',
    };
  });
  const period = params.get('period') ?? 'weekly';
  return {
    ok: true, gameId, seasonId: 'fixture-season', period,
    periodKey: period === 'weekly' ? '2026-W39' : period === 'monthly' ? '2026-09' : 'all-time',
    resetsAt: period === 'all-time' ? null : '2026-09-28T00:00:00.000Z',
    page: 1, pageSize: 25, total: rows.length, rows, you: null,
  };
}

// The profile's runs: the widest labels, an unknown one, a run without the
// field (no chip) and today's STACKED label.
const PROFILE_GAMES = Object.freeze(['lester-blaster', 'stacked', 'chikun', 'lester-blaster', 'chikun', 'stacked']);
const PROFILE_CHIPS = Object.freeze([WIDEST_LABELS['lester-blaster'], WIDEST_LABELS.stacked, WIDEST_LABELS.chikun, 'HMH v?', null, 'STACKED v0.2']);

export function e6Body() {
  const session = (n, gameId, versionLabel) => ({
    sessionId32: `0x${hex(n)}`, shareId: hex(n), gameId, score: 987_654_321 - n, status: 'confirmed',
    txHash: `0x${hex(n + 50)}`, explorerUrl: `https://liteforge.explorer.caldera.xyz/tx/0x${hex(n + 50)}`,
    verifiedAt: '2026-09-24T10:00:00.000Z', confirmedAt: '2026-09-24T10:01:00.000Z', stats: STATS[gameId],
    ...(versionLabel === undefined ? {} : { versionLabel }),
  });
  const game = (bestScore) => ({ rankedRuns: 3, confirmedRuns: 3, bestScore, bestSessionId32: `0x${hex(1)}`, ranks: { weekly: 1, monthly: 1, allTime: 1 }, totals: {}, bests: {}, lastPlayedAt: '2026-09-24T10:00:00.000Z' });
  return {
    ok: true, wallet: PROFILE_WALLET,
    profile: { displayName: "Satoshi's Longest Name", avatarUri: null, hidden: false, onchainUpdatedAt: '2026-09-20T00:00:00.000Z' },
    games: { 'lester-blaster': game(987_654_320), chikun: game(987_654_319), stacked: game(987_654_318) },
    recentSessions: PROFILE_CHIPS.map((label, index) => session(index + 1, PROFILE_GAMES[index], label ?? undefined)),
    achievements: [], preferences: null, updatedAt: '2026-09-24T10:00:00.000Z',
  };
}

// Every /api/ call is answered here: E5 and E6 from the fixtures, anything
// else as the index would answer without a database (never the network).
async function stubApi(page, apiCalls) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const { pathname } = new URL(url);
    apiCalls.push(`${route.request().method()} ${pathname}`);
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) });
    if (pathname === '/api/leaderboard') return json(200, e5Body(url));
    if (pathname === '/api/profile') return json(200, e6Body());
    return json(503, { ok: false, error: 'index-not-configured' });
  });
}

// Geometry of the hosted board, measured in the page.
function measureBoard() {
  const box = (element) => element.getBoundingClientRect();
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = box(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const board = document.querySelector('.leaderboard-board-hosted');
  const table = board?.querySelector('.leaderboard-table-v10');
  const card = table?.parentElement;
  const rows = [...(table?.querySelectorAll('.leaderboard-trow') ?? [])];
  const cardRight = card ? box(card).right : 0;
  const issues = [];
  rows.forEach((row, index) => {
    const rowBox = box(row);
    if (rowBox.right > cardRight + 0.5) issues.push(`row ${index + 1} runs ${Math.round(rowBox.right - cardRight)} px past its card`);
    if (row.scrollWidth > row.clientWidth + 1) issues.push(`row ${index + 1} overflows itself by ${row.scrollWidth - row.clientWidth} px`);
    for (const cell of row.querySelectorAll(':scope > .leaderboard-td')) {
      if (!visible(cell)) continue;
      const cellBox = box(cell);
      if (cellBox.right > rowBox.right + 0.5 || cellBox.left < rowBox.left - 0.5) issues.push(`row ${index + 1}: ${cell.className} leaves the row`);
    }
    const versions = row.querySelectorAll('.lt-version');
    if (versions.length !== 1) issues.push(`row ${index + 1}: ${versions.length} version cells`);
    for (const version of versions) {
      if (!visible(version)) issues.push(`row ${index + 1}: the version is hidden`);
      if (version.scrollWidth > version.clientWidth + 0.5) issues.push(`row ${index + 1}: version "${version.textContent}" clipped (${version.scrollWidth} > ${version.clientWidth})`);
      const versionBox = box(version);
      if (versionBox.right > rowBox.right + 0.5 || versionBox.left < rowBox.left - 0.5) issues.push(`row ${index + 1}: version leaves the row`);
      const unknown = !version.title.startsWith('Played on ');
      if (version.classList.contains('is-unknown') !== unknown) issues.push(`row ${index + 1}: "${version.textContent}" muted=${!unknown}`);
    }
  });
  const head = table?.querySelector('.leaderboard-table-head');
  return {
    rows: rows.length,
    issues,
    publishedCells: rows.filter((row) => [...row.querySelectorAll('.lt-cell-date')].some(visible)).length,
    versionHeader: Boolean(head && [...head.querySelectorAll('.th-cell-version')].some(visible)),
    versions: rows.map((row) => row.querySelector('.lt-version')?.textContent ?? null),
    pageOverflow: document.scrollingElement.scrollWidth - window.innerWidth,
  };
}

function measureProfile() {
  const box = (element) => element.getBoundingClientRect();
  const rows = [...document.querySelectorAll('.profile-session-row')];
  const issues = [];
  const chips = [];
  rows.forEach((row, index) => {
    const rowBox = box(row);
    const chip = row.querySelector('.profile-session-version');
    if (!chip) { chips.push(null); return; }
    chips.push(chip.textContent);
    const chipBox = box(chip);
    if (chip.scrollWidth > chip.clientWidth + 0.5) issues.push(`run ${index + 1}: chip "${chip.textContent}" clipped`);
    if (chipBox.right > rowBox.right + 0.5 || chipBox.left < rowBox.left - 0.5) issues.push(`run ${index + 1}: chip leaves the row`);
    const unknown = chip.textContent.endsWith('v?');
    if (chip.classList.contains('is-unknown') !== unknown) issues.push(`run ${index + 1}: "${chip.textContent}" muted=${!unknown}`);
    if (unknown && chip.title !== 'Game version unknown for this run') issues.push(`run ${index + 1}: title "${chip.title}"`);
    if (!unknown && chip.title !== `Played on ${chip.textContent}`) issues.push(`run ${index + 1}: title "${chip.title}"`);
  });
  return { rows: rows.length, chips, issues, pageOverflow: document.scrollingElement.scrollWidth - window.innerWidth };
}

export async function runLayoutSmoke({ origin, chromium, executablePath } = {}) {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const failures = [];
  const boards = [];
  const profiles = [];
  const apiCalls = [];
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await context.newPage();
    const consoleIssues = [];
    page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') consoleIssues.push(`console: ${message.text()}`); });
    await stubApi(page, apiCalls);
    for (const gameId of GAMES) {
      for (const width of BOARD_WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${origin}${leaderboardScoresPath(gameId)}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.leaderboard-board-hosted .leaderboard-trow').first().waitFor({ state: 'visible', timeout: 15_000 });
        const result = await page.evaluate(measureBoard);
        const where = `${gameId} @ ${width} px`;
        for (const issue of result.issues) failures.push(`${where}: ${issue}`);
        if (result.rows !== 10) failures.push(`${where}: ${result.rows} rows`);
        if (result.pageOverflow > EPSILON) failures.push(`${where}: the page scrolls ${result.pageOverflow} px sideways`);
        const published = width >= 761 ? result.rows : 0;
        if (result.publishedCells !== published) failures.push(`${where}: Published shows on ${result.publishedCells} rows, expected ${published}`);
        if (result.versionHeader !== (width >= 1200)) failures.push(`${where}: Version header ${result.versionHeader ? 'shown' : 'hidden'}`);
        boards.push({ gameId, width, publishedCells: result.publishedCells, versionHeader: result.versionHeader, versions: result.versions.slice(0, 5) });
      }
    }
    for (const width of PROFILE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/profile/${PROFILE_WALLET}`, { waitUntil: 'domcontentloaded' });
      await page.locator('.profile-session-row').first().waitFor({ state: 'visible', timeout: 15_000 });
      const result = await page.evaluate(measureProfile);
      const where = `profile @ ${width} px`;
      for (const issue of result.issues) failures.push(`${where}: ${issue}`);
      if (result.pageOverflow > EPSILON) failures.push(`${where}: the page scrolls ${result.pageOverflow} px sideways`);
      if (JSON.stringify(result.chips) !== JSON.stringify(PROFILE_CHIPS)) failures.push(`${where}: chips ${JSON.stringify(result.chips)}`);
      profiles.push({ width, chips: result.chips });
    }
    for (const issue of consoleIssues) failures.push(issue);
    await context.close();
  } finally {
    await browser.close();
  }
  const unexpectedApi = [...new Set(apiCalls)].filter((call) => !/^GET \/api\/(leaderboard|profile)$/.test(call));
  return { ok: failures.length === 0, failures, boards, profiles, apiCalls: [...new Set(apiCalls)], unexpectedApi };
}

async function main() {
  const { chromium } = await loadPlaywright();
  const installedChrome = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
  const executablePath = process.env.CHROME_EXECUTABLE_PATH ?? (existsSync(installedChrome) ? installedChrome : undefined);
  let served = null;
  const origin = process.env.VERSION_LAYOUT_ORIGIN ?? (served = await startPortalServer({ port: Number(process.env.VERSION_LAYOUT_PORT ?? 0) })).origin;
  try {
    const summary = await runLayoutSmoke({ origin, chromium, executablePath });
    console.log(JSON.stringify({ origin, ...summary }, null, 2));
    process.exitCode = summary.ok ? 0 : 1;
  } finally {
    await new Promise((done) => (served ? served.server.close(done) : done()));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
