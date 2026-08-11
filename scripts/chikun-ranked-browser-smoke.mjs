import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    if (!process.env.PLAYWRIGHT_PACKAGE_PATH) throw new Error('Set PLAYWRIGHT_PACKAGE_PATH to Playwright when it is not installed at the repository root.');
    return createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH);
  }
}

const { chromium } = await loadPlaywright();
const origin = process.env.CHIKUN_PORTAL_ORIGIN ?? 'http://127.0.0.1:8791';
const evidencePath = process.env.CHIKUN_SMOKE_SCREENSHOT
  ?? fileURLToPath(new URL('../docs/testing/VISUAL_BASELINES/current/chikun-ranked-flow.png', import.meta.url));
const chromePath = process.env.CHROME_EXECUTABLE_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const viewportMatch = /^(\d+)x(\d+)$/.exec(process.env.CHIKUN_VIEWPORT ?? '1440x1000');
if (!viewportMatch) throw new Error('CHIKUN_VIEWPORT must use WIDTHxHEIGHT, for example 390x844.');
const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) };
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
let page;
const issues = [];

try {
  page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console: ${message.text()}`);
  });
  await page.addInitScript(() => {
    const listeners = new Map();
    const account = '0x1234567890abcdef1234567890abcdef12345678';
    globalThis.ethereum = {
      isMetaMask: true,
      request: async ({ method }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
        if (method === 'eth_chainId') return '0x1159';
        if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
        if (method === 'personal_sign') return `0x${'11'.repeat(65)}`;
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
        throw new Error(`Headless smoke provider does not implement ${method}`);
      },
      on: (event, listener) => listeners.set(event, listener),
      removeListener: (event) => listeners.delete(event),
    };
  });

  await page.goto(`${origin}/?chikunRankedSmoke=1`, { waitUntil: 'networkidle' });
  await page.click('#officialConnectButton');
  await page.locator('.official-cabinet-card.playable').first().waitFor({ state: 'visible', timeout: 10_000 });
  const walletChip = await page.locator('body').innerText();
  assert.match(walletChip, /sign out/i, 'browser smoke wallet did not connect');

  const cabinet = page.locator('.official-cabinet-card.playable').filter({ hasText: "Chikun's Escape" });
  await cabinet.waitFor({ state: 'visible' });
  assert.equal(await cabinet.isDisabled(), false, 'public Chikun cabinet must be enabled');
  await page.waitForFunction(() => [...document.querySelectorAll('.official-cabinet-card.playable')].some((card) => (
    card.textContent?.toUpperCase().includes("CHIKUN'S ESCAPE")
      && [...card.querySelectorAll('img')].some((image) => image.complete && image.naturalWidth > 0)
  )), null, { timeout: 15_000 });
  const cabinetArt = await cabinet.locator('img').evaluateAll((images) => images.map((image) => ({
    src: image.getAttribute('src'),
    width: image.naturalWidth,
    height: image.naturalHeight,
  })));
  assert.ok(cabinetArt.some((image) => image.src?.includes('chikun-cabinet') && image.width > 0 && image.height > 0), 'Chikun cabinet art did not load');
  await page.screenshot({ path: resolve(dirname(evidencePath), 'chikun-cabinet-select.png'), fullPage: true });
  await cabinet.click();

  await page.locator('#officialModeSelect:not([hidden])').waitFor({ state: 'visible' });
  await page.waitForFunction(() => [
    document.querySelector('#officialFreeModeBanner'),
    document.querySelector('#officialRankedModeBanner'),
  ].every((image) => image?.complete && image.naturalWidth > 0));
  const modeArt = await page.evaluate(() => [
    document.querySelector('#officialFreeModeBanner'),
    document.querySelector('#officialRankedModeBanner'),
  ].map((image) => ({ src: image?.getAttribute('src'), width: image?.naturalWidth, height: image?.naturalHeight })));
  assert.deepEqual(modeArt.map((image) => image.src), [
    './assets/generated/chikun-mode-select/chikuns-escape-free-mode.webp',
    './assets/generated/chikun-mode-select/chikuns-escape-ranked-mode.webp',
  ]);
  assert.ok(modeArt.every((image) => image.width >= 1200 && image.height >= 600), `mode artwork did not decode: ${JSON.stringify(modeArt)}`);
  await mkdir(dirname(evidencePath), { recursive: true });
  await page.screenshot({ path: resolve(dirname(evidencePath), 'chikun-mode-select.png'), fullPage: true });

  await page.click('#officialRankedModeButton');
  await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible' });
  await page.click('#rankedEntryApprove');

  const frameNode = page.locator('iframe.chikun-game-frame');
  await frameNode.waitFor({ state: 'visible', timeout: 15_000 });
  const frame = page.frameLocator('iframe.chikun-game-frame');
  await frame.locator('#startButton').waitFor({ state: 'visible', timeout: 15_000 });
  await frame.locator('#startButton').click();
  await frame.locator('#chikunCanvas').focus();
  await page.keyboard.press('Space');
  const controlRects = await frame.locator('.hud-actions button').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { id: button.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth };
  }));
  assert.ok(
    controlRects.every((rect) => rect.left >= 0 && rect.right <= rect.viewportWidth),
    `Chikun utility controls overflow the child viewport: ${JSON.stringify(controlRects)}`,
  );
  await page.waitForTimeout(650);
  await page.screenshot({ path: resolve(dirname(evidencePath), 'chikun-ranked-gameplay.png'), fullPage: true });
  await frame.locator('#resultScore').evaluate((node) => new Promise((resolve, reject) => {
    const deadline = performance.now() + 15_000;
    const check = () => {
      if (!document.querySelector('#resultOverlay')?.hidden && Number.parseInt(node.textContent ?? '', 10) > 0) resolve(true);
      else if (performance.now() >= deadline) reject(new Error('timed out waiting for Chikun result'));
      else setTimeout(check, 50);
    };
    check();
  }));
  const scoreText = await frame.locator('#resultScore').textContent();
  const score = Number.parseInt(scoreText ?? '', 10);
  assert.ok(Number.isInteger(score) && score > 0, `ranked runtime did not produce a score: ${scoreText}`);
  await page.waitForFunction(() => /accepted for your profile/i.test(document.querySelector('#officialGameStateCopy')?.textContent ?? ''), null, { timeout: 10_000 });
  await frame.locator('#resultExitButton').click();
  await page.locator('#officialArcadeFloor:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });

  await page.getByRole('button', { name: 'Scores', exact: true }).click();
  const chikunScoreTab = page.locator('.leaderboard-game-tab').filter({ hasText: "Chikun's Escape" }).first();
  await chikunScoreTab.click();
  await page.waitForFunction((expectedScore) => [...document.querySelectorAll('.leaderboard-trow .lt-score')].some((node) => node.textContent?.replaceAll(',', '') === String(expectedScore)), score);
  const scoreBoardText = (await page.locator('.leaderboard-board-card').innerText()).replace(/\s+/g, ' ');
  assert.match(scoreBoardText, /CHIKUN'S ESCAPE/i);
  assert.match(scoreBoardText, /COINS/i);
  assert.match(scoreBoardText, /FORKS/i);

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const chikunProfileTab = page.locator('.profile-game-tabs .leaderboard-game-tab').filter({ hasText: "Chikun's Escape" });
  await chikunProfileTab.click();
  const profileText = (await page.locator('.game-stats-card').innerText()).replace(/\s+/g, ' ');
  assert.match(profileText, /LONGEST FLIGHT/i);
  assert.match(profileText, /REPLAY VERIFIED/i);
  assert.match(profileText, new RegExp(String(score)));

  await page.screenshot({ path: resolve(evidencePath), fullPage: true });
  assert.deepEqual(issues, [], `browser console/runtime issues:\n${issues.join('\n')}`);
  console.log(JSON.stringify({ status: 'PASS', viewport, score, cabinetArt, modeArt, controlRects, scoreBoard: true, profile: true, screenshot: evidencePath }, null, 2));
} catch (error) {
  const state = await page?.evaluate(() => ({
    path: location.pathname,
    visibleViews: [...document.querySelectorAll('.official-view')].filter((node) => !node.hidden).map((node) => node.id),
    simulatedBanner: { hidden: document.querySelector('#simulatedWalletBanner')?.hidden, text: document.querySelector('#simulatedWalletBanner')?.textContent },
    bodyText: document.body.innerText.slice(0, 1200),
  })).catch(() => null);
  if (state) {
    const child = page?.frames().find((candidate) => candidate.url().includes('/chikun/index.html'));
    state.child = child ? await child.evaluate(() => ({
      text: document.body.innerText,
      status: document.querySelector('#statusMessage')?.textContent,
      startHidden: document.querySelector('#startPanel')?.hidden,
      resultHidden: document.querySelector('#resultPanel')?.hidden,
      score: document.querySelector('#scoreValue')?.textContent,
    })).catch(() => null) : null;
  }
  console.error(JSON.stringify({ status: 'FAIL', state, issues }, null, 2));
  throw error;
} finally {
  await browser.close();
}
