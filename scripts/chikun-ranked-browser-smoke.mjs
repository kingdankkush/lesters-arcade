// Chikun's Escape browser smoke (Free and Ranked).
//
// Preview (default; both settlement flags false): serve apps/portal as the web root, then
//   CHIKUN_PORTAL_ORIGIN=http://127.0.0.1:8809 CHIKUN_MODE=ranked|free node scripts/chikun-ranked-browser-smoke.mjs
// The legacy stub provider (fixture key 0x11…11) signs in. Ranked shows the parent results screen in
// its `preview` state (contract §7.3), the child's share row stays hidden for Ranked (§7.4), the run
// lands on the device-local board and profile (A22), and the portal makes no /api call at all (§9.1).
//
// Live (runbook step 10, OPTIONAL, OWNER APPROVAL REQUIRED; spends 0.102 testnet zkLTC):
//   node scripts/chikun-ranked-browser-smoke.mjs --live --site https://lestersarcade.io \
//     --rpc https://liteforge.rpc.caldera.xyz/http --player-key-file <path> [--player-key-field <field>] \
//     --confirm-live SPEND_TESTNET_ZKLTC --yes [--out <path>]
// runs one Chikun Ranked run on the real site with the fixture wallet (scripts/lib/fixture-wallet.mjs,
// the key read in Node through scripts/lib/key-source.mjs and never printed) through the live-flag
// browser run (scripts/ranked-live-browser-e2e.mjs): sign-in, the entry, the published results screen,
// the share page and a clean console. Without --yes it prints the plan and stops.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
if (argv.includes('--live')) {
  if (argv.some((arg) => arg === '--games' || arg.startsWith('--games='))) {
    console.error('The Chikun live smoke runs Chikun only; leave out --games.');
    process.exit(2);
  }
  const { runLiveCli } = await import('./ranked-live-browser-e2e.mjs');
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const out = argv.some((arg) => arg === '--out' || arg.startsWith('--out=')) ? [] : ['--out', `docs/qa/chikun-ranked-live-smoke-${stamp}.json`];
  process.exitCode = await runLiveCli({ argv: [...argv, '--games', 'chikun', ...out] });
} else {
  await runPreviewSmoke();
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    if (!process.env.PLAYWRIGHT_PACKAGE_PATH) throw new Error('Set PLAYWRIGHT_PACKAGE_PATH to Playwright when it is not installed at the repository root.');
    return createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE_PATH);
  }
}

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

async function runPreviewSmoke() {
  const origin = process.env.CHIKUN_PORTAL_ORIGIN ?? 'http://127.0.0.1:8791';
  if (await servedSettlementLive(origin) === true) {
    console.error(`${origin} serves SETTLEMENT_LIVE = true. This smoke asserts the preview (both flags off); after the flip use the --live variant (runbook step 10).`);
    process.exitCode = 2;
    return;
  }
  const { chromium } = await loadPlaywright();
  const evidencePath = process.env.CHIKUN_SMOKE_SCREENSHOT
    ?? fileURLToPath(new URL('../docs/testing/VISUAL_BASELINES/current/chikun-ranked-flow.png', import.meta.url));
  const chromePath = process.env.CHROME_EXECUTABLE_PATH ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
  const viewportMatch = /^(\d+)x(\d+)$/.exec(process.env.CHIKUN_VIEWPORT ?? '1440x1000');
  if (!viewportMatch) throw new Error('CHIKUN_VIEWPORT must use WIDTHxHEIGHT, for example 390x844.');
  const viewport = { width: Number(viewportMatch[1]), height: Number(viewportMatch[2]) };
  const mode = process.env.CHIKUN_MODE ?? 'ranked';
  if (!['free', 'ranked'].includes(mode)) throw new Error('CHIKUN_MODE must be free or ranked.');
  const ranked = mode === 'ranked';
  const MIN_TOUCH_TARGET_PX = 44;
  const BROWSER_GEOMETRY_EPSILON_PX = 0.05;
  const meetsTouchTarget = (value) => Number.isFinite(value)
    && value >= MIN_TOUCH_TARGET_PX - BROWSER_GEOMETRY_EPSILON_PX;
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  let page;
  const issues = [];
  const apiRequests = [];

  try {
    page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    });
    // Name the failing URL so a static-host 404/501 is diagnosable from the log.
    page.on('response', (response) => {
      if (response.status() >= 400) issues.push(`http ${response.status()} ${response.request().method()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText ?? 'failed';
      // A view that drops an image or media element cancels its load; that is not a failed request.
      if (/ERR_ABORTED/.test(failure) && request.method() === 'GET' && request.url().startsWith(origin) && !request.url().includes('/api/')) return;
      issues.push(`requestfailed: ${request.method()} ${request.url()} ${failure}`);
    });
    // Both flags are false in preview: the portal must not call any /api endpoint (contract §9.1).
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${request.url()}`);
    });
    await page.addInitScript(() => {
      const listeners = new Map();
      // Fixture key 0x11..11 (never a real wallet). The portal now recovers the
      // SIWE signature, so the fixture signs the exact challenge with ethers.
      const account = '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a';
      globalThis.ethereum = {
        isMetaMask: true,
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
        on: (event, listener) => listeners.set(event, listener),
        removeListener: (event) => listeners.delete(event),
      };
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (payload) => { globalThis.__chikunSharedPayload = payload; },
      });
    });

    await page.goto(`${origin}/?chikunSmoke=${mode}`, { waitUntil: 'networkidle' });
    assert.equal((await page.locator('#officialConnectButton').textContent())?.trim(), 'Sign in', 'the splash offers Sign in');
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
    await mkdir(dirname(evidencePath), { recursive: true });
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
    // Preview copy (ranked-client, site-copy): Ranked is replay-verified and saved on this device.
    assert.match(await page.locator('#officialRankedModeCopy').textContent(), /replay verification[\s\S]*saved on this device[\s\S]*nothing is published on chain yet/i);
    await page.screenshot({ path: resolve(dirname(evidencePath), 'chikun-mode-select.png'), fullPage: true });

    let entryModal = null;
    if (ranked) {
      await page.click('#officialRankedModeButton');
      await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible' });
      entryModal = (await page.locator('#rankedEntryModal').innerText()).replace(/\s+/g, ' ');
      // The entry modal (signin-entry): eyebrow, the 0.1 + 0.002 = 0.102 zkLTC quote, preview wording.
      assert.match(entryModal, /Ranked · Entry/i);
      assert.match(entryModal, /Entry 0\.1 zkLTC/);
      assert.match(entryModal, /Settlement reserve/);
      assert.match(entryModal, /0\.002 zkLTC/);
      assert.match(entryModal, /Total 0\.102 zkLTC/);
      assert.match(entryModal, /no transaction is sent/i);
      assert.equal((await page.locator('#rankedEntryApprove').textContent())?.trim(), 'Start Ranked Run');
      await page.click('#rankedEntryApprove');
    } else {
      await page.click('#officialFreeModeButton');
      assert.equal(await page.locator('#rankedEntryModal').isVisible(), false, 'Free Mode must not enter Ranked preflight');
    }

    const frameNode = page.locator('iframe.chikun-game-frame');
    await frameNode.waitFor({ state: 'visible', timeout: 15_000 });
    const frame = page.frameLocator('iframe.chikun-game-frame');
    await frame.locator('#startButton').waitFor({ state: 'visible', timeout: 15_000 });
    await frame.locator('#liveStatus').filter({
      hasText: ranked ? 'Ready for Ranked Mode.' : 'Ready for Free Mode.',
    }).waitFor({ state: 'visible', timeout: 15_000 });
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
    assert.ok(meetsTouchTarget(startButtonRect?.height), `Chikun start control is too small: ${JSON.stringify(startButtonRect)}`);
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
    assert.ok(pauseControls.every((rect) => rect.left >= 0 && rect.right <= rect.viewportWidth && rect.top >= 0 && rect.bottom <= rect.viewportHeight && meetsTouchTarget(rect.height)), `Chikun pause controls are not mobile-safe: ${JSON.stringify(pauseControls)}`);
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
      controlRects.every((rect) => rect.left >= 0 && rect.right <= rect.viewportWidth && rect.top >= 0 && rect.bottom <= rect.viewportHeight && meetsTouchTarget(rect.width) && meetsTouchTarget(rect.height)),
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

    // Ranked: the parent results screen (results-share, contract §7.3) opens over the cabinet in its
    // preview state. It is closed (Escape) before anything in the child panel is clicked, and a
    // "View results" button then stays over the cabinet.
    let results = null;
    if (ranked) {
      const screen = page.locator('[data-ranked-results]');
      await screen.waitFor({ state: 'visible', timeout: 60_000 });
      await page.waitForFunction(() => document.querySelector('[data-ranked-results]')?.dataset.state === 'preview', null, { timeout: 10_000 });
      results = await screen.evaluate((root) => {
        const read = (selector) => root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        return {
          state: root.dataset.state,
          eyebrow: read('.rr-eyebrow'),
          score: read('.rr-score-value'),
          banner: read('.rr-banner-text'),
          timeline: [...root.querySelectorAll('li[data-step]')].map((node) => node.dataset.status),
          achievements: read('.rr-empty'),
          shareHref: root.querySelector('a[data-share="x"]')?.getAttribute('href') ?? null,
          shareNote: read('.rr-share-note'),
        };
      });
      assert.match(results.eyebrow, /Ranked preview · Chikun's Escape/i);
      assert.match(results.banner, /not published while online settlement is off/i);
      assert.deepEqual([...new Set(results.timeline)], ['skipped'], `every on-chain step is skipped in preview: ${JSON.stringify(results.timeline)}`);
      assert.match(results.achievements, /recorded for live Ranked runs/i);
      // Preview shares the Free template to the site root, never a Ranked share page (§7.3, §7.4).
      const intent = new URL(results.shareHref);
      assert.equal(intent.searchParams.get('url'), 'https://lestersarcade.io');
      assert.match(intent.searchParams.get('text') ?? '', /FREE PLAY · Chikun's Escape[\s\S]*Practising on @LestersArcade/);
      assert.doesNotMatch(intent.searchParams.get('text') ?? '', /0x[a-f0-9]{40}|session-|#/i);
      assert.match(results.shareNote, /Shares a Free Mode post/i);
      await page.screenshot({ path: resolve(dirname(evidencePath), 'chikun-ranked-results.png') });
      await page.keyboard.press('Escape');
      await screen.waitFor({ state: 'detached', timeout: 10_000 });
      await page.locator('.cabinet-results-reopen').waitFor({ state: 'visible', timeout: 5_000 });
    } else {
      assert.equal(await page.locator('[data-ranked-results]').count(), 0, 'a Free run opens no Ranked results screen');
    }

    await frame.locator('#resultScore').evaluate((node) => new Promise((resolve, reject) => {
      const deadline = performance.now() + 15_000;
      const check = () => {
        const overlay = document.querySelector('#resultOverlay');
        if (overlay && getComputedStyle(overlay).display !== 'none' && Number.parseInt(node.textContent ?? '', 10) > 0) resolve(true);
        else if (performance.now() >= deadline) reject(new Error('timed out waiting for Chikun result'));
        else setTimeout(check, 50);
      };
      check();
    }));
    const scoreText = await frame.locator('#resultScore').textContent();
    const score = Number.parseInt(scoreText ?? '', 10);
    assert.ok(Number.isInteger(score) && score > 0, `${mode} runtime did not produce a score: ${scoreText}`);
    if (ranked) assert.equal(results.score.replaceAll(',', ''), String(score), 'the results screen shows the run score');
    const resultUi = await frame.locator('#resultOverlay').evaluate(() => {
      const timeline = document.querySelector('#replayTimeline');
      const share = document.querySelector('#shareRunButton');
      const timelineRect = timeline?.getBoundingClientRect();
      const shareRect = share?.getBoundingClientRect();
      const actionRects = [...document.querySelectorAll('#resultOverlay button')].filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map((button) => {
        const rect = button.getBoundingClientRect();
        return { id: button.id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      return {
        // Count the bins only. The replay playhead is also a child of the timeline,
        // so children.length is 25 once the replay viewer is present.
        bars: timeline?.querySelectorAll('span').length ?? 0,
        playheads: timeline?.querySelectorAll('.replay-playhead').length ?? 0,
        timelineLabel: timeline?.getAttribute('aria-label') ?? '',
        timelineVisible: Boolean(timelineRect && timelineRect.width > 0 && timelineRect.height > 0),
        shareVisible: Boolean(shareRect && shareRect.width > 0 && shareRect.height > 0),
        shareRight: shareRect?.right ?? 0,
        eyebrow: document.querySelector('#resultEyebrow')?.textContent?.trim() ?? '',
        copy: document.querySelector('#resultCopy')?.textContent?.trim() ?? '',
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        actionRects,
      };
    });
    assert.equal(resultUi.bars, 24, `Chikun replay timeline must render 24 bounded bins: ${JSON.stringify(resultUi)}`);
    assert.equal(resultUi.playheads, 1, `Chikun replay timeline must render exactly one playhead: ${JSON.stringify(resultUi)}`);
    assert.match(resultUi.timelineLabel, /flaps across this run/i);
    assert.equal(resultUi.timelineVisible, true);
    assert.ok(resultUi.actionRects.every((rect) => (
      rect.left >= 0 && rect.right <= resultUi.viewportWidth && rect.top >= 0 && rect.bottom <= resultUi.viewportHeight && meetsTouchTarget(rect.bottom - rect.top)
    )), `Chikun result controls must fit entirely inside the child viewport: ${JSON.stringify(resultUi)}`);
    let sharedPayload = null;
    if (ranked) {
      // The parent results screen owns Ranked sharing; the child does not know the session key (§7.4).
      assert.equal(resultUi.shareVisible, false, 'the child share row is hidden for Ranked');
      assert.equal(await frame.locator('#shareRow').isHidden(), true, 'the child share menu is hidden for Ranked');
      assert.match(resultUi.eyebrow, /Ranked flight complete/i);
      assert.match(resultUi.copy, /Ranked run sent to Lester.s Arcade for verification/i);
      assert.equal(await frame.locator('#modeLabel').textContent(), 'Ranked Mode · Verified Flight');
      // The child's Ranked share label is now 'Ranked run' (it no longer claims 'Replay Verified Ranked'
      // before the server has verified anything). No player can reach it (the button is hidden), so the
      // smoke fires the hidden button's own handler to read the text it would share.
      await frame.locator('#shareRunButton').evaluate((button) => button.click());
      await frame.locator('body').evaluate(() => new Promise((resolve, reject) => {
        const deadline = performance.now() + 5_000;
        const check = () => {
          if (globalThis.__chikunSharedPayload) resolve(true);
          else if (performance.now() >= deadline) reject(new Error('the hidden Ranked share handler produced no text'));
          else setTimeout(check, 50);
        };
        check();
      }));
      const rankedShare = await frame.locator('body').evaluate(() => globalThis.__chikunSharedPayload);
      assert.match(rankedShare?.text ?? '', /\. Ranked run on @LestersArcade$/);
      assert.doesNotMatch(rankedShare?.text ?? '', /Replay Verified|verified|0x[a-f0-9]{40}|session-|#/i);
    } else {
      assert.equal(resultUi.shareVisible, true);
      assert.ok(resultUi.shareRight <= resultUi.viewportWidth, `Chikun share control overflows: ${JSON.stringify(resultUi)}`);
      assert.match(resultUi.copy, /Practice score only/i);
      await frame.locator('#shareRunButton').click();
      await frame.locator('#shareRunButton').filter({ hasText: 'Shared' }).waitFor({ state: 'visible' });
      sharedPayload = await frame.locator('body').evaluate(() => globalThis.__chikunSharedPayload);
      assert.equal(sharedPayload?.title, "Chikun's Escape");
      assert.equal(sharedPayload?.url, 'https://lestersarcade.io');
      // Free mode carries the daily-challenge label when one is active for the session
      // seed, and falls back to Free Practice only when it is not.
      assert.match(sharedPayload?.text ?? '', /Free Practice|Daily \d{4}-\d{2}-\d{2}/i);
      assert.match(sharedPayload?.text ?? '', new RegExp(`${score.toLocaleString('en-US')} points`, 'i'));
      assert.doesNotMatch(sharedPayload?.text ?? '', /0x[a-f0-9]{40}|session-/i);
    }
    await frameNode.screenshot({ path: resolve(dirname(evidencePath), `chikun-${mode}-result.png`) });
    if (ranked) {
      await page.waitForFunction(() => /Canonical Ranked preview saved locally[\s\S]*No transaction was sent/i.test(document.querySelector('#officialGameStateCopy')?.textContent ?? ''), null, { timeout: 10_000 });
      // The 1.7.0 line 'accepted for your profile' is gone: preview saves locally, live follows settlement.
      assert.doesNotMatch(await page.locator('#officialGameStateCopy').textContent(), /accepted for your profile/i);
      assert.equal(await page.locator('.cabinet-results-reopen').isVisible(), true, 'View results stays over the cabinet after Escape');
      // A16: Run Again after a Ranked run opens the Ranked entry modal (preview: approves without payment).
      await frame.locator('#restartButton').click();
      await page.locator('#rankedEntryModal:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });
      assert.match(await page.locator('#rankedEntryModal').innerText(), /Ranked · Entry/i);
      // Cancelling that entry leaves the finished cabinet for the game's mode select.
      await page.click('#rankedEntryCancel');
      await page.locator('#rankedEntryModal').waitFor({ state: 'hidden', timeout: 5_000 });
      await page.locator('#officialModeSelect:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });
    } else {
      await page.waitForFunction(() => /no profile or leaderboard write/i.test(document.querySelector('#officialGameStateCopy')?.textContent ?? ''), null, { timeout: 10_000 });
      await frame.locator('#resultExitButton').click();
      await page.locator('#officialArcadeFloor:not([hidden])').waitFor({ state: 'visible', timeout: 10_000 });
    }

    // Device-local board and profile (A22: preview keeps device-local views, marked "Preview · this device").
    await page.getByRole('link', { name: 'Scores', exact: true }).click();
    const chikunScoreTab = page.locator('.leaderboard-game-tab').filter({ hasText: "Chikun's Escape" }).first();
    await chikunScoreTab.click();
    if (ranked) {
      await page.waitForFunction((expectedScore) => [...document.querySelectorAll('.leaderboard-trow .lt-score')].some((node) => node.textContent?.replaceAll(',', '') === String(expectedScore)), score);
    } else {
      assert.equal(await page.locator('.leaderboard-trow .lt-score').filter({ hasText: String(score) }).count(), 0, 'Free Mode score must not appear on the score board');
    }
    const scoreBoardText = (await page.locator('.leaderboard-board-card').innerText()).replace(/\s+/g, ' ');
    assert.match(scoreBoardText, /CHIKUN'S ESCAPE/i);
    assert.match(scoreBoardText, /PREVIEW · THIS DEVICE/i);
    assert.match(scoreBoardText, /Device-local preview: records stay in this browser/i);
    if (ranked) {
      assert.match(scoreBoardText, /COINS/i);
      assert.match(scoreBoardText, /CLEARED/i);
      assert.match(scoreBoardText, /NEAR MISS/i);
      assert.match(scoreBoardText, /THIS DEVICE/);
    } else {
      assert.match(scoreBoardText, /No unpublished local ranked scores/i);
    }

    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    const chikunProfileTab = page.locator('.profile-game-tabs .leaderboard-game-tab').filter({ hasText: "Chikun's Escape" });
    await chikunProfileTab.click();
    const profileText = (await page.locator('.game-stats-card').innerText()).replace(/\s+/g, ' ');
    if (ranked) {
      assert.match(profileText, /LONGEST RUN/i);
      assert.match(profileText, /BEST SCORE.*GROUND & SKY/i);
      assert.match(profileText, /CURRENT RUNS/i);
      assert.match(profileText, /HISTORICAL RUNS/i);
      assert.match(profileText, /NEAR MISSES/i);
      assert.match(profileText, /BEST COMBO/i);
      assert.match(profileText, /Device-local.*SCORE SOURCE/i);
      assert.match(profileText, /parent replays the child input evidence/i);
      assert.match(profileText, /Local cache/i);
      assert.match(profileText, new RegExp(String(score)));
    } else {
      assert.match(profileText, /No runs recorded for Chikun's Escape yet/i);
      assert.doesNotMatch(profileText, new RegExp(`BEST SCORE\\s+${score}`, 'i'));
    }

    await page.screenshot({ path: resolve(evidencePath), fullPage: true });
    assert.deepEqual(apiRequests, [], `preview must not call /api:\n${apiRequests.join('\n')}`);
    assert.deepEqual(issues, [], `browser console/runtime issues:\n${issues.join('\n')}`);
    console.log(JSON.stringify({ status: 'PASS', mode, viewport, score, startUi, pauseControls, frameTiming, cabinetArt, modeArt, entryModal, results, controlRects, upgradeHud, resultUi, sharedPayload, apiRequests: apiRequests.length, scoreBoard: ranked ? 'recorded' : 'isolated', profile: ranked ? 'recorded' : 'isolated', gameplayScreenshot: gameplayPath, screenshot: evidencePath }, null, 2));
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
    console.error(JSON.stringify({ status: 'FAIL', state, issues, apiRequests }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
}
