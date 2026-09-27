// Read-only browser audit of the live player-facing Web3 UI (live-ui-audit
// slice; report: docs/qa/live-ui-audit-20260924.json).
//
//   PLAYWRIGHT_PACKAGE_PATH=<playwright/index.mjs> node scripts/live-ui-audit.mjs \
//     [--site https://lestersarcade.io] [--out <dir>] [--viewports desktop,phone,narrow]
//
// All three viewports run by default (the report's check counts). It never
// signs, never sends a transaction and never writes to the site: in every
// browser context it opens, each request that is not GET or HEAD to the
// audited host, and any /api/ request that is not GET or HEAD, is aborted and
// listed in `blockedNonGet`.
// There is no wallet in the browser, so Sign in can only show the picker.
// Screenshots and the JSON report go to --out (default: a new folder in the
// OS temp directory), never into the repo. Exit code 0 when every check
// passed, 1 when one failed, 2 when Playwright is missing.

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { RANKED_LAUNCH_TERMS } from '../apps/portal/src/portal-content.mjs';

export const DEFAULT_SITE = 'https://lestersarcade.io';
// The owner-funded launch test wallet: board-excluded, public profile.
export const AUDIT_WALLET = '0x8841ae6244dba71f620de450e71b0ef7e0cce824';
export const AUDIT_SHARE_IDS = Object.freeze([
  '220fb144c4b2d70dfda79bfdd343656a45470b77208ee1d586ee049ff27ffcb5',
  'd3dade04aafc0f4fac101ddd33010c37d58a38c141e038a17c6072c3079d8671',
  '187f063ae968b349339f38c0f2a48c4b85aa100e4a20df8a996629f8e9464a8a',
]);
export const AUDIT_GAMES = Object.freeze([
  Object.freeze({ gameId: 'lester-blaster', slug: 'hard-money-heroes', title: 'Hard Money Heroes' }),
  Object.freeze({ gameId: 'chikun', slug: 'chikun', title: "Chikun's Escape" }),
  Object.freeze({ gameId: 'stacked', slug: 'stacked', title: 'STACKED' }),
]);
export const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }),
  phone: Object.freeze({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' }),
  narrow: Object.freeze({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' }),
});

// Launch wording rules (guide §3, D13, A32): no NFT wording in phase 1, no
// hashtags, no device-local or preview remnants, no Daily/Yearly/House tabs.
export const FORBIDDEN_WORDING = Object.freeze([
  Object.freeze({ id: 'nft', pattern: /\bNFTs?\b|soulbound/i }),
  Object.freeze({ id: 'device-local', pattern: /device-local/i }),
  Object.freeze({ id: 'hashtag', pattern: /(^|\s)#[A-Za-z]\w*/ }),
  Object.freeze({ id: 'daily-yearly-tab', pattern: /^\s*(DAILY|YEARLY)\s*$/m }),
  Object.freeze({ id: 'house-or-local-preview', pattern: /\b(House (Demo|Score)|HOUSE (DEMO|SCORE)|Local Preview|LOCAL PREVIEW)\b/ }),
]);

export function forbiddenWording(text) {
  const value = String(text ?? '');
  return FORBIDDEN_WORDING.filter(({ pattern }) => pattern.test(value)).map(({ id }) => id);
}

// The read-only guarantee: true for a request the audit must abort.
export function isBlockedRequest({ method, url, site = DEFAULT_SITE }) {
  if (['GET', 'HEAD'].includes(String(method ?? '').toUpperCase())) return false;
  let target;
  let audited;
  try {
    target = new URL(url);
    audited = new URL(site);
  } catch {
    return true;
  }
  return target.host === audited.host || target.pathname.startsWith('/api/');
}

// WCAG 2.x contrast of two sRGB colours given as [r, g, b] (0-255).
export function contrastRatio(foreground, background) {
  const luminance = ([r, g, b]) => [r, g, b]
    .map((value) => value / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

export function parseCssColor(value) {
  const match = /rgba?\(([^)]+)\)/.exec(String(value ?? ''));
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 };
}

export const DEFAULT_VIEWPORTS = Object.freeze(['desktop', 'phone', 'narrow']);

export function parseArgs(argv) {
  const options = { site: DEFAULT_SITE, out: null, viewports: [...DEFAULT_VIEWPORTS] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--site') { options.site = String(value).replace(/\/+$/, ''); index += 1; }
    else if (flag === '--out') { options.out = value; index += 1; }
    else if (flag === '--viewports') { options.viewports = String(value).split(',').filter((name) => Object.hasOwn(VIEWPORTS, name)); index += 1; }
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!/^https?:\/\//.test(options.site)) throw new Error('--site must be an http(s) origin');
  return options;
}

// One line per check; the report fails when any check has ok === false.
export function summarizeChecks(checks) {
  const failed = checks.filter((check) => check.ok === false);
  return { total: checks.length, passed: checks.filter((check) => check.ok === true).length, failed: failed.length, notRun: checks.filter((check) => check.ok === null).length, failedIds: failed.map((check) => `${check.viewport}:${check.id}`) };
}

// ---------------------------------------------------------------- browser --

// The route handler every browser context installs first: it aborts and
// records each request the read-only guarantee forbids.
function readOnlyGuard({ site, blocked, label }) {
  return (route) => {
    const request = route.request();
    if (isBlockedRequest({ method: request.method(), url: request.url(), site })) {
      blocked.push(`${label} ${request.method()} ${new URL(request.url()).pathname}`);
      return route.abort();
    }
    return route.fallback();
  };
}

async function auditViewport(browser, { site, viewportName, out, blocked, checks, pages }) {
  const context = await browser.newContext(VIEWPORTS[viewportName]);
  await context.route('**/*', readOnlyGuard({ site, blocked, label: viewportName }));
  const check = (id, ok, detail = null) => checks.push({ viewport: viewportName, id, ok, detail });

  async function visit(route, run) {
    const page = await context.newPage();
    const log = { consoleErrors: [], consoleWarnings: [], pageErrors: [], failed: [], http: [] };
    page.on('console', (message) => {
      if (message.type() === 'error') log.consoleErrors.push(message.text().slice(0, 240));
      if (message.type() === 'warning') log.consoleWarnings.push(message.text().slice(0, 240));
    });
    page.on('pageerror', (error) => log.pageErrors.push(String(error?.message ?? error).slice(0, 240)));
    page.on('response', (response) => { if (response.status() >= 400) log.http.push(`${response.status()} ${response.url().slice(0, 160)}`); });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? '';
      // The jukebox and splash film preload is cancelled by the browser.
      if (/\.(mp3|mp4|webm)(\?|$)/.test(request.url()) && reason === 'net::ERR_ABORTED') return;
      if (blocked.some((entry) => entry.endsWith(new URL(request.url()).pathname))) return;
      log.failed.push(`${request.url().slice(0, 160)} ${reason}`);
    });
    const started = Date.now();
    await page.goto(site + route, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const slug = `${viewportName}_${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 48) || 'home'}`;
    await page.screenshot({ path: path.join(out, `${slug}.png`), fullPage: true });
    const facts = await page.evaluate(() => ({
      text: document.body.innerText,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0 && image.getBoundingClientRect().width > 0).map((image) => image.getAttribute('src')),
    }));
    let detail = null;
    try { detail = run ? await run(page, slug) : null; } catch (error) { detail = { error: String(error?.message ?? error).slice(0, 300) }; }
    const record = { viewport: viewportName, route, loadMs: Date.now() - started, screenshot: `${slug}.png`, ...log, overflowX: facts.overflowX, brokenImages: facts.brokenImages, forbidden: forbiddenWording(facts.text), detail };
    pages.push(record);
    check(`page${route}:console-clean`, log.consoleErrors.length === 0 && log.pageErrors.length === 0, [...log.consoleErrors, ...log.pageErrors]);
    check(`page${route}:requests-ok`, log.failed.length === 0 && log.http.length === 0, [...log.failed, ...log.http]);
    check(`page${route}:no-horizontal-scroll`, facts.overflowX <= 1, facts.overflowX);
    check(`page${route}:images-load`, facts.brokenImages.length === 0, facts.brokenImages);
    check(`page${route}:launch-wording`, record.forbidden.length === 0, record.forbidden);
    await page.close();
    return record;
  }

  // Home: Sign in opens the picker (no wallet: install or deep links).
  await visit('/', async (page) => {
    const button = page.locator('#officialConnectButton');
    await button.focus();
    await button.press('Enter');
    await page.waitForSelector('.wallet-sheet', { timeout: 15_000 });
    // The styled sheet is a fixed overlay (the stylesheet loads on first use).
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.querySelector('.wallet-sheet-overlay'));
      return style.visibility !== 'hidden' && style.position === 'fixed';
    }, null, { timeout: 8_000 }).catch(() => {});
    const picker = await page.evaluate(() => {
      const sheet = document.querySelector('.wallet-sheet');
      return {
        labelled: sheet.getAttribute('role') === 'dialog' && Boolean(document.getElementById(sheet.getAttribute('aria-labelledby'))),
        options: [...sheet.querySelectorAll('.wallet-picker-option')].map((option) => option.innerText.replace(/\s+/g, ' ').trim()),
        links: [...sheet.querySelectorAll('a')].map((link) => ({ text: link.textContent, href: link.href })),
        focusInside: sheet.contains(document.activeElement),
        styled: getComputedStyle(document.querySelector('.wallet-sheet-overlay')).position === 'fixed',
      };
    });
    const trapped = [];
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      trapped.push(await page.evaluate(() => Boolean(document.activeElement?.closest?.('.wallet-sheet'))));
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ closed: !document.querySelector('.wallet-sheet'), focus: document.activeElement?.id ?? null }));
    const mobile = viewportName !== 'desktop';
    const installs = picker.links.filter((link) => /metamask\.io\/download|rabby\.io/.test(link.href)).length;
    const deepLinks = picker.links.filter((link) => /metamask\.app\.link\/dapp|link\.trustwallet\.com/.test(link.href)).length;
    check('home:sign-in-picker', picker.labelled && picker.styled && picker.focusInside && installs === 2 && (!mobile || deepLinks === 2), { ...picker, installs, deepLinks });
    check('home:picker-focus-trap-and-escape', trapped.every(Boolean) && after.closed && after.focus === 'officialConnectButton', { trapped, after });
    return { picker, after };
  });

  // The picker is never painted as page content, before or without its
  // stylesheet (a first visit: no HTTP cache and no service worker). 'slow'
  // delays wallet-picker.css 2.5 s; 'abort' and 'not-found' fail it, since
  // Chromium gives a failed <link> an empty, non-null sheet (review of
  // 2026-09-24). Each run opens the picker, then closes it and opens it again.
  async function coldPicker(mode) {
    const cold = await browser.newContext({ ...VIEWPORTS[viewportName], serviceWorkers: 'block' });
    await cold.route('**/*', readOnlyGuard({ site, blocked, label: `${viewportName} cold` }));
    const page = await cold.newPage();
    await page.route('**/src/styles/wallet-picker.css*', async (route) => {
      if (mode === 'abort') return route.abort();
      if (mode === 'not-found') return route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' });
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return route.fallback();
    });
    await page.goto(`${site}/`, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(1500);
    // 'unstyled': the sheet shows as page content (the overlay is not a fixed
    // layer); 'waiting': the page is dimmed and the sheet hidden; 'styled':
    // a fixed overlay with the sheet showing (stylesheet or fallback).
    const sample = () => page.evaluate(() => {
      const overlay = document.querySelector('.wallet-sheet-overlay');
      const sheet = document.querySelector('.wallet-sheet');
      if (!overlay || !sheet) return 'none';
      if (getComputedStyle(sheet).visibility === 'hidden' || getComputedStyle(overlay).visibility === 'hidden') return 'waiting';
      return getComputedStyle(overlay).position === 'fixed' ? 'styled' : 'unstyled';
    });
    await page.click('#officialConnectButton');
    const samples = [];
    for (let index = 0; index < 6; index += 1) {
      await page.waitForTimeout(250);
      samples.push(await sample());
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.click('#officialConnectButton');
    await page.waitForTimeout(400);
    const reopened = await sample();
    await cold.close();
    return { samples, reopened };
  }
  const slow = await coldPicker('slow');
  check('signin:picker-never-unstyled', !slow.samples.includes('unstyled') && slow.reopened !== 'unstyled', slow);
  const failed = { abort: await coldPicker('abort'), notFound: await coldPicker('not-found') };
  check('signin:picker-legible-when-css-fails', Object.values(failed).every(({ samples, reopened }) => !samples.includes('unstyled') && samples.at(-1) === 'styled' && reopened === 'styled'), failed);

  // Game pages: the Ranked card states the launch terms; guests read Sign in.
  for (const game of AUDIT_GAMES) {
    await visit(`/games/${game.slug}`, async (page) => {
      const cards = await page.evaluate(() => ({
        ranked: document.querySelector('#officialRankedModeCopy')?.textContent ?? '',
        lead: document.querySelector('#officialModeCopy')?.textContent ?? '',
        guest: document.querySelector('#officialRankedTooltip')?.innerText ?? '',
      }));
      check(`games/${game.slug}:ranked-terms`, cards.ranked.startsWith(`${RANKED_LAUNCH_TERMS.totalZkLtc} testnet zkLTC per run.`) && /publishes it on LitVM/.test(cards.ranked), cards.ranked);
      check(`games/${game.slug}:guest-line-says-sign-in`, !/Connect a wallet/i.test(cards.guest) && /Sign in/.test(cards.guest), cards.guest);
      return cards;
    });
  }

  // Scores: Weekly (default), Monthly, All-time, reset times, empty state or
  // verified rows, and a search box that keeps focus when its results arrive.
  await visit('/scores', async (page) => {
    const read = () => page.evaluate(() => ({
      tabs: [...document.querySelectorAll('.leaderboard-cadence-tab')].map((tab) => `${tab.textContent}${tab.getAttribute('aria-pressed') === 'true' ? '*' : ''}`),
      reset: document.querySelector('.leaderboard-reset-copy')?.textContent ?? '',
      empty: document.querySelector('.leaderboard-empty-state')?.innerText.replace(/\s+/g, ' ') ?? null,
      playRanked: Boolean(document.querySelector('.leaderboard-play-ranked')),
      rows: document.querySelectorAll('.leaderboard-trow').length,
      verifiedLinks: [...document.querySelectorAll('.leaderboard-trow .lt-verified-link')].filter((link) => /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/.test(link.href)).length,
    }));
    const weekly = await read();
    check('scores:period-tabs', weekly.tabs.join(',') === 'WEEKLY*,MONTHLY,ALL-TIME', weekly.tabs);
    const resets = { weekly: weekly.reset };
    for (const period of ['monthly', 'all-time']) {
      await page.click(`.leaderboard-cadence-tab[data-cadence="${period}"]`);
      await page.waitForTimeout(1500);
      resets[period] = (await read()).reset;
    }
    check('scores:reset-times', /Resets Monday 00:00 UTC/.test(resets.weekly) && /Resets on the 1st, 00:00 UTC/.test(resets.monthly) && /never resets/.test(resets['all-time']), resets);
    await page.click('.leaderboard-cadence-tab[data-cadence="weekly"]');
    await page.waitForTimeout(1500);
    const board = await read();
    const boardOk = board.rows > 0 ? board.verifiedLinks === board.rows : (/Be the first on this week/i.test(board.empty ?? '') && board.playRanked);
    check('scores:board-or-inviting-empty-state', boardOk, board);
    await page.focus('.leaderboard-search');
    await page.keyboard.type('0x88', { delay: 50 });
    await page.waitForTimeout(2500);
    await page.keyboard.type('41', { delay: 50 });
    await page.waitForTimeout(1500);
    const search = await page.evaluate(() => ({ value: document.querySelector('.leaderboard-search')?.value, focused: document.activeElement?.classList?.contains('leaderboard-search') ?? false }));
    check('scores:search-keeps-focus', search.value === '0x8841' && search.focused, search);
    return { weekly, resets, board, search };
  });

  // The test wallet's public profile.
  await visit(`/profile/${AUDIT_WALLET}`, async (page) => {
    await page.waitForSelector('.profile-hero-hosted .profile-hero-stats', { timeout: 15_000 }).catch(() => {});
    const profile = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.profile-quick-actions button')].map((button) => {
        const style = getComputedStyle(button);
        return { text: button.textContent, color: style.color, background: style.backgroundColor };
      });
      return {
        title: document.querySelector('#officialProfileTitle')?.textContent ?? '',
        eyebrow: document.querySelector('#officialProfileEyebrow')?.textContent ?? '',
        name: document.querySelector('.profile-hero-name')?.textContent ?? '',
        nameTransform: getComputedStyle(document.querySelector('.profile-hero-name') ?? document.body).textTransform,
        ranks: [...document.querySelectorAll('.profile-stats-grid-v9 .game-stat-cell')].map((cell) => cell.innerText.replace(/\s+/g, ' ')),
        sessions: [...document.querySelectorAll('.profile-session-row')].map((row) => ({ tx: row.querySelector('.lt-verified-link')?.href ?? null, share: row.querySelector('.profile-session-share')?.getAttribute('href') ?? null, overflow: row.getBoundingClientRect().right > (row.closest('.official-info-card')?.getBoundingClientRect().right ?? Infinity) + 1 })),
        achievements: [...document.querySelectorAll('.profile-achievement-card')].map((card) => ({ name: card.querySelector('.achievement-name')?.textContent, loaded: (card.querySelector('img')?.naturalWidth ?? 0) > 0 })),
        countLabel: document.querySelector('.achievements-count')?.textContent ?? '',
        buttons,
      };
    });
    check('profile:public-header', profile.title === 'Player Profile' && !/guest/i.test(profile.eyebrow), { title: profile.title, eyebrow: profile.eyebrow });
    check('profile:wallet-name-case', !/^0X/.test(profile.name) && profile.nameTransform !== 'uppercase', { name: profile.name, transform: profile.nameTransform });
    check('profile:no-standing-for-excluded-wallet', profile.ranks.filter((cell) => /RANK$/i.test(cell)).every((cell) => cell.startsWith('—')), profile.ranks);
    check('profile:recent-sessions-with-tx-links', profile.sessions.length > 0 && profile.sessions.every((session) => /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/.test(session.tx ?? '') && /^\/s\/[0-9a-f]{64}$/.test(session.share ?? '') && !session.overflow), profile.sessions);
    check('profile:achievements-with-badge-art', profile.achievements.length > 0 && profile.countLabel.startsWith(`${profile.achievements.length} `) && profile.achievements.every((item) => item.loaded), { count: profile.achievements.length, label: profile.countLabel, missing: profile.achievements.filter((item) => !item.loaded).map((item) => item.name) });
    const contrasts = profile.buttons.map((button) => {
      const fg = parseCssColor(button.color);
      const bg = parseCssColor(button.background);
      return { text: button.text, ratio: fg && bg && bg.alpha > 0.5 ? Math.round(contrastRatio(fg.rgb, bg.rgb) * 100) / 100 : null };
    });
    check('profile:action-button-contrast', contrasts.every((item) => item.ratio === null || item.ratio >= 4.5), contrasts);
    const tab = page.locator('.profile-game-tabs button').nth(1);
    await tab.focus();
    await tab.press('Enter');
    await page.waitForTimeout(300);
    const tabFocus = await page.evaluate(() => ({ focusedTab: document.activeElement?.closest?.('.profile-game-tabs') ? document.activeElement.textContent : null, pressed: document.activeElement?.getAttribute?.('aria-pressed') ?? null }));
    check('profile:game-tab-keeps-focus', Boolean(tabFocus.focusedTab), tabFocus);
    return { ...profile, contrasts, tabFocus };
  });

  // Share pages: tags, card image, Play button, header touch targets.
  for (const shareId of AUDIT_SHARE_IDS) {
    await visit(`/s/${shareId}`, async (page) => {
      const share = await page.evaluate(() => {
        const meta = (selector) => document.querySelector(selector)?.getAttribute('content') ?? null;
        const card = document.querySelector('img.shot');
        return {
          ogType: meta('meta[property="og:type"]'), ogSite: meta('meta[property="og:site_name"]'), ogUrl: meta('meta[property="og:url"]'), ogImage: meta('meta[property="og:image"]'),
          ogWidth: meta('meta[property="og:image:width"]'), ogHeight: meta('meta[property="og:image:height"]'), twitterCard: meta('meta[name="twitter:card"]'), twitterSite: meta('meta[name="twitter:site"]'),
          canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
          card: card ? { width: card.naturalWidth, height: card.naturalHeight } : null,
          play: document.querySelector('nav.actions a.button.primary')?.getAttribute('href') ?? null,
          tx: document.querySelector('.note a')?.href ?? null,
          headerTargets: [...document.querySelectorAll('.top a')].map((link) => Math.round(link.getBoundingClientRect().height)),
        };
      });
      const url = `https://lestersarcade.io/s/${shareId}`;
      const tagsOk = share.ogType === 'website' && share.ogSite === "Lester's Arcade" && share.ogUrl === url && share.canonical === url
        && new RegExp(`^https://lestersarcade\\.io/api/share-card/${shareId}\\.png\\?v=[0-9a-f]{12}$`).test(share.ogImage ?? '')
        && share.ogWidth === '1200' && share.ogHeight === '630' && share.twitterCard === 'summary_large_image' && share.twitterSite === '@LestersArcade';
      check(`share/${shareId.slice(0, 8)}:tags`, tagsOk, share);
      check(`share/${shareId.slice(0, 8)}:card-image`, share.card?.width === 1200 && share.card?.height === 630, share.card);
      check(`share/${shareId.slice(0, 8)}:play-button`, AUDIT_GAMES.some((game) => share.play === `/play/${game.slug}`) && /^https:\/\/liteforge\.explorer\.caldera\.xyz\/tx\/0x[0-9a-f]{64}$/.test(share.tx ?? ''), { play: share.play, tx: share.tx });
      check(`share/${shareId.slice(0, 8)}:header-touch-targets`, share.headerTargets.every((height) => height >= 44), share.headerTargets);
      return share;
    });
  }
  await context.close();
}

export async function runAudit({ site = DEFAULT_SITE, out, viewports = DEFAULT_VIEWPORTS, chromium } = {}) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const checks = [];
  const pages = [];
  const blocked = [];
  const startedAt = new Date().toISOString();
  try {
    for (const viewportName of viewports) {
      await auditViewport(browser, { site, viewportName, out, blocked, checks, pages });
    }
  } finally {
    await browser.close();
  }
  const report = { schema: 'lesters-live-ui-audit-run-v1', site, startedAt, finishedAt: new Date().toISOString(), viewports, summary: summarizeChecks(checks), blockedNonGet: blocked, checks, pages };
  writeFileSync(path.join(out, 'live-ui-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const packagePath = process.env.PLAYWRIGHT_PACKAGE_PATH;
  if (!packagePath) {
    console.error('Set PLAYWRIGHT_PACKAGE_PATH to Playwright (for example benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs).');
    process.exit(2);
  }
  const { chromium } = await import(pathToFileURL(path.resolve(packagePath)).href);
  const out = options.out ?? path.join(tmpdir(), `lesters-live-ui-audit-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const report = await runAudit({ site: options.site, out, viewports: options.viewports, chromium });
  for (const check of report.checks) console.log(`${check.ok === true ? 'PASS' : check.ok === false ? 'FAIL' : 'SKIP'} ${check.viewport} ${check.id}`);
  console.log(`${report.summary.passed}/${report.summary.total} checks passed; ${report.blockedNonGet.length} non-GET requests blocked; report ${path.join(out, 'live-ui-audit.json')}`);
  process.exit(report.summary.failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
