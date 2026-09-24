import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { NOT_RUN_EXIT_CODE, startPortalStaticServer, summarizeFlowResults } from './hmh-reboot-portal-e2e.mjs';
import { PORTAL_COPY } from '../apps/portal/src/portal-content.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const evidenceDir = path.resolve(process.env.STACKED_EVIDENCE_DIR || path.join(root, '.tmp/stacked-playable'));
await mkdir(evidenceDir, { recursive: true });
const dependency = process.env.STACKED_PLAYWRIGHT_PATH || path.join(root, 'benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(dependency).href);
const { server, origin } = process.env.STACKED_ORIGIN
  ? { server: { close(callback) { callback?.(); } }, origin: new URL(process.env.STACKED_ORIGIN).origin }
  : await startPortalStaticServer({ rootDir: path.join(root, 'apps/portal') });
// The settlement flag the served portal carries (apps/portal/src/settlement.mjs is served as a static
// file): true, false, or null when it cannot be read. The preview assertions hold only while it is false.
async function servedSettlementLive(origin) {
  try {
    const response = await fetch(new URL('/src/settlement.mjs', origin), { cache: 'no-store' });
    if (!response.ok) return null;
    const match = /export const SETTLEMENT_LIVE = (true|false);/.exec(await response.text());
    return match ? match[1] === 'true' : null;
  } catch {
    return null;
  }
}
const servedLive = await servedSettlementLive(origin);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const reports = [];
try {
  for (const { name, mobile, width, height } of [
    { name:'desktop', mobile:false, width:1440, height:1000 },
    { name:'mobile', mobile:true, width:390, height:844 },
    { name:'small-mobile', mobile:true, width:320, height:740 },
    { name:'landscape-mobile', mobile:true, width:844, height:390 },
    { name:'tablet', mobile:true, width:768, height:1024 },
    { name:'small-desktop', mobile:false, width:1024, height:768 },
  ]) {
    const errors = [], warnings = [];
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); else if (message.type() === 'warning') warnings.push(message.text()); });
    // Failed requests are errors too; a view that drops an image or media load (ERR_ABORTED) is not.
    page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText ?? 'failed';
      if (!(/ERR_ABORTED/.test(failure) && request.method() === 'GET' && !new URL(request.url()).pathname.startsWith('/api/'))) errors.push(`requestfailed ${request.url()} ${failure}`);
    });
    // The shared static server has no headers. Enforce the exact candidate CSP on the real document.
    const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
    const csp = config.headers.find(rule => rule.source === '/stacked/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;
    if (!process.env.STACKED_ORIGIN) await page.route('**/stacked/index.html', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp.replace('; upgrade-insecure-requests', '') } });
    });
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await page.locator('#officialGuestEnterButton').click();
    await page.locator('.official-cabinet-card').filter({ hasText: 'STACKED' }).click();
    assert.equal(await page.locator('#officialModeTitle').textContent(), 'STACKED');
    // The mode line and the Ranked card are the flag-driven site copy (A33; live UI audit 2026-09-24).
    assert.equal(await page.locator('#officialModeCopy').textContent(), PORTAL_COPY.modeSelect.stacked.copy);
    // A wallet-bound, replay-verified run (no "Local Only" tag).
    assert.equal((await page.locator('#officialRankedModeTitle').textContent()).trim(), 'Play Ranked');
    assert.equal(await page.locator('#officialRankedModeCopy').textContent(), PORTAL_COPY.modeSelect.stacked.ranked);
    await page.waitForFunction(() => ['officialFreeModeBanner', 'officialRankedModeBanner'].every(id => {
      const image = document.getElementById(id); return image.complete && image.naturalWidth > 0;
    }));
    assert.equal(await page.locator('#officialModeArtNote').isHidden(), true);
    await page.evaluate(async () => {
      await Promise.all(['officialFreeModeBanner', 'officialRankedModeBanner'].map(id => document.getElementById(id).decode()));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: path.join(evidenceDir, name + '-mode-select.png') });
    await page.locator('#officialFreeModeButton').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]', { timeout: 30000 });
    await frame.locator('#soundToggle').focus();
    await page.keyboard.press('Tab');
    assert.equal(await frame.evaluate(() => document.activeElement.id), 'continueButton', 'dialog focus wraps to its first control');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await frame.evaluate(() => document.activeElement.id), 'soundToggle', 'dialog focus wraps backwards');
    await frame.locator('#motionToggle').check();
    await frame.waitForFunction(() => document.querySelector('#stackedStatus').textContent.includes('Preferences saved'));
    await frame.locator('#motionToggle').uncheck();
    await frame.locator('#flashToggle').uncheck();
    if(mobile) await frame.locator('#leftHandToggle').check();
    for (const mode of ['aurora', 'spectrum', 'orbit']) {
      await frame.locator('#visualizerSelect').selectOption(mode);
      await frame.waitForFunction(mode => document.querySelector('#stackedStage').dataset.visualizerMode === mode, mode);
    }
    if(mobile) {
      await frame.locator('#visualizerSelect').selectOption('living');
      await frame.waitForFunction(()=>document.querySelector('#stackedStage').dataset.visualizerMode==='living');
      assert.equal(await frame.locator('#visualizerSelect').isVisible(),true);
      assert.equal(await frame.locator('#stackedStage').getAttribute('data-visualizer-mode'),'living');
      assert.equal(await frame.locator('#stackedStage').getAttribute('data-rendered-particles'),'432');
      assert.equal(await frame.locator('#stackedStage').getAttribute('data-particle-capacity'),'256');
    }
    // Scene deck and menu tiles (owner direction 2026-09-16): the choice reaches the renderer and persists on this device.
    await frame.locator('#sceneSelect').selectOption('horizon');
    await frame.waitForFunction(() => document.querySelector('#stackedStage').dataset.visualizerScene === 'horizon');
    await frame.locator('#scoresTile').click();
    assert.equal(await frame.locator('#scoreShelf').isVisible(), true, 'the Scores tile opens the device shelf');
    await frame.locator('#scoresTile').click();
    assert.equal(await frame.locator('#freeModeTile').getAttribute('aria-current'), 'true');
    await frame.locator('#intensityRange').fill('55');
    await frame.locator('#intensityRange').dispatchEvent('change');
    await frame.locator('#volumeRange').fill('20');
    await frame.locator('#volumeRange').dispatchEvent('change');
    await page.screenshot({ path: path.join(evidenceDir, name + '-music-settings.png') });
    await frame.locator('#continueButton').focus();
    await page.keyboard.press('Space');
    await frame.waitForFunction(() => Number(document.querySelector('#stackedStage').dataset.simulationTick) > 60);
    const baselineTick = await frame.locator('#stackedStage').getAttribute('data-simulation-tick');
    await frame.locator('#pauseButton').click();
    const pausedTick = await frame.locator('#stackedStage').getAttribute('data-simulation-tick');
    await page.waitForTimeout(250);
    assert.equal(await frame.locator('#stackedStage').getAttribute('data-simulation-tick'), pausedTick);
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(tick => Number(document.querySelector('#stackedStage').dataset.simulationTick) > Number(tick), pausedTick);
    if (mobile) {
      await frame.locator('[data-action="moveLeft"]').tap();
      await frame.locator('[data-action="rotateCW"]').tap();
      await frame.locator('[data-action="hardDrop"]').tap();
    } else {
      await frame.locator('#stackedStage canvas').focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(evidenceDir, name + '-playable.png') });
    await frame.waitForFunction(()=>document.querySelector('#stackedStage').dataset.audioAvailable==='true',null,{timeout:15000});
    const dimensions = await frame.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, audio: document.querySelector('#stackedStage').dataset.audioAvailable }));
    assert.ok(dimensions.scrollWidth <= dimensions.width + 1, 'no horizontal overflow');
    assert.ok(dimensions.scrollHeight <= dimensions.height + 1, 'no vertical overflow');
    for (let i = 0; i < 30 && await frame.locator('#restartButton').isHidden(); i++) {
      if (mobile) await frame.locator('[data-action="hardDrop"]').tap();
      else await page.keyboard.press('Space');
      await page.waitForTimeout(80);
    }
    await frame.waitForSelector('#restartButton:not([hidden])');
    await frame.waitForFunction(() => document.querySelector('#overlayCopy').textContent.includes('Replay verified'), { timeout: 20000 });
    const result = await frame.locator('#overlayCopy').textContent();
    assert.match(await frame.locator('#freeMedalSummary').textContent(), /1 completed run on this device/);
    const shelf = await frame.evaluate(() => JSON.parse(localStorage.getItem('stacked-free-medals-v1')));
    assert.equal(shelf.runs, 1);
    await page.screenshot({ path: path.join(evidenceDir, name + '-result.png') });
    await frame.locator('#preferencePanel > summary').click();
    await frame.locator('#effectsToggle').check();
    await frame.waitForFunction(() => document.querySelector('#stackedStatus').textContent.includes('Preferences saved'));
    await frame.locator('#restartButton').click();
    await page.waitForTimeout(600);
    const restarted = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await restarted.waitForSelector('#stackedStage[data-assets-ready="true"]');
    assert.equal(await restarted.locator('#effectsToggle').isChecked(), true, 'preferences persist across a fresh run');
    assert.equal(await restarted.locator('#visualizerSelect').inputValue(), mobile ? 'living' : 'orbit');
    assert.equal(await restarted.locator('#intensityRange').inputValue(), '55');
    assert.equal(await restarted.locator('#volumeRange').inputValue(), '20');
    assert.equal(await restarted.locator('#flashToggle').isChecked(),false);
    assert.equal(await restarted.locator('#leftHandToggle').isChecked(),mobile);
    assert.equal(await restarted.locator('#sceneSelect').inputValue(), 'horizon', 'the backdrop scene persists on this device');
    assert.equal(await restarted.locator('#boardPulseToggle').isChecked(), true);
    await restarted.locator('#overlayExitButton').click();
    await page.waitForSelector('#officialWalletSplash:not([hidden])');
    assert.equal(await page.locator('iframe.stacked-game-frame').count(), 0);
    reports.push({ name, baselineTick, dimensions, result, errors, warnings });
    await context.close();
    console.log(JSON.stringify(reports.at(-1)));
    assert.deepEqual(errors, [], name + ' has no browser errors');
  }
  // Ranked in preview (both settlement flags false). The Chikun smoke's fixture stub signs in (public key
  // 0x11…11); the entry modal approves without payment, and nothing may reach /api (contract §9.1).
  // Against a portal serving SETTLEMENT_LIVE = true (after runbook step 7) these passes are reported as
  // NOT RUN (status 'not-run', never a pass; the last line names them and --fail-on-not-run exits 3):
  // the live Ranked run is scripts/ranked-live-browser-e2e.mjs --live (runbook step 9).
  if (servedLive === true) {
    reports.push({ name: 'ranked-preview', status: 'not-run', notRun: 'the served portal has SETTLEMENT_LIVE on' });
    console.log(JSON.stringify(reports.at(-1)));
  }
  for (const { name, mobile, width, height } of servedLive === true ? [] : [
    { name:'ranked-desktop', mobile:false, width:1440, height:1000 },
    { name:'ranked-mobile', mobile:true, width:390, height:844 },
  ]) {
    const errors = [], apiRequests = [];
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText ?? 'failed';
      if (!(/ERR_ABORTED/.test(failure) && request.method() === 'GET' && !new URL(request.url()).pathname.startsWith('/api/'))) errors.push(`requestfailed ${request.url()} ${failure}`);
    });
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${request.url()}`); });
    await page.addInitScript(() => {
      if (globalThis.top !== globalThis) return;
      const account = '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a';
      globalThis.ethereum = {
        isMetaMask: true,
        on: () => {},
        removeListener: () => {},
        request: async ({ method, params = [] }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
          if (method === 'eth_chainId') return '0x1159';
          if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
          if (method === 'personal_sign') {
            const ethers = await import('/vendor/ethers.min.js');
            return new ethers.Wallet(`0x${'11'.repeat(32)}`).signMessage(String(params[0] ?? ''));
          }
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
          throw new Error(`Headless smoke provider does not implement ${method}`);
        },
      };
    });
    if (!process.env.STACKED_ORIGIN) {
      const config = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
      const csp = config.headers.find(rule => rule.source === '/stacked/(.*)').headers.find(header => header.key === 'Content-Security-Policy').value;
      await page.route('**/stacked/index.html', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp.replace('; upgrade-insecure-requests', '') } });
      });
    }
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    assert.equal((await page.locator('#officialConnectButton').textContent()).trim(), 'Sign in');
    await page.locator('#officialConnectButton').click();
    await page.locator('.official-cabinet-card.playable').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.official-cabinet-card.playable').filter({ hasText: 'STACKED' }).click();
    assert.equal((await page.locator('#officialRankedModeTitle').textContent()).trim(), 'Play Ranked');
    await page.locator('#officialRankedModeButton').click();
    await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible' });
    const entryModal = (await page.locator('#rankedEntryModal').innerText()).replace(/\s+/g, ' ');
    for (const expected of [/Ranked · Entry/i, /Entry 0\.1 zkLTC/, /Settlement reserve/, /0\.002 zkLTC/, /Total 0\.102 zkLTC/, /no transaction is sent/i]) assert.match(entryModal, expected);
    await page.locator('#rankedEntryApprove').click();
    const frame = await (await page.waitForSelector('iframe.stacked-game-frame')).contentFrame();
    await frame.waitForSelector('#stackedStage[data-assets-ready="true"]', { timeout: 30000 });
    // The Ranked copy the child and the parent show in preview (ranked-client).
    await frame.waitForFunction(() => document.querySelector('#modeLabel')?.textContent === 'RANKED');
    assert.equal(await page.locator('#officialGameModeTitle').textContent(), 'STACKED // Local Ranked Preview');
    assert.equal(await frame.locator('#rankedModeTile').getAttribute('aria-current'), 'true');
    assert.equal(await frame.locator('#rankedModeTile .tile-hint').textContent(), 'Verified runs');
    await frame.locator('#rankedModeTile').click();
    await frame.waitForFunction(() => document.querySelector('#stackedStatus')?.textContent === 'Ranked is active for this run.');
    // Play: hard drops until the stack tops out.
    await frame.locator('#continueButton').click();
    await frame.waitForFunction(() => Number(document.querySelector('#stackedStage').dataset.simulationTick) > 30);
    if (!mobile) await frame.locator('#stackedStage canvas').focus();
    for (let i = 0; i < 120 && await frame.locator('#restartButton').isHidden(); i++) {
      if (mobile) await frame.locator('[data-action="hardDrop"]').tap();
      else await page.keyboard.press('Space');
      await page.waitForTimeout(80);
    }
    // The parent results screen (results-share, contract §7.3) opens over the cabinet in its preview state.
    const screen = page.locator('[data-ranked-results]');
    await screen.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-ranked-results]')?.dataset.state === 'preview', null, { timeout: 10000 });
    const results = await screen.evaluate(root => ({
      eyebrow: root.querySelector('.rr-eyebrow')?.textContent ?? '',
      score: root.querySelector('.rr-score-value')?.textContent ?? '',
      banner: root.querySelector('.rr-banner-text')?.textContent ?? '',
      steps: [...root.querySelectorAll('li[data-step]')].map(node => node.dataset.status),
      shareHref: root.querySelector('a[data-share="x"]')?.getAttribute('href') ?? null,
    }));
    assert.match(results.eyebrow, /Ranked preview · STACKED/i);
    assert.match(results.banner, /not published while online settlement is off/i);
    assert.deepEqual([...new Set(results.steps)], ['skipped']);
    const intent = new URL(results.shareHref);
    assert.equal(intent.searchParams.get('url'), 'https://lestersarcade.io', 'preview shares the Free template to the site root');
    assert.doesNotMatch(intent.searchParams.get('text') ?? '', /0x[a-f0-9]{40}|session-|#/i);
    await page.screenshot({ path: path.join(evidenceDir, name + '-results.png') });
    // Close the parent overlay before touching the child panel; its View results button stays up.
    await page.keyboard.press('Escape');
    await screen.waitFor({ state: 'detached', timeout: 10000 });
    await page.locator('.cabinet-results-reopen').waitFor({ state: 'visible', timeout: 5000 });
    await frame.waitForFunction(() => document.querySelector('#overlayCopy').textContent === 'Replay verified. Ranked preview: nothing is published while online settlement is off.', null, { timeout: 20000 });
    assert.equal(await frame.locator('#shareRow').isHidden(), true, 'the child share row is hidden for Ranked');
    assert.equal(await frame.locator('#restartButton').textContent(), 'Choose a new Ranked run');
    assert.equal(await frame.locator('#restartButton').isEnabled(), true);
    const stateCopy = await page.locator('#officialGameStateCopy').textContent();
    assert.match(stateCopy, /Canonical Ranked preview saved locally/i);
    assert.doesNotMatch(stateCopy, /accepted for your profile|STACKED replay verified locally/i);
    assert.equal(results.score.replaceAll(',', ''), (await frame.locator('#resultScore').textContent()).replaceAll(',', ''), 'the results screen shows the run score');
    await page.screenshot({ path: path.join(evidenceDir, name + '-child-result.png') });
    // A16: "Choose a new Ranked run" opens the Ranked entry modal (its View results button hides under
    // it). Cancelling spends nothing and leaves the finished run on screen, View results included.
    await frame.locator('#restartButton').click();
    await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await page.locator('#rankedEntryModal').innerText(), /Ranked · Entry/i);
    assert.equal(await page.locator('.cabinet-results-reopen').isVisible(), false, 'View results hides under the entry modal');
    await page.locator('#rankedEntryCancel').click();
    await page.locator('#rankedEntryModal').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('.cabinet-results-reopen').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('iframe.stacked-game-frame').count(), 1, 'the finished cabinet stays after a cancelled entry');
    // View results reopens the same preview screen.
    await page.locator('.cabinet-results-reopen').click();
    await screen.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await screen.getAttribute('data-state'), 'preview');
    await page.keyboard.press('Escape');
    await screen.waitFor({ state: 'detached', timeout: 10000 });
    reports.push({ name, results: { eyebrow: results.eyebrow, score: results.score, steps: results.steps }, apiRequests: apiRequests.length, errors });
    console.log(JSON.stringify(reports.at(-1)));
    await context.close();
    assert.deepEqual(apiRequests, [], `${name}: preview must not call /api`);
    assert.deepEqual(errors, [], name + ' has no browser errors');
  }
} catch (error) {
  console.error(error);
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: path.join(evidenceDir, 'failure.png'), fullPage: true });
    console.error((await page.locator('body').innerText()).slice(-3000));
    for (const frame of page.frames().slice(1)) console.error('CHILD', (await frame.locator('body').innerText()).slice(-2000));
  }
  process.exitCode = 1;
} finally {
  await writeFile(path.join(evidenceDir, 'browser-report.json'), JSON.stringify(reports, null, 2));
  await browser.close(); server.close();
}
if (!process.exitCode) {
  // Every pass that finished is a pass; the Ranked preview passes a live-flag portal cannot run are not.
  const verdict = summarizeFlowResults(reports.map((report) => ({ id: report.name, ok: report.status === 'not-run' ? null : true, reason: report.notRun })), { failOnNotRun: process.argv.includes('--fail-on-not-run'), label: 'STACKED playable smoke' });
  console.log(verdict.line);
  if (verdict.exitCode === NOT_RUN_EXIT_CODE) process.exitCode = NOT_RUN_EXIT_CODE;
}
