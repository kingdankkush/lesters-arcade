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
const mode = process.env.CHIKUN_MODE ?? 'ranked';
if (!['free', 'ranked'].includes(mode)) throw new Error('CHIKUN_MODE must be free or ranked.');
const ranked = mode === 'ranked';
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
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => { globalThis.__chikunSharedPayload = payload; },
    });
  });

  await page.goto(`${origin}/?chikunSmoke=${mode}`, { waitUntil: 'networkidle' });
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

  if (ranked) {
    await page.click('#officialRankedModeButton');
    await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible' });
    await page.click('#rankedEntryApprove');
  } else {
    await page.click('#officialFreeModeButton');
    assert.equal(await page.locator('#rankedEntryModal').isVisible(), false, 'Free Mode must not enter Ranked preflight');
  }

  const frameNode = page.locator('iframe.chikun-game-frame');
  await frameNode.waitFor({ state: 'visible', timeout: 15_000 });
  const frame = page.frameLocator('iframe.chikun-game-frame');
  await frame.locator('#startButton').waitFor({ state: 'visible', timeout: 15_000 });
  const startUi = await frame.locator('#startOverlay').evaluate((overlay) => {
    const viewport = { width: innerWidth, height: innerHeight };
    const nodes = [...overlay.querySelectorAll('h1,p,button,small')].filter((node) => getComputedStyle(node).display !== 'none');
    return {
      viewport,
      controls: nodes.map((node) => { const rect = node.getBoundingClientRect(); return { tag: node.tagName, id: node.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; }),
    };
  });
  assert.ok(startUi.controls.every((rect) => rect.left >= -1 && rect.right <= startUi.viewport.width + 1 && rect.top >= -1 && rect.bottom <= startUi.viewport.height + 1), `Chikun start UI overflows: ${JSON.stringify(startUi)}`);
  const startButtonRect = startUi.controls.find((rect) => rect.id === 'startButton');
  assert.ok(startButtonRect?.height >= 44, `Chikun start control is too small: ${JSON.stringify(startButtonRect)}`);
  await frame.locator('#startButton').click();
  const canvas = frame.locator('#chikunCanvas');
  await canvas.focus();
  const scoreBeforeInput = Number(await frame.locator('#scoreValue').textContent());
  await canvas.click({ position: { x: 80, y: 100 } });
  await page.keyboard.press('Space');
  await page.waitForTimeout(180);
  const scoreAfterInput = Number(await frame.locator('#scoreValue').textContent());
  assert.ok(scoreAfterInput > scoreBeforeInput, `Chikun simulation did not advance after pointer/keyboard input: ${scoreBeforeInput} -> ${scoreAfterInput}`);

  await frame.locator('#pauseButton').click();
  await frame.locator('#pauseOverlay:not(.is-hidden)').waitFor({ state: 'visible' });
  const pauseControls = await frame.locator('#pauseOverlay button').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { id: button.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  }));
  assert.ok(pauseControls.every((rect) => rect.left >= 0 && rect.right <= rect.viewportWidth && rect.top >= 0 && rect.bottom <= rect.viewportHeight && rect.height >= 44), `Chikun pause controls are not mobile-safe: ${JSON.stringify(pauseControls)}`);
  await frame.locator('#resumeButton').click();
  await frame.locator('#pauseOverlay.is-hidden').waitFor({ state: 'attached' });

  const mobileChild = startUi.viewport.width <= 700;
  const muteControl = mobileChild ? frame.locator('#pauseMuteButton') : frame.locator('#muteButton');
  if (mobileChild) {
    await frame.locator('#pauseButton').click();
    await frame.locator('#pauseOverlay:not(.is-hidden)').waitFor({ state: 'visible' });
  }
  await muteControl.click();
  assert.equal(await muteControl.getAttribute('aria-pressed'), 'true');
  await muteControl.click();
  assert.equal(await muteControl.getAttribute('aria-pressed'), 'false');
  if (mobileChild) await frame.locator('#resumeButton').click();

  const controlRects = await frame.locator('.hud-actions button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { id: button.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  }));
  assert.ok(
    controlRects.every((rect) => rect.left >= 0 && rect.right <= rect.viewportWidth && rect.top >= 0 && rect.bottom <= rect.viewportHeight && rect.width >= 44 && rect.height >= 44),
    `Chikun utility controls overflow the child viewport: ${JSON.stringify(controlRects)}`,
  );
  const upgradeHud = await frame.locator('.hud-secondary').evaluate((hud) => {
    const rect = hud.getBoundingClientRect();
    return {
      combo: document.querySelector('#comboValue')?.textContent,
      nearMisses: document.querySelector('#nearMissValue')?.textContent,
      visible: getComputedStyle(hud).display !== 'none',
      left: rect.left,
      right: rect.right,
      viewportWidth: innerWidth,
    };
  });
  assert.equal(upgradeHud.visible, true, 'Chikun combo and near-miss HUD must remain visible');
  assert.ok(upgradeHud.left >= 0 && upgradeHud.right <= upgradeHud.viewportWidth, `Chikun upgrade HUD overflows: ${JSON.stringify(upgradeHud)}`);
  const frameTiming = await canvas.evaluate(() => new Promise((resolve) => {
    const samples = [];
    let previous = performance.now();
    const start = previous;
    const sample = (now) => {
      samples.push(now - previous);
      previous = now;
      if (now - start >= 650) {
        const ordered = samples.slice(1).sort((a, b) => a - b);
        resolve({ frames: ordered.length, p95Ms: ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))] ?? 0 });
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  assert.ok(frameTiming.frames >= 20 && frameTiming.p95Ms <= 50, `Chikun frame pacing is unhealthy: ${JSON.stringify(frameTiming)}`);
  const gameplayPath = resolve(dirname(evidencePath), `chikun-${mode}-gameplay.png`);
  await frameNode.screenshot({ path: gameplayPath });
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
  const resultUi = await frame.locator('#resultOverlay').evaluate(() => {
    const timeline = document.querySelector('#replayTimeline');
    const share = document.querySelector('#shareRunButton');
    const timelineRect = timeline?.getBoundingClientRect();
    const shareRect = share?.getBoundingClientRect();
    const actionRects = [...document.querySelectorAll('#resultOverlay button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { id: button.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    return {
      bars: timeline?.children.length ?? 0,
      timelineLabel: timeline?.getAttribute('aria-label') ?? '',
      timelineVisible: Boolean(timelineRect && timelineRect.width > 0 && timelineRect.height > 0),
      shareVisible: Boolean(shareRect && shareRect.width > 0 && shareRect.height > 0),
      shareRight: shareRect?.right ?? 0,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      actionRects,
    };
  });
  assert.equal(resultUi.bars, 24, `Chikun replay timeline must render 24 bounded bins: ${JSON.stringify(resultUi)}`);
  assert.match(resultUi.timelineLabel, /flaps across this run/i);
  assert.equal(resultUi.timelineVisible, true);
  assert.equal(resultUi.shareVisible, true);
  assert.ok(resultUi.shareRight <= resultUi.viewportWidth, `Chikun share control overflows: ${JSON.stringify(resultUi)}`);
  assert.ok(resultUi.actionRects.every((rect) => (
    rect.left >= 0 && rect.right <= resultUi.viewportWidth && rect.top >= 0 && rect.bottom <= resultUi.viewportHeight && rect.bottom - rect.top >= 44
  )), `Chikun result controls must fit entirely inside the child viewport: ${JSON.stringify(resultUi)}`);
  await frame.locator('#shareRunButton').click();
  await frame.locator('#shareRunButton').filter({ hasText: 'Shared' }).waitFor({ state: 'visible' });
  const sharedPayload = await frame.locator('body').evaluate(() => globalThis.__chikunSharedPayload);
  assert.equal(sharedPayload?.title, "Chikun's Escape");
  assert.equal(sharedPayload?.url, 'https://lestersarcade.io');
  assert.match(sharedPayload?.text ?? '', ranked ? /Replay Verified Ranked/i : /Free Practice/i);
  assert.match(sharedPayload?.text ?? '', new RegExp(`${score.toLocaleString('en-US')} points`, 'i'));
  assert.doesNotMatch(sharedPayload?.text ?? '', /0x[a-f0-9]{40}|session-/i);
  await frameNode.screenshot({ path: resolve(dirname(evidencePath), `chikun-${mode}-result.png`) });
  if (ranked) {
    await page.waitForFunction(() => /accepted for your profile/i.test(document.querySelector('#officialGameStateCopy')?.textContent ?? ''), null, { timeout: 10_000 });
  } else {
    await page.waitForFunction(() => /no profile or leaderboard write/i.test(document.querySelector('#officialGameStateCopy')?.textContent ?? ''), null, { timeout: 10_000 });
  }
  await frame.locator('#resultExitButton').click();
  await page.locator('#officialArcadeFloor:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });

  await page.getByRole('button', { name: 'Scores', exact: true }).click();
  const chikunScoreTab = page.locator('.leaderboard-game-tab').filter({ hasText: "Chikun's Escape" }).first();
  await chikunScoreTab.click();
  if (ranked) {
    await page.waitForFunction((expectedScore) => [...document.querySelectorAll('.leaderboard-trow .lt-score')].some((node) => node.textContent?.replaceAll(',', '') === String(expectedScore)), score);
  } else {
    assert.equal(await page.locator('.leaderboard-trow .lt-score').filter({ hasText: String(score) }).count(), 0, 'Free Mode score must not appear on the score board');
  }
  const scoreBoardText = (await page.locator('.leaderboard-board-card').innerText()).replace(/\s+/g, ' ');
  assert.match(scoreBoardText, /CHIKUN'S ESCAPE/i);
  if (ranked) {
    assert.match(scoreBoardText, /COINS/i);
    assert.match(scoreBoardText, /FORKS/i);
    assert.match(scoreBoardText, /NEAR MISS/i);
  } else {
    assert.match(scoreBoardText, /No unpublished local ranked scores/i);
  }

  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  const chikunProfileTab = page.locator('.profile-game-tabs .leaderboard-game-tab').filter({ hasText: "Chikun's Escape" });
  await chikunProfileTab.click();
  const profileText = (await page.locator('.game-stats-card').innerText()).replace(/\s+/g, ' ');
  if (ranked) {
    assert.match(profileText, /LONGEST FLIGHT/i);
    assert.match(profileText, /NEAR MISSES/i);
    assert.match(profileText, /BEST COMBO/i);
    assert.match(profileText, /REPLAY VERIFIED/i);
    assert.match(profileText, new RegExp(String(score)));
  } else {
    assert.match(profileText, /No runs recorded for Chikun's Escape yet/i);
    assert.doesNotMatch(profileText, new RegExp(`BEST SCORE\\s+${score}`, 'i'));
  }

  await page.screenshot({ path: resolve(evidencePath), fullPage: true });
  assert.deepEqual(issues, [], `browser console/runtime issues:\n${issues.join('\n')}`);
  console.log(JSON.stringify({ status: 'PASS', mode, viewport, score, startUi, pauseControls, frameTiming, cabinetArt, modeArt, controlRects, upgradeHud, resultUi, sharedPayload, scoreBoard: ranked ? 'recorded' : 'isolated', profile: ranked ? 'recorded' : 'isolated', gameplayScreenshot: gameplayPath, screenshot: evidencePath }, null, 2));
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
